/**
 * 聊天相关工具函数
 */

import { getBeijingTime, isSameDay } from './dateUtils';

/**
 * 气泡为纯文本，不渲染 Markdown；去掉模型偶发的 **加粗** 标记，避免界面出现裸星号。
 */
export function stripMarkdownBoldMarkersForChat(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '');
}

/** 与 Edge ai-chat `formatStructuredDeliveryBodyFromSnapshotLine` 同步：快照单行 → 竖排（无分隔线） */
function formatStructuredDeliveryBodyFromSnapshotLineClient(line: string): string | null {
  let t = String(line || '')
    .trim()
    .replace(/\*\*/g, '')
    .replace(/\u00a0/g, ' ');
  if (!t) return null;

  t = t.replace(/^(早餐|午餐|晚餐|加餐)\s*→\s*/u, '');

  const parts = t.split(/[；;]+/).map((x) => x.trim()).filter(Boolean);
  let addrLine = '';
  let contactPart = '';
  let statusPart = '';
  for (const p of parts) {
    if (/联系人\s*[：:\uFF1A]/.test(p)) contactPart = p;
    else if (/配送状态\s*[：:\uFF1A]/.test(p)) statusPart = p;
    else addrLine = addrLine ? `${addrLine}；${p}` : p;
  }
  const scan = t;

  let label = '—';
  let addrInner = '';

  const tagPatterns: RegExp[] = [
    /地址标签\s*[「［]\s*([^」］]+?)\s*[」］]\s*[（(]\s*([^）)]+?)\s*[）)]/u,
    /地址标签\s*[「［]\s*([^」］]+?)\s*[」］]\s*\(\s*([^)]+?)\s*\)/u,
    /地址标签\s*"([^"]+)"\s*[（(]\s*([^）)]+?)\s*[）)]/u,
  ];
  for (const re of tagPatterns) {
    const m = addrLine.match(re) || scan.match(re);
    if (m) {
      label = m[1].trim();
      addrInner = m[2].trim();
      break;
    }
  }

  if (!addrInner) {
    const mDet =
      addrLine.match(/详细地址\s*[：:\uFF1A]\s*([^；;\n]+)/u) ||
      scan.match(/详细地址\s*[：:\uFF1A]\s*([^；;\n]+)/u);
    if (mDet) addrInner = mDet[1].trim();
  }
  if (!addrInner) {
    const mShort =
      addrLine.match(/地址标签\s*[：:\uFF1A]\s*([^\s；;]+)/u) ||
      scan.match(/地址标签\s*[：:\uFF1A]\s*([^\s；;]+)/u);
    if (mShort) {
      label = mShort[1].trim();
      addrInner = '暂无详细地址';
    }
  }
  if (!addrInner) return null;

  let contactName = '—';
  let phone = '—';
  const cSrc = contactPart || scan;
  const mC = cSrc.match(
    /联系人\s*[：:\uFF1A]\s*(.+?)\s+((?:\+?86[-\s]?)?1[0-9*]{10,14}|[0-9*]{7,15})(?=\s*$|\s*[；;]|\s*配送状态|\s*[,，])/u,
  );
  if (mC) {
    contactName = mC[1].replace(/[,，]\s*$/, '').trim();
    phone = mC[2].replace(/\s/g, '').trim();
  } else if (contactPart) {
    contactName = contactPart.replace(/^联系人\s*[：:\uFF1A]\s*/, '').trim() || '—';
  }

  let status = '—';
  const sSrc = statusPart || scan;
  const mS = sSrc.match(/配送状态\s*[：:\uFF1A]\s*([^；;\n]+)/u);
  if (mS) status = mS[1].trim();

  return [`地址：【${label}】→${addrInner}`, `联系人：${contactName}`, `电话：${phone}`, `配送状态：${status}`].join(
    '\n',
  );
}

function maybeRestructureDeliveryReplyFullTextClient(full: string): string {
  const trimmed = full.trimEnd();
  let head: string;
  let body: string;

  const doubleNl = trimmed.indexOf('\n\n');
  if (doubleNl !== -1) {
    head = trimmed.slice(0, doubleNl + 2);
    body = trimmed.slice(doubleNl + 2).trim();
  } else {
    const singleNl = trimmed.indexOf('\n');
    if (singleNl !== -1) {
      const candidateBody = trimmed.slice(singleNl + 1).trim();
      if (/地址标签|详细地址\s*[：:\uFF1A]/.test(candidateBody)) {
        head = `${trimmed.slice(0, singleNl).trimEnd()}\n\n`;
        body = candidateBody;
      } else {
        return full;
      }
    } else {
      const tagIdx = trimmed.search(/地址标签|详细地址\s*[：:\uFF1A]/u);
      if (tagIdx < 0) return full;
      if (tagIdx === 0) {
        const flat = trimmed.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim();
        if (!/地址标签|详细地址\s*[：:\uFF1A]/u.test(flat)) return full;
        const outOnly = formatStructuredDeliveryBodyFromSnapshotLineClient(flat);
        return outOnly ?? full;
      }
      head = `${trimmed.slice(0, tagIdx).trimEnd()}\n\n`;
      body = trimmed.slice(tagIdx).trim();
    }
  }

  if (!body) return full;
  const nonEmptyLines = body.split('\n').map((x) => x.trim()).filter(Boolean);
  if (nonEmptyLines.length >= 4 && !/[；;]/.test(body)) return full;
  const flat = body.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim();
  if (!/地址标签|详细地址\s*[：:\uFF1A]/u.test(flat)) return full;
  const out = formatStructuredDeliveryBodyFromSnapshotLineClient(flat);
  return out ? head + out : full;
}

/** 去掉 Markdown 后，把仍是一行的配送快照竖排（含本地已存历史） */
export function formatAiDeliveryMessageForDisplay(raw: string): string {
  return maybeRestructureDeliveryReplyFullTextClient(stripMarkdownBoldMarkersForChat(raw));
}

function maskMainlandPhoneTokenClient(raw: string): string {
  if (raw.includes('*')) return raw;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 11 || !/^1[3-9]/.test(digits)) return raw;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/**
 * AI 气泡展示前脱敏（兜底历史消息或未走 Edge 消毒的文本）
 */
export function maskSensitivePhonesInAiChatDisplay(text: string): string {
  let s = String(text)
    .normalize('NFKC')
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));

  s = s.replace(/(联系人\s*[：:\uFF1A\u2236]\s*)([^；\n]+)/g, (_m, head, rest) => {
    const inner = String(rest).replace(/(?<![0-9])(1[3-9][0-9]{5,9})(?![0-9])/g, (tok) =>
      maskMainlandPhoneTokenClient(tok),
    );
    return String(head) + inner;
  });
  s = s.replace(/(?<![0-9])(1[3-9][0-9]{9})(?![0-9])/g, (tok) => maskMainlandPhoneTokenClient(tok));
  s = s.replace(/(?<![0-9])(1[3-9][0-9]{5,9})(?![0-9])/g, (tok) => maskMainlandPhoneTokenClient(tok));
  s = s.replace(/([\u4e00-\u9fff])(1[3-9][0-9]{5,9})(?![0-9])/g, (_, hz, tok) => hz + maskMainlandPhoneTokenClient(tok));
  return s;
}

type HighlightRange = { start: number; end: number };

function collectHighlightRanges(text: string, source: string, flags: string): HighlightRange[] {
  const re = new RegExp(source, flags.includes('g') ? flags : `${flags}g`);
  const out: HighlightRange[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const r of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev || r.start > prev.end) merged.push({ ...r });
    else prev.end = Math.max(prev.end, r.end);
  }
  return merged;
}

/**
 * 将地址相关片段切分出来，供气泡做黑色加粗渲染（与配送行「地址标签…（…）」等格式对齐）。
 */
export function splitAddressHighlightSegments(text: string): Array<{ text: string; highlight: boolean }> {
  if (!text) return [{ text: '', highlight: false }];

  const ranges = mergeRanges([
    ...collectHighlightRanges(text, '(?:公司\\s*)?地址[（(][^）)]+[）)]', 'g'),
    ...collectHighlightRanges(text, '地址标签[\\s\\S]{0,64}?（[^）]+）', 'g'),
    ...collectHighlightRanges(text, '地址标签[\\s\\S]{0,64}?\\([^)]+\\)', 'g'),
    ...collectHighlightRanges(text, '详细地址[：:]\\s*[^；\\n]+', 'g'),
    ...collectHighlightRanges(text, '地址[：:]\\s*【[^】]+】→[^\\n]+', 'g'),
  ]);

  if (ranges.length === 0) {
    return [{ text, highlight: false }];
  }

  const segments: Array<{ text: string; highlight: boolean }> = [];
  let lastIdx = 0;
  for (const r of ranges) {
    if (r.start > lastIdx) {
      segments.push({ text: text.slice(lastIdx, r.start), highlight: false });
    }
    segments.push({ text: text.slice(r.start, r.end), highlight: true });
    lastIdx = r.end;
  }
  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx), highlight: false });
  }
  return segments;
}

/** 与微信类似：间隔超过此时长或跨自然日才显示居中时间条（毫秒） */
export const CHAT_TIME_DIVIDER_GAP_MS = 3 * 60 * 1000;

/**
 * 格式化聊天消息时间戳
 * 格式: MM-DD HH:mm
 * 使用北京时间确保时区一致性
 */
export const formatChatTimestamp = (date?: Date): string => {
  const dateObj = date || new Date();
  const beijingDate = getBeijingTime(dateObj);
  const month = String(beijingDate.getMonth() + 1).padStart(2, '0');
  const day = String(beijingDate.getDate()).padStart(2, '0');
  const hour = String(beijingDate.getHours()).padStart(2, '0');
  const minute = String(beijingDate.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

/** 解析历史消息 timestamp（MM-DD HH:mm，按当前年推断，跨年接近年初时回退一年） */
export function parseChatTimestampStringToDate(ts: string): Date | null {
  const trimmed = (ts || '').trim();
  const m = trimmed.match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const hour = parseInt(m[3], 10);
  const minute = parseInt(m[4], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const now = new Date();
  let year = now.getFullYear();
  let candidate = new Date(year, month - 1, day, hour, minute);
  if (candidate.getTime() > now.getTime() + 48 * 60 * 60 * 1000) {
    year -= 1;
    candidate = new Date(year, month - 1, day, hour, minute);
  }
  return candidate;
}

type MsgLike = { createdAt?: string; timestamp: string; id?: string };

/** 用于时间条排序/间隔：优先 ISO createdAt，否则解析 timestamp */
export function getMessageTimeForDivider(msg: MsgLike): Date {
  if (msg.createdAt) {
    const d = new Date(msg.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const parsed = parseChatTimestampStringToDate(msg.timestamp);
  if (parsed) return parsed;
  return new Date();
}

export function isWelcomeChatMessage(msg: MsgLike): boolean {
  const id = msg.id || '';
  return id === 'welcome-temp' || id.startsWith('welcome-');
}

/** 是否在上一条与当前条之间展示居中时间条（跨日 / 间隔 ≥ 阈值 / 首条非欢迎） */
export function shouldShowChatTimeDivider(
  prevTime: Date | null,
  currTime: Date,
  gapMs: number = CHAT_TIME_DIVIDER_GAP_MS
): boolean {
  if (prevTime === null) return true;
  const prevB = getBeijingTime(prevTime);
  const currB = getBeijingTime(currTime);
  if (
    prevB.getFullYear() !== currB.getFullYear() ||
    prevB.getMonth() !== currB.getMonth() ||
    prevB.getDate() !== currB.getDate()
  ) {
    return true;
  }
  return currTime.getTime() - prevTime.getTime() >= gapMs;
}

/**
 * 居中时间条文案：当天仅 HH:mm；昨天带「昨天」；同年显示月日；跨年带年
 */
export function formatChatTimeDividerLabel(date: Date, now: Date = new Date()): string {
  const d = getBeijingTime(date);
  const n = getBeijingTime(now);
  const pad = (x: number) => String(x).padStart(2, '0');
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (isSameDay(d, n)) {
    return timeStr;
  }

  const yest = new Date(n);
  yest.setDate(yest.getDate() - 1);
  if (isSameDay(d, yest)) {
    return `昨天 ${timeStr}`;
  }

  if (d.getFullYear() === n.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
  }

  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
}

/**
 * 创建错误消息对象
 */
export const createErrorMessage = (ownerName: string = 'owner'): {
  id: string;
  type: 'ai';
  content: string;
  timestamp: string;
  createdAt?: string;
} => {
  const now = new Date();
  return {
    id: (Date.now() + 1).toString(),
    type: 'ai',
    content: `抱歉呢${ownerName}，小瑞现在有点不舒服...可以稍后再试一下吗？`,
    timestamp: formatChatTimestamp(now),
    createdAt: now.toISOString() // 临时消息也设置 createdAt 用于排序
  };
};














