/**
 * useChatLogic - 聊天业务逻辑 Hook
 * 包含所有聊天相关的业务逻辑：用户数据加载、消息同步、实时订阅、消息处理等
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { healthMetricDetectionService } from '../services/healthMetricDetectionService';
import { quickEntrySyncService, sanitizeChatMessageIdForHealthRecord } from '../services/quickEntrySyncService';
import { formatChatTimestamp, createErrorMessage } from '../utils/chatUtils';
import { aiSettingsService, DEFAULT_AI_COMPANION_NAME, type AICompanionSettings } from '../services/aiSettingsService';
import { dailyCounterService } from '../services/dailyCounterService';
import { quickEntryCardsService, type QuickEntryAggregateCard } from '../services/quickEntryCardsService';
import { QuickEntryData } from '../components/QuickEntryCard';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  useChatMessagesByDayQuery,
  useAddChatMessageMutation,
  useUpdateChatMessageMutation,
} from './useChatMessagesQuery';
import {
  sortMessagesByTimestamp,
  loadTodayCardCount,
  enrichAbilityCardMessages,
} from '../utils/chatHelpers';
import { getDeliveryMealTimeRange } from '../constants/deliveryMealTimes';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { buildChatAiClientContext } from '../utils/chatAiContext';
import { toBeijingDateString } from '../utils/dateUtils';
import { ABILITY_CARD_TRIGGER_LABEL } from '../constants/abilityCard';
import { shouldSuggestBreathingFromDistressText } from '../utils/breathingDistressKeywords';
import { dashboardDataService } from '../services/dashboardDataService';
import { createScopedLogger } from '../utils/logger';

const CLOSED_ABILITY_CARDS_KEY = 'closed-ability-cards';
const MAX_CLOSED_IDS = 200;
const CARD_FEEDBACK_DELAY_MS = 2000;
const makeClientId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const chatLogger = createScopedLogger('ChatLogic', 'debug.chat');
const chatDebug = (...args: unknown[]) => chatLogger.debug(...args);
const chatWarn = (...args: unknown[]) => chatLogger.warn(...args);
const VOICE_STRONG_CONFIRM_CONFIDENCE = 0.8;
const VOICE_WEAK_CONFIRM_CONFIDENCE = 0.6;
const CARD_ACTION_DIRECTIVE_PHRASES = [
  '你直接输入吧',
  '直接输入吧',
  '直接输入',
  '你记一下',
  '帮我记一下',
  '记录一下吧',
  '记录吧',
  '先记下',
  '帮我记',
  '记一下',
];
type AbilityCardContext = 'delivery' | 'meals' | 'supplements' | 'report' | 'breathing' | null;

type VoiceCardAction = 'confirm' | 'cancel';

const STRONG_CONFIRM_PHRASES = [
  '确认',
  '确定',
  '保存',
  '记录',
  '记一下',
  '记上',
  '记下来',
  '帮我记',
  '就这样',
  '就按这个',
  '没问题',
  '同意',
  '好的',
  '行',
];

const WEAK_CONFIRM_PHRASES = [
  '可以',
  '可以了',
  '嗯',
  '嗯嗯',
  '好吧',
  '还行',
  '就这',
];

const STRONG_CANCEL_PHRASES = [
  '取消',
  '不要',
  '算了',
  '不记录',
  '别记录',
  '先别记',
  '不保存',
  '别保存',
  '撤回',
  '删除这条',
  '删掉这条',
  '不用了',
  '不需要',
  '暂时不要',
  '先取消',
];

const WEAK_CANCEL_PHRASES = [
  '不太对',
  '不是这个',
  '等下',
  '稍等',
  '先等等',
  '先放着',
  '再看看',
];

function normalizeVoiceCommandText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[，。！？、；：“”"'`~!@#$%^&*()_+\-=[\]{}|\\:;<>?,./\s]/g, '');
}

function includesAnyPhrase(target: string, phrases: string[]): boolean {
  return phrases.some((p) => target.includes(normalizeVoiceCommandText(p)));
}

/** 多条待确认时：「全都要保存 / 都保存」等批量确认（已 normalizeVoiceCommandText） */
function isBatchQuickEntryConfirmNormalized(normalized: string): boolean {
  const markers = [
    '全都要保存',
    '全部保存',
    '都保存',
    '全保存',
    '每条都保存',
    '每个都保存',
    '两个都保存',
    '两条都保存',
    '全都保存',
    '统统保存',
    '一起保存',
    '全部确认',
    '都确认',
    '全都要',
    '都要保存',
    '全部都要',
    '所有都保存',
    '全部都要保存',
    '通通保存',
  ].map((p) => normalizeVoiceCommandText(p));
  return markers.some((m) => m.length > 0 && normalized.includes(m));
}

function resolveVoiceCardAction(input: string): { action: VoiceCardAction; confidence: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = normalizeVoiceCommandText(trimmed);
  if (!normalized) return null;
  const isQuestion = /[?？吗么呢]/.test(trimmed);
  const isLongText = normalized.length > 24;

  const hasStrongCancel = includesAnyPhrase(normalized, STRONG_CANCEL_PHRASES);
  const hasWeakCancel = includesAnyPhrase(normalized, WEAK_CANCEL_PHRASES);
  const hasStrongConfirm = includesAnyPhrase(normalized, STRONG_CONFIRM_PHRASES);
  const hasWeakConfirm = includesAnyPhrase(normalized, WEAK_CONFIRM_PHRASES);

  // 冲突时按否定优先
  if (hasStrongCancel) return { action: 'cancel', confidence: 0.9 };
  if (hasWeakCancel && !isQuestion) return { action: 'cancel', confidence: 0.7 };

  if (hasStrongConfirm) return { action: 'confirm', confidence: 0.9 };
  if (hasWeakConfirm && !isQuestion && !isLongText) return { action: 'confirm', confidence: 0.7 };

  return null;
}

function getPendingQuickEntryMessages(
  sourceMessages: Array<{
    id: string;
    type: string;
    isQuickEntryConfirmed?: boolean;
    quickEntryData?: QuickEntryData;
    createdAt?: string;
  }>
) {
  return sourceMessages
    .filter((m) => m.type === 'quickEntry' && !m.isQuickEntryConfirmed && !!m.quickEntryData)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function getLatestAbilityCardContext(
  sourceMessages: Array<{
    type: string;
    abilityCardType?: string;
    abilityCardVisible?: boolean;
  }>
): AbilityCardContext {
  for (let i = sourceMessages.length - 1; i >= 0; i--) {
    const msg = sourceMessages[i];
    if (msg.type !== 'user' || !msg.abilityCardVisible || !msg.abilityCardType) continue;
    if (
      msg.abilityCardType === 'delivery' ||
      msg.abilityCardType === 'meals' ||
      msg.abilityCardType === 'supplements' ||
      msg.abilityCardType === 'report' ||
      msg.abilityCardType === 'breathing'
    ) {
      return msg.abilityCardType;
    }
  }
  return null;
}

/** 便签仍停在「补剂」时，若用户本条明显在问餐食，勿套用补剂录入引导 */
function resolveAbilityContextForUserMessage(
  abilityContext: AbilityCardContext,
  userMessage: string,
): AbilityCardContext {
  if (abilityContext !== 'supplements') return abilityContext;
  const m = userMessage.trim();
  const mentionsSupplement =
    /补剂|钙片|维生素|鱼油|益生菌|保健品|tudca|nad|疗程|第几天/i.test(m);
  const mentionsFood =
    /(米饭|大米|饭|面食|面条|吃了|吃饭|进食|餐食|加餐|早餐|午餐|晚餐|热量|千卡|kcal)/i.test(m) ||
    /\d+\s*克.*(米|饭|面|菜)/.test(m);
  if (mentionsFood && !mentionsSupplement) return 'meals';
  return abilityContext;
}

function getNoCardGuidanceByContext(context: AbilityCardContext): string {
  if (context === 'supplements') {
    return '我还没有识别到可记录的补剂数据，也没有待确认卡片。请直接说补剂名称和剂量，例如“TUDCA 1粒”。';
  }
  if (context === 'meals') {
    return '我还没有识别到可记录的餐食数据，也没有待确认卡片。请直接说食物和大致热量，例如“加餐水煮蛋，约70千卡”。';
  }
  if (context === 'breathing') {
    return '我还没有识别到可记录的呼吸/训练数据，也没有待确认卡片。请直接说练习名称与时长，例如“腹式呼吸 5 分钟”。';
  }
  return '我还没有识别到可记录的数据，也没有待确认卡片。请直接说具体数值，比如“饮水250毫升”。';
}

function getNextChronologicalDate(messages: Array<{ createdAt?: string }>): Date {
  const nowMs = Date.now();
  const latestMs = messages.reduce((max, m) => {
    if (!m.createdAt) return max;
    const t = new Date(m.createdAt).getTime();
    return Number.isFinite(t) ? Math.max(max, t) : max;
  }, 0);
  return new Date(Math.max(nowMs, latestMs + 1));
}

function hasStructuredMetricHint(text: string): boolean {
  return /(\d+(\.\d+)?\s*(ml|毫升|杯|kg|公斤|千克|步|分钟|小时|千卡|kcal|mmol|mmol\/l|mmol\/L))/i.test(text);
}

function isLikelyCardActionDirective(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (/[?？吗么呢]/.test(trimmed)) return false;
  // 无问号时的咨询句（如「热量缺口是多少」）应交对话回答，勿走「催促记卡」分支
  if (
    /(?:什么|啥|多少|几多|为啥|为什么|怎么|如何|是否|有没有|哪(?:天|个|里|位)|怎样|怎么样|多大|多高|多重)/.test(
      trimmed,
    )
  ) {
    return false;
  }
  if (trimmed.length > 24) return false;
  if (hasStructuredMetricHint(trimmed)) return false;
  const normalized = normalizeVoiceCommandText(trimmed);
  return CARD_ACTION_DIRECTIVE_PHRASES.some((p) => normalized.includes(normalizeVoiceCommandText(p)));
}

function sanitizeAiResponseForCardIntegrity(
  aiText: string,
  context: {
    parsedMetricsCount: number;
    pendingQuickEntryCount: number;
    abilityContext: AbilityCardContext;
    /** 当前用户消息：用于区分餐食追问 vs 补剂便签残留上下文 */
    userMessage?: string;
  }
): string {
  const trimmed = aiText.trim();
  if (!trimmed) return aiText;

  // 仅拦截「宣称已写入/已同步到记录」的表述；勿把「已为您查询/说明」等误杀（否则咨询热量缺口等会被替换成录入引导）
  const maybeClaimsRecorded =
    /已为您(?:记录|写入|同步|保存|记下|记上|记好|录入)/.test(trimmed) ||
    /已帮您(?:记录|写入|同步|保存|记下|记上|记好|录入)/.test(trimmed) ||
    /(已记录|已写入|已同步)/.test(trimmed) ||
    /已在(?!健康档案).{0,48}记录/.test(trimmed);
  const maybeClaimsPendingCard = /(待确认卡片|去确认|点击确认|请确认卡片)/.test(trimmed);

  const guidanceContext =
    context.userMessage != null && context.userMessage !== ''
      ? resolveAbilityContextForUserMessage(context.abilityContext, context.userMessage)
      : context.abilityContext;

  // 没有解析到数据、也没有待确认卡片时，禁止出现“已记录/去确认卡片”类文案
  if (context.parsedMetricsCount === 0 && context.pendingQuickEntryCount === 0) {
    if (maybeClaimsRecorded || maybeClaimsPendingCard) {
      return getNoCardGuidanceByContext(guidanceContext);
    }
  }

  return aiText;
}

/** 与 DailyReportCard 确认反馈文案对齐，用于聊天内快捷卡片确认后 */
function getQuickEntryLabelForFeedback(data: QuickEntryData): string {
  switch (data.metricType) {
    case 'food':
      return data.foodName ? `餐食 ${data.foodName}` : '餐食';
    case 'water':
      return '饮水';
    case 'exercise':
      return data.exerciseName ? `运动 · ${data.exerciseName}` : '运动';
    case 'weight':
      return `体重 ${data.value}kg`;
    case 'sleep':
      return `睡眠 ${data.value}小时`;
    case 'steps':
      return `步数 ${data.value}步`;
    case 'measurements':
      return '围度';
    case 'emotion':
      return '情绪';
    case 'blood_glucose':
      return `血糖 ${data.value}${data.unit || 'mmol/L'}`;
    case 'supplement':
      return data.supplementName ? `补剂 ${data.supplementName}` : '补剂';
    default:
      return '健康记录';
  }
}

// 导入类型定义
import type {
  ChatState,
  ChatAction,
  ChatMessage,
  AbilityCardType,
} from '../contexts/ChatContext';

interface UseChatLogicProps {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  /** 单日对话视图：选择某天后只显示该日消息 */
  chatSelectedDate?: Date | null;
}

interface UseChatLogicReturn {
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
  /** 显示聊天区提示（成功/错误等） */
  showChatAlert: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  /** 添加 AI 反馈消息到聊天窗口（无弹窗） */
  addAIMessage: (content: string, opts?: { minAfterUserMs?: number }) => Promise<void>;
  /** 添加反馈通知消息（独立 UI，区别于普通对话） */
  addFeedbackMessage: (content: string) => Promise<void>;
  /** 中止当前进行中的 AI 回复请求 */
  cancelAiGeneration: () => void;
}

export function useChatLogic({ state, dispatch, chatSelectedDate = null }: UseChatLogicProps): UseChatLogicReturn {
  const { user } = useAuth();
  const { profile: userProfileForAi, intakePlanActive, mealPlanConfig } = useUserProfile();
  const intakePlanStartYmd =
    intakePlanActive && mealPlanConfig?.startDate
      ? toBeijingDateString(new Date(mealPlanConfig.startDate))
      : null;
  const chatPlanContextOpts = {
    intake_plan_active: intakePlanActive,
    intake_plan_start_date_ymd: intakePlanStartYmd,
  };

  /** 与 TopSummaryRowProvider 同源 queryKey，共享 React Query 缓存，保证 AI 上下文热量缺口与首页顶栏一致 */
  const todayForHomeBar = useMemo(() => new Date(), []);
  const homeBarTodayKey = toBeijingDateString(todayForHomeBar);
  const { data: homeDashboardDayData } = useQuery({
    queryKey: [
      'dashboard-data',
      homeBarTodayKey,
      false,
      userProfileForAi?.target_weight,
      userProfileForAi?.daily_steps_goal,
    ],
    queryFn: () =>
      dashboardDataService.getDayData(todayForHomeBar, {
        showTutorialData: false,
        targetWeight: userProfileForAi?.target_weight || 60,
        userProfile: userProfileForAi ?? undefined,
      }),
    staleTime: 60 * 1000,
    enabled: !!user?.id,
  });
  const homeDashboardSnapshotForAi = useMemo(() => {
    const d = homeDashboardDayData;
    if (!d?.calories) return undefined;
    return {
      beijing_date_ymd: homeBarTodayKey,
      calorie_deficit_kcal: d.calories.remaining ?? null,
      calories_target_kcal: d.calories.total ?? null,
      calories_food_intake_kcal: d.calories.foodIntake ?? null,
      calories_exercise_burned_kcal: d.calories.exerciseBurned ?? null,
      steps_current: d.steps?.current ?? null,
      steps_target: d.steps?.target ?? null,
    };
  }, [homeDashboardDayData, homeBarTodayKey]);

  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const aiNameRef = useRef<string>(state.aiName);
  const ownerNameRef = useRef<string>(state.ownerName);
  const previousQueryMessagesRef = useRef<ChatMessage[] | null>(null);
  const previousHasNextPageRef = useRef<boolean | undefined>(undefined);
  const aiAbortRef = useRef<AbortController | null>(null);
  const aiUserCancelledRef = useRef(false);
  const aiRequestSeqRef = useRef(0);
  /** 与 Edge suggest_ability_card 去重：客户端刚推过呼吸便签时跳过服务端重复推送 */
  const lastClientBreathingDistressInjectMsRef = useRef(0);
  const runDistressBreathingInjectRef = useRef<
    ((text: string, userMessageCreatedAt?: string) => Promise<boolean>) | null
  >(null);

  // 主界面默认只显示今天：null 时用今天日期
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effectiveViewDate = chatSelectedDate ? new Date(chatSelectedDate) : today;

  const byDayResult = useChatMessagesByDayQuery(effectiveViewDate);

  // 🔥 用户关闭的便签卡片 ID，持久化到 userStorage，关闭后不再重新出现
  const [closedAbilityCardIds, setClosedAbilityCardIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    getUserStorageItem<{ messageIds: string[] }>(CLOSED_ABILITY_CARDS_KEY).then((data) => {
      if (data?.messageIds?.length) {
        setClosedAbilityCardIds(new Set(data.messageIds));
      }
    });
  }, []);

  // 🔥 从数据库加载时识别便签消息，补充 abilityCardType/abilityCardVisible，实现刷新后持久化
  const queryMessages: ChatMessage[] = enrichAbilityCardMessages(byDayResult.messages || [], closedAbilityCardIds);
  const isLoadingMessages = byDayResult.isLoading;
  const refreshByDay = byDayResult.refresh;
  const hasNextPage = false;
  const fetchNextPage = () => Promise.resolve();
  const refreshMessages = useCallback(() => refreshByDay().then(() => {}), [refreshByDay]);

  const addMessageMutation = useAddChatMessageMutation();
  const updateMessageMutation = useUpdateChatMessageMutation();

  // 监听用户变化，清除旧用户的聊天数据
  useEffect(() => {
    const currentUserId = user?.id || null;
    
    // 如果用户变化了，清除所有聊天数据
    if (previousUserIdRef.current !== null && previousUserIdRef.current !== currentUserId) {
      chatDebug('🔄 [ChatContext] User changed, clearing chat data');
      chatDebug(`  Previous user: ${previousUserIdRef.current}`);
      chatDebug(`  Current user: ${currentUserId}`);
      
      // 清除消息状态
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: 0 });
      
      // 刷新 React Query 缓存
      refreshMessages();
      
      chatDebug('✅ [ChatContext] Chat data cleared for user change');
    }
    
    // 更新追踪的用户ID
    previousUserIdRef.current = currentUserId;
  }, [user?.id, dispatch, refreshMessages]);

  // Load user data and initialize chat
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { supabase } = await import('../config/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Load profile for gender (异步，不阻塞)
          (async () => {
            try {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('gender')
                .eq('user_id', user.id)
                .single();
              if (profile) {
                dispatch({ type: 'SET_USER_GENDER', payload: profile.gender });
              }
            } catch (err: any) {
              console.error('Failed to load profile:', err);
            }
          })();

          // Load AI settings (异步，不阻塞)
          const settingsPromise = aiSettingsService.getSettings(user.id);

          // 🔥 修复：不要立即显示欢迎消息，等待 React Query 加载完成后再决定
          // 这样可以避免先显示欢迎消息，然后历史消息加载完成后又被覆盖，导致闪烁

          // 异步加载设置并更新名称（不阻塞UI）
          settingsPromise.then(settings => {
            if (settings) {
              dispatch({ type: 'SET_AI_NAME', payload: settings.name });
              dispatch({ type: 'SET_OWNER_NAME', payload: settings.owner_name });
            }
          }).catch(err => chatWarn('Failed to load AI settings:', err));

          // 异步加载今日统计（不阻塞UI）
          loadTodayCardCount().then(count => {
            dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: count });
          }).catch(err => chatWarn('Failed to load today card count:', err));
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
        // 🔥 修复：加载失败时也不立即显示欢迎消息，等待 React Query 加载完成
      }
    };

    loadUserData();
  }, [dispatch]);

  // AI 伙伴页保存后立即同步称呼/AI 名，避免仍用默认 owner 发下一轮 ai-chat
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AICompanionSettings>).detail;
      if (!detail) return;
      dispatch({ type: 'SET_OWNER_NAME', payload: detail.owner_name });
      dispatch({ type: 'SET_AI_NAME', payload: detail.name });
      ownerNameRef.current = detail.owner_name;
      aiNameRef.current = detail.name;
    };
    window.addEventListener('rl-ai-companion-settings-saved', handler as EventListener);
    return () => window.removeEventListener('rl-ai-companion-settings-saved', handler as EventListener);
  }, [dispatch]);

  // 同步 React Query 的消息到本地状态
  useEffect(() => {
    // 🔥 修复：检查 queryMessages 是否真的变化了，包括确认状态
    // 需要深度比较，因为 isQuickEntryConfirmed 状态改变时也需要更新
    const queryMessagesChanged = 
      previousQueryMessagesRef.current === null ||
      previousQueryMessagesRef.current.length !== (queryMessages?.length || 0) ||
      (queryMessages || []).some((newMsg, idx) => {
        const oldMsg = previousQueryMessagesRef.current?.[idx];
        if (!oldMsg) return true;
        
        // 比较关键字段，包括确认状态、quickEntryData、便签卡片可见性
        return oldMsg.id !== newMsg.id ||
               oldMsg.content !== newMsg.content ||
               oldMsg.isQuickEntryConfirmed !== newMsg.isQuickEntryConfirmed ||
               (oldMsg as any).abilityCardVisible !== (newMsg as any).abilityCardVisible ||
               JSON.stringify(oldMsg.quickEntryData) !== JSON.stringify(newMsg.quickEntryData);
      });

    if (!queryMessagesChanged && previousQueryMessagesRef.current !== null) {
      // 消息没有变化，只更新 hasMoreMessages（如果 hasNextPage 真的变化了且状态需要更新）
      if (previousHasNextPageRef.current !== hasNextPage && state.hasMoreMessages !== (hasNextPage || false)) {
        previousHasNextPageRef.current = hasNextPage;
        dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: hasNextPage || false });
      }
      return;
    }

    // 更新 refs
    previousQueryMessagesRef.current = queryMessages || null;
    previousHasNextPageRef.current = hasNextPage;

    // 🔥 关键修复：只有在 React Query 加载完成时才处理消息
    // 这样可以避免在加载过程中显示欢迎消息，然后又被历史消息覆盖
    if (isLoadingMessages) {
      // 如果还在加载中，不更新消息列表，避免闪烁
      // 但如果有临时消息（用户刚发送的），保留它们
      return;
    }

    // 获取当前本地状态中的临时消息（temp- 前缀）、便签触发的消息（ability- 前缀）、反馈通知（feedback- 前缀）
    const localTempMessages = messagesRef.current.filter(msg => 
      (msg.id.startsWith('temp-') && !msg.id.startsWith('welcome-')) ||
      msg.id.startsWith('ability-') ||
      msg.id.startsWith('feedback-')
    );
    
    if (queryMessages && queryMessages.length > 0) {
      // 合并数据库消息和本地临时消息
      // 数据库消息已经按created_at降序排列（最新的在前），需要反转以按时间升序显示
      const reversedDbMessages = [...queryMessages].reverse();
      
      // 创建一个Set来存储数据库消息的ID，用于快速查找
      const dbMessageIds = new Set(reversedDbMessages.map(msg => msg.id));
      
      // 过滤出不在数据库中的临时消息（避免重复）
      const newTempMessages = localTempMessages.filter(tempMsg => {
        // feedback- 前缀：与 temp- 同样逻辑，检查是否有重复的数据库消息
        const isTempOrFeedback = tempMsg.id.startsWith('temp-') || tempMsg.id.startsWith('feedback-');
        if (isTempOrFeedback) {
          // 检查是否有内容相同的数据库消息（避免重复显示）
          const hasDuplicate = reversedDbMessages.some(dbMsg => 
            dbMsg.type === tempMsg.type && 
            dbMsg.content === tempMsg.content &&
            // 时间戳相近（5秒内）认为是同一条消息
            dbMsg.createdAt && tempMsg.createdAt &&
            Math.abs(new Date(dbMsg.createdAt).getTime() - new Date(tempMsg.createdAt).getTime()) < 5000
          );
          
          // 如果没有重复，保留临时消息
          return !hasDuplicate;
        }
        
        // 如果ID不是temp-/feedback-开头，说明已经更新为数据库ID，检查是否在数据库中
        if (dbMessageIds.has(tempMsg.id)) {
          return false;
        }
        
        return true;
      });
      
      // 合并：数据库消息（已按时间升序）+ 临时消息，然后按时间戳排序
      const mergedMessages = [...reversedDbMessages, ...newTempMessages];
      
      // 🔥 修复：去重 - 基于消息ID去重，避免重复的消息
      const uniqueMessagesMap = new Map<string, ChatMessage>();
      mergedMessages.forEach(msg => {
        // 使用消息ID作为key，如果ID相同，保留最新的（后面的会覆盖前面的）
        if (msg.id) {
          const existingMsg = uniqueMessagesMap.get(msg.id);
          // 如果已存在，比较 createdAt，保留更新的
          if (existingMsg) {
            const existingTime = existingMsg.createdAt ? new Date(existingMsg.createdAt).getTime() : 0;
            const currentTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
            if (currentTime > existingTime || (!msg.createdAt && existingMsg.createdAt)) {
              uniqueMessagesMap.set(msg.id, msg);
            }
          } else {
            uniqueMessagesMap.set(msg.id, msg);
          }
        } else {
          // 没有ID的消息，使用 createdAt + type + content 作为key
          const fallbackKey = msg.createdAt 
            ? `${msg.createdAt}-${msg.type}-${msg.content.substring(0, 50)}`
            : `${msg.timestamp}-${msg.type}-${msg.content.substring(0, 50)}`;
          if (!uniqueMessagesMap.has(fallbackKey)) {
            uniqueMessagesMap.set(fallbackKey, msg);
          }
        }
      });
      
      const uniqueMessages = Array.from(uniqueMessagesMap.values());
      
      // 🔥 修复：如果去重后消息数量减少，记录日志
      if (uniqueMessages.length < mergedMessages.length) {
        chatWarn(`⚠️ [ChatLogic] 检测到重复消息，已去重: ${mergedMessages.length} -> ${uniqueMessages.length}`);
      }

      // 使用统一的排序函数，确保顺序正确
      const sortedMessages = sortMessagesByTimestamp(uniqueMessages);
      
      // 🔥 修复：比较消息时，需要包含 isQuickEntryConfirmed 状态
      // 因为当卡片确认状态改变时，需要更新UI
      const currentMessages = state.messages;
      
      // 深度比较消息列表，包括确认状态
      const messagesChanged = 
        currentMessages.length !== sortedMessages.length ||
        sortedMessages.some((newMsg, idx) => {
          const oldMsg = currentMessages[idx];
          if (!oldMsg) return true;
          
          // 比较关键字段，包括确认状态
          return oldMsg.id !== newMsg.id ||
                 oldMsg.content !== newMsg.content ||
                 oldMsg.isQuickEntryConfirmed !== newMsg.isQuickEntryConfirmed ||
                 oldMsg.abilityCardVisible !== newMsg.abilityCardVisible ||
                 JSON.stringify(oldMsg.quickEntryData) !== JSON.stringify(newMsg.quickEntryData);
        });
      
      if (messagesChanged) {
        dispatch({ type: 'SET_MESSAGES', payload: sortedMessages });
      }
      
      // 只在 hasMoreMessages 需要更新时才 dispatch
      if (state.hasMoreMessages !== (hasNextPage || false)) {
        dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: hasNextPage || false });
      }
    } else {
      // 没有历史消息时，不再自动插入欢迎/打招呼消息
      const finalMessages = localTempMessages;
      
      // 🔥 优化：只在消息列表真的变化时才更新
      const currentMessages = state.messages;
      const messagesChanged = 
        currentMessages.length !== finalMessages.length ||
        currentMessages.some((msg, idx) => {
          const newMsg = finalMessages[idx];
          return !newMsg || 
                 msg.id !== newMsg.id || 
                 msg.content !== newMsg.content;
        });
      
      if (messagesChanged) {
        dispatch({ type: 'SET_MESSAGES', payload: finalMessages });
      }
    }
  }, [queryMessages, isLoadingMessages, hasNextPage, state.hasMoreMessages, state.messages, dispatch]);

  // 同步 refs 以在回调中使用最新值
  useEffect(() => {
    messagesRef.current = state.messages;
    aiNameRef.current = state.aiName;
    ownerNameRef.current = state.ownerName;
  }, [state.messages, state.aiName, state.ownerName]);

  // 实时订阅 chat_messages 表的变化
  // 使用 ref 跟踪清理状态，避免闭包问题
  const isCleaningUpRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 如果用户不存在，不建立订阅
    if (!user?.id) {
      chatDebug('⏭️ [ChatContext] No user, skipping realtime subscription');
      return;
    }

    // 重置清理标志
    isCleaningUpRef.current = false;
    let channel: RealtimeChannel | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const setupRealtimeSubscription = async () => {
      // 如果正在清理，不建立新连接
      if (isCleaningUpRef.current) {
        chatDebug('⏭️ [ChatContext] Skipping subscription setup (cleaning up)');
        return;
      }

      try {
        // 再次确认用户存在
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== user.id) {
          chatWarn('⚠️ [ChatContext] User mismatch or not found, skipping realtime subscription');
          return;
        }

        // 如果已有channel，先移除
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }

        // 创建实时订阅通道（只用于postgres_changes，不需要presence配置）
        channel = supabase
          .channel(`chat_messages:${currentUser.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'chat_messages',
              filter: `user_id=eq.${currentUser.id}`
            },
            (payload: any) => {
              chatDebug('🔄 [ChatContext] Realtime UPDATE received:', payload.new);
              
              // 更新消息（主要用于快速录入卡片的确认状态）
              const updatedMessage = payload.new;
              
              // 🔥 修复：解析 quick_entry_data（可能是 JSON 字符串）
              let quickEntryData = updatedMessage.quick_entry_data;
              if (quickEntryData && typeof quickEntryData === 'string') {
                try {
                  quickEntryData = JSON.parse(quickEntryData);
                } catch (e) {
                  chatWarn('Failed to parse quick_entry_data:', e);
                }
              }
              
              // 🔥 修复：检查消息是否存在于当前列表中
              const existingMessage = messagesRef.current.find(msg => msg.id === updatedMessage.id);
              if (!existingMessage) {
                chatWarn('⚠️ [ChatContext] Updated message not found in local state, refreshing...', updatedMessage.id);
                refreshMessages();
                return;
              }
              
              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  id: updatedMessage.id,
                  message: {
                    quickEntryData: quickEntryData,
                    isQuickEntryConfirmed: updatedMessage.is_quick_entry_confirmed || false
                  }
                }
              });

              // 如果快速录入卡片被确认，更新今日卡片计数
              if (updatedMessage.message_type === 'quickEntry' && updatedMessage.is_quick_entry_confirmed) {
                loadTodayCardCount().then(count => {
                  dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: count });
                });
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'chat_messages',
              filter: `user_id=eq.${currentUser.id}`
            },
            (payload: any) => {
              chatDebug('🗑️ [ChatContext] Realtime DELETE received:', payload.old);
              
              // 从消息列表中删除（使用ref获取最新值，避免循环依赖）
              dispatch({
                type: 'SET_MESSAGES',
                payload: messagesRef.current.filter(msg => msg.id !== payload.old.id)
              });

              // 更新今日卡片计数
              loadTodayCardCount().then(count => {
                dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: count });
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `user_id=eq.${currentUser.id}`
            },
            (payload: any) => {
              chatDebug('➕ [ChatContext] Realtime INSERT received:', payload.new);
              
              // 检查消息是否已存在（避免重复添加，使用ref获取最新值）
              const existingMessage = messagesRef.current.find(msg => msg.id === payload.new.id);
              if (existingMessage) {
                // 消息已存在，可能是临时消息的ID已更新，不需要重复添加
                return;
              }
              
              // 🔥 检查是否有相同内容的临时消息（含便签 ability-、反馈 feedback-，可能是刚保存的）
              const tempMessage = messagesRef.current.find(msg => 
                (msg.id.startsWith('temp-') || msg.id.startsWith('ability-') || msg.id.startsWith('feedback-')) &&
                msg.type === payload.new.message_type &&
                msg.content === payload.new.content &&
                msg.createdAt && 
                Math.abs(new Date(msg.createdAt).getTime() - new Date(payload.new.created_at).getTime()) < 5000
              );
              
              if (tempMessage) {
                // 找到对应的临时消息，更新它的ID为数据库ID
                dispatch({
                  type: 'UPDATE_MESSAGE',
                  payload: {
                    id: tempMessage.id,
                    message: {
                      id: payload.new.id,
                      createdAt: payload.new.created_at
                    }
                  }
                });
                if (payload.new.message_type === 'quickEntry' && currentUser?.id) {
                  queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', currentUser.id] });
                  queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', currentUser.id] });
                }
                return;
              }
              
              // 如果没有找到临时消息，添加新消息
              // 转换数据库格式到前端格式，使用 formatChatTimestamp 确保使用北京时间
              const newMessage: ChatMessage = {
                id: payload.new.id,
                type: payload.new.message_type,
                content: payload.new.content,
                timestamp: formatChatTimestamp(new Date(payload.new.created_at)),
                createdAt: payload.new.created_at, // 保留原始 created_at 用于精确排序
                quickEntryData: payload.new.quick_entry_data,
                isQuickEntryConfirmed: payload.new.is_quick_entry_confirmed || false
              };

              // 使用 ADD_MESSAGE，reducer 会自动按时间戳排序
              dispatch({ type: 'ADD_MESSAGE', payload: newMessage });

              // 如果是快速录入卡片，更新今日卡片计数，并刷新日反馈待确认列表
              if (payload.new.message_type === 'quickEntry') {
                loadTodayCardCount().then(count => {
                  dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: count });
                });
                if (currentUser?.id) {
                  queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', currentUser.id] });
                  queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', currentUser.id] });
                }
              }
            }
          )
          .subscribe((status: string) => {
            chatDebug('📡 [ChatContext] Realtime subscription status:', status);
            
            // 处理订阅状态
            if (status === 'SUBSCRIBED') {
              chatDebug('✅ [ChatContext] Realtime subscription connected');
              // 清除重连定时器
              if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
              }
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
              }
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              // 🔥 关键修复：如果正在清理，不重连（使用 ref 确保获取最新值）
              if (isCleaningUpRef.current) {
                chatDebug(`⏭️ [ChatContext] Ignoring ${status} (cleaning up)`);
                return;
              }
              
              chatDebug(`⚠️ [ChatContext] Realtime subscription ${status}, attempting to reconnect...`);
              
              // 清除旧的重连定时器
              if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
              }
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
              }
              
              // 延迟重连，避免频繁重试
              reconnectTimeout = setTimeout(() => {
                // 再次检查清理状态
                if (!isCleaningUpRef.current) {
                  chatDebug('🔄 [ChatContext] Attempting to reconnect realtime subscription...');
                  setupRealtimeSubscription();
                } else {
                  chatDebug('⏭️ [ChatContext] Skipping reconnect (cleaning up)');
                }
              }, 3000); // 3秒后重连
              
              reconnectTimeoutRef.current = reconnectTimeout;
            }
          });
        
        // 保存 channel 到 ref（在 subscribe 之后）
        channelRef.current = channel;
      } catch (error) {
        console.error('❌ [ChatContext] Failed to setup realtime subscription:', error);
        // 如果正在清理，不重连
        if (isCleaningUpRef.current) {
          chatDebug('⏭️ [ChatContext] Skipping retry (cleaning up)');
          return;
        }
        
        // 清除旧的重连定时器
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // 延迟重连
        reconnectTimeout = setTimeout(() => {
          // 再次检查清理状态
          if (!isCleaningUpRef.current) {
            chatDebug('🔄 [ChatContext] Retrying realtime subscription after error...');
            setupRealtimeSubscription();
          } else {
            chatDebug('⏭️ [ChatContext] Skipping retry (cleaning up)');
          }
        }, 5000); // 5秒后重连
        
        reconnectTimeoutRef.current = reconnectTimeout;
      }
    };

    setupRealtimeSubscription();

    // 清理函数
    return () => {
      // 🔥 关键修复：立即设置清理标志，防止重连逻辑触发
      isCleaningUpRef.current = true;
      chatDebug('🧹 [ChatContext] Starting cleanup...');
      
      // 清除重连定时器
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // 移除 channel（避免重复 remove 同一个 channel 导致 websocket 噪音）
      const targetChannel = channelRef.current ?? channel;
      if (targetChannel) {
        const channelState = (targetChannel as any)?.state;
        // 在连接尚未建立时 removeChannel 容易触发浏览器 websocket 噪音，这里仅在已加入后移除
        if (channelState === 'joined') {
          supabase.removeChannel(targetChannel);
          chatDebug('🔌 [ChatContext] Realtime subscription removed');
        } else {
          chatDebug('⏭️ [ChatContext] Skip removeChannel for non-joined state:', channelState);
        }
      }
      channel = null;
      channelRef.current = null;
    };
  }, [user?.id, dispatch, queryClient, refreshMessages]);

  // 处理函数（支持直接传入文本，如推荐问题点击）
  const cancelAiGeneration = useCallback(() => {
    aiUserCancelledRef.current = true;
    aiRequestSeqRef.current += 1;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    // 用户主动停止时应立即退出“生成中”状态，避免按钮卡住
    dispatch({ type: 'SET_IS_SENDING_MESSAGE', payload: false });
  }, [dispatch]);

  /** 便签点击：先插入消息，2秒后展示卡片；写入数据库，刷新后持久化 */
  const addAbilityCardMessage = useCallback(
    (
      label: string,
      cardType: AbilityCardType,
      opts?: { chronologicalAfter?: Array<{ createdAt?: string }> },
    ) => {
    const seed = [...messagesRef.current, ...(opts?.chronologicalAfter ?? [])];
    const now = getNextChronologicalDate(seed);
    const msgId = `ability-${Date.now()}`;
    const msg: ChatMessage = {
      id: msgId,
      type: 'user',
      content: label,
      timestamp: formatChatTimestamp(now),
      createdAt: now.toISOString(),
      abilityCardType: cardType,
      abilityCardVisible: false,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: msg });

    const idRef = { current: msgId };

    if (user?.id) {
      addMessageMutation
        .mutateAsync({ messageType: 'user', content: label })
        .then((saved) => {
          idRef.current = saved.id;
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              id: msgId,
              message: { id: saved.id, createdAt: saved.created_at },
            },
          });
        })
        .catch((err) => chatWarn('[addAbilityCardMessage] 保存失败:', err));
    }

    setTimeout(() => {
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: idRef.current, message: { abilityCardVisible: true } },
      });
    }, 2000);
  },
  [dispatch, user?.id, addMessageMutation],
);

  /** 便签卡片关闭：隐藏该消息下的卡片，并持久化避免重新出现 */
  const handleAbilityCardClose = useCallback((messageId: string) => {
    setClosedAbilityCardIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      const arr = Array.from(next).slice(-MAX_CLOSED_IDS);
      setUserStorageItem(CLOSED_ABILITY_CARDS_KEY, { messageIds: arr });
      return next;
    });
    dispatch({
      type: 'UPDATE_MESSAGE',
      payload: { id: messageId, message: { abilityCardVisible: false } },
    });
  }, [dispatch]);

  const handleSendMessage = async (overrideText?: string) => {
    const savedInputText = (overrideText ?? state.inputText).trim();
    if (!savedInputText || state.isSendingMessage) return;

    const appendTempUserMessage = (): number => {
      const userMessageTime = new Date();
      const userMs = userMessageTime.getTime();
      const tempUserMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        clientId: makeClientId('client-user'),
        type: 'user',
        content: savedInputText,
        timestamp: formatChatTimestamp(userMessageTime),
        createdAt: userMessageTime.toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: tempUserMessage });
      (async () => {
        try {
          if (user?.id) {
            const savedRecord = await addMessageMutation.mutateAsync({
              messageType: 'user',
              content: savedInputText,
            });
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                id: tempUserMessage.id,
                message: {
                  id: savedRecord.id,
                  createdAt: savedRecord.created_at,
                },
              },
            });
          }
        } catch (error) {
          chatWarn('Failed to save user message:', error);
        }
      })();
      return userMs;
    };

    aiUserCancelledRef.current = false;
    const requestSeq = ++aiRequestSeqRef.current;
    aiAbortRef.current?.abort();
    const aiAbortController = new AbortController();
    aiAbortRef.current = aiAbortController;
    const aiSignal = aiAbortController.signal;
    
    // 🔥 修复：延迟清空输入框，确保消息发送逻辑完成后再清空
    setTimeout(() => {
      dispatch({ type: 'SET_INPUT_TEXT', payload: '' });
    }, 100);

    const voiceAction = resolveVoiceCardAction(savedInputText);
    const sourceForVoice = messagesRef.current.length > 0 ? messagesRef.current : state.messages;
    const pendingForVoice = getPendingQuickEntryMessages(sourceForVoice);

    // 仅当确有未确认快捷卡时走语音确认/取消；否则（如「可以了」「好的」承接上文）交给模型，避免误套录入模板
    if (voiceAction && pendingForVoice.length > 0) {
      const userTs = appendTempUserMessage();
      const sourceMessages = messagesRef.current.length > 0 ? messagesRef.current : state.messages;
      const pendingQuickEntryMessages = getPendingQuickEntryMessages(sourceMessages);

      const rawTrim = savedInputText.trim();
      const normalizedBatch = normalizeVoiceCommandText(rawTrim);
      const looksBatchAll =
        voiceAction.action === 'confirm' &&
        pendingQuickEntryMessages.length > 1 &&
        !/[?？]/.test(rawTrim) &&
        isBatchQuickEntryConfirmNormalized(normalizedBatch);

      if (looksBatchAll) {
        const ordered = [...pendingQuickEntryMessages].sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
        );
        const notReady = ordered.filter((m) => {
          const d = m.quickEntryData;
          if (!d) return true;
          const id =
            sanitizeChatMessageIdForHealthRecord(m.id) ?? sanitizeChatMessageIdForHealthRecord(d.chatMessageId);
          return !id;
        });
        if (notReady.length > 0) {
          await addAIMessage('部分待确认卡片还在同步中，请稍后再说「全部保存」。', { minAfterUserMs: userTs });
          return;
        }
        for (const m of ordered) {
          const targetData = m.quickEntryData;
          if (!targetData) continue;
          await handleQuickEntryConfirmFromMessage(m.id, targetData);
        }
        return;
      }

      if (pendingQuickEntryMessages.length > 1) {
        await addAIMessage(`我看到有 ${pendingQuickEntryMessages.length} 条待确认记录，你要确认哪一条？`, {
          minAfterUserMs: userTs,
        });
        return;
      }

      if (voiceAction.confidence < VOICE_STRONG_CONFIRM_CONFIDENCE && voiceAction.confidence >= VOICE_WEAK_CONFIRM_CONFIDENCE) {
        await addAIMessage('我理解你可能想操作这条记录，请再明确说“确认保存”或“取消这条”。', {
          minAfterUserMs: userTs,
        });
        return;
      }

      const targetMessage = pendingQuickEntryMessages[0];
      const targetData = targetMessage.quickEntryData;
      if (!targetData) {
        await addAIMessage('这条待确认数据暂不可用，请稍后重试。', { minAfterUserMs: userTs });
        return;
      }

      if (voiceAction.action === 'confirm') {
        const validChatId = sanitizeChatMessageIdForHealthRecord(targetMessage.id)
          ?? sanitizeChatMessageIdForHealthRecord(targetData.chatMessageId);
        if (!validChatId) {
          await addAIMessage('卡片还在同步中，请稍后再说“确认保存”。', { minAfterUserMs: userTs });
          return;
        }
        await handleQuickEntryConfirmFromMessage(targetMessage.id, targetData);
        return;
      }

      await handleQuickEntryDeleteFromMessage(targetMessage.id);
      return;
    }

    // 指令/催促句但无结构化数据时，优先走卡片动作澄清，不交给模型自由发挥
    if (isLikelyCardActionDirective(savedInputText)) {
      const userTs = appendTempUserMessage();
      const sourceMessages = messagesRef.current.length > 0 ? messagesRef.current : state.messages;
      const pendingQuickEntryMessages = getPendingQuickEntryMessages(sourceMessages);
      const abilityContext = getLatestAbilityCardContext(sourceMessages);
      if (pendingQuickEntryMessages.length === 0) {
        await addAIMessage(
          getNoCardGuidanceByContext(resolveAbilityContextForUserMessage(abilityContext, savedInputText)),
          { minAfterUserMs: userTs },
        );
        return;
      }
      if (pendingQuickEntryMessages.length === 1) {
        const one = pendingQuickEntryMessages[0].quickEntryData;
        await addAIMessage(
          `我看到 1 条待确认卡片（${one ? getQuickEntryLabelForFeedback(one) : '健康记录'}），请直接说“确认保存”或“取消这条”。`,
          { minAfterUserMs: userTs },
        );
        return;
      }
      await addAIMessage(
        `我看到有 ${pendingQuickEntryMessages.length} 条待确认卡片，请先说要操作哪一条，再说“确认保存”或“取消这条”。`,
        { minAfterUserMs: userTs },
      );
      return;
    }

    // Detect multiple health metrics in the message
    const detections = healthMetricDetectionService.detectMultipleMetrics(savedInputText);
    
    // 🔥 修复：添加调试日志
    chatDebug('📤 [ChatLogic] 发送消息:', {
      消息内容: savedInputText,
      检测到的指标数量: detections.length,
      检测结果: detections
    });

    if (detections.length > 0) {
      // 🔥 先立即显示用户消息，不等待数据库保存
      const userMessageTime = new Date();
      const tempUserMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        clientId: makeClientId('client-user'),
        type: 'user',
        content: savedInputText,
        timestamp: formatChatTimestamp(userMessageTime),
        createdAt: userMessageTime.toISOString(), // 使用当前时间，确保排序正确
      };

      // 立即添加用户消息到本地状态，让用户看到自己的消息
      dispatch({ type: 'ADD_MESSAGE', payload: tempUserMessage });

      // 然后异步保存用户消息到数据库，获取真实ID（不阻塞UI）
      (async () => {
        try {
          if (user?.id) {
            const savedRecord = await addMessageMutation.mutateAsync({
              messageType: 'user',
              content: savedInputText,
            });
            
            // 更新临时消息的ID为数据库返回的真实ID
            dispatch({ 
              type: 'UPDATE_MESSAGE', 
              payload: { 
                id: tempUserMessage.id, 
                message: { 
                  id: savedRecord.id,
                  createdAt: savedRecord.created_at // 使用数据库的 created_at
                } 
              } 
            });
          }
        } catch (error) {
          chatWarn('Failed to save user message:', error);
          // 保存失败时保持临时ID，消息仍然显示
        }
      })();

      // Create quick entry cards for each detected metric
      const quickEntryMessages: ChatMessage[] = [];
      let timeOffset = 1;

      // 🔥 修复：添加调试日志
      chatDebug(`📋 [ChatLogic] 开始创建快捷卡片，检测到 ${detections.length} 个指标`);

      for (const detection of detections) {
        if (detection.detected && detection.data) {
          try {
            // Get daily count for this metric type
            const dailyCount = await dailyCounterService.getDailyCount(detection.data.metricType);
            
            // 🔥 修复：添加调试日志
            chatDebug(`📊 [ChatLogic] 创建快捷卡片:`, {
              类型: detection.data.metricType,
              数据: detection.data,
              每日计数: dailyCount
            });

            const now = new Date();
            const quickEntryMessage: ChatMessage = {
              id: `temp-quickEntry-${Date.now()}-${timeOffset}`, // 🔥 修复：使用temp-前缀，确保后续能正确更新ID
              clientId: makeClientId('client-quick'),
              type: 'quickEntry',
              content: '', // 🔥 修复：快捷卡片不需要内容，但可以添加一个提示文本
              timestamp: formatChatTimestamp(now),
              createdAt: now.toISOString(), // 临时消息也设置 createdAt 用于排序
              quickEntryData: {
                ...detection.data,
                dailyCount,
                dataSource: 'ai' as const, // 标识为AI创建
                isManuallyEdited: false,
                isSavedToDatabase: false,
                syncedToRecords: false
              },
              isQuickEntryConfirmed: false
            };

            quickEntryMessages.push(quickEntryMessage);
            timeOffset++;
          } catch (error) {
            console.error('❌ [ChatLogic] 创建快捷卡片时出错:', error);
          }
        }
      }

      // 🔥 修复：添加调试日志
      chatDebug(`✅ [ChatLogic] 共创建 ${quickEntryMessages.length} 个快捷卡片消息`);

      // Add all quick entry messages at once
      quickEntryMessages.forEach((msg, index) => {
        chatDebug(`➕ [ChatLogic] 添加快捷卡片消息 ${index + 1}/${quickEntryMessages.length}:`, msg.quickEntryData);
        dispatch({ type: 'ADD_MESSAGE', payload: msg });
      });

      // 先保存quickEntry消息到数据库，然后更新本地消息的ID
      // 🔥 修复：使用 Promise.all 并行保存，提高性能
      const savePromises = quickEntryMessages.map(async (msg, index) => {
        try {
          if (msg.quickEntryData && user?.id) {
            chatDebug(`💾 [ChatLogic] 保存快捷卡片 ${index + 1}/${quickEntryMessages.length} 到数据库...`);
            const savedRecord = await addMessageMutation.mutateAsync({
              messageType: 'quickEntry',
              content: '',
              quickEntryData: msg.quickEntryData,
              isQuickEntryConfirmed: false,
            });
            if (savedRecord) {
              chatDebug(`✅ [ChatLogic] 快捷卡片 ${index + 1} 保存成功，ID: ${savedRecord.id}`);
              // 更新消息ID为数据库返回的真实ID
              dispatch({ 
                type: 'UPDATE_MESSAGE', 
                payload: { 
                  id: msg.id, 
                  message: { 
                    id: savedRecord.id,
                    createdAt: savedRecord.created_at // 🔥 修复：同时更新 createdAt
                  } 
                } 
              });
            }
          }
        } catch (error) {
          console.error(`❌ [ChatLogic] 保存快捷卡片 ${index + 1} 失败:`, error);
          // 保存失败时保持临时ID，消息仍然显示
          // 不需要额外处理，临时ID已经以temp-开头
        }
      });
      
      // 🔥 修复：等待所有保存操作完成（但不阻塞UI）
      Promise.all(savePromises).then(() => {
        chatDebug(`✅ [ChatLogic] 所有快捷卡片保存操作完成`);
      }).catch(error => {
        console.error('❌ [ChatLogic] 部分快捷卡片保存失败:', error);
      });

      const distressInjected =
        (await runDistressBreathingInjectRef.current?.(savedInputText, tempUserMessage.createdAt)) ??
        false;

      const count = await loadTodayCardCount();
      dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: count });

      if (distressInjected) {
        if (requestSeq === aiRequestSeqRef.current) {
          dispatch({ type: 'SET_IS_SENDING_MESSAGE', payload: false });
        }
        return;
      }

      // Generate AI contextual response（传入解析后的结构化数据，让 AI 基于准确数据回复）
      dispatch({ type: 'SET_IS_SENDING_MESSAGE', payload: true });
      try {
        const parsedMetrics = detections
          .filter((d) => d.detected && d.data)
          .map((d) => {
            const data = d.data!;
            return {
              metricType: data.metricType,
              value: data.value,
              unit: data.unit,
              foodName: data.foodName,
              exerciseName: data.exerciseName,
              supplementName: data.supplementName,
              duration: data.duration,
              calories: data.calories,
              quantity: data.quantity,
              emotionType: data.emotionType,
              measurements: data.measurements,
            };
          });
        chatDebug('📤 [ChatLogic] Sending message to AI (with parsed metrics):', savedInputText, parsedMetrics);
        const baseMsgs = messagesRef.current.length > 0 ? messagesRef.current : state.messages;
        const chatAiContext = buildChatAiClientContext(
          [...baseMsgs, tempUserMessage, ...quickEntryMessages],
          {
            owner_display_name: ownerNameRef.current,
            profile_target_weight_kg: userProfileForAi?.target_weight ?? null,
            profile_current_weight_kg: userProfileForAi?.current_weight ?? null,
            ...chatPlanContextOpts,
            ...(homeDashboardSnapshotForAi
              ? { home_dashboard_snapshot: homeDashboardSnapshotForAi }
              : {}),
          },
        );
        const response = await apiClient.chatWithAI(
          savedInputText,
          state.conversationId,
          parsedMetrics,
          chatAiContext,
          aiSignal,
        );
        if (requestSeq !== aiRequestSeqRef.current || aiSignal.aborted) {
          return;
        }
        chatDebug('📥 [ChatLogic] AI response received (with health metrics):', response);

        // 🔥 检查响应是否有效
        if (!response || !response.response) {
          console.error('❌ [ChatLogic] Invalid AI response (with health metrics):', response);
          throw new Error('AI服务返回了无效的响应');
        }

        if (response.conversation_id) {
          dispatch({ type: 'SET_CONVERSATION_ID', payload: response.conversation_id });
        }

        // 🔥 先立即显示AI回复，确保时间戳晚于用户消息
        const aiResponseTime = getNextChronologicalDate([
          ...baseMsgs,
          tempUserMessage,
          ...quickEntryMessages,
        ]);
        const pendingAfterCurrent = getPendingQuickEntryMessages([
          ...baseMsgs,
          tempUserMessage,
          ...quickEntryMessages,
        ]).length;
        const safeAiResponse = sanitizeAiResponseForCardIntegrity(response.response, {
          parsedMetricsCount: parsedMetrics.length,
          pendingQuickEntryCount: pendingAfterCurrent,
          abilityContext: getLatestAbilityCardContext([...baseMsgs, tempUserMessage, ...quickEntryMessages]),
          userMessage: savedInputText,
        });

        const ext = response as { suggest_ability_card?: string };
        const skipServerBreathingSuggest =
          Date.now() - lastClientBreathingDistressInjectMsRef.current < 25_000;
        let serverAddedBreathingCard = false;
        if (ext.suggest_ability_card === 'breathing' && !skipServerBreathingSuggest) {
          const ymd = toBeijingDateString(new Date());
          const key = `breathing-ability-suggest-${ymd}`;
          let n = 0;
          try {
            n = Number(sessionStorage.getItem(key) || '0');
          } catch {
            /* ignore */
          }
          if (n < 2) {
            try {
              sessionStorage.setItem(key, String(n + 1));
            } catch {
              /* ignore */
            }
            addAbilityCardMessage(ABILITY_CARD_TRIGGER_LABEL.breathing, 'breathing', {
              chronologicalAfter: [tempUserMessage, ...quickEntryMessages].map((m) => ({
                createdAt: m.createdAt,
              })),
            });
            serverAddedBreathingCard = true;
          }
        }

        if (!serverAddedBreathingCard) {
          const tempAiResponse: ChatMessage = {
            id: `temp-ai-${Date.now() + timeOffset}`,
            clientId: makeClientId('client-ai'),
            type: 'ai',
            content: safeAiResponse,
            timestamp: formatChatTimestamp(aiResponseTime),
            createdAt: aiResponseTime.toISOString(),
          };

          chatDebug(
            '✅ [ChatLogic] Adding AI response to messages (with health metrics):',
            tempAiResponse.content.substring(0, 50),
          );
          dispatch({ type: 'ADD_MESSAGE', payload: tempAiResponse });

          (async () => {
            try {
              if (user?.id) {
                const savedRecord = await addMessageMutation.mutateAsync({
                  messageType: 'ai',
                  content: safeAiResponse,
                });

                dispatch({
                  type: 'UPDATE_MESSAGE',
                  payload: {
                    id: tempAiResponse.id,
                    message: {
                      id: savedRecord.id,
                      createdAt: savedRecord.created_at,
                    },
                  },
                });
              }
            } catch (error) {
              chatWarn('Failed to save AI response:', error);
            }
          })();
        } else {
          chatDebug('⏭️ [ChatLogic] 服务端建议呼吸便签：不展示大段 AI 回复');
        }
      } catch (error) {
        if (requestSeq !== aiRequestSeqRef.current) {
          return;
        }
        if (aiUserCancelledRef.current) {
          aiUserCancelledRef.current = false;
          return;
        }
        console.error('❌ [ChatLogic] Failed to get AI response (with health metrics):', error);
        
        // 获取详细的错误信息
        let errorMsg = error instanceof Error ? error.message : String(error);
        
        // 根据错误类型提供更友好的提示
        if (errorMsg.includes('网络连接失败') || errorMsg.includes('NetworkError')) {
          errorMsg = '网络连接失败，请检查网络设置后重试';
        } else if (errorMsg.includes('超时') || errorMsg.includes('timeout')) {
          errorMsg = '请求超时，AI服务响应较慢，请稍后重试';
        } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
          errorMsg = '认证失败，请重新登录';
        } else if (errorMsg.includes('500') || errorMsg.includes('Internal server error')) {
          errorMsg = 'AI服务暂时不可用，请稍后重试';
        } else if (errorMsg.includes('DeepSeek') || errorMsg.includes('API')) {
          errorMsg = 'AI服务配置错误，请联系技术支持';
        }
        
        // 显示错误消息
        let errorMessage: ChatMessage;
        const errorContent = createErrorMessage(state.ownerName).content;
        
        try {
          if (user?.id) {
            const savedRecord = await addMessageMutation.mutateAsync({
              messageType: 'ai',
              content: errorContent,
            });
            
            errorMessage = {
              id: savedRecord.id,
              type: 'ai',
              content: errorContent,
              timestamp: formatChatTimestamp(new Date(savedRecord.created_at)),
              createdAt: savedRecord.created_at // 使用数据库的 created_at 用于精确排序
            };
          } else {
            const now = new Date();
            errorMessage = {
              id: `temp-error-${Date.now()}`,
              type: 'ai',
              content: errorContent,
              timestamp: formatChatTimestamp(now),
              createdAt: now.toISOString() // 临时消息也设置 createdAt 用于排序
            };
          }
        } catch (dbError) {
          console.error('❌ [ChatLogic] Failed to save error message:', dbError);
          // 保存失败时仍然显示错误消息，使用临时ID
          const now = new Date();
          errorMessage = {
            id: `temp-error-${Date.now()}`,
            type: 'ai',
            content: errorContent,
            timestamp: formatChatTimestamp(now),
            createdAt: now.toISOString() // 临时消息也设置 createdAt 用于排序
          };
        }
        
        chatWarn('⚠️ [ChatLogic] Adding error message to chat (with health metrics):', errorMessage.content);
        dispatch({ type: 'ADD_MESSAGE', payload: errorMessage });
        
        // 显示错误提示（使用更友好的错误信息）
        dispatch({ type: 'SET_ALERT_MESSAGE', payload: `发送消息失败: ${errorMsg}` });
        dispatch({ type: 'SET_ALERT_TYPE', payload: 'error' });
        dispatch({ type: 'SET_SHOW_ALERT', payload: true });
      } finally {
        if (requestSeq === aiRequestSeqRef.current) {
          dispatch({ type: 'SET_IS_SENDING_MESSAGE', payload: false });
        }
      }

      return;
    }

    dispatch({ type: 'SET_IS_SENDING_MESSAGE', payload: true });

    // 🔥 先立即显示用户消息，不等待数据库保存
    const userMessageTime = new Date();
    const tempUserMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      clientId: makeClientId('client-user'),
      type: 'user',
      content: savedInputText,
      timestamp: formatChatTimestamp(userMessageTime),
      createdAt: userMessageTime.toISOString(), // 使用当前时间，确保排序正确
    };

    // 立即添加用户消息到本地状态，让用户看到自己的消息
    dispatch({ type: 'ADD_MESSAGE', payload: tempUserMessage });

    // 然后异步保存用户消息到数据库，获取真实ID（不阻塞UI）
    (async () => {
      try {
      if (user?.id) {
        const savedRecord = await addMessageMutation.mutateAsync({
          messageType: 'user',
          content: savedInputText,
        });
        // 更新临时消息的ID为数据库返回的真实ID
        dispatch({ 
          type: 'UPDATE_MESSAGE', 
          payload: { 
            id: tempUserMessage.id, 
            message: { 
              id: savedRecord.id,
              createdAt: savedRecord.created_at // 使用数据库的 created_at
            } 
          } 
        });
      }
    } catch (error) {
      chatWarn('Failed to save user message:', error);
      // 保存失败时保持临时ID，消息仍然显示
    }
    })();

    const distressInjectedPlain =
      (await runDistressBreathingInjectRef.current?.(savedInputText, tempUserMessage.createdAt)) ??
      false;
    if (distressInjectedPlain) {
      if (requestSeq === aiRequestSeqRef.current) {
        dispatch({ type: 'SET_IS_SENDING_MESSAGE', payload: false });
      }
      return;
    }

    try {
      // 调用后端 API
      chatDebug('📤 [ChatLogic] Sending message to AI:', savedInputText);
      const baseMsgsPlain = messagesRef.current.length > 0 ? messagesRef.current : state.messages;
      const chatAiContextPlain = buildChatAiClientContext([...baseMsgsPlain, tempUserMessage], {
        owner_display_name: ownerNameRef.current,
        profile_target_weight_kg: userProfileForAi?.target_weight ?? null,
        profile_current_weight_kg: userProfileForAi?.current_weight ?? null,
        ...chatPlanContextOpts,
        ...(homeDashboardSnapshotForAi
          ? { home_dashboard_snapshot: homeDashboardSnapshotForAi }
          : {}),
      });
      const response = await apiClient.chatWithAI(
        savedInputText,
        state.conversationId,
        undefined,
        chatAiContextPlain,
        aiSignal,
      );
      if (requestSeq !== aiRequestSeqRef.current || aiSignal.aborted) {
        return;
      }
      chatDebug('📥 [ChatLogic] AI response received:', response);

      // 🔥 检查响应是否有效
      if (!response || !response.response) {
        console.error('❌ [ChatLogic] Invalid AI response:', response);
        throw new Error('AI服务返回了无效的响应');
      }

      // 保存 conversation ID
      if (response.conversation_id) {
        dispatch({ type: 'SET_CONVERSATION_ID', payload: response.conversation_id });
      }

      // 🔥 先立即显示AI回复，确保时间戳晚于用户消息
      const aiResponseTime = getNextChronologicalDate([...baseMsgsPlain, tempUserMessage]);
      const pendingAfterCurrent = getPendingQuickEntryMessages([
        ...baseMsgsPlain,
        tempUserMessage,
      ]).length;
      const safeAiResponse = sanitizeAiResponseForCardIntegrity(response.response, {
        parsedMetricsCount: 0,
        pendingQuickEntryCount: pendingAfterCurrent,
        abilityContext: getLatestAbilityCardContext([...baseMsgsPlain, tempUserMessage]),
        userMessage: savedInputText,
      });

      const ext = response as { suggest_ability_card?: string };
      const skipServerBreathingSuggest =
        Date.now() - lastClientBreathingDistressInjectMsRef.current < 25_000;
      let serverAddedBreathingCard = false;
      if (ext.suggest_ability_card === 'breathing' && !skipServerBreathingSuggest) {
        const ymd = toBeijingDateString(new Date());
        const key = `breathing-ability-suggest-${ymd}`;
        let n = 0;
        try {
          n = Number(sessionStorage.getItem(key) || '0');
        } catch {
          /* ignore */
        }
        if (n < 2) {
          try {
            sessionStorage.setItem(key, String(n + 1));
          } catch {
            /* ignore */
          }
          addAbilityCardMessage(ABILITY_CARD_TRIGGER_LABEL.breathing, 'breathing', {
            chronologicalAfter: [{ createdAt: tempUserMessage.createdAt }],
          });
          serverAddedBreathingCard = true;
        }
      }

      if (!serverAddedBreathingCard) {
        const tempAiResponse: ChatMessage = {
          id: `temp-ai-${Date.now()}`,
          clientId: makeClientId('client-ai'),
          type: 'ai',
          content: safeAiResponse,
          timestamp: formatChatTimestamp(aiResponseTime),
          createdAt: aiResponseTime.toISOString(),
        };

        chatDebug('✅ [ChatLogic] Adding AI response to messages:', tempAiResponse.content.substring(0, 50));
        dispatch({ type: 'ADD_MESSAGE', payload: tempAiResponse });

        (async () => {
          try {
            if (user?.id) {
              const savedRecord = await addMessageMutation.mutateAsync({
                messageType: 'ai',
                content: safeAiResponse,
              });

              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  id: tempAiResponse.id,
                  message: {
                    id: savedRecord.id,
                    createdAt: savedRecord.created_at,
                  },
                },
              });
            }
          } catch (error) {
            chatWarn('Failed to save AI response:', error);
          }
        })();
      } else {
        chatDebug('⏭️ [ChatLogic] 服务端建议呼吸便签：不展示大段 AI 回复');
      }
    } catch (error) {
      if (requestSeq !== aiRequestSeqRef.current) {
        return;
      }
      if (aiUserCancelledRef.current) {
        aiUserCancelledRef.current = false;
        return;
      }
      console.error('❌ [ChatLogic] Failed to send message:', error);
      
      // 获取详细的错误信息
      let errorMsg = error instanceof Error ? error.message : String(error);
      
      // 根据错误类型提供更友好的提示
      if (errorMsg.includes('网络连接失败') || errorMsg.includes('NetworkError')) {
        errorMsg = '网络连接失败，请检查网络设置后重试';
      } else if (errorMsg.includes('超时') || errorMsg.includes('timeout')) {
        errorMsg = '请求超时，AI服务响应较慢，请稍后重试';
      } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        errorMsg = '认证失败，请重新登录';
      } else if (errorMsg.includes('500') || errorMsg.includes('Internal server error')) {
        errorMsg = 'AI服务暂时不可用，请稍后重试';
      } else if (errorMsg.includes('DeepSeek') || errorMsg.includes('API')) {
        errorMsg = 'AI服务配置错误，请联系技术支持';
      }

      // 显示错误消息
      let errorMessage: ChatMessage;
      const errorContent = createErrorMessage(state.ownerName).content;
      
      try {
        if (user?.id) {
          const savedRecord = await addMessageMutation.mutateAsync({
            messageType: 'ai',
            content: errorContent,
          });
          
          errorMessage = {
            id: savedRecord.id,
            type: 'ai',
            content: errorContent,
            timestamp: formatChatTimestamp(new Date(savedRecord.created_at)),
            createdAt: savedRecord.created_at // 使用数据库的 created_at 用于精确排序
          };
        } else {
          const now = new Date();
          errorMessage = {
            id: `temp-error-${Date.now()}`,
            type: 'ai',
            content: errorContent,
            timestamp: formatChatTimestamp(now),
            createdAt: now.toISOString() // 临时消息也设置 createdAt 用于排序
          };
        }
      } catch (dbError) {
        console.error('❌ [ChatLogic] Failed to save error message:', dbError);
        // 保存失败时仍然显示错误消息，使用临时ID
        const now = new Date();
        errorMessage = {
          id: `temp-error-${Date.now()}`,
          type: 'ai',
          content: errorContent,
          timestamp: formatChatTimestamp(now),
          createdAt: now.toISOString() // 临时消息也设置 createdAt 用于排序
        };
      }
      
      chatWarn('⚠️ [ChatLogic] Adding error message to chat:', errorMessage.content);
      dispatch({ type: 'ADD_MESSAGE', payload: errorMessage });
      
      // 显示错误提示（使用更友好的错误信息）
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: `发送消息失败: ${errorMsg}` });
      dispatch({ type: 'SET_ALERT_TYPE', payload: 'error' });
      dispatch({ type: 'SET_SHOW_ALERT', payload: true });
    } finally {
      if (requestSeq === aiRequestSeqRef.current) {
        dispatch({ type: 'SET_IS_SENDING_MESSAGE', payload: false });
      }
    }
  };

  const handleQuickEntryConfirmFromMessage = async (messageId: string, data: QuickEntryData) => {
    // Sync data to health records first；仅合法 chat_messages UUID 写入 health_records，避免 temp id 导致整单失败
    const safeChatId =
      sanitizeChatMessageIdForHealthRecord(messageId) ??
      sanitizeChatMessageIdForHealthRecord(data.chatMessageId);
    const dataWithSource = { ...data, chatMessageId: safeChatId };
    const syncSuccess = await quickEntrySyncService.syncCardToHealthRecords(dataWithSource);
    if (!syncSuccess) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: '同步健康记录失败，未确认该卡片，请重试' });
      dispatch({ type: 'SET_ALERT_TYPE', payload: 'error' });
      dispatch({ type: 'SET_SHOW_ALERT', payload: true });
      return;
    }

    // Update data with sync status（保留 chatMessageId 便于后续跨表关联）
    const updatedData = {
      ...dataWithSource,
      isSavedToDatabase: syncSuccess,
      syncedToRecords: syncSuccess,
      dataSource: data.dataSource || 'ai' as const
    };

    // Mark the quick entry message as confirmed in local state
    dispatch({ 
      type: 'UPDATE_MESSAGE', 
      payload: { 
        id: messageId, 
        message: { 
          isQuickEntryConfirmed: true, 
          quickEntryData: updatedData 
        } 
      } 
    });

    // Update the confirmation status in database
    try {
      await updateMessageMutation.mutateAsync({
        messageId,
        updates: {
          is_quick_entry_confirmed: true,
          quick_entry_data: updatedData,
        },
      });
    } catch (error) {
      console.error('Failed to update quick entry confirmation in database:', error);
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          id: messageId,
          message: {
            isQuickEntryConfirmed: false,
            quickEntryData: data,
          },
        },
      });
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: '确认状态写入失败，请稍后刷新重试' });
      dispatch({ type: 'SET_ALERT_TYPE', payload: 'error' });
      dispatch({ type: 'SET_SHOW_ALERT', payload: true });
      return;
    }

    // 刷新计数 + 聊天区绿色反馈（此前漏掉，确认后无提示）
    await handleQuickEntryConfirm(updatedData, user?.id);

    try {
      await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
      await addFeedbackMessage(
        `${state.aiName || DEFAULT_AI_COMPANION_NAME}已完成[${getQuickEntryLabelForFeedback(updatedData)}]记录，${state.ownerName || '主人'}加油！`,
      );
    } catch (e) {
      console.error('[handleQuickEntryConfirmFromMessage] 反馈消息失败:', e);
    }
  };

  const handleQuickEntryConfirm = async (data: QuickEntryData, uid?: string | null) => {
    try {
      // Data already synced by quickEntrySyncService in handleQuickEntryConfirmFromMessage
      chatDebug('Data synced successfully to health records');

      // Reload today's card count
      const count = await loadTodayCardCount();
      dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: count });

      if (uid) {
        await queryClient.invalidateQueries({ queryKey: ['dashboard-data', uid] });
        if (data.metricType === 'water') {
          await queryClient.refetchQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) && q.queryKey[0] === 'water-records' && q.queryKey[1] === uid,
          });
        }
      }

    } catch (error) {
      chatWarn('Failed to save quick entry:', error);
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: '保存失败，请重试' });
      dispatch({ type: 'SET_ALERT_TYPE', payload: 'error' });
      dispatch({ type: 'SET_SHOW_ALERT', payload: true });
    }
  };

  const handleQuickEntryDeleteFromMessage = async (messageId: string) => {
    const msg = state.messages.find((m) => m.id === messageId);
    const qd = msg?.quickEntryData;
    const metricType = qd?.metricType ?? 'food';
    const chatCard: QuickEntryAggregateCard = {
      id: messageId,
      metricType,
      data: qd ?? { metricType, value: 0 },
      isConfirmed: msg?.isQuickEntryConfirmed ?? false,
      createdAt: msg?.createdAt ? new Date(msg.createdAt) : new Date(),
      sourceType: 'chat',
      sourceId: messageId,
      timestamp: msg?.timestamp ?? '',
    };

    try {
      await quickEntryCardsService.removeAggregatedEntry(chatCard);
    } catch (error) {
      console.error('Failed to remove quick entry (message + linked health_records):', error);
      return;
    }

    dispatch({
      type: 'SET_MESSAGES',
      payload: state.messages.filter((m) => m.id !== messageId),
    });

    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', user.id] });
      queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', user.id] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', user.id] });
        queryClient.invalidateQueries({ queryKey: ['conversation-days', user.id] });
      }, 300);
    }

    try {
      const count = await loadTodayCardCount();
      dispatch({ type: 'SET_TODAY_CARD_COUNT', payload: count });

      await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
      const now = new Date();
      const cancelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '好的，已取消记录~',
        timestamp: formatChatTimestamp(now),
        createdAt: now.toISOString(),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: cancelMessage });

      if (user?.id) {
        await addMessageMutation.mutateAsync({
          messageType: 'ai',
          content: cancelMessage.content,
        });
      }
    } catch (error) {
      console.error('Failed to finish quick entry delete flow:', error);
    }
  };

  const handleQuickAction = async (action: string) => {
    if (state.isLoadingAnalysis) return;

    let userMessageText = action;

    if (action === '健康报告生成') {
      userMessageText = '健康报告生成';
    } else if (action === '血糖分析') {
      userMessageText = '血糖分析';
    } else if (action === '个性方案') {
      userMessageText = '个性方案';
    } else if (action === '配送时间') {
      userMessageText = '配送时间';
    }

    const now = new Date();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userMessageText,
      timestamp: formatChatTimestamp(now),
      createdAt: now.toISOString() // 临时消息也设置 createdAt 用于排序
    };

    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

    try {
      if (user?.id) {
        await addMessageMutation.mutateAsync({
          messageType: 'user',
          content: userMessageText,
        });
      }
    } catch (error) {
      chatWarn('Failed to save user quick action:', error);
    }

    // 配送时间：直接返回答案，无需 API
    if (action === '配送时间') {
      const lunchRange = getDeliveryMealTimeRange('lunch');
      const dinnerRange = getDeliveryMealTimeRange('dinner');
      const deliveryAnswer = `健康餐配送时间：午餐 ${lunchRange.start}-${lunchRange.end}，晚餐 ${dinnerRange.start}-${dinnerRange.end}。如需修改配送地址，请在配送前1小时完成。`;
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: deliveryAnswer,
        timestamp: formatChatTimestamp(new Date()),
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: aiResponse });
      try {
        if (user?.id) {
          await addMessageMutation.mutateAsync({
            messageType: 'ai',
            content: deliveryAnswer,
          });
        }
      } catch (e) {
        chatWarn('Failed to save delivery time message:', e);
      }
      return;
    }

    dispatch({ type: 'SET_IS_LOADING_ANALYSIS', payload: true });

    try {
      let analysisResult;

      if (action === '健康报告生成') {
        analysisResult = await apiClient.generateHealthReport();
      } else if (action === '血糖分析') {
        analysisResult = await apiClient.analyzeGlucose();
      } else if (action === '个性方案') {
        analysisResult = await apiClient.generatePersonalizedPlan();
      } else {
        throw new Error('Invalid action');
      }

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: analysisResult.analysis,
        timestamp: formatChatTimestamp(new Date()),
        createdAt: new Date().toISOString()
      };

      dispatch({ type: 'ADD_MESSAGE', payload: aiResponse });

      try {
        if (user?.id) {
          await addMessageMutation.mutateAsync({
            messageType: 'ai',
            content: analysisResult.analysis,
          });
        }
      } catch (error) {
        chatWarn('Failed to save AI analysis result:', error);
      }

      dispatch({ type: 'SET_IS_LOADING_ANALYSIS', payload: false });
    } catch (error) {
      console.error('Quick action analysis error:', error);

      const errorMessage = createErrorMessage(state.ownerName);
      dispatch({ type: 'ADD_MESSAGE', payload: errorMessage });

      // Save error message to database
      try {
        if (user?.id) {
          await addMessageMutation.mutateAsync({
            messageType: 'ai',
            content: errorMessage.content,
          });
        }
      } catch (dbError) {
        chatWarn('Failed to save error message:', dbError);
      }

      dispatch({ type: 'SET_IS_LOADING_ANALYSIS', payload: false });
    }
  };

  const handleLoadMoreMessages = async () => {
    if (state.isLoadingHistory || !hasNextPage) {
      return;
    }

    dispatch({ type: 'SET_IS_LOADING_HISTORY', payload: true });

    try {
      await fetchNextPage();
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      dispatch({ type: 'SET_IS_LOADING_HISTORY', payload: false });
    }
  };

  const handleCloseAlert = () => {
    dispatch({ type: 'SET_SHOW_ALERT', payload: false });
  };

  const showChatAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    dispatch({ type: 'SET_ALERT_MESSAGE', payload: message });
    dispatch({ type: 'SET_ALERT_TYPE', payload: type });
    dispatch({ type: 'SET_SHOW_ALERT', payload: true });
  };

  const addAIMessage = async (content: string, opts?: { minAfterUserMs?: number }) => {
    const refMs = getNextChronologicalDate(messagesRef.current).getTime();
    const floorMs = opts?.minAfterUserMs != null ? opts.minAfterUserMs + 1 : 0;
    const now = new Date(Math.max(refMs, Date.now(), floorMs));
    const tempId = `temp-ai-${Date.now()}`;
    const clientId = `client-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const msg: ChatMessage = {
      id: tempId,
      clientId,
      type: 'ai',
      content,
      timestamp: formatChatTimestamp(now),
      createdAt: now.toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: msg });
    if (user?.id) {
      try {
        const saved = await addMessageMutation.mutateAsync({
          messageType: 'ai',
          content,
        });
        const serverMs = new Date(saved.created_at).getTime();
        const createdAtIso =
          opts?.minAfterUserMs != null
            ? new Date(Math.max(serverMs, floorMs)).toISOString()
            : saved.created_at;
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: { id: tempId, message: { id: saved.id, createdAt: createdAtIso } },
        });
      } catch (e) {
        chatWarn('[addAIMessage] 保存失败:', e);
      }
    }
  };

  runDistressBreathingInjectRef.current = async (
    text: string,
    userMessageCreatedAt?: string,
  ): Promise<boolean> => {
    if (!shouldSuggestBreathingFromDistressText(text)) return false;
    const ymd = toBeijingDateString(new Date());
    const key = `breathing-distress-client-${ymd}`;
    let n = 0;
    try {
      n = Number(sessionStorage.getItem(key) || '0');
    } catch {
      /* ignore */
    }
    if (n >= 3) return false;
    try {
      sessionStorage.setItem(key, String(n + 1));
    } catch {
      /* ignore */
    }
    lastClientBreathingDistressInjectMsRef.current = Date.now();
    /** 仅插入便签消息（content=练习呼吸），不额外插入 AI 长文；引导在卡片内，练完后再走反馈气泡 */
    addAbilityCardMessage(
      ABILITY_CARD_TRIGGER_LABEL.breathing,
      'breathing',
      userMessageCreatedAt
        ? { chronologicalAfter: [{ createdAt: userMessageCreatedAt }] }
        : undefined,
    );
    return true;
  };

  /** 添加反馈通知消息（独立 UI：居中、绿色系、勾选图标，区别于普通对话气泡） */
  const addFeedbackMessage = useCallback(async (content: string) => {
    const now = getNextChronologicalDate(messagesRef.current);
    const tempId = `feedback-${Date.now()}`;
    const clientId = `client-feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const msg: ChatMessage = {
      id: tempId,
      clientId,
      type: 'feedback',
      content,
      timestamp: formatChatTimestamp(now),
      createdAt: now.toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: msg });
    if (user?.id) {
      try {
        const saved = await addMessageMutation.mutateAsync({
          messageType: 'feedback',
          content,
        });
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: { id: tempId, message: { id: saved.id, createdAt: saved.created_at } },
        });
      } catch (e) {
        chatWarn('[addFeedbackMessage] 保存失败:', e);
      }
    }
  }, [user?.id, addMessageMutation, dispatch]);

  const BREATHING_DONE_FEEDBACK =
    '你已完成一次呼吸练习记录，身体会慢慢松下来。想再练随时发送「练习呼吸」就好。';

  const flushPendingBreathingFeedback = useCallback(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem('pending-breathing-feedback');
    } catch {
      return;
    }
    if (!raw) return;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > 10 * 60 * 1000) {
      try {
        sessionStorage.removeItem('pending-breathing-feedback');
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.removeItem('pending-breathing-feedback');
    } catch {
      /* ignore */
    }
    void addFeedbackMessage(BREATHING_DONE_FEEDBACK);
  }, [addFeedbackMessage]);

  useEffect(() => {
    flushPendingBreathingFeedback();
    const onRecorded = () => {
      flushPendingBreathingFeedback();
    };
    window.addEventListener('breathingPracticeRecorded', onRecorded);
    return () => window.removeEventListener('breathingPracticeRecorded', onRecorded);
  }, [flushPendingBreathingFeedback]);

  // 配送计划配置成功后，统一补一条聊天绿色反馈，形成状态闭环
  useEffect(() => {
    const handler = () => {
      addFeedbackMessage('你已完成配送计划，开始你的健康减脂之旅吧！');
    };
    window.addEventListener('deliveryPlanConfiguredFeedback', handler);
    return () => {
      window.removeEventListener('deliveryPlanConfiguredFeedback', handler);
    };
  }, [addFeedbackMessage]);

  const setInputText = (text: string) => {
    dispatch({ type: 'SET_INPUT_TEXT', payload: text });
  };

  return {
    setInputText,
    handleSendMessage,
    addAbilityCardMessage,
    handleAbilityCardClose,
    handleQuickEntryConfirmFromMessage,
    handleQuickEntryDeleteFromMessage,
    handleQuickAction,
    handleLoadMoreMessages,
    handleCloseAlert,
    showChatAlert,
    addAIMessage,
    addFeedbackMessage,
    cancelAiGeneration,
  };
}

