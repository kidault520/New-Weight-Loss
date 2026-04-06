import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Pause, Square, Play, Volume2, VolumeX, MoreHorizontal, Flower2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  insertBreathingSession,
  updateBreathingPostMood,
  type BreathingSource,
} from '../../services/breathingService';
import emotionService from '../../services/emotionService';
import { useInvalidateBreathingQueries } from '../../hooks/useBreathingDayQuery';
import { useBreathingDayQuery } from '../../hooks/useBreathingDayQuery';
import { getEmotionEmoji } from '../../utils/emotionEmoji';
import { startBreathingAmbient, type BreathingAmbientStop } from './breathingAmbientAudio';

export type BreathingPhaseKind = 'inhale' | 'hold' | 'exhale';

export interface BreathingModeDef {
  id: string;
  label: string;
  hint: string;
  pattern: { kind: BreathingPhaseKind; sec: number }[];
}

export const BREATHING_MODES: BreathingModeDef[] = [
  {
    id: 'four_seven_eight',
    label: '4-7-8 放松呼吸',
    hint: '助眠、缓解焦虑',
    pattern: [
      { kind: 'inhale', sec: 4 },
      { kind: 'hold', sec: 7 },
      { kind: 'exhale', sec: 8 },
    ],
  },
  {
    id: 'box',
    label: '方盒呼吸',
    hint: '提升专注力',
    pattern: [
      { kind: 'inhale', sec: 4 },
      { kind: 'hold', sec: 4 },
      { kind: 'exhale', sec: 4 },
      { kind: 'hold', sec: 4 },
    ],
  },
  {
    id: 'deep',
    label: '深呼吸',
    hint: '日常放松',
    pattern: [
      { kind: 'inhale', sec: 4 },
      { kind: 'exhale', sec: 6 },
    ],
  },
];

function phaseLabel(kind: BreathingPhaseKind): string {
  if (kind === 'inhale') return '吸气';
  if (kind === 'exhale') return '呼气';
  return '屏息';
}

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** 与心情罐 emotion 记录一致（英文 key + getEmotionEmoji） */
const POST_BREATHING_MOODS: {
  key: string;
  label: string;
  emoji: string;
  intensity: number;
}[] = [
  { key: 'calm', label: '平静', emoji: '😌', intensity: 0.58 },
  { key: 'happy', label: '愉悦', emoji: '😊', intensity: 0.68 },
  { key: 'excited', label: '充沛', emoji: '🤩', intensity: 0.72 },
  { key: 'tired', label: '困倦', emoji: '😴', intensity: 0.42 },
  { key: 'worried', label: '焦虑', emoji: '😰', intensity: 0.4 },
  { key: 'focused', label: '专注', emoji: '🧘', intensity: 0.62 },
];

export interface BreathingPracticeOverlayProps {
  onClose: (detail?: { recordedBreathing?: boolean }) => void;
  source: BreathingSource;
  /** 从聊天便签进入时可传，便于关联 */
  chatMessageId?: string | null;
}

const BreathingPracticeOverlay: React.FC<BreathingPracticeOverlayProps> = ({
  onClose,
  source,
  chatMessageId,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidateBreathing = useInvalidateBreathingQueries();
  const { data: todayRows = [] } = useBreathingDayQuery();

  const [screen, setScreen] = useState<'home' | 'pick' | 'run' | 'complete'>('home');
  const [selectedMode, setSelectedMode] = useState<BreathingModeDef | null>(null);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [runElapsedSec, setRunElapsedSec] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remainInPhase, setRemainInPhase] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [summaryCompleted, setSummaryCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastBreathingRecordId, setLastBreathingRecordId] = useState<string | null>(null);
  const [selectedPostMoodKey, setSelectedPostMoodKey] = useState<string | null>(null);
  const [moodSaving, setMoodSaving] = useState(false);
  const [moodSavedHint, setMoodSavedHint] = useState(false);

  const didRecordBreathingRef = useRef(false);
  const ambientStopRef = useRef<BreathingAmbientStop | null>(null);
  const lastTickMsRef = useRef<number | null>(null);
  const phaseIdxRef = useRef(0);
  const remainRef = useRef(0);
  const runElapsedRef = useRef(0);
  const cyclesRef = useRef(0);

  const stopAmbient = useCallback(() => {
    if (ambientStopRef.current) {
      ambientStopRef.current();
      ambientStopRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopAmbient();
  }, [stopAmbient]);

  const ensureAmbient = useCallback(() => {
    if (!soundOn) {
      stopAmbient();
      return;
    }
    if (ambientStopRef.current) return;
    const stop = startBreathingAmbient();
    ambientStopRef.current = stop;
  }, [soundOn, stopAmbient]);

  useEffect(() => {
    if (screen === 'run' && !paused) ensureAmbient();
    else if (!soundOn) stopAmbient();
  }, [soundOn, screen, paused, ensureAmbient, stopAmbient]);

  const resetRun = useCallback((mode: BreathingModeDef) => {
    const now = Date.now();
    setSelectedMode(mode);
    setSessionStartMs(now);
    setPhaseIndex(0);
    setCycles(0);
    setRunElapsedSec(0);
    const firstDur = mode.pattern[0]?.sec ?? 4;
    setRemainInPhase(firstDur);
    phaseIdxRef.current = 0;
    remainRef.current = firstDur;
    runElapsedRef.current = 0;
    cyclesRef.current = 0;
    setPaused(false);
    lastTickMsRef.current = now;
  }, []);

  const beginPractice = useCallback(
    (mode: BreathingModeDef) => {
      resetRun(mode);
      setScreen('run');
      ensureAmbient();
    },
    [ensureAmbient, resetRun],
  );

  useEffect(() => {
    phaseIdxRef.current = phaseIndex;
  }, [phaseIndex]);

  useEffect(() => {
    remainRef.current = remainInPhase;
  }, [remainInPhase]);

  useEffect(() => {
    runElapsedRef.current = runElapsedSec;
  }, [runElapsedSec]);

  useEffect(() => {
    cyclesRef.current = cycles;
  }, [cycles]);

  useEffect(() => {
    if (screen !== 'run' || !selectedMode || paused) return;
    const pattern = selectedMode.pattern;
    const id = window.setInterval(() => {
      const now = Date.now();
      const prev = lastTickMsRef.current ?? now;
      const dt = Math.min(0.45, Math.max(0, (now - prev) / 1000));
      lastTickMsRef.current = now;

      setRunElapsedSec((s) => {
        const ns = s + dt;
        runElapsedRef.current = ns;
        return ns;
      });

      let rem = remainRef.current - dt;
      let idx = phaseIdxRef.current;
      if (rem <= 0) {
        idx = (idx + 1) % pattern.length;
        if (idx === 0) {
          setCycles((c) => {
            const nc = c + 1;
            cyclesRef.current = nc;
            return nc;
          });
        }
        rem = pattern[idx]?.sec ?? 1;
        phaseIdxRef.current = idx;
        remainRef.current = rem;
        setPhaseIndex(idx);
        setRemainInPhase(rem);
        return;
      }
      remainRef.current = rem;
      setRemainInPhase(rem);
    }, 110);
    return () => window.clearInterval(id);
  }, [screen, selectedMode, paused]);

  const persistSession = useCallback(
    async (completed: boolean): Promise<string | null> => {
      if (!user?.id || !selectedMode || sessionStartMs == null) return null;
      const durationSec = Math.max(1, Math.floor(runElapsedRef.current) || 1);
      const startedAt = new Date(sessionStartMs);
      const cy = cyclesRef.current;
      try {
        const { error, id } = await insertBreathingSession(user.id, {
          startedAt,
          durationSec,
          modeId: selectedMode.id,
          modeLabel: selectedMode.label,
          cycles: cy,
          completed,
          source,
          chatMessageId: chatMessageId ?? undefined,
        });
        if (error) {
          console.warn('[BreathingPracticeOverlay] save failed', error);
          return null;
        }
        didRecordBreathingRef.current = true;
        invalidateBreathing();
        return id ?? null;
      } catch (e) {
        console.warn('[BreathingPracticeOverlay] save failed', e);
        return null;
      }
    },
    [user?.id, selectedMode, sessionStartMs, source, chatMessageId, invalidateBreathing],
  );

  const goSummary = useCallback(
    (completed: boolean) => {
      stopAmbient();
      setSummaryCompleted(completed);
      setLastBreathingRecordId(null);
      setSelectedPostMoodKey(null);
      setMoodSavedHint(false);
      setScreen('complete');
      setSaving(true);
      void persistSession(completed).then((id) => {
        setLastBreathingRecordId(id);
        setSaving(false);
      });
    },
    [persistSession, stopAmbient],
  );

  const requestClose = useCallback(() => {
    stopAmbient();
    const recorded = didRecordBreathingRef.current;
    didRecordBreathingRef.current = false;
    onClose({ recordedBreathing: recorded });
  }, [onClose, stopAmbient]);

  const backToBreathingHome = useCallback(() => {
    setScreen('home');
    setSelectedPostMoodKey(null);
    setMoodSavedHint(false);
    setLastBreathingRecordId(null);
    setSelectedMode(null);
    setSessionStartMs(null);
    setRunElapsedSec(0);
    setPhaseIndex(0);
    setRemainInPhase(0);
    setCycles(0);
    setPaused(false);
    setSummaryCompleted(false);
    setSaving(false);
  }, []);

  const savePostBreathingMood = useCallback(async () => {
    if (!user?.id || !selectedPostMoodKey || !selectedMode) return;
    const opt = POST_BREATHING_MOODS.find((m) => m.key === selectedPostMoodKey);
    if (!opt) return;
    setMoodSaving(true);
    setMoodSavedHint(false);
    try {
      const msg = `呼吸练习后 · ${selectedMode.label} · ${opt.label}`;
      await emotionService.addEmotionRecord(user.id, opt.key, opt.intensity, msg);
      if (lastBreathingRecordId) {
        const { error } = await updateBreathingPostMood(user.id, lastBreathingRecordId, {
          key: opt.key,
          label: opt.label,
        });
        if (error) {
          console.warn('[BreathingPracticeOverlay] breathing mood patch failed', error);
        }
      }
      invalidateBreathing();
      void queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      backToBreathingHome();
    } catch (e) {
      console.warn('[BreathingPracticeOverlay] mood save failed', e);
    } finally {
      setMoodSaving(false);
    }
  }, [
    user?.id,
    selectedPostMoodKey,
    selectedMode,
    lastBreathingRecordId,
    invalidateBreathing,
    queryClient,
    backToBreathingHome,
  ]);

  const togglePause = () => {
    if (paused) {
      setPaused(false);
      lastTickMsRef.current = Date.now();
      ensureAmbient();
    } else {
      setPaused(true);
      stopAmbient();
    }
  };

  const orbScale = (() => {
    if (!selectedMode || screen !== 'run') return 1;
    const p = selectedMode.pattern[phaseIndex];
    if (!p) return 1;
    const t = 1 - remainInPhase / Math.max(0.001, p.sec);
    if (p.kind === 'inhale') return 1 + 0.32 * Math.min(1, t);
    if (p.kind === 'exhale') return 1.32 - 0.32 * Math.min(1, t);
    return 1.32;
  })();

  return (
    <div
      className="fixed inset-0 z-[200] flex justify-center bg-transparent"
      role="dialog"
      aria-modal="true"
      aria-label="练习呼吸"
    >
      {/* 深色背景与内容同宽 max-w-sm（384px）居中；视口其余区域透明，与 App 主栏一致 */}
      <div className="relative flex h-[100dvh] w-full max-w-sm min-w-0 flex-col overflow-hidden bg-[#0a0e1a] text-white shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(ellipse at 50% 35%, #3d2b69 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #1a2744 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-end gap-2 px-3 pt-3 pb-1">
            {screen === 'complete' ? (
              <div className="flex w-full justify-end">
                <div className="inline-flex items-center gap-0.5 rounded-full bg-white/10 p-0.5">
                  <button
                    type="button"
                    className="rounded-full p-2 text-white/85 hover:bg-white/10"
                    aria-label="更多"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={requestClose}
                    className="rounded-full p-2 text-white/90 hover:bg-white/10"
                    aria-label="关闭"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {screen === 'run' && (
                  <button
                    type="button"
                    onClick={() => setSoundOn((v) => !v)}
                    className="rounded-full bg-white/10 p-2 text-white/90"
                    aria-label={soundOn ? '关闭背景音乐' : '开启背景音乐'}
                  >
                    {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={requestClose}
                  className="rounded-full bg-white/10 p-2 text-white/90"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            )}
          </header>

      {screen === 'home' && (
        <div className="flex-1 flex flex-col px-3 pb-6 min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center min-h-[140px]">
            <div
              className="w-40 h-40 rounded-full mb-6 shadow-[0_0_60px_rgba(124,92,255,0.45)]"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #a78bfa 0%, #6366f1 45%, #312e81 100%)',
              }}
            />
          </div>
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-1 text-xs text-violet-200/80">练习记录</div>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {todayRows.length === 0 ? (
                <p className="text-sm text-white/50">今日还没有记录，点击下方开始第一次练习</p>
              ) : (
                todayRows.slice(0, 8).map((r) => {
                  const bd = r.breathing_data;
                  const label = bd?.mode_label || '呼吸练习';
                  const dur = bd?.duration_sec ?? (Number(r.value) || 0);
                  const cy = bd?.cycles_completed ?? 0;
                  const moodKey = bd?.post_mood_key;
                  const moodEmoji = moodKey ? getEmotionEmoji(moodKey) : '';
                  const d = new Date(r.recorded_at);
                  const ds = d.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={r.id}
                      className="flex justify-between gap-2 border-b border-white/5 pb-2 text-sm last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1 text-white/90">
                          <span>{label}</span>
                          {moodEmoji ? <span aria-hidden>{moodEmoji}</span> : null}
                        </div>
                        <div className="text-xs text-white/40">{ds}</div>
                      </div>
                      <div className="shrink-0 text-right text-violet-200">
                        <div>{formatMmSs(dur)}</div>
                        <div className="text-xs text-white/40">{cy} 周期</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScreen('pick')}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium shadow-lg flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            开始练习
          </button>
        </div>
      )}

      {screen === 'pick' && (
        <div className="flex-1 flex flex-col px-3 pb-6 min-h-0">
          <h2 className="text-lg font-medium text-center mb-4">选择呼吸模式</h2>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {BREATHING_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => beginPractice(m)}
                className="w-full text-left rounded-2xl border border-violet-500/40 bg-white/5 px-4 py-3 active:scale-[0.99] transition-transform"
              >
                <div className="font-medium text-white">{m.label}</div>
                <div className="text-xs text-violet-200/70 mt-1">
                  {m.pattern.map((p) => `${phaseLabel(p.kind)}${p.sec}秒`).join(' → ')}
                </div>
                <div className="text-xs text-white/45 mt-1">{m.hint}</div>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setScreen('home')} className="mt-4 text-sm text-white/50">
            返回
          </button>
        </div>
      )}

      {screen === 'run' && selectedMode && (
        <div className="flex-1 flex flex-col items-center px-3 pb-8 min-h-0 w-full">
          <h2 className="text-base text-violet-100/90 mb-2">{selectedMode.label}</h2>
          <div className="text-5xl font-light tabular-nums my-2">{Math.ceil(remainInPhase)}</div>
          <div className="text-lg text-violet-200/90 mb-6">{phaseLabel(selectedMode.pattern[phaseIndex].kind)}</div>

          <div className="relative w-full max-w-[16rem] aspect-square flex items-center justify-center mb-8 mx-auto">
            <div className="absolute inset-0 rounded-full border border-violet-500/20 scale-110" />
            <div className="absolute inset-0 rounded-full border border-violet-500/10 scale-125" />
            <div
              className="rounded-full w-36 h-36 transition-transform duration-300 ease-out shadow-[0_0_48px_rgba(139,92,246,0.55)]"
              style={{
                transform: `scale(${orbScale})`,
                background: 'radial-gradient(circle at 35% 30%, #c4b5fd 0%, #7c3aed 50%, #4c1d95 100%)',
              }}
            />
          </div>

          <div className="flex gap-8 text-center text-sm text-violet-100/80 mb-10">
            <div>
              <div className="text-xl tabular-nums">{formatMmSs(runElapsedSec)}</div>
              <div className="text-xs text-white/40">时长</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="text-xl tabular-nums">{cycles}</div>
              <div className="text-xs text-white/40">周期</div>
            </div>
          </div>

          <div className="flex gap-3 w-full mt-auto">
            <button
              type="button"
              onClick={togglePause}
              className="flex-1 py-3 rounded-2xl bg-white/10 text-white flex items-center justify-center gap-2"
            >
              {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              {paused ? '继续' : '暂停'}
            </button>
            <button
              type="button"
              onClick={() => goSummary(false)}
              className="flex-1 py-3 rounded-2xl bg-rose-900/60 text-rose-100 flex items-center justify-center gap-2"
            >
              <Square className="w-5 h-5" />
              结束
            </button>
          </div>
          <button
            type="button"
            onClick={() => goSummary(true)}
            className="mt-4 text-sm text-violet-300/90"
          >
            完成本轮练习
          </button>
        </div>
      )}

      {screen === 'complete' && selectedMode && (
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-3 pb-6">
          <div className="mt-2 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-900/35">
              <Flower2 className="h-10 w-10 text-white" strokeWidth={1.35} aria-hidden />
            </div>
            <h2 className="mb-5 text-xl font-medium">练习完成</h2>
            <div className="mb-8 flex gap-12 text-violet-200">
              <div className="text-center">
                <div className="text-2xl tabular-nums">{formatMmSs(runElapsedSec)}</div>
                <div className="mt-1 text-xs text-violet-300/70">练习时长</div>
              </div>
              <div className="text-center">
                <div className="text-2xl tabular-nums">{cycles}</div>
                <div className="mt-1 text-xs text-violet-300/70">呼吸周期</div>
              </div>
            </div>
          </div>

          <p className="mb-4 text-center text-xs text-white/40">
            {summaryCompleted ? '已保存本次练习（开始时间为进入练习时刻）' : '已保存本次练习（含中途结束）'}
            {saving ? ' · 同步中…' : ''}
            {moodSavedHint ? ' · 心情已记入心情罐' : ''}
          </p>

          <div className="mb-5 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
            <div className="mb-3 text-center text-sm font-medium text-white/90">❤️ 记录此刻心情</div>
            <div className="grid grid-cols-2 gap-2">
              {POST_BREATHING_MOODS.map((m) => {
                const sel = selectedPostMoodKey === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setSelectedPostMoodKey(m.key);
                      setMoodSavedHint(false);
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-sm transition-colors ${
                      sel
                        ? 'border-violet-400/80 bg-violet-500/25 text-white'
                        : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl leading-none" aria-hidden>
                      {m.emoji}
                    </span>
                    <span className="mt-1.5">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={!selectedPostMoodKey || moodSaving || !user?.id}
            onClick={() => void savePostBreathingMood()}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-medium text-white shadow-lg disabled:opacity-45"
          >
            {moodSaving ? '保存中…' : '保存心情'}
          </button>
          <button
            type="button"
            disabled={moodSaving}
            onClick={backToBreathingHome}
            className="mt-3 w-full rounded-2xl border border-white/20 py-3 text-white/90 disabled:opacity-45"
          >
            稍后再说
          </button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default BreathingPracticeOverlay;
