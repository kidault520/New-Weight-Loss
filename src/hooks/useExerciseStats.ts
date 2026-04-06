 
/**
 * useExerciseStats - 运动统计计算Hook
 * 从ExerciseStatsDetailScreen.tsx中提取的统计计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { useMemo } from 'react';
import { toLocalDateString } from '../utils/dateUtils';

interface UseExerciseStatsOptions {
  selectedDate: Date;
  userDayDataOverrides: Record<string, any>;
  exerciseRecordsFromDB: any[];
}

export function useExerciseStats({
  selectedDate,
  userDayDataOverrides,
  exerciseRecordsFromDB,
}: UseExerciseStatsOptions) {
  const formatDateKey = (date: Date) => {
    return toLocalDateString(date);
  };

  // 计算当前运动数据
  const currentExerciseData = useMemo(() => {
    const dateKey = formatDateKey(selectedDate);
    const dayData = userDayDataOverrides[dateKey];

    const localRecords = dayData?.records?.filter((r: any) => r.type === 'exercise') || [];
    // 注意：exerciseRecordsFromDB 已经是 ExerciseRecord 格式
    // 包含：id, exercise_name, duration, calories_burned, icon, originalId, recorded_at 等字段
    const dbRecords = exerciseRecordsFromDB.filter((record: any) => {
      const recordDate = new Date(record.recorded_at);
      return recordDate.toDateString() === selectedDate.toDateString();
    }).map((record: any) => ({
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
    const totalMinutes = unique.reduce((sum, r: any) => sum + (r.exercise_data?.duration || 0), 0);

    return {
      calories: totalCalories,
      minutes: totalMinutes
    };
  }, [selectedDate, userDayDataOverrides, exerciseRecordsFromDB]);

  return {
    activityCalories: currentExerciseData.calories,
    exerciseMinutes: currentExerciseData.minutes,
  };
}



