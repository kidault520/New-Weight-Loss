import { supabase } from '../config/supabase';

export type BreathingSource = 'dashboard' | 'chat_card';

export interface BreathingSessionPayload {
  startedAt: Date;
  durationSec: number;
  modeId: string;
  modeLabel: string;
  cycles: number;
  completed: boolean;
  source: BreathingSource;
  chatMessageId?: string | null;
}

export async function insertBreathingSession(
  userId: string,
  payload: BreathingSessionPayload,
): Promise<{ error: Error | null; id?: string }> {
  const row: Record<string, unknown> = {
    user_id: userId,
    record_type: 'breathing',
    value: Math.max(0, Math.round(payload.durationSec)),
    unit: '秒',
    recorded_at: payload.startedAt.toISOString(),
    breathing_data: {
      mode_id: payload.modeId,
      mode_label: payload.modeLabel,
      cycles_completed: payload.cycles,
      completed: payload.completed,
      duration_sec: Math.max(0, Math.round(payload.durationSec)),
      source: payload.source,
    },
    notes: `${payload.modeLabel} · ${Math.max(0, Math.round(payload.durationSec))}秒 · ${payload.cycles}周期`,
  };
  if (payload.chatMessageId) {
    row.chat_message_id = payload.chatMessageId;
  }

  const { data, error } = await supabase.from('health_records').insert(row).select('id').single();
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null, id: data?.id as string | undefined };
}

/** 练习结束后补记心情，便于列表展示 emoji，并与心情罐记录对应 */
export async function updateBreathingPostMood(
  userId: string,
  recordId: string,
  mood: { key: string; label: string },
): Promise<{ error: Error | null }> {
  const { data: row, error: fetchErr } = await supabase
    .from('health_records')
    .select('breathing_data')
    .eq('id', recordId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) {
    return { error: new Error(fetchErr.message) };
  }
  if (!row) {
    return { error: new Error('record not found') };
  }

  const bd = (row.breathing_data && typeof row.breathing_data === 'object'
    ? row.breathing_data
    : {}) as Record<string, unknown>;
  const next = {
    ...bd,
    post_mood_key: mood.key,
    post_mood_label: mood.label,
  };

  const { error } = await supabase.from('health_records').update({ breathing_data: next }).eq('id', recordId);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export interface BreathingRecordRow {
  id: string;
  recorded_at: string;
  value: number;
  breathing_data: {
    mode_id?: string;
    mode_label?: string;
    cycles_completed?: number;
    completed?: boolean;
    duration_sec?: number;
    source?: string;
    post_mood_key?: string;
    post_mood_label?: string;
  } | null;
}

export async function fetchBreathingRecordsForDay(
  userId: string,
  dayStartIso: string,
  dayEndIso: string,
): Promise<BreathingRecordRow[]> {
  const { data, error } = await supabase
    .from('health_records')
    .select('id, recorded_at, value, breathing_data')
    .eq('user_id', userId)
    .eq('record_type', 'breathing')
    .gte('recorded_at', dayStartIso)
    .lte('recorded_at', dayEndIso)
    .order('recorded_at', { ascending: false })
    .limit(40);

  if (error) {
    console.warn('[breathingService] fetchBreathingRecordsForDay:', error);
    return [];
  }
  return (data || []) as BreathingRecordRow[];
}
