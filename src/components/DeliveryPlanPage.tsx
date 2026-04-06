import React, { useState, useEffect, useMemo } from 'react';
import AddDeliveryAddressPage from './AddDeliveryAddressPage';
import { DrawerScreen } from './common/DrawerScreen';
import { AlertDialog } from './common/AlertDialog';
import { ConfirmModal } from './common/ConfirmModal';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { saveMealPlanConfig } from '../services/mealPlanConfigService';
import { getDateLabel, getMealKey, getDefaultCycleTabIdForToday } from '../utils/deliveryPlanUtils';
import { toLocalDateString } from '../utils/dateUtils';
import { useDeliveryPlanLock } from '../hooks/useDeliveryPlanLock';
import { useAddressesQuery } from '../hooks/useAddressesQuery';
import { useMealAddressesMapping } from '../hooks/useMealAddressesMapping';
import { useAuth } from '../contexts/AuthContext';
import { deliveryScheduleService } from '../services/deliveryScheduleService';
import { DeliveryPlanTable } from './delivery/DeliveryPlanTable';
import { AddressSelectionModal } from './delivery/AddressSelectionModal';
import { SecondaryPageHeader } from './common/SecondaryPageHeader'; // 🔥 新增：导入通用标题栏

import type { DeliveryPlanConfirmationData } from './delivery/DeliveryPlanConfirmationModal';
import { useQueryClient } from '@tanstack/react-query';
import { dismissProfileBadge } from '../hooks/useProfileBadges';

interface DeliveryPlanPageProps {
  show: boolean;
  initialPlanGenerated?: boolean;
  selectedMealTypes: string[];
  selectedDates: Date[];
  defaultAddressId?: string;
  excludedDates?: Date[];
  /** 当前关联的订单ID，单餐修改同步时写入 order_id */
  activeOrderId?: string | null;
  onRequestConfirmation: (data: DeliveryPlanConfirmationData) => void;
  onClose: () => void;
}

interface AddressChangeMeta {
  hasDefaultMealTypes: boolean;
  label?: string;
  address?: string;
  doorNumber?: string;
  contactName?: string;
  phone?: string;
}

interface PendingMealChange {
  mealKey: string;
  date: Date;
  mealType: string;
  previousAddressId: string;
  nextAddressId: string;
  label: string;
  addressLine: string;
  contactName: string;
  phone: string;
}

interface DateMealConfig {
  date: Date;
  mealType: string;
  addressId: string;
}

interface CycleTab {
  id: string;
  label: string;
  ordinal: string;
  startIndex: number;
  endIndex: number;
}

type DayFilterOption = string;

const DeliveryPlanPage: React.FC<DeliveryPlanPageProps> = ({
  show,
  initialPlanGenerated = false,
  selectedMealTypes,
  selectedDates,
  defaultAddressId = '',
  excludedDates = [],
  activeOrderId = null,
  onRequestConfirmation,
  onClose
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addresses, isLoading: loading, refresh: refreshAddresses } = useAddressesQuery();
  const { mealAddresses, saveMealAddresses, refreshMealAddresses } = useMealAddressesMapping();
  const [dateMealConfigs, setDateMealConfigs] = useState<DateMealConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<{ date: Date; mealType: string } | null>(null);
  const [dayFilter, setDayFilter] = useState<DayFilterOption>('cycle-0');
  const selectedDatesKey = useMemo(
    () => (selectedDates?.length ? selectedDates.map((d) => toLocalDateString(d)).join('|') : ''),
    [selectedDates]
  );
  // 改为异步加载，因为需要获取用户ID
  const [lockedMeals, setLockedMeals] = useState<Set<string>>(new Set());
  const [manuallyModifiedMeals, setManuallyModifiedMeals] = useState<Set<string>>(new Set());
  const [showAddAddressPage, setShowAddAddressPage] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(initialPlanGenerated);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasBatchPendingConfirm, setHasBatchPendingConfirm] = useState(!initialPlanGenerated);
  const [pendingMealChanges, setPendingMealChanges] = useState<Record<string, PendingMealChange>>({});
  const [pendingConfirmMealKey, setPendingConfirmMealKey] = useState<string | null>(null);
  const [pendingAutoLockMealKeys, setPendingAutoLockMealKeys] = useState<Set<string>>(new Set());
  const [alertState, setAlertState] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });


  // 仅恢复本地「手动修改」与已持久化的锁定键；无本地锁定时由下方 loadMealAddresses 与排期表同源一次请求补齐（避免重复打 delivery_schedules）
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const [locked, modified] = await Promise.all([
          getUserStorageItem<string[]>('mealPlan_lockedMeals'),
          getUserStorageItem<string[]>('mealPlan_manuallyModifiedMeals')
        ]);

        if (modified) setManuallyModifiedMeals(new Set(modified));

        if (locked && locked.length > 0) {
          setLockedMeals(new Set(locked));
        }
      } catch (error) {
        console.error('[DeliveryPlanPage] Error loading user data:', error);
      }
    };

    loadUserData();
  }, [selectedDates, selectedMealTypes, user?.id]);

  // 已有配置再次进入：直接展示“已生成计划”；首次配置：展示“框架待生成”
  useEffect(() => {
    if (show) {
      refreshAddresses().catch(console.error);
      refreshMealAddresses().catch(console.error);
      setPlanGenerated(initialPlanGenerated);
      setIsGenerating(false);
      setHasBatchPendingConfirm(!initialPlanGenerated);
      setPendingMealChanges({});
      setPendingConfirmMealKey(null);
      setPendingAutoLockMealKeys(new Set());
      window.setTimeout(() => {
        dismissProfileBadge('delivery_plan')
          .then(() => queryClient.invalidateQueries({ queryKey: ['profile-badges'] }))
          .catch(console.error);
      }, 0);
    }
  }, [show, initialPlanGenerated, queryClient, refreshAddresses, refreshMealAddresses]);

  // 进入页面时默认选中「今日」所在周（与 getCycleTabs 分段规则一致）
  useEffect(() => {
    if (!show || !selectedDates?.length) return;
    setDayFilter(getDefaultCycleTabIdForToday(selectedDates) as DayFilterOption);
  }, [show, selectedDatesKey, selectedDates]);

  useEffect(() => {
    // Load saved meal addresses from localStorage (用户隔离)
    const loadMealAddresses = async () => {
      let savedMealAddresses: Record<string, string> = { ...mealAddresses };
      const dbMealAddresses: Record<string, string> = {};

      let schedules: Awaited<ReturnType<typeof deliveryScheduleService.getUserDeliverySchedules>> = [];
      if (selectedDates?.length && selectedMealTypes?.length && user?.id) {
        schedules = await deliveryScheduleService.getUserDeliverySchedules(
          user.id,
          selectedDates[0],
          selectedDates[selectedDates.length - 1]
        );
        schedules.forEach((s) => {
          if (!s.delivery_address_id) return;
          dbMealAddresses[`${s.delivery_date}-${s.meal_type}`] = s.delivery_address_id;
        });

        const lockedFromStorage = await getUserStorageItem<string[]>('mealPlan_lockedMeals');
        if (!lockedFromStorage || lockedFromStorage.length === 0) {
          const lockedFromDb = schedules
            .filter((s) => s.is_locked)
            .map((s) => `${s.delivery_date}-${s.meal_type}`);
          if (lockedFromDb.length > 0) {
            setLockedMeals(new Set(lockedFromDb));
            setUserStorageItem('mealPlan_lockedMeals', lockedFromDb).catch(console.error);
          } else {
            const allKeys = selectedDates.flatMap((d) =>
              selectedMealTypes.map((m) => getMealKey(d, m))
            );
            setLockedMeals(new Set(allKeys));
            setUserStorageItem('mealPlan_lockedMeals', allKeys).catch(console.error);
          }
        }
      }

    const configs: DateMealConfig[] = [];

    // 基于地址的 default_meal_types 生成配送计划：每个餐次使用对应餐次的默认地址
    // 仅考虑显式配置了 default_meal_types 的地址，避免 is_default 导致多地址混入
    const getEffectiveDefaultForMeal = (mealType: string): string => {
      if (!addresses.length) return defaultAddressId || '';
      const mealAliases: Record<string, string[]> = {
        lunch: ['lunch', '午餐'],
        dinner: ['dinner', '晚餐'],
        breakfast: ['breakfast', '早餐']
      };
      const toMatch = mealAliases[mealType] || [mealType];
      const matchesMeal = (dmt: string[] | null | undefined) => {
        if (!dmt || !Array.isArray(dmt)) return false;
        if (dmt.includes('all')) return true;
        return toMatch.some(m => dmt.includes(m));
      };
      const withMeal = addresses.filter((addr) => matchesMeal(addr.default_meal_types));
      const preferred = withMeal.find((a) => a.is_default) || withMeal[0];
      if (preferred) return preferred.id;
      // 若用户已显式配置了默认餐次（且当前餐次无匹配），不要再兜底到任意默认地址，
      // 否则会把“缺餐次地址”静默吞掉，导致生成后才发现配送映射错误。
      const hasExplicitMealConfig = addresses.some((addr) =>
        Array.isArray(addr.default_meal_types) && addr.default_meal_types.length > 0
      );
      if (hasExplicitMealConfig) return '';
      const fallback = addresses.find((a) => a.is_default) || addresses[0];
      return fallback?.id || '';
    };

    // Clean up invalid address IDs from savedMealAddresses (when we have addresses)
    if (addresses.length > 0) {
      const validAddressIds = new Set(addresses.map(addr => addr.id));
      const cleanedMealAddresses: Record<string, string> = {};
      let hasInvalidAddresses = false;

      Object.entries(savedMealAddresses).forEach(([mealKey, addressId]) => {
        if (validAddressIds.has(addressId)) {
          cleanedMealAddresses[mealKey] = addressId;
        } else {
          hasInvalidAddresses = true;
        }
      });

      if (hasInvalidAddresses) {
        savedMealAddresses = cleanedMealAddresses;
        try {
          await saveMealAddresses(cleanedMealAddresses);
        } catch (error) {
          console.error('Failed to save cleaned meal addresses:', error);
        }
      }
    }

    if (!selectedDates || !selectedMealTypes) {
      console.warn('⚠️ [DeliveryPlanPage] selectedDates or selectedMealTypes is undefined');
      return;
    }

    selectedDates.forEach(date => {
      selectedMealTypes.forEach(mealType => {
        const mealKey = getMealKey(date, mealType);
        const effectiveDefault = getEffectiveDefaultForMeal(mealType);

        // 仅对用户明确编辑过的餐次使用 saved；其余按 default_meal_types 计算，避免全量误覆盖
        const validIds = new Set(addresses.map(a => a.id));
        const dbAddressId = dbMealAddresses[mealKey];
        const dbValid = !!(dbAddressId && validIds.has(dbAddressId));
        const savedValid = manuallyModifiedMeals.has(mealKey) && savedMealAddresses[mealKey] && validIds.has(savedMealAddresses[mealKey]);
        const pendingAddressId = pendingMealChanges[mealKey]?.nextAddressId;
        const pendingValid = !!(pendingAddressId && validIds.has(pendingAddressId));
        // 优先级：待确认修改 > 已手动修改本地 > DB快照 > 默认地址
        const addressId = pendingValid
          ? pendingAddressId
          : (savedValid
            ? savedMealAddresses[mealKey]
            : (dbValid ? dbAddressId : effectiveDefault));

        configs.push({
          date,
          mealType,
          addressId
        });
      });
    });

    setDateMealConfigs(configs);

    // 这里不做全量回写，避免初始化时把用户已确认的单餐修改误覆盖
    };

    loadMealAddresses();
  }, [selectedDates, selectedMealTypes, defaultAddressId, addresses, manuallyModifiedMeals, mealAddresses, saveMealAddresses, pendingMealChanges, user?.id]);

  // 交互约束：进入页面后默认先展示“待生成框架”，必须点击底部“生成配送计划”
  // 才进入可编辑/确认状态，不自动切到已生成视图。

  const loadAddresses = async (forceUpdate: boolean = false) => {
    void forceUpdate;
    try {
      await refreshAddresses();

    } catch (error) {
      console.error('Failed to load addresses:', error);
      setAlertState({
        show: true,
        type: 'error',
        title: '加载失败',
        message: '加载配送地址失败，请重试'
      });
    }
  };


  // 使用提取的锁定逻辑Hook
  const { isAutoLocked, isManuallyLocked, isMealLocked, getDayLockStatus } = useDeliveryPlanLock({
    lockedMeals,
    manuallyModifiedMeals,
    getMealKey,
  });

  const getCycleTabs = (): CycleTab[] => {
    if (!selectedDates || selectedDates.length === 0) {
      return [];
    }
    const totalDays = selectedDates.length;
    const fullCycles = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;
    const tabs: CycleTab[] = [];

    const weekLabels = ['第一周', '第二周', '第三周', '第四周', '第五周', '第六周'];

    for (let i = 0; i < fullCycles; i++) {
      tabs.push({
        id: `cycle-${i}`,
        label: weekLabels[i] || `第${i + 1}周`,
        ordinal: '',
        startIndex: i * 7,
        endIndex: (i + 1) * 7 - 1
      });
    }

    if (remainingDays > 0) {
      tabs.push({
        id: 'remainder',
        label: `余${remainingDays}天`,
        ordinal: '',
        startIndex: fullCycles * 7,
        endIndex: totalDays - 1
      });
    }

    return tabs;
  };

  const getFilteredDates = () => {
    if (!selectedDates || selectedDates.length === 0) {
      return [];
    }
    const tabs = getCycleTabs();
    const currentTab = tabs.find(tab => tab.id === dayFilter);

    if (!currentTab) {
      return selectedDates.slice(0, Math.min(7, selectedDates.length));
    }

    return selectedDates.slice(currentTab.startIndex, currentTab.endIndex + 1);
  };

  const getDateConfigs = (date: Date) => {
    const dateStr = toLocalDateString(date);
    return dateMealConfigs.filter(
      config => toLocalDateString(config.date) === dateStr
    );
  };


  const getAddressLabel = (addressId: string) => {
    if (!addressId) {
      return '未选择';
    }
    const address = addresses.find(addr => addr.id === addressId);
    if (!address) {
      return '未选择';
    }
    const label = address.label || address.tag || '地址';
    return label;
  };

  const handleAddressEdit = (date: Date, mealType: string) => {
    setEditingConfig({ date, mealType });
  };

  const setMealLocked = (date: Date, mealType: string, locked: boolean) => {
    const mealKey = getMealKey(date, mealType);
    setLockedMeals(prev => {
      const newSet = new Set(prev);
      if (locked) {
        newSet.add(mealKey);
      } else {
        newSet.delete(mealKey);
      }
      setUserStorageItem('mealPlan_lockedMeals', Array.from(newSet)).catch(error => {
        console.error('Failed to save locked meals:', error);
      });
      return newSet;
    });
  };

  const handleAddressChange = (date: Date, mealType: string, addressId: string, meta?: AddressChangeMeta) => {
    const mealKey = getMealKey(date, mealType);
    console.log('🔄 [handleAddressChange] Changing address for:', mealKey, 'to:', addressId);
    const previousConfig = dateMealConfigs.find(config => getMealKey(config.date, config.mealType) === mealKey);
    const previousAddressId = previousConfig?.addressId || '';
    if (previousAddressId === addressId) {
      return;
    }

    // Mark this meal as manually modified
    setManuallyModifiedMeals(prev => {
      const newSet = new Set(prev);
      newSet.add(mealKey);

      // Save to localStorage (用户隔离)
      setUserStorageItem('mealPlan_manuallyModifiedMeals', Array.from(newSet)).catch(error => {
        console.error('Failed to save manually modified meals:', error);
      });
      console.log('🔧 Marked meal as manually modified:', mealKey);

      return newSet;
    });

    setDateMealConfigs(prev => {
      const updated = prev.map(config => {
        if (getMealKey(config.date, config.mealType) === getMealKey(date, config.mealType) &&
            config.mealType === mealType) {
          return { ...config, addressId };
        }
        return config;
      });

      // Save to localStorage immediately
      const mealAddresses: Record<string, string> = {};
      updated.forEach(config => {
        const mealKey = getMealKey(config.date, config.mealType);
        mealAddresses[mealKey] = config.addressId;
      });

      saveMealAddresses(mealAddresses).then(() => {
        console.log('💾 [handleAddressChange] Saved meal addresses to localStorage:', mealAddresses);
        console.log('💾 [handleAddressChange] Updated configs count:', updated.length);
      }).catch(error => {
        console.error('Failed to save meal addresses:', error);
      });

      return updated;
    });
    setHasBatchPendingConfirm(false);

    const selectedAddress = addresses.find(addr => addr.id === addressId);
    const label = meta?.label || selectedAddress?.label || selectedAddress?.tag || '地址';
    const addressLine = [meta?.address || selectedAddress?.address || '', meta?.doorNumber || selectedAddress?.door_number || '']
      .filter(Boolean)
      .join(' ');
    const contactName = meta?.contactName || selectedAddress?.contact_name || '';
    const phone = meta?.phone || selectedAddress?.phone || '';

    setPendingMealChanges(prev => ({
      ...prev,
      [mealKey]: {
        mealKey,
        date,
        mealType,
        previousAddressId,
        nextAddressId: addressId,
        label,
        addressLine,
        contactName,
        phone,
      },
    }));
    console.log('✅ [handleAddressChange] Address change completed');
  };

  const handleLockToggle = (date: Date, mealType: string) => {
    const mealKey = getMealKey(date, mealType);
    const nextLocked = !lockedMeals.has(mealKey);
    setMealLocked(date, mealType, nextLocked);
    const addressId = dateMealConfigs.find(
      config => getMealKey(config.date, config.mealType) === mealKey
    )?.addressId || '';
    if (user?.id && addressId) {
      deliveryScheduleService
        .syncUserDeliverySchedules(user.id, [{ date, mealType, addressId, isLocked: nextLocked }], activeOrderId ?? undefined)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
        })
        .catch((error) => {
          console.warn('[DeliveryPlanPage] 手动锁定状态同步失败:', error);
          // 回滚本地锁定状态，确保前后端一致
          setMealLocked(date, mealType, !nextLocked);
          setAlertState({
            show: true,
            type: 'error',
            title: '锁定同步失败',
            message: '锁定状态未保存成功，已回滚，请稍后重试',
          });
        });
    }
  };

  const handlePendingConfirmClick = (date: Date, mealType: string) => {
    setPendingConfirmMealKey(getMealKey(date, mealType));
  };

  const handleCancelPendingMealChange = () => {
    if (!pendingConfirmMealKey) return;
    const pending = pendingMealChanges[pendingConfirmMealKey];
    if (!pending) {
      setPendingConfirmMealKey(null);
      return;
    }
    setDateMealConfigs(prev => {
      const updated = prev.map(config => {
        if (getMealKey(config.date, config.mealType) === pending.mealKey) {
          return { ...config, addressId: pending.previousAddressId };
        }
        return config;
      });
      const mealAddresses: Record<string, string> = {};
      updated.forEach(config => {
        mealAddresses[getMealKey(config.date, config.mealType)] = config.addressId;
      });
      saveMealAddresses(mealAddresses).catch(e => console.error('Failed to save meal addresses:', e));
      return updated;
    });
    setPendingMealChanges(prev => {
      const next = { ...prev };
      delete next[pendingConfirmMealKey];
      return next;
    });
    setPendingConfirmMealKey(null);
  };

  const handleConfirmPendingMealChange = async () => {
    if (!pendingConfirmMealKey) return;
    const pending = pendingMealChanges[pendingConfirmMealKey];
    if (!pending) {
      setPendingConfirmMealKey(null);
      return;
    }
    const confirmedMealKey = pending.mealKey;
    setPendingConfirmMealKey(null);

    setPendingAutoLockMealKeys((prev) => {
      const next = new Set(prev);
      next.add(confirmedMealKey);
      return next;
    });

    let syncSuccess = true;
    try {
      setMealLocked(pending.date, pending.mealType, true);
      if (user?.id) {
        await deliveryScheduleService.syncUserDeliverySchedules(user.id, [{
          date: pending.date,
          mealType: pending.mealType,
          addressId: pending.nextAddressId,
          isLocked: true,
        }], activeOrderId ?? undefined);
        queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
      }
    } catch (error) {
      console.warn('[DeliveryPlanPage] 单餐地址锁定同步失败:', error);
      syncSuccess = false;
      setMealLocked(pending.date, pending.mealType, false);
      setPendingAutoLockMealKeys((prev) => {
        const next = new Set(prev);
        next.delete(confirmedMealKey);
        return next;
      });
      setAlertState({
        show: true,
        type: 'error',
        title: '保存失败',
        message: '单餐地址同步失败，已回滚本地锁定状态，请稍后重试',
      });
    }

    if (!syncSuccess) {
      return;
    }

    // 单餐确认后立即持久化：localStorage + user_profiles.meal_plan_config_data
    try {
      const mealAddresses: Record<string, string> = {};
      dateMealConfigs.forEach(config => {
        mealAddresses[getMealKey(config.date, config.mealType)] = config.addressId;
      });
      await saveMealAddresses(mealAddresses);

      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      await saveMealPlanConfig(user?.id || null, {
        selectedDates: sortedDates,
        selectedMealTypes,
        // 单餐确认不应改动“全局默认地址”
        deliveryAddressId: defaultAddressId || '',
        startDate: sortedDates[0] || new Date(),
        endDate: sortedDates[sortedDates.length - 1] || new Date(),
      });
    } catch (e) {
      console.warn('[DeliveryPlanPage] 单餐确认后持久化失败:', e);
    }

    // 与移除「锁定中」同一阶段更新，避免在持久化期间先去掉 autoLock 又仍保留 pending 导致「确认」按钮闪回
    setPendingMealChanges((prev) => {
      const next = { ...prev };
      delete next[confirmedMealKey];
      return next;
    });
    setPendingAutoLockMealKeys((prev) => {
      const next = new Set(prev);
      next.delete(confirmedMealKey);
      return next;
    });
  };

  const handleConfirmClick = async () => {
    console.log('[DeliveryPlanPage] handleConfirmClick 被调用', { planGenerated, selectedDatesLen: selectedDates?.length, selectedMealTypesLen: selectedMealTypes?.length });
    const toMealLabel = (mealType: string) => {
      const v = String(mealType || '').toLowerCase();
      if (v === 'breakfast' || v === '早餐') return '早餐';
      if (v === 'lunch' || v === '午餐') return '午餐';
      if (v === 'dinner' || v === '晚餐') return '晚餐';
      return v || '未知餐次';
    };
    const expectedCount = (selectedDates?.length || 0) * (selectedMealTypes?.length || 0);
    if (expectedCount > 0 && dateMealConfigs.length < expectedCount) {
      setAlertState({
        show: true,
        type: 'info',
        title: '请稍候',
        message: '正在加载餐次与地址映射，请稍后再试。',
      });
      return;
    }
    const missingAddressConfigs = dateMealConfigs.filter((c) => !c.addressId);
    if (missingAddressConfigs.length > 0) {
      const missingMeals = Array.from(new Set(missingAddressConfigs.map((c) => toMealLabel(c.mealType))));
      setAlertState({
        show: true,
        type: 'warning',
        title: '地址配置不完整',
        message:
          `以下餐次缺少配送地址：${missingMeals.join('、')}。` +
          '请新增地址，或在默认地址中补齐对应餐次后再生成配送计划。',
      });
      return;
    }
    if (!planGenerated) {
      if (!selectedDates?.length || !selectedMealTypes?.length) {
        console.warn('[DeliveryPlanPage] 无法生成：selectedDates或selectedMealTypes为空', {
          selectedDatesLen: selectedDates?.length,
          selectedMealTypesLen: selectedMealTypes?.length
        });
        setAlertState({
          show: true,
          type: 'warning',
          title: '无法生成',
          message: '请先选择配送日期和餐次。若从「我的配送计划」进入，请先完成日期配置。'
        });
        return;
      }
      console.log('[DeliveryPlanPage] 开始生成配送计划');
      setIsGenerating(true);
      try {
        // 重新生成时清除旧缓存，强制使用当前默认地址
        const keysToClear = selectedDates.flatMap((d) =>
          selectedMealTypes.map((m) => getMealKey(d, m))
        );
        const cleanedMealAddresses = { ...mealAddresses };
        keysToClear.forEach((k) => delete cleanedMealAddresses[k]);
        await saveMealAddresses(cleanedMealAddresses);

        const newModified = new Set(manuallyModifiedMeals);
        keysToClear.forEach((k) => newModified.delete(k));
        setManuallyModifiedMeals(newModified);
        await setUserStorageItem('mealPlan_manuallyModifiedMeals', Array.from(newModified));

        setPlanGenerated(true);
        setHasBatchPendingConfirm(true);
      } catch (err) {
        console.error('[DeliveryPlanPage] 生成配送计划失败:', err);
        setAlertState({
          show: true,
          type: 'error',
          title: '生成失败',
          message: err instanceof Error ? err.message : '生成配送计划时发生错误，请重试'
        });
      } finally {
        setIsGenerating(false);
      }
      return;
    }
    if (!hasBatchPendingConfirm) return;
    // 弹窗在 App 层级，与 DeliveryPlanPage 分离，避免 removeChild 错误
    const mealAddressesForConfirm: Record<string, string> = {};
    dateMealConfigs.forEach(config => {
      mealAddressesForConfirm[getMealKey(config.date, config.mealType)] = config.addressId;
    });
    const filteredDates = (selectedDates || []).filter(date =>
      !excludedDates.some(excluded => excluded.toDateString() === date.toDateString())
    );
    const lockedDaysSet = new Set<string>();
    filteredDates.forEach(date => {
      const dateConfigs = getDateConfigs(date);
      const isFullyLocked = dateConfigs.length > 0 && dateConfigs.every(config =>
        isMealLocked(date, config.mealType)
      );
      if (isFullyLocked) lockedDaysSet.add(toLocalDateString(date));
    });
    const sortedDates = [...filteredDates].sort((a, b) => a.getTime() - b.getTime());
    const data: DeliveryPlanConfirmationData = {
      mealAddresses: mealAddressesForConfirm,
      startDate: sortedDates[0],
      endDate: sortedDates[sortedDates.length - 1],
      excludedDates: excludedDates || [],
      lockedDaysCount: lockedDaysSet.size,
      unlockedDaysCount: filteredDates.length - lockedDaysSet.size,
    };
    onRequestConfirmation(data);
  };

  const headerContent = (
    <>
      {/* Header - 使用通用标题栏 */}
      <SecondaryPageHeader 
        title="配置配送计划" 
        onClose={onClose}
      />
      
      {/* 配送时间说明和 Day Filter Buttons */}
      <div className="px-4 py-2 border-b border-gray-100">
        <p className="text-xs text-gray-500 text-center mb-2">
          午餐 11:30-12:30  晚餐 17:30-18:30
        </p>
        {/* Day Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {getCycleTabs().map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDayFilter(tab.id)}
              className={`relative flex-shrink-0 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                dayFilter === tab.id
                  ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {tab.ordinal && (
                <span className={`absolute top-1 right-1.5 text-xs font-semibold leading-none ${
                  dayFilter === tab.id ? 'text-white opacity-80' : 'text-gray-600'
                }`}>
                  {tab.ordinal}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const footerContent = (
    (!planGenerated || hasBatchPendingConfirm) ? (
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleConfirmClick();
          }}
          disabled={isGenerating}
          className="w-full py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-xl font-medium shadow-md hover:from-green-500 hover:to-emerald-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] touch-manipulation"
        >
          {isGenerating ? '生成中...' : planGenerated ? '确认配送计划' : '生成配送计划'}
        </button>
      </div>
    ) : null
  );

  return (
    <>
    <DrawerScreen show={show} onClose={onClose} showDragHandle={false}>
      <div className="flex flex-col h-full bg-white overflow-hidden">
        {/* Header */}
        {headerContent}
        
        {/* Two-Column Table Section */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex-1 flex justify-center items-center min-h-[200px]">
              <div className="text-gray-500">加载中...</div>
            </div>
          )}

          {!loading && isGenerating && (
            <div className="flex-1 flex flex-col justify-center items-center min-h-[300px]">
              <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600 font-medium">生成中...</p>
            </div>
          )}

          {!loading && !isGenerating && !planGenerated && (
            <div className="flex-1 flex flex-col justify-center items-center min-h-[300px] px-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm w-full max-w-md">
                <div className="grid grid-cols-[130px_1fr] bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <div className="px-4 py-3 text-sm font-semibold text-gray-700 border-r border-gray-200">配送日期</div>
                  <div className="px-4 py-3 text-sm font-semibold text-gray-700">配送计划</div>
                </div>
                <div className="divide-y divide-gray-200">
                  {(selectedDates || []).slice(0, 5).map((date) => (
                    <div key={date.toISOString()} className="grid grid-cols-[130px_1fr] py-4 px-4">
                      <div className="text-sm text-gray-500 border-r border-gray-100 pr-4">
                        {getDateLabel(date)}
                      </div>
                      <div className="text-sm text-gray-400">—</div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-4">点击下方「生成配送计划」按地址与餐次对应关系生成</p>
            </div>
          )}

          {!loading && !isGenerating && planGenerated && (
            <DeliveryPlanTable
              dates={getFilteredDates()}
              dateMealConfigs={dateMealConfigs}
              isMealLocked={isMealLocked}
              isManuallyLocked={isManuallyLocked}
              isAutoLocked={isAutoLocked}
              getDayLockStatus={getDayLockStatus}
              getAddressLabel={getAddressLabel}
              pendingConfirmMealKeys={new Set(Object.keys(pendingMealChanges))}
              pendingAutoLockMealKeys={pendingAutoLockMealKeys}
              onAddressEdit={handleAddressEdit}
              onLockToggle={handleLockToggle}
              onPendingConfirmClick={handlePendingConfirmClick}
            />
          )}
        </div>

        {/* Footer */}
        {footerContent}
      </div>
    </DrawerScreen>

      {/* Address Selection Modal */}
      <AddressSelectionModal
        show={!!editingConfig && !showAddAddressPage}
        editingConfig={editingConfig}
        addresses={addresses}
        dateMealConfigs={dateMealConfigs}
        onAddressChange={handleAddressChange}
        onClose={() => setEditingConfig(null)}
        onAddAddress={() => setShowAddAddressPage(true)}
      />

      {/* Add Address Page */}
      {showAddAddressPage && editingConfig && (
        <AddDeliveryAddressPage
          show={showAddAddressPage}
          orderMealTypes={selectedMealTypes}
          openAddFormDirectly={false}
          onClose={() => {
            // 返回选择地址弹窗前先刷新地址，确保新增地址即时可见
            loadAddresses(true).finally(() => {
              setShowAddAddressPage(false);
            });
          }}
          onComplete={(deliveryAddressId, meta) => {
            console.log('🎯 [DeliveryPlanPage] onComplete called with addressId:', deliveryAddressId);
            // Update the address for the current editing config
            if (editingConfig) {
              console.log('📝 [DeliveryPlanPage] Updating config:', editingConfig, 'with addressId:', deliveryAddressId);
              handleAddressChange(editingConfig.date, editingConfig.mealType, deliveryAddressId, meta);
            }
            if (meta?.hasDefaultMealTypes) {
              setHasBatchPendingConfirm(true);
            }
            // 从“选择配送地址 +”新增后：回到地址选择弹窗，并默认选中新地址
            if (meta?.fromQuickAdd) {
              console.log('🔄 [DeliveryPlanPage] Reloading addresses...');
              loadAddresses(true).finally(() => {
                setShowAddAddressPage(false);
              });
              return;
            }
            setEditingConfig(null);
            setTimeout(() => {
              console.log('🔄 [DeliveryPlanPage] Reloading addresses...');
              loadAddresses(true).finally(() => {
                setShowAddAddressPage(false);
              });
            }, 500);
          }}
        />
      )}

      <ConfirmModal
        show={!!pendingConfirmMealKey}
        title="确认地址修改"
        message={
          pendingConfirmMealKey && pendingMealChanges[pendingConfirmMealKey] ? (
            <div className="space-y-1">
              <p>你已修改 1天1餐 的配送地址为【{pendingMealChanges[pendingConfirmMealKey].label}】</p>
              <p className="text-gray-700">{pendingMealChanges[pendingConfirmMealKey].addressLine || '—'}</p>
              <p className="text-gray-700">联系人：{pendingMealChanges[pendingConfirmMealKey].contactName || '—'}</p>
              <p className="text-gray-700">联系方式：{pendingMealChanges[pendingConfirmMealKey].phone || '—'}</p>
              <p className="text-xs text-gray-500 mt-1">确认后将锁定该餐次的新地址。</p>
            </div>
          ) : ''
        }
        onCancel={handleCancelPendingMealChange}
        onConfirm={handleConfirmPendingMealChange}
        cancelText="取消"
        confirmText="确认"
        confirmColor="green"
        zIndex={86}
      />

      {/* Alert Dialog */}
      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState(prev => ({ ...prev, show: false }))}
        zIndex={90}
      />
    </>
  );
};

export default DeliveryPlanPage;
