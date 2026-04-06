/**
 * 与迁移 20260402100000_enforce_ord_order_number.sql 一致：业务订单号 ORD + YYYYMMDD + 6 位数字。
 * 支付聚合 out_trade_no / 外部流水不得写入 orders.order_number（由 DB 触发器与 CHECK 保证）。
 */

const ORD_ORDER_NUMBER_RE = /^ORD[0-9]{14}$/;

function isCanonicalBusinessOrderNumber(value) {
  return typeof value === 'string' && ORD_ORDER_NUMBER_RE.test(value);
}

module.exports = {
  ORD_ORDER_NUMBER_RE,
  isCanonicalBusinessOrderNumber,
};
