 
import { supabase } from '../config/supabase';

export interface BloodGlucoseRecord {
  id: string;
  user_id: string;
  value: number;
  unit: string;
  notes?: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  blood_glucose_data?: any;
}

export const bloodGlucoseService = {
  async getRecords(userId: string, startDate?: Date, endDate?: Date): Promise<BloodGlucoseRecord[]> {
    let query = supabase
      .from('health_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_type', 'blood_glucose');

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
      unit: r.unit || 'mmol/L',
      notes: r.notes,
      recorded_at: r.recorded_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      blood_glucose_data: r.blood_glucose_data,
    }));
  },

  async addRecord(userId: string, value: number, date: Date, notes?: string, extraData?: any): Promise<BloodGlucoseRecord> {
    const { data, error } = await supabase
      .from('health_records')
      .insert({
        user_id: userId,
        record_type: 'blood_glucose',
        value,
        unit: 'mmol/L',
        notes: notes || '手动记录',
        recorded_at: date.toISOString(),
        blood_glucose_data: extraData,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      value: data.value,
      unit: data.unit || 'mmol/L',
      notes: data.notes,
      recorded_at: data.recorded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      blood_glucose_data: data.blood_glucose_data,
    };
  },

  async updateRecord(
    id: string,
    value: number,
    date: Date,
    notes?: string,
    extraData?: any
  ): Promise<BloodGlucoseRecord> {
    const patch: Record<string, unknown> = {
      value,
      recorded_at: date.toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (notes !== undefined) patch.notes = notes;
    if (extraData !== undefined) patch.blood_glucose_data = extraData;

    const { data, error } = await supabase
      .from('health_records')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      value: data.value,
      unit: data.unit || 'mmol/L',
      notes: data.notes,
      recorded_at: data.recorded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      blood_glucose_data: data.blood_glucose_data,
    };
  },

  async deleteRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('health_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /** 获取最新血糖值 */
  async getLatestValue(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('health_records')
        .select('value')
        .eq('user_id', userId)
        .eq('record_type', 'blood_glucose')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data?.value ?? null;
    } catch (err) {
      console.error('[bloodGlucoseService] getLatestValue error:', err);
      return null;
    }
  },
};




