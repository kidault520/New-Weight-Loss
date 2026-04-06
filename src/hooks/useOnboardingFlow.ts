/**
 * useOnboardingFlow - Onboarding流程管理Hook
 * 从App.tsx中提取的Onboarding相关逻辑
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { removeUserStorageItem } from '../utils/userStorage';

export function useOnboardingFlow() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isReassessment, setIsReassessment] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [checkingOnboardingAfterLogin, setCheckingOnboardingAfterLogin] = useState(false);
  const [onboardingJustCompleted, setOnboardingJustCompleted] = useState(false);
  const [initialAppReady, setInitialAppReady] = useState(false);
  const [showOnboardingNutritionSolution, setShowOnboardingNutritionSolution] = useState(false);
  
  const onboardingCheckLockRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  const clearOnboardingState = useCallback(async () => {
    console.log('🧹 [useOnboardingFlow] Clearing all onboarding state from localStorage');
    
    await Promise.all([
      removeUserStorageItem('onboarding_step'),
      removeUserStorageItem('onboarding_data'),
      removeUserStorageItem('onboarding_completed'),
      removeUserStorageItem('onboarding_skipped'),
      removeUserStorageItem('health_report_saved'),
      removeUserStorageItem('step14_profile_saved')
    ]);
    
    console.log('✅ [useOnboardingFlow] Onboarding state cleared');
  }, []);

  const checkOnboardingStatus = useCallback(async (userId: string | null) => {
    if (onboardingCheckLockRef.current) {
      console.log('⏸️ [useOnboardingFlow] Onboarding check already in progress, skipping');
      return;
    }

    if (onboardingJustCompleted) {
      console.log('⏸️ [useOnboardingFlow] Onboarding just completed, skipping check');
      setCheckingOnboarding(false);
      return;
    }

    try {
      onboardingCheckLockRef.current = true;

      if (!userId) {
        await clearOnboardingState();
        setShowOnboarding(false);
        setCheckingOnboarding(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('has_seen_onboarding')
        .eq('user_id', userId)
        .maybeSingle();

      // 清理过时的localStorage标志
      await Promise.all([
        removeUserStorageItem('onboarding_completed'),
        removeUserStorageItem('onboarding_skipped')
      ]);

      if (profileData?.has_seen_onboarding) {
        await Promise.all([
          removeUserStorageItem('onboarding_step'),
          removeUserStorageItem('onboarding_data'),
          removeUserStorageItem('health_report_saved')
        ]);
      }

      const needsOnboarding = !profileData || !profileData.has_seen_onboarding;
      setShowOnboarding(needsOnboarding);
    } catch (error) {
      console.error('❌ [useOnboardingFlow] Error checking onboarding status:', error);
    } finally {
      setCheckingOnboarding(false);
      onboardingCheckLockRef.current = false;
    }
  }, [onboardingJustCompleted, clearOnboardingState]);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingJustCompleted(true);
    setShowOnboarding(false);
    setInitialAppReady(true);
  }, []);

  const handleStartReassessment = useCallback(() => {
    setIsReassessment(true);
    setShowOnboarding(true);
  }, []);

  // 当用户切换时重置状态
  useEffect(() => {
    const currentUserId = previousUserIdRef.current;
    if (currentUserId) {
      setShowOnboarding(false);
      setOnboardingJustCompleted(false);
      setIsReassessment(false);
    }
    previousUserIdRef.current = null;
  }, []);

  return {
    showOnboarding,
    setShowOnboarding,
    isReassessment,
    setIsReassessment,
    checkingOnboarding,
    checkingOnboardingAfterLogin,
    setCheckingOnboardingAfterLogin,
    onboardingJustCompleted,
    setOnboardingJustCompleted,
    initialAppReady,
    setInitialAppReady,
    showOnboardingNutritionSolution,
    setShowOnboardingNutritionSolution,
    checkOnboardingStatus,
    handleOnboardingComplete,
    handleStartReassessment,
    clearOnboardingState,
  };
}




