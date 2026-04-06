/**
 * useExerciseRecords - 运动记录 Hook（向后兼容）
 * 现在使用 React Query 实现，保持原有接口不变
 */

import { useCallback } from 'react';
import { useExerciseRecordsQuery } from './useExerciseRecordsQuery';
import { ExerciseRecord as ExerciseRecordFromService } from '../services/exerciseService';

export interface ExerciseRecord {
  id: string;
  user_id: string;
  recorded_at: string;
  value?: number;
  unit?: string;
  exercise_data?: {
    name: string;
    duration?: number;
    type?: string;
    intensity?: string;
    icon?: string;
    originalId?: string;
    source?: 'ai' | 'manual';
  };
  source?: 'ai' | 'manual';
  created_at?: string;
  updated_at?: string;
  record_type?: string;
}

export interface UseExerciseRecordsOptions {
  dateRange?: { start: Date; end: Date };
  enableCache?: boolean;
  enableRealtime?: boolean;
}

export const useExerciseRecords = (options?: UseExerciseRecordsOptions) => {
  // 使用新的 React Query Hook
  const {
    records: recordsFromQuery,
    isLoading,
    isError,
    error,
    addRecord: addRecordAsync,
    updateRecord: updateRecordAsync,
    deleteRecord: deleteRecordAsync,
    refresh,
  } = useExerciseRecordsQuery(
    options?.dateRange?.start,
    options?.dateRange?.end
  );

  // 转换数据格式以保持向后兼容
  const records: ExerciseRecord[] = recordsFromQuery.map(r => ({
    id: r.id || '',
    user_id: r.user_id || '',
    recorded_at: r.recorded_at,
    value: r.duration,
    unit: 'minutes',
    exercise_data: {
      name: r.exercise_name,
      duration: r.duration,
      type: r.exercise_type,
      intensity: r.intensity,
      icon: r.icon,
      originalId: r.originalId,
      source: 'manual' as const,
    },
    source: 'manual' as const,
    created_at: r.recorded_at,
    updated_at: r.recorded_at,
  }));

  // 包装异步函数以保持接口兼容
  const addRecord = useCallback(async (data: Partial<ExerciseRecord>) => {
    if (data.exercise_data?.name && data.recorded_at) {
      await addRecordAsync({
        exercise_name: data.exercise_data.name,
        exercise_type: data.exercise_data.type || 'other',
        duration: data.exercise_data.duration || data.value || 0,
        calories_burned: 0, // 需要从数据中获取或计算
        intensity: data.exercise_data.intensity,
        recorded_at: data.recorded_at,
        icon: data.exercise_data.icon,
        originalId: data.exercise_data.originalId,
      });
    }
  }, [addRecordAsync]);

  const updateRecord = useCallback(async (id: string, updates: Partial<ExerciseRecord>) => {
    const updateData: Partial<ExerciseRecordFromService> = {};
    if (updates.exercise_data?.name) updateData.exercise_name = updates.exercise_data.name;
    if (updates.exercise_data?.type) updateData.exercise_type = updates.exercise_data.type;
    if (updates.exercise_data?.duration !== undefined) updateData.duration = updates.exercise_data.duration;
    if (updates.exercise_data?.intensity) updateData.intensity = updates.exercise_data.intensity;
    if (updates.recorded_at) updateData.recorded_at = updates.recorded_at;
    if (updates.exercise_data?.icon) updateData.icon = updates.exercise_data.icon;
    if (updates.exercise_data?.originalId) updateData.originalId = updates.exercise_data.originalId;
    
    await updateRecordAsync({ id, updates: updateData });
  }, [updateRecordAsync]);

  const deleteRecord = useCallback(async (id: string) => {
    await deleteRecordAsync(id);
  }, [deleteRecordAsync]);

  return {
    records,
    isLoading,
    error: isError ? (error as Error) : null,
    addRecord,
    updateRecord,
    deleteRecord,
    refresh,
  };
};






