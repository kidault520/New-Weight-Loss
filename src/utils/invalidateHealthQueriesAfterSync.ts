import type { QueryClient } from '@tanstack/react-query';
import type { QuickEntryData } from '../components/QuickEntryCard';
import { getAppQueryClient } from './queryClientHolder';
import { toLocalDateString } from './dateUtils';

/**
 * 快捷录入写入健康库后，按 record 类型失效对应列表与仪表盘缓存（L5-R10）
 */
export function invalidateHealthQueriesAfterQuickEntry(
  userId: string,
  metricType: QuickEntryData['metricType'],
  recordDate: Date
): void {
  const qc: QueryClient | null = getAppQueryClient();
  if (!qc || !userId) return;

  const listKeyByType: Partial<Record<QuickEntryData['metricType'], string>> = {
    food: 'food-records',
    water: 'water-records',
    weight: 'weight-records',
    steps: 'steps-records',
    sleep: 'sleep-records',
    blood_glucose: 'blood-glucose-records',
    measurements: 'measurements-records',
    exercise: 'exercise-records',
  };

  const listKey = listKeyByType[metricType];
  if (listKey) {
    qc.invalidateQueries({ queryKey: [listKey, userId] });
  }

  if (metricType === 'supplement') {
    qc.invalidateQueries({ queryKey: ['today-supplements', userId] });
    qc.invalidateQueries({ queryKey: ['active-supplement-stage', userId] });
  }

  const dateKey = toLocalDateString(recordDate);
  qc.invalidateQueries({ queryKey: ['dashboard-data', userId] });
  qc.invalidateQueries({ queryKey: ['dashboard-data', userId, dateKey] });
  // 日反馈「已摄入餐 / 加餐」与 health_records 同源，需与 food 写入一并刷新
  qc.invalidateQueries({ queryKey: ['daily-feedback-fixed', userId] });
}
