import React from 'react';
import { Wind } from 'lucide-react';

export interface BreathingChatAbilityCardProps {
  messageId: string;
  onClose: () => void;
}

/**
 * 聊天便签：练习呼吸 — 打开与 Dashboard 同源的全屏练习层
 */
const BreathingChatAbilityCard: React.FC<BreathingChatAbilityCardProps> = ({ messageId, onClose }) => {
  const start = () => {
    window.dispatchEvent(
      new CustomEvent('openBreathingPractice', {
        detail: { source: 'chat_card' as const, chatMessageId: messageId },
      }),
    );
  };

  return (
    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/95 to-white shadow-sm overflow-hidden max-w-[280px]">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-violet-100/80">
        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
          <Wind className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">练习呼吸</div>
          <div className="text-[11px] text-gray-500">舒缓背景音 · 4-7-8 / 方盒 / 深呼吸</div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-gray-600 leading-relaxed">
          先跟着节奏慢慢呼吸，不必着急。全屏练习；结束或中途退出都会记入健康档案。练完再和我聊聊感受也可以。
        </p>
        <button
          type="button"
          onClick={start}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium"
        >
          开始练习
        </button>
        <button type="button" onClick={onClose} className="w-full py-1.5 text-xs text-gray-500">
          收起卡片
        </button>
      </div>
    </div>
  );
};

export default BreathingChatAbilityCard;
