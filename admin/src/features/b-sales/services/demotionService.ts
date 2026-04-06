/**
 * 降级服务 - 处理成员降级
 */

import { Person, Rank, DemotionHistory } from '../types/organization';
import { OrganizationService } from './organizationService';
import { TeamManagementService } from './teamService';
import { EvaluationRule, RuleSet } from '../types/commissionRules';
import { PromotionEvaluator } from '../utils/promotionEvaluator';
import { OrganizationEngine } from '../utils/organizationEngine';
import { getDefaultRules } from '../utils/commissionRules';
import { convertOrgTreeData } from '../utils/orgDataConverter';
import { orgTreeData } from '../data/orgTreeData';
import { getTodayBeijing } from '../../../utils/timezone';

export class DemotionService {
  private orgService: OrganizationService;
  private teamService: TeamManagementService;
  private persons: Map<string, Person>;
  private demotionHistory: DemotionHistory[];

  constructor(orgService: OrganizationService) {
    this.orgService = orgService;
    this.teamService = new TeamManagementService(orgService);
    const data = orgService.getData();
    this.persons = data.persons;
    this.demotionHistory = data.demotionHistory || [];
  }

  /**
   * 检查是否应该降级（根据评估规则）
   */
  checkShouldDemote(personId: string, ruleSet?: RuleSet): {
    shouldDemote: boolean;
    targetLevel?: Rank;
    reason?: string;
    evaluationRule?: EvaluationRule;
  } {
    const person = this.persons.get(personId);
    if (!person || person.status !== '活跃') {
      return { shouldDemote: false };
    }

    const currentRuleSet = ruleSet || getDefaultRules();

    // 使用 convertOrgTreeData(orgTreeData) 构建 OrganizationEngine（OrganizationData 无法直接传入）
    const orgNode = convertOrgTreeData(orgTreeData);
    const orgEngine = new OrganizationEngine(orgNode);
    const evaluator = new PromotionEvaluator(orgEngine);

    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const period = `${now.getFullYear()}-Q${quarter}`;

    const evaluationResult = evaluator.evaluate(personId, period, currentRuleSet);

    if (!evaluationResult || evaluationResult.action !== 'demote') {
      return { shouldDemote: false };
    }

    const rankOrder: Rank[] = ['收展员', '组经理', '部经理', '区经理'];
    const currentIndex = rankOrder.indexOf(person.level);
    if (currentIndex <= 0) {
      return { shouldDemote: false, reason: '已经是最低职级，无法降级' };
    }

    const targetLevel = rankOrder[currentIndex - 1];

    return {
      shouldDemote: true,
      targetLevel,
      reason: `未满足${evaluationResult.evaluationRule.name}的维持条件`,
      evaluationRule: evaluationResult.evaluationRule,
    };
  }

  /**
   * 降级为部经理
   */
  demoteToDepartmentManager(personId: string, reason?: string, evaluationRuleId?: string): Person | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    if (person.level !== '区经理') {
      throw new Error('只能从区经理降级为部经理');
    }

    const updatedPerson = this.orgService.persons.updatePerson(personId, {
      level: '部经理',
      promoteDate: getTodayBeijing(),
    });

    if (!updatedPerson) return null;

    this.recordDemotionHistory(personId, '区经理', '部经理', reason, evaluationRuleId);

    if (person.teamId) {
      this.teamService.updateTeamStats(person.teamId);
    }

    return updatedPerson;
  }

  /**
   * 降级为组经理
   */
  demoteToGroupManager(personId: string, reason?: string, evaluationRuleId?: string): Person | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    if (person.level !== '部经理') {
      throw new Error('只能从部经理降级为组经理');
    }

    const updatedPerson = this.orgService.persons.updatePerson(personId, {
      level: '组经理',
      promoteDate: getTodayBeijing(),
    });

    if (!updatedPerson) return null;

    this.recordDemotionHistory(personId, '部经理', '组经理', reason, evaluationRuleId);

    if (person.teamId) {
      this.teamService.updateTeamStats(person.teamId);
    }

    return updatedPerson;
  }

  /**
   * 降级为收展员
   */
  demoteToAgent(personId: string, reason?: string, evaluationRuleId?: string): Person | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    if (person.level !== '组经理') {
      throw new Error('只能从组经理降级为收展员');
    }

    const updatedPerson = this.orgService.persons.updatePerson(personId, {
      level: '收展员',
      promoteDate: getTodayBeijing(),
    });

    if (!updatedPerson) return null;

    this.recordDemotionHistory(personId, '组经理', '收展员', reason, evaluationRuleId);

    if (person.teamId) {
      this.teamService.updateTeamStats(person.teamId);
    }

    return updatedPerson;
  }

  /**
   * 通用降级方法
   */
  demote(personId: string, targetLevel: Rank, reason?: string, evaluationRuleId?: string): Person | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    switch (targetLevel) {
      case '部经理':
        return this.demoteToDepartmentManager(personId, reason, evaluationRuleId);
      case '组经理':
        return this.demoteToGroupManager(personId, reason, evaluationRuleId);
      case '收展员':
        return this.demoteToAgent(personId, reason, evaluationRuleId);
      default:
        throw new Error(`不支持降级到 ${targetLevel}`);
    }
  }

  /**
   * 记录降级历史
   */
  recordDemotionHistory(
    personId: string,
    fromLevel: Rank,
    toLevel: Rank,
    reason?: string,
    evaluationRuleId?: string
  ): DemotionHistory {
    const history: DemotionHistory = {
      id: `demotion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      personId,
      fromLevel,
      toLevel,
      demoteDate: getTodayBeijing(),
      reason,
      evaluationRuleId,
    };

    this.demotionHistory.push(history);

    const data = this.orgService.getData();
    if (!data.demotionHistory) {
      data.demotionHistory = [];
    }
    data.demotionHistory.push(history);

    return history;
  }

  /**
   * 获取降级历史
   */
  getDemotionHistory(personId?: string): DemotionHistory[] {
    if (personId) {
      return this.demotionHistory.filter((h) => h.personId === personId);
    }
    return [...this.demotionHistory];
  }
}
