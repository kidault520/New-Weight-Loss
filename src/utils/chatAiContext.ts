import type { ChatMessage } from '../contexts/ChatContext';
import type { QuickEntryData } from '../components/QuickEntryCard';

/**
 * 随 ai-chat 请求传递的客户端上下文（不替代 parsed_metrics，仅辅助指代/催促场景）
 */
export interface ChatAiClientContext {
  /** 当前对话列表中未确认快捷卡片条数 */
  pending_quick_entry_count: number;
  /** 最近一条快捷卡片上的指标摘要，供「刚才那杯」等指代 */
  last_card_metric_hint?: {
    metric_type: string;
    summary: string;
  };
  /**
   * 用户在本机 AI 伙伴页设置的「称呼我为」，与 Edge 档案合并；非空时优先于服务端解析，避免 DB/解析延迟仍显示 owner
   */
  owner_display_name?: string;
  /**
   * 目标/当前体重（kg）。Edge 侧以 user_profiles 为准，本字段仅在库中无对应列时兜底，勿依赖其覆盖数据库。
   */
  profile_target_weight_kg?: number | null;
  /** 当前体重（kg），同上，服务端优先读库 */
  profile_current_weight_kg?: number | null;
  /**
   * 摄入托管「计划开启中」：配送计划已在档案中配置完成（与 user_profiles.meal_plan_configured 口径一致）。
   * Edge 仍以服务端 profile 为准；此字段用于对齐客户端展示与提示。
   */
  intake_plan_active?: boolean;
  /** 计划首日 YYYY-MM-DD（北京日历），便于模型计算「第几天」 */
  intake_plan_start_date_ymd?: string | null;
  /**
   * 与首页顶栏同源：dashboardDataService.getDayData，remaining = 摄入 − 运动(含步数折算) − BMR（与「饮食&运动」卡片 net 一致）
   */
  home_dashboard_snapshot?: {
    beijing_date_ymd: string;
    calorie_deficit_kcal: number | null;
    calories_target_kcal?: number | null;
    calories_food_intake_kcal?: number | null;
    calories_exercise_burned_kcal?: number | null;
    steps_current?: number | null;
    steps_target?: number | null;
  };
}

function formatQuickEntrySummary(data: QuickEntryData): string {
  switch (data.metricType) {
    case 'food':
      return data.foodName
        ? `饮食「${data.foodName}」${data.calories != null ? ` 约${Math.round(data.calories)}千卡` : ''}`
        : '饮食记录';
    case 'water':
      return `饮水约 ${data.value}ml`;
    case 'exercise':
      return data.exerciseName
        ? `运动「${data.exerciseName}」${data.duration != null ? `${data.duration}分钟` : ''}`
        : '运动';
    case 'weight':
      return `体重 ${data.value}kg`;
    case 'sleep':
      return `睡眠 ${data.value}小时`;
    case 'steps':
      return `步数 ${data.value}步`;
    case 'blood_glucose':
      return `血糖 ${data.value}${data.unit || 'mmol/L'}`;
    case 'supplement':
      return data.supplementName ? `补剂「${data.supplementName}」` : '补剂';
    case 'emotion':
      return '情绪记录';
    case 'measurements':
      return '身体围度';
    default:
      return '健康记录';
  }
}

/**
 * 基于当前内存中的消息列表构造 ai-chat 客户端上下文（发送前调用，需包含本轮已追加的用户消息与待确认卡片）
 */
export function buildChatAiClientContext(
  messages: ChatMessage[],
  options?: {
    owner_display_name?: string;
    profile_target_weight_kg?: number | null;
    profile_current_weight_kg?: number | null;
    intake_plan_active?: boolean;
    intake_plan_start_date_ymd?: string | null;
    home_dashboard_snapshot?: ChatAiClientContext['home_dashboard_snapshot'];
  },
): ChatAiClientContext {
  const pending_quick_entry_count = messages.filter(
    (m) => m.type === 'quickEntry' && !m.isQuickEntryConfirmed
  ).length;

  const owner_display_name =
    typeof options?.owner_display_name === 'string' ? options.owner_display_name.trim() : '';
  const normalizedOwnerName =
    owner_display_name && owner_display_name.toLowerCase() !== 'owner' ? owner_display_name : '';

  const tw =
    typeof options?.profile_target_weight_kg === 'number' &&
    Number.isFinite(options.profile_target_weight_kg) &&
    options.profile_target_weight_kg > 0 &&
    options.profile_target_weight_kg < 500
      ? options.profile_target_weight_kg
      : undefined;
  const cw =
    typeof options?.profile_current_weight_kg === 'number' &&
    Number.isFinite(options.profile_current_weight_kg) &&
    options.profile_current_weight_kg > 0 &&
    options.profile_current_weight_kg < 500
      ? options.profile_current_weight_kg
      : undefined;

  const planExtras: Partial<ChatAiClientContext> = {};
  if (typeof options?.intake_plan_active === 'boolean') {
    planExtras.intake_plan_active = options.intake_plan_active;
  }
  if (options?.intake_plan_start_date_ymd != null && options.intake_plan_start_date_ymd !== '') {
    planExtras.intake_plan_start_date_ymd = options.intake_plan_start_date_ymd;
  }

  const snap = options?.home_dashboard_snapshot;
  const snapshotExtras: Pick<ChatAiClientContext, 'home_dashboard_snapshot'> = {};
  if (
    snap &&
    typeof snap.beijing_date_ymd === 'string' &&
    snap.beijing_date_ymd.length >= 8
  ) {
    snapshotExtras.home_dashboard_snapshot = snap;
  }

  const quickEntries = messages.filter((m) => m.type === 'quickEntry' && m.quickEntryData);
  const lastCard = quickEntries[quickEntries.length - 1];
  if (!lastCard?.quickEntryData) {
    const base: ChatAiClientContext = {
      pending_quick_entry_count,
      ...planExtras,
      ...snapshotExtras,
    };
    if (normalizedOwnerName) base.owner_display_name = normalizedOwnerName;
    if (tw != null) base.profile_target_weight_kg = tw;
    if (cw != null) base.profile_current_weight_kg = cw;
    return base;
  }

  const data = lastCard.quickEntryData;
  return {
    pending_quick_entry_count,
    last_card_metric_hint: {
      metric_type: data.metricType,
      summary: formatQuickEntrySummary(data),
    },
    ...planExtras,
    ...snapshotExtras,
    ...(normalizedOwnerName ? { owner_display_name: normalizedOwnerName } : {}),
    ...(tw != null ? { profile_target_weight_kg: tw } : {}),
    ...(cw != null ? { profile_current_weight_kg: cw } : {}),
  };
}
