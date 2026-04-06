/**
 * 多笔未终态已支付订单时，与后端 active-supplement-stage 一致的主订单选择：
 * processing > confirmed > pending > 其它，同档按支付时间倒序。
 */
export const SERVICE_ORDER_STATUS_RANK: Record<string, number> = {
  processing: 0,
  confirmed: 1,
  pending: 2,
};

export function sortServiceOrders<
  T extends { order_status?: string; payment_time?: string | null; created_at?: string },
>(rows: T[] | null | undefined): T[] {
  if (!rows?.length) return [];
  return [...rows].sort((a, b) => {
    const ra = SERVICE_ORDER_STATUS_RANK[a.order_status ?? ''] ?? 99;
    const rb = SERVICE_ORDER_STATUS_RANK[b.order_status ?? ''] ?? 99;
    if (ra !== rb) return ra - rb;
    const ta = new Date(a.payment_time || a.created_at || 0).getTime();
    const tb = new Date(b.payment_time || b.created_at || 0).getTime();
    return tb - ta;
  });
}

export function pickPrimaryServiceOrder<
  T extends { order_status?: string; payment_time?: string | null; created_at?: string },
>(rows: T[] | null | undefined): T | null {
  const sorted = sortServiceOrders(rows);
  return sorted[0] ?? null;
}
