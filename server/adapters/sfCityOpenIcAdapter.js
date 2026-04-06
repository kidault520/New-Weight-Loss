const crypto = require('crypto');
const axios = require('axios');

/**
 * 顺丰同城开放平台（与常见 PHP SDK 一致）
 * POST {host}/open/api/external/{method}
 * Query: sign = base64( md5_binary( jsonBody + "&" + dev_id + "&" + dev_key ) )
 * Body: JSON 业务参数（含 dev_id、push_time）
 */

function resolveSfConfig(override = {}) {
  const host = String(
    override.sf_host || process.env.SF_OPENIC_HOST || 'https://openic.sf-express.com'
  ).trim().replace(/\/$/, '');
  const devId = String(override.sf_dev_id || process.env.SF_OPENIC_DEV_ID || '').trim();
  const devKey = String(process.env.SF_OPENIC_DEV_KEY || '').trim();
  const shopId = String(override.sf_shop_id || process.env.SF_OPENIC_SHOP_ID || '').trim();
  return { host, devId, devKey, shopId };
}

/** 与常见「参数排序后 JSON」验签习惯对齐，减少与 PHP json_encode 顺序差异 */
function sortKeysDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const sorted = {};
  Object.keys(value)
    .sort()
    .forEach((k) => {
      sorted[k] = sortKeysDeep(value[k]);
    });
  return sorted;
}

function signPayload(jsonBody, devId, devKey) {
  const signChar = `${jsonBody}&${devId}&${devKey}`;
  const md5bin = crypto.createHash('md5').update(signChar, 'utf8').digest();
  return md5bin.toString('base64');
}

function defaultShopCreateBody(payload, shopId) {
  const shopOrderId = String(payload.external_order_id || payload.shop_order_id || '').trim();
  const now = Math.floor(Date.now() / 1000);
  const receive = payload.receive && typeof payload.receive === 'object'
    ? payload.receive
    : {
      user_name: String(payload.user_name || '测').slice(0, 64),
      user_phone: String(payload.user_phone || '13800138000'),
      user_address: String(payload.user_address || '北京市朝阳区测试路1号'),
      user_lng: String(payload.user_lng || '116.397128'),
      user_lat: String(payload.user_lat || '39.916527'),
    };

  const totalPrice = Number(payload.total_price ?? payload.amount ?? 1);
  const orderDetail = payload.order_detail && typeof payload.order_detail === 'object'
    ? payload.order_detail
    : {
      total_price: Number.isFinite(totalPrice) && totalPrice > 0 ? totalPrice : 1,
      product_type: Number(payload.product_type || 1),
      weight_gram: Number(payload.weight_gram || 100),
      product_num: Number(payload.product_num || 1),
      product_type_num: Number(payload.product_type_num || 1),
      product_detail: Array.isArray(payload.product_detail)
        ? payload.product_detail
        : [{ product_name: String(payload.product_name || '餐品'), product_num: 1 }],
    };

  return {
    shop_order_id: shopOrderId,
    order_source: String(payload.order_source || 'health_app'),
    pay_type: Number(payload.pay_type ?? 1),
    order_time: Number(payload.order_time || now),
    is_appoint: Number(payload.is_appoint ?? 0),
    is_insured: Number(payload.is_insured ?? 0),
    is_person_direct: Number(payload.is_person_direct ?? 0),
    version: Number(payload.version ?? 17),
    order_sequence: String(payload.order_sequence || `seq-${now}`),
    remark: String(payload.remark || ''),
    receive,
    order_detail: orderDetail,
  };
}

/**
 * @param {string} method 如 createOrder -> URL 段 createorder
 */
async function callExternalMethod(method, businessBody, override = {}) {
  const { host, devId, devKey } = resolveSfConfig(override);
  if (!devId || !devKey) {
    return {
      ok: false,
      provider: 'sf_city',
      message: 'SF_OPENIC_DEV_ID / SF_OPENIC_DEV_KEY required',
      status: 0,
    };
  }

  const pathMethod = String(method || 'createOrder').replace(/([A-Z])/g, (m) => m.toLowerCase());
  const urlPath = `/open/api/external/${pathMethod}`;
  const url = `${host}${urlPath}`;

  const bodyObj = sortKeysDeep({
    ...businessBody,
    dev_id: devId,
    push_time: Math.floor(Date.now() / 1000),
  });

  const jsonBody = JSON.stringify(bodyObj);
  const sign = signPayload(jsonBody, devId, devKey);

  try {
    const resp = await axios.post(url, bodyObj, {
      params: { sign },
      timeout: Number(process.env.SF_OPENIC_TIMEOUT_MS || 15000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      validateStatus: () => true,
    });

    const data = resp.data || {};
    const errCode = data.error_code ?? data.err_code ?? data.code;
    const okHttp = resp.status >= 200 && resp.status < 300;
    const okBiz = errCode === 0 || errCode === '0' || data.success === true;

    if (okHttp && okBiz) {
      return {
        ok: true,
        provider: 'sf_city',
        message: 'SF City API call succeeded',
        status: resp.status,
        data,
      };
    }

    return {
      ok: false,
      provider: 'sf_city',
      message: data.error_msg || data.err_msg || data.message || `SF API HTTP ${resp.status}`,
      status: resp.status,
      data,
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'sf_city',
      message: e?.message || 'SF City request failed',
      status: e?.response?.status || 0,
      data: e?.response?.data || {},
    };
  }
}

/**
 * 店铺版创建订单（createOrder）
 */
async function createShopOrder(payload, override = {}) {
  const { shopId } = resolveSfConfig(override);
  if (!shopId && !(payload.shop_id != null && String(payload.shop_id).trim())) {
    return {
      ok: false,
      provider: 'sf_city',
      message: 'SF_OPENIC_SHOP_ID or payload.shop_id required for shop createOrder',
      status: 0,
    };
  }
  const sid = String(payload.shop_id != null ? payload.shop_id : shopId).trim();
  const business = defaultShopCreateBody(payload, sid);
  business.shop_id = Number(sid);
  return callExternalMethod('createOrder', business, override);
}

module.exports = {
  callExternalMethod,
  createShopOrder,
  resolveSfConfig,
  signPayload,
};
