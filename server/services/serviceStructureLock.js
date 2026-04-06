/**
 * 商品「服务结构」锁定：关联商品存在进行中已支付订单时，疗程/排期等模板不可改。
 * 与 products 表触发器、admin/products 的 API 语义保持一致。
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/** 全站统一提示（管理端 + API details） */
const SERVICE_STRUCTURE_IN_USE_ZH =
  '已有进行中的已支付订单正在使用该服务配置，为保证交付一致，不可修改或删除。';

async function hasActivePaidOrdersForProductIds(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) return false;
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id')
    .in('product_id', productIds)
    .eq('payment_status', 'paid')
    .neq('order_status', 'cancelled')
    .neq('order_status', 'completed')
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function hasActivePaidOrdersForProduct(productId) {
  if (!productId) return false;
  return hasActivePaidOrdersForProductIds([productId]);
}

/**
 * 餐食疗程：任意商品引用该 meal_plan 且存在进行中已支付订单 → 锁定
 * @returns {{ inUse: boolean, message?: string }}
 */
async function mealPlanInActiveService(mealPlanId) {
  if (!mealPlanId) return { inUse: false };
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('meal_plan_id', mealPlanId);
  if (error) throw error;
  if (!products?.length) return { inUse: false };
  const active = await hasActivePaidOrdersForProductIds(products.map((p) => p.id));
  return active ? { inUse: true, message: SERVICE_STRUCTURE_IN_USE_ZH } : { inUse: false };
}

/**
 * 批量：哪些 supplement_plan_id 因「已支付且未终态」订单而处于服务中（单次 RPC，避免拉全表 orders）
 * 迁移：supplement_plan_ids_in_active_service；失败时回退为逐计划双查询。
 */
async function getSupplementPlanIdsInActiveService(planIds) {
  const unique = [...new Set((planIds || []).filter(Boolean))];
  if (unique.length === 0) return new Set();

  const { data, error } = await supabaseAdmin.rpc('supplement_plan_ids_in_active_service', {
    plan_ids: unique,
  });

  if (!error && data != null && Array.isArray(data)) {
    return new Set(data.map((r) => r.supplement_plan_id).filter(Boolean));
  }

  logger.warn('supplement_plan_ids_in_active_service RPC unavailable, using legacy lock check:', error?.message || error);

  const locked = new Set();
  for (const planId of unique) {
    const { data: products, error: pErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('supplement_plan_id', planId);
    if (pErr) throw pErr;
    if (!products?.length) continue;
    const active = await hasActivePaidOrdersForProductIds(products.map((p) => p.id));
    if (active) locked.add(planId);
  }
  return locked;
}

/**
 * 补剂计划（supplement_plans.id）：任意商品 supplement_plan_id 命中且存在进行中已支付订单 → 锁定
 * 补剂排期通过 course_id 指向同一 plan。
 */
async function supplementPlanInActiveService(supplementPlanId) {
  if (!supplementPlanId) return { inUse: false };
  const locked = await getSupplementPlanIdsInActiveService([supplementPlanId]);
  return locked.has(supplementPlanId)
    ? { inUse: true, message: SERVICE_STRUCTURE_IN_USE_ZH }
    : { inUse: false };
}

/**
 * 补剂排期：解析 course_id 后复用 supplementPlanInActiveService
 */
async function supplementScheduleInActiveService(scheduleId) {
  const { data: schedule, error } = await supabaseAdmin
    .from('supplement_schedules')
    .select('id, course_id')
    .eq('id', scheduleId)
    .single();
  if (error || !schedule) return { inUse: false };
  if (!schedule.course_id) return { inUse: false };
  return supplementPlanInActiveService(schedule.course_id);
}

/**
 * 列表批量打上 structure_in_service（与 meal_plan_id 关联商品是否存在进行中已支付订单）
 */
async function attachStructureInServiceToMealPlans(plans) {
  if (!Array.isArray(plans) || plans.length === 0) return plans;
  const ids = plans.map((p) => p.id).filter(Boolean);
  const { data: prows, error } = await supabaseAdmin
    .from('products')
    .select('id, meal_plan_id')
    .in('meal_plan_id', ids);
  if (error) throw error;
  const planToPids = new Map();
  (prows || []).forEach((r) => {
    if (!planToPids.has(r.meal_plan_id)) planToPids.set(r.meal_plan_id, []);
    planToPids.get(r.meal_plan_id).push(r.id);
  });
  const allPids = (prows || []).map((r) => r.id);
  let hot = new Set();
  if (allPids.length > 0) {
    const { data: orows, error: oErr } = await supabaseAdmin
      .from('orders')
      .select('product_id')
      .in('product_id', allPids)
      .eq('payment_status', 'paid')
      .neq('order_status', 'cancelled')
      .neq('order_status', 'completed');
    if (oErr) throw oErr;
    hot = new Set((orows || []).map((o) => o.product_id));
  }
  return plans.map((p) => {
    const pids = planToPids.get(p.id) || [];
    const on = pids.some((pid) => hot.has(pid));
    return { ...p, structure_in_service: on };
  });
}

/**
 * 补剂排期列表：course_id → supplement_plan → 商品 → 订单
 */
async function attachStructureInServiceToSupplementScheduleRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))];
  if (courseIds.length === 0) {
    return rows.map((r) => ({ ...r, structure_in_service: false }));
  }
  const lockedPlans = await getSupplementPlanIdsInActiveService(courseIds);
  return rows.map((r) => ({
    ...r,
    structure_in_service: r.course_id ? lockedPlans.has(r.course_id) : false,
  }));
}

module.exports = {
  SERVICE_STRUCTURE_IN_USE_ZH,
  hasActivePaidOrdersForProductIds,
  hasActivePaidOrdersForProduct,
  mealPlanInActiveService,
  supplementPlanInActiveService,
  supplementScheduleInActiveService,
  attachStructureInServiceToMealPlans,
  attachStructureInServiceToSupplementScheduleRows,
};
