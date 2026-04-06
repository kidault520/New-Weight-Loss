import React, { useEffect } from 'react';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import HealthReportPage from './onboarding/HealthReportPage';

interface HealthReportViewProps {
  onClose: () => void;
  onOpenNutritionSolution?: () => void;
}

/**
 * Wrapper component for viewing health report in read-only mode
 * Provides OnboardingProvider context that HealthReportPage requires
 * Maintains app window constraints (max-width: 448px)
 */
const HealthReportView: React.FC<HealthReportViewProps> = ({ onClose, onOpenNutritionSolution }) => {
  // 预取营养方案页 chunk，减少点击「查看营养方案」时 Suspense 白屏/二次布局跳动
  useEffect(() => {
    void import('./onboarding/NutritionSolutionPage');
  }, []);

  return (
    <div className="absolute inset-0 bg-white z-50">
      <OnboardingProvider>
        <HealthReportPage
          onComplete={onClose}
          onOpenNutritionSolution={onOpenNutritionSolution}
          readOnly={true}
        />
      </OnboardingProvider>
    </div>
  );
};

export default HealthReportView;
