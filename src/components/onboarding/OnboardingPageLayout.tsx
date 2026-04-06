import React from 'react';
import { OnboardingBackButton } from './OnboardingBackButton';
import ProgressIndicator from './ProgressIndicator';

interface OnboardingPageLayoutProps {
  currentSection: number;
  totalSections: number;
  children: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
}

export const OnboardingPageLayout: React.FC<OnboardingPageLayoutProps> = ({
  currentSection,
  totalSections,
  children,
  showBackButton = true,
  onBack,
  className = '',
  contentClassName = '',
  contentStyle,
}) => {
  return (
    <div className={`h-full flex flex-col bg-gray-50 ${className}`}>
      {showBackButton && <OnboardingBackButton onClick={onBack} />}
      
      <div className="px-6 mb-6">
        <ProgressIndicator currentSection={currentSection} totalSections={totalSections} />
      </div>

      <div className={`flex-1 ${contentClassName}`} style={contentStyle}>
        {children}
      </div>
    </div>
  );
};

