import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { UserProfile } from '../utils/bmrCalculations';
import { supabase } from '../config/supabase';
import { UserPackage, getUserActivePackage, getDefaultMockPackage, MockPackageData } from '../services/packageService';
import {
  MealPlanConfiguration,
  clearMealPlanConfig,
  getMealPlanConfig,
  clampMealPlanConfigToContractSlots,
  persistClampedMealPlanConfigIfNeeded,
} from '../services/mealPlanConfigService';
import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from '../utils/userStorage';
import { persistOnboardingUnlockToSession } from '../utils/onboardingUnlockSignals';
import { useHealthAssessmentQuery } from '../hooks/useHealthAssessmentQuery';
import { useUserProfileQuery } from '../hooks/useUserProfileQuery';
import { useAuth } from './AuthContext';
import type { HealthAssessmentData } from '../services/healthAssessmentService';
import { computeIntakePlanActive } from '../utils/intakePlanGate';

interface UserProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  /** user_profiles 请求超时：profile 可能晚到，勿当作「无档案新用户」 */
  profileFetchTimedOut: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  userId: string | null;
  userPackage: UserPackage | MockPackageData | null;
  isLoadingPackage: boolean;
  refreshPackage: () => Promise<void>;
  mealPlanConfigured: boolean;
  /** 配送计划已配置并生效口径：与 meal_plan_configured + 有效起止日期一致 */
  intakePlanActive: boolean;
  mealPlanConfig: MealPlanConfiguration | null;
  refreshMealPlanConfig: () => Promise<void>;
  resetMealPlanConfig: () => Promise<void>;
  healthAssessment: HealthAssessmentData | null;
  isLoadingAssessment: boolean;
  refreshHealthAssessment: () => Promise<any>; // React Query的refetch返回QueryObserverResult
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return context;
};

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;

  // ✅ 使用 React Query Hook 管理用户档案数据（替代手动localStorage缓存）
  const {
    profile,
    isLoading: isLoadingProfile,
    profileFetchTimedOut,
    isError: isProfileError,
    error: profileError,
    updateProfile: updateProfileMutation,
    refresh: refreshProfileQuery,
  } = useUserProfileQuery();

  // ✅ 用户切换时重置；不在「加载中」重置 hasHandled*，否则超时→error→refetch→loading→重置 会无限打 Supabase
  const lastProfileIdRef = React.useRef<string | null>(null);
  const lastErrorRef = React.useRef<string | null>(null);
  const hasHandledErrorRef = React.useRef(false);
  const lastHandledUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      lastProfileIdRef.current = null;
      lastErrorRef.current = null;
      hasHandledErrorRef.current = false;
      lastHandledUserIdRef.current = null;
      return;
    }
    if (user.id !== lastHandledUserIdRef.current) {
      lastHandledUserIdRef.current = user.id;
      hasHandledErrorRef.current = false;
      lastErrorRef.current = null;
    }
  }, [isAuthenticated, user?.id]);

  React.useEffect(() => {
    const currentProfileId = profile?.display_user_id || user?.id || null;
    const currentError = profileError?.message || null;

    if (!isAuthenticated || !user?.id) return;
    if (isLoadingProfile) return;

    if (isProfileError && currentError !== lastErrorRef.current && !hasHandledErrorRef.current) {
      hasHandledErrorRef.current = true;
      lastErrorRef.current = currentError;
      console.warn('⚠️ [UserProfileContext] Profile 查询失败（已停止自动 refetch，避免与超时/网络问题死循环）:', profileError);
    } else if (profile && currentProfileId !== lastProfileIdRef.current) {
      lastProfileIdRef.current = currentProfileId;
      hasHandledErrorRef.current = false;
      lastErrorRef.current = null;
    }
  }, [
    isAuthenticated,
    user?.id,
    isLoadingProfile,
    profile,
    profile?.display_user_id,
    isProfileError,
    profileError,
    profileError?.message,
  ]);

  // 档案一旦确认已完成引导，写入本地解锁信号，供弱网超时后仍不进引导页
  React.useEffect(() => {
    if (!userId || !profile?.has_seen_onboarding) return;
    persistOnboardingUnlockToSession(userId);
    void setUserStorageItem('onboarding_main_unlocked', true);
  }, [userId, profile?.has_seen_onboarding]);

  // 使用 React Query hook 管理健康评估数据
  const { assessment: healthAssessment, isLoading: isLoadingAssessment, refresh: refreshHealthAssessment } = useHealthAssessmentQuery();

  const [userPackage, setUserPackage] = useState<UserPackage | MockPackageData | null>(null);
  const [isLoadingPackage, setIsLoadingPackage] = useState(true);
  const [mealPlanConfigured, setMealPlanConfigured] = useState(false);
  const [mealPlanConfig, setMealPlanConfig] = useState<MealPlanConfiguration | null>(null);

  // ✅ 使用 React Query 的 mutation 更新用户档案
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      await updateProfileMutation(updates);
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    }
  };

  // ✅ 使用 React Query 的 refetch 刷新用户档案
  const refreshProfile = async () => {
    await refreshProfileQuery();
  };

  // 🔥 修复：使用 useCallback 包装 loadPackage，避免无限循环
  const loadPackage = useCallback(async () => {
    try {
      setIsLoadingPackage(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const packageData = await getUserActivePackage(user.id);

        if (packageData) {
          setUserPackage(packageData);
        } else {
          const mockPackage = getDefaultMockPackage();
          setUserPackage(mockPackage);
          console.log('Using mock package data:', mockPackage);
        }
      } else {
        const mockPackage = getDefaultMockPackage();
        setUserPackage(mockPackage);
      }
    } catch (err) {
      console.error('Failed to load package:', err);
      const mockPackage = getDefaultMockPackage();
      setUserPackage(mockPackage);
    } finally {
      setIsLoadingPackage(false);
    }
  }, []); // 空依赖数组，因为函数内部使用的是最新的状态

  const refreshPackage = async () => {
    await loadPackage();
  };

  const loadMealPlanConfig = useCallback(async () => {
    try {
      // ✅ 优先从 profile 数据中读取，避免重复查询数据库
      if (profile && !isLoadingProfile) {
        setMealPlanConfigured(profile.meal_plan_configured || false);

        if (profile.meal_plan_config_data) {
          const configData = profile.meal_plan_config_data as any;
          const startStr = configData.start_date ?? configData.startDate;
          const endStr = configData.end_date ?? configData.endDate;
          const raw: MealPlanConfiguration = {
            selectedDates: configData.selected_dates?.map((d: string) => new Date(d)) || [],
            selectedMealTypes: configData.selected_meal_types || [],
            deliveryAddressId: configData.delivery_address_id,
            startDate: new Date(startStr),
            endDate: new Date(endStr)
          };
          const clamped = await clampMealPlanConfigToContractSlots(userId, raw);
          const persisted = await persistClampedMealPlanConfigIfNeeded(userId, raw, clamped);
          if (persisted) {
            refreshProfileQuery().catch(() => {});
          }
          setMealPlanConfig(clamped);
        } else {
          setMealPlanConfig(null);
        }
        return; // 直接从 profile 读取，不需要查询数据库
      }

      // ✅ 如果 profile 还没加载，尝试从 localStorage 读取（离线支持）
      const localConfigured = await getUserStorageItem<string>('meal_plan_configured');
      setMealPlanConfigured(localConfigured === 'true');

      const localConfig = await getUserStorageItem<any>('meal_plan_config_data');
      if (localConfig) {
        const raw: MealPlanConfiguration = {
          selectedDates: localConfig.selected_dates?.map((d: string) => new Date(d)) || [],
          selectedMealTypes: localConfig.selected_meal_types || [],
          deliveryAddressId: localConfig.delivery_address_id,
          startDate: new Date(localConfig.start_date),
          endDate: new Date(localConfig.end_date)
        };
        const clamped = await clampMealPlanConfigToContractSlots(userId, raw);
        const persisted = await persistClampedMealPlanConfigIfNeeded(userId, raw, clamped);
        if (persisted) {
          refreshProfileQuery().catch(() => {});
        }
        setMealPlanConfig(clamped);
      } else {
        setMealPlanConfig(null);
      }
    } catch (err) {
      console.error('Failed to load meal plan config:', err);
    }
  }, [profile, isLoadingProfile, userId, refreshProfileQuery]);

  // 🔥 修复：从 DB 拉取最新配置，确保定制餐食页面与配置配送计划同步（保存后 profile 可能未刷新）
  const refreshMealPlanConfig = useCallback(async () => {
    try {
      const cfg = await getMealPlanConfig(userId);
      if (cfg) {
        const clamped = await clampMealPlanConfigToContractSlots(userId, cfg);
        const persisted = await persistClampedMealPlanConfigIfNeeded(userId, cfg, clamped);
        if (persisted) {
          refreshProfileQuery().catch(() => {});
        }
        setMealPlanConfigured(true);
        setMealPlanConfig(clamped);
      } else {
        setMealPlanConfigured(false);
        setMealPlanConfig(null);
      }
    } catch (err) {
      console.error('Failed to refresh meal plan config:', err);
    }
  }, [userId, refreshProfileQuery]);

  const resetMealPlanConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const effectiveUserId = user?.id || null;

      // Clear meal plan configuration from database/localStorage
      await clearMealPlanConfig(effectiveUserId);

      // Clear locked meals from localStorage (这些会在 DeliveryPlanPage 中按用户隔离)
      await removeUserStorageItem('mealPlan_lockedMeals');

      // Clear meal addresses from localStorage (这些会在 App.tsx 中按用户隔离)
      await removeUserStorageItem('mealAddresses');

      // Set a flag to indicate that a reset just happened (使用新格式键，按用户隔离)
      await setUserStorageItem('mealPlan_justReset', 'true');

      // Update local state
      setMealPlanConfigured(false);
      setMealPlanConfig(null);

      console.log('✅ Meal plan configuration reset successfully');
    } catch (error) {
      console.error('Failed to reset meal plan configuration:', error);
      throw error;
    }
  };

  // loadHealthAssessment 已被 useHealthAssessmentQuery hook 替代
  // refreshHealthAssessment 从 useHealthAssessmentQuery hook 中获取

  // 🔥 修复：使用 ref 存储 refresh 函数，避免无限循环
  const refreshHealthAssessmentRef = useRef(refreshHealthAssessment);
  const refreshProfileQueryRef = useRef(refreshProfileQuery);
  const loadMealPlanConfigRef = useRef(loadMealPlanConfig);
  
  // 更新 ref 值（不触发重新渲染）
  useEffect(() => {
    refreshHealthAssessmentRef.current = refreshHealthAssessment;
    refreshProfileQueryRef.current = refreshProfileQuery;
    loadMealPlanConfigRef.current = loadMealPlanConfig;
  }, [refreshHealthAssessment, refreshProfileQuery, loadMealPlanConfig]);

  useEffect(() => {
    // ✅ profile 现在由 useUserProfileQuery hook 自动管理，无需手动加载
    loadPackage();
    // ❌ 移除 loadMealPlanConfig()，改为在 profile 加载完成后自动调用（见下面的 useEffect）
    // healthAssessment 现在由 useHealthAssessmentQuery hook 自动管理

    // Listen for test user data cleared event (test mode only)
    // 注意：testUserDataCleared 和 userRegistered 是测试和特殊场景的事件
    // 可以保留，因为它们不是常规的数据同步事件
    const handleTestUserDataCleared = () => {
      setUserPackage(null);
      setMealPlanConfigured(false);
      setMealPlanConfig(null);
      // 使用 React Query 的 invalidateQueries 来刷新数据
      refreshHealthAssessmentRef.current();
      refreshProfileQueryRef.current();
      loadPackage();
      loadMealPlanConfigRef.current();
    };

    // userRegistered 事件已由 supabase.auth.onAuthStateChange 处理，无需监听
    // testUserDataCleared 是测试工具事件，保留用于开发环境
    window.addEventListener('testUserDataCleared', handleTestUserDataCleared);

    return () => {
      window.removeEventListener('testUserDataCleared', handleTestUserDataCleared);
    };
  }, [loadPackage]); // 避免 profile 变化导致重复触发 loadPackage

  // ✅ 新增：当 profile 加载完成后，自动加载 meal plan config
  // 使用 useRef 防止重复调用
  const mealPlanConfigLoadedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (profile && !isLoadingProfile) {
      // 检查是否已经为这个 profile 加载过（通过 profile 的某个唯一标识）
      const profileId = profile.display_user_id || user?.id || 'unknown';
      if (mealPlanConfigLoadedRef.current !== profileId) {
        if (import.meta.env.DEV) {
          console.log('🔄 [UserProfileContext] Profile loaded, updating meal plan config from profile data');
        }
        mealPlanConfigLoadedRef.current = profileId;
        loadMealPlanConfig();
      }
    } else if (!isAuthenticated || !user?.id) {
      // 如果用户未登录，尝试从 localStorage 读取（只读取一次）
      if (mealPlanConfigLoadedRef.current !== 'local') {
        mealPlanConfigLoadedRef.current = 'local';
        loadMealPlanConfig();
      }
    }
  }, [profile, isLoadingProfile, isAuthenticated, user?.id, loadMealPlanConfig]);

  // ✅ profile 现在由 useUserProfileQuery hook 自动管理，React Query 会自动处理用户切换
  // 这里只处理其他状态（userPackage, mealPlanConfig）的加载
  const hasInitializedRef = React.useRef(false);
  const lastUserIdRef = React.useRef<string | null>(null);
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUserId = session?.user?.id || null;
      
      // 忽略 INITIAL_SESSION 事件（只在真正的初始化时处理，避免页面可见性变化时重复触发）
      if (event === 'INITIAL_SESSION') {
        if (!hasInitializedRef.current && session?.user) {
          hasInitializedRef.current = true;
          lastUserIdRef.current = currentUserId;
          loadPackage();
          // ❌ 移除 loadMealPlanConfig()，因为 profile 加载完成后会自动触发（见下面的 useEffect）
          // ✅ React Query 会自动触发查询，不需要手动 refreshProfileQuery
          // refreshProfileQuery(); 
          // refreshHealthAssessment(); // React Query 会自动处理
        }
        return;
      }
      
      // 只处理真正的 SIGNED_IN 事件（用户切换或新登录），忽略页面可见性变化导致的重复触发
      if (event === 'SIGNED_IN' && session?.user) {
        // 检查是否是用户切换（userId 变化）
        if (lastUserIdRef.current !== null && lastUserIdRef.current !== currentUserId) {
          hasInitializedRef.current = true;
          lastUserIdRef.current = currentUserId;
          loadPackage();
          // ❌ 移除 loadMealPlanConfig()，因为 profile 加载完成后会自动触发（见下面的 useEffect）
          // ✅ React Query 会自动触发查询，不需要手动 refreshProfileQuery
          // refreshProfileQuery(); 
          // refreshHealthAssessment(); // React Query 会自动处理
        } else if (!hasInitializedRef.current) {
          // 首次登录
          hasInitializedRef.current = true;
          lastUserIdRef.current = currentUserId;
          loadPackage();
          // ❌ 移除 loadMealPlanConfig()，因为 profile 加载完成后会自动触发（见下面的 useEffect）
          // ✅ React Query 会自动触发查询，不需要手动 refreshProfileQuery
          // refreshProfileQuery(); 
          // refreshHealthAssessment(); // React Query 会自动处理
        } else {
          // 已经初始化且用户未变化，忽略（可能是页面可见性变化导致的重复触发）
          return;
        }
      } else if (event === 'SIGNED_OUT') {
        hasInitializedRef.current = false;
        lastUserIdRef.current = null;
        setUserPackage(null);
        setMealPlanConfigured(false);
        setMealPlanConfig(null);
        setIsLoadingPackage(false);
        // profile 和 healthAssessment 由 React Query hooks 自动处理
      }
    });

    // 用户状态变化已通过 supabase.auth.onAuthStateChange 处理，无需监听自定义事件
    return () => {
      subscription.unsubscribe();
    };
  }, [loadPackage]);

  const intakePlanActive = React.useMemo(
    () => computeIntakePlanActive(mealPlanConfigured, mealPlanConfig),
    [mealPlanConfigured, mealPlanConfig],
  );

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        isLoading: isLoadingProfile,
        profileFetchTimedOut,
        error: isProfileError ? (profileError?.message || '加载用户资料失败') : null,
        updateProfile,
        refreshProfile,
        userId,
        userPackage,
        isLoadingPackage,
        refreshPackage,
        mealPlanConfigured,
        intakePlanActive,
        mealPlanConfig,
        refreshMealPlanConfig,
        resetMealPlanConfig,
        healthAssessment,
        isLoadingAssessment,
        refreshHealthAssessment,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};
