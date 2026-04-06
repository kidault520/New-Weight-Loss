/**
 * exerciseService 测试
 * 运动记录读写 health_records（record_type = exercise）
 */
 

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exerciseService, ExerciseRecord } from '../exerciseService';
import { supabase } from '../../config/supabase';

vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('exerciseService', () => {
  const mockUserId = 'test-user-id';
  const mockUser = { id: mockUserId };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });
  });

  describe('addExercise', () => {
    it('should add a new exercise record', async () => {
      const mockExercise: ExerciseRecord = {
        exercise_name: '跑步',
        duration: 30,
        calories_burned: 300,
        intensity: 'moderate',
        recorded_at: '2025-01-01T00:00:00Z',
        icon: '🏃',
      };

      const mockInsertedRecord = {
        id: '1',
        user_id: mockUserId,
        record_type: 'exercise',
        value: 300,
        unit: 'kcal',
        exercise_data: {
          name: '跑步',
          exercise_type: 'other',
          duration: 30,
          calories_burned: 300,
          intensity: 'moderate',
          icon: '🏃',
          source: 'manual',
        },
        notes: JSON.stringify({ icon: '🏃', originalId: undefined }),
        recorded_at: '2025-01-01T00:00:00Z',
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockInsertedRecord,
              error: null,
            }),
          }),
        }),
      });

      const result = await exerciseService.addExercise(mockExercise);

      expect(result.exercise_name).toBe('跑步');
      expect(result.duration).toBe(30);
      expect(result.calories_burned).toBe(300);
    });

    it('should throw error when user is not authenticated', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
      });

      const mockExercise: ExerciseRecord = {
        exercise_name: '跑步',
        duration: 30,
        calories_burned: 300,
        recorded_at: '2025-01-01T00:00:00Z',
      };

      await expect(
        exerciseService.addExercise(mockExercise)
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('getExercisesByDateRange', () => {
    it('should fetch exercises for a date range', async () => {
      const mockExercises = [
        {
          id: '1',
          user_id: mockUserId,
          record_type: 'exercise',
          value: 300,
          unit: 'kcal',
          exercise_data: {
            name: '跑步',
            duration: 30,
            calories_burned: 300,
            intensity: 'moderate',
            source: 'manual',
          },
          notes: JSON.stringify({ icon: '🏃', originalId: '' }),
          recorded_at: '2025-01-01T00:00:00Z',
        },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockExercises,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await exerciseService.getExercisesByDateRange(
        '2025-01-01',
        '2025-01-31'
      );

      expect(result).toHaveLength(1);
      expect(result[0].exercise_name).toBe('跑步');
    });
  });

  describe('deleteExercise', () => {
    it('should delete an exercise record', async () => {
      const exerciseId = 'exercise-1';

      (supabase.from as any).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: null,
              }),
            }),
          }),
        }),
      });

      await expect(
        exerciseService.deleteExercise(exerciseId)
      ).resolves.not.toThrow();
    });
  });
});
