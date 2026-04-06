const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { toBeijingDateString, parseBeijingDate, getBeijingWeekRange } = require('../utils/timezone');
const logger = require('../utils/logger');
const { syncMealScheduleActivation } = require('../services/mealScheduleActivationService');
const router = express.Router();

const getAuthUserFromRequest = async (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return { user: null, error: new Error('Missing bearer token') };
  }

  const { data, error } = await supabase.auth.getUser(token);
  return { user: data?.user || null, error };
};

const toDateString = (date) => {
  return toBeijingDateString(date);
};

const parseDateOnly = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.includes('T') ? raw.split('T')[0] : raw;
  const date = parseBeijingDate(normalized);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

/** 将任意时间戳转为北京日历日的 00:00+08，用于疗程「第几天」与今天对齐 */
function toBeijingMidnightFromInstant(raw) {
  if (raw == null) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const ymd = toBeijingDateString(d);
  return parseBeijingDate(ymd);
}

/** 服务中订单优先：processing > confirmed > pending > 其它，同档按支付时间倒序 */
function supplementOrderStatusRank(status) {
  if (status === 'processing') return 0;
  if (status === 'confirmed') return 1;
  if (status === 'pending') return 2;
  return 3;
}

/**
 * 在已支付、未终态订单中选出用于补剂阶段展示的订单；跳过 is_active=false 的补剂疗程。
 */
async function pickSupplementFulfillmentOrder(orders, productAccessor) {
  const candidates = (orders || []).filter((o) => productAccessor(o)?.supplement_plan_id);
  if (candidates.length === 0) {
    return { order: null, orderProduct: null };
  }
  const planIds = [...new Set(candidates.map((o) => productAccessor(o).supplement_plan_id))];
  const { data: plans, error: pErr } = await supabaseAdmin
    .from('supplement_plans')
    .select('id, is_active')
    .in('id', planIds);
  if (pErr) throw pErr;
  const planUsable = new Map((plans || []).map((p) => [p.id, p.is_active !== false]));

  candidates.sort((a, b) => {
    const ra = supplementOrderStatusRank(a.order_status);
    const rb = supplementOrderStatusRank(b.order_status);
    if (ra !== rb) return ra - rb;
    const ta = new Date(a.payment_time || a.created_at).getTime();
    const tb = new Date(b.payment_time || b.created_at).getTime();
    return tb - ta;
  });

  for (const o of candidates) {
    const p = productAccessor(o);
    const pid = p?.supplement_plan_id;
    if (pid && planUsable.get(pid)) {
      return { order: o, orderProduct: p };
    }
  }
  return { order: null, orderProduct: null };
}

/** 与 pickSupplementFulfillmentOrder 排序窗口一致，避免候选在 limit 外漏选 */
const SUPPLEMENT_ORDER_QUERY_LIMIT = 100;

/**
 * 获取用户的配送计划数据
 * GET /api/delivery-schedules
 */
router.get('/', async (req, res) => {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(req);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select(`
        *,
        delivery_addresses(
          id,
          label,
          address,
          door_number
        )
      `)
      .eq('user_id', user.id)
      .eq('delivery_type', 'meal')
      .not('meal_type', 'is', null)
      .order('delivery_date', { ascending: true })
      .order('meal_type', { ascending: true });

    if (error) throw error;

    res.json({ schedules: data || [] });
  } catch (error) {
    logger.error('Error fetching delivery schedules:', error);
    res.status(500).json({ error: 'Failed to fetch delivery schedules', details: error.message });
  }
});

/**
 * 获取当前启用排班（本周/下周）餐食明细
 * GET /api/delivery-schedules/active-meal-schedule?week=this_week|next_week&date=YYYY-MM-DD
 * 优先选择日期范围包含请求日期的排期，确保用户端与运营端展示一致
 */
router.get('/active-meal-schedule', async (req, res) => {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(req);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    await syncMealScheduleActivation({ trigger: 'user_active_schedule_api' });

    const week = req.query.week === 'next_week' ? 'next_week' : 'this_week';
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const anchorDate = dateParam ? new Date(`${dateParam}T00:00:00+08:00`) : null;
    const { start, end } = getBeijingWeekRange(week, anchorDate);
    const startDate = toDateString(start);
    const endDate = toDateString(end);
    const anchorDateStr = anchorDate ? toDateString(anchorDate) : null;

    let schedule = null;
    let sErr = null;
    // 1. 先获取所有启用的排期，按 enabled_at 倒序
    const { data: enabledSchedules, error: listErr } = await supabaseAdmin
      .from('meal_schedules')
      .select('id, schedule_code, schedule_name, start_time, end_time, is_enabled, enabled_at, created_at')
      .eq('is_enabled', true)
      .order('enabled_at', { ascending: false });
    if (listErr && String(listErr.message || '').includes('is_enabled')) {
      const fallback = await supabaseAdmin
        .from('meal_schedules')
        .select('id, schedule_name, start_time, end_time, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (fallback.data?.length) {
        schedule = { ...fallback.data[0], is_enabled: false, enabled_at: null, schedule_code: null };
      }
    } else if (listErr) {
      throw listErr;
    } else if (enabledSchedules && enabledSchedules.length > 0) {
      // 2. 若有请求日期，优先选择日期范围包含该日期的排期（与运营端一致）
      if (anchorDateStr && enabledSchedules.some((s) => s.start_time && s.end_time)) {
        const containing = enabledSchedules.find((s) => {
          if (!s.start_time || !s.end_time) return false;
          const sStart = toDateString(new Date(s.start_time));
          const sEnd = toDateString(new Date(s.end_time));
          return anchorDateStr >= sStart && anchorDateStr <= sEnd;
        });
        schedule = containing || enabledSchedules[0];
      } else {
        schedule = enabledSchedules[0];
      }
    }
    if (!schedule) {
      return res.json({
        schedule: null,
        week,
        range: { start_date: startDate, end_date: endDate },
        entries: []
      });
    }

    const { data: entries, error: eErr } = await supabaseAdmin
      .from('meal_schedule_entries')
      .select('id, date, package_id, package_type')
      .eq('schedule_id', schedule.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('package_type', { ascending: true });
    if (eErr) throw eErr;

    const packageIds = [...new Set((entries || []).map((e) => e.package_id).filter(Boolean))];
    let packageMap = {};
    let packageItemsMap = {};

    if (packageIds.length > 0) {
      const { data: packages, error: pErr } = await supabaseAdmin
        .from('meal_packages')
        .select('id, package_code, name, package_type, cover_image_url, total_calories_kcal, total_carbohydrate_g, total_protein_g, total_fat_g, total_fiber_g')
        .in('id', packageIds);
      if (pErr) throw pErr;
      (packages || []).forEach((p) => { packageMap[p.id] = p; });

      const { data: packageItems, error: piErr } = await supabaseAdmin
        .from('package_items')
        .select(`
          package_id,
          quantity,
          sort_order,
          dishes (
            id,
            dish_code,
            name,
            dish_type,
            carbohydrate_g,
            protein_g,
            fat_g,
            fiber_g,
            calories_kcal
          )
        `)
        .in('package_id', packageIds)
        .order('sort_order', { ascending: true });
      if (piErr) throw piErr;

      (packageItems || []).forEach((item) => {
        if (!packageItemsMap[item.package_id]) packageItemsMap[item.package_id] = [];
        packageItemsMap[item.package_id].push({
          quantity: item.quantity,
          sort_order: item.sort_order,
          dish: item.dishes || null
        });
      });
    }

    const formatted = (entries || []).map((e) => ({
      id: e.id,
      date: e.date,
      package_type: e.package_type,
      package: packageMap[e.package_id] || null,
      dishes: packageItemsMap[e.package_id] || []
    }));

    const scheduleCode = schedule.schedule_code || `MS-${new Date(schedule.created_at || schedule.enabled_at || Date.now()).getFullYear()}-${String(schedule.id || '').slice(0, 8).toUpperCase()}`;

    logger.info('[deliverySchedules] active-meal-schedule resolved', {
      user_id: user.id,
      week,
      date_param: dateParam,
      selected_schedule_id: schedule.id,
      selected_schedule_name: schedule.schedule_name,
      range_start: startDate,
      range_end: endDate,
      entries_count: formatted.length,
      selected_date_entries: formatted.filter((x) => String(x.date || '').split('T')[0] === (anchorDateStr || '')).length,
    });

    res.json({
      schedule: {
        ...schedule,
        schedule_code: scheduleCode
      },
      week,
      range: { start_date: startDate, end_date: endDate },
      entries: formatted
    });
  } catch (error) {
    logger.error('Error fetching active meal schedule:', error);
    res.status(500).json({ error: 'Failed to fetch active meal schedule', details: error.message });
  }
});

/**
 * 获取用户当前补剂阶段（基于用户起始日 + 各阶段持续天数自动推进）
 * GET /api/delivery-schedules/active-supplement-stage
 */
router.get('/active-supplement-stage', async (req, res) => {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(req);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: orders, error: oErr } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        created_at,
        payment_time,
        start_time,
        order_status,
        products (
          id,
          product_name,
          duration_days,
          supplement_plan_id
        )
      `)
      .eq('user_id', user.id)
      .eq('payment_status', 'paid')
      .neq('order_status', 'cancelled')
      .neq('order_status', 'completed')
      .order('payment_time', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(SUPPLEMENT_ORDER_QUERY_LIMIT);
    if (oErr) throw oErr;
    const product = (o) => o?.products || o?.product || null;
    const { order, orderProduct } = await pickSupplementFulfillmentOrder(orders, product);
    if (!order || !orderProduct?.supplement_plan_id) {
      return res.json({ has_plan: false, message: '暂无补剂方案' });
    }

    const startDateFromQuery = parseDateOnly(req.query.start_date);
    const startDate =
      startDateFromQuery ||
      toBeijingMidnightFromInstant(order.start_time || order.payment_time || order.created_at);
    if (!startDate || Number.isNaN(startDate.getTime())) {
      return res.json({ has_plan: false, message: '无法解析疗程开始日期' });
    }
    const todayBeijing = parseBeijingDate(toBeijingDateString(new Date()));
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentDay = Math.max(1, Math.floor((todayBeijing.getTime() - startDate.getTime()) / msPerDay) + 1);

    const { data: schedule, error: sErr } = await supabaseAdmin
      .from('supplement_schedules')
      .select('id, schedule_name, total_days, start_time, end_time, course_id, created_at')
      .eq('course_id', orderProduct.supplement_plan_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!schedule) {
      return res.json({ has_plan: false, message: '未找到补剂排班' });
    }

    const { data: stages, error: stErr } = await supabaseAdmin
      .from('supplement_schedule_stages')
      .select('id, stage_name, duration_days, sort_order, per_day_qty, supplement_id')
      .eq('schedule_id', schedule.id)
      .order('sort_order', { ascending: true });
    if (stErr) throw stErr;

    const stageRows = stages || [];
    const stageIds = stageRows.map((s) => s.id).filter(Boolean);
    const fallbackSupplementIds = stageRows.map((s) => s.supplement_id).filter(Boolean);

    let stageItemsMap = new Map();
    if (stageIds.length > 0) {
      const { data: stageItems, error: itemErr } = await supabaseAdmin
        .from('supplement_schedule_stage_items')
        .select('stage_id, supplement_id, per_day_qty, sort_order, supplements:supplement_products(id, name)')
        .in('stage_id', stageIds)
        .order('sort_order', { ascending: true });

      if (itemErr && !String(itemErr.message || '').includes('supplement_schedule_stage_items')) {
        throw itemErr;
      }

      (stageItems || []).forEach((item) => {
        if (!stageItemsMap.has(item.stage_id)) stageItemsMap.set(item.stage_id, []);
        stageItemsMap.get(item.stage_id).push({
          supplement_id: item.supplement_id,
          per_day_qty: item.per_day_qty ?? 1,
          supplement: item.supplements || item.supplement_products || null,
        });
      });
    }

    const fallbackSupplementMap = new Map();
    if (fallbackSupplementIds.length > 0) {
      const { data: fallbackSupplements, error: fbErr } = await supabaseAdmin
        .from('supplement_products')
        .select('id, name')
        .in('id', Array.from(new Set(fallbackSupplementIds)));
      if (fbErr) throw fbErr;
      (fallbackSupplements || []).forEach((supp) => {
        fallbackSupplementMap.set(supp.id, supp);
      });
    }

    let cursorStart = 1;
    let currentStage = null;
    const timeline = stageRows.map((s, idx) => {
      const stageSupplements = stageItemsMap.get(s.id) || (
        s.supplement_id
          ? [{
              supplement_id: s.supplement_id,
              per_day_qty: s.per_day_qty ?? 1,
              supplement: fallbackSupplementMap.get(s.supplement_id) || null,
            }]
          : []
      );
      const stageStart = cursorStart;
      const stageEnd = cursorStart + (s.duration_days || 0) - 1;
      const isCurrent = currentDay >= stageStart && currentDay <= stageEnd;
      if (isCurrent) {
        currentStage = {
          index: idx + 1,
          stage_id: s.id,
          stage_name: s.stage_name,
          day_in_stage: currentDay - stageStart + 1,
          stage_duration_days: s.duration_days,
          start_day: stageStart,
          end_day: stageEnd,
          per_day_qty: stageSupplements[0]?.per_day_qty ?? s.per_day_qty ?? 1,
          supplement: stageSupplements[0]?.supplement || null,
          supplements: stageSupplements,
        };
      }
      cursorStart = stageEnd + 1;
      return {
        index: idx + 1,
        stage_id: s.id,
        stage_name: s.stage_name,
        duration_days: s.duration_days,
        start_day: stageStart,
        end_day: stageEnd,
        per_day_qty: stageSupplements[0]?.per_day_qty ?? s.per_day_qty ?? 1,
        supplement: stageSupplements[0]?.supplement || null,
        supplements: stageSupplements,
        is_current: isCurrent
      };
    });

    const totalDays = schedule.total_days || timeline.reduce((sum, x) => sum + (x.duration_days || 0), 0);
    if (!currentStage && timeline.length > 0) {
      if (currentDay > totalDays) {
        const last = timeline[timeline.length - 1];
        currentStage = {
          index: last.index,
          stage_id: last.stage_id,
          stage_name: last.stage_name,
          day_in_stage: last.duration_days || 1,
          stage_duration_days: last.duration_days || 1,
          start_day: last.start_day,
          end_day: last.end_day,
          per_day_qty: last.per_day_qty,
          supplement: last.supplement || null,
          supplements: last.supplements || [],
        };
      } else {
        const first = timeline[0];
        currentStage = {
          index: first.index,
          stage_id: first.stage_id,
          stage_name: first.stage_name,
          day_in_stage: 1,
          stage_duration_days: first.duration_days || 1,
          start_day: first.start_day,
          end_day: first.end_day,
          per_day_qty: first.per_day_qty,
          supplement: first.supplement || null,
          supplements: first.supplements || [],
        };
      }
    }
    const status = currentDay > totalDays ? 'completed' : (currentStage ? 'in_progress' : 'not_started');

    logger.info('[deliverySchedules] active-supplement-stage resolved', {
      user_id: user.id,
      order_id: order.id,
      start_date_source: startDateFromQuery ? 'query.start_date' : 'order_time',
      start_date: toBeijingDateString(startDate),
      current_day: currentDay,
      total_days: totalDays,
      current_stage_index: currentStage?.index || null,
      current_stage_name: currentStage?.stage_name || null,
      stages_count: timeline.length,
    });

    res.json({
      has_plan: true,
      status,
      start_date: toBeijingDateString(startDate),
      current_day: currentDay,
      total_days: totalDays,
      order: {
        id: order.id,
        product_name: orderProduct?.product_name || '',
        supplement_plan_id: orderProduct?.supplement_plan_id
      },
      schedule: {
        id: schedule.id,
        name: schedule.schedule_name
      },
      current_stage: currentStage,
      stages: timeline
    });
  } catch (error) {
    logger.error('Error fetching active supplement stage:', error);
    res.status(500).json({ error: 'Failed to fetch active supplement stage', details: error.message });
  }
});

module.exports = router;



