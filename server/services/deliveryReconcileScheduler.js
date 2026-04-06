const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

let reconcileTask = null;
let isReconciling = false;

function runReconcileApply() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/reconcile-delivery-status.js');
    const child = spawn(process.execPath, [scriptPath, '--apply'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (buf) => {
      stdout += String(buf || '');
    });
    child.stderr.on('data', (buf) => {
      stderr += String(buf || '');
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.info('[deliveryReconcileScheduler] reconcile apply success', { output: stdout.trim() });
        resolve(stdout.trim());
        return;
      }
      logger.error('[deliveryReconcileScheduler] reconcile apply failed', {
        code,
        stderr: stderr.trim(),
        stdout: stdout.trim(),
      });
      reject(new Error(`reconcile exit code: ${code}`));
    });
  });
}

function startDeliveryReconcileScheduler() {
  const enabled = String(process.env.DELIVERY_RECONCILE_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('[deliveryReconcileScheduler] disabled by env DELIVERY_RECONCILE_ENABLED=false');
    return;
  }

  const cronExpr = process.env.DELIVERY_RECONCILE_CRON || '*/10 * * * *'; // 默认每10分钟
  if (!cron.validate(cronExpr)) {
    logger.error('[deliveryReconcileScheduler] invalid cron expression', { cronExpr });
    return;
  }

  if (reconcileTask) {
    reconcileTask.stop();
    reconcileTask = null;
  }

  reconcileTask = cron.schedule(cronExpr, async () => {
    if (isReconciling) {
      logger.warn('[deliveryReconcileScheduler] previous reconcile still running, skip this tick');
      return;
    }
    isReconciling = true;
    try {
      await runReconcileApply();
    } catch (error) {
      logger.error('[deliveryReconcileScheduler] scheduled reconcile failed', error);
    } finally {
      isReconciling = false;
    }
  }, {
    timezone: process.env.TZ || 'Asia/Shanghai',
  });

  logger.info('[deliveryReconcileScheduler] started', { cronExpr, timezone: process.env.TZ || 'Asia/Shanghai' });
}

module.exports = {
  startDeliveryReconcileScheduler,
  runReconcileApply,
};
