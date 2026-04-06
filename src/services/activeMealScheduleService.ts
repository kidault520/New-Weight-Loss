import { apiClient } from './api';

export interface ActiveMealScheduleDish {
  quantity?: number;
  sort_order?: number;
  dish?: {
    id?: string;
    dish_code?: string;
    name?: string;
    dish_type?: string;
    calories_kcal?: number;
  } | null;
}

export interface ActiveMealScheduleEntry {
  id: string;
  date: string;
  package_type: '早餐' | '午餐' | '晚餐' | string;
  package?: {
    id?: string;
    package_code?: string;
    name?: string;
    total_calories_kcal?: number;
  } | null;
  dishes?: ActiveMealScheduleDish[];
}

export interface ActiveMealScheduleResponse {
  schedule: {
    id: string;
    schedule_name: string;
    schedule_code?: string;
    is_enabled?: boolean;
    enabled_at?: string;
  } | null;
  week: 'this_week' | 'next_week';
  range: { start_date: string; end_date: string };
  entries: ActiveMealScheduleEntry[];
}

const ACTIVE_MEAL_SCHEDULE_CACHE_TTL_MS = 15 * 1000;
const activeMealScheduleCache = new Map<string, { ts: number; data: ActiveMealScheduleResponse }>();
const activeMealScheduleInFlight = new Map<string, Promise<ActiveMealScheduleResponse>>();

function getCacheKey(week: 'this_week' | 'next_week', date?: string) {
  return `${week}:${date || 'none'}`;
}

export const activeMealScheduleService = {
  async getActiveWeekSchedule(week: 'this_week' | 'next_week' = 'this_week', date?: string) {
    const key = getCacheKey(week, date);
    const cached = activeMealScheduleCache.get(key);
    if (cached && Date.now() - cached.ts < ACTIVE_MEAL_SCHEDULE_CACHE_TTL_MS) {
      return cached.data;
    }

    const inFlight = activeMealScheduleInFlight.get(key);
    if (inFlight) {
      return inFlight;
    }

    const dateParam = date ? `&date=${encodeURIComponent(date)}` : '';
    const request = apiClient
      .get<ActiveMealScheduleResponse>(`/delivery-schedules/active-meal-schedule?week=${week}${dateParam}`)
      .then((data) => {
        activeMealScheduleCache.set(key, { ts: Date.now(), data });
        return data;
      })
      .finally(() => {
        activeMealScheduleInFlight.delete(key);
      });

    activeMealScheduleInFlight.set(key, request);
    return request;
  },

  clearCache() {
    activeMealScheduleCache.clear();
    activeMealScheduleInFlight.clear();
  },
};

