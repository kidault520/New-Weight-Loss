/**
 * DeliveryPlanTable - 配送计划表格组件
 * 从DeliveryPlanPage.tsx中提取的表格渲染逻辑
 * 符合架构规范：单一职责，代码复用
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Lock, Unlock, Check } from 'lucide-react';
import { getMealTypeLabel, getDateLabel, getMealKey } from '../../utils/deliveryPlanUtils';
import { toLocalDateString } from '../../utils/dateUtils';
import { getDeliveryMealStartTime } from '../../constants/deliveryMealTimes';

interface DateMealConfig {
  date: Date;
  mealType: string;
  addressId: string;
}

interface DeliveryPlanTableProps {
  dates: Date[];
  dateMealConfigs: DateMealConfig[];
  isMealLocked: (date: Date, mealType: string) => boolean;
  isManuallyLocked: (date: Date, mealType: string) => boolean;
  isAutoLocked: (date: Date, mealType: string) => boolean;
  getDayLockStatus: (date: Date, dateConfigs: DateMealConfig[]) => 'full' | 'partial' | 'none';
  getAddressLabel: (addressId: string) => string;
  pendingConfirmMealKeys: Set<string>;
  pendingAutoLockMealKeys: Set<string>;
  onAddressEdit: (date: Date, mealType: string) => void;
  onLockToggle: (date: Date, mealType: string) => void;
  onPendingConfirmClick: (date: Date, mealType: string) => void;
}

export const DeliveryPlanTable: React.FC<DeliveryPlanTableProps> = ({
  dates,
  dateMealConfigs,
  isMealLocked,
  isManuallyLocked,
  isAutoLocked,
  getDayLockStatus,
  getAddressLabel,
  pendingConfirmMealKeys,
  pendingAutoLockMealKeys,
  onAddressEdit,
  onLockToggle,
  onPendingConfirmClick,
}) => {
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDateConfigs = (date: Date) => {
    return dateMealConfigs.filter(
      config => toLocalDateString(config.date) === toLocalDateString(date)
    );
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayNearestLockCountdown = useMemo(() => {
    const now = new Date(nowTs);
    const todayStr = toLocalDateString(now);
    const candidates = dateMealConfigs
      .filter((config) => toLocalDateString(config.date) === todayStr)
      .map((config) => {
        const mealType = String(config.mealType || '').toLowerCase();
        const startTime = getDeliveryMealStartTime(mealType);
        if (!startTime) return null;

        const [hh, mm] = startTime.split(':').map(Number);
        const lockAt = new Date(now);
        lockAt.setHours(hh, mm, 0, 0);
        lockAt.setMinutes(lockAt.getMinutes() - 60); // 配送前1小时进入锁定窗口

        const minutesLeft = Math.ceil((lockAt.getTime() - now.getTime()) / 60000);
        if (minutesLeft <= 0) return null;

        return {
          mealKey: getMealKey(config.date, config.mealType),
          minutesLeft,
          hoursLeft: Math.max(0.1, Math.round((minutesLeft / 60) * 10) / 10),
          mealType: config.mealType,
          lockAtText: `${String(lockAt.getHours()).padStart(2, '0')}:${String(lockAt.getMinutes()).padStart(2, '0')}`,
        };
      })
      .filter((item): item is { mealKey: string; minutesLeft: number; hoursLeft: number; mealType: string; lockAtText: string } => !!item)
      .sort((a, b) => a.minutesLeft - b.minutesLeft);

    return candidates[0] || null;
  }, [dateMealConfigs, nowTs]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-[130px_1fr] bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="px-4 py-3 text-sm font-semibold text-gray-700 border-r border-gray-200">
            配送日期
          </div>
          <div className="px-4 py-3 text-sm font-semibold text-gray-700">
            配送计划
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-gray-200">
          {dates.map((date) => {
            const configs = getDateConfigs(date);
            const lockStatus = getDayLockStatus(date, configs);
            const dateOnly = new Date(date);
            dateOnly.setHours(0, 0, 0, 0);
            const isExpiredDate = dateOnly.getTime() < today.getTime();
            return (
              <div
                key={date.toISOString()}
                className={`grid grid-cols-[130px_1fr] transition-colors ${
                  isExpiredDate ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Date Column */}
                <div className="px-4 py-4 border-r border-gray-200 flex items-center">
                  <div className="flex flex-col">
                    <div className={`inline-flex items-center gap-2 text-sm font-medium ${isExpiredDate ? 'text-gray-400' : 'text-gray-900'}`}>
                      <span>{getDateLabel(date)}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isExpiredDate
                          ? 'bg-gray-300'
                          : lockStatus === 'full'
                            ? 'bg-green-500'
                            : lockStatus === 'partial'
                              ? 'bg-yellow-500'
                              : 'bg-gray-400'
                      }`}>
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    </div>
                    {!isExpiredDate && todayNearestLockCountdown && toLocalDateString(date) === toLocalDateString(new Date(nowTs)) && (
                      <span className="mt-2 text-[11px] leading-4 text-gray-400">
                        约{todayNearestLockCountdown.hoursLeft}h后（{todayNearestLockCountdown.lockAtText}）锁定{getMealTypeLabel(todayNearestLockCountdown.mealType)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delivery Plan Column */}
                <div className="px-4 py-4">
                  <div className="space-y-2">
                    {configs.map((config) => {
                      const isLocked = isMealLocked(date, config.mealType);
                      const isManuallyLockedMeal = isManuallyLocked(date, config.mealType);
                      const isAuto = isAutoLocked(date, config.mealType);
                      const mealKey = getMealKey(date, config.mealType);
                      const isPendingConfirm = pendingConfirmMealKeys.has(mealKey);
                      const isPendingAutoLock = pendingAutoLockMealKeys.has(mealKey);

                      return (
                        <div
                          key={`${date.toISOString()}-${config.mealType}`}
                          className="flex items-center justify-between py-1"
                        >
                          {/* Meal Type → Address */}
                          <div className="flex items-center gap-2 flex-1">
                            <span className={`text-sm font-bold ${isExpiredDate ? 'text-gray-400' : 'text-gray-900'}`}>
                              {getMealTypeLabel(config.mealType)}
                            </span>
                            <span className={`${isExpiredDate ? 'text-gray-300' : 'text-gray-400'}`}>→</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                isExpiredDate ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {getAddressLabel(config.addressId)}
                              </span>
                            </div>
                          </div>

                          {/* Edit Button and Lock Icon */}
                          <div className="flex items-center gap-1.5 ml-2">
                            {!isLocked ? (
                              <button
                                onClick={() => onAddressEdit(date, config.mealType)}
                                className={`p-1.5 rounded-lg transition-colors ${isExpiredDate ? 'opacity-40' : 'hover:bg-gray-100'}`}
                              >
                                <Edit2 className={`w-4 h-4 ${isExpiredDate ? 'text-gray-300' : 'text-gray-500'}`} />
                              </button>
                            ) : (
                              <div className="p-1.5 opacity-50 cursor-not-allowed">
                                <Edit2 className={`w-4 h-4 ${isExpiredDate ? 'text-gray-300' : 'text-gray-400'}`} />
                              </div>
                            )}

                            {/* 同步/持久化进行中时优先展示「锁定中」，否则「待确认」会一直盖住自动锁定态，用户看不到过渡 */}
                            {isPendingAutoLock ? (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-md border ${
                                  isExpiredDate
                                    ? 'bg-gray-100 text-gray-500 border-gray-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                                title="正在保存并锁定本餐次地址"
                              >
                                锁定中
                              </span>
                            ) : isPendingConfirm ? (
                              <button
                                onClick={() => onPendingConfirmClick(date, config.mealType)}
                                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                  isExpiredDate
                                    ? 'bg-gray-200 text-gray-500'
                                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                }`}
                                title="确认本餐次地址修改并锁定"
                              >
                                确认
                              </button>
                            ) : !isAuto && (
                              <button
                                onClick={() => onLockToggle(date, config.mealType)}
                                className={`p-1 rounded transition-colors ${isExpiredDate ? 'opacity-40' : 'hover:bg-gray-100'}`}
                                title={isManuallyLockedMeal ? "点击解锁" : "点击锁定"}
                              >
                                {isManuallyLockedMeal ? (
                                  <Lock className={`w-4 h-4 ${isExpiredDate ? 'text-gray-400' : 'text-gray-700'}`} />
                                ) : (
                                  <Unlock className={`w-4 h-4 ${isExpiredDate ? 'text-gray-300' : 'text-gray-400'}`} />
                                )}
                              </button>
                            )}

                            {isAuto && (
                              <div className="p-1">
                                <Lock className={`w-4 h-4 ${isExpiredDate ? 'text-gray-400' : 'text-gray-500'}`} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};




















