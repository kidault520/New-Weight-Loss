/**
 * C 端订单相关接口（用户支付等）
 * 需携带 Supabase JWT (Authorization: Bearer xxx)
 */

const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { evaluatePaymentTransition } = require('../utils/orderPaymentTransition');
const { ensureOrderSettlementSnapshot } = require('../services/orderSettlementSnapshot');
const { createPaymentOrder } = require('../services/paymentProviderService');
const { createDeliveryOrder } = require('../services/deliveryProviderService');
const { getRuntimePolicy } = require('../config/runtimeMode');
const router = express.Router();
const runtimePolicy = getRuntimePolicy();
const PAYMENT_CREATE_RETRY_MAX = 2;

const PAYMENT_CALLBACK_ERROR_HTTP = {
  PAYMENT_CALLBACK_UNAUTHORIZED: 401,
  PAYMENT_CALLBACK_INVALID_PAYLOAD: 400,
  PAYMENT_EVENT_DUPLICATE: 200,
  ORDER_NOT_FOUND: 404,
  ORDER_STATE_CONFLICT: 409,
  SYSTEM_INTERNAL_ERROR: 500,
};

const PAYMENT_CALLBACK_REASON_CODE = {
  invalid_target: 'ORDER_STATE_CONFLICT',
  invalid_current: 'ORDER_STATE_CONFLICT',
  terminal_locked: 'ORDER_STATE_CONFLICT',
  rollback_blocked: 'ORDER_STATE_CONFLICT',
};

const verifyPaymentCallbackToken = (req, res, next) => {
  const expected = process.env.PAYMENT_CALLBACK_TOKEN;
  if (!expected) {
    logger.warn('[orders] PAYMENT_CALLBACK_TOKEN missing, callback endpoint disabled');
    return res.status(503).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      message: 'Payment callback endpoint unavailable',
    });
  }

  const got = req.headers['x-payment-callback-token'];
  if (String(got || '') !== expected) {
    return res.status(401).json({
      success: false,
      code: 'PAYMENT_CALLBACK_UNAUTHORIZED',
      message: 'Unauthorized callback',
    });
  }
  next();
};

function errorResponse(res, code, message, details) {
  const http = PAYMENT_CALLBACK_ERROR_HTTP[code] || 500;
  return res.status(http).json({
    success: false,
    code,
    message,
    details: details || null,
  });
}

function userApiError(res, http, code, message, details) {
  return res.status(http).json({
    success: false,
    code,
    message,
    error: message,
    details: details || null,
  });
}

async function writeOrderAuditLog({
  userId,
  action,
  orderId,
  beforeData = null,
  afterData = null,
  reason = null,
  source = 'app',
}) {
  try {
    await supabaseAdmin.from('order_audit_logs').insert({
      user_id: userId || null,
      action,
      entity_type: 'order',
      entity_id: orderId || null,
      before_data: beforeData,
      after_data: afterData,
      reason,
      source,
    });
  } catch (error) {
    logger.warn('[orders] write order_audit_logs failed:', error?.message || error);
  }
}

async function createPaymentWithRetry(payload, maxAttempts = PAYMENT_CREATE_RETRY_MAX) {
  let lastResp = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const resp = await createPaymentOrder(payload);
    lastResp = resp;
    if (resp?.ok) {
      return { ok: true, response: resp, attempt };
    }
  }
  return { ok: false, response: lastResp, attempt: maxAttempts };
}

/** 验证 Supabase JWT，将 user 挂到 req.user */
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return userApiError(res, 401, 'ORDER_UNAUTHORIZED', '未登录，请先登录');
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return userApiError(res, 401, 'ORDER_UNAUTHORIZED', '登录已过期，请重新登录');
    }
    req.user = user;
    next();
  } catch (e) {
    logger.error('authenticateUser error:', e);
    return userApiError(res, 500, 'SYSTEM_INTERNAL_ERROR', '验证失败，请重试');
  }
};

/**
 * 创建支付单（主链路）
 * POST /api/orders/:id/create-payment
 */
router.post('/:id/create-payment', authenticateUser, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, order_number, payment_status, total_amount, updated_at')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return userApiError(res, 404, 'ORDER_NOT_FOUND', '订单不存在');
    }
    if (order.user_id !== userId) {
      return userApiError(res, 403, 'ORDER_FORBIDDEN', '无权操作此订单');
    }
    if (String(order.payment_status || '').toLowerCase() !== 'pending') {
      return userApiError(res, 409, 'PAYMENT_ALREADY_CONFIRMED', '订单已支付或已取消');
    }

    const paymentCreatePayload = {
      order_id: order.id,
      order_number: order.order_number || order.id,
      amount: Number(order.total_amount || 0),
      amount_cents: Math.round(Number(order.total_amount || 0) * 100),
      description: `订单${order.order_number || order.id}`,
      user_id: order.user_id,
      preferred_payment_method: req.body?.preferred_payment_method
        ? String(req.body.preferred_payment_method)
        : undefined,
    };

    const createResult = await createPaymentWithRetry(paymentCreatePayload);
    if (!createResult.ok) {
      logger.warn('[orders] createPaymentOrder failed', {
        order_id: order.id,
        order_number: order.order_number,
        message: createResult.response?.message,
        provider: createResult.response?.provider,
        status: createResult.response?.status,
        attempt: createResult.attempt,
      });
      await writeOrderAuditLog({
        userId,
        action: 'order_payment_create_failed',
        orderId,
        beforeData: { payment_status: order.payment_status },
        afterData: {
          provider: createResult.response?.provider || null,
          status: createResult.response?.status || 0,
          message: createResult.response?.message || null,
          attempt: createResult.attempt,
        },
        reason: 'user_create_payment',
        source: 'app',
      });
      return userApiError(
        res,
        502,
        'PAYMENT_CREATE_FAILED',
        '创建支付单失败，请稍后重试',
        createResult.response?.message || null,
      );
    }

    await writeOrderAuditLog({
      userId,
      action: 'order_payment_create_succeeded',
      orderId,
      beforeData: { payment_status: order.payment_status },
      afterData: {
        provider: createResult.response?.provider || null,
        status: createResult.response?.status || 200,
        data: createResult.response?.data || null,
        attempt: createResult.attempt,
      },
      reason: 'user_create_payment',
      source: 'app',
    });

    return res.json({
      success: true,
      code: 'OK',
      message: '支付单创建成功',
      provider: createResult.response?.provider || null,
      payment: createResult.response?.data || {},
    });
  } catch (err) {
    logger.error('[orders] create-payment error:', err);
    return userApiError(res, 500, 'SYSTEM_INTERNAL_ERROR', '创建支付单失败，请重试');
  }
});

/**
 * 确认支付（模拟支付，用于开发/测试）
 * POST /api/orders/:id/confirm-payment
 */
router.post('/:id/confirm-payment', authenticateUser, async (req, res) => {
  try {
    if (runtimePolicy.strict && !runtimePolicy.allowSimulatedPayment) {
      return userApiError(
        res,
        403,
        'SIMULATED_PAYMENT_DISABLED',
        '当前环境已禁用模拟支付确认，请走真实支付链路',
      );
    }
    const orderId = req.params.id;
    const userId = req.user.id;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, order_number, payment_status, total_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return userApiError(res, 404, 'ORDER_NOT_FOUND', '订单不存在');
    }

    if (order.user_id !== userId) {
      return userApiError(res, 403, 'ORDER_FORBIDDEN', '无权操作此订单');
    }

    if (order.payment_status !== 'pending') {
      return userApiError(res, 409, 'PAYMENT_ALREADY_CONFIRMED', '订单已支付或已取消');
    }

    const paymentCreatePayload = {
      order_id: order.id,
      order_number: order.order_number || order.id,
      amount: Number(order.total_amount || 0),
      amount_cents: Math.round(Number(order.total_amount || 0) * 100),
      description: `订单${order.order_number || order.id}`,
      user_id: order.user_id,
    };
    const createResult = await createPaymentWithRetry(paymentCreatePayload);
    if (!createResult.ok) {
      logger.warn('[orders] createPaymentOrder failed before confirm', {
        order_id: order.id,
        order_number: order.order_number,
        message: createResult.response?.message,
        provider: createResult.response?.provider,
        status: createResult.response?.status,
        attempt: createResult.attempt,
      });
      return userApiError(
        res,
        502,
        'PAYMENT_CREATE_FAILED',
        '创建支付单失败，请稍后重试',
        createResult.response?.message || null,
      );
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_time: new Date().toISOString(),
        order_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('payment_status', 'pending')
      .select('id')
      .maybeSingle();

    if (updateError) {
      logger.error('confirm-payment update error:', updateError);
      return userApiError(res, 500, 'SYSTEM_INTERNAL_ERROR', '支付失败，请重试');
    }
    if (!updatedOrder?.id) {
      return userApiError(res, 409, 'ORDER_STATE_CONFLICT', '订单状态已变化，请刷新后重试');
    }

    await writeOrderAuditLog({
      userId,
      action: 'order_payment_confirmed',
      orderId,
      beforeData: { payment_status: order.payment_status },
      afterData: { payment_status: 'paid', order_status: 'confirmed' },
      reason: 'user_confirm_payment',
      source: 'app',
    });

    try {
      await ensureOrderSettlementSnapshot(orderId);
    } catch (snapshotError) {
      logger.error('[orders] ensure settlement snapshot failed:', snapshotError);
    }

    res.json({ success: true, code: 'OK', message: '支付成功' });
  } catch (err) {
    logger.error('confirm-payment error:', err);
    res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      message: '支付失败，请重试',
      error: '支付失败，请重试',
    });
  }
});

/**
 * 支付回调（最小实现）
 * POST /api/orders/payment/callback
 * Header: x-payment-callback-token
 */
router.post('/payment/callback', verifyPaymentCallbackToken, async (req, res) => {
  try {
    const paymentEventId = req.body?.payment_event_id ? String(req.body.payment_event_id) : null;
    const externalOrderId = req.body?.external_order_id ? String(req.body.external_order_id) : null;
    const callbackPaymentStatus = req.body?.payment_status ? String(req.body.payment_status).toLowerCase() : null;
    const paidAt = req.body?.paid_at ? String(req.body.paid_at) : null;
    const rawPayload = req.body?.raw_payload || req.body || {};

    if (!paymentEventId || !externalOrderId || !callbackPaymentStatus) {
      return errorResponse(
        res,
        'PAYMENT_CALLBACK_INVALID_PAYLOAD',
        'payment_event_id, external_order_id, payment_status are required'
      );
    }

    const { data: insertedEvent, error: eventInsertError } = await supabaseAdmin
      .from('payment_callback_events')
      .insert({
        payment_event_id: paymentEventId,
        external_order_id: externalOrderId,
        callback_payment_status: callbackPaymentStatus,
        payload: rawPayload,
      })
      .select('id')
      .single();

    if (eventInsertError?.code === '23505') {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        code: 'PAYMENT_EVENT_DUPLICATE',
        message: 'Duplicate callback ignored',
      });
    }
    if (eventInsertError) {
      logger.error('[orders] payment callback insert event error:', eventInsertError);
      return errorResponse(res, 'SYSTEM_INTERNAL_ERROR', 'Failed to record callback event', eventInsertError.message);
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, payment_status, order_status, payment_time')
      .eq('order_number', externalOrderId)
      .maybeSingle();

    if (orderError) {
      logger.error('[orders] payment callback query order error:', orderError);
      return errorResponse(res, 'SYSTEM_INTERNAL_ERROR', 'Failed to query order', orderError.message);
    }
    if (!order?.id) {
      await supabaseAdmin
        .from('payment_callback_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          process_result: 'order_not_found',
        })
        .eq('id', insertedEvent.id);
      return errorResponse(res, 'ORDER_NOT_FOUND', 'Order not found by external_order_id');
    }

    const transition = evaluatePaymentTransition(order.payment_status, callbackPaymentStatus);
    if (!transition.ok) {
      await supabaseAdmin
        .from('payment_callback_events')
        .update({
          order_id: order.id,
          processed: true,
          processed_at: new Date().toISOString(),
          process_result: `ignored:${transition.reason}`,
        })
        .eq('id', insertedEvent.id);

      const code = PAYMENT_CALLBACK_REASON_CODE[transition.reason] || 'ORDER_STATE_CONFLICT';
      return errorResponse(res, code, 'Payment status transition blocked', { reason: transition.reason });
    }

    const patch = {
      payment_status: callbackPaymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (callbackPaymentStatus === 'paid') {
      patch.payment_time = paidAt || new Date().toISOString();
      if (String(order.order_status || '').toLowerCase() === 'pending') {
        patch.order_status = 'confirmed';
      }
    }

    if (callbackPaymentStatus === 'refunded' || callbackPaymentStatus === 'cancelled') {
      patch.order_status = 'cancelled';
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(patch)
      .eq('id', order.id)
      .eq('payment_status', order.payment_status)
      .select('id')
      .maybeSingle();

    if (updateError) {
      logger.error('[orders] payment callback update order error:', updateError);
      await supabaseAdmin
        .from('payment_callback_events')
        .update({
          order_id: order.id,
          processed: true,
          processed_at: new Date().toISOString(),
          process_result: 'order_update_failed',
        })
        .eq('id', insertedEvent.id);
      return errorResponse(res, 'SYSTEM_INTERNAL_ERROR', 'Failed to update order', updateError.message);
    }
    if (!updatedOrder?.id) {
      await supabaseAdmin
        .from('payment_callback_events')
        .update({
          order_id: order.id,
          processed: true,
          processed_at: new Date().toISOString(),
          process_result: 'order_state_conflict',
        })
        .eq('id', insertedEvent.id);
      return errorResponse(
        res,
        'ORDER_STATE_CONFLICT',
        'Payment callback update conflicted with current order state'
      );
    }

    await supabaseAdmin
      .from('payment_callback_events')
      .update({
        order_id: order.id,
        processed: true,
        processed_at: new Date().toISOString(),
        process_result: transition.reason === 'noop' ? 'noop' : 'updated',
      })
      .eq('id', insertedEvent.id);

    await writeOrderAuditLog({
      userId: null,
      action: 'order_payment_callback_processed',
      orderId: order.id,
      beforeData: {
        payment_status: order.payment_status,
        order_status: order.order_status,
      },
      afterData: patch,
      reason: `callback:${transition.reason}`,
      source: 'callback',
    });

    if (callbackPaymentStatus === 'paid') {
      try {
        await ensureOrderSettlementSnapshot(order.id);
      } catch (snapshotError) {
        logger.error('[orders] ensure settlement snapshot from callback failed:', snapshotError);
      }
    }

    return res.json({
      success: true,
      deduplicated: false,
      transitioned: transition.reason !== 'noop',
      code: 'OK',
      message: 'Payment callback processed',
    });
  } catch (err) {
    logger.error('[orders] payment callback error:', err);
    return errorResponse(res, 'SYSTEM_INTERNAL_ERROR', 'Failed to process payment callback', err.message);
  }
});

/**
 * 开启服务（用户配置配送计划后调用）
 * POST /api/orders/:id/start-service
 * 更新 order_status=processing, delivery_state=started, start_time
 */
router.post('/:id/start-service', authenticateUser, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, order_number, payment_status, order_status, included_meal_types')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return userApiError(res, 404, 'ORDER_NOT_FOUND', '订单不存在');
    }

    if (order.user_id !== userId) {
      return userApiError(res, 403, 'ORDER_FORBIDDEN', '无权操作此订单');
    }

    if (order.payment_status !== 'paid') {
      return userApiError(res, 400, 'ORDER_NOT_PAID', '订单未支付，无法开启服务');
    }

    if (['processing', 'completed', 'cancelled'].includes(order.order_status)) {
      return res.json({ success: true, code: 'ORDER_ALREADY_STARTED', message: '订单已是服务中或已完成' });
    }

    const hasMealTypes = Array.isArray(order.included_meal_types) && order.included_meal_types.length > 0;
    if (hasMealTypes) {
      const { count: scheduleCount, error: scheduleError } = await supabaseAdmin
        .from('delivery_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId)
        .eq('delivery_type', 'meal');
      if (scheduleError) {
        logger.error('start-service schedule check error:', scheduleError);
        return userApiError(res, 500, 'SYSTEM_INTERNAL_ERROR', '开启服务失败，请重试');
      }
      if (!scheduleCount || scheduleCount <= 0) {
        return userApiError(res, 409, 'ORDER_NO_DELIVERY_PLAN', '请先完成配送计划配置后再开启服务');
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
      if (firstScheduleError) {
        logger.error('start-service first schedule query error:', firstScheduleError);
        return userApiError(res, 500, 'SYSTEM_INTERNAL_ERROR', '开启服务失败，请重试');
      }

      const deliveryCreatePayload = {
        order_id: order.id,
        external_order_id: order.order_number || order.id,
        order_number: order.order_number || order.id,
        user_id: order.user_id,
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
        logger.warn('[orders] createDeliveryOrder failed', {
          order_id: order.id,
          order_number: order.order_number,
          provider: deliveryCreateResp.provider,
          message: deliveryCreateResp.message,
          status: deliveryCreateResp.status,
        });
        if (runtimePolicy.strict && !runtimePolicy.allowSimulatedDelivery) {
          return userApiError(
            res,
            502,
            'DELIVERY_CREATE_FAILED',
            '下发配送单失败，已阻断开启服务',
            deliveryCreateResp.message || null,
          );
        }
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: 'processing',
        delivery_state: 'started',
        start_time: now,
        updated_at: now,
      })
      .eq('id', orderId);

    if (updateError) {
      logger.error('start-service update error:', updateError);
      return userApiError(res, 500, 'SYSTEM_INTERNAL_ERROR', '开启服务失败，请重试');
    }

    await writeOrderAuditLog({
      userId,
      action: 'order_service_started',
      orderId,
      beforeData: {
        order_status: order.order_status,
        payment_status: order.payment_status,
      },
      afterData: { order_status: 'processing', delivery_state: 'started' },
      reason: 'user_start_service',
      source: 'app',
    });

    res.json({ success: true, code: 'OK', message: '服务已开启' });
  } catch (err) {
    logger.error('start-service error:', err);
    res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      message: '开启服务失败，请重试',
      error: '开启服务失败，请重试',
    });
  }
});

module.exports = router;
