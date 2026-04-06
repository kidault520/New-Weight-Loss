/**
 * 待办自动确认 Hook
 * - 应用加载时：检查并自动确认过期待办（昨日及更早、或今日已过 23:59）
 * - 设置定时器：每天 23:59 执行一次，自动确认当日未处理的待办
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { pendingQuickEntryService } from '../services/pendingQuickEntryService';

export function useAutoConfirmPendingEntries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    const runAutoConfirm = async () => {
      try {
        const count = await pendingQuickEntryService.autoConfirmStalePendingEntries();
        if (count > 0) {
          console.log(`📋 [useAutoConfirmPendingEntries] 已自动确认 ${count} 条待办`);
          queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', user.id] });
          queryClient.invalidateQueries({ queryKey: ['chat-messages', user.id] });
          queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', user.id] });
        }
      } catch (err) {
        console.error('[useAutoConfirmPendingEntries] 自动确认失败:', err);
      }
    };

    // 1. 应用加载时立即执行一次
    if (!hasRunRef.current) {
      hasRunRef.current = true;
      runAutoConfirm();
    }

    // 2. 设置每天 23:59 的定时执行（递归调度，确保每天都会执行）
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const scheduleNextRun = () => {
      if (cancelled) return;
      const now = new Date();
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(23, 59, 0, 0);
      let delay = next.getTime() - now.getTime();
      if (delay < 0) delay += 24 * 60 * 60 * 1000; // 若已过今日 23:59，则等明天
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        runAutoConfirm();
        scheduleNextRun(); // 递归调度下一天
      }, delay);
    };

    scheduleNextRun();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user?.id, queryClient]);
}
