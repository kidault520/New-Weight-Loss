/**
 * useProfileBadges - 红点提醒机制
 * 订单待支付 → 我的订单 + 我的 有红点
 * 已支付但订单尚未进入服务中（需配置配送/在订单页开启服务）→ 我的配送计划 + 我的订单 + 我的 有红点
 * 用户点击查看后，红点不再展示（直至条件变化）
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from '../utils/userStorage';

const BADGE_DISMISSED_ORDERS = 'badge_dismissed_orders';
const BADGE_DISMISSED_DELIVERY_PLAN = 'badge_dismissed_delivery_plan';
const BADGE_DISMISSED_PROFILE = 'badge_dismissed_profile';

/** 用户查看后标记红点已读，不再展示 */
export async function dismissProfileBadge(type: 'orders' | 'delivery_plan' | 'profile'): Promise<void> {
  const key = type === 'orders' ? BADGE_DISMISSED_ORDERS
    : type === 'delivery_plan' ? BADGE_DISMISSED_DELIVERY_PLAN
    : BADGE_DISMISSED_PROFILE;
  await setUserStorageItem(key, 'true');
}

export interface ProfileBadges {
  /** 订单有红点：有待支付订单 */
  ordersBadge: boolean;
  /** 配送计划有红点：已支付但未开启服务（需配置配送计划） */
  deliveryPlanBadge: boolean;
  /** 我的入口有红点：订单或配送计划任一有红点 */
  profileBadge: boolean;
  /** 用户状态：用于 AI 推荐问题 */
  userActionState: 'pending_payment' | 'paid_need_config' | 'config_complete' | 'none';
  isLoading: boolean;
}

export function useProfileBadges(): ProfileBadges {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['profile-badges', userId],
    queryFn: async (): Promise<{
      ordersBadge: boolean;
      deliveryPlanBadge: boolean;
      profileBadge: boolean;
      userActionState: ProfileBadges['userActionState'];
    }> => {
      if (!userId) {
        return {
          ordersBadge: false,
          deliveryPlanBadge: false,
          profileBadge: false,
          userActionState: 'none',
        };
      }

      const [ordersRes, dismissedOrders, dismissedDelivery, dismissedProfile] = await Promise.all([
        supabase
          .from('orders')
          .select('id, payment_status, order_status')
          .eq('user_id', userId)
          .neq('order_status', 'cancelled')
          .order('created_at', { ascending: false }),
        getUserStorageItem<string>(BADGE_DISMISSED_ORDERS),
        getUserStorageItem<string>(BADGE_DISMISSED_DELIVERY_PLAN),
        getUserStorageItem<string>(BADGE_DISMISSED_PROFILE),
      ]);

      const { data: orders, error } = ordersRes;
      if (error) {
        console.warn('[useProfileBadges] Query error:', error);
        return {
          ordersBadge: false,
          deliveryPlanBadge: false,
          profileBadge: false,
          userActionState: 'none',
        };
      }

      let rawUnpaid = false;
      let rawPaidNeedService = false;

      for (const o of orders || []) {
        const unpaid = o.payment_status !== 'paid';
        const paidNeedService =
          o.payment_status === 'paid' &&
          o.order_status !== 'processing' &&
          o.order_status !== 'completed';
        if (unpaid) rawUnpaid = true;
        if (paidNeedService) rawPaidNeedService = true;
      }

      const rawOrdersBadge = rawUnpaid || rawPaidNeedService;
      const rawDeliveryPlanBadge = rawPaidNeedService;

      if (!rawOrdersBadge) await removeUserStorageItem(BADGE_DISMISSED_ORDERS);
      if (!rawDeliveryPlanBadge) await removeUserStorageItem(BADGE_DISMISSED_DELIVERY_PLAN);
      if (!rawOrdersBadge && !rawDeliveryPlanBadge) await removeUserStorageItem(BADGE_DISMISSED_PROFILE);

      const ordersBadge = rawOrdersBadge && dismissedOrders !== 'true';
      const deliveryPlanBadge = rawDeliveryPlanBadge && dismissedDelivery !== 'true';
      const profileBadge = (rawOrdersBadge || rawDeliveryPlanBadge) && dismissedProfile !== 'true';

      const userActionState: ProfileBadges['userActionState'] = rawUnpaid
        ? 'pending_payment'
        : rawPaidNeedService
          ? 'paid_need_config'
          : 'none';

      return { ordersBadge, deliveryPlanBadge, profileBadge, userActionState };
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const ordersBadge = data?.ordersBadge ?? false;
  const deliveryPlanBadge = data?.deliveryPlanBadge ?? false;
  const profileBadge = data?.profileBadge ?? (ordersBadge || deliveryPlanBadge);
  const userActionState = data?.userActionState ?? 'none';

  return {
    ordersBadge,
    deliveryPlanBadge,
    profileBadge,
    userActionState,
    isLoading,
  };
}
