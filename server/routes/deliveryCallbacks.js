const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { PROVIDER_RULES, resolveDeliveryStatus } = require('../config/deliveryStatusMapping');
const { evaluateTransition } = require('../utils/deliveryStatusTransition');

const router = express.Router();

const verifyCallbackToken = (req, res, next) => {
  const expected = process.env.DELIVERY_CALLBACK_TOKEN;
  if (!expected) {
    logger.warn('[deliveryCallbacks] DELIVERY_CALLBACK_TOKEN missing, callback endpoint disabled');
    return res.status(503).json({ error: 'Callback endpoint unavailable' });
  }
  const got = req.headers['x-delivery-callback-token'];
  if (String(got || '') !== expected) {
    return res.status(401).json({ error: 'Unauthorized callback' });
  }
  next();
};

router.get('/mapping', verifyCallbackToken, (req, res) => {
  return res.json({
    providers: PROVIDER_RULES,
    note: 'provider byCode > provider byText > default text > fallback pending',
  });
});

router.post('/status', verifyCallbackToken, async (req, res) => {
  try {
    const provider = String(req.body?.provider || 'unknown').toLowerCase();
    const externalOrderId = req.body?.external_order_id ? String(req.body.external_order_id) : null;
    const eventId = req.body?.event_id ? String(req.body.event_id) : null;
    const deliveryStatusRaw = req.body?.status || req.body?.delivery_status || req.body?.event_type;
    const deliveryStatusCode = req.body?.status_code ?? req.body?.code;
    const deliveredAtRaw = req.body?.delivered_at || null;
    const riderName = req.body?.rider_name || null;
    const riderPhone = req.body?.rider_phone || null;

    if (!externalOrderId) {
      return res.status(400).json({ error: 'external_order_id is required' });
    }

    const mapped = resolveDeliveryStatus({
      provider,
      status: deliveryStatusRaw,
      status_code: deliveryStatusCode,
      event_type: req.body?.event_type,
    });
    const normalizedStatus = mapped.status;
    const eventKey = eventId || `${externalOrderId}:${normalizedStatus}:${String(deliveredAtRaw || '')}`;

    const { data: existingEvent } = await supabaseAdmin
      .from('delivery_callback_events')
      .select('id')
      .eq('provider', provider)
      .eq('event_key', eventKey)
      .maybeSingle();

    if (existingEvent?.id) {
      return res.json({ success: true, deduplicated: true, message: 'Duplicate callback ignored' });
    }

    const { data: matchedSchedules, error: scheduleError } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id, user_id, status, delivered_at, rider_name, rider_phone')
      .eq('external_order_id', externalOrderId)
      .order('updated_at', { ascending: false })
      .limit(2);

    if (scheduleError) throw scheduleError;
    const schedules = matchedSchedules || [];
    if (schedules.length > 1) {
      await supabaseAdmin.from('delivery_callback_events').insert({
        provider,
        event_key: eventKey,
        event_type: 'status_conflict',
        payload: {
          ...(req.body || {}),
          _conflict_reason: 'duplicate_external_order_id',
          _matched_count: schedules.length,
        },
      });
      return res.status(409).json({
        error: 'Ambiguous external_order_id',
        details: 'Multiple schedules match this external_order_id, callback ignored',
      });
    }
    const schedule = schedules[0];
    if (!schedule) {
      await supabaseAdmin.from('delivery_callback_events').insert({
        provider,
        event_key: eventKey,
        event_type: 'status',
        payload: req.body || {},
      });
      return res.status(404).json({ error: 'Schedule not found for external_order_id' });
    }

    const transition = evaluateTransition(schedule.status, normalizedStatus);

    // 回调只允许“向前推进”或保持原状态，防止第三方回调覆盖为旧状态
    if (!transition.ok) {
      await supabaseAdmin.from('delivery_callback_events').insert({
        provider,
        event_key: eventKey,
        event_type: 'status_ignored',
        payload: {
          ...(req.body || {}),
          _mapped_status: normalizedStatus,
          _mapped_by: mapped.matchedBy,
          _ignored_reason: transition.reason || 'status_transition_guard',
          _current_status: transition.from,
        },
        schedule_id: schedule.id,
      });

      return res.json({
        success: true,
        deduplicated: false,
        ignored: true,
        schedule_id: schedule.id,
        normalized_status: normalizedStatus,
        current_status: transition.from,
      });
    }

    const patch = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
      rider_name: riderName || schedule.rider_name || null,
      rider_phone: riderPhone || schedule.rider_phone || null,
      delivered_at: normalizedStatus === 'delivered'
        ? (deliveredAtRaw || new Date().toISOString())
        : schedule.delivered_at,
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('delivery_schedules')
      .update(patch)
      .eq('id', schedule.id)
      .select('id')
      .single();
    if (updateError) throw updateError;

    await supabaseAdmin.from('delivery_callback_events').insert({
      provider,
      event_key: eventKey,
      event_type: 'status',
      payload: {
        ...(req.body || {}),
        _mapped_status: normalizedStatus,
        _mapped_by: mapped.matchedBy,
      },
      schedule_id: schedule.id,
    });

    await supabaseAdmin.from('delivery_audit_logs').insert({
      user_id: schedule.user_id,
      action: 'delivery_callback_update',
      entity_type: 'delivery_schedule',
      entity_id: schedule.id,
      before_data: schedule,
      after_data: patch,
      reason: 'third_party_callback',
      source: 'callback',
    });

    return res.json({
      success: true,
      deduplicated: false,
      schedule_id: updated.id,
      normalized_status: normalizedStatus,
      mapped_by: mapped.matchedBy,
    });
  } catch (error) {
    logger.error('[deliveryCallbacks] status callback error:', error);
    return res.status(500).json({ error: 'Failed to process callback', details: error.message });
  }
});

module.exports = router;
