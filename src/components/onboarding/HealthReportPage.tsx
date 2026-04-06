import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useOnboardingOptional } from '../../contexts/OnboardingContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { useHealthReportSave } from '../../hooks/useHealthReportSave';
import { useHealthScores } from '../../hooks/useHealthScores';
import { HealthRadarChart } from './HealthRadarChart';
import { HealthInfoCards } from './HealthInfoCards';
import { SecondaryPageHeader } from '../common/SecondaryPageHeader';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { BottomActionBar } from '../common/BottomActionBar';
import { SectionCard } from '../common/SectionCard';
import { getUserStorageItem, removeUserStorageItem } from '../../utils/userStorage';
import { OnboardingData } from '../../contexts/OnboardingContext';
/** 保存成功后延迟展示底部 CTA，避免「已保存」横幅打断阅读节奏 */
const NUTRITION_CTA_DELAY_MS = 1500;

interface HealthReportPageProps {
  onComplete: () => void;
  onOpenNutritionSolution?: () => void;
  assessmentId?: string | null;
  isReassessment?: boolean; // 标识是否为重新评测流程
  readOnly?: boolean; // 标识是否为只读查看模式
}

interface SavedAssessmentData {
  id?: string;
  diet_score: number;
  fitness_score: number;
  rest_score: number;
  psychology_score: number;
  exercise_score: number;
  overall_score: number;
  primary_improvement_area: string;
  questionnaire_data: OnboardingData; // 使用OnboardingData类型替代any
}

const HealthReportPage: React.FC<HealthReportPageProps> = ({ onComplete, onOpenNutritionSolution, assessmentId, isReassessment = false, readOnly = false }) => {

  // 在查看模式下（有assessmentId），onboarding context 可能不存在
  const onboarding = useOnboardingOptional();
  const data = useMemo(() => onboarding?.data || { nickname: '' }, [onboarding?.data]);

  const { user } = useAuth();
  const { profile, healthAssessment } = useUserProfile();
  
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [savedAssessment, setSavedAssessment] = useState<SavedAssessmentData | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const totalCards = 5;
  const saveRetryCount = useRef(0);
  const previousUserId = useRef<string | null>(null);
  const loadedAssessmentId = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nutritionCtaDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nutritionCtaVisible, setNutritionCtaVisible] = useState(false);
  const warningLoggedRef = useRef<{ reassessment: boolean }>({ reassessment: false });

  // CRITICAL: Reset all save-related state when user changes OR when entering reassessment mode
  // This fixes the issue where hasAttemptedSave persists between different users or assessments
  // IMPORTANT: This also resets savedAssessment and loadedAssessmentId to ensure
  // new users or reassessments start with a clean slate
  const loadAssessmentData = useCallback(async () => {
    // CRITICAL: NEVER load data in reassessment mode
    // This is a safety check in case this function is called directly
    if (isReassessment) {
      setIsLoading(false);
      return;
    }

    // OPTIMIZATION: Prevent concurrent loads
    if (isLoadingRef.current) {
      return;
    }

    // OPTIMIZATION: Check if we already have this assessment loaded
    if (assessmentId && assessmentId === loadedAssessmentId.current && savedAssessment) {
      setIsLoading(false);
      return;
    }

    // OPTIMIZATION: If viewing mode and context already has the latest assessment, use it
    if (!assessmentId && healthAssessment && savedAssessment?.id === healthAssessment.id) {
      setIsLoading(false);
      return;
    }

    isLoadingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ [HealthReportPage] No user found - cannot load report');
        // CRITICAL: Clear all onboarding state to prevent loop
        Promise.all([
          removeUserStorageItem('onboarding_step'),
          removeUserStorageItem('onboarding_data'),
          removeUserStorageItem('onboarding_completed'),
          removeUserStorageItem('onboarding_skipped'),
          removeUserStorageItem('health_report_saved')
        ]).catch(error => {
          console.error('❌ [HealthReportPage] Error clearing onboarding state:', error);
        });
        setIsLoading(false);
        // Force close onboarding flow - this will trigger App.tsx to show login page
        onComplete();
        return;
      }

      let assessmentData = null;
      let error = null;

      // 如果提供了 assessmentId，加载指定的评测记录
      if (assessmentId) {
        const result = await supabase
          .from('health_assessments')
          .select('*')
          .eq('user_id', user.id)
          .eq('id', assessmentId)
          .maybeSingle();

        assessmentData = result.data;
        error = result.error;
      } else {
        // 否则加载最新的评测记录
        const result = await supabase
          .from('health_assessments')
          .select('*')
          .eq('user_id', user.id)
          .order('assessment_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        assessmentData = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ [HealthReportPage] Error loading assessment:', error);
      } else if (assessmentData) {
        // CRITICAL: Create a deep copy to ensure immutability of historical data
        // This prevents any accidental modifications to the database record
        const immutableAssessment = JSON.parse(JSON.stringify(assessmentData));

        setSavedAssessment(immutableAssessment);
        // OPTIMIZATION: Mark this assessment as loaded
        loadedAssessmentId.current = assessmentData.id;
      } else {
        loadedAssessmentId.current = null;
      }
    } catch (error) {
      console.error('❌ [HealthReportPage] Failed to load assessment:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [assessmentId, isReassessment, savedAssessment, healthAssessment, onComplete]);

  useEffect(() => {
    const currentUserId = user?.id || null;

    // Check if user has changed (including logout and new registration)
    if (previousUserId.current !== null && previousUserId.current !== currentUserId) {
      // Reset all save-related state
      saveRetryCount.current = 0;

      // CRITICAL: Reset assessment data to prevent old data from carrying over
      setSavedAssessment(null);
      loadedAssessmentId.current = null;
      
      // Reset warning logs for new user
      warningLoggedRef.current = { reassessment: false };
    }

    // Update the tracked user ID (do this AFTER the check above)
    previousUserId.current = currentUserId;
  }, [user?.id]);

  // CRITICAL: Reset state when entering reassessment mode
  // This ensures each reassessment starts fresh without any cached data
  useEffect(() => {
    if (isReassessment) {
      // Clear all cached assessment data
      setSavedAssessment(null);
      loadedAssessmentId.current = null;
      saveRetryCount.current = 0;

      // Reset warning logs for reassessment mode
      warningLoggedRef.current = { reassessment: false };

      // Clear the saved flag to allow new save
      // CRITICAL: Do NOT clear step14_profile_saved here!
      // This flag is set in Step 14 when user clicks "保存生成健康报告"
      // Step 15 (this page) needs this flag to trigger auto-save
      // If we clear it here, auto-save will never trigger because step14Saved check will fail
      removeUserStorageItem('health_report_saved').catch(error => {
        console.error('❌ [HealthReportPage] Error clearing health_report_saved:', error);
      });
      // removeUserStorageItem('step14_profile_saved'); // REMOVED: This prevents auto-save from triggering
    }
  }, [isReassessment]);

  useEffect(() => {
    // CRITICAL: In reassessment mode, NEVER load historical data
    // Users must see ONLY their newly entered data from the current session
    if (isReassessment) {
      // Clear any cached assessment data
      setSavedAssessment(null);
      loadedAssessmentId.current = null;
      setIsLoading(false);
      return;
    }

    // 🔥 修复：当 assessmentId 变化时，清空之前的数据，确保加载新的数据
    if (assessmentId && assessmentId !== loadedAssessmentId.current) {
      setSavedAssessment(null);
      loadedAssessmentId.current = null;
    }

    // OPTIMIZATION: Only load data if:
    // 1. Assessment ID has changed, OR
    // 2. No data is currently loaded, OR
    // 3. Not currently loading
    const shouldLoad = (
      assessmentId !== loadedAssessmentId.current ||
      (loadedAssessmentId.current === null && !isLoadingRef.current)
    );

    if (shouldLoad) {
      loadAssessmentData();
    }
    // CRITICAL: Removed savedAssessment from dependencies to prevent reload loop
     
  }, [assessmentId, isReassessment, loadAssessmentData]);

  // 判断模式：
  // 1. 查看模式（viewing mode）：查看已保存的报告（通过 readOnly prop 或 assessmentId，且不是重新评测）
  // 2. 重新评测模式（reassessment mode）：已有用户重新做评测（明确的 isReassessment flag）
  // 3. 首次引导模式（first-time onboarding）：新用户首次完成引导
  const hasOnboardingData = !!(data.nickname && data.fitnessGoal && data.age && data.currentWeight && data.height);
  // CRITICAL: Viewing mode is ONLY when explicitly viewing an assessment (readOnly or assessmentId)
  // AND NOT in reassessment mode (reassessment takes priority)
  const isViewingMode = !isReassessment && (readOnly || !!assessmentId || (savedAssessment && !hasOnboardingData));
  const isFirstTimeOnboarding = !isViewingMode && !isReassessment;

  // 使用useHealthReportSave Hook替代本地保存逻辑
  const { 
    saveError, 
    saveDataToDatabase,
    hasAttemptedSave,
    saveRetryCount: hookSaveRetryCount,
    MAX_RETRY_ATTEMPTS: hookMaxRetries
  } = useHealthReportSave({
    questionnaireData: data,
    isFirstTimeOnboarding,
    isReassessment,
    previousUserId: previousUserId.current,
  });

  // 查看历史报告：加载完即展示底部按钮（无需等待保存）
  useEffect(() => {
    if (!isLoading && isViewingMode) {
      setNutritionCtaVisible(true);
    }
  }, [isLoading, isViewingMode]);

  // 重新进入页面时先隐藏 CTA，避免旧状态残留
  useEffect(() => {
    if (isLoading) {
      setNutritionCtaVisible(false);
      if (nutritionCtaDelayRef.current) {
        clearTimeout(nutritionCtaDelayRef.current);
        nutritionCtaDelayRef.current = null;
      }
    }
  }, [isLoading]);

  // Auto-save data when entering first-time onboarding or reassessment mode
  useEffect(() => {
    // 清理之前的 timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (nutritionCtaDelayRef.current) {
      clearTimeout(nutritionCtaDelayRef.current);
      nutritionCtaDelayRef.current = null;
    }

    const performAutoSave = async () => {
      // CRITICAL: 检查数据是否真正来自用户在本次会话中的填写
      // 通过用户隔离存储中的health_report_saved标记来判断
      // 如果该标记存在，说明数据已经保存过，不应该再次自动保存
      const hasAlreadySaved = await getUserStorageItem<string>('health_report_saved') === 'true';

      // CRITICAL: 检查步骤14是否已经成功保存
      // 步骤15的自动保存应该只在步骤14保存成功后才触发
      // 这是关键修复：确保在没有点击步骤14的"保存生成健康报告"按钮之前，不会执行任何数据库操作
      const step14Saved = await getUserStorageItem<string>('step14_profile_saved') === 'true';
      
      if (!step14Saved) {
        // CRITICAL: 如果条件不满足但应该是保存模式，尝试延迟重试（只重试一次）
        // 这可以处理时序问题（例如 step14Saved 标记设置稍晚）
        if ((isFirstTimeOnboarding || isReassessment) && hasOnboardingData && !hasAlreadySaved && !autoSaveTimeoutRef.current) {
          autoSaveTimeoutRef.current = setTimeout(() => {
            autoSaveTimeoutRef.current = null;
            performAutoSave();
          }, 2000);
        }
        return; // 直接返回，不执行自动保存
      }

      // CRITICAL: 在重新评测模式下，必须确认用户完成了所有步骤
      // 检查onboarding_step是否达到step 15（HealthReportPage）
      const currentOnboardingStep = await getUserStorageItem<number>('onboarding_step');
      const hasCompletedAllSteps = currentOnboardingStep === 15;

      // Auto-save for first-time onboarding or reassessment with valid data
      // Skip if data was already saved (to avoid duplicate saves from stale data)
      // Skip if user hasn't completed all onboarding steps (to avoid saving incomplete data)
      // CRITICAL: Also require Step 14 to be saved first
      // NOTE: We no longer check for today's assessment - each reassessment creates a NEW record
      const shouldAutoSave = (isFirstTimeOnboarding || isReassessment) &&
        hasOnboardingData &&
        !isLoading &&
        !hasAttemptedSave.current &&
        !hasAlreadySaved &&
        hasCompletedAllSteps &&
        step14Saved; // 添加步骤14保存检查

      if (shouldAutoSave) {
        // 检查是否超过重试次数
        if (hookSaveRetryCount.current >= hookMaxRetries) {
          console.error('❌ [HealthReportPage] Max retry attempts reached, stopping auto-save');
          return;
        }

        hookSaveRetryCount.current += 1;
        saveRetryCount.current = hookSaveRetryCount.current;

        const success = await saveDataToDatabase();
        if (success) {
          hookSaveRetryCount.current = 0; // 重置重试计数器
          saveRetryCount.current = 0;
          nutritionCtaDelayRef.current = setTimeout(() => {
            setNutritionCtaVisible(true);
            nutritionCtaDelayRef.current = null;
          }, NUTRITION_CTA_DELAY_MS);
        } else {
          console.error(`❌ [HealthReportPage] Automatic save failed (attempt ${hookSaveRetryCount.current}/${hookMaxRetries})`);
        }
      } else if (
        step14Saved &&
        hasAlreadySaved &&
        (isFirstTimeOnboarding || isReassessment) &&
        hasOnboardingData &&
        !isLoading
      ) {
        // 本次会话已保存过（例如返回本页）：直接展示 CTA，无需再次保存与等待
        setNutritionCtaVisible(true);
      }
    };

    // Only run auto-save after loading is complete
    if (!isLoading) {
      performAutoSave();
    }

    // Cleanup function to clear timeout on unmount or dependency change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (nutritionCtaDelayRef.current) {
        clearTimeout(nutritionCtaDelayRef.current);
        nutritionCtaDelayRef.current = null;
      }
    };
    // CRITICAL: Removed savedAssessment from dependencies to prevent save loop
    // The auto-save should only run once when conditions are met, not re-trigger on data load
     
  }, [isFirstTimeOnboarding, isReassessment, hasOnboardingData, isLoading, hasAttemptedSave, hookMaxRetries, hookSaveRetryCount, saveDataToDatabase]);


  // CRITICAL: 数据源优先级（防止数据污染）
  // 三种模式使用完全独立的数据源，绝不混用：
  //
  // 1. 首次引导模式（isFirstTimeOnboarding = true）
  //    - 数据源：ONLY 当前会话的 onboarding data
  //    - 特征：用户首次注册，填写新数据
  //    - 行为：保存为新的评测记录
  //
  // 2. 重新评测模式（isReassessment = true）
  //    - 数据源：ONLY 当前会话的 onboarding data（全新填写）
  //    - 特征：老用户重新做评测，表单应该是空白的
  //    - 行为：创建新的独立评测记录，不影响历史记录
  //    - 警告：绝对不能加载或显示任何历史数据！
  //
  // 3. 查看模式（isViewingMode = true）
  //    - 数据源：ONLY savedAssessment.questionnaire_data（历史快照）
  //    - 特征：查看已保存的历史报告
  //    - 行为：只读模式，不允许修改或保存
  //
  const questionnaireData = useMemo(() => (
    isViewingMode
      ? (savedAssessment?.questionnaire_data || {}) // 查看模式：只用历史数据
      : data // 首次引导或重新评测：使用当前会话数据
  ), [isViewingMode, savedAssessment?.questionnaire_data, data]);

  // CRITICAL: 多重安全检查 - 防止数据源混淆
  // 使用 useEffect 来执行这些检查，避免在每次渲染时都执行
  useEffect(() => {
    // 检查1：重新评测模式必须使用 onboarding context 数据
    if (isReassessment && questionnaireData !== data) {
      console.error('❌❌❌ [HealthReportPage] CRITICAL DATA CONTAMINATION DETECTED!');
      console.error('❌ [HealthReportPage] Reassessment is using WRONG data source!');
      console.error('❌ [HealthReportPage] Expected: onboarding context data');
      console.error('❌ [HealthReportPage] Got: unknown data source');
      console.error('❌ [HealthReportPage] This violates data isolation principle!');
      throw new Error('Data contamination detected in reassessment mode');
    }

    // 检查2：重新评测模式不应该有 savedAssessment 数据影响显示（只警告一次）
    if (isReassessment && savedAssessment && !warningLoggedRef.current.reassessment) {
      console.warn('⚠️ [HealthReportPage] WARNING: savedAssessment exists in reassessment mode');
      warningLoggedRef.current.reassessment = true;
    }

    // 首次引导：Step 14 后会 insert health_assessment，本页 loadAssessmentData 会拉到该条记录，
    // savedAssessment 非空为预期；问卷展示仍以 onboarding `data` 为准（见 questionnaireData useMemo）。
  }, [isReassessment, isFirstTimeOnboarding, savedAssessment, questionnaireData, data]);

  // 数据显示优先级（CRITICAL: 重新评测必须只显示新填写的数据）：
  // - 首次引导：使用 questionnaireData（新填写的数据），如果没有则从 profile fallback
  // - 重新评测：ONLY使用 questionnaireData（新填写的数据），绝不使用 profile（那是旧数据）
  // - 查看模式：ONLY使用 questionnaireData（历史快照），不fallback到profile，确保显示创建时的数据
  const displayNickname = isViewingMode
    ? questionnaireData?.nickname  // 查看模式：只用历史快照，不fallback
    : ((isFirstTimeOnboarding || isReassessment)
        ? (questionnaireData?.nickname || profile?.nickname)
        : (profile?.nickname || questionnaireData?.nickname));
  const displayFitnessGoal = isViewingMode
    ? questionnaireData?.fitnessGoal  // 查看模式：只用历史快照，不fallback
    : ((isFirstTimeOnboarding || isReassessment)
        ? (questionnaireData?.fitnessGoal || profile?.fitness_goal)
        : (profile?.fitness_goal || questionnaireData?.fitnessGoal));

  // CRITICAL: In viewing mode, ONLY use historical snapshot data from questionnaire_data
  // Never fall back to profile data as that represents CURRENT data, not historical snapshot
  // In reassessment mode, ONLY use freshly entered data from questionnaire
  // Never fall back to profile data as that represents OLD assessment data
  const displayCurrentWeight = isViewingMode
    ? questionnaireData?.currentWeight  // 查看模式：只用历史快照，不fallback
    : ((isFirstTimeOnboarding || isReassessment)
        ? questionnaireData?.currentWeight
        : (profile?.current_weight || questionnaireData?.currentWeight));
  const displayTargetWeight = isViewingMode
    ? questionnaireData?.targetWeight  // 查看模式：只用历史快照，不fallback
    : ((isFirstTimeOnboarding || isReassessment)
        ? questionnaireData?.targetWeight
        : (profile?.target_weight || questionnaireData?.targetWeight));
  const displayActivityLevel = isViewingMode
    ? questionnaireData?.activityLevel  // 查看模式：只用历史快照，不fallback
    : ((isFirstTimeOnboarding || isReassessment)
        ? questionnaireData?.activityLevel
        : (profile?.activity_level || questionnaireData?.activityLevel));

  // 使用useHealthScores Hook替代评分计算逻辑
  const { scores, radarData } = useHealthScores({
    questionnaireData,
    savedAssessment,
    isReassessment,
    isViewingMode: !!isViewingMode,
  });

  const getGoalText = () => {
    const goals: Record<string, string> = {
      'weight_loss': '减轻体重',
      'maintain_health': '焕肤',
      'tone': '保持健康',
      'confidence': '保持自信',
      'other': '其它'
    };
    return goals[displayFitnessGoal || ''] || '未设置';
  };

  const getActivityLevelText = () => {
    const levels: Record<string, string> = {
      'sedentary': '久坐',
      'light': '轻度活动',
      'moderate': '中度活动',
      'active': '高度活动',
      'very_active': '非常活跃'
    };
    return levels[displayActivityLevel || ''] || '中度活动';
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.offsetWidth;
      const newIndex = Math.round(scrollLeft / cardWidth);
      setCurrentCardIndex(newIndex);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToCard = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardWidth = container.offsetWidth;
    container.scrollTo({
      left: cardWidth * index,
      behavior: 'smooth'
    });
  };



  const handleViewNutritionSolution = () => {
    // IMPORTANT: This button is ONLY for navigation - NO SAVE LOGIC
    // All saves are handled elsewhere:
    // - Step 14 (HealthConcernsPage): Saves user_profiles data
    // - Step 15 (HealthReportPage auto-save): Saves health_assessments record
    // This button just navigates to the next page

    // Navigate to nutrition solution or complete onboarding
    if (onOpenNutritionSolution) {
      onOpenNutritionSolution();
    } else {
      onComplete();
    }
  };

  // 当正在加载时，显示加载动画
  const handleForceLogout = async () => {
    try {
      // 1. Clear all onboarding state first using user-isolated storage
      await Promise.all([
        removeUserStorageItem('onboarding_step'),
        removeUserStorageItem('onboarding_data'),
        removeUserStorageItem('onboarding_completed'),
        removeUserStorageItem('onboarding_skipped'),
        removeUserStorageItem('health_report_saved'),
        removeUserStorageItem('step14_profile_saved')
      ]);

      // 2. Clear all localStorage
      localStorage.clear();

      // 3. Sign out from Supabase
      await supabase.auth.signOut();

    } catch (error) {
      console.error('❌ [HealthReportPage] Logout failed:', error);
    } finally {
      // 5. Force page refresh to reset all state
      window.location.href = window.location.origin;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-[#FAF8F3] flex flex-col">
        <SecondaryPageHeader title="健康报告" onClose={handleForceLogout} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }

  // 加载完成后，检查必需的数据是否存在
  // 对于首次引导，需要有 onboarding data
  // 对于查看模式，需要有 savedAssessment
  if (isFirstTimeOnboarding && !hasOnboardingData) {
    console.error('❌ [HealthReportPage] 首次引导模式但没有完整的 onboarding data - 强制返回登录页');
    // 立即清除所有引导状态并返回
    Promise.all([
      removeUserStorageItem('onboarding_step'),
      removeUserStorageItem('onboarding_data'),
      removeUserStorageItem('onboarding_completed'),
      removeUserStorageItem('onboarding_skipped'),
      removeUserStorageItem('health_report_saved'),
      removeUserStorageItem('step14_profile_saved')
    ]).catch(error => {
      console.error('❌ [HealthReportPage] Error clearing onboarding state:', error);
    });
    onComplete();
    return null;
  }

  // 如果在查看模式但没有数据，也返回
  if (isViewingMode && !savedAssessment) {
    console.error('❌ [HealthReportPage] 查看模式但没有保存的评估数据', {
      isViewingMode,
      savedAssessment,
      assessmentId,
      hasData: !!data.nickname
    });
    Promise.all([
      removeUserStorageItem('onboarding_step'),
      removeUserStorageItem('onboarding_data'),
      removeUserStorageItem('onboarding_completed'),
      removeUserStorageItem('onboarding_skipped'),
      removeUserStorageItem('health_report_saved'),
      removeUserStorageItem('step14_profile_saved')
    ]).catch(error => {
      console.error('❌ [HealthReportPage] Error clearing onboarding state:', error);
    });
    // 勿在此处调用 onComplete：否则会在首帧把宿主关掉，用户会看到底层「我的」；仅顶栏返回时再关
    return (
      <div className="h-full bg-[#FAF8F3] flex flex-col">
        <SecondaryPageHeader title="健康报告" onClose={onComplete} />
        <div className="flex-1 flex items-center justify-center px-6">
          <EmptyState 
            icon={<span className="text-4xl">📊</span>}
            title="未找到健康评估报告"
            description={`评测ID: ${assessmentId || '未提供'}\n该评测记录可能已被删除`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#FAF8F3] flex flex-col">
      <div className="sticky top-0 z-10 flex-shrink-0 bg-white shadow-sm">
        {isViewingMode ? (
          <SecondaryPageHeader title="健康报告" onClose={onComplete} />
        ) : (
          <div className="flex items-center justify-between px-4 py-3">
            <div className="w-12"></div>
            <h1 className="text-lg font-semibold text-gray-900">健康报告</h1>
            <div className="w-12"></div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto ios-touch-scroll overscroll-y-contain scrollbar-hide pb-24">

      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide pl-4 my-4"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <div className="flex-shrink-0 snap-center" style={{ width: 'calc(100% - 24px)' }}>
          <div className="relative bg-white rounded-3xl overflow-hidden mr-4" style={{ height: '470px' }}>
            <div className="pt-8 px-6 pb-6">
              <h2 className="text-2xl font-normal text-gray-800 mb-6">
                Hi <span className="underline decoration-2 underline-offset-4">{displayNickname || '你'}</span>
              </h2>

              <div className="bg-white mb-6">
                <div className="flex items-baseline mb-2">
                  <p className="text-sm text-gray-600">你的健康测评综合得分：</p>
                  <span className="text-3xl font-bold text-gray-900 ml-2">{scores.overall}</span>
                  <span className="text-1xl text-gray-400 ml-1">/100</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  * 报告结果基于FFQ营养测评和4大维度专业健康评估
                </p>
              </div>

              <div className="bg-white relative mb-4">
                <div style={{ height: 280 }}>
                  <HealthRadarChart data={radarData} />
                </div>

                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{scores.overall}</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <HealthInfoCards 
          totalCards={totalCards}
          currentCardIndex={currentCardIndex}
          onCardScroll={scrollToCard}
        />
      </div>

        <div className="mx-4 mb-2">
          <div className="bg-white rounded-2xl px-4 py-3 text-center">
            <p className="text-sm text-gray-500">
              ≪ 向左滑动卡片,查看推荐方案原理 ≪
            </p>
          </div>
        </div>

        <div className="flex justify-center items-center gap-2 py-3">
          {Array.from({ length: totalCards }).map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToCard(index)}
              className={`h-2 rounded-full transition-all ${
                currentCardIndex === index
                  ? 'w-6 bg-gray-900'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        <div className="px-4 mt-2">
          <SectionCard className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-base text-gray-900 font-medium">本次改善目标</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">此次目标</span>
                <span className="text-base font-semibold text-gray-900">{getGoalText()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">目标体重</span>
                <span className="text-base font-semibold text-gray-900">
                  {displayCurrentWeight ? displayCurrentWeight.toFixed(1) : '--'}kg → {displayTargetWeight ? displayTargetWeight.toFixed(1) : '--'}kg
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">活动水平</span>
                <span className="text-base font-semibold text-gray-900">{getActivityLevelText()}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <BottomActionBar
        visible={nutritionCtaVisible || !!saveError}
        primaryText="查看营养方案"
        onPrimaryClick={handleViewNutritionSolution}
        buttonClassName="w-full px-8 py-3 rounded-2xl bg-yellow-400 text-gray-900 text-base font-semibold hover:bg-yellow-500 active:bg-yellow-600 transition-all duration-300 shadow-lg hover:shadow-xl"
        containerClassName="bg-white border-t border-gray-200 px-4 py-4"
        extra={
          saveError ? (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{saveError}</p>
              <p className="text-xs text-red-500 text-center mt-1">请重试或联系客服</p>
            </div>
          ) : null
        }
      />
    </div>
  );
};

export default HealthReportPage;
