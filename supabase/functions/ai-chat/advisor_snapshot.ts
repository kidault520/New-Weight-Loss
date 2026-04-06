/**
 * 顾问「今日快照」：套餐阶段补剂 + 已记录数据与 App 同源（RPC get_today_quick_entry_merge_inputs + _shared/mergeQuickEntryAggregate）
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  mergeQuickEntryCardsFromRpcPayload,
  parseTodayQuickEntryMergeRpcPayload,
  type MergedQuickEntryCard,
} from "../_shared/mergeQuickEntryAggregate.ts";

export type ClientDailyContext = {
  beijing_date?: string;
  supplements_ingested_ids?: string[];
};

export type AdvisorSnapshotOptions = {
  includeServiceCycleFull?: boolean;
  focusDateYmd?: string | null;
  includeReportHistory?: boolean;
  reportHistoryLimit?: number;
  reportDetailRank?: number | null;
  /** false：配送计划未配置完成，屏蔽托管向配送/排期/补剂疗程快照，避免模型编造履约内容 */
  intake_plan_active?: boolean;
};

function toBeijingDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function toBeijingMidnightFromInstant(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const ymd = toBeijingDateString(d);
  return new Date(`${ymd}T00:00:00+08:00`);
}

function isOrderSyncedFoodNutrition(nd: unknown): boolean {
  if (!nd || typeof nd !== "object") return false;
  const sid = (nd as { syncId?: unknown }).syncId;
  return sid != null && String(sid).length > 0;
}

const MEAL_TYPE_TO_KEY: Record<string, string> = {
  早餐: "breakfast",
  午餐: "lunch",
  晚餐: "dinner",
  加餐: "snack",
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

const METRIC_LABELS: Record<string, string> = {
  weight: "体重",
  water: "饮水",
  exercise: "运动",
  steps: "步数",
  sleep: "睡眠",
  measurements: "围度",
  emotion: "心情",
  blood_glucose: "血糖",
  supplement: "补剂",
};

const TASK_TYPE_LABEL: Record<string, string> = {
  meal: "餐食",
  exercise: "运动",
  water: "饮水",
  sleep: "睡眠",
  checkin: "打卡",
  notification: "提醒",
};

const RECORDED_METRIC_TYPES = new Set([
  "weight",
  "water",
  "exercise",
  "steps",
  "sleep",
  "measurements",
  "emotion",
  "blood_glucose",
]);

const SUPPLEMENT_ORDER_QUERY_LIMIT = 100;

function supplementOrderStatusRank(status: string): number {
  if (status === "processing") return 0;
  if (status === "confirmed") return 1;
  if (status === "pending") return 2;
  return 3;
}

function productAccessor(o: { products?: unknown; product?: unknown }): Record<string, unknown> | null {
  const p = o?.products ?? o?.product;
  return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
}

async function pickSupplementFulfillmentOrder(
  supabase: SupabaseClient,
  orders: Array<{ products?: unknown; product?: unknown; [k: string]: unknown }>,
): Promise<{
  order: Record<string, unknown> | null;
  orderProduct: Record<string, unknown> | null;
}> {
  const candidates = orders.filter((o) => {
    const p = productAccessor(o);
    return p && p.supplement_plan_id;
  });
  if (candidates.length === 0) return { order: null, orderProduct: null };

  const planIds = [...new Set(candidates.map((o) => String(productAccessor(o)!.supplement_plan_id)))];
  const { data: plans, error: pErr } = await supabase
    .from("supplement_plans")
    .select("id, is_active")
    .in("id", planIds);
  if (pErr) throw pErr;
  const planUsable = new Map((plans || []).map((p: { id: string; is_active?: boolean | null }) => [p.id, p.is_active !== false]));

  candidates.sort((a, b) => {
    const ra = supplementOrderStatusRank(String(a.order_status || ""));
    const rb = supplementOrderStatusRank(String(b.order_status || ""));
    if (ra !== rb) return ra - rb;
    const ta = new Date(String(a.payment_time || a.created_at)).getTime();
    const tb = new Date(String(b.payment_time || b.created_at)).getTime();
    return tb - ta;
  });

  for (const o of candidates) {
    const p = productAccessor(o);
    const pid = p?.supplement_plan_id != null ? String(p.supplement_plan_id) : "";
    if (pid && planUsable.get(pid)) {
      return { order: o as Record<string, unknown>, orderProduct: p! };
    }
  }
  return { order: null, orderProduct: null };
}

type StageSupp = { supplement_id?: string; per_day_qty?: number; supplement?: { id?: string; name?: string } | null };

type CurrentStageShape = {
  stage_id: string;
  stage_name?: string;
  per_day_qty?: number | null;
  supplement?: { id?: string; name?: string } | null;
  supplements?: StageSupp[];
};

type TimelineStage = CurrentStageShape & { duration_days: number; index: number };

function buildStageDisplayItems(stage: CurrentStageShape): { id: string; name: string }[] {
  const list: StageSupp[] =
    stage.supplements && stage.supplements.length > 0
      ? stage.supplements
      : stage.supplement
      ? [{ supplement: stage.supplement, per_day_qty: stage.per_day_qty ?? 1 }]
      : [];
  return list.map((item, idx) => ({
    id: `stage-${stage.stage_id || "x"}-${item.supplement?.id || idx}`,
    name: item.supplement?.name || `补剂${idx + 1}`,
  }));
}

export type SupplementCourseMeta = {
  current_day: number;
  total_days: number;
  schedule_name: string;
  product_name: string;
  order_id: string;
  supplement_plan_id: string;
  current_stage_name?: string;
  start_date_ymd?: string;
};

export type SupplementTimelineStage = {
  index: number;
  stage_id: string;
  stage_name: string;
  start_day: number;
  end_day: number;
  supplements: { id: string; name: string }[];
};

export type SupplementStageBundle = {
  items: { id: string; name: string }[];
  courseMeta: SupplementCourseMeta | null;
  timeline: SupplementTimelineStage[];
};

/**
 * 与 server/routes/deliverySchedules.js active-supplement-stage 同逻辑（Edge 内直连 Supabase）
 */
async function fetchActiveSupplementStageBundle(
  supabase: SupabaseClient,
  userId: string,
  todayYmd: string,
): Promise<SupplementStageBundle> {
  try {
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        payment_time,
        start_time,
        order_status,
        products (
          id,
          product_name,
          duration_days,
          supplement_plan_id
        )
      `)
      .eq("user_id", userId)
      .eq("payment_status", "paid")
      .neq("order_status", "cancelled")
      .neq("order_status", "completed")
      .order("payment_time", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SUPPLEMENT_ORDER_QUERY_LIMIT);
    if (oErr) throw oErr;

    const { order, orderProduct } = await pickSupplementFulfillmentOrder(supabase, orders || []);
    if (!order || !orderProduct?.supplement_plan_id) return { items: [], courseMeta: null, timeline: [] };

    const startDate =
      toBeijingMidnightFromInstant(
        (order.start_time as string | null) || (order.payment_time as string | null) || (order.created_at as string | null),
      );
    if (!startDate) return { items: [], courseMeta: null, timeline: [] };

    const todayBeijing = new Date(`${todayYmd}T00:00:00+08:00`);
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentDay = Math.max(1, Math.floor((todayBeijing.getTime() - startDate.getTime()) / msPerDay) + 1);

    const { data: schedule, error: sErr } = await supabase
      .from("supplement_schedules")
      .select("id, schedule_name, total_days, start_time, end_time, course_id, created_at")
      .eq("course_id", orderProduct.supplement_plan_id as string)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!schedule) return { items: [], courseMeta: null, timeline: [] };

    const { data: stages, error: stErr } = await supabase
      .from("supplement_schedule_stages")
      .select("id, stage_name, duration_days, sort_order, per_day_qty, supplement_id")
      .eq("schedule_id", schedule.id)
      .order("sort_order", { ascending: true });
    if (stErr) throw stErr;

    const stageRows = stages || [];
    const stageIds = stageRows.map((s: { id: string }) => s.id).filter(Boolean);
    const fallbackSupplementIds = stageRows.map((s: { supplement_id?: string | null }) => s.supplement_id).filter(Boolean) as string[];

    const stageItemsMap = new Map<string, StageSupp[]>();
    if (stageIds.length > 0) {
      const { data: stageItems, error: itemErr } = await supabase
        .from("supplement_schedule_stage_items")
        .select("stage_id, supplement_id, per_day_qty, sort_order, supplement_products(id, name)")
        .in("stage_id", stageIds)
        .order("sort_order", { ascending: true });

      if (itemErr && !String(itemErr.message || "").includes("supplement_schedule_stage_items")) {
        throw itemErr;
      }

      for (const item of stageItems || []) {
        const row = item as Record<string, unknown>;
        const sid = row.stage_id as string;
        const supp = row.supplement_products as { id?: string; name?: string } | null | undefined;
        if (!stageItemsMap.has(sid)) stageItemsMap.set(sid, []);
        stageItemsMap.get(sid)!.push({
          supplement_id: row.supplement_id as string,
          per_day_qty: (row.per_day_qty as number) ?? 1,
          supplement: supp || null,
        });
      }
    }

    const fallbackSupplementMap = new Map<string, { id: string; name: string }>();
    if (fallbackSupplementIds.length > 0) {
      const { data: fallbackSupplements, error: fbErr } = await supabase
        .from("supplement_products")
        .select("id, name")
        .in("id", [...new Set(fallbackSupplementIds)]);
      if (fbErr) throw fbErr;
      for (const supp of fallbackSupplements || []) {
        fallbackSupplementMap.set(supp.id, supp);
      }
    }

    let cursorStart = 1;
    let currentStage: CurrentStageShape | null = null;
    const timeline: TimelineStage[] = [];

    for (let idx = 0; idx < stageRows.length; idx++) {
      const s = stageRows[idx] as {
        id: string;
        stage_name: string;
        duration_days: number;
        per_day_qty?: number | null;
        supplement_id?: string | null;
      };
      let stageSupplements: StageSupp[] = stageItemsMap.get(s.id) || [];
      if (stageSupplements.length === 0 && s.supplement_id) {
        const fb = fallbackSupplementMap.get(s.supplement_id);
        stageSupplements = [{
          supplement_id: s.supplement_id,
          per_day_qty: s.per_day_qty ?? 1,
          supplement: fb || null,
        }];
      }
      const stageStart = cursorStart;
      const stageEnd = cursorStart + (s.duration_days || 0) - 1;
      const isCurrent = currentDay >= stageStart && currentDay <= stageEnd;
      const stageShape: TimelineStage = {
        index: idx + 1,
        stage_id: s.id,
        stage_name: s.stage_name,
        duration_days: s.duration_days || 0,
        per_day_qty: stageSupplements[0]?.per_day_qty ?? s.per_day_qty ?? 1,
        supplement: stageSupplements[0]?.supplement || null,
        supplements: stageSupplements,
      };
      if (isCurrent) {
        currentStage = {
          stage_id: s.id,
          stage_name: s.stage_name,
          per_day_qty: stageSupplements[0]?.per_day_qty ?? s.per_day_qty ?? 1,
          supplement: stageSupplements[0]?.supplement || null,
          supplements: stageSupplements,
        };
      }
      timeline.push(stageShape);
      cursorStart = stageEnd + 1;
    }

    const totalDays =
      (schedule as { total_days?: number }).total_days ||
      timeline.reduce((sum, x) => sum + (x.duration_days || 0), 0);

    if (!currentStage && timeline.length > 0) {
      if (currentDay > totalDays) {
        const last = timeline[timeline.length - 1];
        currentStage = {
          stage_id: last.stage_id,
          stage_name: last.stage_name,
          per_day_qty: last.per_day_qty,
          supplement: last.supplement,
          supplements: last.supplements,
        };
      } else {
        const first = timeline[0];
        currentStage = {
          stage_id: first.stage_id,
          stage_name: first.stage_name,
          per_day_qty: first.per_day_qty,
          supplement: first.supplement,
          supplements: first.supplements,
        };
      }
    }

    const productName = String((orderProduct as { product_name?: string }).product_name || "");
    const startDateYmd = toBeijingDateString(startDate);
    const courseMeta: SupplementCourseMeta = {
      current_day: currentDay,
      total_days: Math.max(1, totalDays || 1),
      schedule_name: String((schedule as { schedule_name?: string }).schedule_name || ""),
      product_name: productName,
      order_id: String(order.id),
      supplement_plan_id: String(orderProduct.supplement_plan_id),
      current_stage_name: currentStage?.stage_name,
      start_date_ymd: startDateYmd,
    };

    const timelineView: SupplementTimelineStage[] = [];
    let runningStart = 1;
    for (const st of timeline) {
      const duration = Math.max(1, st.duration_days || 0);
      const startDay = runningStart;
      const endDay = runningStart + duration - 1;
      timelineView.push({
        index: st.index,
        stage_id: st.stage_id,
        stage_name: st.stage_name || `阶段${st.index}`,
        start_day: startDay,
        end_day: endDay,
        supplements: buildStageDisplayItems(st),
      });
      runningStart = endDay + 1;
    }

    if (!currentStage) {
      return { items: [], courseMeta, timeline: timelineView };
    }
    return { items: buildStageDisplayItems(currentStage), courseMeta, timeline: timelineView };
  } catch (e) {
    console.error("fetchActiveSupplementStageBundle:", e);
    return { items: [], courseMeta: null, timeline: [] };
  }
}

function buildMealsSummaryForToday(
  foodRows: Array<{ nutrition_data?: Record<string, unknown> | null }>,
): { mealsCount: number; mealsLabel: string; detail: string } {
  const caloriesByMeal: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  const snackByTimeLabel: Record<string, number> = { 早上: 0, 中午: 0, 晚上: 0 };
  const consumedFromDb: string[] = [];

  for (const r of foodRows) {
    const nd = r.nutrition_data;
    const mt = nd?.mealType;
    const key = mt != null ? MEAL_TYPE_TO_KEY[String(mt)] : undefined;
    const cal = Number(nd?.calories ?? 0) || 0;
    const timeLabel = nd?.timeLabel != null ? String(nd.timeLabel) : "";
    const fromOrderSync = isOrderSyncedFoodNutrition(nd);

    if (fromOrderSync && key && ["breakfast", "lunch", "dinner"].includes(key)) {
      const slot = key as "breakfast" | "lunch" | "dinner";
      caloriesByMeal[slot] = (caloriesByMeal[slot] || 0) + cal;
      consumedFromDb.push(slot);
    } else {
      caloriesByMeal.snack = (caloriesByMeal.snack || 0) + cal;
      consumedFromDb.push("snack");
      const tl =
        timeLabel && ["早上", "中午", "晚上"].includes(timeLabel)
          ? timeLabel
          : key === "breakfast"
          ? "早上"
          : key === "dinner"
          ? "晚上"
          : "中午";
      snackByTimeLabel[tl] = (snackByTimeLabel[tl] || 0) + cal;
    }
  }

  const consumedMeals = new Set(consumedFromDb);
  const mealsCount = consumedMeals.size;
  const mealsLabel = mealsCount === 0 ? "已摄入 0 餐" : `已摄入 ${mealsCount} 餐`;
  const snackTotal = caloriesByMeal.snack || 0;
  const lines = [
    `早餐：${consumedMeals.has("breakfast") ? "有" : "无"}（约 ${Math.round(caloriesByMeal.breakfast || 0)} 千卡）`,
    `午餐：${consumedMeals.has("lunch") ? "有" : "无"}（约 ${Math.round(caloriesByMeal.lunch || 0)} 千卡）`,
    `晚餐：${consumedMeals.has("dinner") ? "有" : "无"}（约 ${Math.round(caloriesByMeal.dinner || 0)} 千卡）`,
    `加餐：${consumedMeals.has("snack") ? "有" : "无"}（约 ${Math.round(snackTotal)} 千卡${
      snackTotal > 0
        ? `；早/中/晚分段约 ${Math.round(snackByTimeLabel["早上"])} / ${Math.round(snackByTimeLabel["中午"])} / ${Math.round(snackByTimeLabel["晚上"])} 千卡`
        : ""
    }）`,
  ];
  return { mealsCount, mealsLabel, detail: lines.join("；") };
}

/** 今日餐食名称/热量/餐次明细，供 AI 直接回答「今天吃了什么」 */
function formatTodayFoodDetailsLines(
  foodRows: Array<{ nutrition_data?: Record<string, unknown> | null; notes?: unknown; recorded_at?: string }>,
  maxLines: number,
): string {
  if (!foodRows.length) {
    return "今日餐食明细：尚无餐食类健康记录（未同步或未录入时，可如实说明并引导用户查看 App 餐食卡片）。";
  }
  const totalCal = foodRows.reduce((sum, r) => {
    const nd = r.nutrition_data;
    return sum + (Number(nd && (nd as { calories?: unknown }).calories) || 0);
  }, 0);
  const lines = foodRows.slice(0, maxLines).map((r) => {
    const nd = r.nutrition_data || {};
    const name =
      nd.name ||
      nd.foodName ||
      nd.title ||
      (typeof nd.food_name === "string" ? nd.food_name : "") ||
      (r.notes ? String(r.notes).slice(0, 50) : "") ||
      "未命名食物";
    const cal = nd.calories != null && nd.calories !== "" ? `${Math.round(Number(nd.calories))}千卡` : "";
    const meal = nd.mealType != null && nd.mealType !== "" ? String(nd.mealType) : "";
    const parts = [String(name).trim()];
    if (cal) parts.push(cal);
    if (meal) parts.push(`餐次:${meal}`);
    return `  · ${parts.join("，")}`;
  });
  const more = foodRows.length > maxLines
    ? `\n  · …共${foodRows.length}条，此处列前${maxLines}条`
    : "";
  return `今日餐食明细（北京今日共 ${foodRows.length} 条，合计约 ${Math.round(totalCal)} 千卡）：\n${lines.join("\n")}${more}`;
}

function unwrapExecutionProgramOrder(program: Record<string, unknown>): {
  order_number: string;
  product_name: string;
} {
  const ord = program.orders;
  const o = Array.isArray(ord) ? ord[0] : ord;
  if (!o || typeof o !== "object") return { order_number: "", product_name: "" };
  const ox = o as { order_number?: string; products?: unknown; product?: unknown };
  const prod = ox.products ?? ox.product;
  const p = Array.isArray(prod) ? prod[0] : prod;
  const product_name = p && typeof p === "object"
    ? String((p as { product_name?: string }).product_name || "")
    : "";
  return {
    order_number: String(ox.order_number || ""),
    product_name,
  };
}

/** 与 useDailyFeedbackFixed 折叠内「已记录数据」主行/结构/明细口径一致（基于合并卡片） */
function buildRecordedDataFeedbackBlock(
  ownerName: string,
  mealsCount: number,
  stepsRecordCount: number,
  mergedCards: MergedQuickEntryCard[],
): string {
  const recordedMetricCards = mergedCards.filter((c) => RECORDED_METRIC_TYPES.has(c.metricType));

  const countByType: Record<string, number> = {};
  const countByTypeAndSource: Record<string, { aiCreated: number; aiRecorded: number; manual: number }> = {};
  for (const c of recordedMetricCards) {
    const mt = c.metricType;
    countByType[mt] = (countByType[mt] || 0) + 1;
    const isManual = c.data.dataSource === "manual";
    if (!countByTypeAndSource[mt]) {
      countByTypeAndSource[mt] = { aiCreated: 0, aiRecorded: 0, manual: 0 };
    }
    if (isManual) countByTypeAndSource[mt].manual += 1;
    else if (c.isConfirmed) countByTypeAndSource[mt].aiRecorded += 1;
    else countByTypeAndSource[mt].aiCreated += 1;
  }

  const byTypeLine = Object.entries(countByType)
    .filter(([, n]) => n > 0)
    .map(([mt, n]) => `${METRIC_LABELS[mt] || mt}×${n}`)
    .sort()
    .join("，");

  const aiConfirmedCount = recordedMetricCards.filter((c) => c.isConfirmed && c.data.dataSource !== "manual").length;
  const manualInputCount = recordedMetricCards.filter((c) => c.data.dataSource === "manual").length;
  const deviceCount = stepsRecordCount > 0 ? 1 : 0;
  const mealsNutritionRecordedCount = mealsCount;
  const aiTotalSyncCount = mealsNutritionRecordedCount + aiConfirmedCount;

  const structural = [
    `【结构项·对齐首页】设备同步：已同步${deviceCount}台设备、${stepsRecordCount}条步数记录。`,
    `AI记录：已同步 AI 记录 ${aiTotalSyncCount} 条计次（餐食营养 ${mealsNutritionRecordedCount} + 已确认非手动指标卡 ${aiConfirmedCount}）。`,
    `手动录入：已同步 ${ownerName} 录入 ${manualInputCount} 条。`,
  ];

  const aiSyncDetail: string[] = [];
  if (mealsNutritionRecordedCount > 0) {
    aiSyncDetail.push(`已记录${mealsNutritionRecordedCount}餐热量及营养元素。`);
  }
  const aiMetricParts: string[] = [];
  const manualParts: string[] = [];
  for (const [metricType, { aiCreated, aiRecorded, manual }] of Object.entries(countByTypeAndSource)) {
    const label = METRIC_LABELS[metricType] || metricType;
    if (aiCreated > 0) aiMetricParts.push(`已创建${label} ${aiCreated}条（AI创建·待确认）`);
    if (aiRecorded > 0) aiMetricParts.push(`已记录${label} ${aiRecorded}条（AI记录·已确认）`);
    if (manual > 0) manualParts.push(`已记录${ownerName}录入 ${label} ${manual}条（手动）`);
  }
  if (aiMetricParts.length) aiSyncDetail.push(aiMetricParts.join("；") + "。");
  const manualLine = manualParts.length ? `手动明细：${manualParts.join("；")}。` : "";

  let metricSplitSum = 0;
  for (const { aiCreated, aiRecorded, manual } of Object.values(countByTypeAndSource)) {
    metricSplitSum += aiCreated + aiRecorded + manual;
  }
  const recordedDataTotalCount = mealsNutritionRecordedCount + metricSplitSum;

  return [
    "【已记录数据·RPC get_today_quick_entry_merge_inputs + mergeQuickEntryCardsFromRpcPayload 同源】",
    byTypeLine ? `合并后按类型：${byTypeLine}。` : "合并后按类型：今日无（除餐食外）。",
    ...structural,
    aiSyncDetail.length ? `二级明细（AI）：${aiSyncDetail.join("")}` : "",
    manualLine,
    `主行条数（与首页「已记录数据」合计思路一致）：${recordedDataTotalCount}（= 餐食营养计次 ${mealsNutritionRecordedCount} + 各类型拆分 ${metricSplitSum}）。`,
  ].filter(Boolean).join("\n");
}

const MEAL_TYPE_ZH: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

/** delivery_schedules.status 英文化 → 对用户展示「配送状态」中文 */
const DELIVERY_SCHEDULE_STATUS_ZH: Record<string, string> = {
  pending: "待配送",
  scheduled: "已排期",
  confirmed: "已确认",
  preparing: "备餐中",
  queued: "排队中",
  dispatched: "已发出",
  delivering: "配送中",
  in_transit: "运输中",
  arrived: "已送达站点",
  completed: "已完成",
  delivered: "已送达",
  cancelled: "已取消",
  failed: "配送失败",
  refunded: "已退款",
  paused: "已暂停",
  processing: "处理中",
};

function formatDeliveryStatusZh(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const key = s.toLowerCase().replace(/[\s-]+/g, "_");
  if (DELIVERY_SCHEDULE_STATUS_ZH[key]) return DELIVERY_SCHEDULE_STATUS_ZH[key];
  if (/[\u4e00-\u9fff]/.test(s)) return s;
  return `待同步（${s}）`;
}

/** 与微信一致：11 位 136****5678；7–10 位保留前 3 后 4；更短则尽量打码 */
function maskPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 11) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  if (digits.length >= 4) return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
  return "****";
}

/** 与 App「今日配送」同源：delivery_schedules（含快照列）+ 可选嵌套 delivery_addresses */
function formatTodayDeliverySnapshot(
  rows: Array<{
    meal_type?: string | null;
    status?: string | null;
    delivery_address_label?: string | null;
    delivery_address?: string | null;
    delivery_contact_name?: string | null;
    delivery_contact_phone?: string | null;
    delivery_addresses?: { label?: string | null; address?: string | null; door_number?: string | null } | null;
  }>,
  todayYmd: string,
): string {
  if (!rows.length) {
    return `【今日餐食配送】${todayYmd}：库中无当日餐食配送排期（与 App「今日配送」数据源 delivery_schedules 一致；无排期时如实说明即可）。`;
  }
  const mealOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  const sorted = [...rows].sort(
    (a, b) => (mealOrder[String(a.meal_type || "")] ?? 9) - (mealOrder[String(b.meal_type || "")] ?? 9),
  );
  const lines = sorted.map((r) => {
    const mt = MEAL_TYPE_ZH[String(r.meal_type || "")] || String(r.meal_type || "餐次");
    const a = r.delivery_addresses && typeof r.delivery_addresses === "object" ? r.delivery_addresses : null;
    const labelFromJoin = a?.label != null ? String(a.label).trim() : "";
    const streetFromJoin = a?.address != null ? String(a.address).trim() : "";
    const doorFromJoin = a?.door_number != null ? String(a.door_number).trim() : "";
    const labelSnap = r.delivery_address_label != null ? String(r.delivery_address_label).trim() : "";
    const streetSnap = r.delivery_address != null ? String(r.delivery_address).trim() : "";
    const label = labelFromJoin || labelSnap;
    const street = streetFromJoin || streetSnap;
    const door = doorFromJoin;
    const streetHasDoor = door && street.includes(door);
    const doorSuffix = door && !streetHasDoor ? ` ${door}` : "";
    const addrPart = label
      ? `地址标签「${label}」${street ? `（${street}${doorSuffix}）` : ""}`
      : street
      ? `详细地址：${street}${doorSuffix}`
      : "（地址未关联或待同步）";
    const cname = r.delivery_contact_name != null ? String(r.delivery_contact_name).trim() : "";
    const cphoneRaw = r.delivery_contact_phone != null ? String(r.delivery_contact_phone).trim() : "";
    const cphoneMasked = cphoneRaw ? maskPhoneForDisplay(cphoneRaw) : "";
    const contact =
      cname || cphoneMasked ? `；联系人：${[cname, cphoneMasked].filter(Boolean).join(" ")}` : "";
    return `  · ${mt} → ${addrPart}${contact}；配送状态：${formatDeliveryStatusZh(r.status)}`;
  });
  return `【今日餐食配送】${todayYmd}（回答「送到哪/晚餐送到哪/配送地址」必须依据本节；有标签或地址时勿说系统无配送信息）：\n${lines.join("\n")}`;
}

function formatServiceCycleDeliverySnapshot(
  rows: Array<{
    delivery_date?: string | null;
    meal_type?: string | null;
    status?: string | null;
    delivery_address_label?: string | null;
    delivery_address?: string | null;
  }>,
): string {
  if (!rows.length) {
    return "【服务周期配送计划】当前订单周期内暂无餐食配送排期。";
  }
  const grouped = new Map<string, Array<{ meal_type?: string | null; status?: string | null; label?: string | null; address?: string | null }>>();
  for (const r of rows) {
    const d = String(r.delivery_date || "");
    if (!d) continue;
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push({
      meal_type: r.meal_type,
      status: r.status,
      label: r.delivery_address_label,
      address: r.delivery_address,
    });
  }
  const dateKeys = Array.from(grouped.keys()).sort();
  const lines = dateKeys.map((d) => {
    const items = grouped.get(d) || [];
    const meals = items
      .map((x) =>
        `${MEAL_TYPE_ZH[String(x.meal_type || "")] || String(x.meal_type || "餐次")}(${formatDeliveryStatusZh(x.status)})`,
      )
      .join("、");
    const first = items[0];
    const addrLabel = first?.label ? `地址标签:${first.label}` : first?.address ? `地址:${first.address}` : "地址待同步";
    return `  · ${d}：${meals}；${addrLabel}`;
  });
  return `【服务周期配送计划】共 ${dateKeys.length} 天已排期（按日期列出）：\n${lines.join("\n")}`;
}

function formatFocusDateFoodActualSnapshot(
  focusDateYmd: string,
  rows: Array<{ nutrition_data?: Record<string, unknown> | null; notes?: unknown }>,
): string {
  if (!rows.length) {
    return `【指定日期餐食实绩】${focusDateYmd}：无实绩记录（可能未录入，或仅有计划）。`;
  }
  const totalCal = rows.reduce((sum, r) => sum + (Number(r.nutrition_data?.calories) || 0), 0);
  const lines = rows.slice(0, 30).map((r) => {
    const nd = r.nutrition_data || {};
    const name =
      nd.name ||
      nd.foodName ||
      nd.title ||
      (typeof nd.food_name === "string" ? nd.food_name : "") ||
      (r.notes ? String(r.notes).slice(0, 40) : "") ||
      "未命名食物";
    const cal = nd.calories != null && nd.calories !== "" ? `${Math.round(Number(nd.calories))}千卡` : "";
    const meal = nd.mealType != null && nd.mealType !== "" ? String(nd.mealType) : "";
    const parts = [String(name).trim()];
    if (cal) parts.push(cal);
    if (meal) parts.push(`餐次:${meal}`);
    return `  · ${parts.join("，")}`;
  });
  const more = rows.length > 30 ? `\n  · …共${rows.length}条，此处列前30条` : "";
  return `【指定日期餐食实绩】${focusDateYmd}：共 ${rows.length} 条，合计约 ${Math.round(totalCal)} 千卡。\n${lines.join("\n")}${more}`;
}

function mapMealTypeToZh(mealType: string): string {
  const m = mealType.toLowerCase();
  if (m === "breakfast") return "早餐";
  if (m === "lunch") return "午餐";
  if (m === "dinner") return "晚餐";
  if (m === "snack") return "加餐";
  return mealType;
}

function trimPackageDatePrefix(name: string): string {
  const raw = name.trim();
  if (!raw) return raw;
  return raw.replace(/^\d{4}-\d{2}-\d{2}\s*/, "").trim();
}

type FocusMealPlanResult = {
  block: string;
  hasPlan: boolean;
};

async function buildFocusDateMealPlanSnapshot(
  supabase: SupabaseClient,
  userId: string,
  focusDateYmd: string,
): Promise<FocusMealPlanResult> {
  try {
    const { data: userMeals } = await supabase
      .from("delivery_schedules")
      .select("meal_type")
      .eq("user_id", userId)
      .eq("delivery_type", "meal")
      .eq("delivery_date", focusDateYmd)
      .not("meal_type", "is", null);
    const userMealTypesZh = new Set(
      (userMeals || [])
        .map((x) => String(x.meal_type || ""))
        .filter(Boolean)
        .map((x) => mapMealTypeToZh(x)),
    );

    const { data: enabledSchedules } = await supabase
      .from("meal_schedules")
      .select("id, schedule_name, start_time, end_time, enabled_at, created_at")
      .eq("is_enabled", true)
      .order("enabled_at", { ascending: false })
      .order("created_at", { ascending: false });

    const inRange = (s: Record<string, unknown>) => {
      const st = s.start_time ? toBeijingDateString(new Date(String(s.start_time))) : "";
      const et = s.end_time ? toBeijingDateString(new Date(String(s.end_time))) : "";
      if (!st || !et) return false;
      return focusDateYmd >= st && focusDateYmd <= et;
    };
    let schedule = (enabledSchedules || []).find((s) => inRange(s as Record<string, unknown>)) || null;
    if (!schedule) {
      const { data: fallbackSchedules } = await supabase
        .from("meal_schedules")
        .select("id, schedule_name, start_time, end_time, is_enabled, enabled_at, created_at")
        .order("is_enabled", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      schedule = (fallbackSchedules || []).find((s) => inRange(s as Record<string, unknown>)) || null;
    }
    if (!schedule?.id) {
      return {
        block: `【指定日期餐食计划明细】${focusDateYmd}：未命中可用餐食排期（reason_code: plan_not_generated）。`,
        hasPlan: false,
      };
    }

    const { data: entries } = await supabase
      .from("meal_schedule_entries")
      .select("package_type, package_id")
      .eq("schedule_id", schedule.id)
      .eq("date", focusDateYmd)
      .order("package_type", { ascending: true });
    if (!entries || entries.length === 0) {
      return {
        block: `【指定日期餐食计划明细】${focusDateYmd}：该日排期下暂无套餐条目（reason_code: plan_not_generated）。`,
        hasPlan: false,
      };
    }

    const selectedEntries = userMealTypesZh.size > 0
      ? entries.filter((e) => userMealTypesZh.has(String(e.package_type || "")))
      : entries;
    const packageIds = [...new Set(selectedEntries.map((e) => String(e.package_id || "")).filter(Boolean))];
    if (packageIds.length === 0) {
      return {
        block: `【指定日期餐食计划明细】${focusDateYmd}：该日套餐信息不完整（reason_code: plan_not_generated）。`,
        hasPlan: false,
      };
    }

    const { data: packages, error: pkgErr } = await supabase
      .from("meal_packages")
      .select("id, name, total_calories_kcal, total_carbohydrate_g, total_protein_g, total_fat_g, total_fiber_g")
      .in("id", packageIds);
    if (pkgErr) {
      console.warn("buildFocusDateMealPlanSnapshot meal_packages:", pkgErr);
    }
    const pkgMap = new Map<string, Record<string, unknown>>();
    for (const p of packages || []) pkgMap.set(String(p.id), p as Record<string, unknown>);

    const { data: packageItems, error: itemErr } = await supabase
      .from("package_items")
      .select("package_id, dishes(name), sort_order")
      .in("package_id", packageIds)
      .order("sort_order", { ascending: true });
    if (itemErr) {
      console.warn("buildFocusDateMealPlanSnapshot package_items:", itemErr);
    }
    const dishMap = new Map<string, string[]>();
    for (const item of packageItems || []) {
      const pid = String((item as Record<string, unknown>).package_id || "");
      const rawDishes = (item as Record<string, unknown>).dishes;
      if (!pid) continue;
      if (!dishMap.has(pid)) dishMap.set(pid, []);
      if (Array.isArray(rawDishes)) {
        for (const d of rawDishes) {
          const name = d && typeof d === "object" ? String((d as Record<string, unknown>).name || "") : "";
          if (name) dishMap.get(pid)!.push(name);
        }
      } else if (rawDishes && typeof rawDishes === "object") {
        const name = String((rawDishes as Record<string, unknown>).name || "");
        if (name) dishMap.get(pid)!.push(name);
      }
    }

    const lines = selectedEntries.map((e) => {
      const mealType = String(e.package_type || "餐次");
      const p = pkgMap.get(String(e.package_id || ""));
      const pkgNameRaw = p?.name ? String(p.name) : "未命名套餐";
      const pkgName = trimPackageDatePrefix(pkgNameRaw);
      const kcal = Number(p?.total_calories_kcal || 0);
      const c = Number(p?.total_carbohydrate_g || 0);
      const pro = Number(p?.total_protein_g || 0);
      const fat = Number(p?.total_fat_g || 0);
      const fiber = Number(p?.total_fiber_g || 0);
      const dishes = (dishMap.get(String(e.package_id || "")) || []).slice(0, 10).join("、");
      return `  · ${mealType}：${pkgName}；菜品明细：${dishes || "无（排期尚未挂载明细）"}；宏量：碳水${Math.round(c)}g/蛋白${Math.round(pro)}g/脂肪${Math.round(fat)}g/纤维${Math.round(fiber)}g；热量${Math.round(kcal)}千卡。`;
    });

    return {
      block: `【指定日期餐食计划明细】${focusDateYmd}（基于排期套餐）：\n${lines.join("\n")}`,
      hasPlan: lines.length > 0,
    };
  } catch (e) {
    console.warn("buildFocusDateMealPlanSnapshot:", e);
    return {
      block: `【指定日期餐食计划明细】${focusDateYmd}：读取失败（reason_code: plan_not_generated）。`,
      hasPlan: false,
    };
  }
}

function formatReportHistorySnapshot(
  rows: Array<{
    id?: string;
    assessment_date?: string;
    overall_score?: number | null;
    diet_score?: number | null;
    fitness_score?: number | null;
    rest_score?: number | null;
    psychology_score?: number | null;
    exercise_score?: number | null;
    primary_improvement_area?: string | null;
    questionnaire_data?: Record<string, unknown> | null;
  }>,
  detailRank: number | null | undefined,
): string {
  if (!rows.length) {
    return "【历史报告快照】无历史健康评估报告。";
  }
  const listLines = rows.map((r, i) => {
    const d = r.assessment_date ? new Date(r.assessment_date).toLocaleDateString("zh-CN") : "未知日期";
    return `  · 第${i + 1}份（id:${r.id || "—"}，${d}）：综合分${r.overall_score ?? "—"}，首要改善:${r.primary_improvement_area || "—"}`;
  });
  let detail = "";
  if (detailRank && detailRank >= 1 && detailRank <= rows.length) {
    const t = rows[detailRank - 1];
    const q = (t.questionnaire_data || {}) as Record<string, unknown>;
    const cw = q.currentWeight ?? q.current_weight ?? "—";
    const tw = q.targetWeight ?? q.target_weight ?? "—";
    const goal = q.fitnessGoal ?? q.fitness_goal ?? "—";
    detail =
      `\n【历史报告明细-第${detailRank}份】体重:${cw}kg，目标:${tw}kg，目标类型:${goal}，` +
      `维度分: 饮食${t.diet_score ?? "—"}/体能${t.fitness_score ?? "—"}/作息${t.rest_score ?? "—"}/心理${t.psychology_score ?? "—"}/运动${t.exercise_score ?? "—"}。`;
  }
  return `【历史报告快照】共 ${rows.length} 份（按新到旧）：\n${listLines.join("\n")}${detail}`;
}

function formatSupplementCyclePlanSnapshot(
  bundle: SupplementStageBundle,
  focusDateYmd: string | null,
  todayYmd: string,
): string {
  if (!bundle.courseMeta || bundle.timeline.length === 0) {
    return "【补剂周期计划】暂无可用补剂周期排期。";
  }
  const meta = bundle.courseMeta;
  const stageLines = bundle.timeline.map((st) => {
    const names = st.supplements.map((s) => s.name).join("、") || "无补剂配置";
    return `  · 阶段${st.index} ${st.stage_name}：第${st.start_day}-${st.end_day}天；补剂：${names}`;
  });

  let focusLine = "";
  if (focusDateYmd && meta.start_date_ymd) {
    const focusDay = Math.floor(
      (new Date(`${focusDateYmd}T00:00:00+08:00`).getTime() - new Date(`${meta.start_date_ymd}T00:00:00+08:00`).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1;
    const inRange = focusDay >= 1 && focusDay <= meta.total_days;
    if (!inRange) {
      focusLine = `\n【指定日期补剂计划】${focusDateYmd}：不在该补剂疗程范围内（reason_code: out_of_service_cycle）。`;
    } else {
      const stage = bundle.timeline.find((x) => focusDay >= x.start_day && focusDay <= x.end_day);
      const names = stage?.supplements.map((s) => s.name).join("、") || "无";
      focusLine = `\n【指定日期补剂计划】${focusDateYmd}：疗程第${focusDay}天，阶段「${stage?.stage_name || "未知"}」，应服：${names}。`;
    }
  }

  return (
    `【补剂周期计划】疗程总天数${meta.total_days}，当前第${meta.current_day}天（今日:${todayYmd}）。\n` +
    `${stageLines.join("\n")}` +
    focusLine
  );
}

export async function buildDailyAdvisorSnapshot(
  supabase: SupabaseClient,
  menuReadClient: SupabaseClient | undefined,
  userId: string,
  todayYmd: string,
  ownerName: string,
  clientCtx: ClientDailyContext | undefined,
  options?: AdvisorSnapshotOptions,
): Promise<string> {
  const todayStart = `${todayYmd}T00:00:00.000+08:00`;
  const todayEnd = `${todayYmd}T23:59:59.999+08:00`;

  try {
    const includeServiceCycleFull = !!options?.includeServiceCycleFull;
    const focusDateYmd = options?.focusDateYmd || null;
    const includeReportHistory = !!options?.includeReportHistory;
    const reportHistoryLimit = Math.max(1, Math.min(options?.reportHistoryLimit || 10, 20));
    const reportDetailRank = options?.reportDetailRank ?? null;

    const [
      healthTodayRes,
      mergeInputsRes,
      supplementsRes,
      programRes,
      assessmentRes,
      supplementStageBundle,
      deliveryTodayRes,
      focusDateFoodRes,
      reportHistoryRes,
    ] = await Promise.all([
      supabase
        .from("health_records")
        .select("*")
        .eq("user_id", userId)
        .gte("recorded_at", todayStart)
        .lte("recorded_at", todayEnd)
        .limit(500),
      supabase.rpc("get_today_quick_entry_merge_inputs", {
        p_user_id: userId,
        p_day_start: todayStart,
        p_day_end: todayEnd,
      }),
      supabase
        .from("custom_supplements")
        .select("id, supplement_name")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("start_date", { ascending: false }),
      supabase
        .from("execution_programs")
        .select(`
          id,
          status,
          current_day,
          total_days,
          program_type,
          order_id,
          start_date,
          end_date,
          orders (
            order_number,
            products ( product_name )
          )
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("health_assessments")
        .select(
          "assessment_date, overall_score, diet_score, fitness_score, rest_score, psychology_score, exercise_score, primary_improvement_area",
        )
        .eq("user_id", userId)
        .order("assessment_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchActiveSupplementStageBundle(supabase, userId, todayYmd),
      supabase
        .from("delivery_schedules")
        .select(
          "meal_type, delivery_date, status, delivery_address_label, delivery_address, delivery_contact_name, delivery_contact_phone, delivery_addresses ( label, address, door_number )",
        )
        .eq("user_id", userId)
        .eq("delivery_type", "meal")
        .eq("delivery_date", todayYmd)
        .not("meal_type", "is", null)
        .order("meal_type", { ascending: true }),
      focusDateYmd
        ? supabase
            .from("health_records")
            .select("nutrition_data, notes")
            .eq("user_id", userId)
            .eq("record_type", "food")
            .gte("recorded_at", `${focusDateYmd}T00:00:00.000+08:00`)
            .lte("recorded_at", `${focusDateYmd}T23:59:59.999+08:00`)
            .limit(80)
        : Promise.resolve({
            data: [] as Array<{ nutrition_data?: Record<string, unknown> | null; notes?: unknown }>,
            error: null,
          }),
      includeReportHistory
        ? supabase
            .from("health_assessments")
            .select(
              "id, assessment_date, overall_score, diet_score, fitness_score, rest_score, psychology_score, exercise_score, primary_improvement_area, questionnaire_data",
            )
            .eq("user_id", userId)
            .order("assessment_date", { ascending: false })
            .limit(reportHistoryLimit)
        : Promise.resolve({
            data: [] as Array<{
              id?: string;
              assessment_date?: string;
              overall_score?: number | null;
              diet_score?: number | null;
              fitness_score?: number | null;
              rest_score?: number | null;
              psychology_score?: number | null;
              exercise_score?: number | null;
              primary_improvement_area?: string | null;
              questionnaire_data?: Record<string, unknown> | null;
            }>,
            error: null,
          }),
    ]);

    const todayHealth = healthTodayRes.data || [];
    if (mergeInputsRes.error) {
      console.warn("buildDailyAdvisorSnapshot get_today_quick_entry_merge_inputs:", mergeInputsRes.error);
    }
    const mergePayload = mergeInputsRes.data;
    const mergedCards = mergeQuickEntryCardsFromRpcPayload(mergePayload ?? null);
    const { chat_messages: chatQuick } = parseTodayQuickEntryMergeRpcPayload(mergePayload ?? null);
    let supplementRows = supplementsRes.data || [];
    const program = programRes.data;
    const stageSupplementItems = supplementStageBundle.items;
    const supplementCourseMeta = supplementStageBundle.courseMeta;
    if (deliveryTodayRes.error) {
      console.warn("buildDailyAdvisorSnapshot delivery_schedules:", deliveryTodayRes.error);
    }
    const deliverySnapshotBlock = formatTodayDeliverySnapshot(deliveryTodayRes.data || [], todayYmd);
    if (focusDateFoodRes?.error) {
      console.warn("buildDailyAdvisorSnapshot focusDate food:", focusDateFoodRes.error);
    }
    if (reportHistoryRes?.error) {
      console.warn("buildDailyAdvisorSnapshot report history:", reportHistoryRes.error);
    }

    let cycleDeliveryBlock = "";
    const cycleMealDateSet = new Set<string>();
    let cycleStartBound = "";
    let cycleEndBound = "";
    let hasProgramCycle = false;
    if (includeServiceCycleFull) {
      let cycleStart = "";
      let cycleEnd = "";
      if (program?.start_date && program?.end_date) {
        cycleStart = String(program.start_date);
        cycleEnd = String(program.end_date);
      } else if (program?.current_day && program?.total_days) {
        const cur = Number(program.current_day) || 1;
        const tot = Number(program.total_days) || 1;
        const start = new Date(`${todayYmd}T00:00:00+08:00`);
        start.setDate(start.getDate() - Math.max(cur - 1, 0));
        const end = new Date(start);
        end.setDate(end.getDate() + Math.max(tot - 1, 0));
        cycleStart = toBeijingDateString(start);
        cycleEnd = toBeijingDateString(end);
      }
      if (!cycleStart || !cycleEnd) {
        const [earliestRes, latestRes] = await Promise.all([
          supabase
            .from("delivery_schedules")
            .select("delivery_date")
            .eq("user_id", userId)
            .eq("delivery_type", "meal")
            .not("meal_type", "is", null)
            .order("delivery_date", { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("delivery_schedules")
            .select("delivery_date")
            .eq("user_id", userId)
            .eq("delivery_type", "meal")
            .not("meal_type", "is", null)
            .order("delivery_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        const earliest = String(earliestRes.data?.delivery_date || "");
        const latest = String(latestRes.data?.delivery_date || "");
        if (earliest && latest) {
          cycleStart = earliest;
          cycleEnd = latest;
        }
      }
      if (cycleStart && cycleEnd) {
        hasProgramCycle = true;
        cycleStartBound = cycleStart;
        cycleEndBound = cycleEnd;
      }
      if (cycleStart && cycleEnd) {
        const cycleRes = await supabase
          .from("delivery_schedules")
          .select("delivery_date, meal_type, status, delivery_address_label, delivery_address")
          .eq("user_id", userId)
          .eq("delivery_type", "meal")
          .gte("delivery_date", cycleStart)
          .lte("delivery_date", cycleEnd)
          .not("meal_type", "is", null)
          .order("delivery_date", { ascending: true })
          .order("meal_type", { ascending: true });
        if (cycleRes.error) {
          console.warn("buildDailyAdvisorSnapshot cycle schedules:", cycleRes.error);
        } else {
          for (const row of cycleRes.data || []) {
            const d = String(row.delivery_date || "");
            if (d) cycleMealDateSet.add(d);
          }
          cycleDeliveryBlock =
            `【服务周期范围】${cycleStart} ~ ${cycleEnd}\n` +
            formatServiceCycleDeliverySnapshot(cycleRes.data || []);
        }
      } else {
        cycleDeliveryBlock = "【服务周期配送计划】未能确定当前服务周期范围。";
      }
    }

    const focusFoodBlock =
      focusDateYmd && focusDateYmd !== todayYmd
        ? formatFocusDateFoodActualSnapshot(
            focusDateYmd,
            (focusDateFoodRes?.data || []) as Array<{ nutrition_data?: Record<string, unknown> | null; notes?: unknown }>,
          )
        : "";
    const focusMealPlanResult =
      focusDateYmd
        ? await buildFocusDateMealPlanSnapshot(menuReadClient || supabase, userId, focusDateYmd)
        : { block: "【指定日期餐食计划明细】本轮未请求指定日期计划明细。", hasPlan: false };
    const focusMealPlanBlock = focusMealPlanResult.block;

    const reportHistoryBlock = includeReportHistory
      ? formatReportHistorySnapshot(
          (reportHistoryRes?.data || []) as Array<{
            id?: string;
            assessment_date?: string;
            overall_score?: number | null;
            diet_score?: number | null;
            fitness_score?: number | null;
            rest_score?: number | null;
            psychology_score?: number | null;
            exercise_score?: number | null;
            primary_improvement_area?: string | null;
            questionnaire_data?: Record<string, unknown> | null;
          }>,
          reportDetailRank,
        )
      : "";
    const supplementCyclePlanBlock = formatSupplementCyclePlanSnapshot(
      supplementStageBundle,
      focusDateYmd,
      todayYmd,
    );

    let supplementSource = "custom_supplements";
    if (supplementRows.length === 0 && stageSupplementItems.length > 0) {
      supplementRows = stageSupplementItems.map((s) => ({
        id: s.id,
        supplement_name: s.name,
      }));
      supplementSource = "套餐补剂阶段（与 delivery active-supplement-stage 同源）";
    }

    const foodToday = todayHealth.filter((r) => r.record_type === "food");
    const { mealsCount, mealsLabel, detail: mealsDetail } = buildMealsSummaryForToday(foodToday);
    const foodDetailsBlock = formatTodayFoodDetailsLines(foodToday, 35);
    const stepsRecordCount = todayHealth.filter((r) => r.record_type === "steps").length;

    const ingestedSet = new Set<string>();
    if (
      clientCtx?.beijing_date === todayYmd &&
      Array.isArray(clientCtx.supplements_ingested_ids)
    ) {
      for (const id of clientCtx.supplements_ingested_ids) {
        if (typeof id === "string" && id.length > 0) ingestedSet.add(id);
      }
    }

    let supplementLines = "";
    if (supplementRows.length === 0) {
      supplementLines =
        "今日补剂清单：无活跃自定义补剂且无进行中套餐阶段补剂（若刚下单未完成同步，以 App 为准）。";
    } else {
      const doneNames = supplementRows
        .filter((s) => ingestedSet.has(s.id))
        .map((s) => s.supplement_name)
        .slice(0, 25);
      const pendingNames = supplementRows
        .filter((s) => !ingestedSet.has(s.id))
        .map((s) => s.supplement_name)
        .slice(0, 25);
      const ingestedCount = supplementRows.filter((s) => ingestedSet.has(s.id)).length;
      supplementLines =
        `今日补剂（来源：${supplementSource}）：共 ${supplementRows.length} 项；已勾选已摄入 ${ingestedCount} 项。` +
        (doneNames.length ? `已摄入：${doneNames.join("、")}${doneNames.length >= 25 ? "…" : ""}。` : "") +
        (pendingNames.length ? `未勾选：${pendingNames.join("、")}${pendingNames.length >= 25 ? "…" : ""}。` : "") +
        (clientCtx?.beijing_date !== todayYmd
          ? "（本轮未附带 App 当日补剂勾选同步；若以界面为准。）"
          : "");
    }

    const counts: Record<string, number> = {};
    for (const r of todayHealth) {
      const t = r.record_type as string;
      if (t === "food") continue;
      counts[t] = (counts[t] || 0) + 1;
    }

    const countParts = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${METRIC_LABELS[k] || k}×${n}`)
      .slice(0, 14);
    const healthCountsLine = countParts.length > 0 ? countParts.join("，") : "无（除餐食外）";

    const pendingQuick = chatQuick.filter((m) => !m.is_quick_entry_confirmed);
    const pendingByType: Record<string, number> = {};
    for (const m of pendingQuick) {
      const qd = m.quick_entry_data as { metricType?: string } | null;
      const mt = qd?.metricType || "unknown";
      pendingByType[mt] = (pendingByType[mt] || 0) + 1;
    }
    const pendingSummary = pendingQuick.length
      ? `待确认 AI 卡片 ${pendingQuick.length} 条` +
        (Object.keys(pendingByType).length
          ? `（${Object.entries(pendingByType)
              .map(([k, v]) => `${METRIC_LABELS[k] || k}${v}条`)
              .join("，")}）`
          : "") +
        (foodToday.length > 0
          ? "。今日「今日餐食明细」已有健康记录＝餐食已计入档案；回复用户时勿再建议「去确认餐食类 AI 卡片」或「确认后才能入库」，以明细为准；若仍有饮食类待确认卡片，视为历史/重复入口，不要求用户为已入库餐次再点确认。"
          : "——可提醒用户尽快确认以便写入档案。")
      : "待确认 AI 卡片：无。";

    let orderServiceBlock = "";
    if (program?.id) {
      const op = unwrapExecutionProgramOrder(program as Record<string, unknown>);
      orderServiceBlock =
        `【服务订单·执行计划】当前为已同步的套餐/服务第 ${program.current_day} 天 / 共 ${program.total_days} 天（字段 current_day / total_days，与 App 执行页「第几天」一致）。` +
        (program.start_date ? `计划开始日：${program.start_date}；` : "") +
        (program.end_date ? `计划结束日：${program.end_date}；` : "") +
        (op.order_number ? `订单号：${op.order_number}；` : "") +
        (op.product_name ? `商品名称：${op.product_name}。` : "") +
        ` program_type=${program.program_type}。`;
    } else {
      orderServiceBlock =
        "【服务订单·执行计划】当前无「进行中」执行计划，故无「套餐服务第几天」数据（仅购补剂或未同步订单时常见）。";
    }

    let supplementCourseBlock = "";
    if (supplementCourseMeta) {
      const st = supplementCourseMeta.current_day > supplementCourseMeta.total_days ? "（已超过排期总天数，展示为疗程末段）" : "";
      supplementCourseBlock =
        `【补剂服务进度】${st}今日为补剂关联订单疗程第 ${supplementCourseMeta.current_day} 天 / 排期总天数 ${supplementCourseMeta.total_days} 天。` +
        (supplementCourseMeta.current_stage_name
          ? `当前阶段：${supplementCourseMeta.current_stage_name}。`
          : "") +
        (supplementCourseMeta.schedule_name ? `补剂排期：${supplementCourseMeta.schedule_name}。` : "") +
        (supplementCourseMeta.product_name ? `关联商品：${supplementCourseMeta.product_name}。` : "") +
        `订单 id：${supplementCourseMeta.order_id}。`;
    }

    let planActualConflictBlock = "【计划vs实际判读】本轮未触发指定日期判读。";
    if (focusDateYmd && focusDateYmd !== todayYmd && includeServiceCycleFull) {
      const hasActual = ((focusDateFoodRes?.data || []) as Array<unknown>).length > 0;
      const hasMealPlan = cycleMealDateSet.has(focusDateYmd) || focusMealPlanResult.hasPlan;
      const isFutureDate = focusDateYmd > todayYmd;
      const outOfCycleByNoProgram = isFutureDate && !hasProgramCycle;
      const outOfCycleByBound =
        hasProgramCycle &&
        !!cycleStartBound &&
        !!cycleEndBound &&
        (focusDateYmd < cycleStartBound || focusDateYmd > cycleEndBound);

      if (outOfCycleByNoProgram || outOfCycleByBound) {
        planActualConflictBlock =
          `【计划vs实际判读】${focusDateYmd}：该日期超出当前可用服务周期（reason_code: out_of_service_cycle）。回答时明确“当前未在服务周期覆盖范围内”。`;
      } else if (hasMealPlan && hasActual) {
        planActualConflictBlock =
          `【计划vs实际判读】${focusDateYmd}：计划与实际均存在（reason_code: both_present）。回答时先报实际摄入，再补一句该日有排期。`;
      } else if (hasMealPlan && !hasActual) {
        planActualConflictBlock =
          `【计划vs实际判读】${focusDateYmd}：有计划无实绩（reason_code: planned_not_recorded）。回答时明确“目前仅见计划，未见摄入记录”。`;
      } else if (!hasMealPlan && hasActual) {
        planActualConflictBlock =
          `【计划vs实际判读】${focusDateYmd}：无计划有实绩（reason_code: actual_outside_schedule）。回答时明确“该记录可能来自手动/设备/AI录入，不代表配送排期”。`;
      } else {
        planActualConflictBlock =
          `【计划vs实际判读】${focusDateYmd}：计划与实绩均缺失（reason_code: plan_not_generated）。回答时请说明“周期内暂未生成排期或尚未录入实绩”。`;
      }
    }

    const dataReasonCodeBlock =
      "【数据缺失原因码】out_of_service_cycle=不在服务周期内；plan_not_generated=周期内但未生成排期；planned_not_recorded=有排期但无摄入实绩；actual_outside_schedule=有实绩但无排期；both_present=计划与实绩同时存在；no_plan_no_actual=计划与实绩都缺失。";

    let tasksBlock = "";
    if (program?.id) {
      const { data: tasks } = await supabase
        .from("daily_execution_tasks")
        .select("task_type, task_status, scheduled_time")
        .eq("program_id", program.id)
        .eq("task_date", todayYmd);

      const list = tasks || [];
      if (list.length === 0) {
        tasksBlock = `今日执行计划任务：无排期（计划第 ${program.current_day}/${program.total_days} 天，套餐类型 ${program.program_type}）。`;
      } else {
        const done = list.filter((t) => t.task_status === "completed").length;
        const skipped = list.filter((t) => t.task_status === "skipped").length;
        const pending = list.filter((t) => t.task_status === "pending").length;
        const byType: Record<string, number> = {};
        for (const t of list) {
          const lab = TASK_TYPE_LABEL[t.task_type] || t.task_type;
          byType[lab] = (byType[lab] || 0) + 1;
        }
        const typeSummary = Object.entries(byType)
          .map(([k, v]) => `${k}${v}项`)
          .join("，");
        tasksBlock =
          `今日执行计划任务：共 ${list.length} 项（已完成 ${done}，待完成 ${pending}，已跳过 ${skipped}）。类型分布：${typeSummary}。` +
          `当前计划进度：第 ${program.current_day}/${program.total_days} 天。`;
      }
    } else {
      tasksBlock = "今日执行计划：当前无「进行中」的执行计划（与 App 执行页一致时可能尚未同步订单计划）。";
    }

    let assessmentBlock = "";
    const asm = assessmentRes.data;
    if (asm) {
      const d = new Date(asm.assessment_date as string).toLocaleDateString("zh-CN");
      assessmentBlock =
        `最近一次健康评估（${d}）：综合分 ${asm.overall_score ?? "—"}，` +
        `饮食 ${asm.diet_score ?? "—"} / 体能 ${asm.fitness_score ?? "—"} / 休息 ${asm.rest_score ?? "—"} / 心理 ${asm.psychology_score ?? "—"} / 运动 ${asm.exercise_score ?? "—"}。` +
        (asm.primary_improvement_area
          ? ` 首要改善方向：${asm.primary_improvement_area}。`
          : "");
    } else {
      assessmentBlock = "健康评估：库中暂无评估记录（新用户或未完成问卷时会出现）。";
    }

    const deviceStepsHint =
      (counts.steps || 0) > 0
        ? `今日步数库内记录 ${counts.steps} 条。`
        : "今日步数：库中无步数类记录。";

    const recordedBlock = buildRecordedDataFeedbackBlock(
      ownerName.trim() || "用户",
      mealsCount,
      stepsRecordCount,
      mergedCards,
    );

    let outOrder = orderServiceBlock;
    let outDelivery = deliverySnapshotBlock;
    let outCycle = cycleDeliveryBlock || "【服务周期配送计划】本轮未请求全周期快照。";
    let outSuppCourse = supplementCourseBlock || "【补剂服务进度】无进行中补剂疗程订单，或排期未同步。";
    let outSuppCycle = supplementCyclePlanBlock;
    let outSuppLines = supplementLines;
    let outFocusMeal = focusMealPlanBlock;
    let outPlanActual = planActualConflictBlock;
    let outTasks = tasksBlock;

    if (options?.intake_plan_active === false) {
      outOrder =
        "【服务订单·执行计划】摄入托管计划尚未开启：请先在「我的配送计划」完成配置后再查看托管向内容；禁止编造排期/菜单/补剂疗程。";
      outDelivery = "【今日餐食配送】计划未开启，不提供托管配送快照。";
      outCycle = "【服务周期配送计划】计划未开启。";
      outSuppCourse = "【补剂服务进度】计划未开启。";
      outSuppCycle = "【补剂周期计划】计划未开启。";
      outSuppLines = "今日补剂清单：计划未开启前不提供托管向清单。";
      outFocusMeal = focusDateYmd
        ? `【指定日期餐食计划明细】${focusDateYmd}：计划未开启，不提供排期套餐明细。`
        : "【指定日期餐食计划明细】计划未开启。";
      outPlanActual = "【计划vs实际判读】计划未开启。";
      outTasks = "今日执行计划任务：计划未开启，不提供餐食配送类托管任务细节。";
    }

    return `
【今日日反馈对齐快照】（北京日历日 ${todayYmd}；用户称呼参考「${ownerName}」）
- ${mealsLabel}。${mealsDetail}
- ${foodDetailsBlock}
- ${outOrder}
- ${outDelivery}
- ${outCycle}
- ${outSuppCourse}
- ${outSuppCycle}
- ${outSuppLines}
- ${outFocusMeal}
- ${focusFoodBlock || "【指定日期餐食实绩】本轮未请求指定日期实绩。"}
- ${reportHistoryBlock || "【历史报告快照】本轮未请求历史报告列表。"}
- ${outPlanActual}
- ${dataReasonCodeBlock}
- 今日库内健康记录（除餐食，原始行数）：${healthCountsLine}。${deviceStepsHint}
- ${pendingSummary}
- ${outTasks}
- ${assessmentBlock}
- ${recordedBlock}
（说明：用户问「今天吃了什么」用上文餐食明细；若明细非空则餐食已入库，勿再让用户确认餐食卡片；用户说「补剂+今天/今日吃什么、吃啥」是在问今日补剂安排，须用「今日补剂」与【补剂周期计划】等作答，勿用大段餐食套餐明细顶替；问「送到哪/配送/晚餐送到哪」用【今日餐食配送】；问「服务/订单第几天」用【服务订单·执行计划】与【补剂服务进度】；勿臆测。${
      options?.intake_plan_active === false
        ? " 当前摄入托管计划未开启：不得编造菜单/配送/补剂排期；引导用户在「我的配送计划」完成配置后再查看；可引用已入库健康记录。"
        : ""
    }）`.trim();
  } catch (e) {
    console.error("buildDailyAdvisorSnapshot error:", e);
    return "";
  }
}

/** 仅补剂：跳过餐食/配送/评估/任务等查询与长快照，降低延迟并避免模型把全文复述进回复 */
export async function buildSupplementAdvisorSnapshotLite(
  supabase: SupabaseClient,
  userId: string,
  todayYmd: string,
  clientCtx: ClientDailyContext | undefined,
  options?: { intake_plan_active?: boolean },
): Promise<string> {
  try {
    if (options?.intake_plan_active === false) {
      return `
【今日补剂快照】（北京日 ${todayYmd}）
- 【摄入托管计划状态】摄入托管计划尚未开启：请先在「我的配送计划」完成配置后再查看；禁止编造补剂疗程/清单。
（说明：仅用本节 1～2 句回答；禁止输出「今日配送」等大段无关内容。）`.trim();
    }

    const [{ data: supplementsRes }, bundle] = await Promise.all([
      supabase
        .from("custom_supplements")
        .select("id, supplement_name")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("start_date", { ascending: false }),
      fetchActiveSupplementStageBundle(supabase, userId, todayYmd),
    ]);

    let supplementRows = (supplementsRes || []) as { id: string; supplement_name: string }[];
    const stageSupplementItems = bundle.items;
    let supplementSource = "custom_supplements";
    if (supplementRows.length === 0 && stageSupplementItems.length > 0) {
      supplementRows = stageSupplementItems.map((s) => ({ id: s.id, supplement_name: s.name }));
      supplementSource = "套餐补剂阶段（与 delivery active-supplement-stage 同源）";
    }

    const ingestedSet = new Set<string>();
    if (clientCtx?.beijing_date === todayYmd && Array.isArray(clientCtx.supplements_ingested_ids)) {
      for (const id of clientCtx.supplements_ingested_ids) {
        if (typeof id === "string" && id.length > 0) ingestedSet.add(id);
      }
    }

    let supplementLines = "";
    if (supplementRows.length === 0) {
      supplementLines =
        "今日补剂清单：无活跃自定义补剂且无进行中套餐阶段补剂（若刚下单未完成同步，以 App 为准）。";
    } else {
      const doneNames = supplementRows
        .filter((s) => ingestedSet.has(s.id))
        .map((s) => s.supplement_name)
        .slice(0, 25);
      const pendingNames = supplementRows
        .filter((s) => !ingestedSet.has(s.id))
        .map((s) => s.supplement_name)
        .slice(0, 25);
      const ingestedCount = supplementRows.filter((s) => ingestedSet.has(s.id)).length;
      supplementLines =
        `今日补剂（来源：${supplementSource}）：共 ${supplementRows.length} 项；已勾选已摄入 ${ingestedCount} 项。` +
        (doneNames.length ? `已摄入：${doneNames.join("、")}${doneNames.length >= 25 ? "…" : ""}。` : "") +
        (pendingNames.length ? `未勾选：${pendingNames.join("、")}${pendingNames.length >= 25 ? "…" : ""}。` : "") +
        (clientCtx?.beijing_date !== todayYmd
          ? "（本轮未附带 App 当日补剂勾选同步；若以界面为准。）"
          : "");
    }

    let supplementCourseLine = "【补剂服务进度】无进行中补剂疗程订单，或排期未同步。";
    const supplementCourseMeta = bundle.courseMeta;
    if (supplementCourseMeta) {
      const st =
        supplementCourseMeta.current_day > supplementCourseMeta.total_days
          ? "（已超过排期总天数，展示为疗程末段）"
          : "";
      supplementCourseLine =
        `【补剂服务进度】${st}今日为补剂关联订单疗程第 ${supplementCourseMeta.current_day} 天 / 排期总天数 ${supplementCourseMeta.total_days} 天。` +
        (supplementCourseMeta.current_stage_name ? `当前阶段：${supplementCourseMeta.current_stage_name}。` : "") +
        (supplementCourseMeta.schedule_name ? `补剂排期：${supplementCourseMeta.schedule_name}。` : "") +
        (supplementCourseMeta.product_name ? `关联商品：${supplementCourseMeta.product_name}。` : "") +
        `订单 id：${supplementCourseMeta.order_id}。`;
    }
    const supplementCycleLine = formatSupplementCyclePlanSnapshot(bundle, null, todayYmd);

    return `
【今日补剂快照】（北京日 ${todayYmd}）
- ${supplementCourseLine}
- ${supplementCycleLine}
- ${supplementLines}
（说明：用户问「补剂 今天/今日吃什么、吃啥」是在问今日应服补剂安排，不是正餐菜单；仅用本节作答。若只是在问补剂是否已吃，也只用本节 1～3 句；禁止输出「今日配送」「日反馈摘要」「健康评估」等无关段落；禁止以「为你同步一下今天」类话术开头。）`.trim();
  } catch (e) {
    console.error("buildSupplementAdvisorSnapshotLite error:", e);
    return "";
  }
}
