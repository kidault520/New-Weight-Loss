import { apiClient } from './api';

export interface SupplementStageResponse {
  has_plan: boolean;
  status?: 'not_started' | 'in_progress' | 'completed';
  start_date?: string;
  current_day?: number;
  total_days?: number;
  current_stage?: {
    index: number;
    stage_id: string;
    stage_name: string;
    day_in_stage: number;
    stage_duration_days: number;
    start_day: number;
    end_day: number;
    per_day_qty?: number | null;
    supplement?: { id?: string; name?: string } | null;
    supplements?: Array<{
      supplement_id?: string;
      per_day_qty?: number | null;
      supplement?: { id?: string; name?: string } | null;
    }>;
  } | null;
  stages?: Array<{
    index: number;
    stage_id: string;
    stage_name: string;
    duration_days: number;
    start_day: number;
    end_day: number;
    is_current: boolean;
    per_day_qty?: number | null;
    supplement?: { id?: string; name?: string } | null;
    supplements?: Array<{
      supplement_id?: string;
      per_day_qty?: number | null;
      supplement?: { id?: string; name?: string } | null;
    }>;
  }>;
  message?: string;
}

const SUPPLEMENT_STAGE_CACHE_TTL_MS = 15 * 1000;
const supplementStageCache = new Map<string, { ts: number; data: SupplementStageResponse }>();
const supplementStageInFlight = new Map<string, Promise<SupplementStageResponse>>();

function getCacheKey(startDate?: string) {
  return startDate ? `start:${startDate}` : 'start:current';
}

export const supplementStageService = {
  async getActiveSupplementStage(startDate?: string) {
    const key = getCacheKey(startDate);
    const cached = supplementStageCache.get(key);
    if (cached && Date.now() - cached.ts < SUPPLEMENT_STAGE_CACHE_TTL_MS) {
      return cached.data;
    }

    const inFlight = supplementStageInFlight.get(key);
    if (inFlight) {
      return inFlight;
    }

    const query = startDate ? `?start_date=${encodeURIComponent(startDate)}` : '';
    const request = apiClient
      .get<SupplementStageResponse>(`/delivery-schedules/active-supplement-stage${query}`)
      .then((data) => {
        supplementStageCache.set(key, { ts: Date.now(), data });
        return data;
      })
      .finally(() => {
        supplementStageInFlight.delete(key);
      });

    supplementStageInFlight.set(key, request);
    return request;
  },

  clearCache() {
    supplementStageCache.clear();
    supplementStageInFlight.clear();
  },
};

