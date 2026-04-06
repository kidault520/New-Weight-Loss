/**
 * useWaterRecords - 饮水记录 Hook（向后兼容）
 * 现在使用 React Query 实现，保持原有接口不变
 */

import { useCallback } from 'react';
import { useWaterRecordsQuery } from './useWaterRecordsQuery';

export interface WaterRecord {
  id: string;
  user_id: string;
  value: number;
  unit: string;
  notes?: string;
  recorded_at: string;
  created_at: string;
}

export const useWaterRecords = () => {
  // 使用新的 React Query Hook
  const {
    records,
    isLoading,
    isError,
    error,
    addRecord: addRecordAsync,
    updateRecord: updateRecordAsync,
    deleteRecord: deleteRecordAsync,
    getRecordsByDate: getRecordsByDateFromQuery,
    getTotalByDate: getTotalByDateFromQuery,
    refresh,
  } = useWaterRecordsQuery();

  // 包装异步函数以保持接口兼容
  const addRecord = useCallback(async (amount: number, date: Date, notes?: string) => {
    const recordNotes = notes || '手动记录';
    await addRecordAsync({ amount, date, notes: recordNotes });
  }, [addRecordAsync]);

  const deleteRecord = useCallback(async (id: string) => {
    await deleteRecordAsync(id);
  }, [deleteRecordAsync]);

  const updateRecord = useCallback(
    async (id: string, amount: number, date: Date, notes?: string) => {
      await updateRecordAsync({
        id,
        amount,
        date,
        notes: notes ?? '手动记录',
      });
    },
    [updateRecordAsync]
  );

  const getRecordsByDate = useCallback((date: Date): WaterRecord[] => {
    return getRecordsByDateFromQuery(date);
  }, [getRecordsByDateFromQuery]);

  const getTotalByDate = useCallback((date: Date): number => {
    return getTotalByDateFromQuery(date);
  }, [getTotalByDateFromQuery]);

  return {
    records,
    isLoading,
    error: isError ? (error as Error) : null,
    addRecord,
    updateRecord,
    deleteRecord,
    getRecordsByDate,
    getTotalByDate,
    refreshRecords: refresh,
  };
};

