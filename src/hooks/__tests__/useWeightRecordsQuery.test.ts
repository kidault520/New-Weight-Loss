 
/**
 * useWeightRecordsQuery 测试
 * 测试体重记录查询Hook的核心功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWeightRecordsQuery } from '../useWeightRecordsQuery';
import { weightService } from '../../services/weightService';
import { useAuth } from '../../contexts/AuthContext';

// Mock dependencies
vi.mock('../../services/weightService');
vi.mock('../../contexts/AuthContext');
vi.mock('../../utils/dateUtils', () => ({
  getBeijingTime: (date: Date) => date,
  toLocalDateString: (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
  isSameDay: (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  },
}));

describe('useWeightRecordsQuery', () => {
  let queryClient: QueryClient;
  const mockUser = { id: 'test-user-id' };
  const mockRecords = [
    {
      id: '1',
      user_id: 'test-user-id',
      value: 70,
      unit: 'kg',
      notes: 'test',
      recorded_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: '2',
      user_id: 'test-user-id',
      value: 71,
      unit: 'kg',
      notes: 'test2',
      recorded_at: '2025-01-02T00:00:00Z',
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: mockUser });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe('查询功能', () => {
    it('should fetch weight records', async () => {
      (weightService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.records).toEqual(mockRecords);
      expect(weightService.getRecords).toHaveBeenCalledWith(mockUser.id, undefined, undefined);
    });

    it('should fetch records with date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      (weightService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWeightRecordsQuery(startDate, endDate), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(weightService.getRecords).toHaveBeenCalledWith(mockUser.id, startDate, endDate);
    });

    it('should return empty array when user is not authenticated', async () => {
      (useAuth as any).mockReturnValue({ user: null });

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.records).toEqual([]);
      expect(weightService.getRecords).not.toHaveBeenCalled();
    });

    it('should handle loading state', () => {
      (weightService.getRecords as any).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should handle error state', async () => {
      const error = new Error('Failed to fetch');
      (weightService.getRecords as any).mockRejectedValue(error);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBe(error);
    });
  });

  describe('添加记录', () => {
    it('should add a new weight record', async () => {
      const newRecord = { ...mockRecords[0], id: '3' };
      (weightService.getRecords as any).mockResolvedValue(mockRecords);
      (weightService.addRecord as any).mockResolvedValue(newRecord);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.addRecord({
        weight: 72,
        date: new Date('2025-01-03'),
        notes: 'new record',
      });

      expect(weightService.addRecord).toHaveBeenCalledWith(
        mockUser.id,
        72,
        new Date('2025-01-03'),
        'new record'
      );
    });

    it('should throw error when user is not authenticated', async () => {
      (useAuth as any).mockReturnValue({ user: null });
      (weightService.getRecords as any).mockResolvedValue([]);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        result.current.addRecord({
          weight: 72,
          date: new Date('2025-01-03'),
        })
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('更新记录', () => {
    it('should update an existing record', async () => {
      const updatedRecord = { ...mockRecords[0], value: 75 };
      (weightService.getRecords as any).mockResolvedValue(mockRecords);
      (weightService.updateRecord as any).mockResolvedValue(updatedRecord);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.updateRecord({
        id: '1',
        weight: 75,
        date: new Date('2025-01-01'),
        notes: 'updated',
      });

      expect(weightService.updateRecord).toHaveBeenCalledWith(
        '1',
        75,
        new Date('2025-01-01'),
        'updated'
      );
    });
  });

  describe('删除记录', () => {
    it('should delete a record', async () => {
      (weightService.getRecords as any).mockResolvedValue(mockRecords);
      (weightService.deleteRecord as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.deleteRecord('1');

      expect(weightService.deleteRecord).toHaveBeenCalledWith('1');
    });
  });

  describe('辅助函数', () => {
    it('should get latest record', async () => {
      (weightService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const latest = result.current.getLatestRecord();
      expect(latest).toEqual(mockRecords[0]);
    });

    it('should return null when no records', async () => {
      (weightService.getRecords as any).mockResolvedValue([]);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const latest = result.current.getLatestRecord();
      expect(latest).toBeNull();
    });

    it('should get records by date', async () => {
      (weightService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const dateRecords = result.current.getRecordsByDate(new Date('2025-01-01'));
      expect(dateRecords).toHaveLength(1);
      expect(dateRecords[0].id).toBe('1');
    });
  });

  describe('刷新功能', () => {
    it('should refresh records', async () => {
      (weightService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWeightRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.refresh();

      expect(weightService.getRecords).toHaveBeenCalledTimes(2);
    });
  });
});

