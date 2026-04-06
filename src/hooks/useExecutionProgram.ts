import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executionProgramService } from '../services/executionProgramService';
import { useAuth } from '../contexts/AuthContext';

/**
 * 执行计划Hook
 * 管理执行计划状态，自动从订单同步
 */
export function useExecutionProgram() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const queryClient = useQueryClient();

  // 查询执行计划
  const {
    data: program,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['execution-program', userId],
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      return executionProgramService.getActiveProgram(userId);
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1, // 只重试1次
  });

  // 检查用户是否有订单
  const {
    data: hasOrder,
    isLoading: isLoadingOrder,
  } = useQuery({
    queryKey: ['user-has-order', userId],
    queryFn: async () => {
      if (!userId) {
        return false;
      }
      return executionProgramService.checkUserHasOrder(userId);
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10分钟缓存
  });

  // 同步执行计划mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return executionProgramService.syncProgramFromOrder(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-program', userId] });
    },
  });

  // 更新当前天数mutation
  const updateCurrentDayMutation = useMutation({
    mutationFn: async (currentDay: number) => {
      if (!program?.id) throw new Error('No active program');
      return executionProgramService.updateCurrentDay(program.id, currentDay);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-program', userId] });
    },
  });

  return {
    program: program || null,
    isLoading,
    error,
    hasOrder: hasOrder || false,
    isLoadingOrder,
    currentDay: program?.current_day || 0,
    totalDays: program?.total_days || 0,
    refresh: refetch,
    syncProgram: syncMutation.mutateAsync,
    updateCurrentDay: updateCurrentDayMutation.mutateAsync,
  };
}

