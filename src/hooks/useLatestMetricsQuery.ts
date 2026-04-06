import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { weightService } from '../services/weightService';
import { bloodGlucoseService } from '../services/bloodGlucoseService';

/**
 * 获取最新体重和血糖（用于今日指标，不限于当天）
 */
export function useLatestMetricsQuery() {
  const { user } = useAuth();

  const weightQuery = useQuery({
    queryKey: ['latest-weight', user?.id],
    queryFn: () => (user?.id ? weightService.getLatestWeight(user.id) : null),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const glucoseQuery = useQuery({
    queryKey: ['latest-blood-glucose', user?.id],
    queryFn: () => (user?.id ? bloodGlucoseService.getLatestValue(user.id) : null),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  return {
    weight: weightQuery.data ?? null,
    bloodGlucose: glucoseQuery.data ?? null,
    isLoading: weightQuery.isLoading || glucoseQuery.isLoading,
    refetch: () => {
      weightQuery.refetch();
      glucoseQuery.refetch();
    },
  };
}
