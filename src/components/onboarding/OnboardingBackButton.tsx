import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface OnboardingBackButtonProps {
  onClick?: () => void;
  className?: string;
}

export const OnboardingBackButton: React.FC<OnboardingBackButtonProps> = ({ 
  onClick, 
  className = '' 
}) => {
  const { goToPreviousStep, canGoBack } = useOnboarding();

  if (!canGoBack && !onClick) {
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      goToPreviousStep();
    }
  };

  return (
    <div className={`p-4 ${className}`}>
      <button
        onClick={handleClick}
        className="p-2 hover:bg-white/50 rounded-lg transition-colors"
        aria-label="返回上一步"
      >
        <ChevronLeft className="w-6 h-6 text-gray-700" />
      </button>
    </div>
  );
};














