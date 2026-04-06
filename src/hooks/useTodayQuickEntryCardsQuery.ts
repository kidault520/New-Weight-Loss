import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { quickEntryCardsService, type QuickEntryAggregateCard } from '../services/quickEntryCardsService';
import { useAuth } from '../contexts/AuthContext';
import { useBeijingDateKey } from './useBeijingDateKey';

/** 日反馈 / 待确认卡片：较长 stale + 保留上一屏数据，后台刷新时不闪空；确认/删除/同步等仍靠 invalidateQueries 立即失效 */
const TODAY_QUICK_ENTRY_STALE_MS = 5 * 60 * 1000;
const TODAY_QUICK_ENTRY_GC_MS = 30 * 60 * 1000;

/** 与 quickEntryCardsService.getTodayQuickEntryCards 口径一致（北京日历日）；供 setQueryData / 测试与 hook 共用 */
export function getTodayQuickEntryCardsQueryKey(
  userId: string | undefined | null,
  beijingDateKey: string,
) {
  return ['today-quick-entry-cards', userId, beijingDateKey] as const;
}

export function useTodayQuickEntryCardsQuery() {
  const { user } = useAuth();
  const beijingDateKey = useBeijingDateKey();

  return useQuery<QuickEntryAggregateCard[]>({
    queryKey: getTodayQuickEntryCardsQueryKey(user?.id, beijingDateKey),
    queryFn: () => quickEntryCardsService.getTodayQuickEntryCards(),
    enabled: !!user?.id,
    staleTime: TODAY_QUICK_ENTRY_STALE_MS,
    gcTime: TODAY_QUICK_ENTRY_GC_MS,
    placeholderData: keepPreviousData,
  });
}

