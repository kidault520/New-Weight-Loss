import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executionTaskService } from '../services/executionTaskService';
import { deliveryScheduleService } from '../services/deliveryScheduleService';
import { useAuth } from '../contexts/AuthContext';
import { useBeijingDateKey } from './useBeijingDateKey';

/**
 * 每日任务Hook
 * 管理今日任务流
 */
export function useDailyTasks(programId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const today = useBeijingDateKey();

  // 查询今日任务
  const {
    data: tasks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['daily-tasks', programId, today],
    queryFn: async () => {
      if (!programId) return [];
      return executionTaskService.getTasksByDate(programId, today);
    },
    enabled: !!programId,
    staleTime: 2 * 60 * 1000, // 2分钟缓存
  });

  // 查询下一个任务
  const {
    data: nextTask,
    isLoading: isLoadingNextTask,
  } = useQuery({
    queryKey: ['next-task', programId, today],
    queryFn: async () => {
      if (!programId) return null;
      return executionTaskService.getNextTask(programId, today);
    },
    enabled: !!programId,
    staleTime: 1 * 60 * 1000, // 1分钟缓存
  });

  // 完成任务mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, completionData }: { taskId: string; completionData?: Record<string, any> }) => {
      return executionTaskService.markTaskComplete(taskId, completionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', programId, today] });
      queryClient.invalidateQueries({ queryKey: ['next-task', programId, today] });
    },
  });

  // 跳过任务mutation
  const skipTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return executionTaskService.skipTask(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', programId, today] });
      queryClient.invalidateQueries({ queryKey: ['next-task', programId, today] });
    },
  });

  // 生成任务mutation
  const generateTasksMutation = useMutation({
    mutationFn: async ({ taskDate, mealDeliverySchedules }: { 
      taskDate: string; 
      mealDeliverySchedules?: Array<{
        id?: string;
        delivery_date: string;
        meal_type: string;
        delivery_time_start?: string;
      }>;
    }) => {
      if (!programId) throw new Error('No program ID');
      
      // 如果没有提供配送计划，自动获取
      let schedules = mealDeliverySchedules;
      if (!schedules && user?.id) {
        const date = new Date(taskDate);
        schedules = await deliveryScheduleService.getDeliverySchedulesByDate(user.id, date);
      }
      
      const result = await executionTaskService.generateDailyTasks(programId, taskDate, schedules);
      return result;
    },
    onSuccess: async (_data, variables) => {
      // 刷新所有相关的查询，包括带日期的和不带日期的
      await queryClient.invalidateQueries({ queryKey: ['daily-tasks', programId] });
      await queryClient.invalidateQueries({ queryKey: ['daily-tasks', programId, variables.taskDate] });
      await queryClient.invalidateQueries({ queryKey: ['next-task', programId] });
      // 强制拉取一次当天任务，避免“点击后无变化”的缓存/时序问题
      await queryClient.refetchQueries({ queryKey: ['daily-tasks', programId, variables.taskDate], exact: true });
    },
  });

  return {
    tasks,
    nextTask: nextTask || null,
    isLoading,
    isLoadingNextTask,
    error,
    refresh: refetch,
    completeTask: completeTaskMutation.mutateAsync,
    skipTask: skipTaskMutation.mutateAsync,
    generateTasks: generateTasksMutation.mutateAsync,
  };
}

