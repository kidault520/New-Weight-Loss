/**
 * 地区服务
 */

import { supabase } from '@/config/supabase';

export type RegionType = '大区' | '省份' | '城市' | '行政区';

export interface SalesRegion {
  id: string;
  name: string;
  type: RegionType;
  parentId?: string;
  path: string;
}

function rowToRegion(r: Record<string, unknown>): SalesRegion {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as RegionType,
    parentId: r.parent_id as string | undefined,
    path: (r.path as string) || '',
  };
}

export const salesRegionService = {
  async getAll(): Promise<SalesRegion[]> {
    const { data, error } = await supabase.from('sales_regions').select('*').order('path', { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToRegion);
  },

  async upsert(region: Partial<SalesRegion> & { name: string; type: RegionType }): Promise<SalesRegion> {
    const row: Record<string, unknown> = {
      id: region.id,
      name: region.name,
      type: region.type,
      parent_id: region.parentId ?? null,
      path: region.path ?? '',
    };
    const { data, error } = await supabase.from('sales_regions').upsert(row, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return rowToRegion(data);
  },
};
