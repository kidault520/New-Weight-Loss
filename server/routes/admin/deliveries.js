const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const {
  toBeijingDateString,
  parseBeijingDate,
  addDaysToBeijingYmd,
  getBeijingWeekRange,
} = require('../../utils/timezone');
const { VALID_DELIVERY_STATUSES, evaluateTransition } = require('../../utils/deliveryStatusTransition');
const logger = require('../../utils/logger');
const router = express.Router();

const toLocalDateString = (date) => {
  return toBeijingDateString(date);
};

const parseDateOnly = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  return parseBeijingDate(dateStr);
};

const escapeIlike = (value = '') => String(value).replace(/[%_,]/g, '\\$&');
const isSafeUuidLike = (value = '') => /^[a-f0-9-]{8,}$/i.test(String(value));

const getDeliveryFeedbackStatus = (schedule) => {
  const status = String(schedule?.status || '').toLowerCase();
  if (status === 'cancelled') return '已取消';
  if (status === 'delivered' || schedule?.delivered_at) return '已配送完成';
  if (status === 'shipped' || schedule?.rider_id || schedule?.rider_name || schedule?.rider_position_updated_at) {
    return '配送中';
  }
  if (status === 'preparing' || status === 'scheduled') return '即将配送';
  return '待配送';
};

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

/**
 * Get delivery schedules
 * GET /api/admin/deliveries?status=pending&start_date=2025-01-01&end_date=2025-12-31
 * Query params:
 *   - status: pending, scheduled, preparing, shipped, delivered, cancelled
 *   - start_date: filter by delivery date start
 *   - end_date: filter by delivery date end
 *   - time_filter: today, tomorrow, this_week, next_week, all
 *   - delivery_type: meal, supplement
 */
router.get('/', checkPermission('manage_deliveries'), async (req, res) => {
  try {
    const status = req.query.status;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const timeFilter = req.query.time_filter || 'all';
    const deliveryType = req.query.delivery_type;
    const itemName = req.query.item_name;
    const search = req.query.search;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // 统一使用 delivery_schedules 表（* 含 id、delivery_address_id、快照列等）
    let query = supabaseAdmin
      .from('delivery_schedules')
      .select('*', { count: 'exact' });

    // 默认查餐食，supplement 时过滤
    if (deliveryType !== 'supplement') {
      query = query.eq('delivery_type', 'meal').not('meal_type', 'is', null);
    } else {
      query = query.eq('delivery_type', 'supplement');
    }

    // 与 C 端 active-meal-schedule 一致：北京日历日 / 北京自然周（周一至周日）
    const todayStr = toBeijingDateString(new Date());
    const tomorrowStr = addDaysToBeijingYmd(todayStr, 1);
    const { start: twStart, end: twEnd } = getBeijingWeekRange('this_week');
    const { start: nwStart, end: nwEnd } = getBeijingWeekRange('next_week');
    const thisWeekStartStr = toBeijingDateString(twStart);
    const thisWeekEndStr = toBeijingDateString(twEnd);
    const nextWeekStartStr = toBeijingDateString(nwStart);
    const nextWeekEndStr = toBeijingDateString(nwEnd);

    switch (timeFilter) {
      case 'today':
        query = query.eq('delivery_date', todayStr);
        break;
      case 'tomorrow':
        query = query.eq('delivery_date', tomorrowStr);
        break;
      case 'this_week':
        query = query
          .gte('delivery_date', thisWeekStartStr)
          .lte('delivery_date', thisWeekEndStr);
        break;
      case 'next_week':
        query = query
          .gte('delivery_date', nextWeekStartStr)
          .lte('delivery_date', nextWeekEndStr);
        break;
      default:
        // all - no date filter
        break;
    }

    if (status) {
      query = query.eq('status', status);
    }

    // 搜索前置到 SQL 层，确保分页与 total 一致（不再“先分页后内存过滤”）
    // 快照字段为空时，回退用 user_profiles 命中 user_id 再并入筛选
    if (search && String(search).trim()) {
      const keyword = `%${escapeIlike(String(search).trim())}%`;
      const orConditions = [
        `item_name.ilike.${keyword}`,
        `delivery_user_nickname.ilike.${keyword}`,
        `delivery_user_phone.ilike.${keyword}`
      ];

      const { data: profileMatches, error: profileErr } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .or([
          `nickname.ilike.${keyword}`,
          `name.ilike.${keyword}`,
          `phone.ilike.${keyword}`
        ].join(','))
        .limit(100);

      if (profileErr) {
        logger.warn('[Deliveries] user_profiles search fallback failed:', profileErr.message || profileErr);
      } else {
        const matchedUserIds = [...new Set((profileMatches || []).map((p) => p.user_id).filter(isSafeUuidLike))];
        if (matchedUserIds.length > 0) {
          orConditions.push(`user_id.in.(${matchedUserIds.join(',')})`);
        }
      }

      query = query.or(orConditions.join(','));
    }

    // 配送项筛选（meal_delivery_schedules.meal_type: breakfast/lunch/dinner）
    if (itemName) {
      const mealTypeMap = { '早餐': 'breakfast', '午餐': 'lunch', '晚餐': 'dinner', 'breakfast': 'breakfast', 'lunch': 'lunch', 'dinner': 'dinner' };
      const mealType = mealTypeMap[itemName] || (itemName.length <= 10 ? itemName : null);
      if (mealType) query = query.eq('meal_type', mealType);
      else query = query.ilike('meal_type', `%${itemName}%`);
    }

    if (startDate) {
      query = query.gte('delivery_date', startDate);
    }

    if (endDate) {
      query = query.lte('delivery_date', endDate);
    }

    query = query.order('delivery_date', { ascending: true })
                 .order('meal_type', { ascending: true })
                 .range(offset, offset + limit - 1);

    let { data, error, count } = await query;

    logger.info(`[Deliveries] Query delivery_schedules: error=${error?.message || 'none'}, count=${count || 0}, dataLength=${data?.length || 0}, timeFilter=${timeFilter}`);

    if (error) {
      throw error;
    }

    // 转换 delivery_schedules 数据格式为统一的 delivery 格式
    let formattedDeliveries = [];
    if (data) {
      // 补充 user_profiles：通过 user_id 批量查询
      const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
      let userProfilesMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id, nickname, name, phone')
          .in('user_id', userIds);
        (profiles || []).forEach(p => { userProfilesMap[p.user_id] = p; });
        // 兜底：user_profiles 无记录或 nickname/phone 为空时，从 auth 拉取 email
        const needAuthFallback = userIds.filter(uid => {
          const p = userProfilesMap[uid];
          return !p || (!String(p.nickname || '').trim() && !String(p.name || '').trim() && !String(p.phone || '').trim());
        });
        if (needAuthFallback.length > 0) {
          await Promise.all(needAuthFallback.map(async (uid) => {
            try {
              const { data: authData, error } = await supabaseAdmin.auth.admin.getUserById(uid);
              const u = authData?.user;
              const email = u?.email || '';
              const phone = u?.phone || u?.raw_user_meta_data?.phone || '';
              const existing = userProfilesMap[uid];
              const displayName = [existing?.nickname, existing?.name].filter(Boolean)[0]
                || (email ? (email.includes('@') ? email.split('@')[0] : email) : '')
                || (phone ? `用户${phone.slice(-4)}` : '用户');
              userProfilesMap[uid] = {
                user_id: uid,
                nickname: displayName || '用户',
                phone: existing?.phone || phone || ''
              };
              if (error) logger.warn(`[Deliveries] auth.getUserById ${uid}: ${error.message}`);
            } catch (err) {
              logger.warn(`[Deliveries] auth fallback for ${uid}:`, err?.message || err);
              if (!userProfilesMap[uid]) userProfilesMap[uid] = { user_id: uid, nickname: '用户', phone: '' };
            }
          }));
        }
      }

      // 补充 orders：通过 order_id 批量查询
      const orderIds = [...new Set(data.map(d => d.order_id).filter(Boolean))];
      let ordersMap = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabaseAdmin
          .from('orders')
          .select('id, order_number, order_status')
          .in('id', orderIds);
        (orders || []).forEach(o => { ordersMap[o.id] = o; });
      }

      // 补充 delivery_addresses：通过 delivery_address_id 批量查询（快照为空时兜底）
      const addrIds = [...new Set(data.map(d => d.delivery_address_id).filter(Boolean))];
      let addrMap = {};
      if (addrIds.length > 0) {
        const { data: addrs } = await supabaseAdmin
          .from('delivery_addresses')
          .select('id, label, address, door_number, contact_name, phone')
          .in('id', addrIds)
          .eq('is_deleted', false);
        (addrs || []).forEach(a => { addrMap[a.id] = a; });
      }

      // 补充每条配送记录最近一次回调时间（用于“状态来源时间/最后回调时间”展示）
      const scheduleIds = [...new Set(data.map(d => d.id).filter(Boolean))];
      let lastCallbackAtMap = {};
      if (scheduleIds.length > 0) {
        const { data: callbackEvents, error: callbackErr } = await supabaseAdmin
          .from('delivery_callback_events')
          .select('schedule_id, created_at')
          .in('schedule_id', scheduleIds)
          .order('created_at', { ascending: false });

        if (callbackErr) {
          logger.warn('[Deliveries] query delivery_callback_events failed:', callbackErr.message || callbackErr);
        } else {
          (callbackEvents || []).forEach((event) => {
            if (!event.schedule_id) return;
            if (!lastCallbackAtMap[event.schedule_id]) {
              lastCallbackAtMap[event.schedule_id] = event.created_at;
            }
          });
        }
      }

      formattedDeliveries = data.map(schedule => {
        const mealTypeName = schedule.meal_type === 'lunch' ? '午餐' :
                            schedule.meal_type === 'dinner' ? '晚餐' : '早餐';
        const deliveryTime = schedule.delivery_time_start && schedule.delivery_time_end
          ? `${schedule.delivery_time_start}-${schedule.delivery_time_end}`
          : schedule.delivery_time || (schedule.meal_type === 'lunch' ? '11:30-12:30' :
            schedule.meal_type === 'dinner' ? '17:30-18:30' : '08:00-09:00');
        const addr = schedule.delivery_address_id ? addrMap[schedule.delivery_address_id] : null;
        const up = userProfilesMap[schedule.user_id];
        // 地址展示优先使用当前 delivery_address_id 关联地址，避免历史快照滞后
        const addrLine = ((addr ? `${addr.address || ''} ${addr.door_number || ''}`.trim() : '') || schedule.delivery_address || '').trim();
        const contactName = addr?.contact_name || schedule.delivery_contact_name || '';
        const contactPhone = addr?.phone || schedule.delivery_contact_phone || '';
        const lockTime = schedule.is_locked
          ? (schedule.locked_at || schedule.updated_at || schedule.created_at || null)
          : null;
        const deliveryFeedbackStatus = getDeliveryFeedbackStatus(schedule);

        // 优先使用快照（避免 user_profiles/auth 查询失败导致为空）
        const snapshotNick = schedule.delivery_user_nickname;
        const snapshotPhone = schedule.delivery_user_phone;
        const snapshotOrderNumber = schedule.delivery_order_number;
        const userNick = snapshotNick || (up ? (up.nickname || up.name || '用户') : '用户');
        const userPhone = snapshotPhone || (up ? up.phone || '' : '');
        const orderNumber = snapshotOrderNumber || (schedule.order_id && ordersMap[schedule.order_id] ? ordersMap[schedule.order_id].order_number : null);

        return {
          id: schedule.id,
          order_id: schedule.order_id,
          user_id: schedule.user_id,
          delivery_type: schedule.delivery_type || 'meal',
          delivery_date: schedule.delivery_date,
          delivery_time: deliveryTime,
          item_name: schedule.item_name || `${mealTypeName}健康餐`,
          quantity: schedule.quantity ?? 1,
          status: schedule.status || 'pending',
          tracking_number: schedule.tracking_number,
          delivery_provider: schedule.delivery_provider || null,
          external_order_id: schedule.external_order_id || null,
          estimated_arrival_time: schedule.estimated_arrival_time || null,
          delivered_at: schedule.delivered_at,
          is_locked: schedule.is_locked || false,
          lock_time: lockTime,
          status_updated_at: schedule.updated_at || null,
          last_callback_at: lastCallbackAtMap[schedule.id] || null,
          delivery_feedback_status: deliveryFeedbackStatus,
          created_at: schedule.created_at,
          updated_at: schedule.updated_at,
          user_profiles: { nickname: userNick, phone: userPhone },
          delivery_address: addrLine || '',
          delivery_address_label: addr?.label || schedule.delivery_address_label || null,
          delivery_contact_name: contactName,
          delivery_contact_phone: contactPhone,
          orders: orderNumber ? { order_number: orderNumber, order_status: (schedule.order_id && ordersMap[schedule.order_id]) ? ordersMap[schedule.order_id].order_status : null } : null
        };
      });

      const mealTypeOrder = { 'breakfast': 1, 'lunch': 2, 'dinner': 3 };
      formattedDeliveries.sort((a, b) => {
        const dateA = parseDateOnly(a.delivery_date)?.getTime() || 0;
        const dateB = parseDateOnly(b.delivery_date)?.getTime() || 0;
        if (dateA !== dateB) return dateA - dateB;
        const mealTypeA = a.item_name?.includes('午餐') ? 'lunch' : a.item_name?.includes('晚餐') ? 'dinner' : 'breakfast';
        const mealTypeB = b.item_name?.includes('午餐') ? 'lunch' : b.item_name?.includes('晚餐') ? 'dinner' : 'breakfast';
        return (mealTypeOrder[mealTypeA] || 99) - (mealTypeOrder[mealTypeB] || 99);
      });
    }

    // Categorize deliveries
    const categorized = {
      today: [],
      tomorrow: [],
      this_week: [],
      next_week: [],
      active: [], // 已生效 (delivered)
      upcoming: [] // 即将生效 (pending, scheduled, preparing)
    };

    formattedDeliveries.forEach((delivery) => {
      const ds = String(delivery.delivery_date || '').split('T')[0];
      if (!ds) return;

      if (ds === todayStr) {
        categorized.today.push(delivery);
      } else if (ds === tomorrowStr) {
        categorized.tomorrow.push(delivery);
      } else if (ds >= thisWeekStartStr && ds <= thisWeekEndStr) {
        categorized.this_week.push(delivery);
      } else if (ds >= nextWeekStartStr && ds <= nextWeekEndStr) {
        categorized.next_week.push(delivery);
      }

      if (delivery.status === 'delivered') {
        categorized.active.push(delivery);
      } else if (['pending', 'scheduled', 'preparing'].includes(delivery.status)) {
        categorized.upcoming.push(delivery);
      }
    });

    res.json({
      deliveries: formattedDeliveries,
      categorized,
      pagination: {
        page,
        limit,
        total: count || formattedDeliveries.length,
        totalPages: Math.ceil((count || formattedDeliveries.length) / limit)
      }
    });
  } catch (error) {
    logger.error('Get delivery schedules error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Check if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Failed to get delivery schedules',
        details: errorMessage,
        code: errorCode,
        hint: 'Database table "delivery_schedules" may not exist. Please run migration: 20251201000005_create_products_and_orders_tables.sql'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get delivery schedules',
      details: errorMessage,
      code: errorCode
    });
  }
});

/**
 * Update delivery status
 * PATCH /api/admin/deliveries/:id/status
 */
router.patch('/:id/status', checkPermission('manage_deliveries'), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { status, tracking_number, delivered_at } = req.body;

    if (!VALID_DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: existingDelivery, error: existingError } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id, status')
      .eq('id', deliveryId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }
    if (!existingDelivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const transition = evaluateTransition(existingDelivery.status, status);
    if (!transition.ok) {
      return res.status(409).json({
        error: 'Invalid status transition',
        details: `Cannot transition from ${transition.from} to ${status}`,
        reason: transition.reason
      });
    }

    const updateData = { status };
    if (tracking_number !== undefined) {
      updateData.tracking_number = tracking_number;
    }
    if (delivered_at !== undefined) {
      updateData.delivered_at = delivered_at;
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data: delivery, error } = await supabaseAdmin
      .from('delivery_schedules')
      .update(updateData)
      .eq('id', deliveryId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    res.json({
      delivery,
      message: 'Delivery status updated successfully'
    });
  } catch (error) {
    logger.error('Update delivery status error:', error);
    res.status(500).json({ 
      error: 'Failed to update delivery status',
      details: error.message 
    });
  }
});

/**
 * Get delivery statistics
 * GET /api/admin/deliveries/stats?start_date=2025-01-01&end_date=2025-12-31
 */
router.get('/stats/summary', checkPermission('manage_deliveries'), async (req, res) => {
  try {
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    let query = supabaseAdmin
      .from('delivery_schedules')
      .select('status, delivery_date, delivery_type', { count: 'exact' });

    if (startDate) {
      query = query.gte('delivery_date', startDate);
    }
    if (endDate) {
      query = query.lte('delivery_date', endDate);
    }

    const { data: deliveries, error } = await query;

    if (error) {
      throw error;
    }

    const stats = {
      total: deliveries?.length || 0,
      by_status: {},
      by_type: {},
      today: 0,
      this_week: 0,
      next_week: 0
    };

    const statsTodayStr = toBeijingDateString(new Date());
    const { start: stTwS, end: stTwE } = getBeijingWeekRange('this_week');
    const { start: stNwS, end: stNwE } = getBeijingWeekRange('next_week');
    const stThisStart = toBeijingDateString(stTwS);
    const stThisEnd = toBeijingDateString(stTwE);
    const stNextStart = toBeijingDateString(stNwS);
    const stNextEnd = toBeijingDateString(stNwE);

    (deliveries || []).forEach((delivery) => {
      stats.by_status[delivery.status] = (stats.by_status[delivery.status] || 0) + 1;
      stats.by_type[delivery.delivery_type] = (stats.by_type[delivery.delivery_type] || 0) + 1;

      const ds = String(delivery.delivery_date || '').split('T')[0];
      if (!ds) return;

      if (ds === statsTodayStr) {
        stats.today++;
      } else if (ds >= stThisStart && ds <= stThisEnd) {
        stats.this_week++;
      } else if (ds >= stNextStart && ds <= stNextEnd) {
        stats.next_week++;
      }
    });

    res.json({ stats });
  } catch (error) {
    logger.error('Get delivery statistics error:', error);
    res.status(500).json({ 
      error: 'Failed to get delivery statistics',
      details: error.message 
    });
  }
});

module.exports = router;

