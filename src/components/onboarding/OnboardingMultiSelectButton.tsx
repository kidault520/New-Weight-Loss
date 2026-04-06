import React from 'react';

interface OnboardingMultiSelectButtonProps {
  id: string;
  label: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const OnboardingMultiSelectButton: React.FC<OnboardingMultiSelectButtonProps> = ({
  id,
  label,
  isSelected,
  onClick,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      key={id}
      onClick={onClick}
      disabled={disabled}
      className={`
        py-4 px-4 rounded-2xl font-medium transition-all duration-300
        ${isSelected
          ? 'bg-emerald-400 text-white shadow-lg'
          : 'bg-white text-gray-800 hover:bg-emerald-50 shadow'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {label}
    </button>
  );
};














