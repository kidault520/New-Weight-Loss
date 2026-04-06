/**
 * 审批服务
 * 处理考核通知的审批流程
 */

import { EvaluationNotification } from '../types/commissionRules';
import { EvaluationStorage, ApprovalHistory } from '../utils/evaluationStorage';

export class EvaluationApprovalService {
  private currentUserId: string;

  constructor(currentUserId: string = 'system') {
    this.currentUserId = currentUserId;
  }

  /**
   * 设置当前用户ID
   */
  setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * 获取待审批通知列表
   */
  getPendingNotifications(): EvaluationNotification[] {
    return EvaluationStorage.getPendingNotifications();
  }

  /**
   * 一键全部通过
   * @param notificationIds 通知ID列表（可选，如果不提供则通过所有待审批的）
   */
  approveAll(notificationIds?: string[]): {
    success: boolean;
    approvedCount: number;
    errors: string[];
  } {
    const pendingNotifications = this.getPendingNotifications();
    const idsToApprove = notificationIds || pendingNotifications.map(n => n.id);
    const errors: string[] = [];
    let approvedCount = 0;

    for (const id of idsToApprove) {
      try {
        const success = EvaluationStorage.updateNotificationStatus(
          id,
          'approved',
          this.currentUserId
        );

        if (success) {
          approvedCount++;
          
          // 记录审批历史
          const notification = EvaluationStorage.getNotificationById(id);
          if (notification) {
            const history: ApprovalHistory = {
              id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              notificationId: id,
              personId: notification.personId,
              personName: notification.personName,
              action: 'approve',
              approvedBy: this.currentUserId,
              approvedAt: new Date().toISOString(),
            };
            EvaluationStorage.saveApprovalHistory(history);
          }
        } else {
          errors.push(`通知 ${id} 审批失败：未找到通知`);
        }
      } catch (error) {
        errors.push(`通知 ${id} 审批失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      success: errors.length === 0,
      approvedCount,
      errors,
    };
  }

  /**
   * 单独通过
   * @param notificationId 通知ID
   */
  approveSingle(notificationId: string): {
    success: boolean;
    error?: string;
  } {
    try {
      const notification = EvaluationStorage.getNotificationById(notificationId);
      
      if (!notification) {
        return { success: false, error: '通知不存在' };
      }

      if (notification.status !== 'pending') {
        return { success: false, error: `通知状态为${notification.status}，无法审批` };
      }

      const success = EvaluationStorage.updateNotificationStatus(
        notificationId,
        'approved',
        this.currentUserId
      );

      if (success) {
        // 记录审批历史
        const history: ApprovalHistory = {
          id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          notificationId,
          personId: notification.personId,
          personName: notification.personName,
          action: 'approve',
          approvedBy: this.currentUserId,
          approvedAt: new Date().toISOString(),
        };
        EvaluationStorage.saveApprovalHistory(history);

        return { success: true };
      } else {
        return { success: false, error: '更新通知状态失败' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 单独驳回
   * @param notificationId 通知ID
   * @param reason 驳回原因
   */
  rejectSingle(notificationId: string, reason: string): {
    success: boolean;
    error?: string;
  } {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: '驳回原因不能为空' };
    }

    try {
      const notification = EvaluationStorage.getNotificationById(notificationId);
      
      if (!notification) {
        return { success: false, error: '通知不存在' };
      }

      if (notification.status !== 'pending') {
        return { success: false, error: `通知状态为${notification.status}，无法驳回` };
      }

      const success = EvaluationStorage.updateNotificationStatus(
        notificationId,
        'rejected',
        this.currentUserId,
        reason
      );

      if (success) {
        // 记录审批历史
        const history: ApprovalHistory = {
          id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          notificationId,
          personId: notification.personId,
          personName: notification.personName,
          action: 'reject',
          reason,
          approvedBy: this.currentUserId,
          approvedAt: new Date().toISOString(),
        };
        EvaluationStorage.saveApprovalHistory(history);

        return { success: true };
      } else {
        return { success: false, error: '更新通知状态失败' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 批量驳回
   */
  rejectBatch(notificationIds: string[], reason: string): {
    success: boolean;
    rejectedCount: number;
    errors: string[];
  } {
    if (!reason || reason.trim().length === 0) {
      return { success: false, rejectedCount: 0, errors: ['驳回原因不能为空'] };
    }

    const errors: string[] = [];
    let rejectedCount = 0;

    for (const id of notificationIds) {
      const result = this.rejectSingle(id, reason);
      if (result.success) {
        rejectedCount++;
      } else {
        errors.push(`通知 ${id}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      rejectedCount,
      errors,
    };
  }

  /**
   * 获取审批历史
   */
  getApprovalHistories(notificationId?: string): ApprovalHistory[] {
    if (notificationId) {
      const history = EvaluationStorage.getApprovalHistoryByNotificationId(notificationId);
      return history ? [history] : [];
    }
    return EvaluationStorage.getApprovalHistories();
  }

  /**
   * 获取指定人员的审批历史
   */
  getApprovalHistoriesByPersonId(personId: string): ApprovalHistory[] {
    return EvaluationStorage.getApprovalHistoriesByPersonId(personId);
  }
}
