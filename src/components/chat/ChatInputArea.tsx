import React from 'react';
import { Send } from 'lucide-react';
import { useChatContext } from '../../contexts/ChatContext';
import TextInput from './TextInput';

const ChatInputArea: React.FC = () => {
  const {
    inputText,
    setInputText,
    handleSendMessage,
    isSendingMessage,
    cancelAiGeneration,
  } = useChatContext();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-transparent">
      <div className="w-full max-w-sm mx-auto bg-white border-t border-white/20 pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 py-1">
        <div className="flex items-center space-x-3">
          {/* 输入框 */}
          <TextInput
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onSend={(text) => handleSendMessage(text)}
            disabled={isSendingMessage}
          />
          
          {isSendingMessage ? (
            <button
              type="button"
              onClick={() => cancelAiGeneration()}
              className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors flex items-center justify-center shrink-0"
              aria-label="停止生成"
              title="停止生成"
            >
              <span className="block w-3 h-3 bg-white rounded-[2px]" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSendMessage(inputText.trim())}
              disabled={!inputText.trim()}
              className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">
          内容由AI生成，仅供参考
        </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInputArea;
