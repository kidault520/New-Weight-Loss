/**
 * useMeasurementsRecordsQuery - 使用 React Query 的围度记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  measurementsService,
  MeasurementRecord,
  MeasurementBody,
} from '../services/measurementsService';
import { toLocalDateString } from '../utils/dateUtils';

export function useMeasurementsRecordsQuery(startDate?: Date, endDate?: Date) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addInFlightRef = useRef(false);

  const query = useQuery({
    queryKey: ['measurements-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      return measurementsService.getRecords(user.id, startDate, endDate);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async ({ body, date, notes }: { body: MeasurementBody; date: Date; notes?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (addInFlightRef.current) {
        throw new Error('正在保存围度记录，请稍候');
      }
      addInFlightRef.current = true;
      try {
        return await measurementsService.addRecord(user.id, body, date, notes);
      } finally {
        addInFlightRef.current = false;
      }
    },
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['measurements-records', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
      date,
      notes,
    }: {
      id: string;
      body: MeasurementBody;
      date: Date;
      notes?: string;
    }) => measurementsService.updateRecord(id, body, date, notes),
    onSuccess: (_, variables) => {
      const dateKey = toLocalDateString(variables.date);
      queryClient.invalidateQueries({ queryKey: ['measurements-records', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => measurementsService.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements-records', user?.id] });
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

export type { MeasurementRecord };
