/**
 * useWeightRecords - 体重记录 Hook（向后兼容）
 * 现在使用 React Query 实现，保持原有接口不变
 */

import { useCallback } from 'react';
import { useWeightRecordsQuery } from './useWeightRecordsQuery';

export interface WeightRecord {
  id: string;
  user_id: string;
  value: number;
  unit: string;
  notes?: string;
  recorded_at: string;
  created_at: string;
}

export const useWeightRecords = () => {
  // 使用新的 React Query Hook
  const {
    records,
    isLoading,
    isError,
    error,
    addRecord: addRecordAsync,
    updateRecord: updateRecordAsync,
    deleteRecord: deleteRecordAsync,
    getLatestRecord: getLatestRecordFromQuery,
    getRecordsByDate: getRecordsByDateFromQuery,
    refresh,
  } = useWeightRecordsQuery();

  // React Query 会自动处理数据更新，无需监听事件

  // 包装异步函数以保持接口兼容
  const addRecord = useCallback(async (weight: number, date: Date, notes?: string) => {
    await addRecordAsync({ weight, date, notes });
  }, [addRecordAsync]);

  const updateRecord = useCallback(async (id: string, weight: number, date: Date, notes?: string) => {
    await updateRecordAsync({ id, weight, date, notes });
  }, [updateRecordAsync]);

  const deleteRecord = useCallback(async (id: string) => {
    await deleteRecordAsync(id);
  }, [deleteRecordAsync]);

  const getLatestRecord = useCallback((): WeightRecord | null => {
    return getLatestRecordFromQuery();
  }, [getLatestRecordFromQuery]);

  const getRecordsByDate = useCallback((date: Date): WeightRecord[] => {
    return getRecordsByDateFromQuery(date);
  }, [getRecordsByDateFromQuery]);

  return {
    records,
    isLoading,
    error: isError ? (error as Error) : null,
    addRecord,
    updateRecord,
    deleteRecord,
    getLatestRecord,
    getRecordsByDate,
    refreshRecords: refresh,
  };
};
