/**
 * 浏览器端语音 MVP（Web Speech API）：仅用于 Chrome/Edge 等桌面浏览器验证，
 * iOS/Android 需后续换原生 SDK 或云端 ASR/TTS。
 */

const TTS_KEY = "chat_mvp_tts_enabled";

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function speakText(text: string, lang = "zh-CN"): void {
  if (typeof window === "undefined" || !text.trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.trim());
  u.lang = lang;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

export function getTtsEnabled(): boolean {
  if (typeof sessionStorage === "undefined") return true;
  return sessionStorage.getItem(TTS_KEY) !== "0";
}

export function setTtsEnabled(on: boolean): void {
  sessionStorage.setItem(TTS_KEY, on ? "1" : "0");
}
