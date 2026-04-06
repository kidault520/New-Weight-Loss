/**
 * 考核通知和审批历史存储工具
 * 使用localStorage进行持久化存储
 * 当配置 Supabase 时，自动使用 Supabase 作为后端
 */

import { EvaluationNotification, NotificationStatus } from '../types/commissionRules';
import { isSupabaseConfigured } from '@/config/supabase';
import { salesEvaluationService } from '../services/sales/salesEvaluationService';

const STORAGE_KEY_NOTIFICATIONS = 'evaluation_notifications';
const STORAGE_KEY_APPROVAL_HISTORY = 'evaluation_approval_history';

export interface ApprovalHistory {
  id: string;
  notificationId: string;
  personId: string;
  personName: string;
  action: 'approve' | 'reject';
  reason?: string;
  approvedBy: string;
  approvedAt: string;
}

let _notifCache: EvaluationNotification[] | null = null;
let _approvalCache: ApprovalHistory[] | null = null;

export class EvaluationStorage {
  static async initAsync(): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const [notifs, approvals] = await Promise.all([
        salesEvaluationService.getNotifications(),
        salesEvaluationService.getApprovalHistories(),
      ]);
      _notifCache = notifs.map((n) => ({ ...n, personName: n.personName ?? '' })) as EvaluationNotification[];
      _approvalCache = approvals.map((h) => ({
        ...h,
        personName: (h as { personName?: string }).personName ?? '',
        action: (h as { action: string }).action as 'approve' | 'reject',
      })) as ApprovalHistory[];
    } catch (e) {
      console.error('EvaluationStorage init failed:', e);
      _notifCache = [];
      _approvalCache = [];
    }
  }

  /**
   * 保存考核通知
   */
  static saveNotifications(notifications: EvaluationNotification[]): void {
    if (isSupabaseConfigured) {
      _notifCache = notifications;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
    } catch (error) {
      console.error('保存考核通知失败:', error);
    }
  }

  static getNotifications(): EvaluationNotification[] {
    if (isSupabaseConfigured && _notifCache) return _notifCache;
    try {
      const data = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      return data ? (JSON.parse(data) as EvaluationNotification[]) : [];
    } catch (error) {
      console.error('获取考核通知失败:', error);
      return [];
    }
  }

  static getPendingNotifications(): EvaluationNotification[] {
    return this.getNotifications().filter((n) => n.status === 'pending');
  }

  static getNotificationById(id: string): EvaluationNotification | null {
    return this.getNotifications().find((n) => n.id === id) || null;
  }

  static updateNotificationStatus(
    id: string,
    status: NotificationStatus,
    approvedBy?: string,
    rejectReason?: string
  ): boolean {
    const notifications = this.getNotifications();
    const index = notifications.findIndex((n) => n.id === id);
    if (index === -1) return false;
    if (isSupabaseConfigured) {
      salesEvaluationService.updateStatus(id, status, approvedBy, rejectReason).then((updated) => {
        if (_notifCache) {
          const idx = _notifCache.findIndex((n) => n.id === id);
          if (idx >= 0) _notifCache[idx] = { ...updated, personName: updated.personName ?? '' } as EvaluationNotification;
        }
      }).catch((e) => console.error('updateNotificationStatus failed:', e));
      const next = { ...notifications[index], status, approvedAt: new Date().toISOString(), approvedBy: approvedBy ?? notifications[index].approvedBy, rejectReason: rejectReason ?? notifications[index].rejectReason };
      if (_notifCache) {
        const idx = _notifCache.findIndex((n) => n.id === id);
        if (idx >= 0) _notifCache[idx] = next;
      }
      return true;
    }
    notifications[index].status = status;
    notifications[index].approvedAt = new Date().toISOString();
    if (approvedBy) notifications[index].approvedBy = approvedBy;
    if (rejectReason) notifications[index].rejectReason = rejectReason;
    this.saveNotifications(notifications);
    return true;
  }

  static batchUpdateNotificationStatus(ids: string[], status: NotificationStatus, approvedBy?: string): number {
    const notifications = this.getNotifications();
    let updatedCount = 0;
    if (isSupabaseConfigured) {
      for (const id of ids) {
        const ok = this.updateNotificationStatus(id, status, approvedBy);
        if (ok) updatedCount++;
      }
      return updatedCount;
    }
    for (const notification of notifications) {
      if (ids.includes(notification.id)) {
        notification.status = status;
        notification.approvedAt = new Date().toISOString();
        if (approvedBy) notification.approvedBy = approvedBy;
        updatedCount++;
      }
    }
    if (updatedCount > 0) this.saveNotifications(notifications);
    return updatedCount;
  }

  static addNotification(notification: EvaluationNotification): void {
    this.addNotifications([notification]);
  }

  static addNotifications(newNotifications: EvaluationNotification[]): void {
    if (isSupabaseConfigured) {
      const toAdd = newNotifications.map(({ id, createdAt, ...rest }) => rest);
      salesEvaluationService.addNotifications(toAdd).then(() =>
        salesEvaluationService.getNotifications()
      ).then((list) => {
        _notifCache = list.map((n) => ({ ...n, personName: n.personName ?? '' })) as EvaluationNotification[];
      }).catch((e) => console.error('addNotifications failed:', e));
      if (_notifCache) _notifCache.push(...newNotifications);
      return;
    }
    const notifications = this.getNotifications();
    notifications.push(...newNotifications);
    this.saveNotifications(notifications);
  }

  static deleteNotification(id: string): boolean {
    const notifications = this.getNotifications();
    const filtered = notifications.filter((n) => n.id !== id);
    if (filtered.length === notifications.length) return false;
    if (isSupabaseConfigured) {
      _notifCache = filtered;
      return true;
    }
    this.saveNotifications(filtered);
    return true;
  }

  static clearNotifications(): void {
    if (isSupabaseConfigured) {
      _notifCache = [];
      return;
    }
    localStorage.removeItem(STORAGE_KEY_NOTIFICATIONS);
  }

  static saveApprovalHistory(history: ApprovalHistory): void {
    if (isSupabaseConfigured) {
      salesEvaluationService.addApprovalHistory({
        notificationId: history.notificationId,
        personId: history.personId,
        personName: history.personName,
        action: history.action,
        reason: history.reason,
        approvedBy: history.approvedBy,
      }).catch((e) => console.error('saveApprovalHistory failed:', e));
      if (_approvalCache) _approvalCache.push(history);
      return;
    }
    try {
      const histories = this.getApprovalHistories();
      histories.push(history);
      localStorage.setItem(STORAGE_KEY_APPROVAL_HISTORY, JSON.stringify(histories));
    } catch (error) {
      console.error('保存审批历史失败:', error);
    }
  }

  static getApprovalHistories(): ApprovalHistory[] {
    if (isSupabaseConfigured && _approvalCache) return _approvalCache;
    try {
      const data = localStorage.getItem(STORAGE_KEY_APPROVAL_HISTORY);
      return data ? (JSON.parse(data) as ApprovalHistory[]) : [];
    } catch (error) {
      console.error('获取审批历史失败:', error);
      return [];
    }
  }

  static getApprovalHistoryByNotificationId(notificationId: string): ApprovalHistory | null {
    return this.getApprovalHistories().find((h) => h.notificationId === notificationId) || null;
  }

  static getApprovalHistoriesByPersonId(personId: string): ApprovalHistory[] {
    return this.getApprovalHistories().filter((h) => h.personId === personId);
  }

  static clearApprovalHistory(): void {
    if (isSupabaseConfigured) {
      _approvalCache = [];
      return;
    }
    localStorage.removeItem(STORAGE_KEY_APPROVAL_HISTORY);
  }
}
