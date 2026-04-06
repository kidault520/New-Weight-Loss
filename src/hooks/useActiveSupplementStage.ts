import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';
import { supplementStageService } from '../services/supplementStageService';
import { toBeijingDateString } from '../utils/dateUtils';

/**
 * 与 TopSummaryRowContext / invalidateHealthQueriesAfterSync 使用同一 queryKey，保证首页、补剂卡片、专属方案卡片数据一致。
 */
export function useActiveSupplementStage() {
  const { user } = useAuth();
  const { intakePlanActive } = useUserProfile();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toBeijingDateString(today), [today]);

  return useQuery({
    queryKey: ['active-supplement-stage', user?.id, todayKey],
    queryFn: () => supplementStageService.getActiveSupplementStage(),
    enabled: !!user?.id && intakePlanActive,
    staleTime: 60 * 1000,
  });
}
