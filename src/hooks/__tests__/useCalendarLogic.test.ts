/**
 * useCalendarLogic Hook 测试
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarLogic } from '../useCalendarLogic';

describe('useCalendarLogic', () => {
  describe('formatDate', () => {
    it('should return M/D for today', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const today = new Date();
      expect(result.current.formatDate(today)).toBe(`${today.getMonth() + 1}/${today.getDate()}`);
    });

    it('should return M/D for yesterday', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(result.current.formatDate(yesterday)).toBe(`${yesterday.getMonth() + 1}/${yesterday.getDate()}`);
    });

    it('should return M/D for tomorrow', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(result.current.formatDate(tomorrow)).toBe(`${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`);
    });

    it('should return M/D for dates within 7 days', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      expect(result.current.formatDate(threeDaysLater)).toBe(
        `${threeDaysLater.getMonth() + 1}/${threeDaysLater.getDate()}`
      );
    });

    it('should return M/D for dates beyond 7 days', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const futureDate = new Date(2025, 5, 15); // June 15, 2025
      const formatted = result.current.formatDate(futureDate);
      expect(formatted).toBe('6/15');
    });
  });

  describe('generateCalendarDays', () => {
    it('should generate 42 days (6 weeks)', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date(2025, 0, 15))); // January 2025
      const days = result.current.generateCalendarDays();
      expect(days).toHaveLength(42);
    });

    it('should include days from previous month', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date(2025, 0, 15))); // January 2025
      const days = result.current.generateCalendarDays();
      // January 1, 2025 is a Wednesday, so we should have days from December
      const firstDay = days[0];
      expect(firstDay.getMonth()).toBe(11); // December (0-indexed)
    });

    it('should include days from next month', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date(2025, 0, 15))); // January 2025
      const days = result.current.generateCalendarDays();
      const lastDay = days[41];
      expect(lastDay.getMonth()).toBe(1); // February (0-indexed)
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const today = new Date();
      expect(result.current.isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(result.current.isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date()));
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(result.current.isToday(tomorrow)).toBe(false);
    });
  });

  describe('isSameMonth', () => {
    it('should return true for dates in the same month', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date(2025, 0, 15))); // January 2025
      const sameMonth = new Date(2025, 0, 20);
      expect(result.current.isSameMonth(sameMonth)).toBe(true);
    });

    it('should return false for dates in different months', () => {
      const { result } = renderHook(() => useCalendarLogic(new Date(2025, 0, 15))); // January 2025
      const differentMonth = new Date(2025, 1, 15); // February 2025
      expect(result.current.isSameMonth(differentMonth)).toBe(false);
    });

    it('should use selectedDate as reference when no date provided', () => {
      const selectedDate = new Date(2025, 0, 15);
      const { result } = renderHook(() => useCalendarLogic(selectedDate));
      const sameMonth = new Date(2025, 0, 20);
      expect(result.current.isSameMonth(sameMonth)).toBe(true);
    });
  });
});




