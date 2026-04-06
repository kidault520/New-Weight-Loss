import React from 'react';

interface OnboardingSelectButtonProps {
  id: string;
  label: string;
  description?: string;
  image?: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const OnboardingSelectButton: React.FC<OnboardingSelectButtonProps> = ({
  id,
  label,
  description,
  image,
  isSelected,
  onClick,
  disabled = false,
  className = '',
}) => {
  void id;
  if (image) {
    // 图片选择按钮（用于性别选择等）
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          relative overflow-hidden rounded-3xl transition-all duration-300 transform hover:scale-[1.02]
          ${isSelected ? 'ring-4 ring-emerald-400 shadow-xl' : 'shadow-lg'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
      >
        <img
          src={image}
          alt={label}
          className="w-full h-52 object-cover"
        />
      </button>
    );
  }

  if (description) {
    // 带描述的选择按钮（用于活动水平等）
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          w-full p-4 rounded-2xl text-left transition-all duration-300
          ${isSelected
            ? 'bg-emerald-400 text-white shadow-lg'
            : 'bg-white text-gray-800 hover:bg-emerald-50 shadow'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
      >
        <p className="font-semibold text-lg mb-1">{label}</p>
        <p className={`text-sm ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
          {description}
        </p>
      </button>
    );
  }

  // 简单文本选择按钮（用于目标选择等）
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full bg-white rounded-2xl p-6 transition-all duration-300 transform hover:scale-[1.02]
        ${isSelected ? 'ring-4 ring-emerald-400 shadow-xl' : 'shadow-md'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <p className="text-gray-800 text-xl font-semibold text-left">{label}</p>
    </button>
  );
};














