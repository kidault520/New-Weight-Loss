 
/**
 * 日反馈卡片 - 固定内容（已摄入餐/补剂/数据）+ 待确认数据 + 实时通知待办
 * 固定内容始终展示，其它待办按现有方式正常展示
 *
 * 数据关系（勿与已删除的「执行报告」页混淆）：
 * - 本卡中的「今日待办 / 任务」列表：表 daily_execution_tasks，挂在当前用户的 execution_programs 上（useExecutionProgram + useDailyTasks）。
 * - execution_programs：订单同步来的疗程计划容器；不是「日反馈」全文，只是任务的父级。
 * - 已移除：SmartReportScreen / executionReportService；迁移已删除表 execution_reports（历史 AI 报告数据一并清除）。
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X, FileText, CheckCircle2, Circle, PlusCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useExecutionProgram } from '../../hooks/useExecutionProgram';
import { useDailyTasks } from '../../hooks/useDailyTasks';
import { useUpdateChatMessageMutation } from '../../hooks/useChatMessagesQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useChatContext } from '../../contexts/ChatContext';
import { getEmotionEmoji } from '../../utils/emotionEmoji';
import { useTodayQuickEntryCardsQuery } from '../../hooks/useTodayQuickEntryCardsQuery';
import { useDailyFeedbackFixed } from '../../hooks/useDailyFeedbackFixed';
import { quickEntryCardsService, type QuickEntryAggregateCard } from '../../services/quickEntryCardsService';
import { quickEntrySyncService } from '../../services/quickEntrySyncService';
import { useBeijingDateKey } from '../../hooks/useBeijingDateKey';
import { DEFAULT_AI_COMPANION_NAME } from '../../services/aiSettingsService';

export interface DailyReportCardProps {
  onClose: () => void;
}
const CARD_FEEDBACK_DELAY_MS = 2000;
/** 左滑露出的删除区宽度（px），需容纳「同时删除相应卡片」两行文案 */
const SWIPE_DELETE_REVEAL_PX = 132;
/** 累计左滑超过该距离视为「打开删除」（pointermove 累计，真机更稳） */
const SWIPE_OPEN_THRESHOLD = 36;
/** 已打开时累计右滑超过该距离视为关闭 */
const SWIPE_CLOSE_THRESHOLD = 28;

function getQuickEntryLabel(card: QuickEntryAggregateCard): string {
  const d = card.data;
  const label = quickEntryCardsService.getMetricTypeLabel(card.metricType);
  if (card.metricType === 'weight' && d?.value) return `体重 ${d.value}kg`;
  if (card.metricType === 'water' && d?.value) return `饮水`;
  if (card.metricType === 'food' && d?.foodName) return `餐食 ${d.foodName}`;
  if (card.metricType === 'sleep' && d?.value) return `睡眠`;
  if (card.metricType === 'emotion') {
    const emoji = getEmotionEmoji((card.data as any)?.emotionType);
    return emoji ? `情绪${emoji}` : '情绪';
  }
  if (card.metricType === 'exercise' && d?.exerciseName) return `运动 · ${d.exerciseName}`;
  if (card.metricType === 'breathing') {
    const name = (d as { breathingModeLabel?: string })?.breathingModeLabel || '呼吸练习';
    return `呼吸 · ${name}`;
  }
  return label;
}

/** 获取待确认数据的数值展示（8h, +440kcal, 1000ml, -120kcal 等） */
function getQuickEntryValue(card: QuickEntryAggregateCard): string | null {
  const d = card.data;
  if (card.metricType === 'sleep' && d?.value != null) return `${d.value}h`;
  if (card.metricType === 'food' && d?.calories != null) return `+${d.calories}kcal`;
  if (card.metricType === 'water' && d?.value != null) return `${d.value}ml`;
  if (card.metricType === 'exercise' && d?.calories != null) return `-${d.calories}kcal`;
  if (card.metricType === 'weight' && d?.value != null) return `${d.value}kg`;
  if (card.metricType === 'steps' && d?.value != null) return `${d.value}步`;
  if (card.metricType === 'blood_glucose' && d?.value != null) return `${d.value}mmol/L`;
  if (card.metricType === 'breathing' && d?.value != null) {
    const c = (d as { breathingCycles?: number }).breathingCycles ?? 0;
    return `${Math.round(Number(d.value))}秒 · ${c}周期`;
  }
  return null;
}

function getReadableErrorMessage(error: unknown): string {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error;
  const e = error as any;
  if (typeof e?.message === 'string' && e.message.trim()) return e.message;
  if (typeof e?.originalError?.message === 'string' && e.originalError.message.trim()) return e.originalError.message;
  if (typeof e?.error_description === 'string' && e.error_description.trim()) return e.error_description;
  if (typeof e?.details === 'string' && e.details.trim()) return e.details;
  if (typeof e?.hint === 'string' && e.hint.trim()) return e.hint;
  try {
    return JSON.stringify(e);
  } catch {
    return '未知错误';
  }
}

export default function DailyReportCard({ onClose }: DailyReportCardProps) {
  const { user } = useAuth();
  const beijingToday = useBeijingDateKey();
  const { addFeedbackMessage, addAIMessage, ownerName, aiName } = useChatContext();
  const queryClient = useQueryClient();
  const updateChatMessage = useUpdateChatMessageMutation();
  const { program } = useExecutionProgram();
  const { tasks, generateTasks, completeTask, refresh } = useDailyTasks(program?.id || null);
  const [confirmingCardId, setConfirmingCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  /** 当前左滑展开删除区的待确认卡片 id */
  const [swipeOpenCardId, setSwipeOpenCardId] = useState<string | null>(null);
  /** 删除二步确认：null = 未点「删除」；等于某 id 时表示该卡片按钮已变为「同时删除相应卡片」 */
  const [deleteSecondStepCardId, setDeleteSecondStepCardId] = useState<string | null>(null);
  /** 左滑手势：pointer capture + move 累计位移，避免仅靠 up 时坐标丢失 */
  const swipeGestureRef = useRef<{
    cardId: string;
    startX: number;
    minDelta: number;
    maxDelta: number;
    pointerId: number;
  } | null>(null);
  /** 当前展开删除区的整行容器（含红条），用于点击外部关闭 */
  const swipeOpenRowRef = useRef<HTMLDivElement | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [recordedDataExpanded, setRecordedDataExpanded] = useState(false);
  const [mealsExpanded, setMealsExpanded] = useState(false);
  const [supplementsExpanded, setSupplementsExpanded] = useState(false);
  const [generateSuccessMessage, setGenerateSuccessMessage] = useState<string | null>(null);
  const [recordDataCollapsedExpanded, setRecordDataCollapsedExpanded] = useState(false);
  const [todayTasksCollapsedExpanded, setTodayTasksCollapsedExpanded] = useState(false);
  const prevUnconfirmedCountRef = useRef<number>(-1);
  const prevTasksDoneCountRef = useRef<number>(-1);

  // 🔥 与今日数据统计、实时通知共用同一数据源，确保同步（必须在 useEffect 之前声明，避免 ReferenceError）
  const { data: quickEntryCards = [], isLoading: isLoadingCards } = useTodayQuickEntryCardsQuery();
  const { data: fixedContent } = useDailyFeedbackFixed(ownerName);

  // 列表变化时若当前展开行已不存在，收起删除区
  useEffect(() => {
    if (!swipeOpenCardId) return;
    if (!quickEntryCards.some((c) => c.id === swipeOpenCardId)) {
      setSwipeOpenCardId(null);
      setDeleteSecondStepCardId(null);
    }
  }, [quickEntryCards, swipeOpenCardId]);

  /** 点击/触碰到展开行以外区域时收起删除（捕获阶段，无弹窗） */
  useEffect(() => {
    if (!swipeOpenCardId) return;
    const closeIfOutside = (e: Event) => {
      const root = swipeOpenRowRef.current;
      if (!root) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (root.contains(target)) return;
      setSwipeOpenCardId(null);
      setDeleteSecondStepCardId(null);
    };
    document.addEventListener('pointerdown', closeIfOutside, true);
    document.addEventListener('touchstart', closeIfOutside, true);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside, true);
      document.removeEventListener('touchstart', closeIfOutside, true);
    };
  }, [swipeOpenCardId]);

  const unconfirmedCards = useMemo(() => quickEntryCards.filter((c) => !c.isConfirmed), [quickEntryCards]);
  const confirmedCards = useMemo(() => quickEntryCards.filter((c) => c.isConfirmed), [quickEntryCards]);
  const hasAnyContent = quickEntryCards.length > 0 || tasks.length > 0 || program?.id;

  /** 待确认数据：未完成在上、已完成在下，各自按时间升序 */
  const sortedQuickEntryCards = useMemo(() => {
    const toTs = (value: unknown): number => {
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'string' || typeof value === 'number') {
        const ts = new Date(value).getTime();
        return Number.isNaN(ts) ? 0 : ts;
      }
      return 0;
    };
    const unconf = [...unconfirmedCards].sort((a, b) => toTs((a as any).createdAt) - toTs((b as any).createdAt));
    const conf = [...confirmedCards].sort((a, b) => toTs((a as any).createdAt) - toTs((b as any).createdAt));
    return [...unconf, ...conf];
  }, [unconfirmedCards, confirmedCards]);

  const allowedTaskTypes = useMemo(() => new Set(['water', 'exercise', 'sleep', 'checkin']), []);
  const hasGeneratedDisplayTasks = useMemo(
    () => tasks.some((t) => allowedTaskTypes.has(t.task_type)),
    [tasks, allowedTaskTypes]
  );
  const displayTasks = useMemo(() => {
    if (!hasGeneratedDisplayTasks) return [];
    const filtered = tasks.filter((t) => allowedTaskTypes.has(t.task_type));
    const pickFirstByType = (type: string) =>
      filtered
        .filter((t) => t.task_type === type)
        .sort((a, b) => (a.scheduled_time || '99:99:99').localeCompare(b.scheduled_time || '99:99:99'))[0] || null;

    const waterTask = pickFirstByType('water');
    const exerciseTask = pickFirstByType('exercise');
    const sleepTask = pickFirstByType('sleep');
    const getCheckinSubtype = (t: { task_data?: unknown }) => {
      const d = typeof t.task_data === 'string' ? (() => { try { return JSON.parse(t.task_data); } catch { return {}; } })() : (t.task_data || {});
      return (d as { checkin_subtype?: string })?.checkin_subtype;
    };
    const checkinTasks = filtered
      .filter((t) => t.task_type === 'checkin')
      .sort((a, b) => (a.scheduled_time || '99:99:99').localeCompare(b.scheduled_time || '99:99:99'));
    const smileTask = checkinTasks.find((t) => getCheckinSubtype(t) === 'smile') || (checkinTasks.length === 1 ? checkinTasks[0] : null) || null;
    const breatheTask = checkinTasks.find((t) => getCheckinSubtype(t) === 'breathe') || (checkinTasks.length === 1 ? checkinTasks[0] : null) || null;

    const checkinRows = [
      { key: 'smile', label: '笑一笑', task: smileTask, fallbackTime: '20:00' },
      { key: 'breathe', label: '深呼吸', task: breatheTask, fallbackTime: '20:00' },
    ];

    const fixedRows = [
      { key: 'drink-water', label: '喝杯水', task: waterTask, fallbackTime: '09:00' },
      { key: 'move-body', label: '动一动', task: exerciseTask, fallbackTime: '18:00' },
      ...checkinRows,
      { key: 'sleep-well', label: '去睡个好觉', task: sleepTask, fallbackTime: '22:00' },
    ];

    return fixedRows.map((row) => {
      const timeStr = row.task?.scheduled_time ? row.task.scheduled_time.slice(0, 5) : row.fallbackTime;
      const done = row.task ? row.task.task_status === 'completed' : false;
      return {
        key: row.key,
        label: row.label,
        timeStr,
        done,
        taskId: row.task?.id || null,
      };
    });
  }, [tasks, hasGeneratedDisplayTasks, allowedTaskTypes]);

  /** 仅展示 3 条：未完成项按「喝水→…→睡眠」原顺序全部提前，再按需用已完成项补齐到 3 条，保证剩余待办始终出现在可视区 */
  const displayTasksPreview = useMemo(() => {
    const incomplete = displayTasks.filter((t) => !t.done);
    const complete = displayTasks.filter((t) => t.done);
    return [...incomplete, ...complete].slice(0, 3);
  }, [displayTasks]);

  // 全部确认/完成后自动折叠
  useEffect(() => {
    const prev = prevUnconfirmedCountRef.current;
    prevUnconfirmedCountRef.current = unconfirmedCards.length;
    if (prev > 0 && unconfirmedCards.length === 0) setRecordDataCollapsedExpanded(false);
  }, [unconfirmedCards.length]);
  useEffect(() => {
    const allDone = hasGeneratedDisplayTasks && displayTasks.length > 0 && displayTasks.every((t) => t.done);
    const prev = prevTasksDoneCountRef.current;
    if (allDone) {
      if (prev !== 1) setTodayTasksCollapsedExpanded(false);
      prevTasksDoneCountRef.current = 1;
    } else {
      prevTasksDoneCountRef.current = 0;
    }
  }, [hasGeneratedDisplayTasks, displayTasks]);

  const handleConfirmCard = async (card: QuickEntryAggregateCard) => {
    if (confirmingCardId) return;
    setConfirmingCardId(card.id);
    const label = getQuickEntryLabel(card);
    let success = false;
    try {
      const updatedData = {
        ...card.data,
        chatMessageId: card.sourceType === 'chat' ? card.sourceId ?? card.id : undefined,
      };
      const syncSuccess = await quickEntrySyncService.syncCardToHealthRecords(updatedData);
      const nextData = {
        ...updatedData,
        isSavedToDatabase: syncSuccess,
        syncedToRecords: syncSuccess,
        dataSource: updatedData?.dataSource || 'ai',
      };
      await quickEntryCardsService.updateQuickEntryCard(card.id, nextData);
      await updateChatMessage.mutateAsync({
        messageId: card.id,
        updates: { is_quick_entry_confirmed: true, quick_entry_data: nextData },
      });
      success = true;
      // 不要 await invalidate：会等待 refetch 结束，网络卡住时按钮会永远停在「确认中」
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', user.id] });
        void queryClient.invalidateQueries({ queryKey: ['chat-messages', user.id] });
        void queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', user.id] });
      }
    } catch (e) {
      console.error('[DailyReportCard] 确认失败:', e);
    } finally {
      setConfirmingCardId(null);
    }
    if (success) {
      try {
        await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
        await addFeedbackMessage(`${aiName || DEFAULT_AI_COMPANION_NAME}已完成[${label}]记录，${ownerName || '主人'}加油！`);
      } catch (e) {
        console.error('[DailyReportCard] 反馈消息失败:', e);
      }
    }
  };

  /** 与日反馈列表、聊天卡片、今日统计共用删除逻辑（先删 health_records 再删消息） */
  const handleDeleteQuickEntryCard = async (card: QuickEntryAggregateCard) => {
    if (deletingCardId || confirmingCardId) return;
    setDeletingCardId(card.id);
    try {
      await quickEntryCardsService.removeAggregatedEntry(card);
      setSwipeOpenCardId(null);
      setDeleteSecondStepCardId(null);
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', user.id] });
        await queryClient.invalidateQueries({ queryKey: ['chat-messages', user.id] });
        await queryClient.invalidateQueries({ queryKey: ['conversation-days', user.id] });
        await queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', user.id] });
      }
      await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
      await addFeedbackMessage(`${aiName || DEFAULT_AI_COMPANION_NAME}已撤回该条待确认记录。`);
    } catch (e) {
      console.error('[DailyReportCard] 删除待确认失败:', e);
    } finally {
      setDeletingCardId(null);
    }
  };

  const endSwipeGesture = (el: HTMLElement, pointerId: number) => {
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      /* 未 capture 时忽略 */
    }
    swipeGestureRef.current = null;
  };

  const handleSwipeRowPointerDown = (card: QuickEntryAggregateCard, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, [role="button"]')) {
      return;
    }
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* 部分环境不支持 */
    }
    swipeGestureRef.current = {
      cardId: card.id,
      startX: e.clientX,
      minDelta: 0,
      maxDelta: 0,
      pointerId: e.pointerId,
    };
  };

  const handleSwipeRowPointerMove = (card: QuickEntryAggregateCard, e: React.PointerEvent<HTMLDivElement>) => {
    const g = swipeGestureRef.current;
    if (!g || g.cardId !== card.id || g.pointerId !== e.pointerId) return;
    const d = e.clientX - g.startX;
    if (d < g.minDelta) g.minDelta = d;
    if (d > g.maxDelta) g.maxDelta = d;
  };

  const handleSwipeRowPointerUp = (card: QuickEntryAggregateCard, e: React.PointerEvent<HTMLDivElement>) => {
    const g = swipeGestureRef.current;
    if (!g || g.cardId !== card.id || g.pointerId !== e.pointerId) return;
    const el = e.currentTarget;
    endSwipeGesture(el, e.pointerId);

    const isOpen = swipeOpenCardId === card.id;
    const finalDelta = e.clientX - g.startX;

    if (isOpen) {
      const closeAmount = Math.max(g.maxDelta, finalDelta);
      if (closeAmount > SWIPE_CLOSE_THRESHOLD) {
        setSwipeOpenCardId(null);
        setDeleteSecondStepCardId(null);
      }
      return;
    }
    const openAmount = Math.min(g.minDelta, finalDelta);
    if (openAmount < -SWIPE_OPEN_THRESHOLD) {
      setSwipeOpenCardId(card.id);
      setDeleteSecondStepCardId(null);
    }
  };

  const handleSwipeRowPointerCancel = (card: QuickEntryAggregateCard, e: React.PointerEvent<HTMLDivElement>) => {
    const g = swipeGestureRef.current;
    if (!g || g.cardId !== card.id || g.pointerId !== e.pointerId) return;
    endSwipeGesture(e.currentTarget, g.pointerId);
  };

  const handleDeleteZoneClick = (card: QuickEntryAggregateCard) => {
    if (deletingCardId || confirmingCardId) return;
    if (deleteSecondStepCardId !== card.id) {
      setDeleteSecondStepCardId(card.id);
      return;
    }
    void handleDeleteQuickEntryCard(card);
  };

  const handleGenerateTasks = async () => {
    if (!program?.id || isGeneratingTasks) return;
    setIsGeneratingTasks(true);
    setGenerateSuccessMessage(null);
    try {
      const today = beijingToday;
      const result = await generateTasks({ taskDate: today });
      await refresh();
      await queryClient.refetchQueries({ queryKey: ['daily-tasks', program.id, today], exact: true });
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: ['daily-tasks', program.id, today] });
      }
      const generatedCount = Array.isArray(result)
        ? result.filter((t: any) => allowedTaskTypes.has(String(t?.task_type || ''))).length
        : 0;
      setGenerateSuccessMessage(generatedCount > 0 ? `已生成 ${generatedCount} 项任务` : '已生成今日任务');
      setTimeout(() => setGenerateSuccessMessage(null), 3000);
    } catch (e) {
      console.error('[DailyReportCard] 生成任务失败:', e);
      const detail = getReadableErrorMessage(e);
      setGenerateSuccessMessage(detail ? `生成失败：${detail}` : '生成失败，请重试');
      setTimeout(() => setGenerateSuccessMessage(null), 8000);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const getTaskFollowupQuestion = (taskKey: string): string | null => {
    const name = ownerName || '你';
    if (taskKey === 'drink-water') {
      return `${name}刚刚喝了多少 ml 水呀？我帮你记录到饮水数据里。`;
    }
    if (taskKey === 'move-body') {
      return `${name}刚刚做了什么运动？大概持续了多久？我来帮你生成运动记录。`;
    }
    if (taskKey === 'smile') {
      return `${name}现在的心情如何？可以告诉我一个情绪关键词，我帮你记录情绪卡片。`;
    }
    if (taskKey === 'breathe') {
      return `${name}这次深呼吸大概做了几分钟？现在感觉更放松了吗？`;
    }
    if (taskKey === 'sleep-well') {
      return `${name}计划几点入睡、几点起床？我可以先帮你创建一条睡眠记录草稿。`;
    }
    return null;
  };

  const handleCompleteTask = async (taskId: string, label: string, taskKey: string) => {
    if (completingTaskId) return;
    setCompletingTaskId(taskId);
    try {
      await completeTask({ taskId });
      await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
      await addFeedbackMessage(`${aiName || DEFAULT_AI_COMPANION_NAME}已完成[${label}]记录，${ownerName || '主人'}加油！`);
      const followupQuestion = getTaskFollowupQuestion(taskKey);
      if (followupQuestion) {
        await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
        await addAIMessage(followupQuestion);
      }
    } catch (e) {
      console.error('[DailyReportCard] 完成任务失败:', e);
      await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
      await addFeedbackMessage('任务完成失败，请重试。');
    } finally {
      setCompletingTaskId(null);
    }
  };

  // 仅以待确认数据加载为准，不阻塞于 program/tasks，确保实时通知的待办能及时显示
  const isLoading = isLoadingCards;

  const renderTodayCompletionSection = (wrapperClassName?: string) => {
    if (!fixedContent) {
      return (
        <div className={wrapperClassName}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-black">今日完成</span>
          </div>
          <div className="py-2 text-sm text-gray-500">加载中...</div>
        </div>
      );
    }
    const items = [
      { done: fixedContent.mealsCount > 0, label: '已摄入餐', value: fixedContent.mealsCount === 0 ? '0餐' : fixedContent.mealsLabel.replace(/^已摄入 /, ''), expandKey: 'meals' as const },
      { done: fixedContent.supplementCount > 0, label: '已摄入补剂', value: `×${fixedContent.supplementCount}`, expandKey: 'supplements' as const },
      { done: fixedContent.recordedDataTotalCount > 0, label: '已记录数据', value: `${fixedContent.recordedDataTotalCount}条`, expandKey: 'recorded' as const },
    ];

    return (
      <div className={wrapperClassName}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-black">今日完成</span>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx}>
              <div
                className={`flex items-center gap-2 py-2 px-2 rounded-lg ${item.done ? 'bg-gray-50 border border-gray-100' : 'bg-gray-50/50 border border-dashed border-gray-200'}`}
              >
                <div className="shrink-0">
                  {item.done ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs text-gray-400 tabular-nums shrink-0">—</span>
                  <span className="text-sm text-gray-800 font-medium">{item.label}</span>
                </div>
                {item.value && <span className="shrink-0 text-sm font-bold tabular-nums text-blue-600">{item.value}</span>}
                {item.expandKey && (
                  <button
                    onClick={() =>
                      item.expandKey === 'meals'
                        ? setMealsExpanded((v) => !v)
                        : item.expandKey === 'supplements'
                          ? setSupplementsExpanded((v) => !v)
                          : setRecordedDataExpanded((v) => !v)
                    }
                    className="shrink-0 p-1 rounded hover:bg-gray-200/80 text-gray-500"
                    aria-label="展开"
                  >
                    {(item.expandKey === 'meals' ? mealsExpanded : item.expandKey === 'supplements' ? supplementsExpanded : recordedDataExpanded) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              {item.expandKey === 'meals' && mealsExpanded && (
                <div className="ml-7 mt-1 pl-2 py-2 space-y-1.5 border-l-2 border-gray-200">
                  {fixedContent.mealsByType.map((m) => (
                    <div key={m.mealType} className="text-xs text-gray-500 flex items-center gap-1.5">
                      {m.done ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      {m.label}
                      <span className="text-gray-400">{m.calories}Kcal</span>
                    </div>
                  ))}
                </div>
              )}
              {item.expandKey === 'supplements' && supplementsExpanded && (
                <div className="ml-7 mt-1 pl-2 py-2 space-y-1.5 border-l-2 border-gray-200">
                  {fixedContent.supplementsByType.map((s) => (
                    <div key={s.id} className="text-xs text-gray-500 flex items-center gap-1.5">
                      {s.done ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
              {item.expandKey === 'recorded' && recordedDataExpanded && (
                <div className="ml-7 mt-1 pl-2 py-2 space-y-1.5 border-l-2 border-gray-200">
                  {fixedContent.recordedDataTotalCount === 0 ? (
                    /* 无数据：展示结构（3条） */
                    (fixedContent.recordedDataStructural || []).map((structItem) => (
                      <div key={structItem.key} className="text-xs text-gray-500 flex items-center gap-1.5">
                        {structItem.done ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        <span className="flex-1">{structItem.label}</span>
                      </div>
                    ))
                  ) : (
                    /* 有数据：直接展示明细，无二级折叠 */
                    (fixedContent.recordedDataDetails || []).map((detailItem) => (
                      <div key={detailItem.key} className="text-xs text-gray-500 flex items-center gap-1.5">
                        {detailItem.done ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        {detailItem.label}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-3 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900">日反馈</span>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200/80" aria-label="关闭">
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      <div className="px-3 py-3">
        {!hasAnyContent && !isLoading ? (
          <div className="py-4 px-3 space-y-3">
            {renderTodayCompletionSection('mb-3')}
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              今日暂无执行计划
            </p>
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              完成配置配送计划后，或绑定完设备，与 AI 聊天记录体重、餐食、睡眠、情绪等健康数据后，即可在此查看。
            </p>
          </div>
        ) : isLoading ? (
          <p className="text-sm text-gray-500 py-4 text-center">加载中...</p>
        ) : (
          <div className="space-y-4">
            {/* 固定内容：与待确认数据同布局 */}
            {renderTodayCompletionSection()}

            {/* 待确认数据：全部确认后折叠；有新待办时自动展开；点击折叠项可展开 */}
            {quickEntryCards.length > 0 && (
              <div>
                {(unconfirmedCards.length > 0 || recordDataCollapsedExpanded) ? (
                  <>
                    <div
                      className={`flex items-center justify-between mb-2 ${unconfirmedCards.length === 0 ? 'cursor-pointer' : ''}`}
                      onClick={unconfirmedCards.length === 0 ? () => setRecordDataCollapsedExpanded(false) : undefined}
                      onKeyDown={unconfirmedCards.length === 0 ? (e) => e.key === 'Enter' && setRecordDataCollapsedExpanded(false) : undefined}
                      role={unconfirmedCards.length === 0 ? 'button' : undefined}
                      tabIndex={unconfirmedCards.length === 0 ? 0 : undefined}
                    >
                      <span className="text-sm font-bold text-black">待确认数据</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        {confirmedCards.length}/{quickEntryCards.length} 已确认
                        {unconfirmedCards.length === 0 && (
                          <ChevronUp className="w-4 h-4" aria-hidden />
                        )}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {sortedQuickEntryCards.slice(0, 3).map((card) => {
                    const isConfirmed = card.isConfirmed;
                    const label = getQuickEntryLabel(card);
                    const valueStr = getQuickEntryValue(card);
                    const timeStr = card.timestamp || '';
                    const isCalorieType = card.metricType === 'food' || card.metricType === 'exercise';
                    /** 左滑展开删除区时隐藏「确认」，避免与红色删除条叠在一起 */
                    const deleteSwipeOpen = !isConfirmed && swipeOpenCardId === card.id;

                    const rowInner = (
                      <>
                        <div className="shrink-0">
                          {isConfirmed ? (
                            <CheckCircle2 className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {timeStr && <span className="text-xs text-gray-400 tabular-nums shrink-0">{timeStr}</span>}
                          <span className={`text-sm ${isConfirmed ? 'text-gray-500 line-through' : 'text-gray-800 font-medium'}`}>
                            {label}
                          </span>
                        </div>
                        {valueStr && (
                          <span
                            className={`shrink-0 text-sm font-bold tabular-nums ${
                              isCalorieType && valueStr.startsWith('+')
                                ? 'text-orange-500'
                                : isCalorieType && valueStr.startsWith('-')
                                  ? 'text-orange-500'
                                  : 'text-blue-600'
                            }`}
                          >
                            {valueStr}
                          </span>
                        )}
                        {!isConfirmed && !deleteSwipeOpen && (
                          <button
                            type="button"
                            onClick={() => handleConfirmCard(card)}
                            disabled={confirmingCardId === card.id || deletingCardId === card.id}
                            className="shrink-0 inline-flex min-w-[2.75rem] items-center justify-center px-2.5 py-1 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 disabled:opacity-50"
                            aria-busy={confirmingCardId === card.id}
                            aria-label={confirmingCardId === card.id ? '确认中' : '确认'}
                          >
                            {confirmingCardId === card.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              '确认'
                            )}
                          </button>
                        )}
                      </>
                    );

                    if (isConfirmed) {
                      return (
                        <div
                          key={card.id}
                          className="flex items-center gap-2 py-2 px-2 rounded-lg bg-gray-50 border border-gray-100"
                        >
                          {rowInner}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={card.id}
                        ref={swipeOpenCardId === card.id ? swipeOpenRowRef : undefined}
                        className="relative overflow-hidden rounded-lg"
                      >
                        <div
                          className="absolute right-0 top-0 bottom-0 z-0 flex items-stretch justify-end bg-red-600"
                          style={{ width: SWIPE_DELETE_REVEAL_PX }}
                          aria-hidden={swipeOpenCardId !== card.id}
                        >
                          <button
                            type="button"
                            className="flex h-full w-full items-center justify-center px-1.5 text-[11px] font-medium text-white text-center leading-snug bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors border-0"
                            tabIndex={swipeOpenCardId === card.id ? 0 : -1}
                            disabled={
                              swipeOpenCardId !== card.id ||
                              deletingCardId === card.id ||
                              confirmingCardId === card.id
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteZoneClick(card);
                            }}
                          >
                            {deleteSecondStepCardId === card.id ? '同时删除相应卡片' : '删除'}
                          </button>
                        </div>
                        <div
                          className="relative z-[1] flex w-full min-w-0 select-none items-center gap-2 py-2 px-2 rounded-lg bg-gray-50 border border-dashed border-gray-200 transition-transform duration-200 ease-out"
                          style={{
                            touchAction: 'none',
                            transform:
                              swipeOpenCardId === card.id
                                ? `translateX(-${SWIPE_DELETE_REVEAL_PX}px)`
                                : 'translateX(0)',
                          }}
                          title="向左滑动显示删除；点空白处或右滑收回"
                          onPointerDown={(e) => handleSwipeRowPointerDown(card, e)}
                          onPointerMove={(e) => handleSwipeRowPointerMove(card, e)}
                          onPointerUp={(e) => handleSwipeRowPointerUp(card, e)}
                          onPointerCancel={(e) => handleSwipeRowPointerCancel(card, e)}
                        >
                          {rowInner}
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-2 px-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/80 cursor-pointer text-left transition-colors"
                    onClick={() => setRecordDataCollapsedExpanded(true)}
                  >
                    <span className="text-sm font-bold text-black">待确认数据</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      {confirmedCards.length}/{quickEntryCards.length} 已全部确认
                      <ChevronDown className="w-4 h-4" aria-hidden />
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* 今日任务：全部完成后折叠；未生成时展示「生成今日任务」按钮；点击折叠项可展开 */}
            {program?.id && (
              <div>
                {!hasGeneratedDisplayTasks || displayTasks.some((t) => !t.done) || todayTasksCollapsedExpanded ? (
                  <>
                    <div
                      className={`flex items-center justify-between gap-2 mb-2 ${hasGeneratedDisplayTasks && displayTasks.every((t) => t.done) ? 'cursor-pointer' : ''}`}
                      onClick={hasGeneratedDisplayTasks && displayTasks.every((t) => t.done) ? () => setTodayTasksCollapsedExpanded(false) : undefined}
                      onKeyDown={hasGeneratedDisplayTasks && displayTasks.every((t) => t.done) ? (e) => e.key === 'Enter' && setTodayTasksCollapsedExpanded(false) : undefined}
                      role={hasGeneratedDisplayTasks && displayTasks.every((t) => t.done) ? 'button' : undefined}
                      tabIndex={hasGeneratedDisplayTasks && displayTasks.every((t) => t.done) ? 0 : undefined}
                    >
                      <span className="text-sm font-bold text-black shrink-0">今日任务</span>
                      {!hasGeneratedDisplayTasks ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleGenerateTasks();
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          disabled={isGeneratingTasks}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 disabled:opacity-50"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          {isGeneratingTasks ? '生成中…' : '生成'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                          {displayTasks.filter((t) => t.done).length}/{displayTasks.length} 已确认
                          {displayTasks.every((t) => t.done) && (
                            <ChevronUp className="w-4 h-4" aria-hidden />
                          )}
                        </span>
                      )}
                    </div>
                    {!hasGeneratedDisplayTasks && generateSuccessMessage ? (
                      <p
                        className={`mb-2 text-xs ${generateSuccessMessage.includes('失败') ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {generateSuccessMessage}
                      </p>
                    ) : null}
                    {hasGeneratedDisplayTasks ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {displayTasksPreview.map((t) => {
                      return (
                        <div
                          key={t.key}
                          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm ${
                            t.done
                              ? 'bg-gray-50 border border-gray-100 text-gray-500'
                              : 'bg-gray-50/50 border border-dashed border-gray-200 text-gray-800'
                          }`}
                        >
                          {t.done ? (
                            <CheckCircle2 className="w-5 h-5 text-gray-400 shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <span className="text-xs text-gray-400 tabular-nums w-10 shrink-0">{t.timeStr}</span>
                          <span className={`flex-1 text-sm font-medium ${t.done ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                            {t.label}
                          </span>
                          {!t.done && t.taskId && (
                            <button
                              type="button"
                              onClick={() => handleCompleteTask(t.taskId as string, t.label, t.key)}
                              disabled={completingTaskId === t.taskId}
                              className="shrink-0 px-2 py-1 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 focus-visible:ring-offset-1"
                            >
                              {completingTaskId === t.taskId ? '处理中...' : '完成'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-2 px-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/80 cursor-pointer text-left transition-colors"
                    onClick={() => setTodayTasksCollapsedExpanded(true)}
                  >
                    <span className="text-sm font-bold text-black">今日任务</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      {displayTasks.filter((t) => t.done).length}/{displayTasks.length} 已全部完成
                      <ChevronDown className="w-4 h-4" aria-hidden />
                    </span>
                  </button>
                )}
              </div>
            )}
            {quickEntryCards.length === 0 && tasks.length === 0 && !program?.id && (
              <p className="text-sm text-gray-500 py-2 text-center">暂无待确认数据或待办</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
