import { useEffect, useRef } from "react";
import type { ChatMessage } from "../contexts/ChatContext";
import { useVoicePlayback } from "../contexts/VoicePlaybackContext";
import { getTtsEnabled } from "../utils/browserVoice";

/**
 * 在用户发送结束（isSendingMessage true→false）后，自动朗读**最新一条**可朗读文本：
 * 普通 AI 气泡（`ai`）与绿色反馈（`feedback`），与对应喇叭同源、键一致。
 */
export function useSpeakAiReply(messages: ChatMessage[], isSendingMessage: boolean) {
  const prevSending = useRef(false);
  const lastSpokenId = useRef<string | null>(null);
  const listHydratedRef = useRef(false);
  const prevTailKeyRef = useRef<string | null>(null);
  const { speakMessage, stopPlayback } = useVoicePlayback();

  useEffect(() => {
    const wasSending = prevSending.current;
    prevSending.current = isSendingMessage;

    if (wasSending && !isSendingMessage) {
      if (!getTtsEnabled()) return;

      let lastTts: ChatMessage | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if ((m.type === "ai" || m.type === "feedback") && m.content?.trim()) {
          lastTts = m;
          break;
        }
      }
      const refKey = lastTts ? lastTts.clientId || lastTts.id : "";
      if (!lastTts || !refKey || refKey === lastSpokenId.current) return;

      lastSpokenId.current = refKey;
      speakMessage(refKey, lastTts.content);
    }
  }, [isSendingMessage, messages, speakMessage]);

  /** 卡片确认等会延迟插入绿色 feedback，不经 isSendingMessage：仅在尾部**新出现** feedback 时自动读，避免首屏历史最后一条误播 */
  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    const tailKey = `${last.type}:${last.clientId || last.id}`;

    if (!listHydratedRef.current) {
      listHydratedRef.current = true;
      prevTailKeyRef.current = tailKey;
      return;
    }
    if (prevTailKeyRef.current === tailKey) return;
    prevTailKeyRef.current = tailKey;

    if (last.type !== "feedback" || !getTtsEnabled() || !last.content?.trim()) return;
    const refKey = last.clientId || last.id;
    if (!refKey || refKey === lastSpokenId.current) return;
    lastSpokenId.current = refKey;
    speakMessage(refKey, last.content);
  }, [messages, speakMessage]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);
}
