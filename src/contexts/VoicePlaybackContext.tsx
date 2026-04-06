import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { pickPreferredChineseVoice } from "../utils/ttsVoice";

interface VoicePlaybackContextValue {
  speakingMessageId: string | null;
  isSpeakingPaused: boolean;
  speakMessage: (refKey: string, text: string) => void;
  stopPlayback: () => void;
}

const VoicePlaybackContext = createContext<VoicePlaybackContextValue | undefined>(undefined);

/** cancel() 触发的 error，用于区分「用户点暂停」与真错误 */
function isCancelLikeError(code: string): boolean {
  return code === "interrupted" || code === "canceled" || code === "cancelled";
}

/**
 * 浏览器对 `speechSynthesis.pause/resume` 支持很差，表现为一点击就 cancel 重播。
 * 策略：用户暂停时 `cancel()`，用 `onboundary` 记录已读到的字符位置，续播时对全文 `slice(offset)` 再 speak。
 */
export function VoicePlaybackProvider({ children }: { children: React.ReactNode }) {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isSpeakingPaused, setIsSpeakingPaused] = useState(false);

  /** 单调递增，用于作废过期的 onend/onerror；一次「会话」内保持不变（含暂停/续播） */
  const speakGenRef = useRef(0);
  /** 当前 TTS 会话 id，与 speakGenRef 同步，0 表示无会话 */
  const currentSessionSidRef = useRef(0);
  const activeUtteranceKeyRef = useRef<string | null>(null);
  const hasQueuedUtteranceRef = useRef(false);
  const userPausedRef = useRef(false);
  const fullTextRef = useRef("");
  /** 下一段 utterance 从 fullText 的哪一字开始读 */
  const startOffsetRef = useRef(0);
  /** 最近一次 boundary 在全文中的绝对下标（用于暂停时截取） */
  const lastBoundaryAbsoluteRef = useRef(0);
  const intentionalSlicePauseRef = useRef(false);

  const resetSpeakingState = useCallback(() => {
    speakGenRef.current += 1;
    currentSessionSidRef.current = 0;
    activeUtteranceKeyRef.current = null;
    hasQueuedUtteranceRef.current = false;
    userPausedRef.current = false;
    intentionalSlicePauseRef.current = false;
    fullTextRef.current = "";
    startOffsetRef.current = 0;
    lastBoundaryAbsoluteRef.current = 0;
    setSpeakingMessageId(null);
    setIsSpeakingPaused(false);
  }, []);

  const stopPlayback = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      intentionalSlicePauseRef.current = false;
      window.speechSynthesis.cancel();
    }
    resetSpeakingState();
  }, [resetSpeakingState]);

  const speakMessage = useCallback(
    (refKey: string, text: string) => {
      if (typeof window === "undefined" || !text.trim()) return;
      const synth = window.speechSynthesis;
      const trimmed = text.trim();

      const finishThisSession = () => {
        const sid = currentSessionSidRef.current;
        if (sid === 0 || speakGenRef.current !== sid) return;
        speakGenRef.current += 1;
        currentSessionSidRef.current = 0;
        hasQueuedUtteranceRef.current = false;
        userPausedRef.current = false;
        intentionalSlicePauseRef.current = false;
        activeUtteranceKeyRef.current = null;
        fullTextRef.current = "";
        startOffsetRef.current = 0;
        lastBoundaryAbsoluteRef.current = 0;
        setSpeakingMessageId(null);
        setIsSpeakingPaused(false);
      };

      const startSegment = (key: string) => {
        const sid = currentSessionSidRef.current;
        if (sid === 0 || speakGenRef.current !== sid) return;

        const from = startOffsetRef.current;
        const full = fullTextRef.current;
        if (from >= full.length) {
          finishThisSession();
          return;
        }
        const segment = full.slice(from);

        let started = false;
        let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

        const run = () => {
          if (speakGenRef.current !== sid) return;
          if (started) return;
          started = true;
          synth.removeEventListener("voiceschanged", onVoices);
          if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
          if (speakGenRef.current !== sid) return;

          const u = new SpeechSynthesisUtterance(segment);
          u.lang = "zh-CN";
          const voice = pickPreferredChineseVoice();
          if (voice) u.voice = voice;
          u.rate = 0.9;
          u.pitch = 1.05;
          u.volume = 1;

          u.onboundary = (e) => {
            if (speakGenRef.current !== sid) return;
            lastBoundaryAbsoluteRef.current = from + e.charIndex;
          };

          u.onstart = () => {
            if (speakGenRef.current !== sid) return;
            setSpeakingMessageId(key);
            setIsSpeakingPaused(false);
          };

          const handleIntentionalPause = () => {
            intentionalSlicePauseRef.current = false;
            userPausedRef.current = true;
            setIsSpeakingPaused(true);
            startOffsetRef.current = Math.min(
              lastBoundaryAbsoluteRef.current,
              fullTextRef.current.length,
            );
          };

          u.onerror = (ev) => {
            if (speakGenRef.current !== sid) return;
            const code = (ev as SpeechSynthesisErrorEvent).error;
            if (intentionalSlicePauseRef.current && isCancelLikeError(code)) {
              handleIntentionalPause();
              return;
            }
            finishThisSession();
          };

          u.onend = () => {
            if (speakGenRef.current !== sid) return;
            if (intentionalSlicePauseRef.current) {
              handleIntentionalPause();
              return;
            }
            finishThisSession();
          };

          synth.speak(u);
        };

        const onVoices = () => run();

        if (synth.getVoices().length === 0) {
          synth.addEventListener("voiceschanged", onVoices);
          timeoutId = globalThis.setTimeout(() => run(), 400);
        } else {
          run();
        }
      };

      // —— 同一条：暂停 / 续播 ——
      if (activeUtteranceKeyRef.current === refKey && hasQueuedUtteranceRef.current) {
        if (userPausedRef.current) {
          userPausedRef.current = false;
          setIsSpeakingPaused(false);
          startSegment(refKey);
          return;
        }

        intentionalSlicePauseRef.current = true;
        synth.cancel();
        return;
      }

      // —— 新会话（换条或重新点播放）——
      synth.cancel();
      speakGenRef.current += 1;
      const sid = speakGenRef.current;
      currentSessionSidRef.current = sid;

      activeUtteranceKeyRef.current = refKey;
      hasQueuedUtteranceRef.current = true;
      userPausedRef.current = false;
      intentionalSlicePauseRef.current = false;
      fullTextRef.current = trimmed;
      startOffsetRef.current = 0;
      lastBoundaryAbsoluteRef.current = 0;
      setSpeakingMessageId(refKey);
      setIsSpeakingPaused(false);

      startSegment(refKey);
    },
    [],
  );

  const value = useMemo(
    () => ({ speakingMessageId, isSpeakingPaused, speakMessage, stopPlayback }),
    [speakingMessageId, isSpeakingPaused, speakMessage, stopPlayback],
  );

  return <VoicePlaybackContext.Provider value={value}>{children}</VoicePlaybackContext.Provider>;
}

export function useVoicePlayback() {
  const ctx = useContext(VoicePlaybackContext);
  if (!ctx) {
    throw new Error("useVoicePlayback must be used within VoicePlaybackProvider");
  }
  return ctx;
}
