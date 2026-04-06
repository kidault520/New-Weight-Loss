/**
 * useWaterRecordsQuery - 使用 React Query 的饮水记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { waterService, WaterRecord } from '../services/waterService';
import { getBeijingTime, isSameDay, toLocalDateString } from '../utils/dateUtils';

export function useWaterRecordsQuery(startDate?: Date, endDate?: Date) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addInFlightRef = useRef(false);

  // 查询：使用 React Query
  const query = useQuery({
    queryKey: ['water-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      return waterService.getRecords(user.id, startDate, endDate);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 添加：使用 React Query Mutation
  const addMutation = useMutation({
    mutationFn: async ({ amount, date, notes }: { amount: number; date: Date; notes?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (addInFlightRef.current) {
        throw new Error('正在保存饮水记录，请稍候');
      }
      addInFlightRef.current = true;
      try {
        return await waterService.addRecord(user.id, amount, date, notes);
      } finally {
        addInFlightRef.current = false;
      }
    },
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['water-records', user?.id] });
      // 自动刷新 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      amount,
      date,
      notes,
    }: {
      id: string;
      amount: number;
      date: Date;
      notes?: string;
    }) => waterService.updateRecord(id, amount, date, notes),
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['water-records', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: string) => waterService.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-records', user?.id] });
      // 刷新所有 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id] });
    },
  });

  // 辅助函数
  const getRecordsByDate = (date: Date): WaterRecord[] => {
    const records = query.data || [];
    const beijingDate = getBeijingTime(date);
    return records.filter((record: any) => {
      const recordDate = getBeijingTime(new Date(record.recorded_at));
      return isSameDay(beijingDate, recordDate);
    });
  };

  const getTotalByDate = (date: Date): number => {
    const dayRecords = getRecordsByDate(date);
    return dayRecords.reduce((sum, record) => sum + record.value, 0);
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
    getRecordsByDate,
    getTotalByDate,
    refresh: () => query.refetch(),
  };
}

