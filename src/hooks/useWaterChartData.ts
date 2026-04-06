/**
 * useWaterChartData - 饮水图表数据计算Hook
 * 从WaterDetailScreen.tsx中提取的图表数据计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { useMemo } from 'react';
import { formatTimeChinese, getBeijingTime } from '../utils/dateUtils';

interface WaterRecord {
  id: string;
  value: number;
  recorded_at: string;
  notes?: string;
}

interface ChartDataPoint {
  date: string;
  value: number;
  recorded_at?: string;
  time?: string;
}

interface UseWaterChartDataOptions {
  records: WaterRecord[];
  selectedPeriod: '天' | '周' | '月' | '年';
  selectedDate: Date;
  getRecordsByDate: (date: Date) => WaterRecord[];
}

export function useWaterChartData({
  records,
  selectedPeriod,
  selectedDate,
  getRecordsByDate,
}: UseWaterChartDataOptions) {
  void records;
  // 计算图表数据
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];
    const today = getBeijingTime(selectedDate);
    
    if (selectedPeriod === '天') {
      // 天视图：按时间段分组（00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-24:00）
      const dayRecords = getRecordsByDate(today);
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
          date: period.label,
          value: total,
          time: period.label
        };
      });
    } else if (selectedPeriod === '周') {
      // 计算周的开始日期（周一）
      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 如果是周日，回到上周一
      weekStart.setDate(weekStart.getDate() + diff);
      
      // 显示周一到周日的7天数据 - 每天累加所有记录
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const beijingDate = getBeijingTime(date);
        const dayRecords = getRecordsByDate(date);
        const totalAmount = dayRecords.reduce((sum, record) => sum + (record.value || 0), 0);
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        const dateStr = `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`;
        const recordTime = latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '';
        data.push({ date: dateStr, value: totalAmount, recorded_at: latestRecord?.recorded_at, time: recordTime });
      }
    } else if (selectedPeriod === '月') {
      // 显示当前月份每天的数据 - 每天累加所有记录
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = getRecordsByDate(date);
        const totalAmount = dayRecords.reduce((sum, record) => sum + (record.value || 0), 0);
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        const dateStr = String(day);
        const recordTime = latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '';
        data.push({ date: dateStr, value: totalAmount, recorded_at: latestRecord?.recorded_at, time: recordTime });
      }
    } else if (selectedPeriod === '年') {
      // 显示12个月的数据 - 每月累加所有记录
      const year = today.getFullYear();
      
      for (let month = 0; month < 12; month++) {
        const endDate = new Date(year, month + 1, 0);
        let monthTotal = 0;
        let latestRecord: WaterRecord | null = null;

        for (let day = 1; day <= endDate.getDate(); day++) {
          const date = new Date(year, month, day);
          const dayRecords = getRecordsByDate(date);
          monthTotal += dayRecords.reduce((sum, record) => sum + (record.value || 0), 0);
          if (dayRecords.length > 0) {
            const dayLatest = dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
            if (!latestRecord || new Date(dayLatest.recorded_at) > new Date(latestRecord.recorded_at)) {
              latestRecord = dayLatest;
            }
          }
        }
        
        const dateStr = `${month + 1}月`;
        const recordTime = latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '';
        data.push({ date: dateStr, value: monthTotal, recorded_at: latestRecord?.recorded_at, time: recordTime });
      }
    }
    
    return data;
  }, [selectedPeriod, selectedDate, getRecordsByDate]);

  // 获取上一周期的数据用于对比
  const previousPeriodData = useMemo(() => {
    if (selectedPeriod !== '月' && selectedPeriod !== '年') {
      return [];
    }

    const prevDate = new Date(selectedDate);
    if (selectedPeriod === '月') {
      prevDate.setMonth(prevDate.getMonth() - 1);
    } else {
      prevDate.setFullYear(prevDate.getFullYear() - 1);
    }

    const data: ChartDataPoint[] = [];

    if (selectedPeriod === '月') {
      const year = prevDate.getFullYear();
      const month = prevDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = getRecordsByDate(date);
        const total = dayRecords.reduce((sum, record) => sum + record.value, 0);
        const dateStr = String(day);
        data.push({ date: dateStr, value: total });
      }
    } else if (selectedPeriod === '年') {
      const year = prevDate.getFullYear();

      for (let month = 0; month < 12; month++) {
        const endDate = new Date(year, month + 1, 0);
        let monthTotal = 0;

        for (let day = 1; day <= endDate.getDate(); day++) {
          const date = new Date(year, month, day);
          const dayRecords = getRecordsByDate(date);
          monthTotal += dayRecords.reduce((sum, record) => sum + record.value, 0);
        }

        data.push({ date: `${month + 1}月`, value: monthTotal });
      }
    }

    return data;
  }, [selectedPeriod, selectedDate, getRecordsByDate]);

  return {
    chartData,
    previousPeriodData,
  };
}



