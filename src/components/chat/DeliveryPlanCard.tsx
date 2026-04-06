/**
 * 配送计划卡片 - 在对话窗口内展示配送安排（餐次+地址）
 * 默认展示今日，底部箭头可展开未来一周
 * 编辑按钮打开地址选择弹窗，不跳转页面
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { X, MapPin, Edit2, Lock, Unlock, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useExecutionProgram } from '../../hooks/useExecutionProgram';
import { useContractMealSlotsEn } from '../../hooks/useContractMealSlotsEn';
import { useAddressesQuery } from '../../hooks/useAddressesQuery';
import { getUserStorageItem, setUserStorageItem } from '../../utils/userStorage';
import { useMealAddressesMapping } from '../../hooks/useMealAddressesMapping';
import { getMealPlanConfig } from '../../services/mealPlanConfigService';
import { deliveryScheduleService } from '../../services/deliveryScheduleService';
import { getMealTypeLabel, getMealKey, getDateLabel } from '../../utils/deliveryPlanUtils';
import { toLocalDateString } from '../../utils/dateUtils';
import { AddressSelectionModal } from '../delivery/AddressSelectionModal';
import { getDeliveryMealStartTime } from '../../constants/deliveryMealTimes';
import { INTAKE_PLAN_INACTIVE_USER_MESSAGE } from '../../utils/intakePlanGate';

export interface DeliveryPlanCardProps {
  onClose: () => void;
  /** 需要添加地址时打开完整配送计划页 */
  onAddAddress?: () => void;
}

function isMealAutoLocked(date: Date, mealType: string): boolean {
  const now = new Date();
  const deliveryDate = new Date(date);
  const time = getDeliveryMealStartTime(mealType);
  if (!time) return false;
  const [h, m] = time.split(':').map(Number);
  deliveryDate.setHours(h, m, 0, 0);
  const lockTime = new Date(deliveryDate.getTime() - 60 * 60 * 1000);
  return now >= lockTime;
}

interface DateMealConfig {
  date: Date;
  mealType: string;
  addressId: string;
}

export default function DeliveryPlanCard({
  onClose,
  onAddAddress,
}: DeliveryPlanCardProps) {
  const { user } = useAuth();
  const { hasOrder, isLoadingOrder, program } = useExecutionProgram();
  const { data: contractSlotsEn } = useContractMealSlotsEn();
  const queryClient = useQueryClient();
  const { mealPlanConfig: contextConfig, intakePlanActive } = useUserProfile();
  const { addresses, refresh: refreshAddresses } = useAddressesQuery();
  const { mealAddresses, setMealAddress, refreshMealAddresses } = useMealAddressesMapping();
  const [localConfig, setLocalConfig] = useState<Awaited<ReturnType<typeof getMealPlanConfig>>>(null);
  const [lockedMeals, setLockedMeals] = useState<Set<string>>(new Set());
  const [editingConfig, setEditingConfig] = useState<{ date: Date; mealType: string } | null>(null);
  const [pendingConfirmMealKeys, setPendingConfirmMealKeys] = useState<Set<string>>(new Set());
  const [pendingAutoLockMealKeys, setPendingAutoLockMealKeys] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState('');

  useEffect(() => {
    if (hasOrder && !intakePlanActive) setExpanded(false);
  }, [hasOrder, intakePlanActive]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = useMemo(() => toLocalDateString(today), [today]);

  useEffect(() => {
    getUserStorageItem<string[]>('mealPlan_lockedMeals').then((arr) => {
      setLockedMeals(new Set(arr || []));
    });
  }, []);

  const { data: dbSchedules = [] } = useQuery({
    queryKey: ['delivery-plan-card', user?.id, todayStr, expanded],
    queryFn: async () => {
      if (!user?.id) return [];
      if (!hasOrder) return [];
      if (expanded) {
        const end = new Date(today);
        end.setDate(end.getDate() + 6);
        return deliveryScheduleService.getUserDeliverySchedules(user.id, today, end);
      }
      return deliveryScheduleService.getDeliverySchedulesByDate(user.id, today);
    },
    enabled: !!user?.id && !isLoadingOrder && intakePlanActive,
  });

  useEffect(() => {
    getMealPlanConfig(user?.id ?? null).then(setLocalConfig);
  }, [user?.id]);

  const mealPlanConfig = contextConfig ?? localConfig;

  const getAddressLabel = useCallback((addressId?: string) => {
    if (!addressId) return '未设置';
    const addr = addresses.find((a) => a.id === addressId);
    return addr?.label || addr?.tag || '未设置';
  }, [addresses]);

  const buildItemsForDate = useCallback(
    (date: Date): { mealType: string; label: string; addressId: string }[] => {
      if (!hasOrder) return [];
      const clampContract = (
        items: { mealType: string; label: string; addressId: string }[]
      ) => {
        if (!contractSlotsEn?.length) return items;
        const allow = new Set(contractSlotsEn.map((s) => String(s).toLowerCase()));
        return items.filter((i) => allow.has(String(i.mealType).toLowerCase()));
      };
      const dateStr = toLocalDateString(date);
      const dateSchedules = (dbSchedules as { delivery_date: string; meal_type: string; delivery_address_id?: string }[]).filter(
        (s) => s.delivery_date === dateStr
      );
      if (dateSchedules.length > 0) {
        // 按 meal_type 去重，避免同一餐次重复显示（取最后一条）
        const byMeal = new Map<string, typeof dateSchedules[0]>();
        dateSchedules.forEach((s) => byMeal.set(s.meal_type, s));
        const order = ['breakfast', 'lunch', 'dinner'];
        return clampContract(
          Array.from(byMeal.values())
            .sort((a, b) => order.indexOf(a.meal_type) - order.indexOf(b.meal_type))
            .map((s) => {
              const mealKey = getMealKey(date, s.meal_type);
              const mapped = mealAddresses[mealKey];
              // 本地餐次→地址（含弹窗快捷切换）优先于排期表快照，否则切换后仍显示旧「家/公司」
              const addressId =
                mapped && mapped.trim() !== ''
                  ? mapped
                  : (s.delivery_address_id || '');
              return {
                mealType: s.meal_type,
                label: getAddressLabel(addressId),
                addressId: addressId || '',
              };
            })
        );
      }
      if (mealPlanConfig?.selectedMealTypes?.length) {
        const start = new Date(mealPlanConfig.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(mealPlanConfig.endDate);
        end.setHours(0, 0, 0, 0);
        if (date >= start && date <= end) {
          const hasSelectedDates = mealPlanConfig.selectedDates?.length > 0;
          const isDateSelected =
            !hasSelectedDates ||
            mealPlanConfig.selectedDates.some((d) => {
              const d2 = new Date(d);
              d2.setHours(0, 0, 0, 0);
              return toLocalDateString(d2) === dateStr;
            });
          if (isDateSelected) {
            return clampContract(
              mealPlanConfig.selectedMealTypes.map((mealType) => {
                const mealKey = getMealKey(date, mealType);
                const addressId =
                  mealAddresses[mealKey] ?? mealPlanConfig.deliveryAddressId ?? '';
                return {
                  mealType,
                  label: getAddressLabel(addressId),
                  addressId,
                };
              })
            );
          }
        }
      }
      const order = ['breakfast', 'lunch', 'dinner'];
      const fromMealAddresses: { mealType: string; label: string; addressId: string }[] = [];
      for (const [key, addressId] of Object.entries(mealAddresses)) {
        const parts = key.split('-');
        let datePart = '';
        let mealType = '';
        if (parts.length >= 4) {
          datePart = parts.slice(0, 3).join('-');
          mealType = parts[3];
        } else if (parts.length === 2) {
          [datePart, mealType] = parts;
        }
        if (datePart === dateStr && addressId) {
          fromMealAddresses.push({
            mealType,
            label: getAddressLabel(addressId),
            addressId,
          });
        }
      }
      fromMealAddresses.sort((a, b) => order.indexOf(a.mealType) - order.indexOf(b.mealType));
      return clampContract(fromMealAddresses);
    },
    [hasOrder, dbSchedules, mealPlanConfig, mealAddresses, contractSlotsEn, getAddressLabel]
  );

  const items = React.useMemo(
    () => buildItemsForDate(today),
    [buildItemsForDate, today]
  );

  const dates = React.useMemo(() => {
    if (!expanded) return [today];
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [expanded, today]);

  const dateMealConfigs = React.useMemo((): DateMealConfig[] => {
    const configs: DateMealConfig[] = [];
    dates.forEach((date) => {
      const its = buildItemsForDate(date);
      its.forEach((it) => {
        const mealKey = getMealKey(date, it.mealType);
        const addressId = it.addressId || mealAddresses[mealKey] || mealPlanConfig?.deliveryAddressId || '';
        configs.push({ date, mealType: it.mealType, addressId });
      });
    });
    if (editingConfig) {
      const key = getMealKey(editingConfig.date, editingConfig.mealType);
      const exists = configs.some(
        (c) =>
          toLocalDateString(c.date) === toLocalDateString(editingConfig.date) &&
          c.mealType === editingConfig.mealType
      );
      if (!exists) {
        configs.push({
          date: editingConfig.date,
          mealType: editingConfig.mealType,
          addressId: mealAddresses[key] || mealPlanConfig?.deliveryAddressId || '',
        });
      }
    }
    return configs;
  }, [dates, buildItemsForDate, mealAddresses, mealPlanConfig, editingConfig]);

  const setMealLocked = useCallback((date: Date, mealType: string, locked: boolean) => {
    const mealKey = getMealKey(date, mealType);
    setLockedMeals((prev) => {
      const next = new Set(prev);
      if (locked) next.add(mealKey);
      else next.delete(mealKey);
      setUserStorageItem('mealPlan_lockedMeals', Array.from(next)).catch(console.error);
      return next;
    });
  }, []);

  const showSyncError = useCallback((message: string) => {
    setSyncErrorMessage(message);
    setTimeout(() => setSyncErrorMessage(''), 4000);
  }, []);

  const handleLockToggle = useCallback(
    async (date: Date, mealType: string) => {
      const mealKey = getMealKey(date, mealType);
      const nextLocked = !lockedMeals.has(mealKey);
      setMealLocked(date, mealType, nextLocked);
      const addressId = dateMealConfigs.find(
        (c) =>
          toLocalDateString(c.date) === toLocalDateString(date) &&
          c.mealType === mealType
      )?.addressId || mealAddresses[mealKey] || '';
      if (user?.id && addressId) {
        deliveryScheduleService
          .syncUserDeliverySchedules(
            user.id,
            [{ date, mealType, addressId, isLocked: nextLocked }],
            program?.order_id || undefined
          )
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
          })
          .catch((error) => {
            console.warn('[DeliveryPlanCard] 手动锁定状态同步失败:', error);
            // 回滚本地状态，避免和数据库不一致
            setMealLocked(date, mealType, !nextLocked);
            showSyncError('锁定状态同步失败，已回滚，请稍后重试');
          });
      }
    },
    [lockedMeals, setMealLocked, dateMealConfigs, mealAddresses, queryClient, showSyncError, user?.id, program?.order_id]
  );

  const isMealLocked = (date: Date, mealType: string) => {
    const mealKey = getMealKey(date, mealType);
    return lockedMeals.has(mealKey) || isMealAutoLocked(date, mealType);
  };

  const isManuallyLocked = (date: Date, mealType: string) =>
    lockedMeals.has(getMealKey(date, mealType));
  const isAutoLocked = (date: Date, mealType: string) => isMealAutoLocked(date, mealType);

  /** 与配置配送计划页一致：获取日期锁定状态（全部锁定/部分锁定/未锁定） */
  const getDayLockStatus = (
    date: Date,
    dateItems: { mealType: string }[]
  ): 'full' | 'partial' | 'none' => {
    if (dateItems.length === 0) return 'none';
    const lockedCount = dateItems.filter((item) => isMealLocked(date, item.mealType)).length;
    if (lockedCount === 0) return 'none';
    if (lockedCount === dateItems.length) return 'full';
    return 'partial';
  };

  const handleAddressChange = useCallback(
    (date: Date, mealType: string, addressId: string) => {
      const mealKey = getMealKey(date, mealType);
      const previousAddressId =
        dateMealConfigs.find(
          (c) => toLocalDateString(c.date) === toLocalDateString(date) && c.mealType === mealType
        )?.addressId || mealAddresses[mealKey] || '';
      if (previousAddressId === addressId) {
        setEditingConfig(null);
        return;
      }
      setMealAddress(mealKey, addressId).catch(console.error);
      setPendingConfirmMealKeys((prev) => {
        const next = new Set(prev);
        next.add(mealKey);
        return next;
      });
      setPendingAutoLockMealKeys((prev) => {
        const next = new Set(prev);
        next.delete(mealKey);
        return next;
      });
      setEditingConfig(null);
    },
    [dateMealConfigs, mealAddresses, setMealAddress]
  );

  const handlePendingConfirmClick = useCallback((date: Date, mealType: string) => {
    const mealKey = getMealKey(date, mealType);
    const addressId = dateMealConfigs.find(
      (c) =>
        toLocalDateString(c.date) === toLocalDateString(date) &&
        c.mealType === mealType
    )?.addressId || mealAddresses[mealKey] || '';
    setPendingConfirmMealKeys((prev) => {
      const next = new Set(prev);
      next.delete(mealKey);
      return next;
    });
    setPendingAutoLockMealKeys((prev) => {
      const next = new Set(prev);
      next.add(mealKey);
      return next;
    });
    if (user?.id && addressId) {
      deliveryScheduleService
        .syncUserDeliverySchedules(
          user.id,
          [{ date, mealType, addressId, isLocked: false }],
          program?.order_id || undefined
        )
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
        })
        .catch((error) => {
          console.warn('[DeliveryPlanCard] 单餐地址同步失败:', error);
          showSyncError('单餐地址同步失败，请重试');
        });
    }
    setTimeout(() => {
      setMealLocked(date, mealType, true);
      if (user?.id && addressId) {
        deliveryScheduleService
          .syncUserDeliverySchedules(
            user.id,
            [{ date, mealType, addressId, isLocked: true }],
            program?.order_id || undefined
          )
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
          })
          .catch((error) => {
            console.warn('[DeliveryPlanCard] 自动锁定状态同步失败:', error);
            showSyncError('自动锁定同步失败，请手动刷新后重试');
          });
      }
      setPendingAutoLockMealKeys((prev) => {
        const next = new Set(prev);
        next.delete(mealKey);
        return next;
      });
    }, 2000);
  }, [setMealLocked, dateMealConfigs, mealAddresses, user?.id, queryClient, showSyncError, program?.order_id]);

  const renderMealActions = (date: Date, mealType: string) => {
    const mealKey = getMealKey(date, mealType);
    const locked = isMealLocked(date, mealType);
    const manualLocked = isManuallyLocked(date, mealType);
    const autoLocked = isAutoLocked(date, mealType);
    const isPendingConfirm = pendingConfirmMealKeys.has(mealKey);
    const isPendingAutoLock = pendingAutoLockMealKeys.has(mealKey);

    if (isPendingConfirm) {
      return (
        <button
          onClick={() => handlePendingConfirmClick(date, mealType)}
          className="px-2 py-1 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          title="确认本餐次地址修改并锁定"
        >
          确认
        </button>
      );
    }

    if (isPendingAutoLock) {
      return (
        <span
          className="px-2 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
          title="2秒后将自动锁定"
        >
          锁定中
        </span>
      );
    }

    return (
      <>
        {!locked ? (
          <button
            onClick={() => handleEditClick(date, mealType)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="修改"
          >
            <Edit2 className="w-4 h-4 text-gray-500" />
          </button>
        ) : (
          <div
            className="p-1.5 opacity-50 cursor-not-allowed"
            title="已锁定不可修改"
          >
            <Edit2 className="w-4 h-4 text-gray-400" />
          </div>
        )}
        {!autoLocked && (
          <button
            onClick={() => handleLockToggle(date, mealType)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title={manualLocked ? '点击解锁' : '点击锁定'}
          >
            {manualLocked ? (
              <Lock className="w-4 h-4 text-gray-700" />
            ) : (
              <Unlock className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
        {autoLocked && (
          <div
            className="p-1"
            title="配送前1小时自动锁定"
          >
            <Lock className="w-4 h-4 text-gray-500" />
          </div>
        )}
      </>
    );
  };

  const handleEditClick = async (date: Date, mealType: string) => {
    if (isMealLocked(date, mealType)) return;
    await refreshAddresses().catch(console.error);
    await refreshMealAddresses().catch(console.error);
    setEditingConfig({ date, mealType });
  };

  return (
    <>
      <div className="mb-3 rounded-2xl bg-white shadow-lg overflow-hidden">
        <div className="px-3 py-2.5 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">
              {expanded ? '配送计划' : '今日配送'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200/80">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="px-3 py-3 max-h-[60vh] overflow-y-auto">
          {syncErrorMessage ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {syncErrorMessage}
            </div>
          ) : null}
          {hasOrder && !intakePlanActive ? (
            <p className="text-sm text-gray-600 py-4 text-center px-2 leading-relaxed">{INTAKE_PLAN_INACTIVE_USER_MESSAGE}</p>
          ) : expanded ? (
            <div className="space-y-4">
              {dates.map((date) => {
                const dateItems = buildItemsForDate(date);
                return (
                  <div
                    key={toLocalDateString(date)}
                    className="rounded-xl bg-blue-50/45 overflow-hidden"
                  >
                    <div className="px-3 py-2 flex items-center justify-between bg-blue-100/50 border-b border-blue-200/50">
                      <span className="text-sm font-medium text-gray-800">
                        {getDateLabel(date)}
                      </span>
                      {dateItems.length > 0 && (() => {
                        const lockStatus = getDayLockStatus(date, dateItems);
                        return (
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              lockStatus === 'full' ? 'bg-green-500' :
                              lockStatus === 'partial' ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}
                            title={
                              lockStatus === 'full' ? '已全部锁定' :
                              lockStatus === 'partial' ? '部分锁定' : '待锁定'
                            }
                          >
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="p-2.5 space-y-2">
                      {dateItems.length === 0 ? (
                        <p className="text-xs text-gray-500 py-1">暂无配送</p>
                      ) : (
                        dateItems.map(({ mealType, label }) => {
                          return (
                            <div
                              key={mealType}
                              className="flex items-center justify-between py-2 px-2 rounded-lg bg-white/60"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-medium text-gray-800 text-sm">
                                  {getMealTypeLabel(mealType)}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  {label}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                {renderMealActions(date, mealType)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {!hasOrder ? (
                <p className="text-sm text-gray-500 py-4 text-center">当前无有效订单，暂无配送计划</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">今日暂无配送计划</p>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    {getDateLabel(today)}
                  </div>
                  {items.map(({ mealType, label }) => {
                    return (
                      <div
                        key={mealType}
                        className="flex items-center justify-between rounded-xl bg-blue-50/45 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium text-gray-800">
                            {getMealTypeLabel(mealType)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          {renderMealActions(today, mealType)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        {/* 底部展开/收起箭头 */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          disabled={hasOrder && !intakePlanActive}
          className={`w-full py-2 flex items-center justify-center gap-1 text-sm border-t border-gray-100 transition-colors ${
            hasOrder && !intakePlanActive
              ? 'text-gray-400 cursor-not-allowed bg-gray-50'
              : 'text-blue-600 hover:bg-blue-50/50'
          }`}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>收起</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              <span>展开未来一周</span>
            </>
          )}
        </button>
      </div>

      <AddressSelectionModal
        show={!!editingConfig}
        editingConfig={editingConfig}
        addresses={addresses}
        dateMealConfigs={dateMealConfigs}
        onAddressChange={handleAddressChange}
        onClose={() => setEditingConfig(null)}
        onAddAddress={() => {
          setEditingConfig(null);
          onAddAddress?.();
        }}
      />
    </>
  );
}
