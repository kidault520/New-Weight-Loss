/**
 * useStepsChartData - 步数图表数据计算Hook
 * 从StepsDetailScreen.tsx中提取的图表数据计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */
 

import { useMemo } from 'react';
import { formatTimeChinese, getBeijingTime } from '../utils/dateUtils';

interface StepsRecord {
  id: string;
  value: number;
  recorded_at: string;
  notes?: string;
}

interface ChartDataPoint {
  label: string;
  value: number;
  date?: string;
  time?: string;
  recorded_at?: string;
}

interface UseStepsChartDataOptions {
  records: StepsRecord[];
  timePeriod: 'day' | 'week' | 'month' | 'year';
  currentWeekStart: Date;
  getRecordsByDate: (date: Date) => StepsRecord[];
  formatDate: (date: Date) => string;
}

export function useStepsChartData({
  records,
  timePeriod,
  currentWeekStart,
  getRecordsByDate,
  formatDate,
}: UseStepsChartDataOptions) {
  void records;
  void formatDate;
  // 计算图表数据
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];

    if (timePeriod === 'day') {
      // 天视图：按时间段分组（00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-24:00）
      const dayRecords = getRecordsByDate(currentWeekStart);
      const timePeriods = [
        { label: '00:00', start: 0, end: 6 },
        { label: '06:00', start: 6, end: 12 },
        { label: '12:00', start: 12, end: 18 },
        { label: '18:00', start: 18, end: 24 }
      ];
      
      return timePeriods.map(period => {
        const periodRecords = dayRecords.filter(record => {
          const recordDate = new Date(record.recorded_at);
          const hour = recordDate.getHours();
          return hour >= period.start && hour < period.end;
        });
        const total = periodRecords.reduce((sum, r) => sum + (r.value || 0), 0);
        return {
          label: period.label,
          value: total,
          date: period.label,
          time: period.label
        };
      });
    } else if (timePeriod === 'week') {
      // 周视图：计算周一到周日，每天累加
      const weekStart = new Date(currentWeekStart);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const beijingDate = getBeijingTime(date);
        const dayRecords = getRecordsByDate(date);
        const totalSteps = dayRecords.reduce((sum: number, record: StepsRecord) => sum + (record.value || 0), 0);
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        data.push({
          label: `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`,
          value: totalSteps,
          date: `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`,
          time: latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '',
          recorded_at: latestRecord?.recorded_at
        });
      }
    } else if (timePeriod === 'month') {
      // 月视图：每天累加
      const year = currentWeekStart.getFullYear();
      const month = currentWeekStart.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = getRecordsByDate(date);
        const totalSteps = dayRecords.reduce((sum: number, record: StepsRecord) => sum + (record.value || 0), 0);
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        data.push({
          label: String(day),
          value: totalSteps,
          date: String(day),
          time: latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '',
          recorded_at: latestRecord?.recorded_at
        });
      }
    } else if (timePeriod === 'year') {
      // 年视图：每月累加
      const year = currentWeekStart.getFullYear();

      for (let month = 0; month < 12; month++) {
        const endDate = new Date(year, month + 1, 0);
        let monthTotal = 0;
        let latestRecord: StepsRecord | null = null;

        for (let day = 1; day <= endDate.getDate(); day++) {
          const date = new Date(year, month, day);
          const dayRecords = getRecordsByDate(date);
          monthTotal += dayRecords.reduce((sum: number, record: StepsRecord) => sum + (record.value || 0), 0);
          if (dayRecords.length > 0) {
            const dayLatest = dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
            if (!latestRecord || new Date(dayLatest.recorded_at) > new Date(latestRecord.recorded_at)) {
              latestRecord = dayLatest;
            }
          }
        }

        data.push({
          label: `${month + 1}`,
          value: monthTotal,
          date: `${month + 1}月`,
          time: latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '',
          recorded_at: latestRecord?.recorded_at
        });
      }
    }

    return data;
  }, [timePeriod, currentWeekStart, getRecordsByDate]);

  return {
    chartData,
  };
}



