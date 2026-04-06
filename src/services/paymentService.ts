import { supabase } from '../config/supabase';

export interface ConfirmPaymentResult {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  provider?: string;
  payment?: Record<string, unknown>;
}

// 开发走 Vite 代理的 /api；生产默认同源 /api，跨域时再设 VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const ORDER_ERROR_MESSAGE_MAP: Record<string, string> = {
  ORDER_NOT_FOUND: '订单不存在或已被删除',
  ORDER_FORBIDDEN: '你无权操作此订单',
  ORDER_UNAUTHORIZED: '登录已过期，请重新登录',
  PAYMENT_ALREADY_CONFIRMED: '该订单已支付，无需重复支付',
  PAYMENT_CREATE_FAILED: '创建支付单失败，请稍后重试',
  SYSTEM_INTERNAL_ERROR: '系统繁忙，请稍后重试',
};

function resolveOrderErrorMessage(code?: string, fallback?: string): string {
  if (code && ORDER_ERROR_MESSAGE_MAP[code]) return ORDER_ERROR_MESSAGE_MAP[code];
  return fallback || '支付失败，请重试';
}

/**
 * 创建支付单（主链路）
 */
export async function createPaymentOrder(orderId: string, preferredPaymentMethod?: string): Promise<ConfirmPaymentResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, code: 'ORDER_UNAUTHORIZED', error: '未登录，请先登录' };
    }

    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        preferred_payment_method: preferredPaymentMethod || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return {
        success: false,
        code: data?.code,
        error: resolveOrderErrorMessage(data?.code, data?.message || data?.error || `创建支付单失败 (${res.status})`),
      };
    }

    return {
      success: true,
      code: data?.code || 'OK',
      message: data?.message || '支付单创建成功',
      provider: data?.provider,
      payment: data?.payment,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建支付单失败，请重试';
    return {
      success: false,
      error: msg.includes('fetch') || msg.includes('Failed to fetch')
        ? '无法连接服务器，请确认后端已启动 (npm run server)'
        : msg,
    };
  }
}

/**
 * 仅调用后端「模拟/测试确认支付」（不再重复 create-payment，适用于已创建过支付单的流程）
 */
export async function confirmSimulatedPaymentOnly(orderId: string): Promise<ConfirmPaymentResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, code: 'ORDER_UNAUTHORIZED', error: '未登录，请先登录' };
    }

    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      return {
        success: false,
        code: data?.code,
        error: resolveOrderErrorMessage(data?.code, data?.message || data?.error || `支付失败 (${res.status})`),
      };
    }

    return {
      success: true,
      code: data?.code || 'OK',
      message: data?.message || '支付成功',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '支付失败，请重试';
    return {
      success: false,
      error: msg.includes('fetch') || msg.includes('Failed to fetch')
        ? '无法连接服务器，请确认后端已启动 (npm run server)'
        : msg,
    };
  }
}

export async function checkOrderPaymentStatus(orderId: string): Promise<{
  success: boolean;
  paid: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return { success: false, paid: false, error: '未登录，请先登录' };
    }
    const { data, error } = await supabase
      .from('orders')
      .select('payment_status')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) {
      return { success: false, paid: false, error: '订单不存在或无权限访问' };
    }
    const status = String(data.payment_status || '').toLowerCase();
    return {
      success: true,
      paid: status === 'paid',
      status,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查询支付状态失败';
    return { success: false, paid: false, error: msg };
  }
}

/**
 * 确认支付（优先走后端 API，开发/测试环境直接连通后台）
 * 说明：由后端按“模拟支付”方式确认，避免前端直写订单状态。
 */
export async function confirmPayment(orderId: string): Promise<ConfirmPaymentResult> {
  try {
    const createResp = await createPaymentOrder(orderId);
    if (!createResp.success) {
      return createResp;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, code: 'ORDER_UNAUTHORIZED', error: '未登录，请先登录' };
    }

    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.warn('[paymentService] confirmPayment failed', {
        status: res.status,
        orderId,
        body: data,
      });
      return {
        success: false,
        code: data?.code,
        error: resolveOrderErrorMessage(data?.code, data?.message || data?.error || `支付失败 (${res.status})`),
      };
    }

    if (!data?.success) {
      return {
        success: false,
        code: data?.code,
        error: resolveOrderErrorMessage(data?.code, data?.message || data?.error),
      };
    }

    return {
      success: true,
      code: data?.code || 'OK',
      message: data?.message || '支付成功',
    };
  } catch (e) {
    console.error('[paymentService] confirmPayment exception:', e);
    const msg = e instanceof Error ? e.message : '支付失败，请重试';
    return {
      success: false,
      error: msg.includes('fetch') || msg.includes('Failed to fetch')
        ? '无法连接服务器，请确认后端已启动 (npm run server)'
        : msg,
    };
  }
}
