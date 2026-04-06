/**
 * 销售历史服务（晋升、脱落、降级）
 */

import { supabase } from '@/config/supabase';

export interface PromotionHistory {
  id: string;
  personId: string;
  fromLevel: string;
  toLevel: string;
  promoteDate: string;
  teamId?: string;
  reason?: string;
}

export interface LeaveHistory {
  id: string;
  personId: string;
  leaveType?: string;
  leaveDate: string;
  reason?: string;
  reassignedTeamId?: string;
}

export interface DemotionHistory {
  id: string;
  personId: string;
  fromLevel: string;
  toLevel: string;
  demoteDate: string;
  reason?: string;
  evaluationRuleId?: string;
}

export const salesHistoryService = {
  async getPromotionHistory(): Promise<PromotionHistory[]> {
    const { data, error } = await supabase.from('sales_promotion_history').select('*').order('promote_date', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      personId: r.person_id,
      fromLevel: r.from_level,
      toLevel: r.to_level,
      promoteDate: r.promote_date,
      teamId: r.team_id,
      reason: r.reason,
    }));
  },

  async addPromotionHistory(h: Omit<PromotionHistory, 'id'>): Promise<void> {
    const { error } = await supabase.from('sales_promotion_history').insert({
      person_id: h.personId,
      from_level: h.fromLevel,
      to_level: h.toLevel,
      promote_date: h.promoteDate,
      team_id: h.teamId ?? null,
      reason: h.reason ?? null,
    });
    if (error) throw error;
  },

  async getLeaveHistory(): Promise<LeaveHistory[]> {
    const { data, error } = await supabase.from('sales_leave_history').select('*').order('leave_date', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      personId: r.person_id,
      leaveType: r.leave_type,
      leaveDate: r.leave_date,
      reason: r.reason,
      reassignedTeamId: r.reassigned_team_id,
    }));
  },

  async addLeaveHistory(h: Omit<LeaveHistory, 'id'>): Promise<void> {
    const { error } = await supabase.from('sales_leave_history').insert({
      person_id: h.personId,
      leave_type: h.leaveType ?? null,
      leave_date: h.leaveDate,
      reason: h.reason ?? null,
      reassigned_team_id: h.reassignedTeamId ?? null,
    });
    if (error) throw error;
  },

  async getDemotionHistory(): Promise<DemotionHistory[]> {
    const { data, error } = await supabase.from('sales_demotion_history').select('*').order('demote_date', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      personId: r.person_id,
      fromLevel: r.from_level,
      toLevel: r.to_level,
      demoteDate: r.demote_date,
      reason: r.reason,
      evaluationRuleId: r.evaluation_rule_id,
    }));
  },

  async addDemotionHistory(h: Omit<DemotionHistory, 'id'>): Promise<void> {
    const { error } = await supabase.from('sales_demotion_history').insert({
      person_id: h.personId,
      from_level: h.fromLevel,
      to_level: h.toLevel,
      demote_date: h.demoteDate,
      reason: h.reason ?? null,
      evaluation_rule_id: h.evaluationRuleId ?? null,
    });
    if (error) throw error;
  },
};
