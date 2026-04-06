import React, { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface SectionTransitionPageProps {
  sectionNumber: number;
  title: string;
  autoAdvanceDelay?: number;
}

const SectionTransitionPage: React.FC<SectionTransitionPageProps> = ({
  sectionNumber,
  title,
  autoAdvanceDelay = 800,
}) => {
  const { goToNextStep, goToPreviousStep, canGoBack } = useOnboarding();

  useEffect(() => {
    const timer = setTimeout(() => {
      goToNextStep();
    }, autoAdvanceDelay);

    return () => clearTimeout(timer);
  }, [goToNextStep, autoAdvanceDelay]);

  return (
    <div className="h-full flex flex-col bg-white">
      {canGoBack && (
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={goToPreviousStep}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
            aria-label="返回上一步"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <p className="text-lg text-gray-600 font-medium">第{['一', '二', '三'][sectionNumber - 1]}部分</p>
          <h1 className="text-5xl font-bold text-gray-800">{title}</h1>
        </div>
      </div>
    </div>
  );
};

export default SectionTransitionPage;
