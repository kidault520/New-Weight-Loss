/**
 * 今日 quickEntry + health_records 合并去重（与 App quickEntryCardsService 原逻辑一致）。
 * 数据源须来自 RPC get_today_quick_entry_merge_inputs，保证 Edge 快照与客户端同源。
 */

export type QuickEntryCardData = Record<string, unknown>;

export interface MergedQuickEntryCard {
  id: string;
  metricType: string;
  data: QuickEntryCardData;
  isConfirmed: boolean;
  createdAt: Date;
  timestamp: string;
  sourceType?: "chat" | "health" | "exercise" | "emotion";
  sourceId?: string;
}

function formatTimestampLabel(d: Date): string {
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
  if (typeof value === "string" || typeof value === "number") {
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
  return 0;
}

function inferDataSource(
  record: {
    source?: unknown;
    notes?: unknown;
    message?: unknown;
    exercise_data?: unknown;
    nutrition_data?: unknown;
  },
  fallback?: "ai" | "manual",
): "ai" | "manual" {
  const ed = record.exercise_data && typeof record.exercise_data === "object"
    ? (record.exercise_data as Record<string, unknown>)
    : null;
  if (ed?.source === "ai") return "ai";
  if (ed?.source === "manual") return "manual";
  const nd = record.nutrition_data && typeof record.nutrition_data === "object"
    ? (record.nutrition_data as Record<string, unknown>)
    : null;
  if (nd?.source === "ai") return "ai";
  if (nd?.source === "manual") return "manual";

  const explicitSource = typeof record.source === "string" ? record.source.toLowerCase() : "";
  if (explicitSource === "ai") return "ai";
  if (explicitSource === "manual") return "manual";
  if (fallback === "ai" || fallback === "manual") return fallback;

  const text = `${typeof record.notes === "string" ? record.notes : ""} ${
    typeof record.message === "string" ? record.message : ""
  }`;
  const aiHints = ["AI记录", "AI创建", "AI识别"];
  return aiHints.some((hint) => text.includes(hint)) ? "ai" : "manual";
}

function matchesQuickEntryDuplicate(a: MergedQuickEntryCard, b: MergedQuickEntryCard): boolean {
  if (a.metricType !== b.metricType) return false;
  const timeDiff = Math.abs(toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  if (timeDiff >= 5 * 60 * 1000) return false;
  const ca = a.data;
  const cb = b.data;
  switch (a.metricType) {
    case "water":
    case "weight":
    case "steps":
    case "sleep":
    case "blood_glucose":
    case "supplement":
      return ca.value === cb.value;
    case "food":
      return ca.foodName === cb.foodName && ca.calories === cb.calories;
    case "exercise":
      return ca.exerciseName === cb.exerciseName && ca.calories === cb.calories;
    case "emotion":
      return ca.emotionType === cb.emotionType;
    case "breathing":
      return ca.breathingModeId === cb.breathingModeId && ca.value === cb.value;
    case "measurements":
      return JSON.stringify(ca.measurements ?? null) === JSON.stringify(cb.measurements ?? null);
    default:
      return false;
  }
}

function getCardIdentityKey(card: MergedQuickEntryCard): string {
  if (card.sourceType && card.sourceId) {
    return `${card.sourceType}:${card.sourceId}`;
  }
  const ts = toTimestamp(card.createdAt);
  const base = `${card.metricType}-${ts}-${card.data.value ?? ""}`;
  const secondary =
    `${card.data.foodName || ""}-${card.data.exerciseName || ""}-${card.data.emotionType || ""}-${card.data.notes || ""}`;
  return `${base}-${secondary}`;
}

export type MergeRpcChatRow = {
  id: string;
  created_at: string;
  is_quick_entry_confirmed?: boolean | null;
  quick_entry_data?: unknown;
};

export type MergeRpcHealthRow = Record<string, unknown>;

export interface TodayQuickEntryMergeRpcPayload {
  chat_messages: MergeRpcChatRow[];
  health_records: MergeRpcHealthRow[];
}

export function parseTodayQuickEntryMergeRpcPayload(raw: unknown): TodayQuickEntryMergeRpcPayload {
  if (!raw || typeof raw !== "object") {
    return { chat_messages: [], health_records: [] };
  }
  const o = raw as Record<string, unknown>;
  const chat = o.chat_messages;
  const health = o.health_records;
  return {
    chat_messages: Array.isArray(chat) ? (chat as MergeRpcChatRow[]) : [],
    health_records: Array.isArray(health) ? (health as MergeRpcHealthRow[]) : [],
  };
}

/** 从 RPC 原始 JSON 合并为卡片列表（Edge / App 共用） */
export function mergeQuickEntryCardsFromRpcPayload(raw: unknown): MergedQuickEntryCard[] {
  const { chat_messages: quickEntryRows, health_records: healthRows } = parseTodayQuickEntryMergeRpcPayload(raw);

  const chatMessageIds = new Set(quickEntryRows.map((m) => m.id));

  const chatCards: MergedQuickEntryCard[] = quickEntryRows
    .filter((r) => r.quick_entry_data && typeof r.quick_entry_data === "object")
    .map((record) => {
      const qd = { ...(record.quick_entry_data as QuickEntryCardData) };
      const metricType = String(qd.metricType || "");
      if (qd.date && typeof qd.date === "string") {
        qd.date = new Date(qd.date).toISOString();
      }
      const createdAt = new Date(record.created_at);
      return {
        id: record.id,
        metricType,
        data: qd,
        isConfirmed: !!record.is_quick_entry_confirmed,
        createdAt,
        timestamp: formatTimestampLabel(createdAt),
        sourceType: "chat" as const,
        sourceId: record.id,
      };
    });

  const healthCards: MergedQuickEntryCard[] = healthRows
    .filter((record) => {
      const cmid = record.chat_message_id as string | null | undefined;
      if (cmid && chatMessageIds.has(cmid)) return false;
      return true;
    })
    .map((record) => {
      const quickEntryData: QuickEntryCardData = {
        metricType: String(record.record_type),
        value: Number(record.value),
        unit: record.unit || undefined,
        date: new Date(String(record.recorded_at)).toISOString(),
        notes: record.notes ? String(record.notes) : undefined,
        isSavedToDatabase: true,
        dataSource: inferDataSource({
          source: record.source,
          notes: record.notes,
          exercise_data: record.exercise_data,
          nutrition_data: record.nutrition_data,
        }),
        syncedToRecords: true,
      };

      switch (String(record.record_type)) {
        case "food": {
          const nutrition = record.nutrition_data as Record<string, unknown> | null;
          if (nutrition) {
            quickEntryData.foodName = nutrition.name || "食物";
            quickEntryData.calories = nutrition.calories || 0;
            quickEntryData.mealType = nutrition.mealType || "加餐";
            quickEntryData.quantity = nutrition.quantity || 1;
          }
          break;
        }
        case "measurements": {
          const measurements = record.measurement_data as Record<string, unknown> | null;
          if (measurements) {
            if (measurements.chest || measurements.waist || measurements.hips) {
              quickEntryData.measurements = {
                chest: measurements.chest,
                waist: measurements.waist,
                upperArm: measurements.upperArm,
                hips: measurements.hips,
                thigh: measurements.thigh,
                calf: measurements.calf,
              };
            } else {
              quickEntryData.measurementType = measurements.type || "other";
            }
          }
          break;
        }
        case "exercise": {
          const ed = (record.exercise_data as Record<string, unknown>) || {};
          const duration = Number(ed.duration) || 0;
          const calories = Number(ed.calories_burned ?? record.value) || 0;
          quickEntryData.metricType = "exercise";
          quickEntryData.value = duration;
          quickEntryData.exerciseName = (ed.name as string) || "运动";
          quickEntryData.duration = duration;
          quickEntryData.exerciseType = (ed.exercise_type as string) || "other";
          quickEntryData.calories = calories;
          quickEntryData.dataSource = inferDataSource({
            notes: record.notes,
            exercise_data: record.exercise_data,
          });
          break;
        }
        case "emotion": {
          const ed = (record.emotion_data as Record<string, unknown>) || {};
          quickEntryData.metricType = "emotion";
          quickEntryData.value = Number(record.value ?? ed.intensity ?? 0.5);
          quickEntryData.emotionType = (ed.emotion as string) || "neutral";
          quickEntryData.intensity = Number(ed.intensity ?? record.value ?? 0.5);
          quickEntryData.notes = record.notes ? String(record.notes) : undefined;
          quickEntryData.dataSource = inferDataSource({
            source: record.source,
            notes: record.notes,
            message: ed.message,
          });
          break;
        }
        case "breathing": {
          const bd = (record.breathing_data as Record<string, unknown>) || {};
          const dur = Number(bd.duration_sec ?? record.value ?? 0);
          quickEntryData.metricType = "breathing";
          quickEntryData.value = dur;
          quickEntryData.breathingModeId = String(bd.mode_id || "");
          quickEntryData.breathingModeLabel = String(bd.mode_label || "呼吸练习");
          quickEntryData.breathingCycles = Number(bd.cycles_completed ?? 0);
          quickEntryData.breathingCompleted = bd.completed === true;
          quickEntryData.dataSource = "manual";
          quickEntryData.notes = record.notes ? String(record.notes) : undefined;
          break;
        }
      }

      const createdAt = new Date(String(record.recorded_at));
      return {
        id: String(record.id),
        metricType: String(quickEntryData.metricType),
        data: quickEntryData,
        isConfirmed: true,
        createdAt,
        timestamp: formatTimestampLabel(createdAt),
        sourceType: "health" as const,
        sourceId: String(record.id),
      };
    })
    .filter((record) => {
      if (record.metricType !== "emotion") return true;
      const confirmedEmotionChatCards = chatCards.filter(
        (c) => c.isConfirmed && c.metricType === "emotion",
      );
      return !confirmedEmotionChatCards.some((chatCard) => {
        const recordTime = toTimestamp(record.createdAt);
        const chatTime = toTimestamp(chatCard.createdAt);
        const timeDiff = Math.abs(recordTime - chatTime);
        const chatEmotion = String(chatCard.data.emotionType || "");
        const recordEmotion = String(record.data.emotionType || "");
        return chatEmotion === recordEmotion && timeDiff < 5 * 60 * 1000;
      });
    });

  const filteredHealthCards = healthCards.filter(
    (healthCard) => !chatCards.some((chatCard) => matchesQuickEntryDuplicate(healthCard, chatCard)),
  );

  const allCards = [...chatCards, ...filteredHealthCards];

  const uniqueCards = new Map<string, MergedQuickEntryCard>();
  for (const card of allCards) {
    const key = getCardIdentityKey(card);
    if (!uniqueCards.has(key)) {
      uniqueCards.set(key, card);
    } else {
      const existing = uniqueCards.get(key)!;
      if (card.isConfirmed && !existing.isConfirmed) uniqueCards.set(key, card);
      else if (card.sourceType === "chat" && existing.sourceType !== "chat") uniqueCards.set(key, card);
    }
  }

  return Array.from(uniqueCards.values()).sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
}
