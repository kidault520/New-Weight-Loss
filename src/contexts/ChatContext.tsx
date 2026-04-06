import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { QuickEntryData } from '../components/QuickEntryCard';
import { VoicePlaybackProvider } from './VoicePlaybackContext';
import { useChatLogic } from '../hooks/useChatLogic';
import { DEFAULT_AI_COMPANION_NAME } from '../services/aiSettingsService';
import { sortMessagesByTimestamp } from '../utils/chatHelpers';

/** 便签卡片类型：每条消息独立，2秒后展示 */
export type AbilityCardType = 'delivery' | 'meals' | 'supplements' | 'report' | 'breathing';

export interface ChatMessage {
  id: string;
  /** 前端本地稳定键：用于避免 tempId -> dbId 替换时闪动重挂载 */
  clientId?: string;
  type: 'user' | 'ai' | 'quickEntry' | 'feedback';
  content: string;
  timestamp: string;
  createdAt?: string; // 数据库的 created_at，用于精确排序
  emotion?: string;
  emotionEmoji?: string;
  quickEntryData?: QuickEntryData;
  isQuickEntryConfirmed?: boolean;
  /** 便签卡片类型：有则表示为便签触发的消息 */
  abilityCardType?: AbilityCardType;
  /** 便签卡片是否已展示（点击后2秒变为 true） */
  abilityCardVisible?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  inputText: string;
  showEmotionAnimation: boolean;
  animatingEmoji: string;
  isLoadingAnalysis: boolean;
  isSendingMessage: boolean;
  isLoadingHistory: boolean;
  hasMoreMessages: boolean;
  conversationId: string | undefined;
  userGender: string;
  aiName: string;
  ownerName: string;
  todayCardCount: number;
  showAlert: boolean;
  alertMessage: string;
  alertType: 'success' | 'error' | 'warning' | 'info';
}

export type ChatAction =
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; message: Partial<ChatMessage> } }
  | { type: 'SET_INPUT_TEXT'; payload: string }
  | { type: 'SET_SHOW_EMOTION_ANIMATION'; payload: boolean }
  | { type: 'SET_ANIMATING_EMOJI'; payload: string }
  | { type: 'SET_IS_LOADING_ANALYSIS'; payload: boolean }
  | { type: 'SET_IS_SENDING_MESSAGE'; payload: boolean }
  | { type: 'SET_IS_LOADING_HISTORY'; payload: boolean }
  | { type: 'SET_HAS_MORE_MESSAGES'; payload: boolean }
  | { type: 'APPEND_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_CONVERSATION_ID'; payload: string | undefined }
  | { type: 'SET_USER_GENDER'; payload: string }
  | { type: 'SET_AI_NAME'; payload: string }
  | { type: 'SET_OWNER_NAME'; payload: string }
  | { type: 'SET_TODAY_CARD_COUNT'; payload: number }
  | { type: 'SET_SHOW_ALERT'; payload: boolean }
  | { type: 'SET_ALERT_MESSAGE'; payload: string }
  | { type: 'SET_ALERT_TYPE'; payload: 'success' | 'error' | 'warning' | 'info' };

interface ChatContextType extends ChatState {
  setInputText: (text: string) => void;
  handleSendMessage: (overrideText?: string) => Promise<void>;
  /** 便签点击：先插入消息，2秒后展示卡片；每条消息独立 */
  addAbilityCardMessage: (label: string, cardType: AbilityCardType) => void;
  /** 便签卡片关闭：隐藏该消息下的卡片 */
  handleAbilityCardClose: (messageId: string) => void;
  handleQuickEntryConfirmFromMessage: (messageId: string, data: QuickEntryData) => Promise<void>;
  handleQuickEntryDeleteFromMessage: (messageId: string) => Promise<void>;
  handleQuickAction: (action: string) => Promise<void>;
  handleLoadMoreMessages: () => Promise<void>;
  handleCloseAlert: () => void;
  showChatAlert: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  addAIMessage: (content: string, opts?: { minAfterUserMs?: number }) => Promise<void>;
  /** 添加反馈通知消息（独立 UI，区别于普通对话） */
  addFeedbackMessage: (content: string) => Promise<void>;
  cancelAiGeneration: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const initialState: ChatState = {
  messages: [],
  inputText: '',
  showEmotionAnimation: false,
  animatingEmoji: '',
  isLoadingAnalysis: false,
  isSendingMessage: false,
  isLoadingHistory: false,
  hasMoreMessages: true,
  conversationId: undefined,
  userGender: '',
  aiName: DEFAULT_AI_COMPANION_NAME,
  ownerName: 'owner',
  todayCardCount: 0,
  showAlert: false,
  alertMessage: '',
  alertType: 'warning'
};


function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: sortMessagesByTimestamp(action.payload) };
    case 'ADD_MESSAGE': {
      // 🔥 修复：添加消息前先检查是否已存在（基于ID去重）
      const messageExists = state.messages.some(msg => msg.id === action.payload.id);
      if (messageExists) {
        console.warn(`⚠️ [ChatReducer] 消息已存在，跳过添加: ${action.payload.id}`);
        return state;
      }
      // 添加消息后按时间戳排序，确保顺序正确
      const newMessages = [...state.messages, action.payload];
      return { ...state, messages: sortMessagesByTimestamp(newMessages) };
    }
    case 'APPEND_MESSAGES': {
      // 🔥 修复：追加消息前先过滤掉已存在的消息（基于ID去重）
      const existingIds = new Set(state.messages.map(msg => msg.id));
      const newMessagesToAppend = action.payload.filter(msg => {
        if (existingIds.has(msg.id)) {
          console.warn(`⚠️ [ChatReducer] 消息已存在，跳过追加: ${msg.id}`);
          return false;
        }
        return true;
      });
      const appendedMessages = [...state.messages, ...newMessagesToAppend];
      return { ...state, messages: sortMessagesByTimestamp(appendedMessages) };
    }
    case 'UPDATE_MESSAGE': {
      // 更新消息后需要重新排序，因为createdAt可能已更新
      // 如果ID也更新了，需要先找到旧ID的消息，然后更新为新ID，并移除可能重复的新ID消息
      const newId = action.payload.message.id;
      const updatedMessages = state.messages
        .filter(msg => {
          // 如果新ID已经存在且不是当前要更新的消息，移除它（避免重复）
          if (newId && msg.id === newId && msg.id !== action.payload.id) {
            return false;
          }
          return true;
        })
        .map(msg => {
          // 如果消息的ID匹配，更新它
          if (msg.id === action.payload.id) {
            return { ...msg, ...action.payload.message };
          }
          return msg;
        });
      
      return {
        ...state,
        messages: sortMessagesByTimestamp(updatedMessages)
      };
    }
    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.payload };
    case 'SET_SHOW_EMOTION_ANIMATION':
      return { ...state, showEmotionAnimation: action.payload };
    case 'SET_ANIMATING_EMOJI':
      return { ...state, animatingEmoji: action.payload };
    case 'SET_IS_LOADING_ANALYSIS':
      return { ...state, isLoadingAnalysis: action.payload };
    case 'SET_IS_SENDING_MESSAGE':
      return { ...state, isSendingMessage: action.payload };
    case 'SET_IS_LOADING_HISTORY':
      return { ...state, isLoadingHistory: action.payload };
    case 'SET_HAS_MORE_MESSAGES':
      return { ...state, hasMoreMessages: action.payload };
    case 'SET_CONVERSATION_ID':
      return { ...state, conversationId: action.payload };
    case 'SET_USER_GENDER':
      return { ...state, userGender: action.payload };
    case 'SET_AI_NAME':
      return { ...state, aiName: action.payload };
    case 'SET_OWNER_NAME':
      return { ...state, ownerName: action.payload };
    case 'SET_TODAY_CARD_COUNT':
      return { ...state, todayCardCount: action.payload };
    case 'SET_SHOW_ALERT':
      return { ...state, showAlert: action.payload };
    case 'SET_ALERT_MESSAGE':
      return { ...state, alertMessage: action.payload };
    case 'SET_ALERT_TYPE':
      return { ...state, alertType: action.payload };
    default:
      return state;
  }
}


export const ChatProvider: React.FC<{
  children: ReactNode;
  chatSelectedDate?: Date | null;
}> = ({ children, chatSelectedDate = null }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  const handlers = useChatLogic({ state, dispatch, chatSelectedDate });

  const value: ChatContextType = {
    ...state,
    ...handlers
  };

  return (
    <ChatContext.Provider value={value}>
      <VoicePlaybackProvider>{children}</VoicePlaybackProvider>
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

/** 可选版本：在 ChatProvider 外使用时返回 null，不抛错（用于 TopSummaryRow 等可能独立渲染的场景） */
export const useOptionalChatContext = () => useContext(ChatContext) ?? null;
