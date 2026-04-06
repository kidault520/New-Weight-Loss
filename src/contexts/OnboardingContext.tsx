import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode, startTransition } from 'react';
import { supabase } from '../config/supabase';
import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from '../utils/userStorage';

/** 将数据库档案合并进引导态：禁止用 null / 占位昵称覆盖用户当前已填写内容（修复异步加载覆盖性别、昵称） */
function mergeOnboardingFromDb(prev: OnboardingData, db: OnboardingData): OnboardingData {
  const next: OnboardingData = { ...prev };
  (Object.entries(db) as [keyof OnboardingData, unknown][]).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (key === 'nickname') {
      const s = String(value).trim();
      if (!s) return;
      const prevNick = (prev.nickname || '').trim();
      if (s === '用户' && prevNick && prevNick !== '用户') return;
    }

    if (Array.isArray(value)) {
      const arr = value as unknown[];
      const prevArr = prev[key];
      if (
        arr.length === 0 &&
        Array.isArray(prevArr) &&
        (prevArr as unknown[]).length > 0
      ) {
        return;
      }
    }

    (next as Record<string, unknown>)[key] = value;
  });
  return next;
}

export interface OnboardingData {
  nickname?: string;
  gender?: 'male' | 'female';
  fitnessGoal?: 'weight_loss' | 'maintain_health' | 'tone' | 'confidence' | 'muscle_gain' | 'other';
  age?: number;
  height?: number;
  currentWeight?: number;
  targetWeight?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dietaryPreferences?: string[];
  exerciseHabits?: string[];
  sleepHours?: number;
  waterIntake?: number;
  healthConcerns?: string[];
  [key: string]: any;
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  resetData: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
  currentSection: number;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canGoBack: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// 可选的 onboarding hook，不在 provider 中时返回 null
export const useOnboardingOptional = () => {
  return useContext(OnboardingContext);
};

interface OnboardingProviderProps {
  children: ReactNode;
  isReassessment?: boolean; // 标识是否为重新评测模式
}

const STORAGE_KEY = 'onboarding_data';
const STEP_KEY = 'onboarding_step';

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children, isReassessment = false }) => {
  const [data, setData] = useState<OnboardingData>({});
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 🔥 修复：使用用户ID作为key，防止组件重新挂载时重复初始化
  const initializedUserIdRef = React.useRef<string | null>(null);
  const databaseQueryInProgressRef = React.useRef<boolean>(false); // 🔥 修复：防止重复查询数据库

  const totalSteps = 16;

  // 改为异步加载，因为需要获取用户ID
  const [currentStep, setCurrentStep] = useState<number>(0);

  const currentSection = useMemo(() => {
    if (currentStep === 0) return 0; // WelcomePage
    if (currentStep <= 8) return 1; // Body Data section (steps 1-8)
    if (currentStep <= 14) return 2; // About You section (steps 9-14)
    return 3; // Health Report (step 15)
  }, [currentStep]);

  useEffect(() => {
    const initializeData = async () => {
      let currentUserId = 'anonymous';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || 'anonymous';
        
        // 🔥 修复：检查是否已为当前用户初始化过
        if (initializedUserIdRef.current === currentUserId && isInitialized) {
          console.log('✅ [OnboardingContext] Already initialized for user:', currentUserId);
          return;
        }

        // CRITICAL: 如果没有用户登录，立即清除所有引导状态
        if (!user) {
          console.log('❌ [OnboardingContext] 没有登录用户，清除所有引导数据');
          console.log('🧹 [OnboardingContext] Clearing onboarding state from localStorage');
          setCurrentStep(0);
          await Promise.all([
            removeUserStorageItem(STEP_KEY),
            removeUserStorageItem(STORAGE_KEY),
            removeUserStorageItem('onboarding_completed'),
            removeUserStorageItem('onboarding_skipped'),
            removeUserStorageItem('health_report_saved')
          ]);
          setData({});
          console.log('✅ [OnboardingContext] All onboarding state cleared for non-logged-in user');
          initializedUserIdRef.current = currentUserId;
          setIsInitialized(true);
          return;
        }

        if (user) {
          // 加载当前步骤（用户隔离）
          const savedStep = await getUserStorageItem<number>(STEP_KEY);
          if (savedStep !== null && savedStep >= 0 && savedStep < totalSteps) {
            setCurrentStep(savedStep);
          } else {
            setCurrentStep(0);
          }

          // CRITICAL: 在重新评测模式下，完全不从数据库加载历史数据
          // 用户必须从空白表单开始重新填写所有数据才能生成新的评测报告
          // 这确保了每次重新评测都是基于用户当前的真实填写，而不是修改历史数据
          if (isReassessment) {
            console.log('🔄🔄🔄 [OnboardingContext] REASSESSMENT MODE ACTIVATED');
            console.log('🚫 [OnboardingContext] BLOCKING all historical data loading');
            console.log('🆕 [OnboardingContext] User MUST start with completely EMPTY form');
            console.log('📝 [OnboardingContext] This ensures each reassessment is independent');

            // CRITICAL: 在重新评测模式下，清空localStorage中的所有旧数据
            // 这防止了用户看到上次评测时填写的数据
            console.log('🧹 [OnboardingContext] Clearing ALL stale data for reassessment:');
            console.log('  - Removing onboarding data from localStorage');
            console.log('  - Removing health report saved flag');
            console.log('  - Removing step14 profile saved flag');
            console.log('  - Resetting to empty state');
            await Promise.all([
              removeUserStorageItem(STORAGE_KEY),
              removeUserStorageItem(STEP_KEY),
              removeUserStorageItem('health_report_saved'),
              removeUserStorageItem('step14_profile_saved') // 清除步骤14保存标记
            ]);

            // 设置空数据对象，强制用户从头开始填写
            setData({});
            setCurrentStep(0);
            console.log('✅ [OnboardingContext] Reassessment initialization complete');
            console.log('📋 [OnboardingContext] State:', {
              hasData: false,
              dataKeys: [],
              userMustFillFromScratch: true,
              willCreateNewRecord: true,
              willNotModifyOldRecords: true
            });
            initializedUserIdRef.current = currentUserId;
            setIsInitialized(true);
            return;
          }

          // 🔥 优化：先快速加载 localStorage 数据（同步），立即完成初始化
          // 然后异步加载数据库数据（不阻塞渲染）
          const savedData = await getUserStorageItem<OnboardingData>(STORAGE_KEY);
          const initialData = savedData || {};
          setData(initialData);
          initializedUserIdRef.current = currentUserId;
          setIsInitialized(true);

          // 首次引导或查看模式：异步从数据库加载历史数据（不阻塞渲染）
          // 使用 Promise 异步加载，加载完成后使用 startTransition 更新
          // 🔥 修复：防止重复查询数据库
          if (databaseQueryInProgressRef.current) {
            console.log('⏸️ [OnboardingContext] Database query already in progress, skipping duplicate query');
            return;
          }
          
          databaseQueryInProgressRef.current = true;
          Promise.resolve().then(async () => {
            try {
              console.log('👤 [OnboardingContext] Loading profile data from database (async, non-blocking)');
              const { data: profileData } = await supabase
                .from('user_profiles')
                .select(`
                  nickname,
                  gender,
                  age,
                  height,
                  current_weight,
                  target_weight,
                  activity_level,
                  fitness_goal,
                  dietary_preferences,
                  exercise_habits,
                  sleep_hours,
                  water_intake,
                  health_concerns
                `)
                .eq('user_id', user.id)
                .maybeSingle();

              if (profileData) {
                // Map database fields to onboarding data format
                // 所有数据现在都存储在规范化字段中，不再使用 onboarding_data JSON 字段
                const dbData: OnboardingData = {
                  nickname: profileData.nickname,
                  gender: profileData.gender,
                  age: profileData.age,
                  height: profileData.height,
                  currentWeight: profileData.current_weight,
                  targetWeight: profileData.target_weight,
                  activityLevel: profileData.activity_level,
                  fitnessGoal: profileData.fitness_goal,
                  dietaryPreferences: profileData.dietary_preferences || [],
                  exerciseHabits: profileData.exercise_habits || [],
                  sleepHours: profileData.sleep_hours,
                  waterIntake: profileData.water_intake,
                  healthConcerns: profileData.health_concerns || [],
                };

                // 合并数据库档案：仅用「有值」字段覆盖，且不用占位昵称「用户」覆盖用户已填昵称
                // 必须用函数式更新，避免闭包里的 initialData 落后于用户已点击的步骤
                startTransition(() => {
                  setData((prev) => mergeOnboardingFromDb(prev, dbData));
                });
                console.log('✅ OnboardingContext merged user profile from DB (non-destructive):', dbData);
              }
            } catch (error) {
              console.warn('⚠️ [OnboardingContext] Failed to load profile data (non-critical):', error);
            } finally {
              // 🔥 修复：查询完成后重置标志
              databaseQueryInProgressRef.current = false;
            }
          });
          
          // 立即返回，不等待数据库查询完成
          return;
        } else {
          const saved = await getUserStorageItem<OnboardingData>(STORAGE_KEY);
          if (saved) {
            setData(saved);
          }
        }
      } catch (error) {
        console.warn('Failed to initialize onboarding data:', error);
        const saved = await getUserStorageItem<OnboardingData>(STORAGE_KEY);
        if (saved) {
          try {
            startTransition(() => {
              setData(saved);
            });
          } catch (parseError) {
            console.warn('Failed to parse saved onboarding data:', parseError);
          }
        }
        
        initializedUserIdRef.current = currentUserId;
      } finally {
        initializedUserIdRef.current = currentUserId;
        setIsInitialized(true);
      }
    };

    initializeData();
  }, [isReassessment, totalSteps, isInitialized]);

  // CRITICAL: 使用 useRef 跟踪上次保存的数据，避免重复保存导致循环更新
  const lastSavedDataRef = React.useRef<string>('');
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (isInitialized) {
      // 清除之前的保存定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // 使用防抖，延迟保存，避免频繁更新
      saveTimeoutRef.current = setTimeout(() => {
        // 将数据序列化为字符串进行比较，避免对象引用变化导致的重复保存
        const dataString = JSON.stringify(data);
        
        // 只有当数据真正变化时才保存
        if (dataString !== lastSavedDataRef.current) {
          lastSavedDataRef.current = dataString;
          setUserStorageItem(STORAGE_KEY, data).catch(error => {
            console.error('[OnboardingContext] Error saving data:', error);
          });
        }
      }, 300); // 300ms 防抖
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      setUserStorageItem(STEP_KEY, currentStep).catch(error => {
        console.error('[OnboardingContext] Error saving step:', error);
      });
    }
  }, [currentStep, isInitialized]);

  // CRITICAL: 使用 useCallback 稳定函数引用，避免 context 值频繁变化
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetData = useCallback(async () => {
    console.log('🧹 [OnboardingContext] Resetting onboarding data');
    console.log('🔍 [OnboardingContext] Clearing localStorage keys:', {
      STORAGE_KEY,
      STEP_KEY,
      health_report_saved: 'health_report_saved'
    });
    setData({});
    setCurrentStep(0);
    await Promise.all([
      removeUserStorageItem(STORAGE_KEY),
      removeUserStorageItem(STEP_KEY),
      removeUserStorageItem('health_report_saved') // 清除自动保存标志，允许下次重新保存
    ]);
    // IMPORTANT: 不清除 onboarding_completed 和 has_seen_onboarding
    // 这些标志应该只在退出登录时清除
    // 如果在完成引导时清除这些标志，会导致 App.tsx 误判并重新显示引导页
    // localStorage.removeItem('onboarding_completed');
    // localStorage.removeItem('has_seen_onboarding');
    console.log('✅ [OnboardingContext] Onboarding data cleared (keeping completion flags)');
  }, []);

  const goToNextStep = useCallback(() => {
    console.log('➡️ [OnboardingContext] goToNextStep called, currentStep:', currentStep, 'totalSteps:', totalSteps);
    if (currentStep < totalSteps - 1) {
      const nextStep = currentStep + 1;
      console.log('✅ [OnboardingContext] Moving to step:', nextStep);
      setCurrentStep(prev => prev + 1);
    } else {
      console.warn('⚠️ [OnboardingContext] Cannot go to next step, already at last step');
    }
  }, [currentStep, totalSteps]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const canGoBack = currentStep > 0;

  // CRITICAL: 使用 useMemo 稳定 context 值，避免不必要的重新渲染
  // 使用 JSON.stringify 来深度比较 data，避免对象引用变化导致的重新渲染
  const contextValue = useMemo(() => ({
    data,
    updateData,
    resetData,
    currentStep,
    setCurrentStep,
    totalSteps,
    currentSection,
    goToNextStep,
    goToPreviousStep,
    canGoBack,
  }), [data, currentStep, totalSteps, currentSection, canGoBack, updateData, resetData, goToNextStep, goToPreviousStep]);

  // 🔥 修复：在初始化完成之前，显示加载状态，避免组件在初始化过程中渲染
  if (!isInitialized) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};
