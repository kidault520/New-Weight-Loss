import React from 'react';
import { OnboardingProvider, useOnboarding } from '../../contexts/OnboardingContext';
import WelcomePage from './WelcomePage';
import SectionTransitionPage from './SectionTransitionPage';
import GenderSelectionPage from './GenderSelectionPage';
import GoalSelectionPage from './GoalSelectionPage';
import {
  AgeInputPage,
  HeightInputPage,
  CurrentWeightPage,
  TargetWeightPage,
  ActivityLevelPage,
} from './BodyDataPages';
import {
  DietaryPreferencesPage,
  ExerciseHabitsPage,
  SleepHabitsPage,
  WaterIntakePage,
  HealthConcernsPage,
} from './AboutYouPages';
import HealthReportPage from './HealthReportPage';

interface OnboardingFlowProps {
  onComplete: () => void;
  onBack?: () => void;
  isReassessment?: boolean; // 标识是否为重新评测流程
  onOpenNutritionSolution?: () => void; // 打开营养方案页面的回调
}

const OnboardingFlowContent: React.FC<{ onComplete: () => void; onBack?: () => void; isReassessment?: boolean; onOpenNutritionSolution?: () => void }> = React.memo(({ onComplete, onBack, isReassessment = false, onOpenNutritionSolution }) => {
  const { currentStep } = useOnboarding();

  // CRITICAL: 使用 useMemo 稳定 renderStep 的结果，避免重复渲染
  const stepContent = React.useMemo(() => {
    switch (currentStep) {
      case 0:
        return <WelcomePage onBack={onBack} isReassessment={isReassessment} />;
      case 1:
        return <SectionTransitionPage sectionNumber={1} title="身体数据" />;
      case 2:
        return <GenderSelectionPage />;
      case 3:
        return <GoalSelectionPage />;
      case 4:
        return <AgeInputPage />;
      case 5:
        return <HeightInputPage />;
      case 6:
        return <CurrentWeightPage />;
      case 7:
        return <TargetWeightPage />;
      case 8:
        return <ActivityLevelPage />;
      case 9:
        return <SectionTransitionPage sectionNumber={2} title="关于你" />;
      case 10:
        return <DietaryPreferencesPage />;
      case 11:
        return <ExerciseHabitsPage />;
      case 12:
        return <SleepHabitsPage />;
      case 13:
        return <WaterIntakePage />;
      case 14:
        return <HealthConcernsPage />;
      case 15:
        return (
          <HealthReportPage
            onComplete={onComplete}
            onOpenNutritionSolution={onOpenNutritionSolution}
            isReassessment={isReassessment}
          />
        );
      default:
        console.warn('⚠️ OnboardingFlow - invalid currentStep:', currentStep, 'showing WelcomePage');
        return <WelcomePage onBack={onBack} isReassessment={isReassessment} />;
    }
  }, [currentStep, onBack, isReassessment, onComplete, onOpenNutritionSolution]);

  return (
    <div className="h-[100dvh] bg-white">
      <div className="w-full max-w-sm mx-auto h-full relative">
        <div className="h-full transition-all duration-300 ease-in-out">
          {stepContent}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键 props 变化时重新渲染
  // 注意：函数 props (onComplete, onBack, onOpenNutritionSolution) 如果引用变化会导致重新渲染
  // 但这是预期的行为，因为这些函数可能包含闭包变量
  return (
    prevProps.isReassessment === nextProps.isReassessment &&
    prevProps.onComplete === nextProps.onComplete &&
    prevProps.onBack === nextProps.onBack &&
    prevProps.onOpenNutritionSolution === nextProps.onOpenNutritionSolution
  );
});

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onBack, isReassessment = false, onOpenNutritionSolution }) => {
  return (
    <OnboardingProvider isReassessment={isReassessment}>
      <OnboardingFlowContent onComplete={onComplete} onBack={onBack} isReassessment={isReassessment} onOpenNutritionSolution={onOpenNutritionSolution} />
    </OnboardingProvider>
  );
};

export default OnboardingFlow;
