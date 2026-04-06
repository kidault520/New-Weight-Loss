/**
 * 考核通知服务
 * 对应 B 端 evaluationStorage
 */

import { supabase } from '../../config/supabase';

export type EvaluationAction = 'promote' | 'maintain' | 'demote' | 'leave';
export type NotificationStatus = 'pending' | 'approved' | 'rejected';

export interface EvaluationNotification {
  id: string;
  personId: string;
  personName?: string;
  currentRank?: string;
  evaluationPeriod: string;
  evaluationDate?: string;
  action: EvaluationAction;
  targetRank?: string;
  reason?: string;
  conditionDetails: unknown[];
  status: NotificationStatus;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectReason?: string;
}

export interface ApprovalHistory {
  id: string;
  notificationId: string;
  personId: string;
  personName?: string;
  action: 'approve' | 'reject';
  reason?: string;
  approvedBy: string;
  approvedAt: string;
}

function rowToNotification(r: Record<string, unknown>): EvaluationNotification {
  return {
    id: r.id as string,
    personId: r.person_id as string,
    personName: r.person_name as string | undefined,
    currentRank: r.current_rank as string | undefined,
    evaluationPeriod: r.evaluation_period as string,
    evaluationDate: r.evaluation_date as string | undefined,
    action: r.action as EvaluationAction,
    targetRank: r.target_rank as string | undefined,
    reason: r.reason as string | undefined,
    conditionDetails: (r.condition_details as unknown[]) || [],
    status: (r.status as NotificationStatus) || 'pending',
    createdAt: r.created_at as string | undefined,
    approvedAt: r.approved_at as string | undefined,
    approvedBy: r.approved_by as string | undefined,
    rejectReason: r.reject_reason as string | undefined,
  };
}

export const salesEvaluationService = {
  async getNotifications(): Promise<EvaluationNotification[]> {
    const { data, error } = await supabase
      .from('sales_evaluation_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToNotification);
  },

  async getPendingNotifications(): Promise<EvaluationNotification[]> {
    const { data, error } = await supabase
      .from('sales_evaluation_notifications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToNotification);
  },

  async getById(id: string): Promise<EvaluationNotification | null> {
    const { data, error } = await supabase
      .from('sales_evaluation_notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToNotification(data) : null;
  },

  async getByPersonId(personId: string): Promise<EvaluationNotification[]> {
    const { data, error } = await supabase
      .from('sales_evaluation_notifications')
      .select('*')
      .eq('person_id', personId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToNotification);
  },

  async add(notification: Omit<EvaluationNotification, 'id' | 'createdAt'>): Promise<EvaluationNotification> {
    const row: Record<string, unknown> = {
      person_id: notification.personId,
      person_name: notification.personName ?? null,
      current_rank: notification.currentRank ?? null,
      evaluation_period: notification.evaluationPeriod,
      evaluation_date: notification.evaluationDate ?? null,
      action: notification.action,
      target_rank: notification.targetRank ?? null,
      reason: notification.reason ?? null,
      condition_details: notification.conditionDetails ?? [],
      status: notification.status ?? 'pending',
    };

    const { data, error } = await supabase
      .from('sales_evaluation_notifications')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return rowToNotification(data);
  },

  async updateStatus(
    id: string,
    status: NotificationStatus,
    approvedBy?: string,
    rejectReason?: string
  ): Promise<EvaluationNotification> {
    const row: Record<string, unknown> = {
      status,
      approved_at: status !== 'pending' ? new Date().toISOString() : null,
      approved_by: approvedBy ?? null,
      reject_reason: rejectReason ?? null,
    };

    const { data, error } = await supabase
      .from('sales_evaluation_notifications')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return rowToNotification(data);
  },

  async addApprovalHistory(history: Omit<ApprovalHistory, 'id' | 'approvedAt'>): Promise<void> {
    const { error } = await supabase.from('sales_approval_history').insert({
      notification_id: history.notificationId,
      person_id: history.personId,
      person_name: history.personName ?? null,
      action: history.action,
      reason: history.reason ?? null,
      approved_by: history.approvedBy,
    });

    if (error) throw error;
  },

  async getApprovalHistories(): Promise<ApprovalHistory[]> {
    const { data, error } = await supabase
      .from('sales_approval_history')
      .select('*')
      .order('approved_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      notificationId: r.notification_id,
      personId: r.person_id,
      personName: r.person_name,
      action: r.action,
      reason: r.reason,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
    }));
  },
};
