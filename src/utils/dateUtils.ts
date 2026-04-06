/**
 * 日期工具函数
 */

/**
 * 获取本地日期字符串 (YYYY-MM-DD)，用于 queryKey、缓存等，避免 UTC 时区导致的日期错位
 * 例如：3月7日 00:00 本地 → "2026-03-07"（而非 toISOString 的 "2026-03-06"）
 */
export const toLocalDateString = (date: Date): string => {
  // 全站业务日期统一北京时区口径
  return toBeijingDateString(date);
};

/**
 * 获取北京时间日期字符串 (YYYY-MM-DD)
 * 用于“今日”业务口径（补剂、日反馈等）避免客户端时区差异。
 */
export const toBeijingDateString = (date: Date): string => {
  const beijing = getBeijingTime(date);
  const y = beijing.getFullYear();
  const m = String(beijing.getMonth() + 1).padStart(2, '0');
  const d = String(beijing.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 北京时间「日历日」YYYY-MM-DD 在数据库中的起止时刻（东八区 00:00–23:59:59.999）。
 * 与 useBeijingDateKey / toBeijingDateString 一致，避免用本地 new Date(y,m,d) 漏掉跨日记录。
 */
export function getBeijingDayBoundsFromDateKey(dateKey: string): { start: Date; end: Date } {
  const k = String(dateKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) {
    return getBeijingDayBoundsFromDateKey(toBeijingDateString(new Date()));
  }
  return {
    start: new Date(`${k}T00:00:00.000+08:00`),
    end: new Date(`${k}T23:59:59.999+08:00`),
  };
}

/** 某一时刻所在「北京日历日」的 bounds（用于按日汇总 health_records） */
export function getBeijingDayBoundsForInstant(d: Date): { start: Date; end: Date } {
  return getBeijingDayBoundsFromDateKey(toBeijingDateString(d));
}

/**
 * 解析 YYYY-MM-DD（或 ISO 字符串）为 Date，避免 new Date('YYYY-MM-DD') 的 UTC 偏移。
 * YYYY-MM-DD 会按北京日期解析到本地 00:00 对应的同一天。
 */
export const parseDateStringSafe = (input: string): Date => {
  const normalized = String(input || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [y, m, d] = normalized.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(normalized);
};

/**
 * 格式化餐食计划日期 (MM-DD)
 */
export const formatMealPlanDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

/**
 * 格式化完整日期 (YYYY.MM.DD)
 */
export const formatFullDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

/**
 * 获取日期后缀 (st, nd, rd, th)
 */
export const getDaySuffix = (day: number): string => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

/**
 * 格式化日期标签（今天、明天、后天或日期）
 */
export const formatDateLabel = (date: Date): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === 2) return '后天';
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

/**
 * 格式化日期标签（完整版：X月X日）
 */
export const formatDateLabelFull = (date: Date): string => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
};

/**
 * 检查日期是否为今天
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return today.getTime() === checkDate.getTime();
};

/**
 * 检查日期是否为过去
 */
export const isPastDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate.getTime() < today.getTime();
};

/**
 * 检查日期是否为未来
 */
export const isFutureDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate.getTime() > today.getTime();
};

/**
 * 计算两个日期之间的天数差
 */
export const getDaysDifference = (date1: Date, date2: Date): number => {
  const d1 = new Date(date1);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(date2);
  d2.setHours(0, 0, 0, 0);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * 格式化周标签 (MM/DD-MM/DD)
 */
export const formatWeekLabel = (date: Date): string => {
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
  const startDay = String(weekStart.getDate()).padStart(2, '0');
  const endMonth = String(weekEnd.getMonth() + 1).padStart(2, '0');
  const endDay = String(weekEnd.getDate()).padStart(2, '0');

  return `${startMonth}/${startDay}-${endMonth}/${endDay}`;
};

/**
 * 格式化时间为中文格式 (HH:mm)
 */
export const formatTimeChinese = (dateOrString: Date | string | undefined | null): string => {
  // 处理 null 或 undefined
  if (!dateOrString) {
    return '00:00';
  }
  
  // 如果已经是时间格式（HH:mm），直接返回
  if (typeof dateOrString === 'string' && /^\d{1,2}:\d{2}$/.test(dateOrString)) {
    return dateOrString;
  }
  
  const date = typeof dateOrString === 'string' ? new Date(dateOrString) : dateOrString;
  
  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    console.warn('Invalid date passed to formatTimeChinese:', dateOrString);
    return '00:00'; // 返回默认值而不是 NaN
  }
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // 检查 hours 和 minutes 是否为有效数字
  if (isNaN(hours) || isNaN(minutes)) {
    console.warn('Invalid hours or minutes from date:', dateOrString);
    return '00:00';
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * 获取北京时间
 */
export const getBeijingTime = (date: Date): Date => {
  // 北京时间是 UTC+8
  const beijingOffset = 8 * 60; // 8小时 = 480分钟
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const beijingTime = new Date(utc + (beijingOffset * 60000));
  return beijingTime;
};

/**
 * 判断两个日期是否是同一天
 */
export const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const beijing1 = getBeijingTime(d1);
  const beijing2 = getBeijingTime(d2);
  
  return beijing1.getFullYear() === beijing2.getFullYear() &&
         beijing1.getMonth() === beijing2.getMonth() &&
         beijing1.getDate() === beijing2.getDate();
};

/**
 * 判断两个日期是否是同一周
 */
export const isSameWeek = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const beijing1 = getBeijingTime(d1);
  const beijing2 = getBeijingTime(d2);
  
  // 获取周一的日期（修复版本）
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // 重置时间到00:00:00
    const day = d.getDay();
    // 计算到周一的天数差
    // 如果 day === 0 (周日)，需要往前推6天到周一
    // 如果 day === 1 (周一)，diff = 0
    // 如果 day === 2 (周二)，diff = -1
    // ...
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };
  
  const weekStart1 = getWeekStart(beijing1);
  const weekStart2 = getWeekStart(beijing2);
  
  return weekStart1.getTime() === weekStart2.getTime();
};

/**
 * 格式化日期为中文格式 (YYYY/MM/DD)
 */
export const formatDateChinese = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const beijing = getBeijingTime(d);
  const year = beijing.getFullYear();
  const month = String(beijing.getMonth() + 1).padStart(2, '0');
  const day = String(beijing.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

/**
 * 获取周的范围 [startDate, endDate]
 */
export const getWeekRange = (date: Date): [Date, Date] => {
  const beijing = getBeijingTime(date);
  const dayOfWeek = beijing.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const weekStart = new Date(beijing);
  weekStart.setDate(beijing.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return [weekStart, weekEnd];
};
