/**
 * weightService 测试
 * 测试体重记录服务的核心功能
 */
 

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { weightService } from '../weightService';
import { supabase } from '../../config/supabase';

// Mock Supabase
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('weightService', () => {
  const mockUserId = 'test-user-id';
  let mockQueryBuilder: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // 创建新的mock builder，确保链式调用正确
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
    it('should fetch weight records for a user', async () => {
      const mockRecords = [
        {
          id: '1',
          user_id: mockUserId,
          value: 70,
          unit: 'kg',
          notes: 'test',
          recorded_at: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      // 设置链式调用的最终返回值
      mockQueryBuilder.order.mockResolvedValue({
        data: mockRecords,
        error: null,
      });

      const result = await weightService.getRecords(mockUserId);

      expect(supabase.from).toHaveBeenCalledWith('health_records');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('record_type', 'weight');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(70);
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockQueryBuilder.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await weightService.getRecords(mockUserId, startDate, endDate);

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'recorded_at',
        startDate.toISOString()
      );
      expect(mockQueryBuilder.lte).toHaveBeenCalled();
    });

    it('should throw error when database query fails', async () => {
      const mockError = new Error('Database error');
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(weightService.getRecords(mockUserId)).rejects.toThrow();
    });
  });

  describe('addRecord', () => {
    it('should add a new weight record', async () => {
      const mockRecord = {
        id: '1',
        user_id: mockUserId,
        value: 70,
        unit: 'kg',
        notes: 'test notes', // 使用传入的notes
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

      const result = await weightService.addRecord(
        mockUserId,
        70,
        new Date('2025-01-01'),
        'test notes'
      );

      expect(result.value).toBe(70);
      expect(result.unit).toBe('kg');
      expect(result.notes).toBe('test notes');
    });

    it('should use default notes when not provided', async () => {
      const mockRecord = {
        id: '1',
        user_id: mockUserId,
        value: 70,
        unit: 'kg',
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

      const result = await weightService.addRecord(
        mockUserId,
        70,
        new Date('2025-01-01')
      );

      expect(result.notes).toBe('手动记录');
    });
  });

  describe('updateRecord', () => {
    it('should update an existing weight record', async () => {
      const recordId = 'record-1';
      const mockUpdatedRecord = {
        id: recordId,
        user_id: mockUserId,
        value: 72,
        unit: 'kg',
        notes: 'updated',
        recorded_at: '2025-01-02T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      const mockSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockUpdatedRecord,
          error: null,
        }),
      });

      const mockEq = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      mockQueryBuilder.update.mockReturnValue({
        eq: mockEq,
      });

      const result = await weightService.updateRecord(
        recordId,
        72,
        new Date('2025-01-02'),
        'updated'
      );

      expect(result.value).toBe(72);
      expect(result.notes).toBe('updated');
    });
  });

  describe('deleteRecord', () => {
    it('should delete a weight record', async () => {
      const recordId = 'record-1';

      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      mockQueryBuilder.delete.mockReturnValue({
        eq: mockEq,
      });

      await expect(
        weightService.deleteRecord(recordId)
      ).resolves.not.toThrow();
    });

    it('should throw error when deletion fails', async () => {
      const recordId = 'record-1';
      const mockError = new Error('Deletion failed');

      const mockEq = vi.fn().mockResolvedValue({
        error: mockError,
      });

      mockQueryBuilder.delete.mockReturnValue({
        eq: mockEq,
      });

      await expect(weightService.deleteRecord(recordId)).rejects.toThrow();
    });
  });

  describe('getLatestWeight', () => {
    it('should return latest weight value', async () => {
      const mockData = { value: 70 };

      mockQueryBuilder.select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockData,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await weightService.getLatestWeight(mockUserId);

      expect(result).toBe(70);
    });

    it('should return null when no records exist', async () => {
      mockQueryBuilder.select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          }),
        }),
      });

      const result = await weightService.getLatestWeight(mockUserId);

      expect(result).toBeNull();
    });
  });
});

