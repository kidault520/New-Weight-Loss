/**
 * 销售员/人员服务
 */

import { supabase } from '@/config/supabase';

export type Rank = '收展员' | '组经理' | '部经理' | '区经理';
export type PersonStatus = '活跃' | '脱落' | '晋升中';
export type JoinMethod = '推荐加入' | '自主加入' | '外部引进';

export type AccountStatus = '未激活' | '激活' | '禁用';

export interface SalesPerson {
  id: string;
  code: string;
  displayId?: string;  // 独立展示ID，格式 S+8位数字，与 code 1:1
  name: string;
  level: Rank;
  originalLevel: Rank;
  performance: number;
  avatarUrl: string;
  status: PersonStatus;
  phone?: string;     // 手机号，销售默认登录账号
  isActivated?: boolean;  // 是否已激活（首次登录后为 true）
  accountStatus?: AccountStatus;  // 账号状态：未激活/激活/禁用
  birthDate?: string;
  gender?: string;
  ethnicity?: string;
  education?: string;
  idNumber?: string;
  workHistory?: string;
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
}

function rowToPerson(r: Record<string, unknown>): SalesPerson {
  return {
    id: r.id as string,
    code: r.code as string,
    displayId: r.display_id as string | undefined,
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
    phone: r.phone as string | undefined,
    isActivated: Boolean(r.is_activated),
    accountStatus: r.account_status as AccountStatus | undefined,
    birthDate: r.birth_date as string | undefined,
    gender: r.gender as string | undefined,
    ethnicity: r.ethnicity as string | undefined,
    education: r.education as string | undefined,
    idNumber: r.id_number as string | undefined,
    workHistory: r.work_history as string | undefined,
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

  async upsert(person: Partial<SalesPerson> & { code: string; name: string; level: Rank; originalLevel: Rank; joinDate: string }): Promise<SalesPerson> {
    const row: Record<string, unknown> = {
      id: person.id,
      code: person.code,
      display_id: person.displayId ?? null,
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
      legacy_id: person.legacyId ?? null,
      phone: person.phone ?? null,
      is_activated: person.accountStatus === '禁用' ? false : (person.isActivated ?? false),
      birth_date: person.birthDate ?? null,
      gender: person.gender ?? null,
      ethnicity: person.ethnicity ?? null,
      education: person.education ?? null,
      id_number: person.idNumber ?? null,
      work_history: person.workHistory ?? null,
      account_status: person.accountStatus ?? null,
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
    if (updates.phone !== undefined) row.phone = updates.phone;
    if (updates.displayId !== undefined) row.display_id = updates.displayId;
    if (updates.birthDate !== undefined) row.birth_date = updates.birthDate;
    if (updates.gender !== undefined) row.gender = updates.gender;
    if (updates.ethnicity !== undefined) row.ethnicity = updates.ethnicity;
    if (updates.education !== undefined) row.education = updates.education;
    if (updates.idNumber !== undefined) row.id_number = updates.idNumber;
    if (updates.workHistory !== undefined) row.work_history = updates.workHistory;
    if (updates.accountStatus !== undefined) row.account_status = updates.accountStatus;
    if (updates.isActivated !== undefined) row.is_activated = updates.isActivated;
    if (updates.name !== undefined) row.name = updates.name;
    const { data, error } = await supabase.from('sales_persons').update(row).eq('id', id).select().single();
    if (error) throw error;
    return rowToPerson(data);
  },
};
