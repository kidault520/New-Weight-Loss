/**
 * TopSummaryRow 上下文 - 共享展开状态与数据
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLatestMetricsQuery } from '../../hooks/useLatestMetricsQuery';
import { useExecutionProgram } from '../../hooks/useExecutionProgram';
import { useProfileBadges } from '../../hooks/useProfileBadges';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { getUserStorageItem, setUserStorageItem } from '../../utils/userStorage';
import { dashboardDataService } from '../../services/dashboardDataService';
import { toBeijingDateString } from '../../utils/dateUtils';
import { supplementStageService } from '../../services/supplementStageService';

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getStageName(percent: number): string {
  if (percent < 30) return '启动期';
  if (percent < 70) return '加速燃脂期';
  return '巩固期';
}

const STAGE_QUESTIONS: Record<string, [string, string, string]> = {
  启动期: ['如何科学控制每日热量摄入？', '减肥初期体重波动正常吗？', '启动期每天记录哪些指标最有效？'],
  加速燃脂期: ['低碳饮食要注意什么？', '平台期如何突破？', '运动后如何正确补充营养？'],
  巩固期: ['如何保持减重成果不反弹？', '维持体重的最佳饮食结构是？', '巩固期还需要继续记录吗？'],
  '阶段进度：待接入': ['如何科学控制每日热量摄入？', '减肥初期体重波动正常吗？', '每天记录哪些指标最有效？'],
};

/** 订单/配送状态对应的 AI 推荐问题（优先展示） */
const ACTION_PROMPTS: Record<string, string> = {
  pending_payment: '你有一笔订单待支付',
  paid_need_config: '你的一份订单服务尚未开启，请前往「我的」-「我的配送计划」配置',
};

/** 聊天区「实时数据」四宫格点击 → 先回健康档案再延迟打开详情 */
export type RealtimeMetricKind = 'weight' | 'blood_glucose' | 'calorie_deficit' | 'steps';

export interface TopSummaryRowContextValue {
  expanded: boolean;
  setExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  todoUpdatedAt: string;
  stageText: string;
  stageName: string;
  suggestedQuestions: [string, string, string];
  weight: string | null;
  bloodGlucose: string | null;
  calorieDeficit: number | null;
  steps: number | null;
  emotion: string | null;
  isMetricsLoading: boolean;
  handleQuestionClick: (q: string) => void;
  hasAskQuestion: boolean;
  handleToggleExpand: (e: React.MouseEvent) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  collapsibleRef: React.RefObject<HTMLDivElement | null>;
  onRealtimeCardClick?: (kind: RealtimeMetricKind) => void;
}

const TopSummaryRowContext = createContext<TopSummaryRowContextValue | null>(null);

export function useTopSummaryRow() {
  const ctx = useContext(TopSummaryRowContext);
  if (!ctx) throw new Error('useTopSummaryRow must be used within TopSummaryRowProvider');
  return ctx;
}

/** 可选版本：不在 Provider 内时返回 null */
export function useTopSummaryRowOptional() {
  return useContext(TopSummaryRowContext);
}

export interface TopSummaryRowProviderProps {
  onAskQuestion?: (question: string) => void;
  /** 点击实时数据四宫格：由 App 侧先切到健康档案再延迟打开详情 */
  onRealtimeCardClick?: (kind: RealtimeMetricKind) => void;
  children: React.ReactNode;
}

export function TopSummaryRowProvider({
  onAskQuestion,
  onRealtimeCardClick,
  children,
}: TopSummaryRowProviderProps) {
  const [expanded, setExpandedState] = useState(true);
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  // 按日存储：每天新进入默认展开；当日内保持用户操作后的状态
  const storageKey = useMemo(() => `my-health-expanded:${toBeijingDateString(new Date())}`, []);
  useEffect(() => {
    if (!isInitialLoadRef.current) return;
    isInitialLoadRef.current = false;
    getUserStorageItem<boolean>(storageKey).then((saved) => {
      if (saved === false || saved === true) {
        setExpandedState(saved);
      }
      // 无保存时保持默认 true（展开）
    });
  }, [storageKey]);

  const setExpanded = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setExpandedState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      setUserStorageItem(storageKey, next).catch(() => {});
      return next;
    });
  }, [storageKey]);
  const { weight, bloodGlucose, isLoading: isLoadingMetrics } = useLatestMetricsQuery();
  const isMetricsLoading = isLoadingMetrics;
  const { profile, intakePlanActive } = useUserProfile();
  const { user } = useAuth();
  const { currentDay, totalDays, isLoading: isLoadingProgram } = useExecutionProgram();
  const { userActionState } = useProfileBadges();
  const today = useMemo(() => new Date(), []);
  const todayKey = toBeijingDateString(today);

  const { data: dayData } = useQuery({
    queryKey: ['dashboard-data', todayKey, false, profile?.target_weight, profile?.daily_steps_goal],
    queryFn: () =>
      dashboardDataService.getDayData(today, {
        showTutorialData: false,
        targetWeight: profile?.target_weight || 60,
        userProfile: profile,
      }),
    staleTime: 60 * 1000,
  });

  const { data: supplementStage, isLoading: isLoadingSupplementStage } = useQuery({
    queryKey: ['active-supplement-stage', user?.id, todayKey],
    queryFn: () => supplementStageService.getActiveSupplementStage(),
    staleTime: 60 * 1000,
    enabled: !!user?.id && intakePlanActive,
  });

  const calorieDeficit = dayData?.calories?.remaining ?? null;
  const steps = dayData?.steps?.current ?? null;
  const emotion = dayData?.emotion?.current ?? null;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const progressPercent = useMemo(() => {
    if (!intakePlanActive) return 0;
    if (supplementStage?.has_plan && supplementStage.total_days && supplementStage.total_days > 0) {
      const cd = Math.max(0, supplementStage.current_day || 0);
      return Math.min(100, Math.max(0, Math.floor((cd / supplementStage.total_days) * 100)));
    }
    if (!totalDays || totalDays <= 0) return 0;
    return Math.min(100, Math.max(0, Math.floor((Math.max(0, currentDay) / totalDays) * 100)));
  }, [intakePlanActive, supplementStage, currentDay, totalDays]);

  const stageText = useMemo(() => {
    if (!intakePlanActive) return '完成配置后再查看';
    if (isLoadingSupplementStage && isLoadingProgram) return '阶段进度：待接入';
    if (supplementStage?.has_plan && supplementStage.total_days && supplementStage.total_days > 0) {
      const name = supplementStage.current_stage?.stage_name || '补剂阶段';
      return `${name} · 总进度${progressPercent}%`;
    }
    if (!totalDays) return '阶段进度：待接入';
    return `${getStageName(progressPercent)} · 总进度${progressPercent}%`;
  }, [
    intakePlanActive,
    supplementStage,
    isLoadingSupplementStage,
    isLoadingProgram,
    totalDays,
    progressPercent,
  ]);

  const stageName = useMemo(() => {
    if (!intakePlanActive) return '阶段进度：待接入';
    if (isLoadingSupplementStage && isLoadingProgram) return '阶段进度：待接入';
    if (supplementStage?.has_plan && supplementStage.current_stage?.stage_name) {
      return supplementStage.current_stage.stage_name;
    }
    if (!totalDays) return '阶段进度：待接入';
    return getStageName(progressPercent);
  }, [
    intakePlanActive,
    supplementStage,
    isLoadingSupplementStage,
    isLoadingProgram,
    totalDays,
    progressPercent,
  ]);

  // 实时数据更新时间：显示当前时间，每分钟刷新
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const todoUpdatedAt = formatTime(now);

  const suggestedQuestions = useMemo<[string, string, string]>(() => {
    const baseQuestions = STAGE_QUESTIONS[stageName] ?? STAGE_QUESTIONS['启动期'];
    const actionPrompt = ACTION_PROMPTS[userActionState];
    return actionPrompt
      ? [actionPrompt, baseQuestions[0], baseQuestions[1]]
      : baseQuestions;
  }, [stageName, userActionState]);

  const handleQuestionClick = useCallback((q: string) => onAskQuestion?.(q), [onAskQuestion]);
  const hasAskQuestion = !!onAskQuestion;

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  }, [setExpanded]);

  const value = useMemo(
    () => ({
      expanded,
      setExpanded,
      todoUpdatedAt,
      stageText,
      stageName,
      suggestedQuestions,
      weight: weight != null ? String(weight) : null,
      bloodGlucose: bloodGlucose != null ? String(bloodGlucose) : null,
      calorieDeficit,
      steps,
      emotion,
      isMetricsLoading,
      handleQuestionClick,
      hasAskQuestion,
      handleToggleExpand,
      scrollContainerRef,
      collapsibleRef,
      onRealtimeCardClick,
    }),
    [expanded, setExpanded, todoUpdatedAt, stageText, stageName, suggestedQuestions, weight, bloodGlucose, calorieDeficit, steps, emotion, isMetricsLoading, handleQuestionClick, hasAskQuestion, handleToggleExpand, onRealtimeCardClick]
  );

  return (
    <TopSummaryRowContext.Provider value={value}>
      {children}
    </TopSummaryRowContext.Provider>
  );
}
