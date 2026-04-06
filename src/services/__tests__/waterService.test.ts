/**
 * waterService 测试
 * 测试饮水记录服务的核心功能
 */
 

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waterService } from '../waterService';
import { supabase } from '../../config/supabase';

// Mock Supabase
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('waterService', () => {
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
    it('should fetch water records for a user', async () => {
      const mockRecords = [
        {
          id: '1',
          user_id: mockUserId,
          value: 500,
          unit: 'ml',
          notes: 'test',
          recorded_at: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockQueryBuilder.order.mockResolvedValue({
        data: mockRecords,
        error: null,
      });

      const result = await waterService.getRecords(mockUserId);

      expect(supabase.from).toHaveBeenCalledWith('health_records');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('record_type', 'water');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(500);
      expect(result[0].unit).toBe('ml');
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockQueryBuilder.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await waterService.getRecords(mockUserId, startDate, endDate);

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'recorded_at',
        startDate.toISOString()
      );
      expect(mockQueryBuilder.lte).toHaveBeenCalled();
    });
  });

  describe('addRecord', () => {
    it('should add a new water record', async () => {
      const mockRecord = {
        id: '1',
        user_id: mockUserId,
        value: 500,
        unit: 'ml',
        notes: '手动记录',
        recorded_at: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const mockSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockRecord,
          error: null,
        }),
      });

      mockQueryBuilder.insert.mockReturnValue({
        select: mockSelect,
      });

      const result = await waterService.addRecord(
        mockUserId,
        500,
        new Date('2025-01-01'),
        'test notes'
      );

      expect(result.value).toBe(500);
      expect(result.unit).toBe('ml');
    });
  });

  describe('deleteRecord', () => {
    it('should delete a water record', async () => {
      const recordId = 'record-1';

      const mockEqSecond = vi.fn().mockResolvedValue({
        error: null,
      });
      const mockEqFirst = vi.fn().mockReturnValue({
        eq: mockEqSecond,
      });

      mockQueryBuilder.delete.mockReturnValue({
        eq: mockEqFirst,
      });

      await expect(waterService.deleteRecord(recordId)).resolves.not.toThrow();
      expect(mockEqFirst).toHaveBeenCalledWith('id', recordId);
      expect(mockEqSecond).toHaveBeenCalledWith('record_type', 'water');
    });
  });
});

