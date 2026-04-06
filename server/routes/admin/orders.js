const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const { evaluatePaymentTransition } = require('../../utils/orderPaymentTransition');
const { ensureOrderSettlementSnapshot } = require('../../services/orderSettlementSnapshot');
const { createPaymentOrder } = require('../../services/paymentProviderService');
const { createDeliveryOrder } = require('../../services/deliveryProviderService');
const { getRuntimePolicy } = require('../../config/runtimeMode');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getPlanConfigStateFromProfile } = require('../../utils/deliveryPlanConfigured');
const runtimePolicy = getRuntimePolicy();

const ORDER_STATUS_RANK = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  completed: 3,
  cancelled: 4,
};

const TERMINAL_ORDER_STATUSES = new Set(['completed', 'cancelled']);

function successResponse(res, payload = {}, message = 'OK', code = 'OK', httpStatus = 200) {
  return res.status(httpStatus).json({
    success: true,
    code,
    message,
    ...payload,
  });
}

function errorResponse(res, httpStatus, code, message, details = null, extra = {}) {
  return res.status(httpStatus).json({
    success: false,
    code,
    message,
    error: message,
    details,
    ...extra,
  });
}

function evaluateOrderStatusTransition(currentStatus, targetStatus, paymentStatus) {
  const from = String(currentStatus || 'pending').toLowerCase();
  const to = String(targetStatus || '').toLowerCase();
  const pay = String(paymentStatus || '').toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(ORDER_STATUS_RANK, to)) {
    return { ok: false, reason: 'invalid_target', from, to };
  }
  if (!Object.prototype.hasOwnProperty.call(ORDER_STATUS_RANK, from)) {
    return { ok: false, reason: 'invalid_current', from, to };
  }
  if (from === to) {
    return { ok: true, reason: 'noop', from, to };
  }
  if (TERMINAL_ORDER_STATUSES.has(from)) {
    return { ok: false, reason: 'terminal_locked', from, to };
  }

  // cancelled can be reached from any non-terminal status
  if (to === 'cancelled') {
    return { ok: true, reason: 'cancel', from, to };
  }

  // forward-only protection for normal states
  if (ORDER_STATUS_RANK[to] < ORDER_STATUS_RANK[from]) {
    return { ok: false, reason: 'rollback_blocked', from, to };
  }

  // service states require paid status
  if ((to === 'processing' || to === 'completed') && pay !== 'paid') {
    return { ok: false, reason: 'payment_required', from, to };
  }

  // completed should normally come from processing
  if (to === 'completed' && from !== 'processing') {
    return { ok: false, reason: 'invalid_path', from, to };
  }

  return { ok: true, reason: 'forward', from, to };
}

async function writeOrderAuditLog({
  userId = null,
  action,
  orderId,
  beforeData = null,
  afterData = null,
  reason = null,
  source = 'admin',
}) {
  try {
    await supabaseAdmin.from('order_audit_logs').insert({
      user_id: userId,
      action,
      entity_type: 'order',
      entity_id: orderId || null,
      before_data: beforeData,
      after_data: afterData,
      reason,
      source,
    });
  } catch (error) {
    logger.warn('[admin/orders] write order_audit_logs failed:', error?.message || error);
  }
}

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

// Validation helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
  }
  next();
};

/**
 * Get orders list
 * GET /api/admin/orders?page=1&limit=20&payment_status=paid&order_status=confirmed
 */
router.get('/', checkPermission('manage_orders'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const paymentStatus = req.query.payment_status;
    const orderStatus = req.query.order_status;
    const search = req.query.search;
    const salespersonId = req.query.salesperson_id;
    const productId = req.query.product_id;
    const totalAmountMin = req.query.total_amount_min;
    const totalAmountMax = req.query.total_amount_max;
    const listType = (req.query.list_type || 'orders'); // 'orders' | 'cancelled' | 'refunded'

    let query = supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact' });

    // 订单列表：展示全部订单（含已取消、已退款），通过筛选器过滤
    if (listType === 'cancelled') {
      query = query.eq('order_status', 'cancelled').neq('payment_status', 'refunded');
    } else if (listType === 'refunded') {
      query = query.eq('payment_status', 'refunded');
    }
    // listType === 'orders' 时不再排除已取消/已退款，全部展示

    if (listType !== 'cancelled' && listType !== 'refunded') {
      if (paymentStatus) query = query.eq('payment_status', paymentStatus);
      if (orderStatus) query = query.eq('order_status', orderStatus);
      if (salespersonId) query = query.eq('salesperson_id', salespersonId);
      if (productId) query = query.eq('product_id', productId);
      if (totalAmountMin != null && totalAmountMin !== '') {
        query = query.gte('total_amount', parseFloat(totalAmountMin));
      }
      if (totalAmountMax != null && totalAmountMax !== '') {
        query = query.lte('total_amount', parseFloat(totalAmountMax));
      }
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    let ordersData = data || [];

    if (ordersData.length > 0) {
      const userIds = [...new Set(ordersData.map(order => order.user_id).filter(Boolean))];
      const productIds = [...new Set(ordersData.map(order => order.product_id).filter(Boolean))];
      const salespersonIds = [...new Set(ordersData.map(order => order.salesperson_id).filter(Boolean))];

      const usersMap = {};
      const productsMap = {};
      const salespersonsMap = {};

      if (userIds.length > 0) {
        const { data: userProfiles } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id, nickname, phone, meal_plan_configured, meal_plan_config_data')
          .in('user_id', userIds);

        (userProfiles || []).forEach(profile => {
          usersMap[profile.user_id] = profile;
        });
      }

      if (productIds.length > 0) {
        const { data: productData } = await supabaseAdmin
          .from('products')
          .select('id, product_code, product_name, duration_days')
          .in('id', productIds);

        (productData || []).forEach(product => {
          productsMap[product.id] = product;
        });
      }

      const orderIds = ordersData.map((o) => o.id).filter(Boolean);
      const scheduleCountMap = {};
      if (orderIds.length > 0) {
        const { data: schedRows } = await supabaseAdmin
          .from('delivery_schedules')
          .select('order_id')
          .in('order_id', orderIds);
        (schedRows || []).forEach((row) => {
          if (!row.order_id) return;
          scheduleCountMap[row.order_id] = (scheduleCountMap[row.order_id] || 0) + 1;
        });
      }

      if (salespersonIds.length > 0) {
        try {
          const { data: salesData } = await supabaseAdmin
            .from('sales_persons')
            .select('id, name, code, display_id, level, team_id')
            .in('id', salespersonIds);
          const teamIds = [...new Set((salesData || []).map(sp => sp.team_id).filter(Boolean))];
          const teamsMap = {};
          if (teamIds.length > 0) {
            const { data: teamsData } = await supabaseAdmin
              .from('sales_teams')
              .select('id, name, custom_name')
              .in('id', teamIds);
            (teamsData || []).forEach(t => {
              teamsMap[t.id] = t.custom_name || t.name || '';
            });
          }
          (salesData || []).forEach(sp => {
            salespersonsMap[sp.id] = {
              ...sp,
              team_name: sp.team_id ? (teamsMap[sp.team_id] || '') : '',
            };
          });
        } catch (e) {
          logger.warn('sales_persons fetch skipped:', e?.message);
        }
      }

      ordersData = ordersData.map((order) => {
        const prof = usersMap[order.user_id] || null;
        const sc = scheduleCountMap[order.id] || 0;
        const plan = getPlanConfigStateFromProfile(prof, order, sc);
        return {
          ...order,
          user_profiles: prof,
          products: productsMap[order.product_id] || null,
          sales_person: order.salesperson_id ? (salespersonsMap[order.salesperson_id] || null) : null,
          plan_configured: plan.plan_configured,
          plan_config_state: plan.plan_config_state,
          plan_config_state_zh: plan.plan_config_state_zh,
        };
      });
    }

    return successResponse(
      res,
      {
        orders: ordersData,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      },
      'Orders loaded',
      'OK'
    );
  } catch (error) {
    logger.error('Get orders list error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Check if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      return errorResponse(
        res,
        500,
        'SYSTEM_INTERNAL_ERROR',
        'Failed to get orders list',
        errorMessage,
        { hint: 'Database table "orders" may not exist. Please run migration: 20251201000005_create_products_and_orders_tables.sql' }
      );
    }

    return errorResponse(res, 500, errorCode, 'Failed to get orders list', errorMessage);
  }
});

/**
 * Get single order with details
 * GET /api/admin/orders/:id
 */
router.get('/:id', checkPermission('manage_orders'), async (req, res) => {
  try {
    const orderId = req.params.id;

    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    // Attach user profile
    let userProfile = null;
    if (order.user_id) {
      const { data: profileData } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, nickname, phone, meal_plan_configured, meal_plan_config_data')
        .eq('user_id', order.user_id)
        .maybeSingle();
      userProfile = profileData || null;
    }

    // Attach product info with meal_plans and supplement_plans
    let productInfo = null;
    if (order.product_id) {
      const { data: productData } = await supabaseAdmin
        .from('products')
        .select('id, product_code, product_name, duration_days, meal_plan_id, supplement_plan_id')
        .eq('id', order.product_id)
        .maybeSingle();
      if (productData) {
        let mealPlan = null;
        let suppPlan = null;
        if (productData.meal_plan_id) {
          const { data: m } = await supabaseAdmin
            .from('meal_plans')
            .select('id, plan_name, plan_code, duration_days, included_meal_types')
            .eq('id', productData.meal_plan_id)
            .maybeSingle();
          mealPlan = m || null;
        }
        if (productData.supplement_plan_id) {
          const { data: s } = await supabaseAdmin
            .from('supplement_plans')
            .select('id, plan_name, plan_code, duration_days')
            .eq('id', productData.supplement_plan_id)
            .maybeSingle();
          suppPlan = s || null;
        }
        productInfo = {
          ...productData,
          meal_plans: mealPlan,
          supplement_plans: suppPlan
        };
      }
    }

    // Get order items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      throw itemsError;
    }

    // Attach delivery_schedules for this order
    let deliverySchedules = [];
    const { data: schedules } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id, delivery_date, meal_type, delivery_time_start, delivery_time_end, delivery_address_id, is_locked, status')
      .eq('order_id', orderId)
      .eq('delivery_type', 'meal')
      .order('delivery_date', { ascending: true })
      .order('meal_type', { ascending: true });
    deliverySchedules = schedules || [];

    // Attach sales_person if salesperson_id exists
    let salesPerson = null;
    if (order.salesperson_id) {
      const { data: sp } = await supabaseAdmin
        .from('sales_persons')
        .select('id, name, code, display_id, level, team_id')
        .eq('id', order.salesperson_id)
        .maybeSingle();
      if (sp) {
        let teamName = '';
        if (sp.team_id) {
          const { data: t } = await supabaseAdmin
            .from('sales_teams')
            .select('name, custom_name')
            .eq('id', sp.team_id)
            .maybeSingle();
          teamName = t ? (t.custom_name || t.name || '') : '';
        }
        salesPerson = { ...sp, team_name: teamName };
      }
    }

    let scheduleCountForPlan = 0;
    const { count: schedHeadCount } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId);
    if (typeof schedHeadCount === 'number') scheduleCountForPlan = schedHeadCount;

    const plan = getPlanConfigStateFromProfile(userProfile, order, scheduleCountForPlan);

    return successResponse(
      res,
      {
        order: {
          ...order,
          user_profiles: userProfile,
          products: productInfo,
          sales_person: salesPerson,
          plan_configured: plan.plan_configured,
          plan_config_state: plan.plan_config_state,
          plan_config_state_zh: plan.plan_config_state_zh,
        },
        items: items || [],
        delivery_schedules: deliverySchedules,
        delivery_schedule_count: scheduleCountForPlan,
      },
      'Order loaded',
      'OK'
    );
  } catch (error) {
    logger.error('Get order error:', error);
    return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to get order', error.message);
  }
});

/**
 * Update order status
 * PATCH /api/admin/orders/:id/status
 */
router.patch('/:id/status',
  checkPermission('manage_orders'),
  [
    body('order_status').isIn(['pending', 'confirmed', 'processing', 'completed', 'cancelled']),
    validate
  ],
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { order_status } = req.body;

      const { data: beforeOrder, error: beforeErr } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, order_status, payment_status')
        .eq('id', orderId)
        .maybeSingle();

      if (beforeErr) throw beforeErr;
      if (!beforeOrder?.id) {
        return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      }

      const transition = evaluateOrderStatusTransition(
        beforeOrder.order_status,
        order_status,
        beforeOrder.payment_status
      );
      if (!transition.ok) {
        const detail =
          transition.reason === 'payment_required'
            ? 'payment_status must be paid before processing/completed'
            : transition.reason;
        return errorResponse(res, 409, 'ORDER_STATE_CONFLICT', 'Invalid order status transition', detail);
      }

      const patch = { order_status, updated_at: new Date().toISOString() };
      if (order_status === 'cancelled') {
        patch.delivery_state = 'ended';
        patch.end_time = new Date().toISOString();
      } else if (order_status === 'processing') {
        patch.delivery_state = 'started';
        patch.start_time = new Date().toISOString();
      }

      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update(patch)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!order) {
        return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      }

      if (
        String(beforeOrder.payment_status || '').toLowerCase() !== 'paid' &&
        String(order.payment_status || '').toLowerCase() === 'paid'
      ) {
        try {
          await ensureOrderSettlementSnapshot(order.id);
        } catch (snapshotError) {
          logger.error('[admin/orders] ensure settlement snapshot failed:', snapshotError);
        }
      }

      await writeOrderAuditLog({
        userId: beforeOrder.user_id || null,
        action: 'admin_order_status_updated',
        orderId,
        beforeData: {
          order_status: beforeOrder.order_status,
          payment_status: beforeOrder.payment_status,
        },
        afterData: patch,
        reason: `admin_patch_status:${transition.reason}`,
        source: 'admin',
      });

      return successResponse(res, { order }, 'Order status updated successfully', 'OK');
    } catch (error) {
      logger.error('Update order status error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to update order status', error.message);
    }
  }
);

/**
 * Update payment status
 * PATCH /api/admin/orders/:id/payment
 */
router.patch('/:id/payment',
  checkPermission('manage_orders'),
  [
    body('payment_status').isIn(['pending', 'paid', 'refunded', 'cancelled']),
    validate
  ],
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { payment_status, payment_time } = req.body;

      const { data: beforeOrder, error: beforeErr } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, order_status, payment_status')
        .eq('id', orderId)
        .maybeSingle();

      if (beforeErr) throw beforeErr;
      if (!beforeOrder?.id) {
        return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      }

      const transition = evaluatePaymentTransition(beforeOrder.payment_status, payment_status);
      if (!transition.ok) {
        return errorResponse(
          res,
          409,
          'ORDER_STATE_CONFLICT',
          'Invalid payment status transition',
          transition.reason
        );
      }

      const updateData = { payment_status, updated_at: new Date().toISOString() };
      if (payment_time) {
        updateData.payment_time = payment_time;
      } else if (payment_status === 'paid') {
        updateData.payment_time = new Date().toISOString();
      }
      if (
        payment_status === 'paid' &&
        String(beforeOrder.order_status || '').toLowerCase() === 'pending'
      ) {
        updateData.order_status = 'confirmed';
      }
      if (payment_status === 'refunded' || payment_status === 'cancelled') {
        updateData.order_status = 'cancelled';
      }

      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!order) {
        return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      }

      await writeOrderAuditLog({
        userId: beforeOrder.user_id || null,
        action: 'admin_payment_status_updated',
        orderId,
        beforeData: {
          payment_status: beforeOrder.payment_status,
          order_status: beforeOrder.order_status,
        },
        afterData: updateData,
        reason: `admin_patch_payment:${transition.reason}`,
        source: 'admin',
      });

      return successResponse(res, { order }, 'Payment status updated successfully', 'OK');
    } catch (error) {
      logger.error('Update payment status error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to update payment status', error.message);
    }
  }
);

router.patch('/:id/confirm',
  checkPermission('manage_orders'),
  [
    body('confirm_status').isIn(['unconfirmed','confirmed']),
    validate
  ],
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { confirm_status, confirm_time } = req.body;
      const updateData = { confirm_status };
      updateData.confirm_time = confirm_time || (confirm_status === 'confirmed' ? new Date().toISOString() : null);
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      if (!order) return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      return successResponse(res, { order }, 'Confirm status updated', 'OK');
    } catch (error) {
      logger.error('Update confirm status error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to update confirm status', error.message);
    }
  }
);

router.patch('/:id/start',
  checkPermission('manage_orders'),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { start_time } = req.body;
      const { data: currentOrder, error: queryError } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, user_id, payment_status, order_status, included_meal_types')
        .eq('id', orderId)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!currentOrder) return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');

      if (String(currentOrder.order_status || '').toLowerCase() === 'processing') {
        return successResponse(res, { order: currentOrder }, 'Order already started', 'OK');
      }

      const transition = evaluateOrderStatusTransition(
        currentOrder.order_status,
        'processing',
        currentOrder.payment_status
      );
      if (!transition.ok) {
        return errorResponse(
          res,
          409,
          'ORDER_STATE_CONFLICT',
          'Invalid order status transition',
          transition
        );
      }

      const hasMealTypes =
        Array.isArray(currentOrder.included_meal_types) &&
        currentOrder.included_meal_types.length > 0;
      if (hasMealTypes) {
        const { count: scheduleCount, error: scheduleError } = await supabaseAdmin
          .from('delivery_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', orderId)
          .eq('delivery_type', 'meal');
        if (scheduleError) throw scheduleError;
        if (!scheduleCount || scheduleCount <= 0) {
          return errorResponse(
            res,
            409,
            'ORDER_NO_DELIVERY_PLAN',
            'Please configure delivery plan before starting service'
          );
        }

        const { data: firstSchedule, error: firstScheduleError } = await supabaseAdmin
          .from('delivery_schedules')
          .select('delivery_date, meal_type, delivery_address, delivery_address_label, delivery_contact_name, delivery_contact_phone')
          .eq('order_id', orderId)
          .eq('delivery_type', 'meal')
          .order('delivery_date', { ascending: true })
          .order('meal_type', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstScheduleError) throw firstScheduleError;

        const deliveryCreatePayload = {
          order_id: currentOrder.id,
          external_order_id: currentOrder.order_number || currentOrder.id,
          order_number: currentOrder.order_number || currentOrder.id,
          user_id: currentOrder.user_id,
          delivery_type: 'meal',
          delivery_date: firstSchedule?.delivery_date || null,
          meal_type: firstSchedule?.meal_type || null,
          address: firstSchedule?.delivery_address || '',
          address_label: firstSchedule?.delivery_address_label || '',
          contact_name: firstSchedule?.delivery_contact_name || '',
          contact_phone: firstSchedule?.delivery_contact_phone || '',
        };
        const deliveryCreateResp = await createDeliveryOrder(deliveryCreatePayload);
        if (!deliveryCreateResp.ok) {
          logger.warn('[admin/orders] createDeliveryOrder failed', {
            order_id: currentOrder.id,
            order_number: currentOrder.order_number,
            provider: deliveryCreateResp.provider,
            message: deliveryCreateResp.message,
            status: deliveryCreateResp.status,
          });
          if (runtimePolicy.strict && !runtimePolicy.allowSimulatedDelivery) {
            return errorResponse(
              res,
              502,
              'DELIVERY_CREATE_FAILED',
              '下发配送单失败，已阻断开启服务',
              deliveryCreateResp.message || null,
            );
          }
        }
      }

      const now = start_time || new Date().toISOString();
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'processing',
          delivery_state: 'started',
          start_time: now,
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('order_status', currentOrder.order_status)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!order) {
        return errorResponse(res, 409, 'ORDER_STATE_CONFLICT', 'Order state changed, please refresh and retry');
      }

      await writeOrderAuditLog({
        userId: currentOrder.user_id || null,
        action: 'order_service_started',
        orderId,
        beforeData: {
          order_status: currentOrder.order_status,
          payment_status: currentOrder.payment_status,
        },
        afterData: {
          order_status: order.order_status,
          delivery_state: order.delivery_state,
          start_time: order.start_time,
        },
        reason: 'admin_start_service',
        source: 'admin',
      });
      return successResponse(res, { order }, 'Order started', 'OK');
    } catch (error) {
      logger.error('Start order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to start order', error.message);
    }
  }
);

router.patch('/:id/end',
  checkPermission('manage_orders'),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { end_time } = req.body;
      const { data: currentOrder, error: queryError } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, payment_status, order_status, delivery_state, start_time')
        .eq('id', orderId)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!currentOrder) return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');

      if (String(currentOrder.order_status || '').toLowerCase() === 'completed') {
        return successResponse(res, { order: currentOrder }, 'Order already ended', 'OK');
      }

      const transition = evaluateOrderStatusTransition(
        currentOrder.order_status,
        'completed',
        currentOrder.payment_status
      );
      if (!transition.ok) {
        return errorResponse(
          res,
          409,
          'ORDER_STATE_CONFLICT',
          'Invalid order status transition',
          transition
        );
      }

      const now = end_time || new Date().toISOString();
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'completed',
          delivery_state: 'ended',
          end_time: now,
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('order_status', currentOrder.order_status)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!order) {
        return errorResponse(res, 409, 'ORDER_STATE_CONFLICT', 'Order state changed, please refresh and retry');
      }

      await writeOrderAuditLog({
        userId: currentOrder.user_id || null,
        action: 'order_service_completed',
        orderId,
        beforeData: {
          order_status: currentOrder.order_status,
          delivery_state: currentOrder.delivery_state,
          start_time: currentOrder.start_time,
        },
        afterData: {
          order_status: order.order_status,
          delivery_state: order.delivery_state,
          end_time: order.end_time,
        },
        reason: 'admin_end_service',
        source: 'admin',
      });
      return successResponse(res, { order }, 'Order ended', 'OK');
    } catch (error) {
      logger.error('End order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to end order', error.message);
    }
  }
);

router.patch('/:id/comment',
  checkPermission('manage_orders'),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { comment_time, notes } = req.body;
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update({ comment_time: comment_time || new Date().toISOString(), notes })
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      if (!order) return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      return successResponse(res, { order }, 'Order commented', 'OK');
    } catch (error) {
      logger.error('Comment order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to set comment time', error.message);
    }
  }
);

/** 订单创建后不可修改（除退单、内部备注）。仅允许更新 notes。 */
router.patch('/:id',
  checkPermission('manage_orders'),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const allowed = ['notes'];
      const updateData = {};
      for (const k of allowed) {
        if (k in req.body) updateData[k] = req.body[k];
      }
      if (Object.keys(updateData).length === 0) {
        return errorResponse(res, 400, 'ORDER_UPDATE_NOT_ALLOWED', '无有效更新字段，订单创建后不可修改');
      }
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      if (!order) return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      return successResponse(res, { order }, '备注已更新', 'OK');
    } catch (error) {
      logger.error('Update order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to update order', error.message);
    }
  }
);

/**
 * 退单：仅对已支付订单有效。设置 payment_status=refunded，记录退款金额与原因。
 * 退单后该订单自动从销售业绩与佣金统计中排除（业绩接口仅统计 payment_status=paid）。
 */
router.post('/:id/refund',
  checkPermission('manage_orders'),
  [
    body('refund_amount').optional().isFloat({ min: 0 }).withMessage('退款金额必须大于等于 0'),
    body('refund_reason').optional().isString().withMessage('退款原因需为字符串'),
    validate
  ],
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { refund_amount, refund_reason } = req.body;

      const { data: order, error: fetchErr } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, payment_status, total_amount, order_status')
        .eq('id', orderId)
        .single();

      if (fetchErr || !order) return errorResponse(res, 404, 'ORDER_NOT_FOUND', '订单不存在');
      if (order.payment_status !== 'paid') {
        return errorResponse(res, 400, 'ORDER_REFUND_NOT_ALLOWED', '仅可对已支付订单执行退单');
      }

      const finalRefundAmount = refund_amount != null ? Number(refund_amount) : Number(order.total_amount);

      const { data: updated, error } = await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'refunded',
          order_status: 'cancelled',
          refund_amount: finalRefundAmount,
          refund_time: new Date().toISOString(),
          refund_reason: refund_reason || null,
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      await writeOrderAuditLog({
        userId: order.user_id || null,
        action: 'order_refunded',
        orderId,
        beforeData: {
          payment_status: order.payment_status,
          order_status: order.order_status,
        },
        afterData: {
          payment_status: 'refunded',
          order_status: 'cancelled',
          refund_amount: finalRefundAmount,
        },
        reason: refund_reason || 'admin_refund',
        source: 'admin',
      });

      return successResponse(res, { order: updated }, '退单成功', 'OK');
    } catch (error) {
      logger.error('Refund order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', '退单失败', error.message);
    }
  }
);

/**
 * 取消订单：仅对未支付订单有效。设置 order_status=cancelled。
 */
router.post('/:id/cancel',
  checkPermission('manage_orders'),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { data: order, error: fetchErr } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, payment_status, order_status')
        .eq('id', orderId)
        .single();

      if (fetchErr || !order) return errorResponse(res, 404, 'ORDER_NOT_FOUND', '订单不存在');
      if (order.payment_status === 'paid') {
        return errorResponse(res, 400, 'ORDER_CANCEL_NOT_ALLOWED', '已支付订单不可取消，请使用退单');
      }

      // 同步将未支付流水标记为 cancelled，避免用户端仍按 payment_status=pending 展示「待支付」
      const paymentPatch =
        order.payment_status === 'pending' ? { payment_status: 'cancelled' } : {};

      const { data: updated, error } = await supabaseAdmin
        .from('orders')
        .update({ order_status: 'cancelled', ...paymentPatch })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      await writeOrderAuditLog({
        userId: order.user_id || null,
        action: 'order_cancelled',
        orderId,
        beforeData: {
          payment_status: order.payment_status,
          order_status: order.order_status,
        },
        afterData: {
          payment_status: paymentPatch.payment_status || order.payment_status,
          order_status: 'cancelled',
        },
        reason: 'admin_cancel',
        source: 'admin',
      });

      return successResponse(res, { order: updated }, '订单已取消', 'OK');
    } catch (error) {
      logger.error('Cancel order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', '取消失败', error.message);
    }
  }
);

/**
 * 删除订单：仅允许删除未支付订单（payment_status != 'paid'）
 * 注：订单页面不暴露删除功能，仅取消。此接口保留供内部/脚本使用。
 */
router.delete('/:id',
  checkPermission('manage_orders'),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { data: order, error: fetchErr } = await supabaseAdmin
        .from('orders')
        .select('id, payment_status')
        .eq('id', orderId)
        .single();

      if (fetchErr || !order) return errorResponse(res, 404, 'ORDER_NOT_FOUND', '订单不存在');
      if (order.payment_status === 'paid') {
        return errorResponse(res, 400, 'ORDER_DELETE_NOT_ALLOWED', '已支付订单不可删除');
      }

      const { error } = await supabaseAdmin.from('orders').delete().eq('id', orderId);
      if (error) throw error;
      return successResponse(res, {}, '订单已删除', 'OK');
    } catch (error) {
      logger.error('Delete order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', '删除失败', error.message);
    }
  }
);

/**
 * Create new order
 * POST /api/admin/orders
 */
router.post('/',
  checkPermission('manage_orders'),
  [
    body('user_id').isUUID().withMessage('Valid user_id is required'),
    body('product_id').isUUID().withMessage('Valid product_id is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be >= 0'),
    body('payment_method').optional().isIn(['支付宝', '微信支付', '银行卡', '其他']).withMessage('Invalid payment method'),
    validate
  ],
  async (req, res) => {
    try {
      const {
        user_id,
        product_id,
        quantity,
        unit_price,
        total_amount,
        payment_method,
        payment_status,
        order_status,
        delivery_address_id,
        notes,
        salesperson_id
      } = req.body;

      // Calculate total_amount if not provided
      const finalTotalAmount = total_amount || (unit_price * quantity);

      // Get product info to verify it exists
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, price')
        .eq('id', product_id)
        .single();

      if (productError || !product) {
        return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
      }

      // order_number 仅由 DB 触发器 generate_order_number 生成（ORD+日期+6 位）；勿从请求体传入外部单号
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id,
          product_id,
          quantity,
          unit_price: unit_price || product.price,
          total_amount: finalTotalAmount,
          payment_method: payment_method || '其他',
          payment_status: payment_status || 'pending',
          order_status: order_status || 'pending',
          delivery_address_id: delivery_address_id || null,
          notes: notes || null,
          salesperson_id: salesperson_id || null
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      const paymentCreatePayload = {
        order_id: order.id,
        order_number: order.order_number,
        amount: Number(order.total_amount || 0),
        amount_cents: Math.round(Number(order.total_amount || 0) * 100),
        description: `订单${order.order_number || order.id}`,
        user_id: order.user_id,
      };
      const paymentCreateResp = await createPaymentOrder(paymentCreatePayload);
      if (!paymentCreateResp.ok) {
        logger.warn('[admin/orders] createPaymentOrder failed', {
          order_id: order.id,
          order_number: order.order_number,
          provider: paymentCreateResp.provider,
          message: paymentCreateResp.message,
          status: paymentCreateResp.status,
        });
        if (runtimePolicy.strict && !runtimePolicy.allowSimulatedPayment) {
          await supabaseAdmin.from('orders').delete().eq('id', order.id);
          return errorResponse(
            res,
            502,
            'PAYMENT_CREATE_FAILED',
            '创建支付单失败，已阻断订单创建',
            paymentCreateResp.message || null,
          );
        }
      }

      if (String(order.payment_status || '').toLowerCase() === 'paid') {
        try {
          await ensureOrderSettlementSnapshot(order.id);
        } catch (snapshotError) {
          logger.error('[admin/orders] ensure settlement snapshot on create failed:', snapshotError);
        }
      }

      return successResponse(res, { order }, 'Order created successfully', 'OK', 201);
    } catch (error) {
      logger.error('Create order error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to create order', error.message);
    }
  }
);

/**
 * Get order statistics
 * GET /api/admin/orders/stats?start_date=2025-01-01&end_date=2025-12-31
 */
router.get('/stats/summary', checkPermission('manage_orders'), async (req, res) => {
  try {
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    let query = supabaseAdmin
      .from('orders')
      .select('payment_status, order_status, total_amount, created_at', { count: 'exact' });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: orders, error } = await query;

    if (error) {
      throw error;
    }

    const stats = {
      total_orders: orders?.length || 0,
      total_amount: 0,
      paid_amount: 0,
      pending_amount: 0,
      by_payment_status: {},
      by_order_status: {}
    };

    (orders || []).forEach(order => {
      stats.total_amount += parseFloat(order.total_amount || 0);
      
      if (order.payment_status === 'paid') {
        stats.paid_amount += parseFloat(order.total_amount || 0);
      } else {
        stats.pending_amount += parseFloat(order.total_amount || 0);
      }

      stats.by_payment_status[order.payment_status] = (stats.by_payment_status[order.payment_status] || 0) + 1;
      stats.by_order_status[order.order_status] = (stats.by_order_status[order.order_status] || 0) + 1;
    });

    return successResponse(res, { stats }, 'Order statistics loaded', 'OK');
  } catch (error) {
    logger.error('Get order statistics error:', error);
    return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to get order statistics', error.message);
  }
});

module.exports = router;
