/**
 * stepsService 测试
 * 测试步数记录服务的核心功能
 */
 

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stepsService } from '../stepsService';
import { supabase } from '../../config/supabase';

// Mock Supabase
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('stepsService', () => {
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
    it('should fetch steps records for a user', async () => {
      const mockRecords = [
        {
          id: '1',
          user_id: mockUserId,
          value: 10000,
          unit: 'steps',
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

      const records = await stepsService.getRecords(mockUserId);
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

      await stepsService.getRecords(mockUserId, startDate, endDate);
      expect(mockQueryBuilder.gte).toHaveBeenCalled();
      expect(mockQueryBuilder.lte).toHaveBeenCalled();
    });

    it('should throw error when database query fails', async () => {
      const error = new Error('Database error');
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error,
      });

      await expect(stepsService.getRecords(mockUserId)).rejects.toThrow();
    });
  });

  describe('addRecord', () => {
    it('should add a new steps record', async () => {
      const steps = 10000;
      const date = new Date('2025-01-01');

      mockQueryBuilder.single.mockResolvedValue({
        data: { 
          id: '1', 
          user_id: mockUserId,
          value: steps,
          unit: 'steps',
          record_type: 'steps',
          recorded_at: date.toISOString(),
          created_at: date.toISOString(),
          updated_at: date.toISOString(),
        },
        error: null,
      });

      const result = await stepsService.addRecord(mockUserId, steps, date);
      expect(result).toHaveProperty('id');
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });
  });


  describe('deleteRecord', () => {
    it('should delete a steps record', async () => {
      const recordId = '1';

      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await stepsService.deleteRecord(recordId);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should throw error when delete fails', async () => {
      const recordId = '1';
      const error = new Error('Delete failed');

      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error,
      });

      await expect(stepsService.deleteRecord(recordId)).rejects.toThrow();
    });
  });
});

