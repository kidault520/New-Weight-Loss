import type { MealPlanConfiguration } from '../services/mealPlanConfigService';

/** 与 App 空状态、Edge 提示一致：配送计划未配置完成时不展示托管餐食/补剂履约内容 */
export const INTAKE_PLAN_INACTIVE_USER_MESSAGE =
  '摄入托管计划尚未开启：请先在「我的配送计划」完成配置后再查看。';

/**
 * 计划开启中：user_profiles.meal_plan_configured 为真，且 meal_plan_config 含有效起止日期（与配送计划保存口径一致）。
 * startDate / endDate 应对应配送计划确认生效后的首末日（展示「开始时间」时以 startDate 为准）。
 */
export function computeIntakePlanActive(
  mealPlanConfigured: boolean,
  mealPlanConfig: MealPlanConfiguration | null,
): boolean {
  if (!mealPlanConfigured || !mealPlanConfig) return false;
  const s =
    mealPlanConfig.startDate instanceof Date ? mealPlanConfig.startDate.getTime() : Number.NaN;
  const e = mealPlanConfig.endDate instanceof Date ? mealPlanConfig.endDate.getTime() : Number.NaN;
  return Number.isFinite(s) && Number.isFinite(e);
}
