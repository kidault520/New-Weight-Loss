interface AIAvatarButtonProps {
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * AI头像按钮组件
 * 用于显示AI的兔子头像，可用于点击打开设置
 */
export function AIAvatarButton({ 
  onClick, 
  className = '',
  size = 'md'
}: AIAvatarButtonProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const iconSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl'
  };

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0 hover:bg-purple-300 transition-colors ${className}`}
      aria-label="AI设置"
    >
      <span className={iconSizeClasses[size]}>🐰</span>
    </button>
  );
}














