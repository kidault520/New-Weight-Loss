const { supabaseAdmin } = require('../config/supabase');
const { toBeijingDateString, parseBeijingDate, getBeijingWeekRange } = require('../utils/timezone');
const logger = require('../utils/logger');

const toDateOnly = (raw) => {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return toBeijingDateString(date);
};

const pickCurrentSchedule = (schedules, todayStr) => {
  const current = (schedules || []).filter((s) => {
    const start = toDateOnly(s.start_time);
    const end = toDateOnly(s.end_time);
    if (!start || !end) return false;
    return start <= todayStr && todayStr <= end;
  });
  if (!current.length) return null;

  current.sort((a, b) => {
    const aStart = toDateOnly(a.start_time) || '0000-00-00';
    const bStart = toDateOnly(b.start_time) || '0000-00-00';
    if (aStart !== bStart) return bStart.localeCompare(aStart);
    const aCreated = String(a.created_at || '');
    const bCreated = String(b.created_at || '');
    return bCreated.localeCompare(aCreated);
  });
  return current[0];
};

const pickUpcomingSchedule = (schedules, todayStr) => {
  const upcoming = (schedules || []).filter((s) => {
    const start = toDateOnly(s.start_time);
    const end = toDateOnly(s.end_time);
    if (!start || !end) return false;
    return start > todayStr;
  });
  if (!upcoming.length) return null;

  upcoming.sort((a, b) => {
    const aStart = toDateOnly(a.start_time) || '9999-12-31';
    const bStart = toDateOnly(b.start_time) || '9999-12-31';
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    const aCreated = String(a.created_at || '');
    const bCreated = String(b.created_at || '');
    return bCreated.localeCompare(aCreated);
  });
  return upcoming[0];
};

const shouldPreActivateNextSchedule = (todayStr) => {
  const raw = Number(process.env.MEAL_SCHEDULE_PREACTIVATE_DAYS_BEFORE_WEEK_END ?? 1);
  const daysBeforeEnd = Number.isFinite(raw) ? Math.max(0, Math.min(6, Math.trunc(raw))) : 1;
  const today = parseBeijingDate(todayStr);
  if (!today) return false;
  const { end } = getBeijingWeekRange('this_week', today);
  const endYmd = toBeijingDateString(end);
  const endDate = parseBeijingDate(endYmd);
  if (!endDate) return false;
  const daysToWeekEnd = Math.round((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return daysToWeekEnd >= 0 && daysToWeekEnd <= daysBeforeEnd;
};

async function syncMealScheduleActivation({ trigger = 'unknown', actorId = null } = {}) {
  const todayStr = toBeijingDateString(new Date());

  let listResult = await supabaseAdmin
    .from('meal_schedules')
    .select('id, schedule_name, start_time, end_time, is_enabled, created_at')
    .order('start_time', { ascending: true });

  if (listResult.error && String(listResult.error.message || '').includes('is_enabled')) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_activation_fields',
      today: todayStr,
      trigger,
    };
  }
  if (listResult.error) throw listResult.error;

  const schedules = listResult.data || [];
  const target = pickCurrentSchedule(schedules, todayStr);
  const nextCandidate = pickUpcomingSchedule(schedules, todayStr);
  const preActivateWindow = shouldPreActivateNextSchedule(todayStr);
  const currentEnabled = schedules.find((s) => s.is_enabled);

  const keepEnabledIds = new Set();
  if (target) keepEnabledIds.add(target.id);
  if (target && nextCandidate && preActivateWindow) {
    keepEnabledIds.add(nextCandidate.id);
  }

  if (!target) {
    if (!currentEnabled) {
      return {
        ok: true,
        changed: false,
        today: todayStr,
        trigger,
        active_schedule_id: null,
      };
    }

    const disableRes = await supabaseAdmin
      .from('meal_schedules')
      .update({ is_enabled: false })
      .eq('is_enabled', true);
    if (disableRes.error) throw disableRes.error;

    logger.info('[mealScheduleActivation] disabled stale enabled schedule', {
      trigger,
      today: todayStr,
      previous_enabled_id: currentEnabled.id,
    });
    return {
      ok: true,
      changed: true,
      today: todayStr,
      trigger,
      active_schedule_id: null,
    };
  }

  const currentlyEnabledIds = (schedules || [])
    .filter((s) => s.is_enabled)
    .map((s) => s.id);
  const staleEnabledIds = currentlyEnabledIds.filter((id) => !keepEnabledIds.has(id));
  if (staleEnabledIds.length > 0) {
    const disableRes = await supabaseAdmin
      .from('meal_schedules')
      .update({ is_enabled: false })
      .in('id', staleEnabledIds);
    if (disableRes.error) throw disableRes.error;
  }

  const nowIso = new Date().toISOString();
  const idsToEnable = [...keepEnabledIds].filter((id) => !currentlyEnabledIds.includes(id));
  for (const id of idsToEnable) {
    const enableRes = await supabaseAdmin
      .from('meal_schedules')
      .update({
        is_enabled: true,
        enabled_at: nowIso,
        enabled_by: actorId || null,
      })
      .eq('id', id);
    if (enableRes.error) throw enableRes.error;
  }

  if (staleEnabledIds.length === 0 && idsToEnable.length === 0) {
    return {
      ok: true,
      changed: false,
      today: todayStr,
      trigger,
      active_schedule_id: target.id,
      active_schedule_name: target.schedule_name,
      preactivated_schedule_id: keepEnabledIds.has(nextCandidate?.id) ? nextCandidate?.id || null : null,
    };
  }

  logger.info('[mealScheduleActivation] switched active schedule', {
    trigger,
    today: todayStr,
    previous_enabled_id: currentEnabled?.id || null,
    next_enabled_id: target.id,
    next_enabled_name: target.schedule_name,
    pre_activate_window: preActivateWindow,
    preactivated_schedule_id: keepEnabledIds.has(nextCandidate?.id) ? nextCandidate?.id || null : null,
  });

  return {
    ok: true,
    changed: true,
    today: todayStr,
    trigger,
    previous_enabled_id: currentEnabled?.id || null,
    active_schedule_id: target.id,
    active_schedule_name: target.schedule_name,
    preactivated_schedule_id: keepEnabledIds.has(nextCandidate?.id) ? nextCandidate?.id || null : null,
  };
}

module.exports = {
  syncMealScheduleActivation,
};
