/**
 * useAppOnboarding - Onboarding流程状态管理Hook
 * 从App.tsx中提取的Onboarding相关状态管理逻辑
 * 符合架构规范：提取状态管理逻辑，减少App.tsx复杂度
 */

import { useState, useRef } from 'react';

export interface AppOnboardingState {
  showOnboarding: boolean;
  isReassessment: boolean;
  checkingOnboarding: boolean;
  checkingOnboardingAfterLogin: boolean;
  onboardingJustCompleted: boolean;
  initialAppReady: boolean;
  showOnboardingNutritionSolution: boolean;
  onboardingCheckLockRef: React.MutableRefObject<boolean>;
}

export interface AppOnboardingActions {
  setShowOnboarding: (show: boolean) => void;
  setIsReassessment: (isReassessment: boolean) => void;
  setCheckingOnboarding: (checking: boolean) => void;
  setCheckingOnboardingAfterLogin: (checking: boolean) => void;
  setOnboardingJustCompleted: (completed: boolean) => void;
  setInitialAppReady: (ready: boolean) => void;
  setShowOnboardingNutritionSolution: (show: boolean) => void;
  resetOnboardingState: () => void;
}

export function useAppOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isReassessment, setIsReassessment] = useState(false);
  // 🔥 修复：初始值改为 false，避免在检查完成前显示引导页
  // 只有在确实需要时才设置为 true
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [checkingOnboardingAfterLogin, setCheckingOnboardingAfterLogin] = useState(false);
  const [onboardingJustCompleted, setOnboardingJustCompleted] = useState(false);
  const [initialAppReady, setInitialAppReady] = useState(false);
  const [showOnboardingNutritionSolution, setShowOnboardingNutritionSolution] = useState(false);
  
  // 添加检查锁，防止重复执行onboarding检查
  const onboardingCheckLockRef = useRef(false);

  const resetOnboardingState = () => {
    setShowOnboarding(false);
    setIsReassessment(false);
    setCheckingOnboarding(false);
    setCheckingOnboardingAfterLogin(false);
    setOnboardingJustCompleted(false);
    setInitialAppReady(false);
    setShowOnboardingNutritionSolution(false);
    onboardingCheckLockRef.current = false;
  };

  return {
    // State
    showOnboarding,
    isReassessment,
    checkingOnboarding,
    checkingOnboardingAfterLogin,
    onboardingJustCompleted,
    initialAppReady,
    showOnboardingNutritionSolution,
    onboardingCheckLockRef,
    
    // Actions
    setShowOnboarding,
    setIsReassessment,
    setCheckingOnboarding,
    setCheckingOnboardingAfterLogin,
    setOnboardingJustCompleted,
    setInitialAppReady,
    setShowOnboardingNutritionSolution,
    resetOnboardingState,
  };
}
















