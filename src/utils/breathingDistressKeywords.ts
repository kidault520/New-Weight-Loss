/**
 * 客户端识别：情绪低落 / 压力 / 焦虑等，用于自动推送呼吸练习便签（不替代模型回复）。
 */
const DISTRESS_PATTERN =
  /焦虑|焦躁|压力大|压力好大|紧张|心情不好|情绪不好|情绪低落|不开心|心里难受|难受|想哭|好累|好烦|烦躁|崩溃|受不了|抑郁|很难过|伤心|害怕|心慌|胸闷|喘不过气|压力山大|煎熬|失眠|睡不着|很丧|\bemo\b|好丧|绝望|恼怒|暴躁|不安|担忧|烦死了|受够了|委屈|内耗|扛不住|撑不住|好压抑|压抑|panic|stress(ed)?/i;

export function shouldSuggestBreathingFromDistressText(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  return DISTRESS_PATTERN.test(t);
}
