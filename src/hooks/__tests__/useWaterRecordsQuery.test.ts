 
/**
 * useWaterRecordsQuery 测试
 * 测试饮水记录查询Hook的核心功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWaterRecordsQuery } from '../useWaterRecordsQuery';
import { waterService } from '../../services/waterService';
import { useAuth } from '../../contexts/AuthContext';

// Mock dependencies
vi.mock('../../services/waterService');
vi.mock('../../contexts/AuthContext');
vi.mock('../../utils/dateUtils', () => ({
  getBeijingTime: (date: Date) => date,
  toLocalDateString: (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
  isSameDay: (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  },
}));

describe('useWaterRecordsQuery', () => {
  let queryClient: QueryClient;
  const mockUser = { id: 'test-user-id' };
  const mockRecords = [
    {
      id: '1',
      user_id: 'test-user-id',
      value: 500,
      unit: 'ml',
      notes: 'test',
      recorded_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: '2',
      user_id: 'test-user-id',
      value: 300,
      unit: 'ml',
      notes: 'test2',
      recorded_at: '2025-01-01T12:00:00Z',
      created_at: '2025-01-01T12:00:00Z',
      updated_at: '2025-01-01T12:00:00Z',
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
    it('should fetch water records', async () => {
      (waterService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.records).toEqual(mockRecords);
      expect(waterService.getRecords).toHaveBeenCalledWith(mockUser.id, undefined, undefined);
    });

    it('should fetch records with date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      (waterService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWaterRecordsQuery(startDate, endDate), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(waterService.getRecords).toHaveBeenCalledWith(mockUser.id, startDate, endDate);
    });

    it('should return empty array when user is not authenticated', async () => {
      (useAuth as any).mockReturnValue({ user: null });

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.records).toEqual([]);
      expect(waterService.getRecords).not.toHaveBeenCalled();
    });
  });

  describe('添加记录', () => {
    it('should add a new water record', async () => {
      const newRecord = { ...mockRecords[0], id: '3' };
      (waterService.getRecords as any).mockResolvedValue(mockRecords);
      (waterService.addRecord as any).mockResolvedValue(newRecord);

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.addRecord({
        amount: 400,
        date: new Date('2025-01-02'),
        notes: 'new record',
      });

      expect(waterService.addRecord).toHaveBeenCalledWith(
        mockUser.id,
        400,
        new Date('2025-01-02'),
        'new record'
      );
    });
  });

  describe('删除记录', () => {
    it('should delete a record', async () => {
      (waterService.getRecords as any).mockResolvedValue(mockRecords);
      (waterService.deleteRecord as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.deleteRecord('1');

      expect(waterService.deleteRecord).toHaveBeenCalledWith('1');
    });
  });

  describe('辅助函数', () => {
    it('should get records by date', async () => {
      (waterService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const dateRecords = result.current.getRecordsByDate(new Date('2025-01-01'));
      expect(dateRecords).toHaveLength(2);
    });

    it('should get total by date', async () => {
      (waterService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const total = result.current.getTotalByDate(new Date('2025-01-01'));
      expect(total).toBe(800); // 500 + 300
    });

    it('should return 0 when no records for date', async () => {
      (waterService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const total = result.current.getTotalByDate(new Date('2025-01-02'));
      expect(total).toBe(0);
    });
  });

  describe('刷新功能', () => {
    it('should refresh records', async () => {
      (waterService.getRecords as any).mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useWaterRecordsQuery(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.refresh();

      expect(waterService.getRecords).toHaveBeenCalledTimes(2);
    });
  });
});

