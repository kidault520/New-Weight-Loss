import React from 'react';
import { User } from 'lucide-react';
import {
  formatAiDeliveryMessageForDisplay,
  maskSensitivePhonesInAiChatDisplay,
  splitAddressHighlightSegments,
} from '../../utils/chatUtils';

interface ChatMessageBubbleProps {
  type: 'user' | 'ai';
  content: string;
  timestamp?: string;
  emotionEmoji?: string;
  userGender?: 'male' | 'female' | '';
  showAvatar?: boolean;
  onAvatarClick?: () => void;
  className?: string;
}

/**
 * 聊天消息气泡组件
 * 支持用户消息和AI消息两种类型
 */
export function ChatMessageBubble({
  type,
  content,
  emotionEmoji,
  userGender = '',
  showAvatar = true,
  onAvatarClick,
  className = ''
}: ChatMessageBubbleProps) {
  const isUser = type === 'user';
  const displayContent = !isUser
    ? maskSensitivePhonesInAiChatDisplay(formatAiDeliveryMessageForDisplay(content))
    : content;
  const aiLines = !isUser ? displayContent.split('\n') : [];

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${className}`}>
      {/* AI头像（左侧） */}
      {!isUser && showAvatar && onAvatarClick && (
        <button
          onClick={onAvatarClick}
          className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center mr-2 flex-shrink-0 hover:bg-purple-300 transition-colors"
          aria-label="AI设置"
        >
          <span className="text-lg">🐰</span>
        </button>
      )}

      {/* 消息气泡 */}
      <div className={`max-w-xs ${
        isUser
          ? 'bg-purple-500 text-white rounded-2xl rounded-br-md max-w-[220px]'
          : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md max-w-[220px] border border-gray-200'
      } px-2.5 py-1.5 shadow-sm`}>
        <div className="text-sm leading-normal">
          {isUser
            ? <div className="whitespace-pre-line">{displayContent}</div>
            : aiLines.map((line, lineIdx) => {
                if (line.trim() === '---') {
                  return (
                    <div
                      key={`divider-${lineIdx}`}
                      className="my-2 border-t border-gray-200"
                    />
                  );
                }
                const segments = splitAddressHighlightSegments(line);
                return (
                  <React.Fragment key={`line-${lineIdx}`}>
                    {segments.map((seg, idx) => (
                      <span
                        key={`${lineIdx}-${idx}-${seg.highlight ? 'h' : 'n'}`}
                        className={seg.highlight ? 'font-semibold text-black' : undefined}
                      >
                        {seg.text}
                      </span>
                    ))}
                    {lineIdx < aiLines.length - 1 && <br />}
                  </React.Fragment>
                );
              })}
        </div>
        {emotionEmoji && (
          <div className="mt-1 text-right">
            <span className="text-lg">{emotionEmoji}</span>
          </div>
        )}
      </div>

      {/* 用户头像（右侧） */}
      {isUser && showAvatar && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-2 flex-shrink-0 overflow-hidden">
          {userGender === 'male' ? (
            <img src="/nanmote.png" alt="User" className="w-full h-full object-cover" />
          ) : userGender === 'female' ? (
            <img src="/nvmote.png" alt="User" className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-gray-600" />
          )}
        </div>
      )}
    </div>
  );
}
