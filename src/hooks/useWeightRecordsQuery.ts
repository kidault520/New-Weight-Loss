/**
 * useWeightRecordsQuery - 使用 React Query 的体重记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { weightService, WeightRecord } from '../services/weightService';
import { getBeijingTime, isSameDay, toLocalDateString } from '../utils/dateUtils';

export function useWeightRecordsQuery(startDate?: Date, endDate?: Date) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addInFlightRef = useRef(false);

  // 查询：使用 React Query
  const query = useQuery({
    queryKey: ['weight-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      return weightService.getRecords(user.id, startDate, endDate);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 添加：使用 React Query Mutation
  const addMutation = useMutation({
    mutationFn: async ({ weight, date, notes }: { weight: number; date: Date; notes?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (addInFlightRef.current) {
        throw new Error('正在保存体重，请稍候');
      }
      addInFlightRef.current = true;
      try {
        return await weightService.addRecord(user.id, weight, date, notes);
      } finally {
        addInFlightRef.current = false;
      }
    },
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['weight-records', user?.id] });
      // 自动刷新 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  // 更新
  const updateMutation = useMutation({
    mutationFn: ({ id, weight, date, notes }: { id: string; weight: number; date: Date; notes?: string }) =>
      weightService.updateRecord(id, weight, date, notes),
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['weight-records', user?.id] });
      // 自动刷新 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: string) => weightService.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-records', user?.id] });
      // 刷新所有 Dashboard 数据（因为删除可能影响多个日期）
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id] });
    },
  });

  // 辅助函数
  const getLatestRecord = (): WeightRecord | null => {
    const records = query.data || [];
    return records.length > 0 ? records[0] : null;
  };

  const getRecordsByDate = (date: Date): WeightRecord[] => {
    const records = query.data || [];
    const beijingDate = getBeijingTime(date);
    return records.filter((record: any) => {
      const recordDate = getBeijingTime(new Date(record.recorded_at));
      return isSameDay(beijingDate, recordDate);
    });
  };

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
    getLatestRecord,
    getRecordsByDate,
    refresh: () => query.refetch(),
  };
}

