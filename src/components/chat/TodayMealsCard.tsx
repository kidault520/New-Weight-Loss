/**
 * 今日餐卡片 - 在对话窗口内展示当天餐食详情（菜品+营养）
 * 图3 风格：餐次、营养信息、菜品列表、配送状态
 *
 * 数据源分工：菜品/热量来自 **active-meal-schedule**（排期模板）；`mealPlanConfig` 仅用于无排期时的兜底展示与「第几天」mock；
 * **includedMeals**：有订单时先按排期/配置得到候选餐次，再与 **合约餐次**（orderMealPlanSlots）求交，与配送配置、日反馈一致。
 */

import { useEffect, useMemo, useState } from 'react';
import { X, UtensilsCrossed, CheckCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChatContext } from '../../contexts/ChatContext';
import { useExecutionProgram } from '../../hooks/useExecutionProgram';
import { useContractMealSlotsEn } from '../../hooks/useContractMealSlotsEn';
import { useTodayConsumedMeals, TODAY_CONSUMED_MEALS_KEY } from '../../hooks/useTodayConsumedMeals';
import { getMealPlanConfig } from '../../services/mealPlanConfigService';
import { nutritionSyncService } from '../../services/nutritionSyncService';
import { setUserStorageItem } from '../../utils/userStorage';
import { executionTaskService } from '../../services/executionTaskService';
import { mealPlanData } from '../../utils/mockData';
import { getMealStatusByMealType, isMealDeliveryComplete } from '../../utils/mealUtils';
import { StatusBadge } from '../common/StatusBadge';
import { activeMealScheduleService, type ActiveMealScheduleEntry } from '../../services/activeMealScheduleService';
import { toBeijingDateString } from '../../utils/dateUtils';
import { DEFAULT_AI_COMPANION_NAME } from '../../services/aiSettingsService';
import { INTAKE_PLAN_INACTIVE_USER_MESSAGE } from '../../utils/intakePlanGate';

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};
const FIRST_FEEDBACK_DELAY_MS = 1000;
const CARD_FEEDBACK_DELAY_MS = 2000;
const TODAY_MEALS_SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000;
const todayMealsScheduleCache = new Map<string, { ts: number; rows: ActiveMealScheduleEntry[] }>();

/** 排期餐与 mock 餐计划共用的展示形状（mock 可含 image / nutrition） */
type TodayMealsCardMeal = {
  foods: Array<{ id: string; name: string; calories: number; icon: string }>;
  calories: number;
  image?: string;
  nutrition?: Array<{ name: string; value: string | number }>;
};

export interface TodayMealsCardProps {
  onClose: () => void;
}

export default function TodayMealsCard({ onClose }: TodayMealsCardProps) {
  const { mealPlanConfig, intakePlanActive } = useUserProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addFeedbackMessage, ownerName, aiName } = useChatContext();
  const { program, hasOrder, isLoadingOrder } = useExecutionProgram();
  const { data: contractSlotsEn } = useContractMealSlotsEn();
  const { consumedMeals } = useTodayConsumedMeals();
  /** 有有效订单即视为已接入，避免执行计划同步延迟导致“有单却显示暂无餐食” */
  const isJourneyStarted = !isLoadingOrder && !!hasOrder;
  const [fallbackConfig, setFallbackConfig] = useState<typeof mealPlanConfig>(null);
  const [syncingMeal, setSyncingMeal] = useState<string | null>(null);
  const [optimisticConsumed, setOptimisticConsumed] = useState<Set<string>>(new Set());
  const [todayScheduleEntries, setTodayScheduleEntries] = useState<ActiveMealScheduleEntry[]>([]);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const getBusinessDateStr = (d: Date) => toBeijingDateString(d);

  // 🔥 与定制食谱一致：优先用 mealPlanConfig，否则从 service 拉取（确保今日餐与餐食计划内容一致）
  useEffect(() => {
    if (!mealPlanConfig && user?.id) {
      getMealPlanConfig(user.id).then(setFallbackConfig);
    } else {
      setFallbackConfig(null);
    }
  }, [mealPlanConfig, user?.id]);

  useEffect(() => {
    let isMounted = true;
    const todayStr = getBusinessDateStr(new Date());
    const cacheKey = `${user?.id || 'anon'}:${todayStr}`;
    const cached = todayMealsScheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TODAY_MEALS_SCHEDULE_CACHE_TTL_MS) {
      setTodayScheduleEntries(cached.rows);
      setScheduleLoaded(true);
      return () => {
        isMounted = false;
      };
    }

    setScheduleLoaded(false);
    activeMealScheduleService.getActiveWeekSchedule('this_week', todayStr)
      .then((resp) => {
        if (!isMounted) return;
        const merged = resp?.entries || [];
        const rows = merged.filter((e) => String(e.date || '').split('T')[0] === todayStr);
        todayMealsScheduleCache.set(cacheKey, { ts: Date.now(), rows });
        setTodayScheduleEntries(rows);
        setScheduleLoaded(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setTodayScheduleEntries([]);
        todayMealsScheduleCache.set(cacheKey, { ts: Date.now(), rows: [] });
        setScheduleLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // 当服务端数据已包含该餐次时，清除乐观更新（避免重复）
  useEffect(() => {
    setOptimisticConsumed((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      prev.forEach((m) => {
        if (consumedMeals.has(m)) next.delete(m);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [consumedMeals]);

  const effectiveConfig = mealPlanConfig ?? fallbackConfig;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = effectiveConfig?.startDate
    ? new Date(effectiveConfig.startDate)
    : new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);

  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const currentMealPlanDay = daysSinceStart + 1;

  const currentMeal =
    currentMealPlanDay >= 1 &&
    currentMealPlanDay <= 30 &&
    mealPlanData[currentMealPlanDay as keyof typeof mealPlanData]
      ? mealPlanData[currentMealPlanDay as keyof typeof mealPlanData]
      : null;

  const getMealTypeFromPackageType = (packageType?: string) => {
    if (packageType === '早餐') return 'breakfast';
    if (packageType === '晚餐') return 'dinner';
    return 'lunch';
  };

  const scheduleMealMap = todayScheduleEntries.reduce((acc, entry) => {
    const formatKcal = (value: number) => Number(value.toFixed(1));
    const mealType = getMealTypeFromPackageType(entry.package_type);
    const foods = (entry.dishes || []).map((d, idx) => ({
      id: d.dish?.id || `${entry.id}-${idx}`,
      name: d.dish?.name || d.dish?.dish_code || '菜品',
      calories: formatKcal(Number(d.dish?.calories_kcal || 0) * Number(d.quantity || 1)),
      icon: '🍽️'
    }));
    const caloriesFromDishes = (entry.dishes || []).reduce((sum, d) => {
      const qty = Number(d.quantity || 1);
      return sum + Number(d.dish?.calories_kcal || 0) * qty;
    }, 0);
    const totalCalories = formatKcal(caloriesFromDishes || Number(entry.package?.total_calories_kcal || 0));
    acc[mealType] = {
      foods,
      calories: totalCalories
    };
    return acc;
  }, {} as Record<string, TodayMealsCardMeal>);

  const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
  const getStatusBadgeType = (mealType: string) => {
    const mealStatus = getMealStatusByMealType(today, mealType);
    return mealStatus === '已配送完成'
      ? 'delivered'
      : mealStatus === '配送中'
        ? 'delivering'
        : mealStatus === '制作中'
          ? 'making'
          : 'not-started';
  };
  /** 有排期则只展示当日 MS 里出现的餐次；否则退回用户配送配置餐次；有订单时再与合约餐次求交 */
  const includedMeals = useMemo(() => {
    const raw = hasOrder
      ? (['breakfast', 'lunch', 'dinner'] as const).filter((m) => !!scheduleMealMap[m])
      : todayScheduleEntries.length > 0
        ? (['breakfast', 'lunch', 'dinner'] as const).filter((m) => !!scheduleMealMap[m])
        : (effectiveConfig?.selectedMealTypes || ['lunch', 'dinner']);
    if (!hasOrder || !contractSlotsEn?.length) return [...raw];
    const allow = new Set(contractSlotsEn.map((s) => String(s).toLowerCase()));
    return raw.filter((m) => allow.has(String(m).toLowerCase()));
  }, [hasOrder, contractSlotsEn, todayScheduleEntries, scheduleMealMap, effectiveConfig?.selectedMealTypes]);

  const handleIntakeComplete = async (mealType: string, meal: { calories?: number; foods?: Array<{ name: string }> }) => {
    const canClick = isMealDeliveryComplete(today, mealType) && !consumedMeals.has(mealType) && !optimisticConsumed.has(mealType);
    if (!canClick || syncingMeal) return;

    setSyncingMeal(mealType);
    setOptimisticConsumed((prev) => new Set(prev).add(mealType));
    const mealLabel = MEAL_LABELS[mealType];
    try {
      const foodName = meal.foods?.length
        ? `${mealLabel}：${meal.foods.map((f) => f.name).join('、')}`
        : mealLabel;
      const calories = meal.calories || 0;
      const dateKey = getBusinessDateStr(today);
      const orderSyncId =
        user?.id != null
          ? `order-intake-${dateKey}-${mealType}-${user.id}-${Date.now()}`
          : `order-intake-${dateKey}-${mealType}-${Date.now()}`;
      await nutritionSyncService.saveFoodEntry(foodName, calories, mealLabel, 1, today, 'manual', undefined, undefined, {
        syncId: orderSyncId,
      });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['food-records', user.id] });
        const nextArr = (() => {
          const old = queryClient.getQueryData<string[]>([TODAY_CONSUMED_MEALS_KEY, user.id, dateKey]);
          const arr = Array.isArray(old) ? [...old] : [];
          if (!arr.includes(mealType)) arr.push(mealType);
          return arr;
        })();
        queryClient.setQueryData<string[]>([TODAY_CONSUMED_MEALS_KEY, user.id, dateKey], nextArr);
        await setUserStorageItem('today-consumed-meals', { dateKey, meals: nextArr }); // 备份到 userStorage
        await queryClient.refetchQueries({ queryKey: ['dashboard-data', user.id, dateKey] });
      }
      if (program?.id) {
        try {
          const localDate = getBusinessDateStr(today);
          await executionTaskService.insertMealIntakeNotifications(program.id, localDate, mealType, mealLabel);
          queryClient.invalidateQueries({ queryKey: ['daily-tasks', program.id, localDate] });
        } catch (taskErr) {
          console.warn('[TodayMealsCard] 插入实时通知失败（不影响主流程）:', taskErr);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, FIRST_FEEDBACK_DELAY_MS));
      await addFeedbackMessage(`${aiName || DEFAULT_AI_COMPANION_NAME}已完成[餐食：${mealLabel}]摄入记录并同步热量营养，${ownerName || '主人'}加油！`);
    } catch (e) {
      console.error('[TodayMealsCard] 同步热量失败:', e);
      setOptimisticConsumed((prev) => {
        const next = new Set(prev);
        next.delete(mealType);
        return next;
      });
      await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
      await addFeedbackMessage('同步热量失败，请重试。');
    } finally {
      setSyncingMeal(null);
    }
  };

  return (
    <div className="mb-3 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-purple-600" />
          <span className="font-semibold text-gray-900">今日餐</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200/80">
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      <div className="px-3 py-3">
        {!isJourneyStarted ? (
          <p className="text-sm text-gray-500 py-4 text-center">今日暂无餐食计划</p>
        ) : hasOrder && !intakePlanActive ? (
          <p className="text-sm text-gray-600 py-4 text-center px-2 leading-relaxed">{INTAKE_PLAN_INACTIVE_USER_MESSAGE}</p>
        ) : hasOrder && !scheduleLoaded ? (
          <p className="text-sm text-gray-500 py-4 text-center">正在同步今日排期...</p>
        ) : hasOrder && todayScheduleEntries.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">今日暂无排期餐食</p>
        ) : (!currentMeal && todayScheduleEntries.length === 0) ? (
          <p className="text-sm text-gray-500 py-4 text-center">今日暂无餐食计划</p>
        ) : (
          <div className="space-y-4">
            {mealTypes.map((mealType) => {
              if (!includedMeals.includes(mealType)) return null;
              const meal: TodayMealsCardMeal | null =
                scheduleMealMap[mealType] ||
                (!hasOrder ? (currentMeal?.[mealType] as TodayMealsCardMeal | undefined) : undefined) ||
                null;
              if (!meal) return null;
              const isConsumed = consumedMeals.has(mealType) || optimisticConsumed.has(mealType);

              return (
                <div
                  key={mealType}
                  className={`rounded-xl border overflow-hidden ${
                    isConsumed ? 'border-gray-100 bg-gray-50 opacity-80' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="px-3 py-2 flex items-center justify-between bg-gray-100/80 border-b border-gray-200">
                    <span className={`font-medium ${isConsumed ? 'text-gray-500' : 'text-gray-800'}`}>
                      {MEAL_LABELS[mealType]}
                    </span>
                    <StatusBadge status={getStatusBadgeType(mealType)} className="text-xs" />
                  </div>
                  <div className="p-2.5">
                    {meal.image && (
                      <div className="relative rounded-lg overflow-hidden mb-3">
                        <img
                          src={meal.image}
                          alt={MEAL_LABELS[mealType]}
                          className="w-full h-32 object-cover"
                        />
                        <div className="absolute top-2 right-2 bg-black/70 rounded-lg px-2 py-1 text-white text-xs">
                          {meal.nutrition?.map((n: { name: string; value: string | number }, i: number) => (
                            <span key={i}>
                              {n.name} {n.value}
                              {i < (meal.nutrition?.length || 0) - 1 ? ' · ' : ''}
                            </span>
                          ))}
                          {meal.calories && ` · ${meal.calories} kcal`}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {meal.foods?.map((f) => (
                        <div
                          key={f.id}
                          className={`flex items-center justify-between text-sm ${isConsumed ? 'text-gray-500' : 'text-gray-700'}`}
                        >
                          <span>
                            {f.icon} {f.name}
                          </span>
                          <span className="text-gray-500">{f.calories} kcal</span>
                        </div>
                      ))}
                    </div>
                    {!isConsumed ? (
                      <button
                        onClick={() => handleIntakeComplete(mealType, meal)}
                        disabled={!isMealDeliveryComplete(today, mealType) || syncingMeal === mealType}
                        className={`mt-3 w-full py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 ${
                          isMealDeliveryComplete(today, mealType) && syncingMeal !== mealType
                            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {syncingMeal === mealType
                          ? '同步中...'
                          : isMealDeliveryComplete(today, mealType)
                            ? '完成摄入'
                            : '暂不可操作'}
                      </button>
                    ) : (
                      <div className="mt-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        已摄入
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
