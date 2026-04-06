/**
 * sleepService 测试
 * 测试睡眠记录服务的核心功能
 */
 

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sleepService } from '../sleepService';
import { supabase } from '../../config/supabase';

// Mock Supabase
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('sleepService', () => {
  const mockUserId = 'test-user-id';
  let mockQueryBuilder: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    (supabase.from as any).mockReturnValue(mockQueryBuilder);
  });

  describe('getRecords', () => {
    it('should fetch sleep records for a user', async () => {
      const mockRecords = [
        {
          id: '1',
          user_id: mockUserId,
          value: 7.5,
          unit: 'hours',
          notes: undefined,
          recorded_at: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockQueryBuilder.order.mockResolvedValue({
        data: mockRecords,
        error: null,
      });

      const records = await sleepService.getRecords(mockUserId);
      expect(records).toEqual(mockRecords);
      expect(supabase.from).toHaveBeenCalledWith('health_records');
    });

    it('should filter records by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockQueryBuilder.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await sleepService.getRecords(mockUserId, startDate, endDate);
      expect(mockQueryBuilder.gte).toHaveBeenCalled();
      expect(mockQueryBuilder.lte).toHaveBeenCalled();
    });

    it('should throw error when database query fails', async () => {
      const error = new Error('Database error');
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error,
      });

      await expect(sleepService.getRecords(mockUserId)).rejects.toThrow();
    });
  });

  describe('addRecord', () => {
    it('should add a new sleep record', async () => {
      const hours = 8;
      const date = new Date('2025-01-01');

      mockQueryBuilder.single.mockResolvedValue({
        data: { 
          id: '1', 
          user_id: mockUserId,
          value: hours,
          unit: 'hours',
          record_type: 'sleep',
          recorded_at: date.toISOString(),
          created_at: date.toISOString(),
          updated_at: date.toISOString(),
        },
        error: null,
      });

      const result = await sleepService.addRecord(mockUserId, hours, date);
      expect(result).toHaveProperty('id');
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should use default notes when not provided', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: '1' },
        error: null,
      });

      await sleepService.addRecord(mockUserId, 7.5, new Date());
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });
  });


  describe('deleteRecord', () => {
    it('should delete a sleep record', async () => {
      const recordId = '1';

      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await sleepService.deleteRecord(recordId);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', recordId);
    });

    it('should throw error when delete fails', async () => {
      const recordId = '1';
      const error = new Error('Delete failed');

      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error,
      });

      await expect(sleepService.deleteRecord(recordId)).rejects.toThrow();
    });
  });
});

