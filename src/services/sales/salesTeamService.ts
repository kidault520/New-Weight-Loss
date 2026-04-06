/**
 * 队伍服务
 * 对应 B 端 organizationStorage teams
 */

import { supabase } from '../../config/supabase';
import { toLocalDateString } from '../../utils/dateUtils';

export interface SalesTeam {
  id: string;
  code: string;
  name: string;
  customName?: string;
  leaderId: string;
  originalLeaderId: string;
  regionId?: string;
  provinceId?: string;
  cityId?: string;
  districtId?: string;
  memberCount: number;
  activeCount: number;
  totalPerformance: number;
  createdDate: string;
  isTemporary?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function rowToTeam(r: Record<string, unknown>): SalesTeam {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    customName: r.custom_name as string | undefined,
    leaderId: r.leader_id as string,
    originalLeaderId: r.original_leader_id as string,
    regionId: r.region_id as string | undefined,
    provinceId: r.province_id as string | undefined,
    cityId: r.city_id as string | undefined,
    districtId: r.district_id as string | undefined,
    memberCount: Number(r.member_count ?? 0),
    activeCount: Number(r.active_count ?? 0),
    totalPerformance: Number(r.total_performance ?? 0),
    createdDate: r.created_date as string,
    isTemporary: Boolean(r.is_temporary),
    createdAt: r.created_at as string | undefined,
    updatedAt: r.updated_at as string | undefined,
  };
}

export const salesTeamService = {
  async getAll(): Promise<SalesTeam[]> {
    const { data, error } = await supabase
      .from('sales_teams')
      .select('*')
      .order('created_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(rowToTeam);
  },

  async getById(id: string): Promise<SalesTeam | null> {
    const { data, error } = await supabase
      .from('sales_teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToTeam(data) : null;
  },

  async getByLeaderId(leaderId: string): Promise<SalesTeam | null> {
    const { data, error } = await supabase
      .from('sales_teams')
      .select('*')
      .eq('leader_id', leaderId)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToTeam(data) : null;
  },

  async upsert(team: Partial<SalesTeam> & { code: string; name: string; leaderId: string; originalLeaderId: string }): Promise<SalesTeam> {
    const row: Record<string, unknown> = {
      code: team.code,
      name: team.name,
      custom_name: team.customName ?? null,
      leader_id: team.leaderId,
      original_leader_id: team.originalLeaderId,
      region_id: team.regionId ?? null,
      province_id: team.provinceId ?? null,
      city_id: team.cityId ?? null,
      district_id: team.districtId ?? null,
      member_count: team.memberCount ?? 0,
      active_count: team.activeCount ?? 0,
      total_performance: team.totalPerformance ?? 0,
      created_date: team.createdDate ?? toLocalDateString(new Date()),
      is_temporary: team.isTemporary ?? false,
    };

    const { data, error } = await supabase
      .from('sales_teams')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return rowToTeam(data);
  },

  async update(id: string, updates: Partial<SalesTeam>): Promise<SalesTeam> {
    const row: Record<string, unknown> = {};
    if (updates.memberCount !== undefined) row.member_count = updates.memberCount;
    if (updates.activeCount !== undefined) row.active_count = updates.activeCount;
    if (updates.totalPerformance !== undefined) row.total_performance = updates.totalPerformance;

    const { data, error } = await supabase
      .from('sales_teams')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return rowToTeam(data);
  },
};
