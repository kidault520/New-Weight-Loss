/**
 * 与 App healthMetricDetectionService.isValidData 口径对齐的 parsed_metrics 清洗/校验。
 * 丢弃未知类型、非有限数字、越界与缺必填字段的项，降低伪造与字段漂移进入系统提示的风险。
 */

export type ParsedMetricItem = {
  metricType: string;
  value?: number;
  unit?: string;
  foodName?: string;
  calories?: number;
  quantity?: number;
  exerciseName?: string;
  duration?: number;
  supplementName?: string;
  emotionType?: string;
};

const ALLOWED_METRIC_TYPES = new Set<string>([
  "food",
  "water",
  "exercise",
  "steps",
  "weight",
  "sleep",
  "measurements",
  "emotion",
  "blood_glucose",
  "supplement",
]);

const EMOTION_TYPES = new Set([
  "happy",
  "sad",
  "neutral",
  "excited",
  "tired",
  "worried",
  "angry",
]);

const MAX_ITEMS = 12;
const MAX_LABEL_LEN = 120;
const MAX_UNIT_LEN = 24;

function clampStr(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function toFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim().replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

/**
 * 将请求体中的 parsed_metrics 规范为可进入提示词的安全列表（与客户端检测规则一致）。
 */
export function sanitizeParsedMetricsArray(raw: unknown): ParsedMetricItem[] {
  if (!Array.isArray(raw)) return [];

  const out: ParsedMetricItem[] = [];
  for (const el of raw.slice(0, MAX_ITEMS)) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;

    const mtRaw = clampStr(o.metricType, 32);
    if (!mtRaw) continue;
    const metricType = mtRaw.toLowerCase();
    if (!ALLOWED_METRIC_TYPES.has(metricType)) continue;

    switch (metricType) {
      case "food": {
        const calories = toFiniteNumber(o.calories);
        if (calories == null || calories <= 0 || calories >= 5000) continue;
        const foodName = clampStr(o.foodName, MAX_LABEL_LEN) || "食物";
        const quantity = toFiniteNumber(o.quantity);
        const item: ParsedMetricItem = { metricType, foodName, calories };
        const v = toFiniteNumber(o.value);
        if (v != null && inRange(v, 0, 1e6)) item.value = v;
        if (quantity != null && inRange(quantity, 0, 500)) item.quantity = quantity;
        out.push(item);
        break;
      }
      case "water": {
        const value = toFiniteNumber(o.value);
        if (value == null || !inRange(value, 1, 10000)) continue;
        const unit = clampStr(o.unit, MAX_UNIT_LEN) || "ml";
        out.push({ metricType, value, unit });
        break;
      }
      case "exercise": {
        const duration = toFiniteNumber(o.duration);
        if (duration == null || !inRange(duration, 1, 300)) continue;
        const item: ParsedMetricItem = { metricType, duration };
        const calories = toFiniteNumber(o.calories);
        if (calories != null && inRange(calories, 0, 8000)) item.calories = calories;
        const exerciseName = clampStr(o.exerciseName, MAX_LABEL_LEN);
        item.exerciseName = exerciseName || "运动";
        const v = toFiniteNumber(o.value);
        if (v != null && inRange(v, 0, 300)) item.value = v;
        out.push(item);
        break;
      }
      case "steps": {
        const value = toFiniteNumber(o.value);
        if (value == null || !inRange(value, 0, 100000)) continue;
        out.push({ metricType, value });
        break;
      }
      case "weight": {
        const value = toFiniteNumber(o.value);
        if (value == null || !inRange(value, 15, 400)) continue;
        out.push({ metricType, value });
        break;
      }
      case "sleep": {
        const value = toFiniteNumber(o.value);
        if (value == null || !inRange(value, 0.1, 24)) continue;
        out.push({ metricType, value });
        break;
      }
      case "blood_glucose": {
        const value = toFiniteNumber(o.value);
        if (value == null || !inRange(value, 0.1, 30)) continue;
        const unit = clampStr(o.unit, MAX_UNIT_LEN) || "mmol/L";
        out.push({ metricType, value, unit });
        break;
      }
      case "emotion": {
        const emotionRaw = clampStr(o.emotionType, 32)?.toLowerCase();
        if (!emotionRaw || !EMOTION_TYPES.has(emotionRaw)) continue;
        const value = toFiniteNumber(o.value);
        if (value != null && !inRange(value, 0, 10)) continue;
        out.push({
          metricType,
          emotionType: emotionRaw,
          ...(value != null ? { value } : {}),
        });
        break;
      }
      case "supplement": {
        const supplementName = clampStr(o.supplementName, MAX_LABEL_LEN);
        if (!supplementName) continue;
        out.push({ metricType, supplementName });
        break;
      }
      case "measurements": {
        const md = o.measurements;
        if (!md || typeof md !== "object") continue;
        let ok = false;
        for (const x of Object.values(md as Record<string, unknown>)) {
          const n = toFiniteNumber(x);
          if (n != null && inRange(n, 1, 500)) {
            ok = true;
            break;
          }
        }
        if (!ok) continue;
        out.push({ metricType });
        break;
      }
      default:
        break;
    }
  }

  return out;
}

/** 写入系统提示中与 index 历史口径一致的逐行文案 */
export function formatParsedMetricLinesForPrompt(items: ParsedMetricItem[]): string {
  return items
    .map((m) => {
      if (m.metricType === "water") return `- 饮水：${m.value}${m.unit || "ml"}`;
      if (m.metricType === "weight") return `- 体重：${m.value}kg`;
      if (m.metricType === "food") {
        return `- 饮食：${m.foodName || "食物"}${m.calories ? ` ${m.calories}千卡` : ""}${m.quantity ? ` ×${m.quantity}` : ""}`;
      }
      if (m.metricType === "exercise") {
        return `- 运动：${m.exerciseName || "运动"}${m.duration ? ` ${m.duration}分钟` : ""}${
          m.calories ? ` 消耗${m.calories}千卡` : ""
        }`;
      }
      if (m.metricType === "supplement") return `- 补剂：${m.supplementName || "补剂"}`;
      if (m.metricType === "steps") return `- 步数：${m.value}步`;
      if (m.metricType === "sleep") return `- 睡眠：${m.value}小时`;
      if (m.metricType === "blood_glucose") return `- 血糖：${m.value}${m.unit || "mmol/L"}`;
      if (m.metricType === "emotion") {
        return `- 心情：${m.emotionType || "记录"}${m.value != null ? `（强度 ${m.value}）` : ""}`;
      }
      if (m.metricType === "measurements") return `- 围度：已记录（详见 App 待确认卡片）`;
      return `- ${m.metricType}：${m.value ?? "—"}${m.unit ? m.unit : ""}`;
    })
    .join("\n");
}
