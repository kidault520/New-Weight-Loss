/**
 * 三方配送状态 -> 系统内部 status 映射表
 * 内部状态：pending | scheduled | preparing | shipped | delivered | cancelled
 */

const INTERNAL_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  PREPARING: 'preparing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const DEFAULT_TEXT_MAP = {
  delivered: INTERNAL_STATUS.DELIVERED,
  completed: INTERNAL_STATUS.DELIVERED,
  finish: INTERNAL_STATUS.DELIVERED,
  done: INTERNAL_STATUS.DELIVERED,
  signed: INTERNAL_STATUS.DELIVERED,
  in_transit: INTERNAL_STATUS.SHIPPED,
  on_the_way: INTERNAL_STATUS.SHIPPED,
  shipping: INTERNAL_STATUS.SHIPPED,
  shipped: INTERNAL_STATUS.SHIPPED,
  preparing: INTERNAL_STATUS.PREPARING,
  ready: INTERNAL_STATUS.PREPARING,
  packing: INTERNAL_STATUS.PREPARING,
  scheduled: INTERNAL_STATUS.SCHEDULED,
  pending_dispatch: INTERNAL_STATUS.SCHEDULED,
  assigned: INTERNAL_STATUS.SCHEDULED,
  cancelled: INTERNAL_STATUS.CANCELLED,
  canceled: INTERNAL_STATUS.CANCELLED,
  failed: INTERNAL_STATUS.CANCELLED,
  rejected: INTERNAL_STATUS.CANCELLED,
  timeout: INTERNAL_STATUS.CANCELLED,
  pending: INTERNAL_STATUS.PENDING,
  created: INTERNAL_STATUS.PENDING,
};

const PROVIDER_RULES = {
  // 美团（示例）
  meituan: {
    byCode: {
      10: INTERNAL_STATUS.PENDING,   // 已创建
      20: INTERNAL_STATUS.SCHEDULED, // 已接单
      30: INTERNAL_STATUS.PREPARING, // 备餐中
      40: INTERNAL_STATUS.SHIPPED,   // 配送中
      50: INTERNAL_STATUS.DELIVERED, // 已送达
      60: INTERNAL_STATUS.CANCELLED, // 已取消
    },
    byText: {
      mt_created: INTERNAL_STATUS.PENDING,
      mt_accept: INTERNAL_STATUS.SCHEDULED,
      mt_preparing: INTERNAL_STATUS.PREPARING,
      mt_delivering: INTERNAL_STATUS.SHIPPED,
      mt_delivered: INTERNAL_STATUS.DELIVERED,
      mt_cancelled: INTERNAL_STATUS.CANCELLED,
    },
  },

  // 饿了么（示例）
  eleme: {
    byCode: {
      1: INTERNAL_STATUS.PENDING,
      2: INTERNAL_STATUS.SCHEDULED,
      3: INTERNAL_STATUS.PREPARING,
      4: INTERNAL_STATUS.SHIPPED,
      5: INTERNAL_STATUS.DELIVERED,
      9: INTERNAL_STATUS.CANCELLED,
    },
    byText: {
      waiting: INTERNAL_STATUS.PENDING,
      accepted: INTERNAL_STATUS.SCHEDULED,
      cooking: INTERNAL_STATUS.PREPARING,
      delivering: INTERNAL_STATUS.SHIPPED,
      success: INTERNAL_STATUS.DELIVERED,
      closed: INTERNAL_STATUS.CANCELLED,
    },
  },

  // 顺丰同城（示例）
  sf: {
    byCode: {
      100: INTERNAL_STATUS.PENDING,
      200: INTERNAL_STATUS.SCHEDULED,
      300: INTERNAL_STATUS.PREPARING,
      400: INTERNAL_STATUS.SHIPPED,
      500: INTERNAL_STATUS.DELIVERED,
      900: INTERNAL_STATUS.CANCELLED,
    },
    byText: {
      created: INTERNAL_STATUS.PENDING,
      accepted: INTERNAL_STATUS.SCHEDULED,
      picking: INTERNAL_STATUS.PREPARING,
      delivering: INTERNAL_STATUS.SHIPPED,
      delivered: INTERNAL_STATUS.DELIVERED,
      cancelled: INTERNAL_STATUS.CANCELLED,
    },
  },
};

const PROVIDER_ALIASES = {
  sf_city: 'sf',
  sf_openic: 'sf',
  sf_express: 'sf',
  shunfeng: 'sf',
};

const normalizeProvider = (provider) => {
  const normalized = String(provider || 'unknown').trim().toLowerCase();
  return PROVIDER_ALIASES[normalized] || normalized;
};
const normalizeText = (text) => String(text || '').trim().toLowerCase();

function resolveDeliveryStatus(input = {}) {
  const provider = normalizeProvider(input.provider);
  const rawText = normalizeText(input.status || input.delivery_status || input.event_type || '');
  const codeRaw = input.status_code ?? input.code;
  const code = Number.isFinite(Number(codeRaw)) ? Number(codeRaw) : null;
  const rule = PROVIDER_RULES[provider];

  if (rule && code !== null && Object.prototype.hasOwnProperty.call(rule.byCode, code)) {
    return { status: rule.byCode[code], provider, matchedBy: 'provider_code', code, rawText };
  }

  if (rule && rawText && Object.prototype.hasOwnProperty.call(rule.byText, rawText)) {
    return { status: rule.byText[rawText], provider, matchedBy: 'provider_text', code, rawText };
  }

  if (rawText && Object.prototype.hasOwnProperty.call(DEFAULT_TEXT_MAP, rawText)) {
    return { status: DEFAULT_TEXT_MAP[rawText], provider, matchedBy: 'default_text', code, rawText };
  }

  return { status: INTERNAL_STATUS.PENDING, provider, matchedBy: 'fallback_pending', code, rawText };
}

module.exports = {
  INTERNAL_STATUS,
  PROVIDER_RULES,
  resolveDeliveryStatus,
};
