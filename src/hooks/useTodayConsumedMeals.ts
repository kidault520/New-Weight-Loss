import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { foodService } from '../services/foodService';
import { getUserStorageItem } from '../utils/userStorage';
import { toLocalDateString } from '../utils/dateUtils';

export const TODAY_CONSUMED_MEALS_KEY = 'today-consumed-meals';

function toSet(value: unknown): Set<string> {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value.filter((v): v is string => typeof v === 'string'));
  return new Set<string>();
}

export function useTodayConsumedMeals() {
  const { user } = useAuth();
  const today = toLocalDateString(new Date());

  // 必须用 string[] 存储，Set 经 JSON 序列化会变成 {} 导致持久化后丢失
  // refetchOnMount: 'always' 确保每次打开今日餐卡片都从 DB 拉取最新数据（数据源为 health_records）
  const { data, refetch } = useQuery<string[]>({
    queryKey: [TODAY_CONSUMED_MEALS_KEY, user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      const set = await foodService.getTodayConsumedMealTypes(user.id);
      let arr = Array.from(set);
      if (arr.length === 0) {
        const backup = await getUserStorageItem<{ dateKey: string; meals: string[] }>('today-consumed-meals');
        if (backup?.dateKey === today && Array.isArray(backup.meals)) arr = backup.meals;
      }
      return arr;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnMount: 'always', // 每次挂载都从 DB 拉取，避免缓存/持久化导致状态恢复
  });

  const consumedMeals = useMemo(() => toSet(data), [data]);

  return { consumedMeals, refetch };
}
