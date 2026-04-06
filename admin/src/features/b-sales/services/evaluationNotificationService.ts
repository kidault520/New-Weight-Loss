/**
 * 考核通知服务（简化版）
 * 生成考核通知列表 - 依赖 EvaluationStorage 读取已有通知
 * 完整版需要 evaluationEligibilityService，此处提供简化实现
 */

import { EvaluationNotification, RuleSet } from '../types/commissionRules';
import { EvaluationStorage } from '../utils/evaluationStorage';

export class EvaluationNotificationService {
  constructor() {}

  /**
   * 生成考核通知列表（简化：返回空数组，实际实现需 evaluationEligibilityService）
   * 通知可由其他流程（如定时任务）写入 EvaluationStorage
   */
  generateEvaluationNotifications(
    _period: string,
    _evaluationDate: Date,
    _ruleSet: RuleSet
  ): EvaluationNotification[] {
    // 简化实现：不自动生成，依赖已有数据
    return [];
  }

  /**
   * 获取待审批的通知列表
   */
  getPendingNotifications(): EvaluationNotification[] {
    return EvaluationStorage.getPendingNotifications();
  }

  /**
   * 获取所有通知
   */
  getAllNotifications(): EvaluationNotification[] {
    return EvaluationStorage.getNotifications();
  }

  /**
   * 根据ID获取通知
   */
  getNotificationById(id: string): EvaluationNotification | null {
    return EvaluationStorage.getNotificationById(id);
  }
}
