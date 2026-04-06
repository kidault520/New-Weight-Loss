/**
 * 职级评估引擎
 * 根据评估规则自动核算用户职级，判断维持/晋升/降级
 */

import { OrganizationNode, Rank } from '../types/organization';
import { EvaluationRule, EvaluationCondition, RuleSet } from '../types/commissionRules';
import { OrganizationEngine } from './organizationEngine';
import { PerformanceCalculator } from './performanceCalculator';
import { toBeijingDateString } from '../../../utils/timezone';

export interface EvaluationResult {
  userId: string;
  userName: string;
  currentRank: Rank;
  evaluationRule: EvaluationRule;
  period: string;
  passed: boolean;
  action: 'maintain' | 'promote' | 'demote';
  conditionsMet: boolean[];
  conditionDetails: Array<{
    condition: EvaluationCondition;
    actualValue: number;
    passed: boolean;
  }>;
  nextEvaluationDate?: string;
  evaluatedAt: string;
}

export interface EvaluationData {
  personalPerformance: number;
  groupPerformance?: number;
  departmentPerformance?: number;
  areaPerformance?: number;
  directTeamSize: number;
  directGroupCount: number;
  directDepartmentCount: number;
  directRecommendationCount: number;
}

export class PromotionEvaluator {
  private orgEngine: OrganizationEngine;
  private performanceCalculator: PerformanceCalculator;

  constructor(orgEngine: OrganizationEngine) {
    this.orgEngine = orgEngine;
    this.performanceCalculator = new PerformanceCalculator(orgEngine);
  }

  /**
   * 评估用户职级
   */
  evaluate(
    userId: string,
    period: string,
    ruleSet: RuleSet
  ): EvaluationResult | null {
    const node = this.orgEngine.getNode(userId);
    if (!node) return null;

    const evaluationRule = this.findApplicableRule(node.rank, ruleSet.evaluationRules || []);
    if (!evaluationRule) return null;

    const evaluationData = this.getEvaluationData(userId, node);

    const conditionsToCheck = this.getConditionsToCheck(evaluationRule, node.rank);
    const conditionResults = this.checkConditions(evaluationData, conditionsToCheck);

    const passed = conditionResults.every((r) => r.passed);

    const action = this.determineAction(
      node.rank,
      passed,
      evaluationRule,
      evaluationData
    );

    const nextEvaluationDate = this.getNextEvaluationDate(evaluationRule, period);

    return {
      userId: node.id,
      userName: node.name,
      currentRank: node.rank,
      evaluationRule,
      period,
      passed,
      action,
      conditionsMet: conditionResults.map((r) => r.passed),
      conditionDetails: conditionResults,
      nextEvaluationDate,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取评估数据
   */
  private getEvaluationData(userId: string, node: OrganizationNode): EvaluationData {
    const performance = this.performanceCalculator.calculatePerformanceSummary(userId);
    const directJurisdictions = this.orgEngine.getDirectJurisdictions(userId);
    this.orgEngine.getDirectRecommendations(userId);

    const directTeamSize = this.calculateDirectTeamSize(node);
    const directGroupCount = directJurisdictions.groups.length;
    const directDepartmentCount = directJurisdictions.departments.length;
    const directRecommendationCount = this.orgEngine.getDirectRecommendations(userId).length;

    return {
      personalPerformance: performance.personalPerformance || 0,
      groupPerformance: performance.directGroupPerformance,
      departmentPerformance: performance.departmentPerformance,
      areaPerformance: performance.areaPerformance,
      directTeamSize,
      directGroupCount,
      directDepartmentCount,
      directRecommendationCount,
    };
  }

  /**
   * 计算直辖人力
   */
  private calculateDirectTeamSize(node: OrganizationNode): number {
    let count = 0;
    const countRecursive = (n: OrganizationNode) => {
      n.children.forEach((child) => {
        count++;
        if (child.children.length > 0) {
          countRecursive(child);
        }
      });
    };
    countRecursive(node);
    return count;
  }

  /**
   * 找到适用的评估规则
   */
  private findApplicableRule(
    rank: Rank,
    evaluationRules: EvaluationRule[]
  ): EvaluationRule | null {
    return (
      evaluationRules.find(
        (rule) =>
          !rule.applicableRanks || rule.applicableRanks.includes(rank)
      ) || null
    );
  }

  /**
   * 获取需要检查的条件
   */
  private getConditionsToCheck(
    rule: EvaluationRule,
    _currentRank: Rank
  ): EvaluationCondition[] {
    return rule.conditions || [];
  }

  /**
   * 检查条件是否满足
   */
  private checkConditions(
    data: EvaluationData,
    conditions: EvaluationCondition[]
  ): Array<{
    condition: EvaluationCondition;
    actualValue: number;
    passed: boolean;
  }> {
    return conditions.map((condition) => {
      const actualValue = this.getFieldValue(data, condition.field);
      const passed = this.evaluateCondition(actualValue, condition);
      return {
        condition,
        actualValue,
        passed,
      };
    });
  }

  /**
   * 获取字段值
   */
  private getFieldValue(data: EvaluationData, field: string): number {
    const fieldMap: Record<string, number> = {
      personalPerformance: data.personalPerformance,
      groupPerformance: data.groupPerformance || 0,
      departmentPerformance: data.departmentPerformance || 0,
      areaPerformance: data.areaPerformance || 0,
      directTeamSize: data.directTeamSize,
      directGroupCount: data.directGroupCount,
      directDepartmentCount: data.directDepartmentCount,
      directRecommendationCount: data.directRecommendationCount,
    };
    return fieldMap[field] || 0;
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(
    actualValue: number,
    condition: EvaluationCondition
  ): boolean {
    switch (condition.operator) {
      case '>=':
        return actualValue >= condition.value;
      case '<=':
        return actualValue <= condition.value;
      case '==':
        return actualValue === condition.value;
      case '!=':
        return actualValue !== condition.value;
      case '>':
        return actualValue > condition.value;
      case '<':
        return actualValue < condition.value;
      default:
        return false;
    }
  }

  /**
   * 判断维持/晋升/降级
   */
  private determineAction(
    _currentRank: Rank,
    passed: boolean,
    rule: EvaluationRule,
    data: EvaluationData
  ): 'maintain' | 'promote' | 'demote' {
    if (!passed && rule.demotionConditions) {
      const demotionResults = this.checkConditions(data, rule.demotionConditions);
      if (demotionResults.every((r) => r.passed)) {
        return 'demote';
      }
    }

    if (passed && rule.promotionConditions) {
      const promotionResults = this.checkConditions(data, rule.promotionConditions);
      if (promotionResults.every((r) => r.passed)) {
        return 'promote';
      }
    }

    return 'maintain';
  }

  /**
   * 获取下次评估时间
   */
  private getNextEvaluationDate(
    rule: EvaluationRule,
    _currentPeriod: string
  ): string {
    const now = new Date();
    let nextDate: Date;

    switch (rule.evaluationPeriod) {
      case 'monthly':
        nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'quarterly':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const nextQuarter = currentQuarter + 1;
        const nextYear = nextQuarter >= 4 ? now.getFullYear() + 1 : now.getFullYear();
        const nextQuarterMonth = (nextQuarter % 4) * 3;
        nextDate = new Date(nextYear, nextQuarterMonth, 1);
        break;
      case 'yearly':
        nextDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return toBeijingDateString(nextDate);
  }
}
