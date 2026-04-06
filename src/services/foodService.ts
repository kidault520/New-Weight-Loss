import { supabase } from '../config/supabase';
import { isOrderSyncedFoodNutrition } from '../utils/mealUtils';

export interface FoodRecord {
  id: string;
  user_id: string;
  value: number;
  unit: string;
  notes?: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  nutrition_data?: any;
}

export const foodService = {
  async getRecords(userId: string, startDate?: Date, endDate?: Date): Promise<FoodRecord[]> {
    let query = supabase
      .from('health_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_type', 'food');

    if (startDate) {
      query = query.gte('recorded_at', startDate.toISOString());
    }
    if (endDate) {
      const endDateTime = new Date(endDate.getTime());
      // 仅当结束时间为「当天 0 点」时扩展到 23:59:59，避免破坏已带具体时刻的区间（如北京日 bounds）
      if (
        endDateTime.getHours() === 0 &&
        endDateTime.getMinutes() === 0 &&
        endDateTime.getSeconds() === 0 &&
        endDateTime.getMilliseconds() === 0
      ) {
        endDateTime.setHours(23, 59, 59, 999);
      }
      query = query.lte('recorded_at', endDateTime.toISOString());
    }

    query = query.order('recorded_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      user_id: r.user_id,
      value: r.value,
      unit: r.unit || 'g',
      notes: r.notes,
      recorded_at: r.recorded_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      nutrition_data: r.nutrition_data,
    }));
  },

  /** 获取今日已摄入的餐次（从 health_records 推导，用于全站同步） */
  async getTodayConsumedMealTypes(userId: string): Promise<Set<string>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    const records = await this.getRecords(userId, today, endOfToday);
    const mealTypeToKey: Record<string, string> = {
      早餐: 'breakfast',
      午餐: 'lunch',
      晚餐: 'dinner',
      加餐: 'snack',
      breakfast: 'breakfast',
      lunch: 'lunch',
      dinner: 'dinner',
      snack: 'snack',
    };
    const consumed = new Set<string>();
    records.forEach((r) => {
      const nd = r.nutrition_data;
      const mt = nd?.mealType;
      const key = mt != null ? mealTypeToKey[String(mt)] : undefined;
      const fromSync = isOrderSyncedFoodNutrition(nd);
      if (fromSync && key && ['breakfast', 'lunch', 'dinner'].includes(key)) {
        consumed.add(key);
      } else {
        consumed.add('snack');
      }
    });
    return consumed;
  },
};




