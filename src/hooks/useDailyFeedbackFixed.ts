/**
 * 日反馈固定内容 Hook
 * 提供：已摄入X餐（按餐次）、已摄入补剂（按种类）、已记录XX数据
 */
 

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBeijingDateKey } from './useBeijingDateKey';
import { foodService } from '../services/foodService';
import { stepsService } from '../services/stepsService';
import { quickEntryCardsService } from '../services/quickEntryCardsService';
import { getUserStorageItem } from '../utils/userStorage';
import { supabase } from '../config/supabase';
import { getBeijingDayBoundsFromDateKey } from '../utils/dateUtils';
import { supplementStageService } from '../services/supplementStageService';
import { buildCurrentStageSupplementItems } from '../utils/supplementStageUtils';
import { isOrderSyncedFoodNutrition } from '../utils/mealUtils';

const SUPPLEMENTS_INGESTED_KEY = 'today-supplements-ingested';

/**
 * 与 quick-entry 对齐 stale/gc；queryKey 含北京「今日」，不用 keepPreviousData，避免跨日切屏时短暂显示昨日「今日完成」
 * 写路径仍统一 invalidateQueries
 */
const DAILY_FEEDBACK_FIXED_STALE_MS = 5 * 60 * 1000;
const DAILY_FEEDBACK_FIXED_GC_MS = 30 * 60 * 1000;

/** 固定餐次（早餐、午餐、晚餐、加餐） */
const MEAL_TYPES: { mealType: string; label: string }[] = [
  { mealType: 'breakfast', label: '早餐' },
  { mealType: 'lunch', label: '午餐' },
  { mealType: 'dinner', label: '晚餐' },
  { mealType: 'snack', label: '加餐' },
];

/** 已记录数据的按类型统计 */
export interface RecordedDataByType {
  metricType: string;
  label: string;
  count: number;
}

export interface MealByType {
  mealType: string;
  /** 展示标签：午餐、晚餐、加餐（加餐可带 timeLabel 子项） */
  label: string;
  done: boolean;
  /** 该餐次热量（kcal） */
  calories: number;
  /** 加餐按时间拆分：早上/中午/晚上，用于展开展示 */
  snackBreakdown?: Record<string, number>;
}

export interface SupplementByType {
  id: string;
  name: string;
  done: boolean;
}

export interface DailyFeedbackFixed {
  /** 已摄入餐汇总（主行显示） */
  mealsCount: number;
  mealsLabel: string;
  /** 已摄入餐按餐次（折叠内展示） */
  mealsByType: MealByType[];
  /** 已摄入补剂汇总（主行显示） */
  supplementCount: number;
  /** 已摄入补剂按种类（折叠内展示） */
  supplementsByType: SupplementByType[];
  /** 已记录数据按类型：如 [{ metricType: 'water', label: '饮水', count: 2 }] */
  recordedDataByType: RecordedDataByType[];
  /** 结构性汇总项（按来源：餐食、血糖、设备、AI记录、手动录入）— 与明细分开展示 */
  recordedDataStructural: RecordedDataSummaryItem[];
  /** 明细项（按类型：睡眠、心情、运动、围度等） */
  recordedDataDetails: RecordedDataSummaryItem[];
  /** 明细分组：设备同步 / AI记录 / 手动录入（用于结构项二级折叠） */
  recordedDataDetailsByCategory: {
    device: RecordedDataSummaryItem[];
    ai: RecordedDataSummaryItem[];
    manual: RecordedDataSummaryItem[];
  };
  /** 已记录数据总条数（主行显示）= 结构性 + 明细 */
  recordedDataTotalCount: number;
}

export interface RecordedDataSummaryItem {
  key: string;
  label: string;
  done: boolean;
  count?: number;
}

/** 数据类型展示标签（与待确认数据一致） */
const METRIC_LABELS: Record<string, string> = {
  weight: '体重',
  water: '饮水',
  exercise: '运动',
  steps: '步数',
  sleep: '睡眠',
  measurements: '围度',
  emotion: '心情',
  blood_glucose: '血糖',
  breathing: '呼吸练习',
};

/** 排除餐食和补剂，只统计其它健康数据类型 */
const RECORDED_METRIC_TYPES = ['weight', 'water', 'exercise', 'steps', 'sleep', 'measurements', 'emotion', 'blood_glucose', 'breathing'] as const;

export function useDailyFeedbackFixed(ownerName?: string) {
  const { user } = useAuth();
  const today = useBeijingDateKey();

  return useQuery<DailyFeedbackFixed>({
    queryKey: ['daily-feedback-fixed', user?.id, today, ownerName],
    queryFn: async () => {
      if (!user?.id) {
        return {
          mealsCount: 0,
          mealsLabel: '已摄入 0 餐',
          mealsByType: MEAL_TYPES.map((m) => ({ ...m, done: false, calories: 0 })),
          supplementCount: 0,
          supplementsByType: [],
          recordedDataByType: [],
          recordedDataStructural: [],
          recordedDataDetails: [],
          recordedDataDetailsByCategory: { device: [], ai: [], manual: [] },
          recordedDataTotalCount: 0,
        };
      }

      // 1. 已摄入餐按餐次（早餐、午餐、晚餐、加餐）— 查询窗口与「北京今日」一致（勿用本地 new Date(y,m,d)）
      const { start: todayStart, end: todayEnd } = getBeijingDayBoundsFromDateKey(today);
      const foodRecords = await foodService.getRecords(user.id, todayStart, todayEnd);
      // 支持中英文 mealType，避免 dinner/午餐 等未匹配导致热量丢失或错归
      const mealTypeToKey: Record<string, string> = {
        '早餐': 'breakfast', '午餐': 'lunch', '晚餐': 'dinner', '加餐': 'snack',
        breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack',
      };
      // 与营养详情一致：仅 nutrition_data.syncId（订单/定制食谱同步）可计入早/午/晚；手动与 AI 一律计入加餐
      const caloriesByMeal: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
      const snackByTimeLabel: Record<string, number> = { 早上: 0, 中午: 0, 晚上: 0 };
      const consumedFromDb: string[] = [];
      foodRecords.forEach((r) => {
        const nd = r.nutrition_data;
        const mt = nd?.mealType;
        const key = mt != null ? mealTypeToKey[String(mt)] : undefined;
        const cal = Number(nd?.calories ?? 0) || 0;
        const timeLabel = nd?.timeLabel;
        const fromOrderSync = isOrderSyncedFoodNutrition(nd);

        if (fromOrderSync && key && ['breakfast', 'lunch', 'dinner'].includes(key)) {
          const slot = key as 'breakfast' | 'lunch' | 'dinner';
          caloriesByMeal[slot] = (caloriesByMeal[slot] || 0) + cal;
          consumedFromDb.push(slot);
        } else {
          // 手动、AI、无 syncId、或 sync 但落在加餐等：全部归入加餐；按 timeLabel / 原餐次映射展示子标签
          caloriesByMeal.snack = (caloriesByMeal.snack || 0) + cal;
          consumedFromDb.push('snack');
          const tl =
            timeLabel && ['早上', '中午', '晚上'].includes(timeLabel)
              ? timeLabel
              : key === 'breakfast'
                ? '早上'
                : key === 'dinner'
                  ? '晚上'
                  : '中午';
          snackByTimeLabel[tl] += cal;
        }
      });
      // 仅以数据库记录为准，不合并 storage，避免 1餐/440kcal 等脏数据残留
      const consumedMeals = new Set(consumedFromDb);
      const mealsArr = Array.from(consumedMeals);
      const mealsCount = mealsArr.length;
      const mealsLabel =
        mealsCount === 0
          ? '已摄入 0 餐'
          : `已摄入 ${mealsCount} 餐`;
      // 加餐：总热量合计，展开时按 早上/中午/晚上 展示
      const snackTotalCal = caloriesByMeal['snack'] || 0;
      const baseMeals: MealByType[] = MEAL_TYPES.map((m) => ({
        mealType: m.mealType,
        label: m.label,
        done: consumedMeals.has(m.mealType),
        calories: m.mealType === 'snack' ? snackTotalCal : caloriesByMeal[m.mealType] || 0,
        snackBreakdown: m.mealType === 'snack' && snackTotalCal > 0 ? snackByTimeLabel : undefined,
      }));
      const mealsByType: MealByType[] = [...baseMeals];

      // 2. 已摄入补剂按种类 - 从 custom_supplements 或订单补剂占位，与 TodaySupplementsCard 一致
      const supplementsData = await getUserStorageItem<{ dateKey: string; ingestedIds: string[] }>(
        SUPPLEMENTS_INGESTED_KEY
      );
      const ingestedIds = new Set(
        supplementsData?.dateKey === today && Array.isArray(supplementsData.ingestedIds)
          ? supplementsData.ingestedIds
          : []
      );
      const { data: customSupplements = [] } = await supabase
        .from('custom_supplements')
        .select('id, supplement_name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('start_date', { ascending: false });
      let supplementItems =
        (customSupplements as { id: string; supplement_name: string }[]).map((s) => ({
          id: s.id,
          name: s.supplement_name,
        }));
      if (supplementItems.length === 0) {
        try {
          const stageResp = await supplementStageService.getActiveSupplementStage();
          const stageItems = buildCurrentStageSupplementItems(stageResp);
          supplementItems = stageItems.map((item) => ({ id: item.id, name: item.name }));
        } catch {
          supplementItems = [];
        }
      }
      const supplementsByType: SupplementByType[] = supplementItems.map((s) => ({
        id: s.id,
        name: s.name,
        done: ingestedIds.has(s.id),
      }));
      const supplementCount = supplementsByType.filter((s) => s.done).length;

      // 3. 已记录 XX 数据（与待确认数据同源，按类型+来源+确认状态统计）
      // 用户确认的AI卡片算作 AI记录，不算手动录入
      const quickEntryCards = await quickEntryCardsService.getTodayQuickEntryCards();
      const recordedMetricCards = quickEntryCards.filter((c) => RECORDED_METRIC_TYPES.includes(c.metricType as any));
      const countByType: Record<string, number> = {};
      const countByTypeAndSource: Record<string, { aiCreated: number; aiRecorded: number; manual: number }> = {};
      recordedMetricCards.forEach((c) => {
          countByType[c.metricType] = (countByType[c.metricType] || 0) + 1;
          const isManual = (c.data as any)?.dataSource === 'manual';
          if (!countByTypeAndSource[c.metricType]) countByTypeAndSource[c.metricType] = { aiCreated: 0, aiRecorded: 0, manual: 0 };
          if (isManual) {
            countByTypeAndSource[c.metricType].manual += 1;
          } else if (c.isConfirmed) {
            countByTypeAndSource[c.metricType].aiRecorded += 1; // 用户确认的AI卡片 = AI记录
          } else {
            countByTypeAndSource[c.metricType].aiCreated += 1; // 未确认 = AI创建
          }
      });
      const recordedDataByType: RecordedDataByType[] = Object.entries(countByType)
        .filter(([, count]) => count > 0)
        .map(([metricType, count]) => ({
          metricType,
          label: METRIC_LABELS[metricType] || metricType,
          count,
        }))
        .sort((a, b) => b.count - a.count);

      // 3b. 已记录数据折叠内：有数据时只展示实际数据项（含来源）；无数据时展示5条结构模板
      const stepsRecords = await stepsService.getRecords(user.id, todayStart, todayEnd);
      const aiConfirmedCount = recordedMetricCards.filter((c) => c.isConfirmed && (c.data as any)?.dataSource !== 'manual').length;
      const manualInputCount = recordedMetricCards.filter((c) => (c.data as any)?.dataSource === 'manual').length;
      const deviceCount = stepsRecords.length > 0 ? 1 : 0;
      const deviceDataCount = stepsRecords.length;
      const ownerLabel = ownerName?.trim() || '用户';
      // 「已记录数据」里餐食营养明细：与上方「已摄入 X 餐」同一口径（含加餐槽位及订单/AI/手动），避免 2 餐 vs 1 条
      const mealsNutritionRecordedCount = mealsCount;
      // 空态结构主行：订单餐次 + 非餐类已确认 AI 卡片；有数据时以明细 count 汇总为准
      const aiTotalSyncCount = mealsNutritionRecordedCount + aiConfirmedCount;

      // 结构性汇总：固定 3 条且始终展示（设备、AI记录、手动录入）
      const recordedDataStructural: RecordedDataSummaryItem[] = [
        {
          key: 'device-sync',
          label: `已同步${deviceCount}台设备${deviceDataCount}条数据（设备同步）`,
          done: deviceDataCount > 0,
          count: deviceDataCount,
        },
        {
          key: 'ai-records',
          label: `已同步AI记录${aiTotalSyncCount}条数据（AI记录）`,
          done: aiTotalSyncCount > 0,
          count: aiTotalSyncCount,
        },
        {
          key: 'user-input',
          label: `已同步${ownerLabel}录入${manualInputCount}条数据（手动录入）`,
          done: manualInputCount > 0,
          count: manualInputCount,
        },
      ];

      // 明细项：默认挂在「AI记录」二级折叠下
      // 先放餐食营养汇总（与「已摄入餐」餐次数一致），再放按类型拆分的 AI创建/AI记录/手动录入
      const aiSyncDetailItems: RecordedDataSummaryItem[] = [];
      if (mealsNutritionRecordedCount > 0) {
        aiSyncDetailItems.push({
          key: 'ai-sync-meals-nutrition',
          label: `已记录${mealsNutritionRecordedCount}餐热量及营养元素`,
          done: true,
          count: mealsNutritionRecordedCount,
        });
      }
      const aiMetricDetailItems: RecordedDataSummaryItem[] = [];
      const manualMetricDetailItems: RecordedDataSummaryItem[] = [];
      Object.entries(countByTypeAndSource).forEach(
        ([metricType, { aiCreated, aiRecorded, manual }]) => {
          const label = METRIC_LABELS[metricType] || metricType;
          if (aiCreated > 0) aiMetricDetailItems.push({ key: `created-${metricType}-ai`, label: `已创建${label} ${aiCreated}条数据（AI创建）`, done: false, count: aiCreated });
          if (aiRecorded > 0) aiMetricDetailItems.push({ key: `recorded-${metricType}-ai`, label: `已记录${label} ${aiRecorded}条数据（AI记录）`, done: true, count: aiRecorded });
          if (manual > 0)
            manualMetricDetailItems.push({
              key: `recorded-${metricType}-manual`,
              label: `已记录${ownerLabel}录入 ${label} ${manual}条数据（手动录入）`,
              done: true,
              count: manual,
            });
        }
      );
      // 设备侧不再重复展示“步数”明细，避免与结构主行重复。
      const deviceDetailItems: RecordedDataSummaryItem[] = [];
      const aiDetailItems: RecordedDataSummaryItem[] = [...aiSyncDetailItems, ...aiMetricDetailItems];
      const manualDetailItems: RecordedDataSummaryItem[] = [...manualMetricDetailItems];
      const recordedDataDetails: RecordedDataSummaryItem[] = [...deviceDetailItems, ...aiDetailItems, ...manualDetailItems];

      // 主行条数：严格等于二级明细中的 count 总和
      const recordedDataTotalCount = recordedDataDetails.reduce(
        (sum, item) => sum + (item.count || 0),
        0
      );

      return {
        mealsCount,
        mealsLabel,
        mealsByType,
        supplementCount,
        supplementsByType,
        recordedDataByType,
        recordedDataStructural,
        recordedDataDetails,
        recordedDataDetailsByCategory: {
          device: deviceDetailItems,
          ai: aiDetailItems,
          manual: manualDetailItems,
        },
        recordedDataTotalCount,
      };
    },
    enabled: !!user?.id,
    staleTime: DAILY_FEEDBACK_FIXED_STALE_MS,
    gcTime: DAILY_FEEDBACK_FIXED_GC_MS,
  });
}
