const axios = require('axios');
const { loadPrivateKeyPem, buildAuthorization } = require('../utils/wechatPayV3Sign');

const NATIVE_PATH = '/v3/pay/transactions/native';

function resolveWechatConfig(override = {}) {
  const appid = String(
    override.wechat_app_id || process.env.WECHAT_PAY_APP_ID || ''
  ).trim();
  const mchid = String(
    override.wechat_mch_id || process.env.WECHAT_PAY_MCH_ID || ''
  ).trim();
  const serialNo = String(
    override.wechat_serial_no
    || process.env.WECHAT_PAY_MCH_CERT_SERIAL
    || process.env.WECHAT_PAY_SERIAL_NO
    || ''
  ).trim();
  const notifyUrl = String(
    override.wechat_notify_url
    || override.notify_url
    || process.env.WECHAT_PAY_NOTIFY_URL
    || ''
  ).trim();
  const apiBase = String(
    override.api_base || process.env.WECHAT_PAY_API_BASE || 'https://api.mch.weixin.qq.com'
  ).trim().replace(/\/$/, '');
  const privateKeyPem = loadPrivateKeyPem();
  return { appid, mchid, serialNo, notifyUrl, apiBase, privateKeyPem };
}

function missingWechatFields(cfg) {
  const missing = [];
  if (!cfg.appid) missing.push('WECHAT_PAY_APP_ID');
  if (!cfg.mchid) missing.push('WECHAT_PAY_MCH_ID');
  if (!cfg.serialNo) missing.push('WECHAT_PAY_MCH_CERT_SERIAL');
  if (!cfg.privateKeyPem) missing.push('WECHAT_PAY_PRIVATE_KEY(_PATH)');
  if (!cfg.notifyUrl) missing.push('WECHAT_PAY_NOTIFY_URL');
  return missing;
}

/** amount：元（小数）或 payload.amount_cents（分，整数） */
function resolveAmountFen(payload) {
  if (payload.amount_cents != null && payload.amount_cents !== '') {
    const n = Number(payload.amount_cents);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  const yuan = Number(payload.amount);
  if (!Number.isFinite(yuan) || yuan <= 0) return null;
  return Math.round(yuan * 100);
}

/**
 * Native 下单，返回 code_url 等
 * @param {object} payload 来自业务 / 集成测试：order_number, amount|amount_cents, description?, notify_url?
 */
async function createNativeOrder(payload, override = {}) {
  const cfg = resolveWechatConfig(override);
  const missing = missingWechatFields(cfg);
  if (missing.length) {
    return {
      ok: false,
      provider: 'wechat_pay',
      message: `WeChat Pay config incomplete: ${missing.join(', ')}`,
      status: 0,
    };
  }

  const outTradeNo = String(payload.order_number || payload.out_trade_no || '').trim();
  if (!outTradeNo || outTradeNo.length > 32) {
    return {
      ok: false,
      provider: 'wechat_pay',
      message: 'order_number (out_trade_no) required, max 32 chars',
      status: 0,
    };
  }

  const totalFen = resolveAmountFen(payload);
  if (!totalFen) {
    return {
      ok: false,
      provider: 'wechat_pay',
      message: 'amount (yuan) or amount_cents (fen) required and must be > 0',
      status: 0,
    };
  }

  const description = String(
    payload.description || payload.body || '订单支付'
  ).trim().slice(0, 127);

  const bodyObj = {
    appid: cfg.appid,
    mchid: cfg.mchid,
    description,
    out_trade_no: outTradeNo,
    notify_url: String(payload.notify_url || cfg.notifyUrl).trim(),
    amount: { total: totalFen, currency: 'CNY' },
  };

  const bodyStr = JSON.stringify(bodyObj);
  const auth = buildAuthorization({
    mchid: cfg.mchid,
    serialNo: cfg.serialNo,
    method: 'POST',
    urlPath: NATIVE_PATH,
    body: bodyStr,
    privateKeyPem: cfg.privateKeyPem,
  });

  try {
    const url = `${cfg.apiBase}${NATIVE_PATH}`;
    const resp = await axios.post(url, bodyStr, {
      timeout: Number(process.env.WECHAT_PAY_TIMEOUT_MS || 15000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: auth,
        'User-Agent': 'health-app-backend-wechat-pay',
      },
      validateStatus: () => true,
    });

    const data = resp.data || {};
    if (resp.status >= 200 && resp.status < 300 && data.code_url) {
      return {
        ok: true,
        provider: 'wechat_pay',
        message: 'WeChat Native order created',
        status: resp.status,
        data: {
          code_url: data.code_url,
          prepay_id: data.prepay_id || null,
          out_trade_no: outTradeNo,
        },
      };
    }

    return {
      ok: false,
      provider: 'wechat_pay',
      message: data.message || `WeChat API error HTTP ${resp.status}`,
      status: resp.status,
      data,
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'wechat_pay',
      message: e?.message || 'WeChat Pay request failed',
      status: e?.response?.status || 0,
      data: e?.response?.data || {},
    };
  }
}

module.exports = {
  createNativeOrder,
  resolveWechatConfig,
  missingWechatFields,
};
