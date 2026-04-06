const RUNTIME_MODES = {
  DEV_SIMULATION: 'dev_simulation',
  PRODUCTION_STRICT: 'production_strict',
};

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function detectRuntimeMode() {
  const explicit = String(process.env.APP_RUNTIME_MODE || '').trim().toLowerCase();
  if (explicit === RUNTIME_MODES.DEV_SIMULATION || explicit === RUNTIME_MODES.PRODUCTION_STRICT) {
    return explicit;
  }
  return process.env.NODE_ENV === 'production'
    ? RUNTIME_MODES.PRODUCTION_STRICT
    : RUNTIME_MODES.DEV_SIMULATION;
}

function getRuntimePolicy() {
  const mode = detectRuntimeMode();
  const strict = mode === RUNTIME_MODES.PRODUCTION_STRICT;

  return {
    mode,
    strict,
    allowSimulatedPayment: parseBoolean(
      process.env.ALLOW_SIMULATED_PAYMENT,
      !strict,
    ),
    allowSimulatedDelivery: parseBoolean(
      process.env.ALLOW_SIMULATED_DELIVERY,
      !strict,
    ),
    allowSimulatedSms: parseBoolean(
      process.env.ALLOW_SIMULATED_SMS,
      !strict,
    ),
  };
}

module.exports = {
  RUNTIME_MODES,
  parseBoolean,
  detectRuntimeMode,
  getRuntimePolicy,
};
