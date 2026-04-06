/**
 * 配送状态对账脚本（P0）
 * 用法：
 *   node scripts/reconcile-delivery-status.js
 *   node scripts/reconcile-delivery-status.js --apply
 */

if (!process.env.TZ) {
  process.env.TZ = 'Asia/Shanghai';
}

require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { resolveDeliveryStatus } = require('../config/deliveryStatusMapping');

async function run() {
  const apply = process.argv.includes('--apply');
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 最近72小时

  const { data: events, error: eventError } = await supabaseAdmin
    .from('delivery_callback_events')
    .select('id, provider, event_key, payload, schedule_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (eventError) throw eventError;
  if (!events?.length) {
    console.log('No callback events found.');
    return;
  }

  // 防止状态回退：同一 schedule 仅以最新回调事件为准
  const latestEventBySchedule = new Map();
  for (const event of events) {
    if (!event.schedule_id) continue;
    if (!latestEventBySchedule.has(event.schedule_id)) {
      latestEventBySchedule.set(event.schedule_id, event);
    }
  }
  const latestEvents = Array.from(latestEventBySchedule.values());

  let mismatch = 0;
  let fixed = 0;

  for (const event of latestEvents) {
    const mapped = resolveDeliveryStatus({
      provider: event.provider,
      status: event?.payload?.status || event?.payload?.delivery_status || event?.payload?.event_type,
      status_code: event?.payload?.status_code ?? event?.payload?.code,
      event_type: event?.payload?.event_type,
    });
    const callbackStatus = mapped.status;
    const deliveredAt = event?.payload?.delivered_at || null;

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id, user_id, status, delivered_at, updated_at')
      .eq('id', event.schedule_id)
      .maybeSingle();

    if (scheduleError || !schedule) continue;

    const shouldBeDeliveredAt = callbackStatus === 'delivered'
      ? (deliveredAt || schedule.delivered_at || new Date().toISOString())
      : schedule.delivered_at;
    const inconsistent = schedule.status !== callbackStatus
      || (callbackStatus === 'delivered' && !schedule.delivered_at);

    if (!inconsistent) continue;
    mismatch += 1;

    if (!apply) continue;

    const patch = {
      status: callbackStatus,
      delivered_at: shouldBeDeliveredAt,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from('delivery_schedules')
      .update(patch)
      .eq('id', schedule.id);
    if (updateError) continue;

    await supabaseAdmin.from('delivery_audit_logs').insert({
      user_id: schedule.user_id,
      action: 'delivery_reconcile_fix',
      entity_type: 'delivery_schedule',
      entity_id: schedule.id,
      before_data: schedule,
      after_data: {
        ...patch,
        mapped_by: mapped.matchedBy,
      },
      reason: 'scheduled_reconciliation',
      source: 'reconcile-script',
    });

    fixed += 1;
  }

  console.log(JSON.stringify({
    scannedEvents: events.length,
    uniqueSchedules: latestEvents.length,
    mismatchCount: mismatch,
    fixedCount: fixed,
    dryRun: !apply,
  }, null, 2));
}

run().catch((error) => {
  console.error('Reconcile failed:', error);
  process.exit(1);
});
