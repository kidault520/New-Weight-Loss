/**
 * 统一的日期格式化工具函数
 */
import { getBeijingTime } from './dateUtils';

/**
 * 格式化日期为 YYYY/MM/DD 格式
 * @param dateString 日期字符串或 Date 对象
 * @returns 格式化后的日期字符串，例如 "2024/01/15"
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) {
    return '无效日期';
  }
  const beijing = getBeijingTime(date);
  return `${beijing.getFullYear()}/${String(beijing.getMonth() + 1).padStart(2, '0')}/${String(beijing.getDate()).padStart(2, '0')}`;
}

/**
 * 格式化日期为 YYYY/MM/DD HH:mm 格式
 * @param dateString 日期字符串或 Date 对象
 * @returns 格式化后的日期时间字符串，例如 "2024/01/15 14:30"
 */
export function formatDateTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) {
    return '无效日期';
  }
  const beijing = getBeijingTime(date);
  const year = beijing.getFullYear();
  const month = String(beijing.getMonth() + 1).padStart(2, '0');
  const day = String(beijing.getDate()).padStart(2, '0');
  const hours = String(beijing.getHours()).padStart(2, '0');
  const minutes = String(beijing.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * 格式化日期为 MM-DD 格式（短格式）
 * @param dateString 日期字符串或 Date 对象
 * @returns 格式化后的日期字符串，例如 "01-15"
 */
export function formatDateShort(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) {
    return '无效日期';
  }
  const beijing = getBeijingTime(date);
  return `${String(beijing.getMonth() + 1).padStart(2, '0')}-${String(beijing.getDate()).padStart(2, '0')}`;
}
















