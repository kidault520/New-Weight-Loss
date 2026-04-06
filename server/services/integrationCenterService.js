const { supabaseAdmin } = require('../config/supabase');
const { sendVerificationCode } = require('./smsService');
const { createPaymentOrder } = require('./paymentProviderService');
const { createDeliveryOrder } = require('./deliveryProviderService');
const { resolveWechatConfig, missingWechatFields } = require('../adapters/wechatPayNativeAdapter');

const INTEGRATION_ITEMS = [
  {
    id: 'sms',
    name: '短信服务',
    category: 'auth',
    description: '验证码发送与登录链路',
    requiredEnv: ['SMS_PROVIDER'],
    optionalEnv: ['SMS_WEBHOOK_URL', 'SMS_WEBHOOK_TOKEN'],
  },
  {
    id: 'payment',
    name: '支付服务',
    category: 'commerce',
    description:
      '生产推荐：支付聚合平台（PAYMENT_PROVIDER=webhook|aggregator + 创建支付 URL）；回调走统一令牌接口。微信等直连仅作备选联调。',
    requiredEnv: ['PAYMENT_CALLBACK_TOKEN'],
    optionalEnv: [
      'PAYMENT_PROVIDER',
      'PAYMENT_MERCHANT_ID',
      'PAYMENT_CREATE_WEBHOOK_URL',
      'PAYMENT_WEBHOOK_TOKEN',
      'WECHAT_PAY_APP_ID',
      'WECHAT_PAY_MCH_ID',
      'WECHAT_PAY_MCH_CERT_SERIAL',
      'WECHAT_PAY_NOTIFY_URL',
      'WECHAT_PAY_PRIVATE_KEY_PATH',
    ],
  },
  {
    id: 'delivery',
    name: '配送服务',
    category: 'logistics',
    description:
      '生产推荐：同城配送聚合平台（DELIVERY_PROVIDER=webhook|aggregator + 下发运力 URL）；回调走统一令牌接口。顺丰等直连仅作备选联调。',
    requiredEnv: ['DELIVERY_CALLBACK_TOKEN'],
    optionalEnv: [
      'DELIVERY_PROVIDER',
      'DELIVERY_CREATE_WEBHOOK_URL',
      'DELIVERY_WEBHOOK_TOKEN',
      'SF_OPENIC_HOST',
      'SF_OPENIC_DEV_ID',
      'SF_OPENIC_DEV_KEY',
      'SF_OPENIC_SHOP_ID',
    ],
  },
  {
    id: 'wechat_auth',
    name: '微信登录',
    category: 'auth',
    description: '微信 OAuth 登录与账号绑定',
    requiredEnv: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'],
    optionalEnv: ['WECHAT_REDIRECT_URI'],
  },
  {
    id: 'device_sync',
    name: '设备同步',
    category: 'iot',
    description: '穿戴设备数据接入',
    requiredEnv: ['DEVICE_SYNC_PROVIDER'],
    optionalEnv: ['DEVICE_SYNC_API_KEY', 'DEVICE_SYNC_WEBHOOK_URL'],
  },
];

const CONFIG_KEY_PREFIX = 'integration.config.';
const METRIC_KEY_PREFIX = 'integration.metrics.';

const CONFIG_SCHEMAS = {
  sms: ['enabled', 'provider', 'webhook_url', 'timeout_ms'],
  payment: [
    'enabled',
    'provider',
    'merchant_id',
    'callback_path',
    'create_webhook_url',
    'timeout_ms',
    'wechat_app_id',
    'wechat_mch_id',
    'wechat_serial_no',
    'wechat_notify_url',
  ],
  delivery: [
    'enabled',
    'provider',
    'callback_path',
    'create_webhook_url',
    'timeout_ms',
    'sf_shop_id',
    'sf_host',
  ],
  wechat_auth: ['enabled', 'app_id', 'redirect_uri'],
  device_sync: ['enabled', 'provider', 'webhook_url'],
};

function isConfigured(key) {
  return String(process.env[key] || '').trim() !== '';
}

function maskEnvValue(raw) {
  const value = String(raw || '');
  if (!value) return '';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function buildEnvStatus(keys) {
  return keys.map((key) => ({
    key,
    configured: isConfigured(key),
    valueMasked: maskEnvValue(process.env[key]),
  }));
}

function bool(v) {
  return String(v || '').toLowerCase() === 'true';
}

function nowIso() {
  return new Date().toISOString();
}

function internalApiBase() {
  const explicit = String(process.env.INTERNAL_API_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = String(process.env.PORT || '3001');
  return `http://127.0.0.1:${port}/api`;
}

async function postInternalApi(path, headers, body) {
  const url = `${internalApiBase()}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body || {}),
  });

  let payload = {};
  try {
    payload = await resp.json();
  } catch {
    payload = {};
  }
  return { ok: resp.ok, status: resp.status, payload };
}

function configKey(id) {
  return `${CONFIG_KEY_PREFIX}${id}`;
}

function metricKey(id) {
  return `${METRIC_KEY_PREFIX}${id}`;
}

function safeObject(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function normalizePaymentProviderId(raw) {
  const p = String(raw || 'mock').trim().toLowerCase();
  if (p === 'aggregator' || p === 'aggregate' || p === 'aggregation' || p === 'platform') {
    return 'webhook';
  }
  if (p === 'wechat' || p === 'wxpay' || p === 'wx_pay') return 'wechat_pay';
  return p;
}

function normalizeDeliveryProviderId(raw) {
  const p = String(raw || 'mock').trim().toLowerCase();
  if (p === 'aggregator' || p === 'aggregate' || p === 'aggregation' || p === 'platform') {
    return 'webhook';
  }
  if (p === 'sf' || p === 'sf_openic' || p === 'shunfeng' || p === 'sf_express') return 'sf_city';
  return p;
}

function getConfigValue(envKey, override, overrideKey) {
  const envRaw = String(process.env[envKey] || '').trim();
  if (envRaw) return envRaw;
  const overrideRaw = String(safeObject(override)[overrideKey] || '').trim();
  return overrideRaw;
}

async function loadConfigMapByKeys(keys) {
  const { data, error } = await supabaseAdmin
    .from('system_config')
    .select('config_key, config_value')
    .in('config_key', keys);
  if (error) throw error;

  const map = new Map();
  (data || []).forEach((row) => map.set(row.config_key, safeObject(row.config_value)));
  return map;
}

async function loadOverrides(ids) {
  if (!ids.length) return new Map();
  const keys = ids.map(configKey);
  return loadConfigMapByKeys(keys);
}

async function loadMetrics(ids) {
  if (!ids.length) return new Map();
  const keys = ids.map(metricKey);
  return loadConfigMapByKeys(keys);
}

function sanitizeConfig(id, patch) {
  const schema = CONFIG_SCHEMAS[id] || [];
  const input = safeObject(patch);
  const out = {};
  schema.forEach((key) => {
    if (key in input) out[key] = input[key];
  });
  return out;
}

async function saveConfig(id, patch, adminId) {
  const allowed = sanitizeConfig(id, patch);
  const key = configKey(id);
  const { data: existing, error: getError } = await supabaseAdmin
    .from('system_config')
    .select('config_value')
    .eq('config_key', key)
    .maybeSingle();
  if (getError && getError.code !== 'PGRST116') throw getError;

  const merged = {
    ...safeObject(existing?.config_value),
    ...allowed,
  };

  const { error: upsertError } = await supabaseAdmin
    .from('system_config')
    .upsert({
      config_key: key,
      config_value: merged,
      description: `Integration custom config for ${id}`,
      updated_by: adminId || null,
      updated_at: nowIso(),
    });
  if (upsertError) throw upsertError;
  return merged;
}

function defaultMetric() {
  return {
    checksTotal: 0,
    checksFailed: 0,
    testsTotal: 0,
    testsFailed: 0,
    lastCheckAt: null,
    lastCheckOk: null,
    lastCheckMessage: '',
    lastTestAt: null,
    lastTestOk: null,
    lastTestMessage: '',
    lastErrorAt: null,
    lastErrorMessage: '',
    updatedAt: nowIso(),
  };
}

async function writeMetric(id, updater, adminId) {
  const key = metricKey(id);
  const { data: existing, error: getError } = await supabaseAdmin
    .from('system_config')
    .select('config_value')
    .eq('config_key', key)
    .maybeSingle();
  if (getError && getError.code !== 'PGRST116') throw getError;

  const next = updater({ ...defaultMetric(), ...safeObject(existing?.config_value) });
  next.updatedAt = nowIso();

  const { error: upsertError } = await supabaseAdmin
    .from('system_config')
    .upsert({
      config_key: key,
      config_value: next,
      description: `Integration runtime metrics for ${id}`,
      updated_by: adminId || null,
      updated_at: nowIso(),
    });
  if (upsertError) throw upsertError;
  return next;
}

function classifyState(ok, partial) {
  if (ok) return 'ready';
  if (partial) return 'partial';
  return 'planned';
}

function evaluateSms(override) {
  const provider = String(getConfigValue('SMS_PROVIDER', override, 'provider') || 'mock').toLowerCase();
  const webhookUrl = getConfigValue('SMS_WEBHOOK_URL', override, 'webhook_url');
  const isProd = process.env.NODE_ENV === 'production';

  if (provider === 'webhook' && webhookUrl) {
    return {
      ok: true,
      partial: false,
      message: '已配置 webhook 通道',
      backendPrepared: true,
      missing: [],
    };
  }

  if (provider === 'mock') {
    return {
      ok: false,
      partial: !isProd,
      message: isProd ? '生产环境不允许 mock 短信通道' : '当前为 mock 通道（仅开发可用）',
      backendPrepared: true,
      missing: ['SMS_WEBHOOK_URL'],
    };
  }

  return {
    ok: false,
    partial: false,
    message: '短信通道配置不完整',
    backendPrepared: true,
    missing: ['SMS_PROVIDER', 'SMS_WEBHOOK_URL'],
  };
}

function evaluatePayment(override) {
  const hasCallbackToken = isConfigured('PAYMENT_CALLBACK_TOKEN');
  const providerRaw = getConfigValue('PAYMENT_PROVIDER', override, 'provider') || process.env.PAYMENT_PROVIDER || 'mock';
  const provider = normalizePaymentProviderId(providerRaw);

  let hasCreate = false;
  const missingCreate = [];

  if (provider === 'webhook') {
    const url = getConfigValue('PAYMENT_CREATE_WEBHOOK_URL', override, 'create_webhook_url');
    hasCreate = Boolean(url);
    if (!hasCreate) missingCreate.push('PAYMENT_CREATE_WEBHOOK_URL');
  } else if (provider === 'mock') {
    hasCreate = process.env.NODE_ENV !== 'production';
    if (!hasCreate) missingCreate.push('PAYMENT_PROVIDER(生产请改为 webhook/aggregator 聚合，或 wechat_pay 备选)');
  } else if (provider === 'wechat_pay') {
    missingCreate.push(...missingWechatFields(resolveWechatConfig(override)));
    hasCreate = missingCreate.length === 0;
  } else {
    hasCreate = false;
    missingCreate.push('PAYMENT_PROVIDER(支持 mock|webhook|aggregator|wechat_pay 备选)');
  }

  let message = '';
  if (hasCallbackToken && hasCreate) {
    if (provider === 'wechat_pay') message = '微信支付 Native 与回调令牌已就绪（直连备选）';
    else if (provider === 'webhook') message = '支付聚合(webhook)与回调令牌已就绪';
    else message = '支付 mock 与回调令牌已就绪（仅非生产）';
  } else if (hasCallbackToken) {
    message = '支付回调已具备，主动下单通道未配置完整';
  } else if (hasCreate) {
    message = '支付主动通道已具备，回调令牌未配置';
  } else {
    message = '缺少支付回调令牌与主动下单通道';
  }

  return {
    ok: hasCallbackToken && hasCreate,
    partial: hasCallbackToken || hasCreate,
    message,
    backendPrepared: true,
    missing: [
      ...(hasCallbackToken ? [] : ['PAYMENT_CALLBACK_TOKEN']),
      ...(hasCreate ? [] : missingCreate),
    ],
  };
}

function evaluateDelivery(override) {
  const hasToken = isConfigured('DELIVERY_CALLBACK_TOKEN');
  const providerRaw = getConfigValue('DELIVERY_PROVIDER', override, 'provider') || process.env.DELIVERY_PROVIDER || 'mock';
  const provider = normalizeDeliveryProviderId(providerRaw);
  const ov = safeObject(override);

  let hasCreate = false;
  const missingCreate = [];

  if (provider === 'webhook') {
    const url = getConfigValue('DELIVERY_CREATE_WEBHOOK_URL', override, 'create_webhook_url');
    hasCreate = Boolean(url);
    if (!hasCreate) missingCreate.push('DELIVERY_CREATE_WEBHOOK_URL');
  } else if (provider === 'mock') {
    hasCreate = process.env.NODE_ENV !== 'production';
    if (!hasCreate) missingCreate.push('DELIVERY_PROVIDER(生产请改为 webhook/aggregator 聚合，或 sf_city 备选)');
  } else if (provider === 'sf_city') {
    if (!isConfigured('SF_OPENIC_DEV_ID')) missingCreate.push('SF_OPENIC_DEV_ID');
    if (!isConfigured('SF_OPENIC_DEV_KEY')) missingCreate.push('SF_OPENIC_DEV_KEY');
    const shopOk = isConfigured('SF_OPENIC_SHOP_ID') || Boolean(String(ov.sf_shop_id || '').trim());
    if (!shopOk) missingCreate.push('SF_OPENIC_SHOP_ID(或后台配置 sf_shop_id)');
    hasCreate = missingCreate.length === 0;
  } else {
    hasCreate = false;
    missingCreate.push('DELIVERY_PROVIDER(支持 mock|webhook|aggregator|sf_city 备选)');
  }

  let message = '';
  if (hasToken && hasCreate) {
    if (provider === 'sf_city') message = '顺丰同城直连 createOrder 与回调令牌已就绪（备选）';
    else if (provider === 'webhook') message = '同城配送聚合(webhook)与回调令牌已就绪';
    else message = '配送 mock 与回调令牌已就绪（仅非生产）';
  } else if (hasToken) {
    message = '配送回调已具备，主动下发通道未配置完整';
  } else if (hasCreate) {
    message = '配送主动通道已具备，回调令牌未配置';
  } else {
    message = '缺少配送回调令牌与主动下发通道';
  }

  return {
    ok: hasToken && hasCreate,
    partial: hasToken || hasCreate,
    message,
    backendPrepared: true,
    missing: [
      ...(hasToken ? [] : ['DELIVERY_CALLBACK_TOKEN']),
      ...(hasCreate ? [] : missingCreate),
    ],
  };
}

function evaluateWeChatAuth(override) {
  const hasId = Boolean(getConfigValue('WECHAT_APP_ID', override, 'app_id'));
  const hasSecret = Boolean(getConfigValue('WECHAT_APP_SECRET', override, 'app_secret'));
  const configured = hasId && hasSecret;
  return {
    ok: false,
    partial: configured,
    message: configured
      ? '微信参数已配置，但登录流程仍未实现'
      : '微信登录参数未配置',
    backendPrepared: false,
    missing: configured ? [] : ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'],
  };
}

function evaluateDeviceSync(override) {
  const provider = String(getConfigValue('DEVICE_SYNC_PROVIDER', override, 'provider') || '').trim();
  if (!provider) {
    return {
      ok: false,
      partial: false,
      message: '设备同步 provider 未配置',
      backendPrepared: false,
      missing: ['DEVICE_SYNC_PROVIDER'],
    };
  }
  return {
    ok: false,
    partial: true,
    message: '设备 provider 已配置，设备 SDK/API 仍待接入',
    backendPrepared: false,
    missing: [],
  };
}

function evaluateById(id, override = {}) {
  switch (id) {
    case 'sms':
      return evaluateSms(override);
    case 'payment':
      return evaluatePayment(override);
    case 'delivery':
      return evaluateDelivery(override);
    case 'wechat_auth':
      return evaluateWeChatAuth(override);
    case 'device_sync':
      return evaluateDeviceSync(override);
    default:
      return {
        ok: false,
        partial: false,
        message: '未知集成项',
        backendPrepared: false,
        missing: [],
      };
  }
}

function buildIntegrationView(item, override, metric) {
  const evalResult = evaluateById(item.id, override);
  const runtime = { ...defaultMetric(), ...safeObject(metric) };
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    state: classifyState(evalResult.ok, evalResult.partial),
    backendPrepared: evalResult.backendPrepared,
    health: {
      ok: evalResult.ok,
      message: evalResult.message,
      checkedAt: new Date().toISOString(),
    },
    customConfig: safeObject(override),
    runtime,
    missing: evalResult.missing,
    config: {
      required: buildEnvStatus(item.requiredEnv || []),
      optional: buildEnvStatus(item.optionalEnv || []),
    },
  };
}

async function listIntegrations() {
  const ids = INTEGRATION_ITEMS.map((x) => x.id);
  const [overrideMap, metricMap] = await Promise.all([
    loadOverrides(ids),
    loadMetrics(ids),
  ]);
  return INTEGRATION_ITEMS.map((item) =>
    buildIntegrationView(item, overrideMap.get(configKey(item.id)), metricMap.get(metricKey(item.id)))
  );
}

async function getIntegrationById(id) {
  const item = INTEGRATION_ITEMS.find((x) => x.id === id);
  if (!item) return null;
  const [overrideMap, metricMap] = await Promise.all([
    loadOverrides([id]),
    loadMetrics([id]),
  ]);
  return buildIntegrationView(item, overrideMap.get(configKey(id)), metricMap.get(metricKey(id)));
}

async function runIntegrationHealthCheck(id, adminId) {
  const integration = await getIntegrationById(id);
  if (!integration) return null;

  const ok = integration.health.ok;
  const message = integration.health.message;

  const runtime = await writeMetric(id, (prev) => {
    const next = { ...prev };
    next.checksTotal += 1;
    next.lastCheckAt = nowIso();
    next.lastCheckOk = ok;
    next.lastCheckMessage = message;
    if (!ok) {
      next.checksFailed += 1;
      next.lastErrorAt = nowIso();
      next.lastErrorMessage = message;
    }
    return next;
  }, adminId);

  return {
    ok,
    message,
    runtime,
    checkedAt: nowIso(),
  };
}

async function runIntegrationTest(id, payload, adminId) {
  const body = safeObject(payload);
  let ok = false;
  let message = '未执行';
  let details = {};

  if (id === 'sms') {
    const provider = String(getConfigValue('SMS_PROVIDER', body.configOverride || {}, 'provider') || process.env.SMS_PROVIDER || 'mock').toLowerCase();
    const dryRun = body.dryRun !== false;
    if (dryRun) {
      ok = provider === 'webhook' || (provider === 'mock' && process.env.NODE_ENV !== 'production');
      message = ok ? '短信 dry-run 通过' : '短信 dry-run 失败：provider 不可用';
      details = { dryRun: true, provider };
    } else {
      const phone = String(body.phone || '').trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        ok = false;
        message = '短信测试失败：手机号格式不正确';
        details = { phone };
      } else {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const resp = await sendVerificationCode({
          phone,
          code,
          expiresInSeconds: 300,
        });
        ok = !!resp?.delivered;
        message = ok ? '短信测试发送成功' : `短信测试发送失败：${resp?.error || 'unknown'}`;
        details = { provider: resp?.provider, delivered: resp?.delivered, dryRun: false };
      }
    }
  } else if (id === 'payment') {
    if (body.mode === 'callback') {
      const callbackToken = String(process.env.PAYMENT_CALLBACK_TOKEN || '').trim();
      if (!callbackToken) {
        ok = false;
        message = '支付回调模拟失败：缺少 PAYMENT_CALLBACK_TOKEN';
        details = { mode: 'callback' };
      } else {
        const testPayload = safeObject(body.payload);
        const required = ['payment_event_id', 'external_order_id', 'payment_status'];
        const missing = required.filter((k) => !String(testPayload[k] || '').trim());
        if (missing.length > 0) {
          ok = false;
          message = `支付回调模拟失败：缺少字段 ${missing.join(', ')}`;
          details = { mode: 'callback', missing };
        } else {
          const resp = await postInternalApi(
            '/orders/payment/callback',
            { 'x-payment-callback-token': callbackToken },
            testPayload
          );
          ok = !!resp.ok && resp.payload?.success !== false;
          message = ok
            ? '支付回调模拟成功'
            : `支付回调模拟失败 (${resp.status})`;
          details = {
            mode: 'callback',
            status: resp.status,
            responseCode: resp.payload?.code || null,
            responseMessage: resp.payload?.message || resp.payload?.error || '',
          };
        }
      }
    } else if (body.mode === 'create') {
      const testPayload = safeObject(body.payload);
      const required = ['order_number', 'amount'];
      const missing = required.filter((k) => !String(testPayload[k] || '').trim());
      if (missing.length > 0) {
        ok = false;
        message = `支付主动下单测试失败：缺少字段 ${missing.join(', ')}`;
        details = { mode: 'create', missing };
      } else {
        const integration = await getIntegrationById(id);
        const override = safeObject(integration?.customConfig);
        const resp = await createPaymentOrder(testPayload, override);
        ok = !!resp.ok;
        message = ok ? '支付主动下单测试成功' : `支付主动下单测试失败：${resp.message || 'unknown'}`;
        details = {
          mode: 'create',
          provider: resp.provider,
          status: resp.status,
          response: resp.data || {},
        };
      }
    } else {
      const integration = await getIntegrationById(id);
      if (!integration) return null;
      ok = integration.health.ok;
      message = ok ? '支付配置检查通过' : `支付配置检查未通过：${integration.health.message}`;
      details = { mode: 'config-check' };
    }
  } else if (id === 'delivery') {
    if (body.mode === 'callback') {
      const callbackToken = String(process.env.DELIVERY_CALLBACK_TOKEN || '').trim();
      if (!callbackToken) {
        ok = false;
        message = '配送回调模拟失败：缺少 DELIVERY_CALLBACK_TOKEN';
        details = { mode: 'callback' };
      } else {
        const testPayload = safeObject(body.payload);
        const required = ['provider', 'external_order_id', 'status'];
        const missing = required.filter((k) => !String(testPayload[k] || '').trim());
        if (missing.length > 0) {
          ok = false;
          message = `配送回调模拟失败：缺少字段 ${missing.join(', ')}`;
          details = { mode: 'callback', missing };
        } else {
          const resp = await postInternalApi(
            '/delivery-callbacks/status',
            { 'x-delivery-callback-token': callbackToken },
            testPayload
          );
          ok = !!resp.ok && resp.payload?.success !== false;
          message = ok
            ? '配送回调模拟成功'
            : `配送回调模拟失败 (${resp.status})`;
          details = {
            mode: 'callback',
            status: resp.status,
            responseMessage: resp.payload?.message || resp.payload?.error || '',
          };
        }
      }
    } else if (body.mode === 'create') {
      const testPayload = safeObject(body.payload);
      const required = ['external_order_id'];
      const missing = required.filter((k) => !String(testPayload[k] || '').trim());
      if (missing.length > 0) {
        ok = false;
        message = `配送主动下发测试失败：缺少字段 ${missing.join(', ')}`;
        details = { mode: 'create', missing };
      } else {
        const integration = await getIntegrationById(id);
        const override = safeObject(integration?.customConfig);
        const resp = await createDeliveryOrder(testPayload, override);
        ok = !!resp.ok;
        message = ok ? '配送主动下发测试成功' : `配送主动下发测试失败：${resp.message || 'unknown'}`;
        details = {
          mode: 'create',
          provider: resp.provider,
          status: resp.status,
          response: resp.data || {},
        };
      }
    } else {
      const integration = await getIntegrationById(id);
      if (!integration) return null;
      ok = integration.health.ok;
      message = ok ? '配送配置检查通过' : `配送配置检查未通过：${integration.health.message}`;
      details = { mode: 'config-check' };
    }
  } else {
    const integration = await getIntegrationById(id);
    if (!integration) return null;
    ok = integration.health.ok;
    message = ok ? '接口测试通过（配置检查）' : `接口测试未通过：${integration.health.message}`;
    details = { mode: 'config-check' };
  }

  const runtime = await writeMetric(id, (prev) => {
    const next = { ...prev };
    next.testsTotal += 1;
    next.lastTestAt = nowIso();
    next.lastTestOk = ok;
    next.lastTestMessage = message;
    if (!ok) {
      next.testsFailed += 1;
      next.lastErrorAt = nowIso();
      next.lastErrorMessage = message;
    }
    return next;
  }, adminId);

  return { ok, message, details, runtime, testedAt: nowIso() };
}

async function updateIntegrationConfig(id, patch, adminId) {
  const item = INTEGRATION_ITEMS.find((x) => x.id === id);
  if (!item) return null;
  const saved = await saveConfig(id, patch, adminId);
  const refreshed = await getIntegrationById(id);
  return {
    saved,
    integration: refreshed,
  };
}

function summarize(list) {
  const total = list.length;
  const ready = list.filter((x) => x.state === 'ready').length;
  const partial = list.filter((x) => x.state === 'partial').length;
  const planned = list.filter((x) => x.state === 'planned').length;
  return { total, ready, partial, planned };
}

module.exports = {
  listIntegrations,
  getIntegrationById,
  summarize,
  runIntegrationHealthCheck,
  runIntegrationTest,
  updateIntegrationConfig,
};
