/**
 * useSleepChartData - 睡眠图表数据计算Hook
 * 从SleepDetailScreen.tsx中提取的图表数据计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */
 

import { useMemo } from 'react';
import { formatTimeChinese, getBeijingTime } from '../utils/dateUtils';

interface SleepRecord {
  id: string;
  value: number;
  recorded_at: string;
  notes?: string;
}

interface ChartDataPoint {
  label?: string;
  time?: string;
  value: number;
  date?: string;
  recorded_at?: string;
}

interface UseSleepChartDataOptions {
  records: SleepRecord[];
  selectedPeriod: '天' | '周' | '月' | '年';
  currentDate: Date;
  getRecordsByDate: (date: Date) => SleepRecord[];
  formatDate: (date: Date) => string;
}

export function useSleepChartData({
  records,
  selectedPeriod,
  currentDate,
  getRecordsByDate,
  formatDate,
}: UseSleepChartDataOptions) {
  void records;
  // 计算图表数据
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];
    
    if (selectedPeriod === '天') {
      // 天视图：只取最新的一条记录
      const dayRecords = getRecordsByDate(currentDate);
      const latestRecord = dayRecords.length > 0 
        ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
        : null;
      if (latestRecord) {
        data.push({ 
          time: formatTimeChinese(latestRecord.recorded_at),
          value: latestRecord.value,
          date: formatDate(currentDate),
          recorded_at: latestRecord.recorded_at
        });
      }
    } else if (selectedPeriod === '周') {
      // 周视图：每天只取最新的一条记录
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const beijingDate = getBeijingTime(date);
        const dayRecords = getRecordsByDate(date);
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        data.push({ 
          label: `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`, 
          value: latestRecord ? latestRecord.value : 0,
          date: `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`,
          recorded_at: latestRecord?.recorded_at
        });
      }
    } else if (selectedPeriod === '月') {
      // 月视图：每天只取最新的一条记录
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dayRecords = getRecordsByDate(date);
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        data.push({ 
          label: String(day), 
          value: latestRecord ? latestRecord.value : 0,
          date: String(day),
          recorded_at: latestRecord?.recorded_at
        });
      }
    } else {
      // 年视图：每月取平均值
      const year = currentDate.getFullYear();
      for (let month = 0; month < 12; month++) {
        const endDate = new Date(year, month + 1, 0);
        const monthRecords: SleepRecord[] = [];
        
        for (let day = 1; day <= endDate.getDate(); day++) {
          const date = new Date(year, month, day);
          const dayRecords = getRecordsByDate(date);
          if (dayRecords.length > 0) {
            // 每天只取最新的一条记录
            const latestRecord = dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
            monthRecords.push(latestRecord);
          }
        }
        
        const monthAvg = monthRecords.length > 0 
          ? monthRecords.reduce((sum, r) => sum + r.value, 0) / monthRecords.length 
          : 0;
        data.push({ 
          label: `${month + 1}月`, 
          value: parseFloat(monthAvg.toFixed(1)),
          date: `${month + 1}月`
        });
      }
    }
    return data;
  }, [selectedPeriod, currentDate, getRecordsByDate, formatDate]);

  return {
    chartData,
  };
}




















