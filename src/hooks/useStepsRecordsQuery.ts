/**
 * useStepsRecordsQuery - 使用 React Query 的步数记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { stepsService } from '../services/stepsService';
import { toLocalDateString } from '../utils/dateUtils';

export function useStepsRecordsQuery(startDate?: Date, endDate?: Date) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addInFlightRef = useRef(false);

  // 查询：使用 React Query
  const query = useQuery({
    queryKey: ['steps-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      return stepsService.getRecords(user.id, startDate, endDate);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 添加：使用 React Query Mutation
  const addMutation = useMutation({
    mutationFn: async ({ steps, date, notes }: { steps: number; date: Date; notes?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (addInFlightRef.current) {
        throw new Error('正在保存步数记录，请稍候');
      }
      addInFlightRef.current = true;
      try {
        return await stepsService.addRecord(user.id, steps, date, notes);
      } finally {
        addInFlightRef.current = false;
      }
    },
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['steps-records', user?.id] });
      // 自动刷新 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      steps,
      date,
      notes,
    }: {
      id: string;
      steps: number;
      date: Date;
      notes?: string;
    }) => stepsService.updateRecord(id, steps, date, notes),
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['steps-records', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: string) => stepsService.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steps-records', user?.id] });
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

