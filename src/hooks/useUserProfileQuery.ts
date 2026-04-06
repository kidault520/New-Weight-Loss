/**
 * useUserProfileQuery - 用户档案查询Hook
 * 使用React Query管理用户档案数据
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { userProfileService } from '../services/userProfileService';
import type { UserProfile } from '../utils/bmrCalculations';
import { SUPABASE_TABLE_QUERY_TIMEOUT_MS } from '../constants/authTimeouts';

/** 与「真·无档案行」区分：超时得到 null 时 fetchTimedOut=true，引导逻辑不得当作新用户 */
export type UserProfileQueryPayload = {
  profile: UserProfile | null;
  fetchTimedOut: boolean;
};

function normalizeProfileQueryData(data: unknown): UserProfileQueryPayload {
  if (data == null) return { profile: null, fetchTimedOut: false };
  if (
    typeof data === 'object' &&
    data !== null &&
    'fetchTimedOut' in data &&
    'profile' in data
  ) {
    return data as UserProfileQueryPayload;
  }
  return { profile: data as UserProfile, fetchTimedOut: false };
}

export function useUserProfileQuery() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // 查询用户档案
  const query = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async (): Promise<UserProfileQueryPayload> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      try {
        const p = await Promise.race([
          userProfileService.getProfile(user.id),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('PROFILE_QUERY_TIMEOUT')), SUPABASE_TABLE_QUERY_TIMEOUT_MS);
          }),
        ]);
        return { profile: p, fetchTimedOut: false };
      } catch (e) {
        if (e instanceof Error && e.message === 'PROFILE_QUERY_TIMEOUT') {
          if (import.meta.env.DEV) {
            console.warn(
              '[useUserProfileQuery] user_profiles 请求超时，档案未确定（非「无档案」）；将后台重试（请检查 VPN/网络、RLS；弱网可调高 VITE_SUPABASE_CLIENT_TIMEOUT_MS）',
            );
          }
          return { profile: null, fetchTimedOut: true };
        }
        throw e;
      }
    },
    enabled: !!user?.id && isAuthenticated, // 确保用户已认证且user.id存在
    staleTime: 10 * 60 * 1000, // 10分钟缓存（用户配置变化频率低）
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false, // ✅ 登录后不要因为窗口聚焦就重新获取
    refetchOnReconnect: true, // 网络重连时自动刷新
  });

  // 更新用户档案
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<UserProfile>) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return userProfileService.updateProfile(user.id, updates);
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData<UserProfileQueryPayload>(['user-profile', user?.id], {
        profile: updatedProfile,
        fetchTimedOut: false,
      });
      queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
    },
  });

  const normalized = normalizeProfileQueryData(query.data);
  const refetchProfile = query.refetch;

  useEffect(() => {
    if (!normalized.fetchTimedOut || !user?.id || !isAuthenticated) return;
    const t = window.setTimeout(() => {
      void refetchProfile();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [normalized.fetchTimedOut, user?.id, isAuthenticated, refetchProfile]);

  return {
    profile: normalized.profile,
    profileFetchTimedOut: normalized.fetchTimedOut,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    refresh: () => {
      return query.refetch();
    },
  };
}
