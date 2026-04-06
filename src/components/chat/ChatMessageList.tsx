 
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useChatContext, type AbilityCardType } from '../../contexts/ChatContext';
import { ChatMessageBubble } from '../common/ChatMessageBubble';
import { ABILITY_CARD_TRIGGER_LABEL } from '../../constants/abilityCard';
import ChatLoadingIndicator from './ChatLoadingIndicator';
import { ChatFeedbackBubble } from './ChatFeedbackBubble';
import QuickEntryCard from '../QuickEntryCard';
import DeliveryPlanCard from './DeliveryPlanCard';
import TodayMealsCard from './TodayMealsCard';
import TodaySupplementsCard from './TodaySupplementsCard';
import DailyReportCard from './DailyReportCard';
import BreathingChatAbilityCard from './BreathingChatAbilityCard';
import { MealGlucoseAutoFeedback } from './MealGlucoseAutoFeedback';
import TopSummaryRowBlock from '../singlepage/TopSummaryRowBlock';
import type { AbilityBarProps } from '../singlepage/AbilityBar';
import {
  formatAiDeliveryMessageForDisplay,
  formatChatTimeDividerLabel,
  getMessageTimeForDivider,
  isWelcomeChatMessage,
  maskSensitivePhonesInAiChatDisplay,
  shouldShowChatTimeDivider,
} from '../../utils/chatUtils';
import { AiReplyVoiceButton } from './AiReplyVoiceButton';

interface ChatMessageListProps {
  onAvatarClick: () => void;
  /** 能力条回调（用于卡片内的跳转） */
  abilityBarProps?: AbilityBarProps;
  /** 是否在顶部展示实时数据块（放入聊天流，随消息被挤上去） */
  showRealtimeBlock?: boolean;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ onAvatarClick, abilityBarProps, showRealtimeBlock }) => {
  const {
    messages,
    isLoadingAnalysis, 
    isSendingMessage, 
    isLoadingHistory,
    hasMoreMessages,
    userGender, 
    handleQuickEntryConfirmFromMessage, 
    handleQuickEntryDeleteFromMessage,
    handleAbilityCardClose,
    handleLoadMoreMessages
  } = useChatContext();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const renderedMessageKeysRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef(true);

  const buildFallbackMessageKey = useCallback((msg: any) => {
    const createdAtTs = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
    const timestampText = msg.timestamp || '';
    const contentSnippet = (msg.content || '').slice(0, 80);
    const quickEntryType = msg.quickEntryData?.metricType || '';
    const abilityType = msg.abilityCardType || '';
    return `fallback-${msg.type}-${createdAtTs || timestampText}-${quickEntryType}-${abilityType}-${contentSnippet}`;
  }, []);

  // 🔥 修复：更严格的去重逻辑，基于消息ID去重，如果ID相同则保留最新的
  const uniqueMessages = useMemo(() => {
    // 使用 Map 存储消息，key 为消息ID，value 为消息对象
    // 如果遇到相同ID，保留 createdAt 更新的（或没有 createdAt 的保留第一个）
    const messageMap = new Map<string, typeof messages[0]>();
    
    messages.forEach((msg) => {
      // 🔥 修复：统一使用 id 字段（兼容 messageId 字段）
      const messageId = (msg as any).id || (msg as any).messageId;
      
      if (!messageId) {
        // 如果没有ID，使用内容稳定的后备 key，避免滚动/插入导致 index key 变化
        const fallbackKey = buildFallbackMessageKey(msg);
        messageMap.set(fallbackKey, msg);
        return;
      }
      
      const existing = messageMap.get(messageId);
      
      if (!existing) {
        messageMap.set(messageId, msg);
      } else {
        const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
        const currentTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
        // 保留更新的；便签卡片 visibility 更新时 createdAt 不变，需额外比较
        const isNewer =
          currentTime > existingTime ||
          (!msg.createdAt && existing.createdAt) ||
          ((msg as any).abilityCardVisible === true && (existing as any).abilityCardVisible !== true);
        if (isNewer) {
          messageMap.set(messageId, msg);
        }
      }
    });
    
    const unique = Array.from(messageMap.values());
    
    // 🔥 如果去重后数量减少，记录警告
    if (unique.length < messages.length) {
      console.warn(`⚠️ [ChatMessageList] 检测到重复消息，已去重: ${messages.length} -> ${unique.length}`);
    }
    
    return unique;
  }, [messages, buildFallbackMessageKey]);

  /** 类微信：仅跨日或间隔 ≥3 分钟时显示居中时间条；当天仅 HH:mm */
  const timeDividerMeta = useMemo(() => {
    let prev: Date | null = null;
    return uniqueMessages.map((msg) => {
      if (isWelcomeChatMessage(msg)) {
        return { show: false, label: '' };
      }
      const curr = getMessageTimeForDivider(msg);
      const show = shouldShowChatTimeDivider(prev, curr);
      const label = show ? formatChatTimeDividerLabel(curr) : '';
      prev = curr;
      return { show, label };
    });
  }, [uniqueMessages]);

  // 仅滚动列表容器，避免 scrollIntoView 带动外层布局导致历史记录无法稳定上滑查看
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = containerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    });
  }, []);

  // 仅在用户本就在底部附近时跟随滚底（加载更多历史、长度变化时不再强行拽回底部）
  useEffect(() => {
    if (uniqueMessages.length === 0) return;
    const container = containerRef.current;
    const thresholdPx = 220;
    if (!container) {
      scrollToBottom();
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < thresholdPx;
    if (nearBottom || isInitialMountRef.current) {
      scrollToBottom();
    }
  }, [uniqueMessages.length, scrollToBottom]);

  // 首次有消息渲染后才关闭初始标记，避免返回主页面时整批消息淡入（从上到下）
  useEffect(() => {
    if (uniqueMessages.length > 0 && isInitialMountRef.current) {
      const t = requestAnimationFrame(() => {
        isInitialMountRef.current = false;
      });
      return () => cancelAnimationFrame(t);
    }
  }, [uniqueMessages.length]);

  // 清理已渲染消息的key集合（当消息列表清空时）
  useEffect(() => {
    if (uniqueMessages.length === 0) {
      renderedMessageKeysRef.current.clear();
    }
  }, [uniqueMessages.length]);

  // 设置IntersectionObserver来检测何时到达列表顶部，以便加载更多消息
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreMessages && !isLoadingHistory) {
          // 当顶部触发器可见且有更多消息时，加载更多
          handleLoadMoreMessages();
        }
      },
      {
        root: containerRef.current,
        threshold: 0.1
      }
    );

    const startNode = messagesStartRef.current;
    if (startNode) {
      observer.observe(startNode);
    }

    return () => {
      if (startNode) {
        observer.unobserve(startNode);
      }
    };
  }, [hasMoreMessages, isLoadingHistory, handleLoadMoreMessages, uniqueMessages.length]);

  // 保存滚动高度，以便在加载更多消息时恢复位置
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    prevScrollHeightRef.current = container.scrollHeight;
  }, [uniqueMessages.length]);

  // 在加载更多消息后，保持滚动位置
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const newScrollHeight = container.scrollHeight;
    const oldScrollHeight = prevScrollHeightRef.current;
    
    // 如果滚动高度增加了，保持当前滚动位置
    if (newScrollHeight > oldScrollHeight && !isLoadingAnalysis && !isSendingMessage) {
      const scrollDifference = newScrollHeight - oldScrollHeight;
      container.scrollTop += scrollDifference;
    }
  }, [uniqueMessages, isLoadingAnalysis, isSendingMessage]);

  return (
    <>
      <MealGlucoseAutoFeedback />
    <div 
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto ios-touch-scroll overscroll-y-contain scrollbar-hide bg-white"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 140px)' }}
    >
        <div className={showRealtimeBlock ? 'w-full max-w-sm mx-auto px-3' : 'px-4'}>
        {/* 顶部加载更多触发器：有实时数据块时高度为 0 避免空隙 */}
        <div ref={messagesStartRef} className={showRealtimeBlock ? 'h-px shrink-0 flex justify-center items-center' : 'h-2 flex justify-center items-center'}>
          {isLoadingHistory && hasMoreMessages && (
            <ChatLoadingIndicator size="small" text="加载更多..." />
          )}
        </div>

        {/* 实时数据块：放入聊天流顶部，与标题同宽，随新消息被挤上去 */}
        {showRealtimeBlock && <TopSummaryRowBlock />}
        
        <div className="space-y-4 pt-2">
          {/* 全量渲染消息列表 */}
          {uniqueMessages.map((message, index) => {
            // 🔥 修复：使用 message.id 或 messageId 作为主要标识符，确保唯一性
            // uniqueMessages 已经去重，所以同一渲染中不会有重复的 key
            const messageId = (message as any).id || (message as any).messageId;
            const clientId = (message as any).clientId;
            
            // 使用 messageId/clientId，兜底使用内容稳定 key，避免 index 导致的重挂载
            const stableKey = clientId || messageId || buildFallbackMessageKey(message);
            
            // 🔥 修复：移除基于历史记录的重复检查，因为：
            // 1. uniqueMessages 已经去重，不会在同一渲染中有重复
            // 2. renderedMessageKeysRef 用于跟踪历史渲染，在重新渲染时保留是正常的
            // 3. 之前的检查逻辑错误，导致正常重新渲染时误报
            
            // 检查消息是否已经渲染过，只在首次渲染时添加动画
            // 🔥 返回主页面时跳过淡入动画，避免「从上到当前内容」的加载动画感
            /** 便签触发消息入库 content 固定为 ABILITY_CARD_TRIGGER_LABEL，不在气泡里重复展示 */
            const abilityType = (message as { abilityCardType?: AbilityCardType }).abilityCardType;
            const hideUserBubbleForAbilityCard =
              message.type === 'user' &&
              !!abilityType &&
              message.content === ABILITY_CARD_TRIGGER_LABEL[abilityType];
            // 关闭淡入动画，彻底避免消息/卡片因重排出现视觉抖动
            const isNewMessage = false;
            if (!renderedMessageKeysRef.current.has(stableKey)) {
              renderedMessageKeysRef.current.add(stableKey);
            }

            const { show: showTimeDivider, label: timeDividerLabel } =
              timeDividerMeta[index] ?? { show: false, label: '' };
            
            return (
            <div key={stableKey} className={isNewMessage ? "animate-fade-in" : ""}>
              {showTimeDivider && timeDividerLabel ? (
                <div className="flex justify-center mb-2">
                  <span
                    className="inline-block rounded-md bg-gray-100 px-2.5 py-0.5 text-[11px] leading-tight text-gray-500"
                    role="text"
                  >
                    {timeDividerLabel}
                  </span>
                </div>
              ) : null}

              {message.type === 'quickEntry' ? (
                <div className="flex justify-start">
                  {/* AI头像 */}
                  {onAvatarClick && (
                    <button
                      onClick={onAvatarClick}
                      className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center mr-2 flex-shrink-0 hover:bg-purple-300 transition-colors self-start mt-1"
                      aria-label="AI设置"
                    >
                      <span className="text-lg">🐰</span>
                    </button>
                  )}
                  <div className="flex flex-col space-y-2 w-full max-w-[280px]">
                    {message.content && (
                      <>
                        <ChatMessageBubble
                          type="ai"
                          content={message.content}
                          timestamp={message.timestamp}
                          showAvatar={false}
                          onAvatarClick={onAvatarClick}
                        />
                        {(message.content || '').trim() ? (
                          <div className="flex justify-start pl-0">
                            <AiReplyVoiceButton
                              playbackKey={message.clientId || message.id}
                              text={maskSensitivePhonesInAiChatDisplay(
                                formatAiDeliveryMessageForDisplay(message.content),
                              )}
                            />
                          </div>
                        ) : null}
                      </>
                    )}
                    {message.quickEntryData && (
                      <QuickEntryCard
                        data={message.quickEntryData}
                        onConfirm={(data) => handleQuickEntryConfirmFromMessage(message.id, data)}
                        onDelete={() => handleQuickEntryDeleteFromMessage(message.id)}
                        isConfirmed={message.isQuickEntryConfirmed}
                      />
                    )}
                  </div>
                </div>
              ) : message.type === 'feedback' ? (
                <div className="flex justify-start">
                  {onAvatarClick && (
                    <button
                      onClick={onAvatarClick}
                      className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center mr-2 flex-shrink-0 hover:bg-purple-300 transition-colors self-start mt-1"
                      aria-label="AI设置"
                    >
                      <span className="text-lg">🐰</span>
                    </button>
                  )}
                  <div className="flex flex-col w-full min-w-0">
                    <ChatFeedbackBubble content={message.content} />
                    {(message.content || "").trim() ? (
                      <div className="flex justify-start mt-1">
                        <AiReplyVoiceButton
                          playbackKey={message.clientId || message.id}
                          text={maskSensitivePhonesInAiChatDisplay(
                            formatAiDeliveryMessageForDisplay(message.content),
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  {!hideUserBubbleForAbilityCard && (
                    <ChatMessageBubble
                      type={message.type as 'user' | 'ai'}
                      content={message.content}
                      timestamp={message.timestamp}
                      emotionEmoji={message.emotionEmoji}
                      userGender={userGender as 'male' | 'female' | ''}
                      showAvatar={true}
                      onAvatarClick={message.type === 'ai' ? onAvatarClick : undefined}
                    />
                  )}
                  {message.type === 'ai' && (message.content || '').trim() ? (
                    <div className="flex justify-start mt-1">
                      <div className="w-8 mr-2 flex-shrink-0" aria-hidden />
                      <AiReplyVoiceButton
                        playbackKey={message.clientId || message.id}
                        text={maskSensitivePhonesInAiChatDisplay(
                          formatAiDeliveryMessageForDisplay(message.content),
                        )}
                      />
                    </div>
                  ) : null}
                  {/* 便签卡片：每条消息独立，2秒后展示；呼吸便签左侧对齐 AI 头像，与 quickEntry 一致 */}
                  {message.abilityCardType === 'breathing' && message.abilityCardVisible ? (
                    <div className="mt-5 flex justify-start">
                      {onAvatarClick && (
                        <button
                          type="button"
                          onClick={onAvatarClick}
                          className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center mr-2 flex-shrink-0 hover:bg-purple-300 transition-colors self-start mt-1"
                          aria-label="AI设置"
                        >
                          <span className="text-lg">🐰</span>
                        </button>
                      )}
                      <div className="flex flex-col w-full max-w-[280px] min-w-0">
                        <BreathingChatAbilityCard
                          messageId={message.id}
                          onClose={() => handleAbilityCardClose(message.id)}
                        />
                      </div>
                    </div>
                  ) : message.abilityCardType && message.abilityCardVisible ? (
                    <div className="mt-5">
                      {message.abilityCardType === 'delivery' && (
                        <DeliveryPlanCard
                          onClose={() => handleAbilityCardClose(message.id)}
                          onAddAddress={
                            abilityBarProps?.onOpenAddressManagement ||
                            abilityBarProps?.onOpenDeliveryPlanPage
                          }
                        />
                      )}
                      {message.abilityCardType === 'meals' && (
                        <TodayMealsCard onClose={() => handleAbilityCardClose(message.id)} />
                      )}
                      {message.abilityCardType === 'supplements' && (
                        <TodaySupplementsCard onClose={() => handleAbilityCardClose(message.id)} />
                      )}
                      {message.abilityCardType === 'report' && (
                        <DailyReportCard onClose={() => handleAbilityCardClose(message.id)} />
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            );
          })}

          {/* Loading Indicator - 显示为AI对话气泡 */}
          {(isLoadingAnalysis || isSendingMessage) && (
            <div className="flex justify-start">
              {/* AI头像 */}
              {onAvatarClick && (
                <button
                  onClick={onAvatarClick}
                  className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center mr-2 flex-shrink-0 hover:bg-purple-300 transition-colors"
                  aria-label="AI设置"
                >
                  <span className="text-lg">🐰</span>
                </button>
              )}
              {/* 加载中的对话气泡 */}
              <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md max-w-[220px] border border-gray-200 px-2.5 py-1.5 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            /* 🔥 修复：移除 translateY，只保留透明度变化，避免抖动 */
          }
          to {
            opacity: 1;
            /* 🔥 修复：移除 translateY，只保留透明度变化，避免抖动 */
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
          /* 🔥 修复：减少动画时间，从 0.3s 改为 0.2s，减少视觉干扰 */
        }
      `}</style>
    </div>
    </>
  );
};

export default ChatMessageList;
