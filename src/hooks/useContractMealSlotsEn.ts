import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useExecutionProgram } from './useExecutionProgram';
import { fetchContractMealSlotsEnForUser } from '../services/orderMealPlanSlots';

/**
 * 有订单时拉取当前合约餐次（与 orderMealPlanSlots 一致），供今日餐/配送卡片等与排期求交。
 */
export function useContractMealSlotsEn() {
  const { user } = useAuth();
  const { hasOrder, isLoadingOrder } = useExecutionProgram();
  return useQuery({
    queryKey: ['contract-meal-slots-en', user?.id],
    queryFn: () => fetchContractMealSlotsEnForUser(user!.id),
    enabled: Boolean(user?.id) && hasOrder === true && !isLoadingOrder,
    staleTime: 120_000,
  });
}
