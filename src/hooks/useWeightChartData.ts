/**
 * useWeightChartData - 体重图表数据计算Hook
 * 从WeightDetailScreen.tsx中提取的图表数据计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */
 

import { useMemo } from 'react';
import { formatTimeChinese, getBeijingTime } from '../utils/dateUtils';

interface WeightRecord {
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

interface UseWeightChartDataOptions {
  records: WeightRecord[];
  selectedPeriod: '天' | '周' | '月' | '年';
  selectedDate: Date;
  getRecordsByDate: (date: Date) => WeightRecord[];
}

export function useWeightChartData({
  records,
  selectedPeriod,
  selectedDate,
  getRecordsByDate,
}: UseWeightChartDataOptions) {
  void records;
  // 计算图表数据
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];
    const today = getBeijingTime(selectedDate);
    
    if (selectedPeriod === '周') {
      // 计算周的开始日期（周一）
      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);
      
      // 显示周一到周日的7天数据
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const beijingDate = getBeijingTime(date);
        const dayRecords = getRecordsByDate(date);
        // 只取最新的一条记录（按 recorded_at 降序排序，取第一个）
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        const value = latestRecord ? latestRecord.value : 0;
        const dateStr = `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`;
        const recordTime = latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '';
        data.push({ date: dateStr, value, recorded_at: latestRecord?.recorded_at, time: recordTime });
      }
    } else if (selectedPeriod === '月') {
      // 显示当前月份每天的数据
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = getRecordsByDate(date);
        // 只取最新的一条记录
        const latestRecord = dayRecords.length > 0 
          ? dayRecords.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
          : null;
        const value = latestRecord ? latestRecord.value : 0;
        const dateStr = String(day);
        const recordTime = latestRecord ? formatTimeChinese(latestRecord.recorded_at) : '';
        data.push({ date: dateStr, value, recorded_at: latestRecord?.recorded_at, time: recordTime });
      }
    } else if (selectedPeriod === '年') {
      // 显示12个月的数据
      const year = today.getFullYear();
      
      for (let month = 0; month < 12; month++) {
        const endDate = new Date(year, month + 1, 0);
        const monthRecords: WeightRecord[] = [];
        
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
        data.push({ date: `${month + 1}月`, value: monthAvg });
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
    const today = prevDate;

    if (selectedPeriod === '月') {
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = getRecordsByDate(date);
        const avgValue = dayRecords.length > 0 
          ? dayRecords.reduce((sum, r) => sum + r.value, 0) / dayRecords.length 
          : 0;
        const dateStr = String(day);
        data.push({ date: dateStr, value: avgValue });
      }
    } else if (selectedPeriod === '年') {
      const year = today.getFullYear();

      for (let month = 0; month < 12; month++) {
        const endDate = new Date(year, month + 1, 0);
        const monthValues: number[] = [];

        for (let day = 1; day <= endDate.getDate(); day++) {
          const date = new Date(year, month, day);
          const dayRecords = getRecordsByDate(date);
          if (dayRecords.length > 0) {
            const avgValue = dayRecords.reduce((sum, r) => sum + r.value, 0) / dayRecords.length;
            monthValues.push(avgValue);
          }
        }

        const monthAvg = monthValues.length > 0 
          ? monthValues.reduce((sum, v) => sum + v, 0) / monthValues.length 
          : 0;
        data.push({ date: `${month + 1}月`, value: monthAvg });
      }
    }

    return data;
  }, [selectedPeriod, selectedDate, getRecordsByDate]);

  // 计算图表的最大值和最小值
  const chartMaxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const values = chartData.map(d => d.value).filter(v => v > 0);
    if (values.length === 0) return 100;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    // 如果范围太小，使用更大的边距；否则使用10%边距
    const padding = range < 10 ? Math.max(5, range * 0.2) : range * 0.1;
    return Math.ceil(max + padding);
  }, [chartData]);

  const chartMinValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    const values = chartData.map(d => d.value).filter(v => v > 0);
    if (values.length === 0) return 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    // 如果范围太小，使用更大的边距；否则使用10%边距
    const padding = range < 10 ? Math.max(5, range * 0.2) : range * 0.1;
    return Math.max(0, Math.floor(min - padding));
  }, [chartData]);

  return {
    chartData,
    previousPeriodData,
    chartMaxValue,
    chartMinValue,
  };
}




















