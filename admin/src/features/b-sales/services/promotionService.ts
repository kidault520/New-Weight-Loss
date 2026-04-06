/**
 * 晋升服务 - 晋升自动化处理
 */

import { Person, Team, Rank, PromotionHistory } from '../types/organization';
import { OrganizationService } from './organizationService';
import { TeamManagementService } from './teamService';
import { PromotionRule, RuleSet } from '../types/commissionRules';
import { getDefaultRules } from '../utils/commissionRules';
import { getTodayBeijing } from '../../../utils/timezone';

export class PromotionService {
  private orgService: OrganizationService;
  private teamService: TeamManagementService;
  private persons: Map<string, Person>;
  private promotionHistory: PromotionHistory[];
  private ruleSet: RuleSet;

  constructor(orgService: OrganizationService, ruleSet?: RuleSet) {
    this.orgService = orgService;
    this.teamService = new TeamManagementService(orgService);
    const data = orgService.getData();
    this.persons = data.persons;
    this.promotionHistory = data.promotionHistory;
    this.ruleSet = ruleSet || getDefaultRules();
  }

  /**
   * 检查晋升条件
   */
  checkPromotionConditions(personId: string, targetLevel: Rank): {
    canPromote: boolean;
    reasons: string[];
    missingConditions?: string[];
  } {
    const person = this.persons.get(personId);
    if (!person) {
      return { canPromote: false, reasons: ['人员不存在'] };
    }

    if (person.status !== '活跃') {
      return { canPromote: false, reasons: ['人员状态不是活跃'] };
    }

    const missingConditions: string[] = [];

    const promotionRules = this.ruleSet.promotionRules || [];
    const levelMap: Record<Rank, number> = {
      收展员: 1,
      组经理: 2,
      部经理: 3,
      区经理: 4,
    };
    const targetLevelNum = levelMap[targetLevel];
    const rule = promotionRules.find((r) => (r as PromotionRule).level === targetLevelNum);

    if (!rule || !(rule as PromotionRule).requirementsConditions) {
      return { canPromote: false, reasons: ['未找到对应的晋升规则或规则配置不完整'] };
    }

    const directRecommendations = this.orgService.persons.getRecommendedPersons(personId);
    const activeRecommendations = directRecommendations.filter((p) => p.status === '活跃');
    const subordinates = this.orgService.persons.getSubordinates(personId);
    const teamPerformance = subordinates.reduce((sum, p) => sum + p.performance, 0);

    for (const condition of (rule as PromotionRule).requirementsConditions!) {
      let actualValue: number;

      switch (condition.field) {
        case 'personalPerformance':
          actualValue = person.performance;
          break;
        case 'teamPerformance':
          actualValue = teamPerformance;
          break;
        case 'directTeamSize':
          actualValue = this.orgService.persons.getSubordinates(personId).length;
          break;
        case 'directRecommendationCount':
          actualValue = activeRecommendations.length;
          break;
        default:
          continue;
      }

      const meetsCondition = this.evaluateCondition(actualValue, condition.operator, condition.value);
      if (!meetsCondition) {
        const desc = condition.description || `${condition.field} ${condition.operator} ${condition.value}`;
        missingConditions.push(`${desc}（当前：${actualValue}）`);
      }
    }

    if (missingConditions.length > 0) {
      return { canPromote: false, reasons: missingConditions, missingConditions };
    }

    return { canPromote: true, reasons: ['满足所有晋升条件'] };
  }

  /**
   * 评估条件
   */
  private evaluateCondition(actualValue: number, operator: string, targetValue: number): boolean {
    switch (operator) {
      case '>=':
        return actualValue >= targetValue;
      case '<=':
        return actualValue <= targetValue;
      case '==':
        return actualValue === targetValue;
      case '!=':
        return actualValue !== targetValue;
      case '>':
        return actualValue > targetValue;
      case '<':
        return actualValue < targetValue;
      default:
        return false;
    }
  }

  /**
   * 晋升为区经 - 自动创建新队伍
   */
  promoteToAreaManager(personId: string): { person: Person; team: Team } | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    const checkResult = this.checkPromotionConditions(personId, '区经理');
    if (!checkResult.canPromote) {
      throw new Error(`不满足晋升条件：${checkResult.reasons.join(', ')}`);
    }

    let targetTeam: Team;
    if (person.teamId) {
      const currentTeam = this.orgService.teams.getTeam(person.teamId);
      if (currentTeam?.isTemporary) {
        const convertedTeam = this.orgService.teams.convertTemporaryTeamToFormal(person.teamId, personId);
        if (!convertedTeam) {
          throw new Error('无法将临时队伍转化为正式队伍');
        }
        targetTeam = convertedTeam;
      } else {
        targetTeam = this.teamService.createTeam(
          personId,
          person.name,
          person.regionId,
          person.provinceId,
          person.cityId,
          person.districtId
        );
      }
    } else {
      targetTeam = this.teamService.createTeam(
        personId,
        person.name,
        person.regionId,
        person.provinceId,
        person.cityId,
        person.districtId
      );
    }

    const updatedPerson = this.orgService.persons.updatePerson(personId, {
      level: '区经理',
      teamId: targetTeam.id,
      promoteDate: getTodayBeijing(),
    });

    if (!updatedPerson) return null;

    this.recordPromotionHistory(personId, person.level, '区经理', targetTeam.id);

    this.teamService.updateTeamStats(targetTeam.id);

    return { person: updatedPerson, team: targetTeam };
  }

  /**
   * 晋升为部经理
   */
  promoteToDepartmentManager(personId: string): Person | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    const checkResult = this.checkPromotionConditions(personId, '部经理');
    if (!checkResult.canPromote) {
      throw new Error(`不满足晋升条件：${checkResult.reasons.join(', ')}`);
    }

    const updatedPerson = this.orgService.persons.updatePerson(personId, {
      level: '部经理',
      promoteDate: getTodayBeijing(),
    });

    if (!updatedPerson) return null;

    this.recordPromotionHistory(personId, person.level, '部经理');

    return updatedPerson;
  }

  /**
   * 晋升为组经理
   */
  promoteToGroupManager(personId: string): Person | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    const checkResult = this.checkPromotionConditions(personId, '组经理');
    if (!checkResult.canPromote) {
      throw new Error(`不满足晋升条件：${checkResult.reasons.join(', ')}`);
    }

    const updatedPerson = this.orgService.persons.updatePerson(personId, {
      level: '组经理',
      promoteDate: getTodayBeijing(),
    });

    if (!updatedPerson) return null;

    this.recordPromotionHistory(personId, person.level, '组经理');

    if (person.teamId) {
      this.teamService.updateTeamStats(person.teamId);
    }

    return updatedPerson;
  }

  /**
   * 通用晋升方法
   */
  promote(personId: string, targetLevel: Rank): Person | { person: Person; team: Team } | null {
    switch (targetLevel) {
      case '区经理':
        return this.promoteToAreaManager(personId);
      case '部经理':
        return this.promoteToDepartmentManager(personId);
      case '组经理':
        return this.promoteToGroupManager(personId);
      default:
        throw new Error(`不支持晋升到 ${targetLevel}`);
    }
  }

  /**
   * 记录晋升历史
   */
  recordPromotionHistory(
    personId: string,
    fromLevel: Rank,
    toLevel: Rank,
    teamId?: string
  ): PromotionHistory {
    const history: PromotionHistory = {
      id: `promotion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      personId,
      fromLevel,
      toLevel,
      promoteDate: getTodayBeijing(),
      teamId,
    };

    this.promotionHistory.push(history);
    return history;
  }

  /**
   * 获取晋升历史
   */
  getPromotionHistory(personId?: string): PromotionHistory[] {
    if (personId) {
      return this.promotionHistory.filter((h) => h.personId === personId);
    }
    return [...this.promotionHistory];
  }
}
