import { supabase } from '../config/supabase';

export interface WaterRecord {
  id: string;
  user_id: string;
  value: number;
  unit: string;
  notes?: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export const waterService = {
  async getRecords(userId: string, startDate?: Date, endDate?: Date): Promise<WaterRecord[]> {
    let query = supabase
      .from('health_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_type', 'water');

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
      unit: r.unit || 'ml',
      notes: r.notes,
      recorded_at: r.recorded_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  },

  async addRecord(userId: string, amount: number, date: Date, notes?: string): Promise<WaterRecord> {
    const { data, error } = await supabase
      .from('health_records')
      .insert({
        user_id: userId,
        record_type: 'water',
        value: amount,
        unit: 'ml',
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
      unit: data.unit || 'ml',
      notes: data.notes,
      recorded_at: data.recorded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  },

  async updateRecord(id: string, amount: number, date: Date, notes?: string): Promise<WaterRecord> {
    const { data, error } = await supabase
      .from('health_records')
      .update({
        value: amount,
        recorded_at: date.toISOString(),
        notes: notes ?? '手动记录',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('record_type', 'water')
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      value: data.value,
      unit: data.unit || 'ml',
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
      .eq('id', id)
      .eq('record_type', 'water');

    if (error) throw error;
  },
};

