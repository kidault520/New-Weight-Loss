/**
 * 将 sanitize 后的 parsed_metrics 与近期 chat_messages（quickEntry）中的 quick_entry_data 交叉核对。
 * 已匹配的条目视为「待确认卡片同源」；未匹配视为客户端单方声明，提示词中降级表述。
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { ParsedMetricItem } from "./parsedMetricsSanitize.ts";

function nz(s: string | undefined): string {
  return (s || "").trim().toLowerCase();
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim().replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function namesLooselyMatch(a: string | undefined, b: string | undefined): boolean {
  const x = nz(a);
  const y = nz(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

/** quick_entry_data（库内）是否与已清洗的 parsed 项一致（容差与 sanitize 口径配套） */
export function quickEntryDataMatchesParsed(q: Record<string, unknown>, p: ParsedMetricItem): boolean {
  const mt = String(q.metricType || "").toLowerCase();
  if (mt !== p.metricType) return false;

  switch (p.metricType) {
    case "water": {
      const qv = num(q.value);
      if (qv == null || p.value == null) return false;
      return Math.abs(qv - p.value) < 2.5;
    }
    case "weight": {
      const qv = num(q.value);
      if (qv == null || p.value == null) return false;
      return Math.abs(qv - p.value) < 0.35;
    }
    case "steps": {
      const qv = num(q.value);
      if (qv == null || p.value == null) return false;
      return Math.abs(qv - p.value) <= 25;
    }
    case "sleep": {
      const qv = num(q.value);
      if (qv == null || p.value == null) return false;
      return Math.abs(qv - p.value) < 0.25;
    }
    case "blood_glucose": {
      const qv = num(q.value);
      if (qv == null || p.value == null) return false;
      return Math.abs(qv - p.value) < 0.25;
    }
    case "food": {
      const qc = num(q.calories);
      const pc = p.calories;
      if (qc == null || pc == null) return false;
      if (Math.abs(qc - pc) > 5) return false;
      if (namesLooselyMatch(q.foodName as string | undefined, p.foodName)) return true;
      if (nz(p.foodName) === "食物" && Math.abs(qc - pc) <= 3) return true;
      return false;
    }
    case "exercise": {
      const qd = num(q.duration);
      const pd = p.duration;
      if (qd == null || pd == null) return false;
      if (Math.abs(qd - pd) > 2.5) return false;
      const qn = typeof q.exerciseName === "string" ? q.exerciseName : "";
      const pn = p.exerciseName || "";
      if (nz(qn) && nz(pn)) return namesLooselyMatch(qn, pn);
      return true;
    }
    case "supplement": {
      return nz(q.supplementName as string | undefined) === nz(p.supplementName);
    }
    case "emotion": {
      const qt = String(q.emotionType || "").toLowerCase();
      const pt = String(p.emotionType || "").toLowerCase();
      if (!qt || qt !== pt) return false;
      const qv = num(q.value);
      const pv = p.value;
      if (qv == null || pv == null) return true;
      return Math.abs(qv - pv) < 0.55;
    }
    case "measurements": {
      const md = q.measurements;
      if (!md || typeof md !== "object") return false;
      return Object.values(md as Record<string, unknown>).some((x) => {
        const n = num(x);
        return n != null && n >= 1 && n <= 500;
      });
    }
    default:
      return false;
  }
}

const CORROBORATE_WINDOW_MS = 12 * 60 * 1000;
const MAX_QUICK_ENTRY_ROWS = 50;

export async function corroborateParsedMetricsWithRecentQuickEntries(
  supabase: SupabaseClient,
  userId: string,
  items: ParsedMetricItem[],
): Promise<{ trusted: ParsedMetricItem[]; untrusted: ParsedMetricItem[] }> {
  if (items.length === 0) return { trusted: [], untrusted: [] };

  const since = new Date(Date.now() - CORROBORATE_WINDOW_MS).toISOString();
  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id, quick_entry_data")
    .eq("user_id", userId)
    .eq("message_type", "quickEntry")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_QUICK_ENTRY_ROWS);

  if (error) {
    console.warn("[parsed_metrics corroborate] chat_messages query failed:", error);
    return { trusted: [], untrusted: [...items] };
  }

  const candidates = (rows || [])
    .map((r) => ({
      id: String(r.id),
      qe: r.quick_entry_data as Record<string, unknown> | null,
    }))
    .filter((x) => x.qe != null && typeof x.qe === "object");

  const used = new Set<string>();
  const trusted: ParsedMetricItem[] = [];
  const untrusted: ParsedMetricItem[] = [];

  for (const p of items) {
    let matchedId: string | null = null;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      if (quickEntryDataMatchesParsed(c.qe!, p)) {
        matchedId = c.id;
        break;
      }
    }
    if (matchedId) {
      used.add(matchedId);
      trusted.push(p);
    } else {
      untrusted.push(p);
    }
  }

  return { trusted, untrusted };
}
