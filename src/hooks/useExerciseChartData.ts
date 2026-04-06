 
/**
 * useExerciseChartData - 运动图表数据计算Hook
 * 从ExerciseStatsDetailScreen.tsx中提取的图表数据计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { useCallback, useMemo } from 'react';
import { toLocalDateString } from '../utils/dateUtils';

interface ChartDataPoint {
  label: string;
  calories: number;
  value: number;
}

interface UseExerciseChartDataOptions {
  timePeriod: 'day' | 'week' | 'month' | 'year';
  currentWeekStart: Date;
  userDayDataOverrides: Record<string, any>;
  exerciseRecordsFromDB: any[];
}

export function useExerciseChartData({
  timePeriod,
  currentWeekStart,
  userDayDataOverrides,
  exerciseRecordsFromDB,
}: UseExerciseChartDataOptions) {
  const formatDateKey = useCallback((date: Date) => {
    return toLocalDateString(date);
  }, []);

  // 获取指定日期的运动卡路里
  const getExerciseCaloriesForDate = useCallback((date: Date): number => {
    const dateKey = formatDateKey(date);
    const dayData = userDayDataOverrides[dateKey];
    const localRecords = dayData?.records?.filter((r: any) => r.type === 'exercise') || [];
    
    const targetDateStr = toLocalDateString(date);
    // 注意：exerciseRecordsFromDB 已经是 ExerciseRecord 格式
    // 包含：id, exercise_name, duration, calories_burned, icon, originalId, recorded_at 等字段
    const dbRecords = exerciseRecordsFromDB
      .filter((record: any) => {
        const recordDateStr = toLocalDateString(new Date(record.recorded_at));
        return recordDateStr === targetDateStr;
      })
      .map((record: any) => ({
        id: record.id,
        type: 'exercise' as const,
        name: record.exercise_name || '',
        time: new Date(record.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        exercise_data: {
          name: record.exercise_name || '',
          calories: record.calories_burned || 0,
          duration: record.duration || 0,
        }
      }));

    const all = [...dbRecords, ...localRecords];
    const unique = Array.from(new Map(all.map(r => [r.id || `${r.exercise_data?.name}-${r.time}-${r.exercise_data?.duration || 0}`, r])).values());
    const totalCalories = unique.reduce((sum, r: any) => sum + (r.exercise_data?.calories || 0), 0);
    
    return totalCalories;
  }, [exerciseRecordsFromDB, formatDateKey, userDayDataOverrides]);

  // 获取指定时间段内的运动卡路里
  const getExerciseCaloriesForTimePeriod = useCallback((date: Date, startHour: number, endHour: number): number => {
    const dateKey = formatDateKey(date);
    const dayData = userDayDataOverrides[dateKey];
    const localRecords = dayData?.records?.filter((r: any) => r.type === 'exercise') || [];
    
    const targetDateStr = toLocalDateString(date);
    // 注意：exerciseRecordsFromDB 已经是 ExerciseRecord 格式
    const dbRecords = exerciseRecordsFromDB
      .filter((record: any) => {
        const recordDateStr = toLocalDateString(new Date(record.recorded_at));
        if (recordDateStr !== targetDateStr) return false;
        const recordHour = new Date(record.recorded_at).getHours();
        return recordHour >= startHour && recordHour < endHour;
      })
      .map((record: any) => ({
        id: record.id,
        type: 'exercise' as const,
        name: record.exercise_name || '',
        time: new Date(record.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        exercise_data: {
          name: record.exercise_name || '',
          calories: record.calories_burned || 0,
          duration: record.duration || 0,
        }
      }));

    const filteredLocalRecords = localRecords.filter((r: any) => {
      if (!r.time) return false;
      const timeMatch = r.time.match(/(\d{2}):(\d{2})/);
      if (!timeMatch) return false;
      const hour = parseInt(timeMatch[1]);
      return hour >= startHour && hour < endHour;
    });

    const all = [...dbRecords, ...filteredLocalRecords];
    const unique = Array.from(new Map(all.map(r => [r.id || `${r.exercise_data?.name}-${r.time}-${r.exercise_data?.duration || 0}`, r])).values());
    const totalCalories = unique.reduce((sum, r: any) => sum + (r.exercise_data?.calories || 0), 0);
    
    return totalCalories;
  }, [exerciseRecordsFromDB, formatDateKey, userDayDataOverrides]);
  // 计算图表数据
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];

    if (timePeriod === 'day') {
      // Use time periods: 00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-24:00
      const timePeriods = [
        { label: '00:00', start: 0, end: 6 },
        { label: '06:00', start: 6, end: 12 },
        { label: '12:00', start: 12, end: 18 },
        { label: '18:00', start: 18, end: 24 }
      ];
      
      timePeriods.forEach(period => {
        const calories = getExerciseCaloriesForTimePeriod(currentWeekStart, period.start, period.end);
        data.push({
          label: period.label,
          calories: calories,
          value: calories
        });
      });
    } else if (timePeriod === 'week') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        const calories = getExerciseCaloriesForDate(date);
        data.push({
          label: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
          calories: calories,
          value: calories
        });
      }
    } else if (timePeriod === 'month') {
      const year = currentWeekStart.getFullYear();
      const month = currentWeekStart.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const calories = getExerciseCaloriesForDate(date);
        data.push({
          label: String(day),
          calories: calories,
          value: calories
        });
      }
    } else if (timePeriod === 'year') {
      const year = currentWeekStart.getFullYear();

      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let monthTotal = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          monthTotal += getExerciseCaloriesForDate(date);
        }

        data.push({
          label: `${month + 1}`,
          calories: monthTotal,
          value: monthTotal
        });
      }
    }

    return data;
  }, [
    timePeriod,
    currentWeekStart,
    getExerciseCaloriesForDate,
    getExerciseCaloriesForTimePeriod,
  ]);

  // 获取上一周期的数据用于对比
  const previousPeriodData = useMemo(() => {
    if (timePeriod !== 'month' && timePeriod !== 'year') {
      return [];
    }

    const prevDate = new Date(currentWeekStart);
    if (timePeriod === 'month') {
      prevDate.setMonth(prevDate.getMonth() - 1);
    } else {
      prevDate.setFullYear(prevDate.getFullYear() - 1);
    }

    const data: ChartDataPoint[] = [];
    if (timePeriod === 'month') {
      const year = prevDate.getFullYear();
      const month = prevDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const calories = getExerciseCaloriesForDate(date);
        data.push({
          label: String(day),
          calories: calories,
          value: calories
        });
      }
    } else if (timePeriod === 'year') {
      const year = prevDate.getFullYear();

      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let monthTotal = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          monthTotal += getExerciseCaloriesForDate(date);
        }

        data.push({
          label: `${month + 1}`,
          calories: monthTotal,
          value: monthTotal
        });
      }
    }

    return data;
  }, [timePeriod, currentWeekStart, getExerciseCaloriesForDate]);

  // 计算Y轴最大值和最小值
  const yAxisMax = useMemo(() => {
    const maxCalories = Math.max(...chartData.map(d => d.calories), 100);
    return Math.ceil(maxCalories / 100) * 100;
  }, [chartData]);

  const yAxisMin = 0;

  return {
    chartData,
    previousPeriodData,
    yAxisMax,
    yAxisMin,
  };
}

