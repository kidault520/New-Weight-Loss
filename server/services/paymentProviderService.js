const axios = require('axios');
const { createNativeOrder } = require('../adapters/wechatPayNativeAdapter');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function normalizePaymentProvider(raw) {
  const p = String(raw || '').trim().toLowerCase();
  if (p === 'aggregator' || p === 'aggregate' || p === 'aggregation' || p === 'platform') {
    return 'webhook';
  }
  if (p === 'wechat' || p === 'wxpay' || p === 'wx_pay') return 'wechat_pay';
  return p;
}

function resolveProvider(override = {}) {
  const envProvider = normalizePaymentProvider(process.env.PAYMENT_PROVIDER);
  const cfgProvider = normalizePaymentProvider(override.provider);
  return cfgProvider || envProvider || 'mock';
}

function resolveCreateUrl(override = {}) {
  return String(
    override.create_webhook_url
    || process.env.PAYMENT_CREATE_WEBHOOK_URL
    || ''
  ).trim();
}

function resolveWebhookToken(override = {}) {
  return String(
    override.webhook_token
    || process.env.PAYMENT_WEBHOOK_TOKEN
    || ''
  ).trim();
}

async function createViaWebhook(payload, override = {}) {
  const url = resolveCreateUrl(override);
  if (!url) {
    return {
      ok: false,
      provider: 'webhook',
      message: 'PAYMENT_CREATE_WEBHOOK_URL is missing',
      status: 0,
    };
  }

  const token = resolveWebhookToken(override);
  const timeoutMs = Number(override.timeout_ms || process.env.PAYMENT_WEBHOOK_TIMEOUT_MS || 8000);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  try {
    const resp = await axios.post(url, payload, {
      timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
      headers,
    });
    return {
      ok: resp.status >= 200 && resp.status < 300,
      provider: 'webhook',
      message: resp.status >= 200 && resp.status < 300 ? 'Payment create request sent' : `Unexpected status: ${resp.status}`,
      status: resp.status,
      data: resp.data || {},
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'webhook',
      message: e?.message || 'Payment webhook create failed',
      status: e?.response?.status || 0,
      data: e?.response?.data || {},
    };
  }
}

async function createPaymentOrder(payload, override = {}) {
  const provider = resolveProvider(override);

  if (provider === 'webhook') {
    return createViaWebhook(payload, override);
  }

  if (provider === 'wechat_pay') {
    return createNativeOrder(payload, override);
  }

  if (provider === 'mock') {
    if (IS_PRODUCTION) {
      return {
        ok: false,
        provider: 'mock',
        message: 'PAYMENT_PROVIDER=mock is not allowed in production',
        status: 0,
      };
    }
    return {
      ok: true,
      provider: 'mock',
      message: 'Mock payment order created',
      status: 200,
      data: {
        payment_id: `mock-pay-${Date.now()}`,
        /** 不在此返回外链，避免前端误开新窗口；聚合收银台由 C 端弹窗内嵌模拟 */
        embedded_mock: true,
      },
    };
  }

  return {
    ok: false,
    provider,
    message: `Unsupported payment provider: ${provider}`,
    status: 0,
  };
}

module.exports = {
  createPaymentOrder,
};
