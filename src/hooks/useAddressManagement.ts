/**
 * useAddressManagement - 地址管理逻辑Hook
 * 从AddDeliveryAddressPage.tsx中提取的地址管理逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */
 

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addressService, DeliveryAddress as DBDeliveryAddress } from '../services/addressService';
import { auth } from '../config/supabase';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { DeliveryAddress } from '../components/delivery/AddressForm';

const ALL_MEALS = ['breakfast', 'lunch', 'dinner'];

function applyMealTypesExclusivity(
  addresses: DBDeliveryAddress[],
  currentAddressId: string,
  mealTypesToClaim: string[]
): DBDeliveryAddress[] {
  const toRemove = mealTypesToClaim.includes('all') ? ALL_MEALS : mealTypesToClaim;
  return addresses.map(addr => {
    if (addr.id === currentAddressId) return addr;
    const current = addr.default_meal_types;
    if (!current || !Array.isArray(current) || current.length === 0) return addr;
    const expanded = current.includes('all') ? [...ALL_MEALS] : [...current];
    const remaining = expanded.filter(t => !toRemove.includes(t));
    const newDefaultMealTypes: string[] | null = remaining.length > 0
      ? (remaining.length === 3 ? ['all'] : remaining)
      : null;
    return {
      ...addr,
      default_meal_types: newDefaultMealTypes,
      is_default: newDefaultMealTypes !== null && newDefaultMealTypes.length > 0
    };
  });
}

interface UseAddressManagementOptions {
  initialDeliveryAddressId?: string;
  currentUserId?: string | null;
  onAlert?: (state: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

export function useAddressManagement({
  initialDeliveryAddressId,
  currentUserId,
  onAlert,
}: UseAddressManagementOptions) {
  const queryClient = useQueryClient();
  const [savedAddresses, setSavedAddresses] = useState<DBDeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(initialDeliveryAddressId || null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const isSavingRef = useRef<boolean>(false); // 🔥 修复：添加防重复提交的 ref

  const loadUserAndAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const effectiveUserId = currentUserId ?? (await auth.getCurrentUser()).user?.id ?? null;
      setUserId(effectiveUserId);

      if (!effectiveUserId) {
        setSavedAddresses([]);
        setCustomTags([]);
        setSelectedAddressId(initialDeliveryAddressId || null);
        return;
      }

      const queryKey = ['delivery-addresses', effectiveUserId] as const;
      const cachedAddresses = queryClient.getQueryData<DBDeliveryAddress[]>(queryKey);
      if (cachedAddresses) {
        setSavedAddresses(cachedAddresses);
        setLoading(false);
      }

      const addresses = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => addressService.fetchUserAddresses(effectiveUserId),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
      setSavedAddresses(addresses);

      // Extract custom tags from existing addresses
      const existingCustomTags = addresses
        .map(addr => addr.tag || addr.label)
        .filter(tag => tag && !['家', '公司'].includes(tag));
      const uniqueCustomTags = Array.from(new Set(existingCustomTags));
      setCustomTags(uniqueCustomTags);

      // Load custom tags from localStorage
      try {
        const saved = await getUserStorageItem<string[]>('addressCustomTags');
        if (saved) {
          const mergedTags = Array.from(new Set([...uniqueCustomTags, ...saved]));
          setCustomTags(mergedTags);
        }
      } catch (error) {
        console.error('Failed to load custom tags:', error);
      }

      // Only set default address if no initial address was provided（优先 default_meal_types，兼容 is_default）
      if (!initialDeliveryAddressId) {
        const defaultAddress = addresses.find(addr =>
          addr.is_default || (addr.default_meal_types && addr.default_meal_types.length > 0)
        );
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      onAlert?.({
        show: true,
        type: 'error',
        title: '加载失败',
        message: '加载地址失败，请重试'
      });
    } finally {
      setLoading(false);
    }
  }, [currentUserId, initialDeliveryAddressId, onAlert, queryClient]);

  const saveAddress = async (
    formData: DeliveryAddress,
    isDefaultAddress: boolean,
    defaultMealTypes: 'all' | string[],
    editingAddress: DBDeliveryAddress | null
  ): Promise<DBDeliveryAddress | null> => {
    // 🔥 修复：防止重复提交
    if (isSavingRef.current) {
      console.warn('⚠️ [useAddressManagement] Save already in progress, ignoring duplicate request');
      return null;
    }

    try {
      isSavingRef.current = true; // 🔥 修复：设置保存状态

      if (!userId) {
        onAlert?.({
          show: true,
          type: 'error',
          title: '保存失败',
          message: '用户未登录'
        });
        return null;
      }

      const defaultMealTypesValue = !isDefaultAddress ? null
        : defaultMealTypes === 'all' ? ['all'] : defaultMealTypes;

      if (editingAddress) {
        // Update existing address（按餐次排他：只更新当前地址，从其他地址清除重叠餐次）
        const updatedAddress = await addressService.updateAddress({
          id: editingAddress.id,
          expected_updated_at: editingAddress.updated_at,
          label: formData.tag,
          address: formData.address,
          door_number: formData.doorNumber,
          contact_name: formData.name,
          phone: formData.phone,
          gender: formData.gender,
          tag: formData.tag,
          default_meal_types: defaultMealTypesValue,
          is_default: !!defaultMealTypesValue,
          longitude: formData.longitude ?? null,
          latitude: formData.latitude ?? null,
        });

        if (updatedAddress) {
          let updatedAddresses = savedAddresses.map(addr =>
            addr.id === editingAddress.id ? updatedAddress : addr
          );

          if (isDefaultAddress && defaultMealTypesValue) {
            const toClaim = defaultMealTypesValue.includes('all') ? ['breakfast', 'lunch', 'dinner'] : defaultMealTypesValue;
            await addressService.clearMealTypesFromOtherAddresses(userId, updatedAddress.id, toClaim);
            updatedAddresses = applyMealTypesExclusivity(updatedAddresses, updatedAddress.id, toClaim);
          }

          setSavedAddresses(updatedAddresses);
          queryClient.invalidateQueries({ queryKey: ['delivery-addresses', userId] });
          queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
          queryClient.invalidateQueries({ queryKey: ['delivery-plan'] });

          const syncMeta = (updatedAddress as any).__syncMeta;
          if (syncMeta) {
            onAlert?.({
              show: true,
              type: 'success',
              title: '地址更新成功',
              message: `已同步 ${syncMeta.updatedCount} 个可修改餐次，跳过 ${syncMeta.skippedLockedCount} 个锁定餐次`
            });
          }
          return updatedAddress;
        }
      } else {
        // Create new address
        // 🔥 修复：createAddress 需要两个参数：userId 和 addressData
        const newAddress = await addressService.createAddress(userId, {
          label: formData.tag,
          address: formData.address,
          door_number: formData.doorNumber,
          contact_name: formData.name,
          phone: formData.phone,
          gender: formData.gender,
          tag: formData.tag,
          is_default: isDefaultAddress,
          default_meal_types: defaultMealTypesValue,
          longitude: formData.longitude ?? null,
          latitude: formData.latitude ?? null,
        });

        if (newAddress) {
          let updatedAddresses = [...savedAddresses, newAddress];

          if (isDefaultAddress && defaultMealTypesValue) {
            const toClaim = defaultMealTypesValue.includes('all') ? ['breakfast', 'lunch', 'dinner'] : defaultMealTypesValue;
            await addressService.clearMealTypesFromOtherAddresses(userId, newAddress.id, toClaim);
            updatedAddresses = applyMealTypesExclusivity(updatedAddresses, newAddress.id, toClaim);
          }

          setSavedAddresses(updatedAddresses);
          setSelectedAddressId(newAddress.id);
          queryClient.invalidateQueries({ queryKey: ['delivery-addresses', userId] });
          queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
          queryClient.invalidateQueries({ queryKey: ['delivery-plan'] });

          // Save custom tag if it's new
          const normalizedTag = String(formData.tag || '').trim();
          if (normalizedTag && !['家', '公司'].includes(normalizedTag)) {
            const updatedCustomTags = Array.from(new Set([...customTags.map(t => t.trim()), normalizedTag]));
            setCustomTags(updatedCustomTags);
            await setUserStorageItem('addressCustomTags', updatedCustomTags);
          }

          return newAddress;
        }
      }

      return null;
    } catch (error) {
      console.error('Error saving address:', error);
      const errorCode = error instanceof Error ? error.message : String(error);
      if (errorCode === 'ADDRESS_UPDATE_CONFLICT') {
        onAlert?.({
          show: true,
          type: 'warning',
          title: '地址已更新',
          message: '该地址刚被其他操作修改，请刷新后重试'
        });
        return null;
      }
      if (errorCode === 'ADDRESS_ALREADY_DELETED') {
        onAlert?.({
          show: true,
          type: 'warning',
          title: '地址不可用',
          message: '该地址已被删除，请刷新列表后重试'
        });
        return null;
      }
      onAlert?.({
        show: true,
        type: 'error',
        title: '保存失败',
        message: '保存地址失败，请重试'
      });
      return null;
    } finally {
      isSavingRef.current = false; // 🔥 修复：重置保存状态
    }
  };

  const deleteAddress = async (addressId: string): Promise<boolean> => {
    try {
      // Check if address is in use
      const { inUse } = await addressService.checkAddressInUse(addressId);

      if (inUse) {
        onAlert?.({
          show: true,
          type: 'warning',
          title: '无法删除',
          message: '该地址正在使用中，无法删除。'
        });
        return false;
      }

      const success = await addressService.deleteAddress(addressId);
      if (success) {
        setSavedAddresses(savedAddresses.filter(addr => addr.id !== addressId));
        if (selectedAddressId === addressId) {
          setSelectedAddressId(null);
        }
        queryClient.invalidateQueries({ queryKey: ['delivery-addresses', userId] });
        queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
        queryClient.invalidateQueries({ queryKey: ['delivery-plan'] });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting address:', error);
      onAlert?.({
        show: true,
        type: 'error',
        title: '删除失败',
        message: '删除地址失败，请重试'
      });
      return false;
    }
  };

  useEffect(() => {
    loadUserAndAddresses();
  }, [loadUserAndAddresses]);

  return {
    savedAddresses,
    selectedAddressId,
    setSelectedAddressId,
    loading,
    userId,
    customTags,
    setCustomTags,
    saveAddress,
    deleteAddress,
    refreshAddresses: loadUserAndAddresses,
  };
}













