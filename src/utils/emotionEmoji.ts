/** 情绪类型与 emoji 映射（与 chatMessagesService 保持一致） */
export const EMOTION_EMOJI_MAP: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  neutral: '😐',
  excited: '🤩',
  tired: '😴',
  worried: '😰',
  angry: '😤',
  /** 呼吸练习结束页等 */
  calm: '😌',
  focused: '🧘',
};

export function getEmotionEmoji(emotionType?: string): string {
  if (!emotionType) return '';
  return EMOTION_EMOJI_MAP[emotionType] || '';
}
