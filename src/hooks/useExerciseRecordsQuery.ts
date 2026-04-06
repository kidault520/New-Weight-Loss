 
/**
 * useExerciseRecordsQuery - 使用 React Query 的运动记录 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { exerciseService, ExerciseRecord } from '../services/exerciseService';
import { toLocalDateString } from '../utils/dateUtils';

export function useExerciseRecordsQuery(startDate?: Date, endDate?: Date) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addInFlightRef = useRef(false);

  const query = useQuery({
    queryKey: ['exercise-records', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      if (!user?.id) return [];
      const start = startDate?.toISOString() || new Date(0).toISOString();
      const end = endDate?.toISOString() || new Date().toISOString();
      return exerciseService.getExercisesByDateRange(start, end);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  const addMutation = useMutation({
    mutationFn: async (exercise: ExerciseRecord) => {
      if (addInFlightRef.current) {
        throw new Error('正在保存运动记录，请稍候');
      }
      addInFlightRef.current = true;
      try {
        return await exerciseService.addExercise(exercise);
      } finally {
        addInFlightRef.current = false;
      }
    },
    onMutate: async (newExercise) => {
      // 取消正在进行的查询，避免覆盖乐观更新
      await queryClient.cancelQueries({ queryKey: ['exercise-records', user?.id] });
      
      // 保存当前数据快照
      const previousRecords = queryClient.getQueryData(['exercise-records', user?.id, startDate?.toISOString(), endDate?.toISOString()]);
      
      // 创建临时记录（使用临时ID，等待服务器返回真实ID）
      const tempRecord = {
        ...newExercise,
        id: `temp-${Date.now()}`,
        recorded_at: newExercise.recorded_at || new Date().toISOString(),
      };
      
      // 乐观更新：立即添加到缓存
      queryClient.setQueryData(['exercise-records', user?.id, startDate?.toISOString(), endDate?.toISOString()], (old: any) => {
        if (!old) return [tempRecord];
        return [tempRecord, ...old];
      });
      
      // 同时更新所有相关的查询缓存
      queryClient.setQueriesData(
        { queryKey: ['exercise-records', user?.id] },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return [tempRecord, ...old];
        }
      );
      
      return { previousRecords };
    },
    onError: (_err, _newExercise, context) => {
      // 如果添加失败，恢复之前的数据
      if (context?.previousRecords) {
        queryClient.setQueryData(['exercise-records', user?.id, startDate?.toISOString(), endDate?.toISOString()], context.previousRecords);
      }
    },
    onSuccess: (data, _variables, _context) => {
      // 添加成功后，用服务器返回的真实记录替换临时记录
      queryClient.setQueryData(['exercise-records', user?.id, startDate?.toISOString(), endDate?.toISOString()], (old: any) => {
        if (!old) return [data];
        // 移除临时记录，添加真实记录
        const filtered = old.filter((r: any) => !r.id?.startsWith('temp-'));
        return [data, ...filtered];
      });
      
      // 确保所有相关查询都刷新
      queryClient.invalidateQueries({ queryKey: ['exercise-records', user?.id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExerciseRecord> }) =>
      exerciseService.updateExercise(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exercise-records', user?.id] });
      const dateKey = toLocalDateString(new Date(data.recorded_at));
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id, dateKey] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => exerciseService.deleteExercise(id),
    onMutate: async (id) => {
      // 取消正在进行的查询，避免覆盖乐观更新
      await queryClient.cancelQueries({ queryKey: ['exercise-records', user?.id] });
      
      // 保存所有相关查询的数据快照
      const previousDataMap = new Map();
      const queries = queryClient.getQueriesData({ queryKey: ['exercise-records', user?.id] });
      queries.forEach(([queryKey, data]) => {
        previousDataMap.set(queryKey, data);
      });
      
      // 乐观更新：从所有相关查询缓存中移除记录
      queryClient.setQueriesData(
        { queryKey: ['exercise-records', user?.id] },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.filter((record: any) => record.id !== id);
        }
      );
      
      return { previousDataMap };
    },
    onError: (_err, _id, context) => {
      // 如果删除失败，恢复所有之前的数据
      if (context?.previousDataMap) {
        context.previousDataMap.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_data, id) => {
      // 删除成功后，确保记录已从所有缓存中移除
      queryClient.setQueriesData(
        { queryKey: ['exercise-records', user?.id] },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.filter((record: any) => record.id !== id);
        }
      );
      
      // 然后刷新查询以确保数据同步（但不立即刷新，避免重新加载已删除的记录）
      // 使用 refetchQueries 而不是 invalidateQueries，避免立即重新加载
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['exercise-records', user?.id] });
      }, 100);
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




