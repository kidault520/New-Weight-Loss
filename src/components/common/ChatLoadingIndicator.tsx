import { AIAvatarButton } from './AIAvatarButton';

interface ChatLoadingIndicatorProps {
  className?: string;
}

/**
 * 聊天加载指示器组件
 * 显示AI正在输入的动画效果
 */
export function ChatLoadingIndicator({ className = '' }: ChatLoadingIndicatorProps) {
  return (
    <div className={`flex justify-start ${className}`}>
      <AIAvatarButton size="md" className="mr-2" />
      <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md max-w-[220px] px-2.5 py-1.5 shadow-sm border border-gray-200">
        <div className="flex space-x-1">
          <div 
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
            style={{ animationDelay: '0ms' }}
          />
          <div 
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
            style={{ animationDelay: '150ms' }}
          />
          <div 
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}














