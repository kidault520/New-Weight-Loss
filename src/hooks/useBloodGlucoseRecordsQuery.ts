/**
 * useBloodGlucoseRecordsQuery - 使用 React Query 的血糖记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */
 

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bloodGlucoseService } from '../services/bloodGlucoseService';
import { toLocalDateString } from '../utils/dateUtils';

export function useBloodGlucoseRecordsQuery(startDate?: Date, endDate?: Date) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addInFlightRef = useRef(false);

  const query = useQuery({
    queryKey: ['blood-glucose-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      return bloodGlucoseService.getRecords(user.id, startDate, endDate);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async ({
      value,
      date,
      notes,
      extraData,
    }: {
      value: number;
      date: Date;
      notes?: string;
      extraData?: any;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (addInFlightRef.current) {
        throw new Error('正在保存血糖记录，请稍候');
      }
      addInFlightRef.current = true;
      try {
        return await bloodGlucoseService.addRecord(user.id, value, date, notes, extraData);
      } finally {
        addInFlightRef.current = false;
      }
    },
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['blood-glucose-records', user?.id] });
      // 自动刷新 Dashboard 数据
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      value,
      date,
      notes,
      extraData,
    }: {
      id: string;
      value: number;
      date: Date;
      notes?: string;
      extraData?: any;
    }) => bloodGlucoseService.updateRecord(id, value, date, notes, extraData),
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['blood-glucose-records', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bloodGlucoseService.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blood-glucose-records', user?.id] });
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

