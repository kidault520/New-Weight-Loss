import React from 'react';
import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  currentSection: number;
  totalSections: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentSection, totalSections }) => {
  return (
    <div className="flex items-center justify-center space-x-2 px-6">
      {Array.from({ length: totalSections }, (_, index) => {
        const sectionNumber = index + 1;
        const isCompleted = sectionNumber < currentSection;
        const isCurrent = sectionNumber === currentSection;

        return (
          <React.Fragment key={sectionNumber}>
            <div className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                  ${isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-white' : 'bg-gray-300'}
                `}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span className={`text-sm font-medium ${isCurrent ? 'text-gray-700' : 'text-gray-500'}`}>
                    {sectionNumber}
                  </span>
                )}
              </div>
            </div>

            {sectionNumber < totalSections && (
              <div className="flex-1 h-0.5 bg-gray-300 min-w-[60px] max-w-[120px]">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{ width: isCompleted ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ProgressIndicator;
