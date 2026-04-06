/**
 * 地区服务
 * 对应 B 端 organizationStorage regions
 */

import { supabase } from '../../config/supabase';

export type RegionType = '大区' | '省份' | '城市' | '行政区';

export interface SalesRegion {
  id: string;
  name: string;
  type: RegionType;
  parentId?: string;
  path: string;
  createdAt?: string;
}

function rowToRegion(r: Record<string, unknown>): SalesRegion {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as RegionType,
    parentId: r.parent_id as string | undefined,
    path: (r.path as string) || '',
    createdAt: r.created_at as string | undefined,
  };
}

export const salesRegionService = {
  async getAll(): Promise<SalesRegion[]> {
    const { data, error } = await supabase
      .from('sales_regions')
      .select('*')
      .order('path', { ascending: true });

    if (error) throw error;
    return (data || []).map(rowToRegion);
  },

  async getById(id: string): Promise<SalesRegion | null> {
    const { data, error } = await supabase
      .from('sales_regions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToRegion(data) : null;
  },

  async getByParentId(parentId: string | null): Promise<SalesRegion[]> {
    let query = supabase.from('sales_regions').select('*');
    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(rowToRegion);
  },

  async upsert(region: Partial<SalesRegion> & { name: string; type: RegionType }): Promise<SalesRegion> {
    const row: Record<string, unknown> = {
      name: region.name,
      type: region.type,
      parent_id: region.parentId ?? null,
      path: region.path ?? '',
    };

    const { data, error } = await supabase
      .from('sales_regions')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return rowToRegion(data);
  },
};
