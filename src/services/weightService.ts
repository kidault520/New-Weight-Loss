import { supabase } from '../config/supabase';

export interface WeightRecord {
  id: string;
  user_id: string;
  value: number;
  unit: string;
  notes?: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export const weightService = {
  async getRecords(userId: string, startDate?: Date, endDate?: Date): Promise<WeightRecord[]> {
    let query = supabase
      .from('health_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_type', 'weight');

    // 在数据库层面过滤日期范围，而不是在客户端
    if (startDate) {
      query = query.gte('recorded_at', startDate.toISOString());
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('recorded_at', endDateTime.toISOString());
    }

    query = query.order('recorded_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      user_id: r.user_id,
      value: r.value,
      unit: r.unit || 'kg',
      notes: r.notes,
      recorded_at: r.recorded_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  },

  async addRecord(userId: string, weight: number, date: Date, notes?: string): Promise<WeightRecord> {
    const { data, error } = await supabase
      .from('health_records')
      .insert({
        user_id: userId,
        record_type: 'weight',
        value: weight,
        unit: 'kg',
        notes: notes || '手动记录',
        recorded_at: date.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      value: data.value,
      unit: data.unit || 'kg',
      notes: data.notes,
      recorded_at: data.recorded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  },

  async updateRecord(id: string, weight: number, date: Date, notes?: string): Promise<WeightRecord> {
    const { data, error } = await supabase
      .from('health_records')
      .update({
        value: weight,
        recorded_at: date.toISOString(),
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      value: data.value,
      unit: data.unit || 'kg',
      notes: data.notes,
      recorded_at: data.recorded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  },

  async deleteRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('health_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get latest weight record for user
   * 直接使用 Supabase 查询，符合 3 层架构规范
   */
  async getLatestWeight(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('health_records')
        .select('value')
        .eq('user_id', userId)
        .eq('record_type', 'weight')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return data?.value || null;
    } catch (error) {
      console.error('[WeightService] Error in getLatestWeight:', error);
      return null;
    }
  },
};

