import React from 'react';

interface ChatLoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  className?: string;
}

const ChatLoadingIndicator: React.FC<ChatLoadingIndicatorProps> = ({
  size = 'medium',
  text = '加载中...',
  className = ''
}) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-10 h-10',
    large: 'w-14 h-14'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className={`relative ${sizeClasses[size]}`}>
        {/* 外层旋转圈 */}
        <div className="absolute inset-0 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin"></div>
        {/* 内层脉冲点 */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-300 chat-loading-spin-slow"></div>
      </div>
      {text && (
        <p className={`text-gray-500 ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}
      {/* 脉冲动画 */}
      <div className="w-16 h-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent animate-pulse"></div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes chat-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .chat-loading-spin-slow {
          animation: chat-spin-slow 3s linear infinite;
        }
      `,
        }}
      />
    </div>
  );
};

export default ChatLoadingIndicator;
