import { supabase } from '../config/supabase';

export interface MeasurementRecord {
  id: string;
  user_id: string;
  value: number;
  unit: string;
  notes?: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  measurement_data?: any;
}

/** 单次录入的六维围度（均可空，但至少应有一项有值，由调用方校验） */
export interface MeasurementBody {
  chest?: number | null;
  waist?: number | null;
  upperArm?: number | null;
  hips?: number | null;
  thigh?: number | null;
  calf?: number | null;
}

function toMeasurementData(body: MeasurementBody) {
  return {
    chest: body.chest ?? null,
    waist: body.waist ?? null,
    upperArm: body.upperArm ?? null,
    hips: body.hips ?? null,
    thigh: body.thigh ?? null,
    calf: body.calf ?? null,
  };
}

function primaryMetricValue(data: ReturnType<typeof toMeasurementData>): number {
  const v =
    data.waist ??
    data.chest ??
    data.hips ??
    data.upperArm ??
    data.thigh ??
    data.calf;
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

export const measurementsService = {
  async getRecords(userId: string, startDate?: Date, endDate?: Date): Promise<MeasurementRecord[]> {
    let query = supabase
      .from('health_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_type', 'measurements');

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
      unit: r.unit || 'cm',
      notes: r.notes,
      recorded_at: r.recorded_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      measurement_data: r.measurement_data,
    }));
  },

  async addRecord(
    userId: string,
    body: MeasurementBody,
    date: Date,
    notes?: string
  ): Promise<MeasurementRecord> {
    const measurement_data = toMeasurementData(body);
    const { data, error } = await supabase
      .from('health_records')
      .insert({
        user_id: userId,
        record_type: 'measurements',
        value: primaryMetricValue(measurement_data),
        unit: 'cm',
        notes: notes || '手动记录',
        measurement_data,
        recorded_at: date.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      value: data.value,
      unit: data.unit || 'cm',
      notes: data.notes,
      recorded_at: data.recorded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      measurement_data: data.measurement_data,
    };
  },

  async updateRecord(
    id: string,
    body: MeasurementBody,
    date: Date,
    notes?: string
  ): Promise<MeasurementRecord> {
    const measurement_data = toMeasurementData(body);
    const { data, error } = await supabase
      .from('health_records')
      .update({
        value: primaryMetricValue(measurement_data),
        measurement_data,
        notes,
        recorded_at: date.toISOString(),
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
      unit: data.unit || 'cm',
      notes: data.notes,
      recorded_at: data.recorded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      measurement_data: data.measurement_data,
    };
  },

  async deleteRecord(id: string): Promise<void> {
    const { error } = await supabase.from('health_records').delete().eq('id', id);
    if (error) throw error;
  },
};

