import React, { useCallback, useState } from 'react';
import { Keyboard, Camera, ArrowLeft, Send } from 'lucide-react';
import { useChatContext } from '../contexts/ChatContext';
import { useVoicePlayback } from '../contexts/VoicePlaybackContext';
import ChatMessageList from './chat/ChatMessageList';
import TextInput from './chat/TextInput';
import EmotionAnimation from './chat/EmotionAnimation';
import { AlertDialog } from './common/AlertDialog';
import { TopSummaryRowProvider, type RealtimeMetricKind } from './singlepage/TopSummaryRowContext';
import TopSummaryRowHeader from './singlepage/TopSummaryRowHeader';
import AbilityBar, { AbilityBarProps } from './singlepage/AbilityBar';
import { ABILITY_CARD_TRIGGER_LABEL } from '../constants/abilityCard';
import { useHoldToSpeak } from '../hooks/useHoldToSpeak';
import { useSpeakAiReply } from '../hooks/useSpeakAiReply';
import { getTtsEnabled, setTtsEnabled } from '../utils/browserVoice';

function normalizeToDate(input: unknown): Date {
  if (input instanceof Date) return input;
  return new Date(String(input));
}

function formatDayHeader(input: unknown): string {
  const d = normalizeToDate(input);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return '今天';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function isToday(d: unknown): boolean {
  const date = normalizeToDate(d);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

interface AIChatScreenContentProps {
  onOpenSettings: () => void;
  abilityBarProps?: AbilityBarProps;
  showTopCards?: boolean;
  chatSelectedDate?: Date | null;
  onClearChatDate?: () => void;
  onTakePhoto?: () => void;
  onRealtimeCardClick?: (kind: RealtimeMetricKind) => void;
}

const AIChatScreenContent: React.FC<AIChatScreenContentProps> = ({
  onOpenSettings,
  abilityBarProps,
  showTopCards = true,
  chatSelectedDate = null,
  onClearChatDate,
  onTakePhoto,
  onRealtimeCardClick,
}) => {
  const {
    messages,
    showEmotionAnimation,
    animatingEmoji,
    showAlert,
    alertMessage,
    alertType,
    handleCloseAlert,
    inputText,
    setInputText,
    handleSendMessage,
    isSendingMessage,
    cancelAiGeneration,
    addAbilityCardMessage,
  } = useChatContext();

  const { stopPlayback } = useVoicePlayback();
  const [autoTts, setAutoTts] = useState(() => getTtsEnabled());

  const onVoiceFinal = useCallback(
    (text: string) => {
      void handleSendMessage(text);
    },
    [handleSendMessage],
  );

  const { supported: voiceSupported, listening, interim, lastError, slideToCancel, holdProps } = useHoldToSpeak({
    onFinalText: onVoiceFinal,
  });

  useSpeakAiReply(messages, isSendingMessage);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [inputMode, setInputMode] = useState<'speak' | 'keyboard'>('speak');

  const mergedAbilityBarProps = React.useMemo(() => {
    if (!abilityBarProps) return undefined;
    return {
      ...abilityBarProps,
      onViewDeliveryPlan: () => addAbilityCardMessage(ABILITY_CARD_TRIGGER_LABEL.delivery, 'delivery'),
      onViewMeals: () => addAbilityCardMessage(ABILITY_CARD_TRIGGER_LABEL.meals, 'meals'),
      onViewSupplements: () => addAbilityCardMessage(ABILITY_CARD_TRIGGER_LABEL.supplements, 'supplements'),
      onViewDailyReport: () => addAbilityCardMessage(ABILITY_CARD_TRIGGER_LABEL.report, 'report'),
    };
  }, [abilityBarProps, addAbilityCardMessage]);

  return (
    <div className="h-full bg-white flex flex-col relative overflow-hidden">
      {/* Header - Now handled by App.tsx unified navigation */}
      
      {/* 表情动画层 */}
      <EmotionAnimation 
        show={showEmotionAnimation} 
        emoji={animatingEmoji} 
      />

      {/* 仅查看历史日期时显示返回全部，默认（今天）不显示 */}
      {chatSelectedDate && !isToday(chatSelectedDate) && onClearChatDate && (
        <div className="shrink-0 px-4 py-2 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="max-w-sm mx-auto">
            <button
              type="button"
              onClick={onClearChatDate}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{formatDayHeader(chatSelectedDate)}</span>
              <span className="text-gray-400">·</span>
              <span>返回全部</span>
            </button>
          </div>
        </div>
      )}

      {/* 聊天区：sticky 标题栏 + 滚动内容 */}
      {showTopCards && (!chatSelectedDate || isToday(chatSelectedDate)) ? (
        <TopSummaryRowProvider
          onAskQuestion={(q) => handleSendMessage(q)}
          onRealtimeCardClick={onRealtimeCardClick}
        >
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="sticky top-0 z-20 shrink-0 bg-white">
              <div className="w-full max-w-sm mx-auto px-3">
                <TopSummaryRowHeader />
              </div>
            </div>
            <ChatMessageList
              onAvatarClick={onOpenSettings}
              abilityBarProps={abilityBarProps}
              showRealtimeBlock
            />
          </div>
        </TopSummaryRowProvider>
      ) : (
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ChatMessageList
            onAvatarClick={onOpenSettings}
            abilityBarProps={abilityBarProps}
          />
        </div>
      )}

      {/* 底部：能力条 + 输入框 */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-transparent">
        <div className="w-full max-w-sm mx-auto bg-white">
          {mergedAbilityBarProps ? <AbilityBar {...mergedAbilityBarProps} /> : null}
          {/* 聊天输入区域 */}
          <div className="pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 py-1">
              <div className="flex items-center gap-3">
                {/* 输入条：小键盘 | 中间(说话/输入) | 相机 */}
                <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm min-w-0">
                  {/* 左侧：小键盘图标，点击切换键盘输入模式 */}
                  <button
                    type="button"
                    onClick={() => setInputMode((m) => (m === 'speak' ? 'keyboard' : 'speak'))}
                    className={`p-1 rounded-full shrink-0 ${inputMode === 'keyboard' ? 'text-purple-500 bg-purple-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    aria-label={inputMode === 'speak' ? '切换键盘输入' : '切换语音输入'}
                  >
                    <Keyboard className="w-4 h-4" />
                  </button>
                  {/* 中间：说话模式显示按钮，键盘模式显示输入框 */}
                  {inputMode === 'speak' ? (
                    <button
                      type="button"
                      {...holdProps}
                      disabled={!voiceSupported || isSendingMessage}
                      style={{ touchAction: "none" }}
                      className={`flex-1 py-1 text-sm min-w-0 rounded-lg select-none ${
                        listening
                          ? "text-purple-600 font-medium bg-purple-50"
                          : "text-gray-500"
                      } ${!voiceSupported || isSendingMessage ? "opacity-50 cursor-not-allowed" : ""}`}
                      aria-label="按住说话，松手发送"
                    >
                      {listening
                        ? slideToCancel
                          ? "松开手指 — 取消发送"
                          : interim || "聆听中…（上滑取消）"
                        : voiceSupported
                          ? "按住 说话（松手发送）"
                          : "浏览器不支持语音（请用 Chrome）"}
                    </button>
                  ) : (
                    <TextInput
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onSend={(text) => handleSendMessage(text)}
                      disabled={isSendingMessage}
                      placeholder="说点什么呢..."
                      borderless
                    />
                  )}
                  {/* 右侧：相机 */}
                  <button
                    type="button"
                    onClick={() => onTakePhoto?.()}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 shrink-0"
                    aria-label="拍照上传"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                {/* 输入条外：发送 / 生成中停止（Cursor 式方块） */}
                {isSendingMessage ? (
                  <button
                    type="button"
                    onClick={() => cancelAiGeneration()}
                    className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors shrink-0 flex items-center justify-center"
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
                    className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                )}
              </div>
              {lastError ? (
                <div className="text-center text-xs text-amber-600 mt-1 px-2">{lastError}</div>
              ) : null}
              <div className="text-center text-xs text-gray-500 mt-2 px-2 leading-relaxed">
                <span>内容由AI生成，仅供参考 · </span>
                <button
                  type="button"
                  className="text-inherit hover:opacity-80 align-baseline"
                  onClick={() => {
                    const next = !autoTts;
                    setAutoTts(next);
                    setTtsEnabled(next);
                    if (!next) stopPlayback();
                  }}
                >
                  <span className="text-gray-500">新回复自动朗读：</span>
                  <span className="text-purple-500 font-medium">{autoTts ? "开" : "关"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 提示对话框 */}
      <AlertDialog
        show={showAlert}
        type={alertType}
        title="提示"
        message={alertMessage}
        onClose={handleCloseAlert}
        confirmText="确定"
      />

      {/* 添加CSS动画 */}
      <style>{`
        @keyframes flyToJar {
          0% {
            transform: scale(1) translate(0, 0);
            opacity: 1;
          }
          50% {
            transform: scale(1.5) translate(0, -50px);
            opacity: 0.8;
          }
          100% {
            transform: scale(0.5) translate(200px, -300px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default AIChatScreenContent;
