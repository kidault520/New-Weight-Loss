/**
 * 反馈通知气泡 - 独立于普通对话的 UI
 * 用于展示「已完成XX记录」「已同步热量」等系统反馈，区别于便签卡片、AI 识别卡片、普通对话
 */

import { CheckCircle2 } from 'lucide-react';
import { stripMarkdownBoldMarkersForChat } from '../../utils/chatUtils';

interface ChatFeedbackBubbleProps {
  content: string;
  className?: string;
}

export function ChatFeedbackBubble({
  content,
  className = '',
}: ChatFeedbackBubbleProps) {
  const display = stripMarkdownBoldMarkersForChat(content);
  return (
    <div className={`w-full flex items-center gap-2 px-4 py-2 rounded-xl rounded-bl-md bg-emerald-50 border border-emerald-200/80 shadow-sm ${className}`}>
      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-emerald-800 leading-snug">{display}</p>
      </div>
    </div>
  );
}
