/**
 * useHealthAssessmentQuery - 使用 React Query 的健康评估 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */
 

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { healthAssessmentService } from '../services/healthAssessmentService';

export function useHealthAssessmentQuery() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 查询：使用 React Query
  const query = useQuery({
    queryKey: ['health-assessment', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const result = await healthAssessmentService.getLatestAssessment();
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 创建评估：使用 React Query Mutation
  const createMutation = useMutation({
    mutationFn: ({ data, isReassessment }: { data: any; isReassessment?: boolean }) => {
      if (!user?.id) throw new Error('User not authenticated');
      return healthAssessmentService.createAssessment(data, isReassessment);
    },
    onSuccess: (result) => {
      if (result.data) {
        // 使相关查询失效，触发刷新
        queryClient.invalidateQueries({ queryKey: ['health-assessment', user?.id] });
        // 同时使user profile相关查询失效，因为评估可能影响profile显示
        queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
      }
    },
  });

  const refresh = useCallback(() => query.refetch(), [query.refetch]);

  return {
    assessment: query.data || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createAssessment: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refresh,
  };
}

/**
 * useAllHealthAssessmentsQuery - 获取所有健康评估列表
 */
export function useAllHealthAssessmentsQuery() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 查询：使用 React Query
  const query = useQuery({
    queryKey: ['health-assessments-all', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const result = await healthAssessmentService.getAllAssessments();
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 删除评估：使用 React Query Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => healthAssessmentService.deleteAssessment(id),
    onSuccess: () => {
      // 使相关查询失效，触发刷新
      queryClient.invalidateQueries({ queryKey: ['health-assessments-all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['health-assessment', user?.id] });
    },
  });

  const assessments = useMemo(() => query.data || [], [query.data]);
  const refresh = useCallback(() => query.refetch(), [query.refetch]);

  return {
    assessments,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    deleteAssessment: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    refresh,
  };
}

