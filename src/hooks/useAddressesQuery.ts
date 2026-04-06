/**
 * useAddressesQuery - 使用 React Query 的地址管理 Hook
 * 符合架构规范：组件 → Hook → Supabase (3层)
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { addressService, CreateAddressData, UpdateAddressData } from '../services/addressService';

export function useAddressesQuery() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 查询：使用 React Query
  const query = useQuery({
    queryKey: ['delivery-addresses', user?.id],
    queryFn: () => {
      if (!user?.id) return [];
      return addressService.fetchUserAddresses(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 创建地址：使用 React Query Mutation
  const createMutation = useMutation({
    mutationFn: (addressData: CreateAddressData) => {
      if (!user?.id) throw new Error('User not authenticated');
      return addressService.createAddress(user.id, addressData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-addresses', user?.id] });
    },
  });

  // 更新地址：使用 React Query Mutation
  const updateMutation = useMutation({
    mutationFn: (addressData: UpdateAddressData) => addressService.updateAddress(addressData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-addresses', user?.id] });
    },
  });

  // 删除地址：使用 React Query Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => addressService.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-addresses', user?.id] });
    },
  });

  // 设置默认地址：使用 React Query Mutation
  const setDefaultMutation = useMutation({
    mutationFn: (addressId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      return addressService.setDefaultAddress(user.id, addressId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-addresses', user?.id] });
    },
  });

  const refresh = useCallback(() => query.refetch(), [query.refetch]);

  return {
    addresses: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createAddress: createMutation.mutateAsync,
    updateAddress: updateMutation.mutateAsync,
    deleteAddress: deleteMutation.mutateAsync,
    setDefaultAddress: setDefaultMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSettingDefault: setDefaultMutation.isPending,
    refresh,
  };
}




