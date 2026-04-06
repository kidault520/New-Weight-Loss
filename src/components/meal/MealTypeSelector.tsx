import React from 'react';

interface MealTypeSelectorProps {
  selectedMealTypes: string[];
  includedMeals?: string[]; // 套餐包含的餐食类型（锁定状态）
  onToggle: (mealType: string) => void;
  disabled?: boolean;
  className?: string;
}

export const MealTypeSelector: React.FC<MealTypeSelectorProps> = ({
  selectedMealTypes,
  includedMeals = [],
  onToggle,
  disabled = false,
  className = ''
}) => {
  const mealTypes = [
    { key: 'breakfast', label: '早餐' },
    { key: 'lunch', label: '午餐' },
    { key: 'dinner', label: '晚餐' }
  ];

  const isMealLocked = (mealType: string) => {
    return includedMeals.includes(mealType);
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {mealTypes.map(({ key, label }) => {
        const isSelected = selectedMealTypes.includes(key);
        const isLocked = isMealLocked(key);

        return (
          <button
            key={key}
            onClick={() => !disabled && !isLocked && onToggle(key)}
            disabled={disabled || isLocked}
            className={`
              relative py-3 rounded-lg text-sm font-medium transition-all border
              ${isSelected
                ? isLocked
                  ? 'bg-green-50 border-green-400 text-gray-700 cursor-not-allowed'
                  : 'bg-white border-green-400 text-gray-800'
                : 'bg-gray-100 border-gray-300 text-gray-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {label}
            {isSelected && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};














