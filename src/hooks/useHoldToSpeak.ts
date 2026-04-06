import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeechRecognition, isSpeechRecognitionSupported } from "../utils/browserVoice";

export interface UseHoldToSpeakOptions {
  /** 松手后提交转写文本（不上传录音） */
  onFinalText: (text: string) => void;
}

const SLIDE_CANCEL_PX = 56;

/**
 * 按住说话：continuous 识别，松手才提交；静默 onend 且仍按住则 restart。
 * 上滑超过阈值后松手：取消发送（不提交）。
 */
export function useHoldToSpeak({ onFinalText }: UseHoldToSpeakOptions) {
  const recRef = useRef<SpeechRecognition | null>(null);
  const accumulatedRef = useRef("");
  const latestInterimRef = useRef("");
  const pointerDownRef = useRef(false);
  const finishingRef = useRef(false);
  const sessionRef = useRef(0);
  const pointerStartYRef = useRef(0);
  const slideCancelRef = useRef(false);

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [slideToCancel, setSlideToCancel] = useState(false);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const cleanupRecognitionOnly = useCallback(() => {
    recRef.current = null;
    setInterim("");
  }, []);

  const abortSilently = useCallback(() => {
    const r = recRef.current;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      try {
        r.abort();
      } catch {
        try {
          r.stop();
        } catch {
          /* ignore */
        }
      }
    }
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const finishSession = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const text = (accumulatedRef.current + latestInterimRef.current).trim();
    accumulatedRef.current = "";
    latestInterimRef.current = "";
    cleanupRecognitionOnly();
    setListening(false);
    setInterim("");
    finishingRef.current = false;
    if (text) {
      onFinalText(text);
    }
  }, [cleanupRecognitionOnly, onFinalText]);

  const stopRecognitionForRelease = useCallback(() => {
    const r = recRef.current;
    if (!r) {
      finishSession();
      return;
    }
    try {
      r.stop();
    } catch {
      try {
        r.abort();
      } catch {
        finishSession();
      }
    }
  }, [finishSession]);

  const startRecognition = useCallback(() => {
    if (!supported) {
      setLastError("当前浏览器不支持语音识别（请用 Chrome / Edge，并尽量使用 HTTPS）");
      return;
    }
    abortSilently();
    finishingRef.current = false;
    pointerDownRef.current = true;
    accumulatedRef.current = "";
    latestInterimRef.current = "";
    setLastError(null);
    setInterim("");

    const rec = createSpeechRecognition();
    if (!rec) {
      setLastError("无法创建语音识别实例");
      pointerDownRef.current = false;
      return;
    }

    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimPiece = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          accumulatedRef.current += piece;
        } else {
          interimPiece += piece;
        }
      }
      latestInterimRef.current = interimPiece;
      setInterim((accumulatedRef.current + interimPiece).trim());
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      setLastError(ev.error);
    };

    rec.onend = () => {
      if (pointerDownRef.current) {
        const r = recRef.current;
        if (r) {
          try {
            r.start();
          } catch {
            pointerDownRef.current = false;
            finishSession();
          }
        }
        return;
      }
      finishSession();
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      cleanupRecognitionOnly();
      pointerDownRef.current = false;
      setLastError("启动语音识别失败，请稍后重试");
    }
  }, [supported, abortSilently, cleanupRecognitionOnly, finishSession]);

  const holdProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      pointerStartYRef.current = e.clientY;
      slideCancelRef.current = false;
      setSlideToCancel(false);
      startRecognition();
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pointerDownRef.current) return;
      const up = pointerStartYRef.current - e.clientY;
      const cancel = up > SLIDE_CANCEL_PX;
      if (cancel !== slideCancelRef.current) {
        slideCancelRef.current = cancel;
        setSlideToCancel(cancel);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const cancelled = slideCancelRef.current;
      slideCancelRef.current = false;
      setSlideToCancel(false);
      pointerDownRef.current = false;

      if (cancelled) {
        sessionRef.current++;
        abortSilently();
        return;
      }
      stopRecognitionForRelease();
    },
    onPointerCancel: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      slideCancelRef.current = false;
      setSlideToCancel(false);
      pointerDownRef.current = false;
      sessionRef.current++;
      abortSilently();
    },
  };

  return {
    supported,
    listening,
    interim,
    lastError,
    slideToCancel,
    holdProps,
  };
}
