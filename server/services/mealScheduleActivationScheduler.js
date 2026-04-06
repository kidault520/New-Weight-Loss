const cron = require('node-cron');
const logger = require('../utils/logger');
const { syncMealScheduleActivation } = require('./mealScheduleActivationService');

let activationTask = null;
let isRunning = false;

async function runActivationSync(trigger) {
  if (isRunning) return;
  isRunning = true;
  try {
    await syncMealScheduleActivation({ trigger });
  } catch (error) {
    logger.error('[mealScheduleActivationScheduler] sync failed', error);
  } finally {
    isRunning = false;
  }
}

function startMealScheduleActivationScheduler() {
  const enabled = String(process.env.MEAL_SCHEDULE_ACTIVATION_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('[mealScheduleActivationScheduler] disabled by env MEAL_SCHEDULE_ACTIVATION_ENABLED=false');
    return;
  }

  const cronExpr = process.env.MEAL_SCHEDULE_ACTIVATION_CRON || '*/5 * * * *';
  if (!cron.validate(cronExpr)) {
    logger.error('[mealScheduleActivationScheduler] invalid cron expression', { cronExpr });
    return;
  }

  if (activationTask) {
    activationTask.stop();
    activationTask = null;
  }

  activationTask = cron.schedule(cronExpr, async () => {
    if (isRunning) {
      logger.warn('[mealScheduleActivationScheduler] previous run still executing, skip this tick');
      return;
    }
    await runActivationSync('cron');
  }, {
    timezone: process.env.TZ || 'Asia/Shanghai',
  });

  // 启动时立即同步一次，避免首次定时触发前状态滞后。
  void runActivationSync('startup');

  logger.info('[mealScheduleActivationScheduler] started', {
    cronExpr,
    timezone: process.env.TZ || 'Asia/Shanghai',
  });
}

module.exports = {
  startMealScheduleActivationScheduler,
};
