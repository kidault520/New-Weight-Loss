/**
 * 订单侧「合约餐次」解析（与 UI 展示餐次分流）：
 * - **orders.included_meal_types**（下单快照）优先；
 * - 否则回落 **meal_plans.included_meal_types**（经 `products.meal_plan_id` 二次查询，避免 PostgREST 无 FK 关系时嵌套失败）；
 * - 再否则 **includedMealTypesZhToEn(null)** 默认集。
 * 与 **meal_plan_config.selectedMealTypes**（用户配送槽位）、**active-meal-schedule**（排期内容）独立，勿混为同一数据源。
 */
import { supabase } from '../config/supabase';
import { executionProgramService } from './executionProgramService';
import { includedMealTypesZhToEn, type MealSlotEn } from '../utils/mealSlotMapping';

function unwrapProduct(data: { products?: unknown } | null): Record<string, unknown> | null {
  if (!data) return null;
  const p = data.products as unknown;
  if (Array.isArray(p)) return (p[0] as Record<string, unknown>) || null;
  return (p as Record<string, unknown>) || null;
}

function mealSlotsFromOrderSnapshotRow(
  row: { included_meal_types?: unknown } | null | undefined
): MealSlotEn[] | null {
  if (!row) return null;
  const zh = row.included_meal_types;
  if (!Array.isArray(zh) || zh.length === 0) return null;
  return includedMealTypesZhToEn(zh as string[]);
}

async function mealSlotsFromMealPlanId(
  mealPlanId: string | null | undefined
): Promise<MealSlotEn[] | null> {
  if (!mealPlanId || typeof mealPlanId !== 'string') return null;
  const { data, error } = await supabase
    .from('meal_plans')
    .select('included_meal_types')
    .eq('id', mealPlanId)
    .maybeSingle();
  if (error) {
    console.warn('[orderMealPlanSlots] meal_plans by id:', error.message);
    return null;
  }
  return mealSlotsFromOrderSnapshotRow(data);
}

/**
 * 根据订单 ID 读取关联商品的餐食疗程「每天包含餐次」（转英文 key）
 */
export async function fetchMealSlotsEnForOrderId(orderId: string): Promise<MealSlotEn[] | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      included_meal_types,
      products:product_id (
        duration_days,
        meal_plan_id
      )
    `
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    console.warn('[orderMealPlanSlots] fetch order meal slots:', error.message);
    return null;
  }
  const row = data as { included_meal_types?: unknown; products?: unknown } | null;
  const fromOrderSnapshot = mealSlotsFromOrderSnapshotRow(row);
  if (fromOrderSnapshot?.length) return fromOrderSnapshot;
  const prod = unwrapProduct(row);
  const fromPlan = await mealSlotsFromMealPlanId(prod?.meal_plan_id as string | undefined);
  if (fromPlan?.length) return fromPlan;
  return includedMealTypesZhToEn(null);
}

export type LatestPaidOrderProductMeta = {
  duration_days: number;
  included_meals_en: MealSlotEn[];
};

/**
 * 用户最近一笔已支付且未结束（非取消/完成）订单的商品：时长 + 餐次
 */
export async function fetchLatestPaidOrderProductMeta(
  userId: string
): Promise<LatestPaidOrderProductMeta | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      included_meal_types,
      products:product_id (
        duration_days,
        meal_plan_id
      )
    `
    )
    .eq('user_id', userId)
    .eq('payment_status', 'paid')
    .neq('order_status', 'cancelled')
    .neq('order_status', 'completed')
    .order('payment_time', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[orderMealPlanSlots] latest paid order meta:', error.message);
    return null;
  }

  const row = data as { included_meal_types?: unknown; products?: unknown } | null;
  const prod = unwrapProduct(row as { products?: unknown });
  const duration = Number((prod?.duration_days as number) || 0);
  const fromOrderSnapshot = mealSlotsFromOrderSnapshotRow(row);
  let slots: MealSlotEn[];
  if (fromOrderSnapshot?.length) {
    slots = fromOrderSnapshot;
  } else {
    const fromPlan = await mealSlotsFromMealPlanId(prod?.meal_plan_id as string | undefined);
    slots = fromPlan?.length ? fromPlan : includedMealTypesZhToEn(null);
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return { duration_days: 7, included_meals_en: slots };
  }
  return { duration_days: duration, included_meals_en: slots };
}

/**
 * 有已支付服务订单时返回合约餐次（英文 key）；无订单返回 null（调用方不做合约裁剪）。
 */
export async function fetchContractMealSlotsEnForUser(
  userId: string
): Promise<MealSlotEn[] | null> {
  const has = await executionProgramService.checkUserHasOrder(userId);
  if (!has) return null;
  const meta = await fetchLatestPaidOrderProductMeta(userId);
  const slots = meta?.included_meals_en?.length
    ? meta.included_meals_en
    : includedMealTypesZhToEn(null);
  return slots;
}
