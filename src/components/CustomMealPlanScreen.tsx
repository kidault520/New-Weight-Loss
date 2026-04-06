import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DayData } from '../utils/mockData';
import { mealPlanData } from '../utils/mockData';
import { EmptyState } from './common/EmptyState';
import { DateScrollSelector } from './common/DateScrollSelector';
import { MealSectionCard } from './meal/MealSectionCard';
import { formatMealPlanDate, isToday, isPastDate } from '../utils/dateUtils';
import { getMealStatusByMealType } from '../utils/mealUtils';
import { useUserProfile } from '../contexts/UserProfileContext';
import { deliveryScheduleService } from '../services/deliveryScheduleService';
import { getMealPlanConfig } from '../services/mealPlanConfigService';
import { useAuth } from '../contexts/AuthContext';
import { activeMealScheduleService, type ActiveMealScheduleEntry } from '../services/activeMealScheduleService';

// Constants for meal plan - These will be overridden by props if provided

interface CustomMealPlanScreenProps {
  /** 由「我的专属方案」宿主挂载控制；为 false 时不渲染 */
  show: boolean;
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  onMealPlanSync: (selectedFoods: Array<{
    id: string;
    name: string;
    calories: number;
    quantity: number;
    mealType: string;
    icon: string;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    originalId: string;
  }>, date: Date, mealData?: any) => void;
  onOpenNutritionDetail: () => void;
  onMealIntakeComplete: (date: Date, mealType: string, mealInfo?: { calories: number; foodName: string }) => void;
  onOpenBloodGlucoseDetail: () => void;
  currentDateData: DayData;
  onRefreshDayData?: (date: Date) => void;
  deliveryStartDate?: Date;
  deliveryEndDate?: Date;
  deliveryDates?: Date[];
  packageDuration?: number;
  includedMeals?: string[];
  hasOrder?: boolean;
  /** 订单/执行计划仍在拉取：勿当作无订单进入演示数据 */
  orderGateLoading?: boolean;
}

const CustomMealPlanScreen: React.FC<CustomMealPlanScreenProps> = ({
  show,
  selectedDate,
  onSelectedDateChange,
  onMealPlanSync: _onMealPlanSync,
  onOpenNutritionDetail,
  onMealIntakeComplete,
  onOpenBloodGlucoseDetail,
  currentDateData,
  onRefreshDayData,
  deliveryStartDate,
  deliveryEndDate,
  deliveryDates,
  packageDuration,
  includedMeals,
  hasOrder = false,
  orderGateLoading = false,
}) => {
  void onOpenNutritionDetail;
  void onOpenBloodGlucoseDetail;
  const { mealPlanConfig, refreshMealPlanConfig, intakePlanActive } = useUserProfile();
  const { user } = useAuth();
  const orderStatusPending = orderGateLoading && !hasOrder;
  /** 仅正式开启摄入托管后拉取并展示后台排期；未开启时与散客一致走本地模拟菜谱 */
  const useBackendMealSchedule = hasOrder && intakePlanActive;
  const [computedStartDate, setComputedStartDate] = useState<Date | null>(null);
  const [computedEndDate, setComputedEndDate] = useState<Date | null>(null);
  const [fallbackConfig, setFallbackConfig] = useState<{ startDate: Date; endDate: Date; selectedDates: Date[] } | null>(null);
  const [activeScheduleEntries, setActiveScheduleEntries] = useState<ActiveMealScheduleEntry[]>([]);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  /** 正在请求排期：有订单且已结束首屏 blocking 时，切日期仍应用加载态，避免用演示菜谱冒充真实数据 */
  const [scheduleFetching, setScheduleFetching] = useState(false);
  const activeScheduleEntriesRef = useRef<ActiveMealScheduleEntry[]>([]);
  const latestSelectedYmdRef = useRef<string>('');
  activeScheduleEntriesRef.current = activeScheduleEntries;

  const selectedDateStr = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [selectedDate]);

  latestSelectedYmdRef.current = selectedDateStr;

  // 🔥 修复：打开时刷新配置，确保与配置配送计划同步
  useEffect(() => {
    if (show && user?.id) {
      refreshMealPlanConfig();
    }
  }, [show, user?.id, refreshMealPlanConfig]);

  // 打开时刷新当日数据，确保与今日餐/聊天完成摄入同步
  useEffect(() => {
    if (show && onRefreshDayData) {
      onRefreshDayData(selectedDate);
    }
  }, [show, selectedDate, onRefreshDayData]);
  useEffect(() => {
    if (!user?.id || deliveryStartDate || mealPlanConfig?.startDate) return;
    getMealPlanConfig(user.id).then((cfg) => {
      if (cfg?.startDate && cfg?.endDate) {
        setFallbackConfig({
          startDate: cfg.startDate,
          endDate: cfg.endDate,
          selectedDates: cfg.selectedDates || [],
        });
      } else {
        setFallbackConfig(null);
      }
    });
  }, [user?.id, deliveryStartDate, mealPlanConfig?.startDate]);

  const effectiveConfig = useMemo(() => (
    mealPlanConfig ?? (fallbackConfig ? {
      startDate: fallbackConfig.startDate,
      endDate: fallbackConfig.endDate,
      selectedDates: fallbackConfig.selectedDates,
      selectedMealTypes: [] as string[],
      deliveryAddressId: '',
    } : null)
  ), [mealPlanConfig, fallbackConfig]);

  // 🔥 修复：日期优先级与配置配送计划一致
  // 优先级1: 父组件传入的 deliveryStartDate + deliveryDates
  // 优先级2: mealPlanConfig 或 fallbackConfig（已保存的配置）
  // 优先级3: deliveryScheduleService
  useEffect(() => {
    const resolveDates = async () => {
      if (hasOrder && !intakePlanActive) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        setComputedStartDate(start);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        setComputedEndDate(end);
        return;
      }

      if (deliveryStartDate && (deliveryDates?.length || deliveryEndDate)) {
        setComputedStartDate(deliveryStartDate);
        if (deliveryDates && deliveryDates.length > 0) {
          const sorted = [...deliveryDates].sort((a, b) => a.getTime() - b.getTime());
          setComputedEndDate(sorted[sorted.length - 1]);
        } else if (deliveryEndDate) {
          setComputedEndDate(deliveryEndDate);
        }
        return;
      }

      if (effectiveConfig?.startDate && effectiveConfig?.endDate) {
        setComputedStartDate(effectiveConfig.startDate);
        setComputedEndDate(effectiveConfig.endDate);
        return;
      }

      // 仅摄入托管已开启时才查 delivery_schedules 区间，避免与弱网下其它 user 读抢连接、刷控制台
      if (user?.id && useBackendMealSchedule) {
        try {
          const dateRange = await deliveryScheduleService.getDeliveryDateRange(user.id);
          if (dateRange.startDate && dateRange.endDate) {
            setComputedStartDate(dateRange.startDate);
            setComputedEndDate(dateRange.endDate);
            return;
          }
        } catch (error) {
          console.error('[CustomMealPlanScreen] Error fetching delivery date range:', error);
        }
      }

      setComputedStartDate(new Date('2025-09-20'));
      setComputedEndDate(null);
    };

    resolveDates();
  }, [
    effectiveConfig,
    deliveryStartDate,
    deliveryEndDate,
    deliveryDates,
    user?.id,
    show,
    hasOrder,
    intakePlanActive,
    useBackendMealSchedule,
  ]);

  /**
   * 餐食排期：切日期时**禁止**再 setScheduleLoaded(false) 出整页「同步中」占位。
   * 否则内容高度骤减，专属页外层 overflow-y-auto 的 scrollTop 会被浏览器重算，整页弹回顶部。
   * 已有 entries 含当日则直接复用；否则后台拉取且保留上一屏（或模拟餐）占位。
   */
  useEffect(() => {
    let mounted = true;
    if (!show || !hasOrder || !intakePlanActive) {
      if (orderGateLoading) {
        return;
      }
      setActiveScheduleEntries([]);
      setScheduleLoaded(true);
      setScheduleFetching(false);
      return;
    }

    const ymd = selectedDateStr;
    const prevEntries = activeScheduleEntriesRef.current;
    const hasDayData = prevEntries.some((e) => String(e.date || '').split('T')[0] === ymd);
    if (hasDayData) {
      setScheduleLoaded(true);
      setScheduleFetching(false);
      return;
    }

    // 仅「尚无任一排期缓存」时阻塞整页：含嵌入专属页，否则 scheduleLoaded 过早为 true 会走到演示菜谱回退
    const showBlockingSpinner = prevEntries.length === 0;
    if (showBlockingSpinner) {
      setScheduleLoaded(false);
    } else {
      // 已有其它日期数据时保持布局高度，避免切日整页回弹；加载态交给 scheduleFetching
      setScheduleLoaded(true);
    }

    const ymdForThisFetch = ymd;
    const scheduleMs = 10000;
    setScheduleFetching(true);
    const timeoutId = window.setTimeout(() => {
      if (!mounted) return;
      console.warn('[CustomMealPlanScreen] 餐食排期较慢，先结束加载态（不再用演示餐食冒充真实排期）');
      setScheduleLoaded(true);
      setScheduleFetching(false);
    }, scheduleMs);

    activeMealScheduleService
      .getActiveWeekSchedule('this_week', ymdForThisFetch)
      .then((resp) => {
        window.clearTimeout(timeoutId);
        if (!mounted) return;
        if (latestSelectedYmdRef.current !== ymdForThisFetch) return;
        const merged = (resp?.entries || []).filter((x): x is ActiveMealScheduleEntry => !!x?.id);
        setActiveScheduleEntries(merged);
        setScheduleLoaded(true);
        setScheduleFetching(false);
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        if (!mounted) return;
        if (latestSelectedYmdRef.current !== ymdForThisFetch) return;
        if (showBlockingSpinner) {
          setActiveScheduleEntries([]);
        }
        setScheduleLoaded(true);
        setScheduleFetching(false);
      });

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [show, hasOrder, intakePlanActive, orderGateLoading, user?.id, selectedDateStr]);

  // Use computed dates or fall back to defaults（无订单时使用今日起一周模拟）
  const todayForStart = new Date();
  todayForStart.setHours(0, 0, 0, 0);
  const MEAL_PLAN_START_DATE = useBackendMealSchedule
    ? (computedStartDate || deliveryStartDate || new Date('2025-09-20'))
    : todayForStart;
  const MEAL_PLAN_DURATION_DAYS = useBackendMealSchedule ? (packageDuration || 21) : 7;
  const INCLUDED_MEALS = includedMeals || ['breakfast', 'lunch', 'dinner'];
  const [expandedMeals, setExpandedMeals] = useState<{
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  }>({
    breakfast: false,
    lunch: false,
    dinner: false
  });
  // Calculate which day of the meal plan we're viewing
  const daysSinceStart = Math.floor((selectedDate.getTime() - MEAL_PLAN_START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  const currentMealPlanDay = daysSinceStart + 1; // 1-based day number
  
  // Get current meal data
  const mockCurrentMeal = (currentMealPlanDay >= 1 && currentMealPlanDay <= 30 && mealPlanData[currentMealPlanDay as keyof typeof mealPlanData])
    ? mealPlanData[currentMealPlanDay as keyof typeof mealPlanData]
    : null;

  const getMealTypeFromPackageType = (packageType?: string) => {
    if (packageType === '早餐') return 'breakfast';
    if (packageType === '晚餐') return 'dinner';
    return 'lunch';
  };

  const buildMealFromEntry = useCallback((
    entry: ActiveMealScheduleEntry,
    mealType: 'breakfast' | 'lunch' | 'dinner',
  ) => {
    const formatKcal = (value: number) => Number(value.toFixed(1));
    const foods = (entry.dishes || []).map((d, idx) => ({
      id: d.dish?.id || `${entry.id}-${idx}`,
      name: d.dish?.name || d.dish?.dish_code || '菜品',
      amount: `${d.quantity || 1}份`,
      calories: formatKcal(Number(d.dish?.calories_kcal || 0) * Number(d.quantity || 1)),
      icon: '🍽️',
    }));
    const totalsFromDishes = (entry.dishes || []).reduce((acc, d) => {
      const qty = Number(d.quantity || 1);
      const dish: any = d.dish || {};
      acc.carbs += Number(dish.carbohydrate_g || 0) * qty;
      acc.protein += Number(dish.protein_g || 0) * qty;
      acc.fat += Number(dish.fat_g || 0) * qty;
      acc.fiber += Number(dish.fiber_g || 0) * qty;
      return acc;
    }, { carbs: 0, protein: 0, fat: 0, fiber: 0 });
    const fallbackTotals = {
      carbs: Number((entry.package as any)?.total_carbohydrate_g || 0),
      protein: Number((entry.package as any)?.total_protein_g || 0),
      fat: Number((entry.package as any)?.total_fat_g || 0),
      fiber: Number((entry.package as any)?.total_fiber_g || 0),
    };
    const carbs = totalsFromDishes.carbs || fallbackTotals.carbs;
    const protein = totalsFromDishes.protein || fallbackTotals.protein;
    const fat = totalsFromDishes.fat || fallbackTotals.fat;
    const fiber = totalsFromDishes.fiber || fallbackTotals.fiber;
    const caloriesFromDishes = (entry.dishes || []).reduce((sum, d) => {
      const qty = Number(d.quantity || 1);
      return sum + Number(d.dish?.calories_kcal || 0) * qty;
    }, 0);
    const calories = formatKcal(caloriesFromDishes || Number(entry.package?.total_calories_kcal || 0));
    const fallbackImage = mockCurrentMeal?.[mealType]?.image || 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&h=600&fit=crop&auto=format';
    return {
      image: fallbackImage,
      calories,
      nutrition: [
        { name: '碳水', value: carbs > 0 ? `${Math.round(carbs)}g` : '--', color: 'bg-yellow-400' },
        { name: '蛋白质', value: protein > 0 ? `${Math.round(protein)}g` : '--', color: 'bg-pink-400' },
        { name: '脂肪', value: fat > 0 ? `${Math.round(fat)}g` : '--', color: 'bg-blue-400' },
        { name: '膳食纤维', value: fiber > 0 ? `${Math.round(fiber)}g` : '--', color: 'bg-green-400' },
      ],
      foods,
    };
  }, [mockCurrentMeal]);

  const scheduleMealMap = useMemo(() => {
    const rows = activeScheduleEntries.filter((e) => {
      const entryDate = String(e.date || '').split('T')[0];
      return entryDate === selectedDateStr;
    });
    const map: Record<string, ReturnType<typeof buildMealFromEntry>> = {};
    rows.forEach((entry) => {
      const mealType = getMealTypeFromPackageType(entry.package_type);
      map[mealType] = buildMealFromEntry(entry, mealType as 'breakfast' | 'lunch' | 'dinner');
    });
    return map;
  }, [activeScheduleEntries, selectedDateStr, buildMealFromEntry]);

  useEffect(() => {
    if (!show || !useBackendMealSchedule || !scheduleLoaded) return;
    if (Object.keys(scheduleMealMap).length > 0) return;
    console.warn('[CustomMealPlanScreen] selected date has no meal entries', {
      selectedDate: selectedDateStr,
      activeEntriesCount: activeScheduleEntries.length,
      deliveryDatesCount: deliveryDates?.length || 0,
      computedStartDate: computedStartDate ? formatMealPlanDate(computedStartDate) : null,
      computedEndDate: computedEndDate ? formatMealPlanDate(computedEndDate) : null,
    });
  }, [
    show,
    useBackendMealSchedule,
    scheduleLoaded,
    scheduleMealMap,
    selectedDateStr,
    activeScheduleEntries.length,
    deliveryDates?.length,
    computedStartDate,
    computedEndDate,
  ]);

  const currentMeal = useMemo(() => {
    if (useBackendMealSchedule) {
      if (Object.keys(scheduleMealMap).length === 0) return null;
      return {
        breakfast: scheduleMealMap.breakfast,
        lunch: scheduleMealMap.lunch,
        dinner: scheduleMealMap.dinner,
      };
    }
    if (Object.keys(scheduleMealMap).length === 0) return mockCurrentMeal;
    return {
      breakfast: scheduleMealMap.breakfast || mockCurrentMeal?.breakfast || buildMealFromEntry({ id: 'empty-breakfast', date: selectedDateStr, package_type: '早餐' }, 'breakfast'),
      lunch: scheduleMealMap.lunch || mockCurrentMeal?.lunch || buildMealFromEntry({ id: 'empty-lunch', date: selectedDateStr, package_type: '午餐' }, 'lunch'),
      dinner: scheduleMealMap.dinner || mockCurrentMeal?.dinner || buildMealFromEntry({ id: 'empty-dinner', date: selectedDateStr, package_type: '晚餐' }, 'dinner'),
    };
  }, [scheduleMealMap, mockCurrentMeal, selectedDateStr, useBackendMealSchedule, buildMealFromEntry]);

  // Generate all meal plan dates (full package duration)
  // 无订单（散客）：展示一周模拟数据
  const generateMealPlanDates = () => {
    if (!useBackendMealSchedule) {
      const demoDates: Date[] = [];
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        demoDates.push(d);
      }
      return demoDates;
    }
    if (deliveryDates && deliveryDates.length > 0) {
      return deliveryDates;
    }
    // 🔥 使用 fallbackConfig 的 selectedDates（与配置配送计划一致）
    if (effectiveConfig?.selectedDates && effectiveConfig.selectedDates.length > 0) {
      return [...effectiveConfig.selectedDates].sort((a, b) => a.getTime() - b.getTime());
    }

    // Otherwise, fall back to generating dates (for backward compatibility)
    const dates: Date[] = [];
    // Start from the meal plan start date, not today
    for (let i = 0; i < MEAL_PLAN_DURATION_DAYS; i++) {
      const date = new Date(MEAL_PLAN_START_DATE);
      date.setDate(MEAL_PLAN_START_DATE.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const mealPlanDates = generateMealPlanDates();

  // Note: DateScrollSelector handles auto-scrolling internally
  
  // Check if selected date is in the future or within first 3 days
  const selectedDateOnly = new Date(selectedDate);
  selectedDateOnly.setHours(0, 0, 0, 0);
  const isPastDateCheck = isPastDate(selectedDateOnly);
  const isTodayCheck = isToday(selectedDateOnly);

  // Check if selected date is within 7 days from today (用于无订单模拟场景)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceToday = Math.floor((selectedDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isWithin7DaysFromToday = daysSinceToday >= 0 && daysSinceToday < 7;
  // 已开启后台排期：计划内任意日期；否则（散客 / 有订单未开启）：仅展示模拟 7 天
  const shouldShowMealContent = useBackendMealSchedule ? true : isWithin7DaysFromToday;

  // Check if selected date is within meal plan range
  // 🔥 修复：使用从配送计划获取的实际日期
  const mealPlanStartDate = computedStartDate || (mealPlanDates.length > 0 ? mealPlanDates[0] : MEAL_PLAN_START_DATE);
  const mealPlanEndDate = computedEndDate || (mealPlanDates.length > 0 
    ? mealPlanDates[mealPlanDates.length - 1] 
    : new Date(MEAL_PLAN_START_DATE.getTime() + (MEAL_PLAN_DURATION_DAYS - 1) * 24 * 60 * 60 * 1000));
  // Check if the selected date is in the meal plan dates array (not excluded)
  const isWithinMealPlanRange = mealPlanDates.some(date => {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    return dateOnly.getTime() === selectedDateOnly.getTime();
  });

  // Toggle meal expansion
  const toggleMealExpansion = (mealType: 'breakfast' | 'lunch' | 'dinner') => {
    setExpandedMeals(prev => ({
      ...prev,
      [mealType]: !prev[mealType]
    }));
  };

  // Check if meal type should be displayed based on package
  const shouldShowMealType = (mealType: string) => {
    if (useBackendMealSchedule) {
      return !!currentMeal?.[mealType as 'breakfast' | 'lunch' | 'dinner'];
    }
    return INCLUDED_MEALS.includes(mealType);
  };


  const mockBanner =
    (!orderStatusPending && !useBackendMealSchedule) ? (
    <div className="mx-4 mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
      <p className="text-sm text-amber-800 font-medium">以下为模拟排期示意，仅供参考</p>
      <p className="text-xs text-amber-700 mt-1">
        {hasOrder
          ? '完成「我的配送计划」并开启摄入托管后，将展示后台真实餐食排期。'
          : '完成订单后即可查看您的专属餐食方案。'}
      </p>
    </div>
  ) : null;

  const orderPendingBlock = orderStatusPending ? (
    <div className="px-4 py-12 text-center">
      <p className="text-sm text-gray-600">正在确认您的服务与订单状态…</p>
      <p className="text-xs text-gray-400 mt-2">请稍候，避免误显示演示餐食数据</p>
    </div>
  ) : null;

  const dateStrip = (
    <DateScrollSelector
      dates={mealPlanDates}
      selectedDate={selectedDate}
      onDateChange={onSelectedDateChange}
      showDaySuffix={true}
      pinMode="static"
      className="!border-b-0 !shadow-none"
    />
  );

  const showOrderedMealLoading =
    useBackendMealSchedule &&
    shouldShowMealContent &&
    isWithinMealPlanRange &&
    (!scheduleLoaded ||
      (scheduleFetching && Object.keys(scheduleMealMap).length === 0));

  const mealsSection = (
        <>
        {/* Meals - Only show if within meal plan range and within 7 days from today */}
        {showOrderedMealLoading ? (
          <div className="px-4 min-h-[200px] flex items-center justify-center">
            <EmptyState
              icon={<span className="text-4xl">⏳</span>}
              title="正在同步餐食排期"
              description="请稍候，正在拉取最新排期数据"
            />
          </div>
        ) : currentMeal && isWithinMealPlanRange && shouldShowMealContent ? (
          <div className="px-4 space-y-6">
            {/* Breakfast - only show if included in package */}
            {shouldShowMealType('breakfast') && (
              <MealSectionCard
                mealType="breakfast"
                mealName="早餐"
                meal={currentMeal.breakfast}
                status={getMealStatusByMealType(selectedDate, 'breakfast')}
                isExpanded={expandedMeals.breakfast}
                onExpand={() => toggleMealExpansion('breakfast')}
                onIntakeComplete={() => onMealIntakeComplete(selectedDate, 'breakfast', { calories: currentMeal.breakfast.calories || 0, foodName: currentMeal.breakfast.foods?.map((f) => f.name).join('、') || '早餐' })}
                isIntakeCompleted={!!currentDateData.mealIntakeStatus?.breakfast?.intakeCompletedAt}
                canCompleteIntake={isTodayCheck}
                isPastDate={isPastDateCheck}
                isToday={isTodayCheck}
              />
            )}

            {/* Lunch - only show if included in package */}
            {shouldShowMealType('lunch') && (
              <MealSectionCard
                mealType="lunch"
                mealName="午餐"
                meal={currentMeal.lunch}
                status={getMealStatusByMealType(selectedDate, 'lunch')}
                isExpanded={expandedMeals.lunch}
                onExpand={() => toggleMealExpansion('lunch')}
                onIntakeComplete={() => onMealIntakeComplete(selectedDate, 'lunch', { calories: currentMeal.lunch.calories || 0, foodName: currentMeal.lunch.foods?.map((f) => f.name).join('、') || '午餐' })}
                isIntakeCompleted={!!currentDateData.mealIntakeStatus?.lunch?.intakeCompletedAt}
                canCompleteIntake={isTodayCheck}
                isPastDate={isPastDateCheck}
                isToday={isTodayCheck}
              />
            )}

            {/* Dinner - only show if included in package */}
            {shouldShowMealType('dinner') && (
              <MealSectionCard
                mealType="dinner"
                mealName="晚餐"
                meal={currentMeal.dinner}
                status={getMealStatusByMealType(selectedDate, 'dinner')}
                isExpanded={expandedMeals.dinner}
                onExpand={() => toggleMealExpansion('dinner')}
                onIntakeComplete={() => onMealIntakeComplete(selectedDate, 'dinner', { calories: currentMeal.dinner.calories || 0, foodName: currentMeal.dinner.foods?.map((f) => f.name).join('、') || '晚餐' })}
                isIntakeCompleted={!!currentDateData.mealIntakeStatus?.dinner?.intakeCompletedAt}
                canCompleteIntake={isTodayCheck}
                isPastDate={isPastDateCheck}
                isToday={isTodayCheck}
              />
            )}
          </div>
        ) : useBackendMealSchedule && scheduleLoaded && !scheduleFetching && !currentMeal && isWithinMealPlanRange && shouldShowMealContent ? (
          <div className="px-4">
            <EmptyState
              icon={<span className="text-4xl">🍽️</span>}
              title="暂无当日餐食排期"
              description="未拉取到该日菜单。若您已开通服务，请稍后重试或检查网络；仍无数据请联系客服核对后台排期。"
            />
          </div>
        ) : (
          <div className="px-4">
            <EmptyState
              icon={<span className="text-4xl">📅</span>}
              title="此日期无食谱安排"
              description={
                useBackendMealSchedule
                  ? `食谱计划时间：${formatMealPlanDate(mealPlanStartDate)} - ${formatMealPlanDate(mealPlanEndDate)}`
                  : undefined
              }
            />
          </div>
        )}
        </>
  );

  const mealPlanBody = (
    <>
      {orderStatusPending ? orderPendingBlock : (
        <>
          {mockBanner}
          {mealsSection}
        </>
      )}
    </>
  );

  if (!show) return null;

  /** 仅用于「我的专属方案」餐食 Tab：与宿主同一滚动轴，sticky 日期条 + 餐区 */
  return (
    <>
      {!orderStatusPending ? (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
          {dateStrip}
        </div>
      ) : null}
      <div className="bg-white">{mealPlanBody}</div>
    </>
  );
};

export default CustomMealPlanScreen;