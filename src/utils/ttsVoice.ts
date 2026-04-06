/**
 * 在浏览器自带 TTS 里尽量选更自然的中文音色（各端差异大，只能启发式）。
 */

function scoreChineseVoice(v: SpeechSynthesisVoice): number {
  let s = 0;
  const n = `${v.name}`.toLowerCase();
  const lang = `${v.lang}`.toLowerCase();
  if (!lang.startsWith("zh")) return -1;

  if (n.includes("natural")) s += 90;
  if (n.includes("neural")) s += 75;
  if (
    n.includes("xiaoxiao") ||
    n.includes("yunxi") ||
    n.includes("yunjian") ||
    n.includes("xiaoyi") ||
    n.includes("xiaohan") ||
    n.includes("huihui") ||
    n.includes("yaoyao")
  )
    s += 55;
  if (n.includes("microsoft")) s += 35;
  if (n.includes("google")) s += 30;
  if (v.localService) s += 8;
  return s;
}

export function pickPreferredChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const zh = voices.filter((v) => scoreChineseVoice(v) >= 0);
  if (zh.length === 0) return null;
  zh.sort((a, b) => scoreChineseVoice(b) - scoreChineseVoice(a));
  return zh[0];
}
