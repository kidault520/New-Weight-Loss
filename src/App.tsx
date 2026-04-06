import React, { useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import { registerAppQueryClient } from './utils/queryClientHolder';
import LeftDrawer from './components/singlepage/LeftDrawer';
// DetailScreen组件已由AppModals组件统一管理，不再需要单独导入
import DateSelectionPage from './components/DateSelectionPage';
import MealPlanConfirmationModal from './components/MealPlanConfirmationModal';
import { DeliveryPlanConfirmationModal, type DeliveryPlanConfirmationData } from './components/delivery/DeliveryPlanConfirmationModal';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
// DeliveryPlanPage 直接导入，避免 "Failed to fetch dynamically imported module" 报错
import DeliveryPlanPage from './components/DeliveryPlanPage';
import MyOrdersScreen from './components/MyOrdersScreen';
import { NutritionSolutionPageFallback } from './components/onboarding/NutritionSolutionPageFallback';
import {
  LazyAddDeliveryAddressPage,
  LazyHealthReportView,
  LazyNutritionSolutionPage,
  LazyCustomReportScreen,
  LazyMyReportsScreen,
  LazyMyDevicesScreen,
  LazyProfileSettingsScreen,
} from './components/lazy/LazyComponents';
import { OnboardingProvider } from './contexts/OnboardingContext';
import LoginPage from './components/LoginPage';
import DevToolsPanel from './components/DevToolsPanel';
import BreathingPracticeOverlay from './components/breathing/BreathingPracticeOverlay';
import type { BreathingSource } from './services/breathingService';
import { DayData } from './utils/mockData';
import { useUserProfile } from './contexts/UserProfileContext';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './config/supabase';

/** `Database` 未声明 `public.Tables` 时，typed client 的 `.from()` 为 `never`；仅本文件写库链使用 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseDb: any = supabase;
import { saveMealPlanConfig, getMealPlanConfig } from './services/mealPlanConfigService';
import { StorageMonitor } from './services/StorageMonitor';
import { toLocalDateString } from './utils/dateUtils';
import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from './utils/userStorage';
import { hasPersistedOnboardingUnlock, persistOnboardingUnlockToSession } from './utils/onboardingUnlockSignals';
import { useExerciseRecordsQuery } from './hooks/useExerciseRecordsQuery';
import { useDashboardData } from './hooks/useDashboardData';
import { useCalendarLogic } from './hooks/useCalendarLogic';
import { AppModals } from './components/AppModals';
import { AppHeader } from './components/AppHeader';
import { APP_HEADER_HEIGHT_CSS } from './constants/appLayout';
import { AlertDialog } from './components/common/AlertDialog';
import { AppRouter } from './components/AppRouter';
import type { RealtimeMetricKind } from './components/singlepage/TopSummaryRowContext';
import { useAppOnboarding } from './hooks/useAppOnboarding';
import { useAppAuthOnboardingBootstrap } from './hooks/useAppAuthOnboardingBootstrap';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAppMealPlan } from './hooks/useAppMealPlan';
import { useAppPreferences } from './hooks/useAppPreferences';
import { useAppModals } from './hooks/useAppModals';
import { useAppFoodDetail } from './hooks/useAppFoodDetail';
import { useExecutionProgram } from './hooks/useExecutionProgram';
import { useDailyTasks } from './hooks/useDailyTasks';
import { useAutoConfirmPendingEntries } from './hooks/useAutoConfirmPendingEntries';
import { deliveryScheduleService } from './services/deliveryScheduleService';
import { nutritionSyncService } from './services/nutritionSyncService';
import { executionProgramService } from './services/executionProgramService';
import { orderService } from './services/orderService';
import { useQueryClient } from '@tanstack/react-query';
import { TODAY_CONSUMED_MEALS_KEY } from './hooks/useTodayConsumedMeals';
import { getMealKey } from './utils/deliveryPlanUtils';
import {
  fetchLatestPaidOrderProductMeta,
  fetchMealSlotsEnForOrderId,
  fetchContractMealSlotsEnForUser,
} from './services/orderMealPlanSlots';
import { intersectMealTypesEn, includedMealTypesZhToEn } from './utils/mealSlotMapping';

function App() {
  const { isAuthenticated, loading: authLoading, hasActiveSession, user: authUser } = useAuth();
  const {
    profile,
    isLoading,
    profileFetchTimedOut,
    refreshProfile,
    userPackage,
    mealPlanConfigured,
    mealPlanConfig,
    refreshMealPlanConfig,
    userId,
    refreshHealthAssessment,
  } = useUserProfile();
  /** 含 fetchTimedOut：超时得到 null 时仍视为「档案未确定」，禁止误判新用户进引导 */
  const profileIndeterminate = isLoading || profileFetchTimedOut;
  /** 登录门闸必须用 Auth 的 user.id；勿依赖 profile 查询（超时时 userId 与之一致，但 Auth 往往早一帧就绪） */
  const authUserId = authUser?.id ?? userId;
  const userWeight = profile?.current_weight || 70;
  
  // 🔥 关键修复：使用 ref 存储最新的 profile，避免闭包问题
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  
  // 使用 React Query Hook 替代 healthAPI
  const { addRecord: addExerciseRecord } = useExerciseRecordsQuery();
  
  // ✅ 执行引擎Hooks
  const { program: executionProgram, hasOrder, isLoadingOrder, isLoading: isLoadingExecutionProgram } =
    useExecutionProgram();
  const { completeTask: completeExecutionTask } = useDailyTasks(executionProgram?.id || null);
  const queryClient = useQueryClient();

  /** 开通阶段：模拟支付或未回写 paid 时，仍以执行计划、user_packages 或已保存配送配置为准，避免误判为散客模拟态 */
  const effectiveHasOrder = useMemo(
    () =>
      Boolean(
        hasOrder ||
        executionProgram ||
        (mealPlanConfigured && mealPlanConfig?.selectedDates && mealPlanConfig.selectedDates.length > 0) ||
        (userPackage != null && 'id' in userPackage)
      ),
    [hasOrder, executionProgram, mealPlanConfigured, mealPlanConfig?.selectedDates, userPackage]
  );

  /** 订单/执行计划仍在拉取时勿误判为无服务，避免餐食/补剂误进模拟态 */
  const orderGateLoading = Boolean(isLoadingOrder || isLoadingExecutionProgram);

  useEffect(() => {
    registerAppQueryClient(queryClient);
    return () => registerAppQueryClient(null);
  }, [queryClient]);

  // 待办自动确认：登录后检查过期待办，并在每天 23:59 自动确认当日未处理项
  useAutoConfirmPendingEntries();
  
  // ✅ 使用提取的Hooks管理状态
  const onboarding = useAppOnboarding();
  const navigation = useAppNavigation();
  const mealPlan = useAppMealPlan();
  const preferences = useAppPreferences(userId, isAuthenticated, authLoading);
  const modals = useAppModals();

  const foodDetail = useAppFoodDetail();
  
  // 解构以保持向后兼容
  const {
    showOnboarding, setShowOnboarding,
    isReassessment, setIsReassessment,
    checkingOnboarding, setCheckingOnboarding,
    checkingOnboardingAfterLogin, setCheckingOnboardingAfterLogin,
    onboardingJustCompleted, setOnboardingJustCompleted,
    initialAppReady, setInitialAppReady,
    showOnboardingNutritionSolution, setShowOnboardingNutritionSolution,
    onboardingCheckLockRef,
  } = onboarding;

  const preserveCheckingOnboardingAfterLoginRef = React.useRef(false);
  const clearCheckingOnboardingAfterLogin = React.useCallback(() => {
    preserveCheckingOnboardingAfterLoginRef.current = false;
    setCheckingOnboardingAfterLogin(false);
  }, [setCheckingOnboardingAfterLogin]);

  // P0-3: 引导判定诊断（仅开发态 + 开关开启）
  // 开启方式：
  // 1) .env: VITE_ONBOARDING_DIAG=true
  // 2) 控制台: localStorage.setItem('debug:onboarding', '1')
  const onboardingDiagEnabled = useMemo(() => {
    if (!import.meta.env.DEV) return false;
    const envFlag = String(import.meta.env.VITE_ONBOARDING_DIAG || '').toLowerCase();
    if (envFlag === '1' || envFlag === 'true' || envFlag === 'on') return true;
    try {
      const lsFlag = String(localStorage.getItem('debug:onboarding') || '').toLowerCase();
      return lsFlag === '1' || lsFlag === 'true' || lsFlag === 'on';
    } catch {
      return false;
    }
  }, []);

  const onboardingDiag = React.useCallback((stage: string, extra: Record<string, unknown> = {}) => {
    if (!onboardingDiagEnabled) return;
    console.log(`[OnboardingDiag] ${stage}`, {
      ...extra,
      snapshot: {
        isAuthenticated,
        authLoading,
        hasActiveSession,
        profileLoading: profileIndeterminate,
        profileFetchTimedOut,
        profileHasSeen: profile?.has_seen_onboarding ?? null,
        showOnboarding,
        checkingOnboarding,
        checkingOnboardingAfterLogin,
        onboardingJustCompleted,
      },
      at: new Date().toISOString(),
    });
  }, [
    onboardingDiagEnabled,
    isAuthenticated,
    authLoading,
    hasActiveSession,
    profileIndeterminate,
    profileFetchTimedOut,
    profile?.has_seen_onboarding,
    showOnboarding,
    checkingOnboarding,
    checkingOnboardingAfterLogin,
    onboardingJustCompleted,
  ]);

  /** 供「仅挂载一次」的 auth/onboarding effect 读取最新状态，避免 [] 闭包陈旧导致误判 */
  const onboardingDiagRef = useRef(onboardingDiag);
  const showOnboardingRef = useRef(showOnboarding);
  const onboardingJustCompletedRef = useRef(onboardingJustCompleted);
  const isLoadingRef = useRef(profileIndeterminate);
  onboardingDiagRef.current = onboardingDiag;
  showOnboardingRef.current = showOnboarding;
  onboardingJustCompletedRef.current = onboardingJustCompleted;
  isLoadingRef.current = profileIndeterminate;
  
  const {
    currentScreen, setCurrentScreen,
    showCalendar, setShowCalendar,
    selectedDate, setSelectedDate,
    displayedWeekStart, setDisplayedWeekStart,
    chatSelectedDate, setChatSelectedDate,
  } = navigation;
  // 使用useCalendarLogic Hook替代日历相关函数
  const { formatDate, generateCalendarDays, isToday, isSameMonth } = useCalendarLogic(selectedDate);

  /** 本次会话内从「未登录」变为「已登录」时回到主界面（聊天），避免仍停在「我的」等子页 */
  const sessionLoggedInRef = useRef(false);
  useEffect(() => {
    const ok = Boolean(isAuthenticated && hasActiveSession);
    if (ok && !sessionLoggedInRef.current) {
      setCurrentScreen('ai');
    }
    sessionLoggedInRef.current = ok;
  }, [isAuthenticated, hasActiveSession, setCurrentScreen]);

  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;
  const deliveryPlanOpenSeqRef = useRef(0);
  const deliveryPlanOpenScreenRef = useRef<'mealplan' | 'profile' | null>(null);

  const [showLeftDrawer, setShowLeftDrawer] = React.useState(false);
  const [showNoOrderAlert, setShowNoOrderAlert] = React.useState(false);
  const [deliveryPlanToast, setDeliveryPlanToast] = React.useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });
  const [openDeliveryPlanAsGenerated, setOpenDeliveryPlanAsGenerated] = React.useState(false);
  const [activeOrderDurationDays, setActiveOrderDurationDays] = React.useState<number | null>(null);
  /** 当前订单商品关联餐食疗程的餐次（英文 key），与日期选择/地址/配送计划一致 */
  const [activeOrderIncludedMealsEn, setActiveOrderIncludedMealsEn] = React.useState<string[] | null>(null);
  const [activeServiceOrderId, setActiveServiceOrderId] = React.useState<string | null>(null);
  const [deliveryPlanEntrySource, setDeliveryPlanEntrySource] = React.useState<'mealplan' | 'profile' | null>(null);
  
  // 使用useDashboardData Hook替代原有的数据获取逻辑
  const {
    userDayDataOverrides,
    setUserDayDataOverrides,
    loadDayData,
    updateDayData,
    getCurrentDateData,
    formatDateKey,
  } = useDashboardData({
    userId,
    selectedDate,
    profile,
    showOnboarding,
  });

  // 使用Hook返回的getCurrentDateData函数获取当前日期数据（使用 useMemo 缓存，避免不必要的重新创建）
  // 必须在所有条件返回之前调用，遵守 Hooks 规则
  const currentDateData = useMemo(() => {
    return getCurrentDateData();
  }, [getCurrentDateData]); // getCurrentDateData 是 useCallback，依赖含 selectedDate、服务端与 overrides 数据
  // ✅ Modal状态已迁移到useAppModals Hook
  const {
    modals: modalStates,
    openWeightDetail, closeWeightDetail,
    openWaterDetail, closeWaterDetail,
    openStepsDetail, closeStepsDetail,
    openMeasurementsDetail, closeMeasurementsDetail,
    openBodyCompositionDetail, closeBodyCompositionDetail,
    openExerciseDetail, closeExerciseDetail,
    openExerciseStatsDetail, closeExerciseStatsDetail,
    openHealthRingsDetail, closeHealthRingsDetail,
    openFoodDetail, closeFoodDetail,
    openAISettings, closeAISettings,
    openEmotionJar, closeEmotionJar,
    openSleepDetail, closeSleepDetail,
    openBloodGlucoseDetail, closeBloodGlucoseDetail,
    openEditDashboard, closeEditDashboard,
    openNutritionDetail, closeNutritionDetail,
    openProfileSettings, closeProfileSettings,
    openMyHealthProfile, closeMyHealthProfile,
    openReports, closeReports,
    openHealthReport, closeHealthReport,
    openNutritionSolution, closeNutritionSolution,
    openOrders, closeOrders,
    openDevices, closeDevices,
    openAddressManagement, closeAddressManagement,
    openCustomReport, closeCustomReport,
    openExclusivePlanHub, closeExclusivePlanHub,
  } = modals;

  const [breathingPracticeOpen, setBreathingPracticeOpen] = React.useState<null | {
    source: BreathingSource;
    chatMessageId?: string;
  }>(null);

  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ source?: BreathingSource; chatMessageId?: string }>).detail || {};
      const src: BreathingSource = d.source === 'chat_card' ? 'chat_card' : 'dashboard';
      setBreathingPracticeOpen({
        source: src,
        chatMessageId: typeof d.chatMessageId === 'string' ? d.chatMessageId : undefined,
      });
    };
    window.addEventListener('openBreathingPractice', onOpen as EventListener);
    return () => window.removeEventListener('openBreathingPractice', onOpen as EventListener);
  }, []);

  /** 聊天区「实时数据」四宫格：先切健康档案，再延迟打开对应详情层 */
  const REALTIME_CARD_DETAIL_DELAY_MS = 1000;
  const realtimeCardOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 从聊天实时数据四宫格进入详情：关闭详情时应回到主界面(ai)，而非留在健康档案 */
  const realtimeDetailReturnToMainRef = useRef(false);
  const handleRealtimeCardClick = useCallback(
    (kind: RealtimeMetricKind) => {
      setCurrentScreen('dashboard');
      if (realtimeCardOpenTimerRef.current) {
        clearTimeout(realtimeCardOpenTimerRef.current);
        realtimeCardOpenTimerRef.current = null;
      }
      realtimeCardOpenTimerRef.current = setTimeout(() => {
        realtimeCardOpenTimerRef.current = null;
        if (currentScreenRef.current !== 'dashboard') return;
        realtimeDetailReturnToMainRef.current = true;
        switch (kind) {
          case 'weight':
            openWeightDetail();
            break;
          case 'blood_glucose':
            openBloodGlucoseDetail();
            break;
          case 'calorie_deficit':
            openHealthRingsDetail();
            break;
          case 'steps':
            openStepsDetail();
            break;
          default:
            break;
        }
      }, REALTIME_CARD_DETAIL_DELAY_MS);
    },
    [setCurrentScreen, openWeightDetail, openBloodGlucoseDetail, openHealthRingsDetail, openStepsDetail]
  );

  const handleCloseWeightDetail = useCallback(() => {
    closeWeightDetail();
    if (realtimeDetailReturnToMainRef.current) {
      realtimeDetailReturnToMainRef.current = false;
      setCurrentScreen('ai');
    }
  }, [closeWeightDetail, setCurrentScreen]);

  const handleCloseStepsDetail = useCallback(() => {
    closeStepsDetail();
    if (realtimeDetailReturnToMainRef.current) {
      realtimeDetailReturnToMainRef.current = false;
      setCurrentScreen('ai');
    }
  }, [closeStepsDetail, setCurrentScreen]);

  const handleCloseHealthRingsDetail = useCallback(() => {
    closeHealthRingsDetail();
    if (realtimeDetailReturnToMainRef.current) {
      realtimeDetailReturnToMainRef.current = false;
      setCurrentScreen('ai');
    }
  }, [closeHealthRingsDetail, setCurrentScreen]);

  const handleCloseBloodGlucoseDetail = useCallback(() => {
    closeBloodGlucoseDetail();
    if (realtimeDetailReturnToMainRef.current) {
      realtimeDetailReturnToMainRef.current = false;
      setCurrentScreen('ai');
    }
  }, [closeBloodGlucoseDetail, setCurrentScreen]);

  useEffect(() => {
    return () => {
      if (realtimeCardOpenTimerRef.current) {
        clearTimeout(realtimeCardOpenTimerRef.current);
        realtimeCardOpenTimerRef.current = null;
      }
    };
  }, []);
  
  // ✅ 餐食计划状态已迁移到useAppMealPlan Hook
  // 解构以保持向后兼容
  const {
    tempSelectedAddressId, setTempSelectedAddressId,
    tempSelectedDates, setTempSelectedDates,
    tempExcludedDates, setTempExcludedDates,
    tempSelectedMealTypes, setTempSelectedMealTypes,
    setSelectedOrderDates,
    setSelectedMealTypes,
    setSelectedDeliveryAddressId,
    deliveryPlanStartDate, setDeliveryPlanStartDate,
    deliveryPlanEndDate, setDeliveryPlanEndDate,
    deliveryPlanDates, setDeliveryPlanDates,
    isOpenedFromDeliveryPlan, setIsOpenedFromDeliveryPlan,
    isOpenedFromOrders, setIsOpenedFromOrders,
    setMealAddresses,
    showMealPlanConfirmationModal, setShowMealPlanConfirmationModal,
    showDateSelectionPage, setShowDateSelectionPage,
    showAddDeliveryAddressPage, setShowAddDeliveryAddressPage,
    showDeliveryPlanPage, setShowDeliveryPlanPage,
    showDeliveryPlanConfirmationModal, setShowDeliveryPlanConfirmationModal,
    pendingDeliveryPlanConfirmation, setPendingDeliveryPlanConfirmation,
  } = mealPlan;

  // 🔥 修复：页面刷新后，从 mealPlanConfig 恢复配送计划日期，确保定制食谱等页面能正确显示
  useEffect(() => {
    if (mealPlanConfigured && mealPlanConfig?.startDate && mealPlanConfig?.endDate && mealPlanConfig?.selectedDates?.length) {
      setDeliveryPlanStartDate(mealPlanConfig.startDate);
      setDeliveryPlanEndDate(mealPlanConfig.endDate);
      setDeliveryPlanDates(mealPlanConfig.selectedDates);
    }
  }, [mealPlanConfigured, mealPlanConfig?.startDate, mealPlanConfig?.endDate, mealPlanConfig?.selectedDates, setDeliveryPlanStartDate, setDeliveryPlanEndDate, setDeliveryPlanDates]);
  
  // ✅ 用户偏好状态已迁移到useAppPreferences Hook
  // 解构以保持向后兼容
  const {
    dashboardCardOrder,
    hiddenDashboardCards,
    updateCardOrder,
    updateHiddenCards,
  } = preferences;

  // ✅ 食物详情状态已迁移到useAppFoodDetail Hook
  const {
    foodDetailScreenDate, setFoodDetailScreenDate,
    nutritionRefreshKey,
    refreshNutrition,
  } = foodDetail;

  // Refs for tracking auth state change handling (must be at component top level)
  const hasHandledInitialSessionRef = React.useRef(false);
  const hasHandledSignedInRef = React.useRef(false);
  const onboardingStatusCacheRef = React.useRef<{ hasSeenOnboarding: boolean | null; timestamp: number } | null>(null);

  // P0：弱网下 DB 查询超时后，档案晚到且 has_seen_onboarding=false 时补开展示引导
  useEffect(() => {
    if (!isAuthenticated || authLoading || onboardingJustCompleted) return;
    if (profileIndeterminate) return;
    if (onboardingStatusCacheRef.current?.hasSeenOnboarding === true) return;
    if (!profile || profile.has_seen_onboarding !== false) return;
    if (!showOnboarding) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated, authLoading, profileIndeterminate, profile, onboardingJustCompleted, showOnboarding, setShowOnboarding]);

  // 初始化存储空间监控（应用启动时）
  useEffect(() => {
    StorageMonitor.initialize();
  }, []);

  // 预加载常用页面组件，避免首次打开时的延迟和抖动
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      // 预加载"我的"相关页面组件
      import('./components/MyReportsScreen');
      import('./components/ProfileSettingsScreen');
      import('./components/MyHealthProfileScreen');
      import('./components/MyDevicesScreen');
    }
  }, [isAuthenticated, authLoading, setUserDayDataOverrides, setMealAddresses]);


  // ✅ 用户偏好配置加载已迁移到useAppPreferences Hook

  // 加载其他localStorage数据
  useEffect(() => {
    const loadOtherUserData = async () => {
      try {
        const [overrides, addresses] = await Promise.all([
          getUserStorageItem<Record<string, Partial<DayData>>>('userDayDataOverrides'),
          getUserStorageItem<Record<string, string>>('mealAddresses'),
        ]);

        if (overrides) setUserDayDataOverrides(overrides);
        if (addresses) setMealAddresses(addresses);
      } catch (error) {
        console.error('[App] Error loading other user data from localStorage:', error);
      }
    };

    if (isAuthenticated && !authLoading) {
      loadOtherUserData();
    }
  }, [isAuthenticated, authLoading, setUserDayDataOverrides, setMealAddresses]);

  useAppAuthOnboardingBootstrap({
    onboardingDiagRef,
    profileRef,
    showOnboardingRef,
    onboardingJustCompletedRef,
    isLoadingRef,
    onboardingCheckLockRef,
    onboardingStatusCacheRef,
    hasHandledInitialSessionRef,
    hasHandledSignedInRef,
    preserveCheckingOnboardingAfterLoginRef,
    setShowOnboarding,
    setCheckingOnboarding,
    setCheckingOnboardingAfterLogin,
  });


  React.useEffect(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    setDisplayedWeekStart(weekStart);
  }, [setDisplayedWeekStart]);

  // Header高度管理已由AppHeader组件内部处理

  // 数据加载已由useDashboardData Hook处理，无需手动加载

  // React Query 会自动处理数据更新，无需监听事件
  // 如果使用 React Query hooks 管理数据，数据会自动刷新

  useEffect(() => {
    // 🔥 修复：总是保存（条件总是为 true 是多余的），但添加防抖避免频繁保存
    setUserStorageItem('userDayDataOverrides', userDayDataOverrides).catch(error => {
      console.error('[App] Error saving userDayDataOverrides:', error);
    });
  }, [userDayDataOverrides]);

  // ✅ 用户偏好保存逻辑已迁移到useAppPreferences Hook，自动保存

  const handleOpenOnboardingNutritionSolution = () => {
    console.log('🥗 [App] Opening Nutrition Solution page during onboarding');
    console.log('🔍 [App] Before setting state - showOnboardingNutritionSolution:', showOnboardingNutritionSolution);
    setShowOnboardingNutritionSolution(true);
    console.log('✅ [App] State update triggered - showOnboardingNutritionSolution should be true now');
  };

  // CRITICAL: Use ref to prevent duplicate execution
  const isHandlingNutritionCompleteRef = React.useRef(false);

  const handleCloseOnboardingNutritionSolution = async () => {
    // CRITICAL: Prevent duplicate execution
    if (isHandlingNutritionCompleteRef.current) {
      console.warn('⚠️ [App] handleCloseOnboardingNutritionSolution already in progress, ignoring duplicate call');
      return;
    }

    console.log('🎉 [App] Nutrition Solution completed - finishing onboarding flow');
    isHandlingNutritionCompleteRef.current = true;

    try {
      // Set flag to prevent redirect during transition - CRITICAL for preventing flash
      setOnboardingJustCompleted(true);
      console.log('🛡️ [App] onboardingJustCompleted flag set to TRUE - preventing checkOnboardingStatus recheck');

      // CRITICAL: Mark onboarding as completed in database
      console.log('💾 [App] Marking onboarding as completed in database...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: updateError } = await supabaseDb
          .from('user_profiles')
          .update({
            has_seen_onboarding: true,
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('❌ [App] Failed to mark onboarding as completed:', updateError);
        } else {
          console.log('✅ [App] Onboarding marked as completed in database');
          persistOnboardingUnlockToSession(user.id);
          void setUserStorageItem('onboarding_main_unlocked', true);
        }
      } else {
        console.warn('⚠️ [App] No user found when trying to mark onboarding complete');
      }

      // Immediately update UI state to switch screens (no delay)
      setShowOnboardingNutritionSolution(false);
      setShowOnboarding(false);
      setCurrentScreen('mealplan');
      console.log('✅ [App] Switched to meal plan screen');

      // Clear user-isolated storage immediately after UI transition
      await Promise.all([
        removeUserStorageItem('onboarding_step'),
        removeUserStorageItem('onboarding_data'),
        removeUserStorageItem('health_report_saved'),
        removeUserStorageItem('onboarding_completed'),
        removeUserStorageItem('onboarding_skipped'),
        removeUserStorageItem('step14_profile_saved')
      ]);
      console.log('✅ [App] Cleared all onboarding localStorage data');

      // Refresh data in background (async, non-blocking)
      Promise.all([
        refreshProfile(),
        refreshHealthAssessment()
      ]).then(() => {
        console.log('✅ [App] Background data refresh complete');
        // React Query 会自动处理数据更新，无需派发事件
      }).catch(error => {
        console.error('⚠️ [App] Background data refresh error:', error);
      });

      // Clear the completion flag after a longer delay to ensure stability
      // This prevents any race conditions during the final transition
      setTimeout(() => {
        setOnboardingJustCompleted(false);
        console.log('🛡️ [App] onboardingJustCompleted flag cleared after transition complete');
      }, 3000); // Extended to 3 seconds for safety
    } catch (error) {
      console.error('❌ [App] Error in handleCloseOnboardingNutritionSolution:', error);
      // Even on error, complete the transition
      setShowOnboardingNutritionSolution(false);
      setShowOnboarding(false);
      setCurrentScreen('mealplan');
    } finally {
      // Reset the ref after a delay to allow UI to settle
      setTimeout(() => {
        isHandlingNutritionCompleteRef.current = false;
      }, 1000);
    }
  };

  const handleOnboardingComplete = () => {
    console.log('✅ [App] Onboarding flow completed - staying on Health Report Page');
    console.log('ℹ️ [App] User must click "查看营养方案" button to proceed');
    // This handler is called when onboarding reaches the final step (Health Report Page)
    // It does NOT automatically open the Nutrition Solution page
    // The user must explicitly click the "查看营养方案" button to continue
    // Do nothing here - just let the user stay on the Health Report Page
  };

  // 移除频繁的console.log以减少日志噪音
  // console.log('📱 App.tsx - showOnboarding:', showOnboarding);
  // console.log('📱 App.tsx - handleOnboardingComplete defined:', !!handleOnboardingComplete);

  const handleOpenOnboarding = async (resetProgress: boolean = false) => {
    if (resetProgress) {
      // 重新评测：清除进度并标记为重新评测流程
      console.log('🔄 [App] Starting reassessment - clearing ALL onboarding state');

      // CRITICAL: 彻底清空所有引导相关的用户隔离存储数据
      // 这样确保OnboardingContext不会从数据库加载历史数据
      await Promise.all([
        removeUserStorageItem('onboarding_step'),
        removeUserStorageItem('onboarding_data'),
        removeUserStorageItem('health_report_saved'),
        removeUserStorageItem('onboarding_completed'),
        removeUserStorageItem('step14_profile_saved') // 清除步骤14保存标记
      ]);
      console.log('✅ [App] All onboarding localStorage cleared');

      // 设置重新评测标记
      setIsReassessment(true);
      console.log('✅ [App] isReassessment flag set to true');

      // User starts at step 0 (WelcomePage)
    } else {
      // 查看健康报告：跳转到健康报告页（step 15 - now the HealthReportPage)
      console.log('📊 [App] Opening health report view - jumping to step 15');
      await setUserStorageItem('onboarding_step', 15);
      setIsReassessment(false);
    }
    setShowOnboarding(true);
  };

  // 首屏门闸：不再等待 user_profiles（isLoading），弱网下 Supabase 可能十几秒才超时，不应挡住 shell。
  // 档案在 UserProfileContext 后台加载；引导/首页已有 null 档案与超时降级处理。
  // authSettled：已出现会话且 isAuthenticated 时，不因 authLoading 晚一拍而长期卡住（SIGNED_IN 与 setLoading(false) 竞态）
  useEffect(() => {
    const authSettled = !authLoading || (hasActiveSession && isAuthenticated);
    const allKeyLoadingsComplete =
      authSettled &&
      !checkingOnboarding &&
      !checkingOnboardingAfterLogin;

    if (allKeyLoadingsComplete && !initialAppReady) {
      console.log('✅ [App] All loading states completed - app ready', {
        authLoading,
        hasActiveSession,
        checkingOnboarding,
        checkingOnboardingAfterLogin,
        isAuthenticated,
      });
      setInitialAppReady(true);
    }
  }, [
    authLoading,
    hasActiveSession,
    isAuthenticated,
    checkingOnboarding,
    checkingOnboardingAfterLogin,
    initialAppReady,
    setInitialAppReady,
  ]);

  /** 与首屏 effect 一致：用于超时分支判断是否「本应已就绪」 */
  const isAppLoadGateSatisfied = useCallback(() => {
    const authSettled = !authLoading || (hasActiveSession && isAuthenticated);
    return (
      authSettled &&
      !checkingOnboarding &&
      !checkingOnboardingAfterLogin
    );
  }, [
    authLoading,
    hasActiveSession,
    isAuthenticated,
    checkingOnboarding,
    checkingOnboardingAfterLogin,
  ]);

  // 超时兜底：仅当 onboarding 检查标志异常长期未清时强制就绪（不再与 profile isLoading 挂钩）
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!initialAppReady && isAuthenticated) {
        const gateOk = isAppLoadGateSatisfied();
        if (!gateOk && import.meta.env.DEV) {
          console.warn('⚠️ [App] Initial load timeout (3s) - forcing app ready（onboarding 标志未按时清除）', {
            authLoading,
            hasActiveSession,
            checkingOnboarding,
            checkingOnboardingAfterLogin,
            isAuthenticated,
            initialAppReady,
          });
        }
        setInitialAppReady(true);
        setCheckingOnboarding(false);
        clearCheckingOnboardingAfterLogin();
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [
    authLoading,
    hasActiveSession,
    checkingOnboarding,
    checkingOnboardingAfterLogin,
    initialAppReady,
    isAuthenticated,
    isAppLoadGateSatisfied,
    setCheckingOnboarding,
    clearCheckingOnboardingAfterLogin,
    setInitialAppReady,
  ]);

  // 全场景最后兜底：5s 仍 !initialAppReady 则强制展示（未登录也会命中，避免白屏）
  useEffect(() => {
    const forceTimeout = setTimeout(() => {
      if (!initialAppReady) {
        if (import.meta.env.DEV && !isAppLoadGateSatisfied()) {
          console.warn('⚠️ [App] Force showing content after 5s timeout');
        }
        setInitialAppReady(true);
        setCheckingOnboarding(false);
        clearCheckingOnboardingAfterLogin();
      }
    }, 5000);

    return () => clearTimeout(forceTimeout);
  }, [
    initialAppReady,
    isAppLoadGateSatisfied,
    setInitialAppReady,
    setCheckingOnboarding,
    clearCheckingOnboardingAfterLogin,
  ]);

  // 🔥 关键修复：如果用户已完成引导，强制不显示引导页
  // 即使 showOnboarding 为 true，也要检查缓存和 profile
  // 这是最后的防线，确保已登录用户不会看到引导页
  // ⚠️ 必须在所有早期返回之前定义，否则会违反 Hooks 规则
  // 🔥 使用 profileRef.current 获取最新值，避免闭包问题
  const hasCompletedOnboarding = profileRef.current?.has_seen_onboarding === true || 
    onboardingStatusCacheRef.current?.hasSeenOnboarding === true;
  
  // 🔥 添加详细日志（必须在早期返回之前）
  useEffect(() => {
    if (showOnboarding) {
      const currentProfile = profileRef.current;
      console.log('🔍 [App] Onboarding check:', {
        showOnboarding,
        hasCompletedOnboarding,
        profileHasSeenOnboarding: currentProfile?.has_seen_onboarding,
        cacheHasSeenOnboarding: onboardingStatusCacheRef.current?.hasSeenOnboarding,
        profileExists: !!currentProfile,
        profileKeys: currentProfile ? Object.keys(currentProfile) : [],
        isLoading,
        isAuthenticated,
      });
      
      // 🔥 如果 profile 已加载且有 has_seen_onboarding，立即修正
      if (currentProfile && currentProfile.has_seen_onboarding === true) {
        console.log('🔧 [App] Profile loaded with has_seen_onboarding=true, correcting immediately');
        setShowOnboarding(false);
        setCheckingOnboarding(false);
        clearCheckingOnboardingAfterLogin();
        onboardingStatusCacheRef.current = {
          hasSeenOnboarding: true,
          timestamp: Date.now()
        };
      }
    }
  }, [showOnboarding, hasCompletedOnboarding, profile?.has_seen_onboarding, isLoading, isAuthenticated, setShowOnboarding, setCheckingOnboarding, clearCheckingOnboardingAfterLogin]);

  // 🔥 如果检测到用户已完成引导但 showOnboarding 为 true，强制修正
  // 使用 useEffect 确保在 profile 加载后立即修正（必须在早期返回之前）
  useEffect(() => {
    if (!isAuthenticated || !showOnboarding) return;
    
    // 🔥 使用 profileRef.current 获取最新值
    const currentProfile = profileRef.current;
    const completed = currentProfile?.has_seen_onboarding === true || 
      onboardingStatusCacheRef.current?.hasSeenOnboarding === true;
    
    if (completed) {
      console.log('🔧 [App] Force correcting: user has completed onboarding but showOnboarding is true - setting to false', {
        profileHasSeenOnboarding: currentProfile?.has_seen_onboarding,
        cacheHasSeenOnboarding: onboardingStatusCacheRef.current?.hasSeenOnboarding,
        profileExists: !!currentProfile,
        isLoading,
        showOnboarding,
      });
      setShowOnboarding(false);
      setCheckingOnboarding(false);
      clearCheckingOnboardingAfterLogin();
      // 更新缓存
      if (currentProfile?.has_seen_onboarding === true) {
        onboardingStatusCacheRef.current = {
          hasSeenOnboarding: true,
          timestamp: Date.now()
        };
      }
    }
  }, [profile?.has_seen_onboarding, showOnboarding, isAuthenticated, isLoading, setShowOnboarding, setCheckingOnboarding, clearCheckingOnboardingAfterLogin]);

  /** 禁止在 render 内 setState（会触发 React 报错甚至白屏）；已登录且正在检查 onboarding 时，若 profile 已标记完成则异步清标志 */
  useEffect(() => {
    if (!hasActiveSession || !checkingOnboardingAfterLogin) return;
    const completed =
      profile?.has_seen_onboarding === true ||
      onboardingStatusCacheRef.current?.hasSeenOnboarding === true;
    if (!completed) return;
    console.log('✅ [App] User has completed onboarding - skipping loading state');
    clearCheckingOnboardingAfterLogin();
    setShowOnboarding(false);
  }, [hasActiveSession, checkingOnboardingAfterLogin, profile?.has_seen_onboarding, clearCheckingOnboardingAfterLogin, setShowOnboarding]);

  /**
   * 登录后：有档案/解锁信号则立刻收口；档案仍在拉取时不得 setShowOnboarding(true)，否则老用户会闪欢迎页。
   * 拉取结束后无档案或 has_seen===false 再打开引导；期间保持 checkingOnboardingAfterLogin 以走加载门闸而非引导。
   */
  useEffect(() => {
    if (!hasActiveSession || !checkingOnboardingAfterLogin || !authUserId) return;

    if (profile?.has_seen_onboarding === true) {
      clearCheckingOnboardingAfterLogin();
      setShowOnboarding(false);
      return;
    }
    if (hasPersistedOnboardingUnlock(authUserId)) {
      onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
      setShowOnboarding(false);
      clearCheckingOnboardingAfterLogin();
      return;
    }
    try {
      if (sessionStorage.getItem(`healthapp:onb_done:${authUserId}`) === '1') {
        onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
        setShowOnboarding(false);
        clearCheckingOnboardingAfterLogin();
        return;
      }
    } catch {
      /* ignore */
    }

    if (profileIndeterminate) {
      return;
    }

    clearCheckingOnboardingAfterLogin();
    setShowOnboarding(!profile?.has_seen_onboarding);
  }, [
    hasActiveSession,
    checkingOnboardingAfterLogin,
    authUserId,
    profile,
    profileIndeterminate,
    clearCheckingOnboardingAfterLogin,
    setShowOnboarding,
  ]);

  /**
   * 偶发竞态：profile 请求超时或事件顺序异常时 checkingOnboardingAfterLogin 可能未清，导致首屏全屏「加载中」死锁。
   * DB defer 且档案仍在拉取时勿清（与 preserveCheckingOnboardingAfterLoginRef 配合），否则老用户会误关加载门闸。
   */
  useEffect(() => {
    if (!checkingOnboardingAfterLogin || !isAuthenticated || !hasActiveSession) return;
    const t = window.setTimeout(() => {
      if (preserveCheckingOnboardingAfterLoginRef.current && profileIndeterminate) {
        if (import.meta.env.DEV) {
          console.warn(
            '⏳ [App] 跳过 3s 登录门闸兜底：正等待 UserProfileContext（含档案超时未确定），由档案 effect 收口',
          );
        }
        return;
      }
      if (import.meta.env.DEV) {
        console.warn('⚠️ [App] checkingOnboardingAfterLogin 兜底清除（避免弱网/竞态下全屏加载挂死）');
      }
      clearCheckingOnboardingAfterLogin();
    }, 3000);
    return () => window.clearTimeout(t);
  }, [
    checkingOnboardingAfterLogin,
    isAuthenticated,
    hasActiveSession,
    profileIndeterminate,
    clearCheckingOnboardingAfterLogin,
  ]);

  /** 冷启动 INITIAL_SESSION / getSession 挂起 / skip-locked 竞态时 checkingOnboarding 可能长期为 true，与 AfterLogin 对称兜底 */
  useEffect(() => {
    if (!checkingOnboarding || !isAuthenticated || !hasActiveSession) return;
    const t = window.setTimeout(() => {
      if (import.meta.env.DEV) {
        console.warn('⚠️ [App] checkingOnboarding 兜底清除（避免引导检查挂起导致全屏加载死锁）');
      }
      setCheckingOnboarding(false);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [checkingOnboarding, isAuthenticated, hasActiveSession, setCheckingOnboarding]);

  /** 首屏超时已 initialAppReady 时，清掉「登录后检查」标志，避免与首屏门闸条件竞态导致永久加载 */
  useEffect(() => {
    if (!initialAppReady || !checkingOnboardingAfterLogin) return;
    clearCheckingOnboardingAfterLogin();
    if (profile?.has_seen_onboarding === true) {
      setShowOnboarding(false);
    } else if (userId && hasPersistedOnboardingUnlock(userId)) {
      onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
      setShowOnboarding(false);
    } else if (!profileIndeterminate && !profile?.has_seen_onboarding) {
      setShowOnboarding(true);
    }
  }, [
    initialAppReady,
    checkingOnboardingAfterLogin,
    profile?.has_seen_onboarding,
    userId,
    profileIndeterminate,
    clearCheckingOnboardingAfterLogin,
    setShowOnboarding,
  ]);

  const shouldShowOnboarding = showOnboarding && !hasCompletedOnboarding;

  const sessionOnbDoneForGate =
    Boolean(authUserId) &&
    (() => {
      try {
        return sessionStorage.getItem(`healthapp:onb_done:${authUserId}`) === '1';
      } catch {
        return false;
      }
    })();

  /** 档案完成、本地解锁或 session 快路径任一成立则不应被登录后检查挡在加载态 */
  const afterLoginBlocksInitialGate =
    checkingOnboardingAfterLogin &&
    !(profile?.has_seen_onboarding === true) &&
    !(authUserId && hasPersistedOnboardingUnlock(authUserId)) &&
    !sessionOnbDoneForGate;

  if (!initialAppReady && (authLoading || checkingOnboarding || afterLoginBlocksInitialGate)) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#f3f4f6' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
          <p className="text-xs text-gray-400 mt-2">如果长时间未响应，请刷新页面</p>
        </div>
      </div>
    );
  }

  // CRITICAL: Always show login page first if no active session
  // hasActiveSession tracks whether user logged in during current app session
  if (!hasActiveSession && !onboardingJustCompleted) {
    return (
      <>
        <LoginPage
          onLoginSuccess={async () => {
            console.log('✅ [App] Login successful - waiting for auth state to update');
            // Set checking flag immediately to prevent flash
            // 实际的onboarding检查将由onAuthStateChange的SIGNED_IN事件处理
            // 只需要设置标志，让onAuthStateChange来处理实际的检查
            setCheckingOnboardingAfterLogin(true);
            // 等待一小段时间，确保onAuthStateChange事件能够触发
            await new Promise(resolve => setTimeout(resolve, 300));
          }}
        />
        <DevToolsPanel />
      </>
    );
  }

  if (shouldShowOnboarding) {
    return (
      <div className="relative min-h-[100dvh] w-full">
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          onBack={async () => {
            console.log('🔙 [App] User clicked back from onboarding/reassessment');
            // CRITICAL: 清除所有引导数据，防止生成意外的评测记录
            if (isReassessment) {
              console.log('🧹 [App] Reassessment cancelled - clearing all onboarding data');
              await Promise.all([
                removeUserStorageItem('onboarding_step'),
                removeUserStorageItem('onboarding_data'),
                removeUserStorageItem('health_report_saved'),
                removeUserStorageItem('onboarding_completed'),
                removeUserStorageItem('step14_profile_saved')
              ]);
              console.log('✅ [App] All onboarding data cleared');
            }
            setShowOnboarding(false);
            setIsReassessment(false);
            console.log('✅ [App] Returned to main app');
          }}
          isReassessment={isReassessment}
          onOpenNutritionSolution={handleOpenOnboardingNutritionSolution}
        />
        {/* Show NutritionSolutionPage as overlay when user clicks "查看营养方案" at step 16 */}
        {showOnboardingNutritionSolution && (
          <div className="fixed inset-0 bg-white z-[9999] overflow-hidden">
            <div className="w-full max-w-sm mx-auto h-full">
              {/* NutritionSolutionPage overlay */}
              <OnboardingProvider>
                <Suspense
                  fallback={
                    <NutritionSolutionPageFallback
                      showBottomActionPlaceholder
                      onBack={() => setShowOnboardingNutritionSolution(false)}
                    />
                  }
                >
                  <LazyNutritionSolutionPage
                    onComplete={handleCloseOnboardingNutritionSolution}
                    onBack={() => {
                      console.log('⬅️ [App] Closing NutritionSolution overlay, returning to HealthReportPage');
                      setShowOnboardingNutritionSolution(false);
                    }}
                    readOnly={false}
                  />
                </Suspense>
              </OnboardingProvider>
            </div>
          </div>
        )}
        {/* Development Tools Panel - Always visible in development mode */}
        <DevToolsPanel />
      </div>
    );
  }

  // 使用Hook返回的updateDayData函数更新数据
  const handleUpdateDayData = updateDayData;
  // ✅ 已移除 handleRefreshDashboardData - Dashboard 数据现在通过 React Query 自动刷新

  const handleMealPlanSync = async (selectedFoods: Array<{
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
  }>, date: Date, mealData?: any) => {
    const dateKey = formatDateKey(date);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ [App] No user found when syncing meal plan');
        alert('未登录，无法保存套餐记录');
        return;
      }

      // L5-R07：逐条写入，部分失败不吞已成功行；用 allSettled 汇总
      const savePromises = selectedFoods.map(async (food) => {
        const syncId = `sync-${food.originalId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const { data, error } = await supabaseDb
          .from('health_records')
          .insert({
            user_id: user.id,
            record_type: 'food',
            value: food.quantity,
            unit: '份',
            nutrition_data: {
              name: food.name,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
              quantity: food.quantity,
              mealType: food.mealType,
              icon: food.icon,
              originalId: food.originalId,
              syncId: syncId,
            },
            recorded_at: date,
          })
          .select()
          .single();

        if (error) {
          console.error('❌ [App] Error saving meal plan food:', error);
          throw error;
        }

        return {
          id: data.id,
          syncId,
          type: 'food' as const,
          name: food.name,
          calories: food.calories * food.quantity,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          nutrition_data: {
            name: food.name,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: food.fiber,
            quantity: food.quantity,
            mealType: food.mealType,
            icon: food.icon,
            originalId: food.originalId,
            syncId: syncId,
          },
        };
      });

      const settled = await Promise.allSettled(savePromises);
      const savedRecords: any[] = [];
      settled.forEach((r) => {
        if (r.status === 'fulfilled') savedRecords.push(r.value);
      });
      const failCount = settled.filter((r) => r.status === 'rejected').length;

      if (savedRecords.length === 0) {
        alert('保存套餐记录失败，请重试');
        return;
      }
      if (failCount > 0) {
        alert(`已保存 ${savedRecords.length} 条，${failCount} 条失败；未成功的餐品可再次同步。`);
      }
      
      // Update day data with new food records using callback to get latest state
      setUserDayDataOverrides(prev => {
        const currentOverrides = prev[dateKey] || {};
        const currentRecords = currentOverrides.records || [];
        
        // Calculate updated records after adding new foods
        const updatedRecords = [...currentRecords, ...savedRecords];
        
        // Only set syncedMealPlan if ALL foods from mealData are now synced
        let syncedMealPlan = currentOverrides.syncedMealPlan;
        if (mealData) {
          const allMealFoodIds = [
            ...mealData.breakfast.foods.map((f: any) => f.id),
            ...mealData.lunch.foods.map((f: any) => f.id),
            ...mealData.dinner.foods.map((f: any) => f.id)
          ];
          
          const syncedFoodIds = updatedRecords
            .filter(record => record.type === 'food' && record.nutrition_data?.originalId)
            .map(record => record.nutrition_data!.originalId!);
          
          const allFoodsSynced = allMealFoodIds.every(id => syncedFoodIds.includes(id));
          
          if (allFoodsSynced) {
            syncedMealPlan = mealData;
          } else {
            // If not all foods are synced, remove syncedMealPlan
            syncedMealPlan = undefined;
          }
        }
        
        return {
          ...prev,
          [dateKey]: {
            ...currentOverrides,
            records: updatedRecords,
            syncedMealPlan
          }
        };
      });

      console.log('✅ [App] Meal plan foods saved to database:', savedRecords.length);

      queryClient.invalidateQueries({ queryKey: ['food-records', user.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user.id, dateKey] });
      refreshNutrition();
    } catch (error) {
      console.error('❌ [App] Failed to sync meal plan:', error);
      alert('保存套餐记录失败，请重试');
    }
  };

  // ✅ 使用Hook返回的Modal控制函数
  const handleOpenWeightDetail = openWeightDetail;
  const handleOpenWaterDetail = openWaterDetail;
  const handleCloseWaterDetail = closeWaterDetail;
  const handleOpenStepsDetail = openStepsDetail;
  const handleOpenMeasurementsDetail = openMeasurementsDetail;
  const handleCloseMeasurementsDetail = closeMeasurementsDetail;
  const handleOpenBodyCompositionDetail = openBodyCompositionDetail;
  const handleCloseBodyCompositionDetail = closeBodyCompositionDetail;
  const handleOpenExerciseDetail = () => {
    openExerciseStatsDetail();
  };
  const handleOpenExerciseLibrary = () => {
    // 只打开运动库，不关闭运动统计页面
    openExerciseDetail();
  };
  const handleCloseExerciseDetail = closeExerciseDetail;
  const handleCloseExerciseStatsDetail = closeExerciseStatsDetail;
  const handleCloseFoodDetail = closeFoodDetail;
  const handleOpenCalorieDetail = openHealthRingsDetail;
  const handleOpenAISettings = openAISettings;
  const handleCloseAISettings = closeAISettings;
  const handleOpenEmotionJar = openEmotionJar;
  const handleCloseEmotionJar = closeEmotionJar;
  const handleOpenSleepDetail = openSleepDetail;
  const handleCloseSleepDetail = closeSleepDetail;
  const handleOpenBloodGlucoseDetail = openBloodGlucoseDetail;
  const handleCloseReports = closeReports;
  const handleOpenHealthProfile = () => {
    closeReports();
    requestAnimationFrame(() => {
      openMyHealthProfile();
    });
  };
  const handleOpenHealthReport = () => {
    console.log('🎯 App.tsx - Opening Health Report Page');
    openHealthReport();
  };
  const handleCloseHealthReport = () => {
    console.log('🎯 App.tsx - Closing Health Report Page');
    closeHealthReport();
  };
  const handleOpenCustomReports = openCustomReport;
  const handleCloseCustomReports = closeCustomReport;
  const handleCloseProfileSettings = closeProfileSettings;
  const handleCloseMyHealthProfile = closeMyHealthProfile;
  const handleCloseNutritionSolution = closeNutritionSolution;
  const handleCloseOrders = closeOrders;
  const handleCloseDevices = closeDevices;
  const handleCloseAddressManagement = closeAddressManagement;

  const handleOpenRecipeIntro = async () => {
    // Check if meal plan is already configured
    if (mealPlanConfigured && mealPlanConfig) {
      // 🔥 修复：优先使用 mealPlanConfig 的日期（与配置配送计划保存的一致）
      const actualStartDate = mealPlanConfig.startDate;
      const actualEndDate = mealPlanConfig.endDate;

      // If configured, restore the saved configuration并打开「我的专属方案」
      setSelectedOrderDates(mealPlanConfig.selectedDates);
      let mealTypesForUi = mealPlanConfig.selectedMealTypes;
      if (userId) {
        try {
          const slots = await fetchContractMealSlotsEnForUser(userId);
          if (slots?.length) {
            mealTypesForUi = intersectMealTypesEn(mealPlanConfig.selectedMealTypes, slots);
          }
        } catch {
          /* 保持原配置 */
        }
      }
      setSelectedMealTypes(mealTypesForUi);
      setSelectedDeliveryAddressId(mealPlanConfig.deliveryAddressId);
      setDeliveryPlanStartDate(actualStartDate);
      setDeliveryPlanEndDate(actualEndDate);
      setDeliveryPlanDates(mealPlanConfig.selectedDates);
      setSelectedDate(actualStartDate);
      openExclusivePlanHub('meals');
      setCurrentScreen('mealplan');
    } else {
      // Check if this is right after a reset
      const justReset = await getUserStorageItem('mealPlan_justReset');
      if (justReset === 'true') {
        // Clear the flag
        await removeUserStorageItem('mealPlan_justReset');
        // Clear temp data after reset
        setTempSelectedDates([]);
        setTempSelectedMealTypes([]);
        setTempSelectedAddressId('');
        setTempExcludedDates([]);
      }
      const ensureContractForDateUI = async () => {
        if (hasOrder && userId) {
          try {
            const slots = await fetchContractMealSlotsEnForUser(userId);
            if (slots?.length) {
              setActiveOrderIncludedMealsEn(slots);
              setTempSelectedMealTypes((prev) =>
                prev?.length ? intersectMealTypesEn(prev, slots) : prev
              );
              return;
            }
          } catch {
            /* ignore */
          }
        }
        setActiveOrderIncludedMealsEn(null);
      };

      // If has temp data and not just reset, show confirmation modal
      if (tempSelectedDates.length > 0 && justReset !== 'true') {
        await ensureContractForDateUI();
        setShowMealPlanConfirmationModal(true);
      } else {
        await ensureContractForDateUI();
        setShowDateSelectionPage(true);
      }
    }
  };

  const handleOpenDeliveryPlanFromMealPlan = async (
    durationDaysOverride?: number,
    entrySource: 'mealplan' | 'profile' = 'mealplan',
    orderIdOverride?: string,
    forceRegenerate?: boolean
  ) => {
    // 防止重复连点触发并发打开链路，造成入口来源错乱和返回页异常
    if (
      showDeliveryPlanPage ||
      showDateSelectionPage ||
      showAddDeliveryAddressPage ||
      showMealPlanConfirmationModal
    ) {
      return;
    }

    const openSeq = ++deliveryPlanOpenSeqRef.current;
    // 仅用序号作废「重复点击」的旧请求；不要用 currentScreen 比对（异步期间导航合法，不应阻止打开）
    const isOutdated = () => deliveryPlanOpenSeqRef.current !== openSeq;
    let openedOptimistically: 'delivery' | 'date' | null = null;

    setDeliveryPlanEntrySource(entrySource);
    deliveryPlanOpenScreenRef.current = entrySource;
    // “我的 / 瑞丹维 -> 我的配送计划”常规入口先按已有配置立即打开，后续再异步校验和回填最新数据
    // 订单入口（带 orderId / duration）不走这条，避免把旧配置误用于新订单
    if (
      (entrySource === 'profile' || entrySource === 'mealplan') &&
      !orderIdOverride &&
      !durationDaysOverride &&
      !forceRegenerate &&
      mealPlanConfig?.selectedDates?.length
    ) {
      setTempSelectedDates(mealPlanConfig.selectedDates || []);
      setTempSelectedMealTypes(mealPlanConfig.selectedMealTypes || []);
      setTempSelectedAddressId(mealPlanConfig.deliveryAddressId || '');
      setOpenDeliveryPlanAsGenerated(true);
      if (!isOpenedFromOrders) setIsOpenedFromDeliveryPlan(true);
      setShowDeliveryPlanPage(true);
      openedOptimistically = 'delivery';
    } else if (
      entrySource === 'mealplan' &&
      !orderIdOverride &&
      !durationDaysOverride &&
      !forceRegenerate
    ) {
      // 瑞丹维入口兜底：即使还在后台取配置，也先打开日期页，给到立即响应
      if (!isOpenedFromOrders) setIsOpenedFromDeliveryPlan(false);
      setShowDateSelectionPage(true);
      openedOptimistically = 'date';
    }

    // 让 React 提交乐观 UI 并让浏览器先绘制一帧，再进入密集网络请求（显著改善「点了半天没反应」体感）
    if (openedOptimistically) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    if (orderIdOverride) {
      setActiveServiceOrderId(orderIdOverride);
    }

    let effectiveUserId = authUserId || null;
    if (!effectiveUserId) {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      effectiveUserId = sessionUser?.id ?? null;
    }

    // 🔥 从订单入口「首次开启服务」：订单已支付但未激活时，强制空状态，不复用历史配置
    let forceEmptyState = false;
    if (orderIdOverride && effectiveUserId) {
      const { data: orderRow } = await supabaseDb
        .from('orders')
        .select('order_status')
        .eq('id', orderIdOverride)
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      const orderStatus = (orderRow as any)?.order_status;
      if (orderStatus && orderStatus !== 'processing') {
        forceEmptyState = true;
      }
    }

    const [
      paidOrders,
      latestHasOrder,
      configFromService,
      productMeta,
      slotsFromOrder,
    ] = await Promise.all([
      !orderIdOverride && effectiveUserId
        ? orderService.getEligiblePaidOrders(effectiveUserId, 2).catch(() => [])
        : Promise.resolve([]),
      !hasOrder && effectiveUserId
        ? executionProgramService.checkUserHasOrder(effectiveUserId).catch(() => false)
        : Promise.resolve(hasOrder),
      !forceEmptyState && effectiveUserId
        ? getMealPlanConfig(effectiveUserId).catch(() => null)
        : Promise.resolve(null),
      effectiveUserId
        ? fetchLatestPaidOrderProductMeta(effectiveUserId).catch(() => null)
        : Promise.resolve(null),
      orderIdOverride
        ? fetchMealSlotsEnForOrderId(orderIdOverride).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!orderIdOverride && effectiveUserId) {
      if (paidOrders.length === 1) {
        setActiveServiceOrderId(paidOrders[0].id);
      } else {
        setActiveServiceOrderId(null);
      }
    } else if (!orderIdOverride && !effectiveUserId) {
      setActiveServiceOrderId(null);
    }

    if (!hasOrder) {
      if (!latestHasOrder) {
        if (isOutdated()) return;
        if (openedOptimistically === 'delivery') setShowDeliveryPlanPage(false);
        if (openedOptimistically === 'date') setShowDateSelectionPage(false);
        setShowNoOrderAlert(true);
        return;
      }
    }

    const effectiveMealPlanConfig = configFromService || mealPlanConfig;

    // 与商品餐食疗程一致：时长 + 每天包含餐次（英文 key，供日期选择/地址/配送页使用）
    let latestOrderDurationDays = 0;
    let resolvedSlotsEn = includedMealTypesZhToEn(null);
    try {
      if (productMeta) {
        latestOrderDurationDays = productMeta.duration_days || 0;
        if (productMeta.included_meals_en?.length) {
          resolvedSlotsEn = productMeta.included_meals_en;
        }
      }
      if (slotsFromOrder?.length) {
        resolvedSlotsEn = slotsFromOrder;
      }
    } catch (e) {
      console.warn('[App] resolve order meal slots / duration:', e);
    }
    setActiveOrderIncludedMealsEn(resolvedSlotsEn?.length ? resolvedSlotsEn : null);
    // 仅“订单入口（带明确时长）”做强一致时长校验；
    // 瑞丹维入口（无 override）若已有配置应直接进入配送计划页。
    const shouldValidateDuration = typeof durationDaysOverride === 'number' && durationDaysOverride > 0;
    const resolvedDuration = Number(
      durationDaysOverride || (shouldValidateDuration ? activeOrderDurationDays : 0) || latestOrderDurationDays || userPackage?.package_duration || 0
    );
    if (resolvedDuration > 0) {
      setActiveOrderDurationDays(resolvedDuration);
    }

    // 订单时长一致性校验：避免复用旧订单（如21天）的历史配置到当前7天订单
    const expectedDuration = resolvedDuration;
    const configuredDatesCount = effectiveMealPlanConfig?.selectedDates?.length || 0;
    // 允许最多 +3 天（用户可排除最多3天，系统会顺延补齐）
    const isDurationCompatible =
      expectedDuration <= 0 ||
      (configuredDatesCount >= expectedDuration && configuredDatesCount <= expectedDuration + 3);

    // 🔥 检查是否已有可复用配置（且与当前订单时长兼容）
    // 订单未激活时强制空状态，不复用任何历史配置
    const hasValidConfig = !!(
      !forceEmptyState &&
      effectiveMealPlanConfig &&
      effectiveMealPlanConfig?.selectedDates &&
      effectiveMealPlanConfig.selectedDates.length > 0 &&
      (!shouldValidateDuration || isDurationCompatible)
    );

    if (isOutdated()) return;
    
    if (hasValidConfig && !forceRegenerate) {
      if (openedOptimistically === 'date') setShowDateSelectionPage(false);
      setTempSelectedDates(effectiveMealPlanConfig?.selectedDates || []);
      setTempSelectedMealTypes(
        intersectMealTypesEn(effectiveMealPlanConfig?.selectedMealTypes, resolvedSlotsEn)
      );
      setTempSelectedAddressId(effectiveMealPlanConfig?.deliveryAddressId || '');
      setOpenDeliveryPlanAsGenerated(true);
      if (!isOpenedFromOrders) setIsOpenedFromDeliveryPlan(true);
      setShowDeliveryPlanPage(true);
    } else if (hasValidConfig && forceRegenerate) {
      if (openedOptimistically === 'date') setShowDateSelectionPage(false);
      // 从「地址已更新」进入：有配置但需重新生成，展示「生成配送计划」按钮
      setTempSelectedDates(effectiveMealPlanConfig?.selectedDates || []);
      setTempSelectedMealTypes(
        intersectMealTypesEn(effectiveMealPlanConfig?.selectedMealTypes, resolvedSlotsEn)
      );
      setTempSelectedAddressId(effectiveMealPlanConfig?.deliveryAddressId || '');
      setOpenDeliveryPlanAsGenerated(false);
      if (!isOpenedFromOrders) setIsOpenedFromDeliveryPlan(true);
      setShowDeliveryPlanPage(true);
    } else {
      if (openedOptimistically === 'delivery') setShowDeliveryPlanPage(false);
      if (effectiveMealPlanConfig?.selectedDates?.length && !isDurationCompatible) {
        console.warn('⚠️ [App] Existing config duration mismatched with current order, ignoring old config', {
          expectedDuration,
          configuredDatesCount,
        });
      }
      // Check if this is right after a reset
      const justReset = await getUserStorageItem('mealPlan_justReset');
      if (justReset === 'true') {
        await removeUserStorageItem('mealPlan_justReset');
        setTempSelectedDates([]);
        setTempSelectedMealTypes([...resolvedSlotsEn]);
        setTempSelectedAddressId('');
        setTempExcludedDates([]);
      }
      // 订单未激活时强制空状态：清空临时数据，直接进入日期选择（餐次与当前订单商品疗程一致）
      if (forceEmptyState) {
        setTempSelectedDates([]);
        setTempExcludedDates([]);
        setTempSelectedMealTypes([...resolvedSlotsEn]);
        setTempSelectedAddressId('');
      }
      // 临时数据也做同样的时长校验，防止把旧流程残留数据（如21天）继续带入
      const tempDatesCount = tempSelectedDates.length;
      const isTempDurationCompatible =
        expectedDuration <= 0 ||
        (tempDatesCount >= expectedDuration && tempDatesCount <= expectedDuration + 3);

      if (isOutdated()) return;

      // If has valid temp data and not just reset and not forceEmptyState, show confirmation modal
      if (!forceEmptyState && tempSelectedDates.length > 0 && justReset !== 'true' && (!shouldValidateDuration || isTempDurationCompatible)) {
        setShowMealPlanConfirmationModal(true);
      } else {
        if (tempSelectedDates.length > 0 && shouldValidateDuration && !isTempDurationCompatible) {
          setTempSelectedDates([]);
          setTempExcludedDates([]);
          setTempSelectedMealTypes([...resolvedSlotsEn]);
          setTempSelectedAddressId('');
        }
        // Start new flow with date selection
        if (!isOpenedFromOrders) setIsOpenedFromDeliveryPlan(false);
        setShowDateSelectionPage(true);
      }
    }
  };


  // New flow handlers
  const handleDateSelectionComplete = async (
    dates: Date[],
    excludedDates: Date[],
    mealTypes: string[]
  ) => {
    console.log('📅 Date selection complete:', dates, excludedDates, mealTypes);
    let allowed = activeOrderIncludedMealsEn;
    if (userId && (!allowed || allowed.length === 0)) {
      allowed = await fetchContractMealSlotsEnForUser(userId);
    }
    const clamped =
      allowed && allowed.length > 0
        ? intersectMealTypesEn(mealTypes, allowed)
        : mealTypes;
    setTempSelectedDates(dates);
    setTempExcludedDates(excludedDates);
    setTempSelectedMealTypes(clamped);
    // Keep DateSelectionPage open but show modal on top
    setShowMealPlanConfirmationModal(true);
  };

  const handleDateSelectionClose = () => {
    console.log('❌ Date selection cancelled');
    setShowDateSelectionPage(false);
    setTempSelectedDates([]);
    setTempExcludedDates([]);
    setTempSelectedMealTypes([]);
    setActiveOrderIncludedMealsEn(null);
    if (isOpenedFromOrders) setIsOpenedFromOrders(false);
  };

  const handleConfirmationCancel = () => {
    console.log('⬅️ Back to date selection');
    // Close modal and ensure DateSelectionPage is opened
    setShowMealPlanConfirmationModal(false);
    setShowDateSelectionPage(true);
  };

  const handleConfirmationConfirm = () => {
    console.log('✅ Confirmation accepted, opening address page');
    setShowMealPlanConfirmationModal(false);
    setShowDateSelectionPage(false);
    setShowAddDeliveryAddressPage(true);
  };

  const handleAddressPage1Close = () => {
    console.log('❌ Address page cancelled, returning to meal plan page');
    setShowAddDeliveryAddressPage(false);
    // Don't clear temp data - keep it for next time
    // User returns to meal plan page, next click will show confirmation modal
  };

  const handleAddressPage1Complete = (addressId: string) => {
    console.log('🏠 handleAddressPage1Complete called with addressId:', addressId);
    console.log('🏠 Current state - tempSelectedDates:', tempSelectedDates);
    console.log('🏠 Current state - tempSelectedMealTypes:', tempSelectedMealTypes);

    // Store the selected address temporarily
    setTempSelectedAddressId(addressId);

    // Filter out excluded dates
    const finalDates = tempSelectedDates.filter(date =>
      !tempExcludedDates.some(excluded => excluded.toDateString() === date.toDateString())
    );

    console.log('🏠 Final dates after filtering:', finalDates);

    setSelectedOrderDates(finalDates);
    setSelectedMealTypes(tempSelectedMealTypes);
    setSelectedDeliveryAddressId(addressId);

    // Close address page and show setup modal
    console.log('🏠 Closing address page and opening setup modal');
    setOpenDeliveryPlanAsGenerated(false);
    setShowAddDeliveryAddressPage(false);
    setShowDeliveryPlanPage(true);
  };

  const handleDeliveryPlanComplete = async (mealAddresses: Record<string, string>) => {
    console.log('🚀 [handleDeliveryPlanComplete] Starting - Meal addresses count:', Object.keys(mealAddresses).length);
    const startTime = performance.now();

    let allowedSlots = activeOrderIncludedMealsEn;
    if (userId && (!allowedSlots || allowedSlots.length === 0)) {
      allowedSlots = await fetchContractMealSlotsEnForUser(userId);
    }
    const mealTypesClamped =
      allowedSlots && allowedSlots.length > 0
        ? intersectMealTypesEn(tempSelectedMealTypes, allowedSlots)
        : [...tempSelectedMealTypes];
    setTempSelectedMealTypes(mealTypesClamped);

    // 先捕获所需数据（在清空状态前）
    const filteredDates = tempSelectedDates.filter(date =>
      !tempExcludedDates.some(excluded => excluded.toDateString() === date.toDateString())
    );
    if (filteredDates.length === 0) {
      console.warn('⚠️ [handleDeliveryPlanComplete] No dates to save');
      setShowDeliveryPlanPage(false);
      return;
    }
    const sortedDates = [...filteredDates].sort((a, b) => a.getTime() - b.getTime());
    const actualStartDate = sortedDates[0];
    const actualEndDate = sortedDates[sortedDates.length - 1];
    const config = {
      selectedDates: filteredDates,
      selectedMealTypes: mealTypesClamped,
      deliveryAddressId: tempSelectedAddressId,
      startDate: actualStartDate,
      endDate: actualEndDate
    };
    // 在 setTimeout 前捕获，避免闭包内读到已清空的状态
    const datesToSync = [...filteredDates];
    const mealTypesToSync = [...mealTypesClamped];
    const addressIdFallback = tempSelectedAddressId || '';
    const orderIdToLink = activeServiceOrderId || null;
    const shouldCloseOrdersAfterSuccess = isOpenedFromOrders;

    setTimeout(async () => {
      try {
        // Save meal addresses to state and localStorage
        console.log('💾 [handleDeliveryPlanComplete] Saving to state and localStorage');
        setMealAddresses(mealAddresses);
        await setUserStorageItem('mealAddresses', mealAddresses);

        setDeliveryPlanStartDate(actualStartDate);
        setDeliveryPlanEndDate(actualEndDate);
        setDeliveryPlanDates(filteredDates);
        setSelectedDate(actualStartDate);
        setSelectedOrderDates(filteredDates);
        setSelectedMealTypes(mealTypesClamped);
        setSelectedDeliveryAddressId(tempSelectedAddressId);

        console.log('💾 [handleDeliveryPlanComplete] Saving to Supabase...');
        await saveMealPlanConfig(userId, config);
        console.log('✅ [handleDeliveryPlanComplete] Config saved');

        // 先进入「我的专属方案」，再跑排期同步/订单推进，避免确认弹窗结束后长时间像卡死
        setShowDeliveryPlanPage(false);
        setDeliveryPlanEntrySource(null);
        setIsOpenedFromDeliveryPlan(false);
        setCurrentScreen('mealplan');
        openExclusivePlanHub('meals');
        if (shouldCloseOrdersAfterSuccess) {
          closeOrders();
          setIsOpenedFromOrders(false);
        }
        setTempSelectedDates([]);
        setTempExcludedDates([]);
        setTempSelectedMealTypes([]);
        setTempSelectedAddressId('');

        let orderStatusPromoted = false;
        let orderStatusPendingReason = '';
        let syncBlockFailed = false;
        try {
          if (userId && datesToSync.length > 0 && mealTypesToSync.length > 0) {
            const allMealKeys = datesToSync.flatMap((date) =>
              mealTypesToSync.map((mealType) => getMealKey(date, mealType))
            );
            await setUserStorageItem('mealPlan_lockedMeals', allMealKeys);

            const scheduleItems = datesToSync.flatMap((date) =>
              mealTypesToSync.map((mealType) => {
                const mealKey = getMealKey(date, mealType);
                return {
                  date,
                  mealType,
                  addressId: mealAddresses[mealKey] || addressIdFallback,
                  isLocked: true,
                };
              })
            ).filter(item => !!item.addressId);

            const syncResult = await deliveryScheduleService.syncUserDeliverySchedules(userId, scheduleItems, orderIdToLink);
            console.log('✅ [App] Delivery schedules persisted after plan generation:', syncResult);
            if (syncResult.hasErrors || syncResult.invalidAddressCount > 0) {
              throw new Error(
                `配送计划同步不完整：目标 ${syncResult.targetCount}，新增 ${syncResult.insertedCount}，更新 ${syncResult.updatedCount}，无效地址 ${syncResult.invalidAddressCount}，错误 ${syncResult.errorCount}`
              );
            }
            if (syncResult.targetCount > 0 && (syncResult.insertedCount + syncResult.updatedCount) === 0) {
              console.warn('[App] 配送计划同步结果为 0 行变更（可能是幂等提交）', syncResult);
            }
            queryClient.invalidateQueries({ queryKey: ['delivery-plan-card'] });
          }

          queryClient.invalidateQueries({ queryKey: ['profile-badges'] });

          try {
            if (userId) {
              if (activeServiceOrderId) {
                await orderService.promoteOrderToProcessing(userId, activeServiceOrderId);
                orderStatusPromoted = true;
              } else {
                const paidOrders = await orderService.getEligiblePaidOrders(userId, 2);
                if (paidOrders.length === 1) {
                  await orderService.promoteOrderToProcessing(userId, paidOrders[0].id);
                  orderStatusPromoted = true;
                } else if (paidOrders.length > 1) {
                  console.warn('[App] 检测到多条已支付订单，且缺少 activeServiceOrderId，已跳过状态推进以避免串单');
                  orderStatusPendingReason = '检测到多条已支付订单，请前往“我的订单”选择对应订单开启服务。';
                } else {
                  orderStatusPendingReason = '未定位到可开启服务的已支付订单，请前往“我的订单”重试。';
                }
              }
            } else {
              orderStatusPendingReason = '当前未登录，无法自动开启服务。';
            }
          } catch (syncOrderErr) {
            console.warn('[App] 订单状态同步为服务中失败:', syncOrderErr);
            const orderErr = syncOrderErr as Error & { code?: string };
            orderStatusPendingReason = orderErr.message || '订单状态同步失败，请前往“我的订单”重试开启服务。';
          }
        } catch (syncBlockErr) {
          syncBlockFailed = true;
          console.error('[App] 配送排期同步失败（配置已保存）:', syncBlockErr);
          setDeliveryPlanToast({
            show: true,
            message: syncBlockErr instanceof Error ? syncBlockErr.message : '配送排期同步异常，请稍后在「我的配送计划」检查。',
          });
          window.setTimeout(() => setDeliveryPlanToast((t) => ({ ...t, show: false })), 6200);
        }

        const successMsg = orderStatusPromoted
          ? '配送计划已生效，订单已进入服务中。'
          : `配送计划已生效，但订单未自动进入服务中。${orderStatusPendingReason || '请前往“我的订单”重试开启服务。'}`;
        if (userId) {
          queryClient.invalidateQueries({ queryKey: ['user-has-order', userId] });
          queryClient.invalidateQueries({ queryKey: ['execution-program', userId] });
        }
        await refreshMealPlanConfig();
        if (!syncBlockFailed) {
          setDeliveryPlanToast({ show: true, message: successMsg });
          window.setTimeout(() => setDeliveryPlanToast((t) => ({ ...t, show: false })), 5200);
        }
        window.dispatchEvent(new CustomEvent('deliveryPlanConfiguredFeedback'));
        setActiveServiceOrderId(null);

        const elapsedTime = performance.now() - startTime;
        console.log(`⚡ [handleDeliveryPlanComplete] Completed in ${elapsedTime.toFixed(2)}ms`);
      } catch (error) {
        console.error('❌ [handleDeliveryPlanComplete] Unexpected error:', error);
        alert(error instanceof Error ? error.message : '配送计划同步失败，请重试');
        if (isOpenedFromOrders) setIsOpenedFromOrders(false);
        setActiveServiceOrderId(null);
        // 导航已完成，仅刷新配置
        refreshMealPlanConfig();
      }
    }, 50);
  };

  const handleDeliveryPlanClose = () => {
    setOpenDeliveryPlanAsGenerated(false);
    setShowDeliveryPlanPage(false);
    setActiveServiceOrderId(null);

    // 从订单页打开：关闭后回到订单页（不关闭订单，仅关闭配送计划）
    if (isOpenedFromOrders) {
      setIsOpenedFromOrders(false);
      setDeliveryPlanEntrySource(null);
      deliveryPlanOpenScreenRef.current = null;
      return;
    }
    const closeSource =
      deliveryPlanEntrySource ||
      deliveryPlanOpenScreenRef.current ||
      (currentScreen === 'profile' ? 'profile' : currentScreen === 'mealplan' ? 'mealplan' : null);

    // 从“我的 > 我的配送计划”打开：关闭后回到我的页面
    if (closeSource === 'profile') {
      setIsOpenedFromDeliveryPlan(false);
      setDeliveryPlanEntrySource(null);
      deliveryPlanOpenScreenRef.current = null;
      setCurrentScreen('profile');
      return;
    }
    // 从服务套餐页打开：回到 meal plan
    if (isOpenedFromDeliveryPlan) {
      setIsOpenedFromDeliveryPlan(false);
      setDeliveryPlanEntrySource(null);
      deliveryPlanOpenScreenRef.current = null;
      setCurrentScreen('mealplan');
    } else {
      // 否则回到地址选择（正常配置流程）
      setDeliveryPlanEntrySource(null);
      deliveryPlanOpenScreenRef.current = null;
      setShowAddDeliveryAddressPage(true);
    }
  };

  // 配送计划请求确认：弹窗在 App 层级，与 DeliveryPlanPage 完全分离，避免 removeChild 错误
  const handleDeliveryPlanRequestConfirmation = (data: DeliveryPlanConfirmationData) => {
    setPendingDeliveryPlanConfirmation(data);
    setShowDeliveryPlanConfirmationModal(true);
  };

  const handleDeliveryPlanConfirmFromModal = () => {
    if (!pendingDeliveryPlanConfirmation) return;
    const mealAddresses = pendingDeliveryPlanConfirmation.mealAddresses;
    setShowDeliveryPlanConfirmationModal(false);
    setPendingDeliveryPlanConfirmation(null);
    // 延迟执行，确保确认弹窗已完全从 DOM 卸载后再关闭 DeliveryPlanPage
    setTimeout(() => handleDeliveryPlanComplete(mealAddresses), 150);
  };




  const handleOpenEditDashboard = openEditDashboard;

  const handleCloseEditDashboard = async () => {
    // ✅ EditDashboardScreen 内部已经处理了保存，这里只需要关闭
    // 但为了确保保存完成，我们可以等待一小段时间
    closeEditDashboard();
    // 注意：EditDashboardScreen 的 handleClose 已经会等待保存完成，所以这里不需要再次保存
  };

  const handleOpenNutritionDetail = openNutritionDetail;
  const handleCloseNutritionDetail = closeNutritionDetail;

  const handleMealIntakeComplete = async (date: Date, mealType: string, mealInfo?: { calories: number; foodName: string }) => {
    const dateKey = formatDateKey(date);
    const currentOverrides = userDayDataOverrides[dateKey] || {};
    const currentMealIntakeStatus = currentOverrides.mealIntakeStatus || {};
    
    handleUpdateDayData(date, {
      mealIntakeStatus: {
        ...currentMealIntakeStatus,
        [mealType]: {
          intakeCompletedAt: new Date().toISOString()
        }
      }
    });

    // 🔥 同步写入 health_records，确保今日餐、日反馈、餐食方案全站数据一致
    if (mealInfo && userId) {
      const mealLabels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
      const mealLabel = mealLabels[mealType] || mealType;
      try {
        const orderSyncId = `order-intake-${dateKey}-${mealType}-${userId}-${Date.now()}`;
        await nutritionSyncService.saveFoodEntry(
          mealInfo.foodName || mealLabel,
          mealInfo.calories || 0,
          mealLabel,
          1,
          date,
          'manual',
          undefined,
          undefined,
          { syncId: orderSyncId }
        );
        queryClient.invalidateQueries({ queryKey: ['food-records', userId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId, dateKey] });
        const todayKey = toLocalDateString(new Date());
        if (dateKey === todayKey) {
          const nextArr = (() => {
            const old = queryClient.getQueryData<string[]>([TODAY_CONSUMED_MEALS_KEY, userId, todayKey]);
            const arr = Array.isArray(old) ? [...old] : [];
            if (!arr.includes(mealType)) arr.push(mealType);
            return arr;
          })();
          queryClient.setQueryData<string[]>([TODAY_CONSUMED_MEALS_KEY, userId, todayKey], nextArr);
          await setUserStorageItem('today-consumed-meals', { dateKey: todayKey, meals: nextArr });
          queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', userId] });
        }
      } catch (e) {
        console.warn('[App] handleMealIntakeComplete 同步 health_records 失败:', e);
      }
    }

    // 🔥 新增：自动完成对应的执行任务（打通餐食配送与任务流）
    if (executionProgram?.id && completeExecutionTask) {
      try {
        const taskDate = toLocalDateString(date);
        
        // 查找对应的餐食任务
        const { data: tasks, error } = await supabaseDb
          .from('daily_execution_tasks')
          .select('*')
          .eq('program_id', executionProgram.id)
          .eq('task_date', taskDate)
          .eq('task_type', 'meal')
          .eq('task_status', 'pending')
          .contains('task_data', { meal_type: mealType })
          .limit(1)
          .maybeSingle();

        if (!error && tasks) {
          await completeExecutionTask({ 
            taskId: tasks.id, 
            completionData: { 
              meal_type: mealType,
              completed_via: 'meal_intake',
              completed_at: new Date().toISOString()
            } 
          });
          console.log('✅ [App] Execution task completed for meal:', mealType);
        }
      } catch (error) {
        console.error('❌ [App] Error completing execution task:', error);
        // 不阻塞主流程，静默失败
      }
    }
  };

  // ✅ 使用Hook的updateCardOrder函数，自动处理保存逻辑
  const handleUpdateCardOrder = updateCardOrder;

  // ✅ 使用Hook的updateHiddenCards函数，自动处理保存逻辑
  const handleUpdateHiddenCards = updateHiddenCards;

  const handleOpenAIChat = () => {
    setCurrentScreen('ai');
  };
  
  // 处理运动添加的回调函数
  const handleExerciseAdd = async (exercises: any[], date: Date) => {
    // 先保存到数据库，成功后 React Query 会自动刷新
    try {
      // 串行保存：useExerciseRecordsQuery 同一时间只允许一条写入，并行会触发「正在保存运动记录，请稍候」
      const now = new Date();
      const selectedDate = new Date(date);
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      const recordedAt = selectedDate.toISOString();
      for (const ex of exercises) {
        await addExerciseRecord({
          exercise_name: ex.name,
          exercise_type: 'other',
          duration: ex.duration,
          calories_burned: ex.calories,
          recorded_at: recordedAt,
          icon: ex.icon,
          originalId: ex.id,
        });
      }
      // 保存成功后，React Query 会自动刷新，不需要手动添加到 userDayDataOverrides
    } catch (error) {
      console.error('Failed to add exercise records:', error);
      const errorMessage = error instanceof Error ? error.message : '保存运动记录失败，请重试';
      alert(`保存失败：${errorMessage}`);
      return; // 如果保存失败，不关闭页面，让用户重试
    }

    closeExerciseDetail();
    openExerciseStatsDetail();
  };
  
  // 处理食物添加的回调函数
  const handleFoodAdd = async (foods: any[], mealType: string, date: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ [App] No user found when adding foods');
        alert('未登录，无法保存食物记录');
        return;
      }

      const savePromises = foods.map((food) =>
        supabaseDb
          .from('health_records')
          .insert({
            user_id: user.id,
            record_type: 'food',
            value: food.quantity,
            unit: '份',
            nutrition_data: {
              name: food.name,
              calories: food.calories,
              mealType: mealType,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
              quantity: food.quantity,
              image: food.image,
              icon: food.icon,
              source: 'manual',
            },
            recorded_at: date.toISOString(),
          })
          .then((res: { error: unknown }) => {
            if (res.error) {
              console.error('❌ [App] Error saving food to database:', res.error);
              throw res.error;
            }
          })
      );

      const settledFood = await Promise.allSettled(savePromises);
      const successfulFoods = foods.filter((_, i) => settledFood[i]?.status === 'fulfilled');
      const failFoodCount = settledFood.filter((r) => r.status === 'rejected').length;

      if (successfulFoods.length === 0) {
        alert('保存食物记录失败，请重试');
        closeFoodDetail();
        return;
      }
      if (failFoodCount > 0) {
        alert(`已保存 ${successfulFoods.length} 条，${failFoodCount} 条失败；失败的条目可重新添加。`);
      }

      console.log('✅ [App] Foods saved (partial or full):', successfulFoods.length);

      const dateKeyFood = toLocalDateString(date);
      queryClient.invalidateQueries({ queryKey: ['food-records', user.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user.id, dateKeyFood] });

      handleUpdateDayData(date, {
        records: [
          ...(currentDateData.records || []),
          ...successfulFoods.map((food, index) => ({
            id: `food-${Date.now()}-${index}`,
            type: 'food' as const,
            name: food.name,
            calories: food.calories * food.quantity,
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            nutrition_data: {
              name: food.name,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
              quantity: food.quantity,
              mealType,
              image: food.image,
              icon: food.icon,
              source: 'manual',
            },
          })),
        ],
      });

      refreshNutrition();

      closeFoodDetail();
    } catch (error) {
      console.error('❌ [App] Failed to save foods:', error);
      const errorMessage = error instanceof Error ? error.message : '保存食物记录失败，请重试';
      alert(`保存失败：${errorMessage}`);
      closeFoodDetail();
    }
  };

  // 准备AppModals组件的props
  const navigationState = {
    showWeightDetailScreen: modalStates.showWeightDetailScreen,
    showWaterDetailScreen: modalStates.showWaterDetailScreen,
    showStepsDetailScreen: modalStates.showStepsDetailScreen,
    showMeasurementsDetailScreen: modalStates.showMeasurementsDetailScreen,
    showBodyCompositionDetailScreen: modalStates.showBodyCompositionDetailScreen,
    showExerciseDetailScreen: modalStates.showExerciseDetailScreen,
    showExerciseStatsDetailScreen: modalStates.showExerciseStatsDetailScreen,
    showHealthRingsDetailScreen: modalStates.showHealthRingsDetailScreen,
    showFoodDetailScreen: modalStates.showFoodDetailScreen,
    showAISettingsScreen: modalStates.showAISettingsScreen,
    showEmotionJarScreen: modalStates.showEmotionJarScreen,
    showSleepDetailScreen: modalStates.showSleepDetailScreen,
    showBloodGlucoseDetailScreen: modalStates.showBloodGlucoseDetailScreen,
    showEditDashboardScreen: modalStates.showEditDashboardScreen,
    showNutritionDetailScreen: modalStates.showNutritionDetailScreen,
    showProfileSettingsScreen: modalStates.showProfileSettingsScreen,
    showMyHealthProfileScreen: modalStates.showMyHealthProfileScreen,
    showReportsScreen: modalStates.showReportsScreen,
    showHealthReportPage: modalStates.showHealthReportPage,
    showNutritionSolutionPage: modalStates.showNutritionSolutionPage,
    showOrdersScreen: modalStates.showOrdersScreen,
    showDevicesScreen: modalStates.showDevicesScreen,
    showAddressManagementScreen: modalStates.showAddressManagementScreen,
    showCustomReportScreen: modalStates.showCustomReportScreen,
    showExclusivePlanHubScreen: modalStates.showExclusivePlanHubScreen,
    exclusivePlanHubInitialTab: modalStates.exclusivePlanHubInitialTab,
  };

  const closeHandlers = {
    handleCloseWeightDetail,
    handleCloseWaterDetail,
    handleCloseStepsDetail,
    handleCloseMeasurementsDetail,
    handleCloseBodyCompositionDetail,
    handleCloseExerciseDetail,
    handleCloseExerciseStatsDetail,
    handleCloseHealthRingsDetail,
    handleCloseFoodDetail,
    handleCloseAISettings,
    handleCloseEmotionJar,
    handleCloseSleepDetail,
    handleCloseBloodGlucoseDetail,
    handleCloseEditDashboard,
    handleCloseNutritionDetail,
    handleCloseProfileSettings,
    handleCloseMyHealthProfile,
    handleCloseReports,
    handleCloseHealthReport,
    handleCloseNutritionSolution,
    handleCloseOrders,
    handleCloseDevices,
    handleCloseAddressManagement,
    handleCloseCustomReport: handleCloseCustomReports,
    handleCloseExclusivePlanHub: closeExclusivePlanHub,
  };

  return (
    <div className="h-screen bg-gray-100 overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
      <div className="w-full max-w-sm bg-white relative h-full flex flex-col mx-auto" style={{ backgroundColor: '#ffffff' }}>
        {/* 使用AppModals组件替代所有DetailScreen条件渲染 */}
        <AppModals
          navigation={navigationState}
          onClose={closeHandlers}
          selectedDate={selectedDate}
          foodDetailScreenDate={foodDetailScreenDate}
          currentDateData={currentDateData}
          userId={userId}
          showTutorialData={showOnboarding}
          userWeight={userWeight}
          nutritionRefreshKey={nutritionRefreshKey}
          userDayDataOverrides={userDayDataOverrides}
          dashboardCardOrder={dashboardCardOrder}
          hiddenDashboardCards={hiddenDashboardCards}
          onSelectedDateChange={setSelectedDate}
          onFoodDetailDateChange={(date) => {
            setFoodDetailScreenDate(date);
            setSelectedDate(date);
          }}
          onUpdateDayData={handleUpdateDayData}
          onUpdateCardOrder={handleUpdateCardOrder}
          onUpdateHiddenCards={handleUpdateHiddenCards}
          onOpenExerciseLibrary={handleOpenExerciseLibrary}
          onOpenFoodDetail={(date) => {
            setFoodDetailScreenDate(date || selectedDate);
            openFoodDetail();
          }}
          onRefreshNutrition={refreshNutrition}
          onExerciseAdd={handleExerciseAdd}
          onFoodAdd={handleFoodAdd}
          onMealPlanSync={handleMealPlanSync}
          onDeleteLocalExerciseRecord={(recordId: string, date: Date) => {
            const dateKey = formatDateKey(date);
            setUserDayDataOverrides(prev => {
              const dayData = prev[dateKey];
              if (!dayData || !dayData.records) return prev;
              
              const updatedRecords = dayData.records.filter((r: any) => r.id !== recordId);
              
              // 如果删除的是运动记录，需要更新运动统计数据
              const deletedRecord = dayData.records.find((r: any) => r.id === recordId);
              const currentExercise = dayData.exercise || { calories: 0, minutes: 0 };
              let updatedExercise: { calories: number; minutes: number } = { 
                calories: currentExercise.calories || 0, 
                minutes: currentExercise.minutes || 0 
              };
              
              if (deletedRecord && deletedRecord.type === 'exercise' && deletedRecord.exercise_data) {
                updatedExercise = {
                  minutes: Math.max(0, updatedExercise.minutes - (deletedRecord.exercise_data.duration || 0)),
                  calories: Math.max(0, updatedExercise.calories - (deletedRecord.exercise_data.calories || 0))
                };
              }
              
              return {
                ...prev,
                [dateKey]: {
                  ...dayData,
                  records: updatedRecords,
                  exercise: updatedExercise
                }
              };
            });
          }}
          onMealIntakeComplete={handleMealIntakeComplete}
          onOpenBloodGlucoseDetail={handleOpenBloodGlucoseDetail}
          onRefreshDayData={loadDayData}
          deliveryPlanStartDate={deliveryPlanStartDate}
          deliveryPlanEndDate={deliveryPlanEndDate}
          deliveryPlanDates={deliveryPlanDates}
          packageDuration={userPackage?.package_duration}
          includedMeals={userPackage?.included_meals}
          hasOrder={effectiveHasOrder}
          orderGateLoading={orderGateLoading}
        />

        {/* 使用AppHeader组件替代Header和Calendar Modal */}
        <AppHeader
          currentScreen={currentScreen}
          selectedDate={selectedDate}
          showCalendar={showCalendar}
          onDateClick={() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentSelectedDate = new Date(selectedDate);
            currentSelectedDate.setHours(0, 0, 0, 0);

            if (currentSelectedDate.getTime() === today.getTime()) {
              // If selected date is today, open calendar modal
              setShowCalendar(true);
            } else {
              // If selected date is not today, go back to today
              setSelectedDate(today);
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - 6);
              setDisplayedWeekStart(weekStart);
            }
          }}
          onBackClick={() => setCurrentScreen('ai')}
          onOpenLeftDrawer={currentScreen === 'ai' ? () => setShowLeftDrawer(true) : undefined}
          onScan={() => { /* TODO: 扫一扫 */ }}
          onBindDevice={openDevices}
          onProductIntro={() => { /* TODO: 产品介绍 */ }}
          onShare={() => { /* TODO: 分享产品 */ }}
          formatDate={formatDate}
          generateCalendarDays={generateCalendarDays}
          isToday={isToday}
          isSameMonth={isSameMonth}
          onCalendarDateSelect={(date) => {
            const normalizedSelected = new Date(date);
            normalizedSelected.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (normalizedSelected.getTime() > today.getTime()) return;
            setSelectedDate(date);
            setDisplayedWeekStart(date);
            setShowCalendar(false);
          }}
          onCalendarClose={() => setShowCalendar(false)}
          onCalendarMonthChange={(direction) => {
            if (direction === 'next') {
              const today = new Date();
              const nextMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
              const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
              if (nextMonth.getTime() > currentMonthStart.getTime()) return;
            }
            setSelectedDate(new Date(
              selectedDate.getFullYear(),
              selectedDate.getMonth() + (direction === 'next' ? 1 : -1)
            ));
          }}
          onGoToToday={() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            setSelectedDate(today);
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - 6);
            setDisplayedWeekStart(weekStart);
            setShowCalendar(false);
          }}
        />

        {/* Main Content */}
        {/* CRITICAL: Use inline style for padding-top and padding-bottom to ensure it always applies correctly on mobile browsers */}
        {/* All navigation pages now use unified navigation, so all pages get the same padding */}
        {/* Inline styles force React to recalculate on state changes, avoiding Tailwind class caching issues */}
        <div 
          className={`flex-1 ${currentScreen === 'ai' ? 'overflow-hidden' : 'overflow-y-auto'} scrollbar-hide ${currentScreen === 'dashboard' ? 'bg-[#F5F7FA]' : currentScreen === 'ai' ? 'bg-white' : 'bg-white'}`}
          style={{
            paddingTop: APP_HEADER_HEIGHT_CSS,
            paddingBottom: currentScreen === 'ai' ? 'calc(env(safe-area-inset-bottom) + 100px)' : 'calc(env(safe-area-inset-bottom) + 70px)',
            backgroundColor: currentScreen === 'dashboard' ? undefined : '#ffffff',
            minHeight: currentScreen === 'ai' ? '100%' : '100%'
          }}
        >
          {/* 使用AppRouter组件替代主路由条件渲染 */}
          <AppRouter
            currentScreen={currentScreen}
            selectedDate={selectedDate}
            displayedWeekStart={displayedWeekStart}
            chatSelectedDate={chatSelectedDate}
            setChatSelectedDate={setChatSelectedDate}
            currentDateData={currentDateData}
            dashboardCardOrder={dashboardCardOrder}
            hiddenDashboardCards={hiddenDashboardCards}
            onSelectedDateChange={setSelectedDate}
            onDisplayedWeekStartChange={setDisplayedWeekStart}
            onUpdateDayData={handleUpdateDayData}
            onOpenWeightDetail={handleOpenWeightDetail}
            onOpenWaterDetail={handleOpenWaterDetail}
            onOpenStepsDetail={handleOpenStepsDetail}
            onOpenMeasurementsDetail={handleOpenMeasurementsDetail}
            onOpenExerciseDetail={handleOpenExerciseDetail}
            onOpenCalorieDetail={handleOpenCalorieDetail}
            onOpenBodyCompositionDetail={handleOpenBodyCompositionDetail}
            onOpenEmotionJar={handleOpenEmotionJar}
            onOpenSleepDetail={handleOpenSleepDetail}
            onOpenBloodGlucoseDetail={handleOpenBloodGlucoseDetail}
            onOpenAIChat={handleOpenAIChat}
            onOpenAISettings={handleOpenAISettings}
            onOpenEditDashboard={handleOpenEditDashboard}
            onOpenNutritionDetail={handleOpenNutritionDetail}
            onOpenHealthReport={handleOpenHealthReport}
            onOpenOnboarding={handleOpenOnboarding}
            onOpenCustomReports={handleOpenCustomReports}
            onOpenRecipeIntro={handleOpenRecipeIntro}
            onOpenDeliveryPlan={handleOpenDeliveryPlanFromMealPlan}
            onOpenExclusivePlanHub={() => openExclusivePlanHub('meals')}
            onOpenProfileSettings={openProfileSettings}
            onOpenMyHealthProfile={openMyHealthProfile}
            onOpenAddressManagement={openAddressManagement}
            onOpenOrders={openOrders}
            onOpenDeliveryPlanFromProfile={async () => {
              setIsOpenedFromOrders(false);
              setIsOpenedFromDeliveryPlan(false);
              await handleOpenDeliveryPlanFromMealPlan(undefined, 'profile');
            }}
            onOpenReports={openReports}
            onOpenDevices={openDevices}
            onBackToDashboard={() => setCurrentScreen('ai')}
            onTakePhoto={() => { /* TODO: 拍照上传 */ }}
            onRealtimeCardClick={handleRealtimeCardClick}
          />
        </div>

        {/* Profile Settings Screen - 按需加载 */}
        {modalStates.showProfileSettingsScreen && (
          <Suspense fallback={null}>
            <LazyProfileSettingsScreen
              onClose={closeProfileSettings}
              onOpenOnboarding={handleOpenOnboarding}
            />
          </Suspense>
        )}

        {/* Reports Screen */}
        {modalStates.showReportsScreen && (
          <Suspense fallback={null}>
            <LazyMyReportsScreen
              onClose={handleCloseReports}
              onOpenReassessment={handleOpenOnboarding}
              onOpenHealthProfile={handleOpenHealthProfile}
            onGoToMealPlan={() => {
              closeReports();
              setCurrentScreen('mealplan');
            }}
            />
          </Suspense>
        )}

        {/* Health Report Page (Direct View) - 按需加载 */}
        {modalStates.showHealthReportPage && (
          <Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-50"><div className="text-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-600">加载中...</p></div></div>}>
            <LazyHealthReportView
              onClose={handleCloseHealthReport}
              onOpenNutritionSolution={() => {
                console.log('🥗 [App] Opening Nutrition Solution from Health Report View');
                openNutritionSolution();
              }}
            />
          </Suspense>
        )}

        {/* Nutrition Solution Page (Direct View) - 按需加载 */}
        {modalStates.showNutritionSolutionPage && (
          <div className="absolute inset-0 bg-white z-50">
            <OnboardingProvider>
              <Suspense
                fallback={
                  <NutritionSolutionPageFallback onBack={() => closeNutritionSolution()} />
                }
              >
                <LazyNutritionSolutionPage
                  onComplete={() => {
                    console.log('🔙 [App] Closing Nutrition Solution - returning to Health Report View');
                    closeNutritionSolution();
                  }}
                  onBack={() => {
                    console.log('⬅️ [App] Back button clicked in Nutrition Solution - returning to Health Report View');
                    closeNutritionSolution();
                  }}
                  readOnly={true}
                />
              </Suspense>
            </OnboardingProvider>
          </div>
        )}

        {/* Orders Screen - 按需加载 */}
        {modalStates.showOrdersScreen && (
          <MyOrdersScreen
            onClose={closeOrders}
            onOpenDeliveryPlan={async (durationDays, orderId) => {
              setIsOpenedFromOrders(true);
              setIsOpenedFromDeliveryPlan(false);
              setActiveOrderDurationDays(durationDays || null);
              setActiveServiceOrderId(orderId || null);
              await handleOpenDeliveryPlanFromMealPlan(durationDays, 'mealplan', orderId);
            }}
            onRenewPackage={() => setCurrentScreen('mealplan')}
          />
        )}

        {/* Devices Screen - 按需加载 */}
        {modalStates.showDevicesScreen && (
          <Suspense fallback={null}>
            <LazyMyDevicesScreen
              onClose={closeDevices}
            />
          </Suspense>
        )}

        {/* Address Management Screen - 按需加载 */}
        {modalStates.showAddressManagementScreen && (
          <Suspense fallback={null}>
            <LazyAddDeliveryAddressPage
              show={modalStates.showAddressManagementScreen}
              onClose={closeAddressManagement}
              onComplete={closeAddressManagement}
              showCompleteButton={false}
              orderMealTypes={
                tempSelectedMealTypes?.length
                  ? tempSelectedMealTypes
                  : activeOrderIncludedMealsEn || includedMealTypesZhToEn(null)
              }
              onOpenDeliveryPlan={async () => {
                closeAddressManagement();
                await handleOpenDeliveryPlanFromMealPlan(undefined, 'profile', undefined, true);
              }}
            />
          </Suspense>
        )}

        {/* Custom Report Screen - 按需加载 */}
        {modalStates.showCustomReportScreen && (
          <Suspense fallback={null}>
            <LazyCustomReportScreen onClose={handleCloseCustomReports} />
          </Suspense>
        )}

        {/* Date Selection Page - Step 1 of new flow */}
        {showDateSelectionPage && (
          <DateSelectionPage
            key={`ds-${activeOrderDurationDays ?? 0}-${(activeOrderIncludedMealsEn || []).join('.')}`}
            onClose={handleDateSelectionClose}
            onNext={handleDateSelectionComplete}
            packageData={(() => {
              const dur =
                activeOrderDurationDays ||
                userPackage?.package_duration ||
                7;
              const meals =
                activeOrderIncludedMealsEn && activeOrderIncludedMealsEn.length > 0
                  ? activeOrderIncludedMealsEn
                  : includedMealTypesZhToEn(null);
              return {
                ...(userPackage || {}),
                package_duration: dur,
                included_meals:
                  meals && meals.length > 0 ? meals : includedMealTypesZhToEn(null),
              } as any;
            })()}
            initialSelectedDates={tempSelectedDates}
            initialExcludedDates={tempExcludedDates}
            initialSelectedMealTypes={tempSelectedMealTypes}
          />
        )}

        {/* Meal Plan Confirmation Modal - Step 2 of new flow */}
        {showMealPlanConfirmationModal && (
          <MealPlanConfirmationModal
            selectedDates={tempSelectedDates}
            excludedDates={tempExcludedDates}
            selectedMealTypes={tempSelectedMealTypes}
            onConfirm={handleConfirmationConfirm}
            onCancel={handleConfirmationCancel}
          />
        )}

        {/* Address Selection Page - Step 3 of new flow */}
        {showAddDeliveryAddressPage && (
          <Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-50"><div className="text-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-600">加载中...</p></div></div>}>
            <LazyAddDeliveryAddressPage
              show={showAddDeliveryAddressPage}
              onClose={handleAddressPage1Close}
              onComplete={handleAddressPage1Complete}
              orderMealTypes={tempSelectedMealTypes}
            selectedDates={tempSelectedDates.filter(date =>
              !tempExcludedDates.some(excluded => excluded.toDateString() === date.toDateString())
            )}
            excludedDates={tempExcludedDates}
            />
          </Suspense>
        )}

        {/* 配送计划确认弹窗 - App 层级，与 DeliveryPlanPage 分离，避免 removeChild */}
        <DeliveryPlanConfirmationModal
          show={showDeliveryPlanConfirmationModal}
          data={pendingDeliveryPlanConfirmation}
          onConfirm={handleDeliveryPlanConfirmFromModal}
          onClose={() => { setShowDeliveryPlanConfirmationModal(false); setPendingDeliveryPlanConfirmation(null); }}
        />

        {/* 无订单提示弹窗 - 使用应用内样式，替代原生 alert */}
        <AlertDialog
          show={showNoOrderAlert}
          type="warning"
          title="无法配置"
          message="你还没有有效订单，无法配置！"
          onClose={() => setShowNoOrderAlert(false)}
          confirmText="确定"
          zIndex={120}
        />

        {/* Delivery Plan Page - Step 4 of new flow */}
        {showDeliveryPlanPage && (
          <Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-50"><div className="text-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-600">加载中...</p></div></div>}>
            <DeliveryPlanPage
              show={showDeliveryPlanPage}
              initialPlanGenerated={openDeliveryPlanAsGenerated}
              selectedMealTypes={tempSelectedMealTypes}
              selectedDates={tempSelectedDates.filter(date =>
                !tempExcludedDates.some(excluded => excluded.toDateString() === date.toDateString())
              )}
              defaultAddressId={tempSelectedAddressId}
              excludedDates={tempExcludedDates}
              activeOrderId={activeServiceOrderId}
              onRequestConfirmation={handleDeliveryPlanRequestConfirmation}
              onClose={handleDeliveryPlanClose}
            />
          </Suspense>
        )}


        {/* Bottom Navigation - Hide when AI screens, Health Report, Nutrition Solution, Reports Screen, Onboarding, Daily Statistics Screen, or any secondary drawer screens are open */}
        {/* 单页主界面：移除底部 4 tab，通过左侧抽屉与能力条进入 */}

        {/* 左侧抽屉 - 日历日记流 */}
        <LeftDrawer
          show={showLeftDrawer}
          onClose={() => setShowLeftDrawer(false)}
          onOpenProfile={() => { setShowLeftDrawer(false); setCurrentScreen('profile'); }}
          onOpenServicePackage={() => { setShowLeftDrawer(false); setCurrentScreen('mealplan'); }}
          onOpenHealthArchive={() => { setShowLeftDrawer(false); setCurrentScreen('dashboard'); }}
          onSelectDate={(date) => setChatSelectedDate(date instanceof Date ? date : new Date(date as any))}
        />

        {deliveryPlanToast.show && (
          <div
            className="fixed left-1/2 bottom-24 z-[125] max-w-[min(340px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg"
            role="status"
          >
            {deliveryPlanToast.message}
          </div>
        )}

        {breathingPracticeOpen && (
          <BreathingPracticeOverlay
            source={breathingPracticeOpen.source}
            chatMessageId={breathingPracticeOpen.chatMessageId}
            onClose={(detail) => {
              if (detail?.recordedBreathing) {
                try {
                  sessionStorage.setItem('pending-breathing-feedback', String(Date.now()));
                } catch {
                  /* ignore */
                }
                window.dispatchEvent(new CustomEvent('breathingPracticeRecorded'));
              }
              setBreathingPracticeOpen(null);
            }}
          />
        )}

        {/* Development Tools Panel - Always visible in development mode */}
        <DevToolsPanel />
      </div>
    </div>
  );
}

export default App;
