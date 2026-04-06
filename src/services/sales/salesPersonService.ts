/**
 * 销售员/人员服务
 * 对应 B 端 organizationStorage persons
 */

import { supabase } from '../../config/supabase';

export type Rank = '收展员' | '组经理' | '部经理' | '区经理';
export type PersonStatus = '活跃' | '脱落' | '晋升中';
export type JoinMethod = '推荐加入' | '自主加入' | '外部引进';

export interface SalesPerson {
  id: string;
  code: string;
  name: string;
  level: Rank;
  originalLevel: Rank;
  performance: number;
  avatarUrl: string;
  status: PersonStatus;
  parentId?: string;
  teamId?: string;
  branchId?: string;
  regionId?: string;
  provinceId?: string;
  cityId?: string;
  districtId?: string;
  joinDate: string;
  promoteDate?: string;
  leaveDate?: string;
  joinMethod?: JoinMethod;
  recommenderId?: string;
  isSeed?: boolean;
  authUserId?: string;
  legacyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

function rowToPerson(r: Record<string, unknown>): SalesPerson {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    level: r.level as Rank,
    originalLevel: r.original_level as Rank,
    performance: Number(r.performance ?? 0),
    avatarUrl: (r.avatar_url as string) || '',
    status: (r.status as PersonStatus) || '活跃',
    parentId: r.parent_id as string | undefined,
    teamId: r.team_id as string | undefined,
    branchId: r.branch_id as string | undefined,
    regionId: r.region_id as string | undefined,
    provinceId: r.province_id as string | undefined,
    cityId: r.city_id as string | undefined,
    districtId: r.district_id as string | undefined,
    joinDate: r.join_date as string,
    promoteDate: r.promote_date as string | undefined,
    leaveDate: r.leave_date as string | undefined,
    joinMethod: r.join_method as JoinMethod | undefined,
    recommenderId: r.recommender_id as string | undefined,
    isSeed: Boolean(r.is_seed),
    authUserId: r.auth_user_id as string | undefined,
    legacyId: r.legacy_id as string | undefined,
    createdAt: r.created_at as string | undefined,
    updatedAt: r.updated_at as string | undefined,
  };
}

export const salesPersonService = {
  async getAll(): Promise<SalesPerson[]> {
    const { data, error } = await supabase
      .from('sales_persons')
      .select('*')
      .order('join_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(rowToPerson);
  },

  async getById(id: string): Promise<SalesPerson | null> {
    const { data, error } = await supabase
      .from('sales_persons')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToPerson(data) : null;
  },

  async getByAuthUserId(authUserId: string): Promise<SalesPerson | null> {
    const { data, error } = await supabase
      .from('sales_persons')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToPerson(data) : null;
  },

  async getByTeamId(teamId: string): Promise<SalesPerson[]> {
    const { data, error } = await supabase
      .from('sales_persons')
      .select('*')
      .eq('team_id', teamId)
      .order('join_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(rowToPerson);
  },

  async getSubordinates(parentId: string): Promise<SalesPerson[]> {
    const { data, error } = await supabase
      .from('sales_persons')
      .select('*')
      .eq('parent_id', parentId)
      .order('join_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(rowToPerson);
  },

  async upsert(person: Partial<SalesPerson> & { code: string; name: string; level: Rank; originalLevel: Rank; joinDate: string }): Promise<SalesPerson> {
    const row: Record<string, unknown> = {
      code: person.code,
      name: person.name,
      level: person.level,
      original_level: person.originalLevel,
      performance: person.performance ?? 0,
      avatar_url: person.avatarUrl ?? '',
      status: person.status ?? '活跃',
      parent_id: person.parentId ?? null,
      team_id: person.teamId ?? null,
      branch_id: person.branchId ?? null,
      region_id: person.regionId ?? null,
      province_id: person.provinceId ?? null,
      city_id: person.cityId ?? null,
      district_id: person.districtId ?? null,
      join_date: person.joinDate,
      promote_date: person.promoteDate ?? null,
      leave_date: person.leaveDate ?? null,
      join_method: person.joinMethod ?? null,
      recommender_id: person.recommenderId ?? null,
      is_seed: person.isSeed ?? false,
      auth_user_id: person.authUserId ?? null,
      legacy_id: person.legacyId ?? null,
    };

    const { data, error } = await supabase
      .from('sales_persons')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return rowToPerson(data);
  },

  async update(id: string, updates: Partial<SalesPerson>): Promise<SalesPerson> {
    const row: Record<string, unknown> = {};
    if (updates.performance !== undefined) row.performance = updates.performance;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.level !== undefined) row.level = updates.level;
    if (updates.promoteDate !== undefined) row.promote_date = updates.promoteDate;
    if (updates.leaveDate !== undefined) row.leave_date = updates.leaveDate;
    if (updates.teamId !== undefined) row.team_id = updates.teamId;
    if (updates.parentId !== undefined) row.parent_id = updates.parentId;

    const { data, error } = await supabase
      .from('sales_persons')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return rowToPerson(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('sales_persons').delete().eq('id', id);
    if (error) throw error;
  },
};
