const BEIJING_TIMEZONE = 'Asia/Shanghai';

function pad2(v) {
  return String(v).padStart(2, '0');
}

function toBeijingDateParts(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value || 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value || 1);

  return { year, month, day };
}

function toBeijingDateString(dateInput = new Date()) {
  const { year, month, day } = toBeijingDateParts(dateInput);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseBeijingDate(dateStr) {
  const normalized = String(dateStr || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return new Date(`${normalized}T00:00:00+08:00`);
}

function toBeijingDayRangeISO(dateStr) {
  const normalized = String(dateStr || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return {
    start: new Date(`${normalized}T00:00:00+08:00`).toISOString(),
    end: new Date(`${normalized}T23:59:59.999+08:00`).toISOString(),
  };
}

/**
 * 北京日历 YYYY-MM-DD 加减天数（正午 +08 锚点，避免服务器本地时区干扰）。
 * @param {string} ymd
 * @param {number} deltaDays
 * @returns {string}
 */
function addDaysToBeijingYmd(ymd, deltaDays) {
  const t = new Date(`${ymd}T12:00:00+08:00`).getTime() + deltaDays * 86400000;
  return toBeijingDateString(new Date(t));
}

/**
 * 以北京时区为准的「本周 / 下周」周一至周日边界。
 * @param {'this_week'|'next_week'} [week]
 * @param {Date|null} [anchorDate] 锚定到哪一天所在的周；默认当前时刻
 * @returns {{ start: Date, end: Date }} 周一、周日 00:00+08 对应的 Date 瞬时值（与 parseBeijingDate 一致）
 */
function getBeijingWeekRange(week = 'this_week', anchorDate = null) {
  const anchor = anchorDate ?? new Date();
  const ymd = toBeijingDateString(anchor);
  const sun0 = new Date(`${ymd}T12:00:00+08:00`).getUTCDay();
  const daysFromMonday = sun0 === 0 ? 6 : sun0 - 1;
  const offset = -daysFromMonday + (week === 'next_week' ? 7 : 0);
  const mondayYmd = addDaysToBeijingYmd(ymd, offset);
  const sundayYmd = addDaysToBeijingYmd(mondayYmd, 6);
  return {
    start: parseBeijingDate(mondayYmd),
    end: parseBeijingDate(sundayYmd),
  };
}

module.exports = {
  BEIJING_TIMEZONE,
  toBeijingDateString,
  parseBeijingDate,
  toBeijingDayRangeISO,
  addDaysToBeijingYmd,
  getBeijingWeekRange,
};
