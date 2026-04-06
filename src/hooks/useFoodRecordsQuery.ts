/**
 * useFoodRecordsQuery - 使用 React Query 的食物记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { foodService } from '../services/foodService';

export function useFoodRecordsQuery(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['food-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      return foodService.getRecords(user.id, startDate, endDate);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    records: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: () => query.refetch(),
  };
}

