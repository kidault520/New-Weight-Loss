const axios = require('axios');
const { createShopOrder } = require('../adapters/sfCityOpenIcAdapter');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function normalizeDeliveryProvider(raw) {
  const p = String(raw || '').trim().toLowerCase();
  if (p === 'aggregator' || p === 'aggregate' || p === 'aggregation' || p === 'platform') {
    return 'webhook';
  }
  if (p === 'sf' || p === 'sf_openic' || p === 'shunfeng' || p === 'sf_express') return 'sf_city';
  return p;
}

function resolveProvider(override = {}) {
  const envProvider = normalizeDeliveryProvider(process.env.DELIVERY_PROVIDER);
  const cfgProvider = normalizeDeliveryProvider(override.provider);
  return cfgProvider || envProvider || 'mock';
}

function resolveCreateUrl(override = {}) {
  return String(
    override.create_webhook_url
    || process.env.DELIVERY_CREATE_WEBHOOK_URL
    || ''
  ).trim();
}

function resolveWebhookToken(override = {}) {
  return String(
    override.webhook_token
    || process.env.DELIVERY_WEBHOOK_TOKEN
    || ''
  ).trim();
}

async function createViaWebhook(payload, override = {}) {
  const url = resolveCreateUrl(override);
  if (!url) {
    return {
      ok: false,
      provider: 'webhook',
      message: 'DELIVERY_CREATE_WEBHOOK_URL is missing',
      status: 0,
    };
  }

  const token = resolveWebhookToken(override);
  const timeoutMs = Number(override.timeout_ms || process.env.DELIVERY_WEBHOOK_TIMEOUT_MS || 8000);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  try {
    const resp = await axios.post(url, payload, {
      timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
      headers,
    });
    return {
      ok: resp.status >= 200 && resp.status < 300,
      provider: 'webhook',
      message: resp.status >= 200 && resp.status < 300 ? 'Delivery create request sent' : `Unexpected status: ${resp.status}`,
      status: resp.status,
      data: resp.data || {},
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'webhook',
      message: e?.message || 'Delivery webhook create failed',
      status: e?.response?.status || 0,
      data: e?.response?.data || {},
    };
  }
}

async function createDeliveryOrder(payload, override = {}) {
  const provider = resolveProvider(override);

  if (provider === 'webhook') {
    return createViaWebhook(payload, override);
  }

  if (provider === 'sf_city') {
    return createShopOrder(payload, override);
  }

  if (provider === 'mock') {
    if (IS_PRODUCTION) {
      return {
        ok: false,
        provider: 'mock',
        message: 'DELIVERY_PROVIDER=mock is not allowed in production',
        status: 0,
      };
    }
    return {
      ok: true,
      provider: 'mock',
      message: 'Mock delivery order created',
      status: 200,
      data: {
        delivery_id: `mock-delivery-${Date.now()}`,
        external_order_id: payload?.external_order_id || payload?.order_number || '',
      },
    };
  }

  return {
    ok: false,
    provider,
    message: `Unsupported delivery provider: ${provider}`,
    status: 0,
  };
}

module.exports = {
  createDeliveryOrder,
};
