/**
 * useBloodGlucoseChartData - 血糖图表数据计算Hook
 * 从BloodGlucoseDetailScreen.tsx中提取的图表数据计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { useMemo, useCallback } from 'react';
import { formatTimeChinese, getBeijingTime } from '../utils/dateUtils';

interface BloodGlucoseRecord {
  id: string;
  value: number;
  recorded_at: string;
  notes?: string;
}

interface ChartDataPoint {
  time?: string;
  value: number;
  label: string;
  date?: string;
  recorded_at?: string;
}

interface UseBloodGlucoseChartDataOptions {
  records: BloodGlucoseRecord[];
  selectedPeriod: '天' | '周' | '月' | '季度';
  currentDate: Date;
  selectedTimeRange?: '3小时' | '8小时' | '12小时' | '24小时';
}

export function useBloodGlucoseChartData({
  records,
  selectedPeriod,
  currentDate,
  selectedTimeRange,
}: UseBloodGlucoseChartDataOptions) {
  // 根据日期获取记录
  const getRecordsByDate = useCallback((date: Date) => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    return records.filter((record: BloodGlucoseRecord) => {
      const recordDate = new Date(record.recorded_at);
      const recordYear = recordDate.getFullYear();
      const recordMonth = recordDate.getMonth();
      const recordDay = recordDate.getDate();

      return recordYear === targetYear && 
             recordMonth === targetMonth && 
             recordDay === targetDay;
    });
  }, [records]);

  // 计算图表数据
  const chartData = useMemo(() => {
    if (selectedPeriod === '天') {
      // 天视图：按时间段分组（00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-24:00）
      const dayRecords = getRecordsByDate(currentDate);
      const timePeriods = [
        { label: '00:00', start: 0, end: 6 },
        { label: '06:00', start: 6, end: 12 },
        { label: '12:00', start: 12, end: 18 },
        { label: '18:00', start: 18, end: 24 }
      ];
      
      // 根据 selectedTimeRange 决定显示哪些时间段
      let visiblePeriods = timePeriods;
      if (selectedTimeRange) {
        const now = new Date();
        const currentHour = now.getHours();
        
        let hoursBack = 24; // 默认24小时
        if (selectedTimeRange === '3小时') hoursBack = 3;
        else if (selectedTimeRange === '8小时') hoursBack = 8;
        else if (selectedTimeRange === '12小时') hoursBack = 12;
        else if (selectedTimeRange === '24小时') hoursBack = 24;
        
        const cutoffHour = currentHour - hoursBack;
        
        // 过滤时间段：只显示在时间范围内的
        visiblePeriods = timePeriods.filter(period => {
          // 如果时间段结束时间在截止时间之后，则显示
          return period.end > cutoffHour;
        });
      }
      
      return visiblePeriods.map(period => {
        const periodRecords = dayRecords.filter((record: BloodGlucoseRecord) => {
          const recordDate = new Date(record.recorded_at);
          const hour = recordDate.getHours();
          return hour >= period.start && hour < period.end;
        });
        
        // 如果有多条记录，取平均值；如果只有一条，取该值；如果没有，为0
        const avgValue = periodRecords.length > 0
          ? periodRecords.reduce((sum: number, r: BloodGlucoseRecord) => sum + r.value, 0) / periodRecords.length
          : 0;
        
        return {
          time: period.label,
          value: parseFloat(avgValue.toFixed(1)),
          label: period.label,
          recorded_at: periodRecords.length > 0 ? periodRecords[periodRecords.length - 1].recorded_at : undefined
        };
      });
    } else if (selectedPeriod === '周') {
      // 周视图：每天按时间顺序排列所有记录
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      
      const data: ChartDataPoint[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const beijingDate = getBeijingTime(date);
        const dayRecords = getRecordsByDate(date);
        // 按时间升序排序
        const sortedRecords = dayRecords.sort((a: BloodGlucoseRecord, b: BloodGlucoseRecord) => 
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );
        
        // 如果有多条记录，取平均值；如果只有一条，取该值
        const avgValue = sortedRecords.length > 0
          ? sortedRecords.reduce((sum: number, r: BloodGlucoseRecord) => sum + r.value, 0) / sortedRecords.length
          : 0;
        
        data.push({
          label: `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`,
          value: parseFloat(avgValue.toFixed(1)),
          date: `${String(beijingDate.getMonth() + 1).padStart(2, '0')}/${String(beijingDate.getDate()).padStart(2, '0')}`,
          recorded_at: sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].recorded_at : undefined,
          time: sortedRecords.length > 0 ? formatTimeChinese(sortedRecords[sortedRecords.length - 1].recorded_at) : undefined
        });
      }
      return data;
    } else if (selectedPeriod === '月') {
      // 月视图：每天按时间顺序排列所有记录
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const data: ChartDataPoint[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = getRecordsByDate(date);
        // 按时间升序排序
        const sortedRecords = dayRecords.sort((a: BloodGlucoseRecord, b: BloodGlucoseRecord) => 
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );
        
        // 如果有多条记录，取平均值；如果只有一条，取该值
        const avgValue = sortedRecords.length > 0
          ? sortedRecords.reduce((sum: number, r: BloodGlucoseRecord) => sum + r.value, 0) / sortedRecords.length
          : 0;
        
        data.push({
          label: String(day),
          value: parseFloat(avgValue.toFixed(1)),
          date: String(day),
          recorded_at: sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].recorded_at : undefined,
          time: sortedRecords.length > 0 ? formatTimeChinese(sortedRecords[sortedRecords.length - 1].recorded_at) : undefined
        });
      }
      return data;
    } else if (selectedPeriod === '季度') {
      // 季度视图：每月按时间顺序排列所有记录
      const year = currentDate.getFullYear();
      const quarter = Math.floor(currentDate.getMonth() / 3);
      const data: ChartDataPoint[] = [];
      
      for (let i = 0; i < 3; i++) {
        const month = quarter * 3 + i;
        const endDate = new Date(year, month + 1, 0);
        const monthRecords: BloodGlucoseRecord[] = [];
        
        for (let day = 1; day <= endDate.getDate(); day++) {
          const date = new Date(year, month, day);
          const dayRecords = getRecordsByDate(date);
          // 按时间升序排序
          const sortedRecords = dayRecords.sort((a: BloodGlucoseRecord, b: BloodGlucoseRecord) => 
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
          monthRecords.push(...sortedRecords);
        }
        
        // 如果有多条记录，取平均值
        const avgValue = monthRecords.length > 0
          ? monthRecords.reduce((sum: number, r: BloodGlucoseRecord) => sum + r.value, 0) / monthRecords.length
          : 0;
        
        data.push({
          label: `${month + 1}月`,
          value: parseFloat(avgValue.toFixed(1)),
          date: `${month + 1}月`,
          recorded_at: monthRecords.length > 0 ? monthRecords[monthRecords.length - 1].recorded_at : undefined,
          time: monthRecords.length > 0 ? formatTimeChinese(monthRecords[monthRecords.length - 1].recorded_at) : undefined
        });
      }
      return data;
    }
    return [];
  }, [selectedPeriod, currentDate, selectedTimeRange, getRecordsByDate]);

  // 获取上一周期的数据用于对比（仅用于月/季度视窗）
  const previousPeriodData = useMemo(() => {
    if (selectedPeriod !== '月' && selectedPeriod !== '季度') {
      return [];
    }

    const prevDate = new Date(currentDate);
    if (selectedPeriod === '月') {
      prevDate.setMonth(prevDate.getMonth() - 1);
    } else if (selectedPeriod === '季度') {
      prevDate.setMonth(prevDate.getMonth() - 3);
    }

    // 复用chartData的计算逻辑，但使用prevDate
    if (selectedPeriod === '月') {
      const year = prevDate.getFullYear();
      const month = prevDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const data: ChartDataPoint[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = getRecordsByDate(date);
        const sortedRecords = dayRecords.sort((a: BloodGlucoseRecord, b: BloodGlucoseRecord) => 
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );
        
        const avgValue = sortedRecords.length > 0
          ? sortedRecords.reduce((sum: number, r: BloodGlucoseRecord) => sum + r.value, 0) / sortedRecords.length
          : 0;
        
        data.push({
          label: String(day),
          value: parseFloat(avgValue.toFixed(1)),
          date: String(day),
        });
      }
      return data;
    } else if (selectedPeriod === '季度') {
      const year = prevDate.getFullYear();
      const quarter = Math.floor(prevDate.getMonth() / 3);
      const data: ChartDataPoint[] = [];
      
      for (let i = 0; i < 3; i++) {
        const month = quarter * 3 + i;
        const endDate = new Date(year, month + 1, 0);
        const monthRecords: BloodGlucoseRecord[] = [];
        
        for (let day = 1; day <= endDate.getDate(); day++) {
          const date = new Date(year, month, day);
          const dayRecords = getRecordsByDate(date);
          const sortedRecords = dayRecords.sort((a: BloodGlucoseRecord, b: BloodGlucoseRecord) => 
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
          monthRecords.push(...sortedRecords);
        }
        
        const avgValue = monthRecords.length > 0
          ? monthRecords.reduce((sum: number, r: BloodGlucoseRecord) => sum + r.value, 0) / monthRecords.length
          : 0;
        
        data.push({
          label: `${month + 1}月`,
          value: parseFloat(avgValue.toFixed(1)),
          date: `${month + 1}月`,
        });
      }
      return data;
    }
    return [];
  }, [selectedPeriod, currentDate, getRecordsByDate]);

  return {
    chartData,
    previousPeriodData,
    getRecordsByDate,
  };
}




