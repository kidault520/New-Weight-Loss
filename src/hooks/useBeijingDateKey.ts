import { useEffect, useState } from 'react';
import { toBeijingDateString } from '../utils/dateUtils';

/**
 * 实时返回北京时间日期 key（YYYY-MM-DD）
 * 用于跨 00:00 自动刷新“今日”相关卡片和查询 key。
 */
export function useBeijingDateKey() {
  const [dateKey, setDateKey] = useState(() => toBeijingDateString(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = toBeijingDateString(new Date());
      setDateKey((prev) => (prev === next ? prev : next));
    }, 30 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  return dateKey;
}

