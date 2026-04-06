const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBoolean, detectRuntimeMode, getRuntimePolicy } = require('../config/runtimeMode');

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

test('parseBoolean should respect explicit values and fallback', () => {
  assert.equal(parseBoolean('true', false), true);
  assert.equal(parseBoolean('FALSE', true), false);
  assert.equal(parseBoolean(undefined, true), true);
  assert.equal(parseBoolean('unknown', false), false);
});

test('detectRuntimeMode should use explicit APP_RUNTIME_MODE first', () => {
  const backupAppRuntimeMode = process.env.APP_RUNTIME_MODE;
  const backupNodeEnv = process.env.NODE_ENV;

  process.env.APP_RUNTIME_MODE = 'production_strict';
  process.env.NODE_ENV = 'development';
  assert.equal(detectRuntimeMode(), 'production_strict');

  process.env.APP_RUNTIME_MODE = '';
  process.env.NODE_ENV = 'production';
  assert.equal(detectRuntimeMode(), 'production_strict');

  process.env.NODE_ENV = 'development';
  assert.equal(detectRuntimeMode(), 'dev_simulation');

  restoreEnv('APP_RUNTIME_MODE', backupAppRuntimeMode);
  restoreEnv('NODE_ENV', backupNodeEnv);
});

test('getRuntimePolicy should default simulated flags by mode', () => {
  const backupAppRuntimeMode = process.env.APP_RUNTIME_MODE;
  const backupAllowPayment = process.env.ALLOW_SIMULATED_PAYMENT;
  const backupAllowDelivery = process.env.ALLOW_SIMULATED_DELIVERY;
  const backupAllowSms = process.env.ALLOW_SIMULATED_SMS;

  process.env.APP_RUNTIME_MODE = 'production_strict';
  delete process.env.ALLOW_SIMULATED_PAYMENT;
  delete process.env.ALLOW_SIMULATED_DELIVERY;
  delete process.env.ALLOW_SIMULATED_SMS;
  const strictPolicy = getRuntimePolicy();
  assert.equal(strictPolicy.strict, true);
  assert.equal(strictPolicy.allowSimulatedPayment, false);
  assert.equal(strictPolicy.allowSimulatedDelivery, false);
  assert.equal(strictPolicy.allowSimulatedSms, false);

  process.env.APP_RUNTIME_MODE = 'dev_simulation';
  const devPolicy = getRuntimePolicy();
  assert.equal(devPolicy.strict, false);
  assert.equal(devPolicy.allowSimulatedPayment, true);
  assert.equal(devPolicy.allowSimulatedDelivery, true);
  assert.equal(devPolicy.allowSimulatedSms, true);

  restoreEnv('APP_RUNTIME_MODE', backupAppRuntimeMode);
  restoreEnv('ALLOW_SIMULATED_PAYMENT', backupAllowPayment);
  restoreEnv('ALLOW_SIMULATED_DELIVERY', backupAllowDelivery);
  restoreEnv('ALLOW_SIMULATED_SMS', backupAllowSms);
});
