import { supabase } from '../config/supabase';
import { sortServiceOrders } from '../utils/serviceOrderRank';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

interface OrderRow {
  id: string;
  order_status: OrderStatus;
  payment_status: string;
}

const ORDER_ERROR_MESSAGE_MAP: Record<string, string> = {
  ORDER_NOT_FOUND: '订单不存在或已被删除',
  ORDER_FORBIDDEN: '你无权操作此订单',
  ORDER_UNAUTHORIZED: '登录已过期，请重新登录',
  ORDER_NOT_PAID: '订单未支付，暂不能开启服务',
  ORDER_ALREADY_STARTED: '该订单已开启服务，无需重复操作',
  ORDER_NO_DELIVERY_PLAN: '请先完成配送计划配置后再开启服务',
  ORDER_STATE_CONFLICT: '订单状态已变化，请刷新后重试',
  ORDER_TERMINAL_LOCKED: '订单已终态，无法变更',
  SYSTEM_INTERNAL_ERROR: '系统繁忙，请稍后重试',
};

function createOrderApiError(code?: string, fallback?: string): Error {
  const err = new Error((code && ORDER_ERROR_MESSAGE_MAP[code]) || fallback || '订单状态更新失败');
  (err as Error & { code?: string }).code = code;
  return err;
}

function isTerminalStatus(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'cancelled';
}

export const orderService = {
  async getEligiblePaidOrders(userId: string, limit = 2): Promise<OrderRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_status, payment_status, payment_time, created_at')
      .eq('user_id', userId)
      .eq('payment_status', 'paid')
      .neq('order_status', 'cancelled')
      .neq('order_status', 'completed')
      .order('payment_time', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    const rows = (data || []) as OrderRow[];
    return sortServiceOrders(rows).slice(0, limit);
  },

  /**
   * 强制走后端 API，确保状态机、审计、错误码口径一致。
   */
  async promoteOrderToProcessing(userId: string, orderId: string): Promise<void> {
    const { data: targetOrder, error: targetOrderErr } = await supabase
      .from('orders')
      .select('id, order_status, payment_status')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle();

    if (targetOrderErr) throw targetOrderErr;
    if (!targetOrder?.id || targetOrder.payment_status !== 'paid') return;
    if (isTerminalStatus(targetOrder.order_status) || targetOrder.order_status === 'processing') return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw createOrderApiError('ORDER_UNAUTHORIZED');
    }

    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/start-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw createOrderApiError(data?.code, data?.message || data?.error || `请求失败 (${res.status})`);
    }
  },
};

