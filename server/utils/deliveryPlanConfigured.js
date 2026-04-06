/**
 * 管理端「配送计划已开启」判定（与 C 端 intake 闸门区分）：
 * - 档案：meal_plan_config_data 中起止日可读（兼容 snake_case / camelCase / JSON 字符串；不单独依赖 meal_plan_configured，避免历史未打标）
 * - 履约：本订单已有配送排期、或已点开启服务(start_time)、或订单处于 processing/completed
 */

/**
 * @param {unknown} raw
 * @returns {{ start: string, end: string }}
 */
function extractBoundaryDates(raw) {
  if (raw == null) return { start: '', end: '' };
  let o = raw;
  if (typeof o === 'string') {
    const t = o.trim();
    if (!t) return { start: '', end: '' };
    try {
      o = JSON.parse(t);
    } catch {
      return { start: '', end: '' };
    }
  }
  if (!o || typeof o !== 'object') return { start: '', end: '' };
  const s = o.start_date ?? o.startDate;
  const e = o.end_date ?? o.endDate;
  const norm = (v) =>
    typeof v === 'string' ? v.trim() : v != null && v !== '' ? String(v).trim() : '';
  return { start: norm(s), end: norm(e) };
}

/**
 * 严格：与早期文档一致（需 meal_plan_configured + 起止日）
 * @param {object|null|undefined} profile
 */
function isDeliveryPlanConfiguredFromProfileStrict(profile) {
  if (!profile || profile.meal_plan_configured !== true) return false;
  const { start, end } = extractBoundaryDates(profile.meal_plan_config_data);
  return start.length > 0 && end.length > 0;
}

/**
 * 管理端档案维度：起止日齐全即视为档案侧已配置（修复历史未写 meal_plan_configured）
 * @param {object|null|undefined} profile
 */
function isAdminProfilePlanSignal(profile) {
  if (!profile) return false;
  const { start, end } = extractBoundaryDates(profile.meal_plan_config_data);
  return start.length > 0 && end.length > 0;
}

/**
 * @param {object|null|undefined} order
 * @param {number} [scheduleCount]
 */
function isOrderFulfillmentPlanStarted(order, scheduleCount) {
  if (!order || typeof order !== 'object') return false;
  const st = String(order.order_status || '').toLowerCase();
  if (st === 'processing' || st === 'completed') return true;
  if (order.start_time) return true;
  if (typeof scheduleCount === 'number' && scheduleCount > 0) return true;
  return false;
}

/**
 * @param {object|null|undefined} profile
 * @param {object|null|undefined} order
 * @param {number} [scheduleCount]
 */
function getPlanConfigStateFromProfile(profile, order, scheduleCount) {
  const profileOk = isAdminProfilePlanSignal(profile);
  const fulfillmentOk = isOrderFulfillmentPlanStarted(order, scheduleCount);
  const ok = profileOk || fulfillmentOk;
  return {
    plan_configured: ok,
    plan_config_state: ok ? 'configured' : 'not_configured',
    plan_config_state_zh: ok ? '已开启计划' : '未开启计划',
  };
}

module.exports = {
  extractBoundaryDates,
  isDeliveryPlanConfiguredFromProfileStrict,
  isAdminProfilePlanSignal,
  isOrderFulfillmentPlanStarted,
  getPlanConfigStateFromProfile,
};
