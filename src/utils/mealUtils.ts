/**
 * 餐食工具函数
 */

/** 各餐次配送结束时间（小时、分钟），用于判断「完成摄入」是否可点击 */
const MEAL_DELIVERY_END: Record<string, { hour: number; minute: number }> = {
  breakfast: { hour: 7, minute: 30 },
  lunch: { hour: 12, minute: 30 },
  dinner: { hour: 18, minute: 30 },
};

/**
 * 判断某餐次的配送时间是否已结束（仅当配送结束后才允许点击「完成摄入」）
 * @param date 日期
 * @param mealType 餐次 breakfast | lunch | dinner
 * @returns 配送已结束可点击
 */
export const isMealDeliveryComplete = (date: Date, mealType: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() < today.getTime()) return false;
  if (target.getTime() > today.getTime()) return false;

  const end = MEAL_DELIVERY_END[mealType];
  if (!end) return false;

  const now = new Date();
  const endMinutes = end.hour * 60 + end.minute;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= endMinutes;
};

/** 各餐次配送开始/结束时间（用于按餐次显示状态） */
const MEAL_DELIVERY_WINDOW: Record<string, { start: { hour: number; minute: number }; end: { hour: number; minute: number } }> = {
  breakfast: { start: { hour: 6, minute: 30 }, end: { hour: 7, minute: 30 } },
  lunch: { start: { hour: 11, minute: 30 }, end: { hour: 12, minute: 30 } },
  dinner: { start: { hour: 17, minute: 30 }, end: { hour: 18, minute: 30 } },
};

/**
 * 按餐次获取配送状态（今日：制作中 / 配送中 / 已配送完成）
 * @param date 日期
 * @param mealType 餐次 breakfast | lunch | dinner
 * @returns 餐食状态字符串
 */
export const getMealStatusByMealType = (date: Date, mealType: string): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDateOnly = new Date(date);
  selectedDateOnly.setHours(0, 0, 0, 0);

  if (selectedDateOnly.getTime() < today.getTime()) return '已完成';
  if (selectedDateOnly.getTime() > today.getTime()) return '准备中';

  const window = MEAL_DELIVERY_WINDOW[mealType];
  if (!window) return '制作中';

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = window.start.hour * 60 + window.start.minute;
  const endMinutes = window.end.hour * 60 + window.end.minute;

  if (nowMinutes < startMinutes) return '制作中';
  if (nowMinutes < endMinutes) return '配送中';
  return '已配送完成';
};

/**
 * 获取餐食状态（按日期的整体状态，保留兼容）
 * @param date 日期
 * @param mealPlanDay 餐食计划天数（1-based）
 * @returns 餐食状态字符串
 */
export const getMealStatus = (date: Date, _mealPlanDay: number): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDateOnly = new Date(date);
  selectedDateOnly.setHours(0, 0, 0, 0);

  if (selectedDateOnly.getTime() < today.getTime()) return '已完成';
  if (selectedDateOnly.getTime() > today.getTime()) return '准备中';

  const currentHour = new Date().getHours();
  if (currentHour < 9) return '制作中';
  if (currentHour < 12) return '配送中';
  return '已配送完成';
};

/**
 * 获取餐食类型标签
 */
export const getMealTypeLabel = (mealType: string): string => {
  const labels: Record<string, string> = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    snack: '加餐',
  };
  return labels[mealType] || mealType;
};

/**
 * 是否为订单/定制食谱「完成摄入」同步写入的餐食（health_records.nutrition_data.syncId）。
 * 手动「+」、AI 快速录入不会带 syncId；与 NutritionDetailScreen 套餐/加餐拆分一致。
 */
export function isOrderSyncedFoodNutrition(
  nutritionData: Record<string, unknown> | null | undefined
): boolean {
  if (!nutritionData || typeof nutritionData !== 'object') return false;
  const sid = (nutritionData as { syncId?: unknown }).syncId;
  return sid != null && String(sid).length > 0;
}

/**
 * 获取餐食时间范围
 */
export const getMealTimeRange = (mealType: string): string => {
  const timeRanges: Record<string, string> = {
    breakfast: '6:30-7:30',
    lunch: '11:30-12:30',
    dinner: '17:30-18:30'
  };
  return timeRanges[mealType] || '';
};

/**
 * 检查餐食是否已锁定（基于时间）
 * @param date 配送日期
 * @param mealType 餐食类型
 * @returns 是否已锁定
 */
export const isMealAutoLocked = (date: Date, mealType: string): boolean => {
  const now = new Date();
  const deliveryDate = new Date(date);

  // 获取配送时间
  const timeRanges: Record<string, { start: number; end: number }> = {
    breakfast: { start: 6, end: 30 },
    lunch: { start: 11, end: 30 },
    dinner: { start: 17, end: 30 }
  };

  const time = timeRanges[mealType];
  if (!time) return false;

  deliveryDate.setHours(time.start, time.end, 0, 0);

  // 计算配送前1小时
  const lockTime = new Date(deliveryDate.getTime() - 60 * 60 * 1000);

  return now >= lockTime;
};

export interface ResolvedMealType {
  mealType: string;
  /** 加餐场景下的展示标签：午餐→中午，晚餐→晚上，早餐→早上 */
  timeLabel?: string;
}

/** 餐次 → 加餐展示标签（早上/中午/晚上） */
const MEAL_TO_TIME_LABEL: Record<string, string> = {
  早餐: '早上', breakfast: '早上',
  午餐: '中午', lunch: '中午',
  晚餐: '晚上', dinner: '晚上',
  加餐: '', snack: '',
};

/**
 * 为非系统餐食解析应使用的餐次
 * AI创建的餐食：统一记为加餐，timeLabel 为 早上/中午/晚上
 * @param userId 用户ID
 * @param date 记录日期
 * @param mealType 原始餐次（早餐/午餐/晚餐/加餐 或 breakfast/lunch/dinner/snack）
 * @param isAiCreated 是否AI创建，true 时统一记为加餐并带 timeLabel
 * @returns 解析后的餐次
 */
export async function resolveMealTypeForNonSystemFood(
  _userId: string | null,
  date: Date,
  mealType: string,
  isAiCreated?: boolean
): Promise<ResolvedMealType> {
  if (isAiCreated) {
    let timeLabel = MEAL_TO_TIME_LABEL[mealType];
    if (!timeLabel) {
      const hour = date.getHours();
      timeLabel = hour < 10 ? '早上' : hour < 15 ? '中午' : '晚上';
    }
    return { mealType: '加餐', timeLabel };
  }
  return { mealType };
}

/** 加餐场景下餐次展示：午餐→中午，晚餐→晚上，早餐→早上，加餐→加餐 */
export function getMealDisplayLabelForSnack(mealType: string, timeLabel?: string): string {
  if (timeLabel) return timeLabel;
  const map: Record<string, string> = {
    午餐: '中午', lunch: '中午',
    晚餐: '晚上', dinner: '晚上',
    早餐: '早上', breakfast: '早上',
    加餐: '加餐', snack: '加餐',
  };
  return map[mealType] || mealType;
}

/**
 * 计算餐食的营养总量
 */
export const calculateMealNutrition = (foods: Array<{
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}>) => {
  return {
    calories: Math.round(foods.reduce((sum, food) => sum + (food.calories || 0), 0)),
    protein: Math.round(foods.reduce((sum, food) => sum + (food.protein || 0), 0)),
    carbs: Math.round(foods.reduce((sum, food) => sum + (food.carbs || 0), 0)),
    fat: Math.round(foods.reduce((sum, food) => sum + (food.fat || 0), 0)),
    fiber: Math.round(foods.reduce((sum, food) => sum + (food.fiber || 0), 0))
  };
};














