import { Volume2 } from "lucide-react";
import { useVoicePlayback } from "../../contexts/VoicePlaybackContext";

interface AiReplyVoiceButtonProps {
  /** 与自动朗读一致：优先 `clientId`，避免换 id 后动画不同步 */
  playbackKey: string;
  text: string;
}

/**
 * 放在 AI 文字气泡下方：点击朗读；播放中为小号浅色声波示意。
 */
export function AiReplyVoiceButton({ playbackKey, text }: AiReplyVoiceButtonProps) {
  const { speakingMessageId, isSpeakingPaused, speakMessage } = useVoicePlayback();
  const active = speakingMessageId === playbackKey;
  const playing = active && !isSpeakingPaused;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const label = active
    ? isSpeakingPaused
      ? "继续朗读"
      : "暂停朗读"
    : "朗读本条回复";

  return (
    <button
      type="button"
      onClick={() => speakMessage(playbackKey, trimmed)}
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-1.5 transition-colors ${
        active
          ? "bg-violet-50/90 text-violet-500/90"
          : "text-gray-400 hover:bg-gray-50 hover:text-violet-500/80"
      }`}
      aria-label={label}
      title={label}
    >
      <Volume2 className="w-[15px] h-[15px] shrink-0 opacity-95" strokeWidth={1.45} aria-hidden />
      {playing ? (
        <span className="inline-flex items-end gap-px h-3 pb-px" aria-hidden>
          <span className="ai-voice-bar" />
          <span className="ai-voice-bar ai-voice-bar-d1" />
          <span className="ai-voice-bar ai-voice-bar-d2" />
        </span>
      ) : null}
      <style>{`
        .ai-voice-bar {
          display: inline-block;
          width: 2px;
          height: 8px;
          border-radius: 1px;
          background: currentColor;
          opacity: 0.5;
          transform-origin: center bottom;
          animation: ai-voice-bar 0.55s ease-in-out infinite;
        }
        .ai-voice-bar-d1 {
          animation-delay: 0.12s;
          height: 5px;
        }
        .ai-voice-bar-d2 {
          animation-delay: 0.24s;
          height: 9px;
        }
        @keyframes ai-voice-bar {
          0%, 100% { transform: scaleY(0.35); opacity: 0.3; }
          50% { transform: scaleY(1); opacity: 0.65; }
        }
      `}</style>
    </button>
  );
}
