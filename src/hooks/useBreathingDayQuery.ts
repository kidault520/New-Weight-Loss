import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getBeijingDayBoundsFromDateKey } from '../utils/dateUtils';
import { useBeijingDateKey } from './useBeijingDateKey';
import { fetchBreathingRecordsForDay, type BreathingRecordRow } from '../services/breathingService';

const STALE_MS = 60 * 1000;

export function useBreathingDayQuery() {
  const { user } = useAuth();
  const todayKey = useBeijingDateKey();
  const { start, end } = getBeijingDayBoundsFromDateKey(todayKey);

  return useQuery({
    queryKey: ['breathing-day', user?.id, todayKey],
    queryFn: async (): Promise<BreathingRecordRow[]> => {
      if (!user?.id) return [];
      return fetchBreathingRecordsForDay(user.id, start.toISOString(), end.toISOString());
    },
    enabled: !!user?.id,
    staleTime: STALE_MS,
  });
}

export function useInvalidateBreathingQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['breathing-day'] });
    queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards'] });
    queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
  };
}
