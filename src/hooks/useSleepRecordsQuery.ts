/**
 * useSleepRecordsQuery - 使用 React Query 的睡眠记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sleepService } from '../services/sleepService';
import { toLocalDateString } from '../utils/dateUtils';

export function useSleepRecordsQuery(startDate?: Date, endDate?: Date) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addInFlightRef = useRef(false);

  const query = useQuery({
    queryKey: ['sleep-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      return sleepService.getRecords(user.id, startDate, endDate);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async ({ hours, date, notes }: { hours: number; date: Date; notes?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (addInFlightRef.current) {
        throw new Error('正在保存睡眠记录，请稍候');
      }
      addInFlightRef.current = true;
      try {
        return await sleepService.addRecord(user.id, hours, date, notes);
      } finally {
        addInFlightRef.current = false;
      }
    },
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['sleep-records', user?.id] });
      // 自动刷新 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      hours,
      date,
      notes,
    }: {
      id: string;
      hours: number;
      date: Date;
      notes?: string;
    }) => sleepService.updateRecord(id, hours, date, notes),
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['sleep-records', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sleepService.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep-records', user?.id] });
      // 刷新所有 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id] });
    },
  });

  return {
    records: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    addRecord: addMutation.mutateAsync,
    updateRecord: updateMutation.mutateAsync,
    deleteRecord: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refresh: () => query.refetch(),
  };
}

