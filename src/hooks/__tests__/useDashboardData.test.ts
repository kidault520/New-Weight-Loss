 
/**
 * useDashboardData Hook 测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardData } from '../useDashboardData';
import { toLocalDateString } from '../../utils/dateUtils';
import { dashboardDataService } from '../../services/dashboardDataService';
import { generateMockData } from '../../utils/mockData';

// Mock dependencies
vi.mock('../../services/dashboardDataService');
vi.mock('../../utils/mockData', () => ({
  generateMockData: vi.fn(),
}));

describe('useDashboardData', () => {
  const mockUserId = 'test-user-id';
  let queryClient: QueryClient;
  const mockProfile = {
    target_weight: 65,
    current_weight: 70,
  } as any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should return mock data when userId is null', async () => {
    const mockData = {
      date: new Date(),
      weight: { current: 70, target: 65 },
      water: { current: 1500, target: 2000 },
      steps: { current: 5000, target: 10000 },
      calories: { total: 2000, foodIntake: 1500, exerciseBurned: 300, remaining: 800 },
      nutrition: {
        carbs: { current: 150, target: 200 },
        protein: { current: 100, target: 120 },
        fat: { current: 50, target: 60 },
      },
      exercise: { minutes: 30, calories: 200 },
      records: [],
    } as any;

    (generateMockData as any).mockReturnValue(mockData);

    const { result } = renderHook(() =>
      useDashboardData({
        userId: null,
        selectedDate: new Date(),
        profile: null,
        showOnboarding: false,
      }),
      { wrapper },
    );

    await waitFor(() => {
      const data = result.current.getCurrentDateData();
      expect(data).toBeDefined();
    });

    expect(generateMockData).toHaveBeenCalled();
  });

  it('should load data from service when userId is provided', async () => {
    const mockData = {
      date: new Date(),
      weight: { current: 70, target: 65 },
      water: { current: 1500, target: 2000 },
      steps: { current: 5000, target: 10000 },
      calories: { total: 2000, foodIntake: 1500, exerciseBurned: 300, remaining: 800 },
      nutrition: {
        carbs: { current: 150, target: 200 },
        protein: { current: 100, target: 120 },
        fat: { current: 50, target: 60 },
      },
      exercise: { minutes: 30, calories: 200 },
      records: [],
    } as any;

    (dashboardDataService.getDayData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useDashboardData({
        userId: mockUserId,
        selectedDate: new Date(),
        profile: mockProfile,
        showOnboarding: false,
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.realTimeData).toBeDefined();
    });

    expect(dashboardDataService.getDayData).toHaveBeenCalled();
  });

  it('should update data when selectedDate changes', async () => {
    const mockData1 = {
      date: new Date(2025, 0, 1),
      weight: { current: 70, target: 65 },
      water: { current: 1500, target: 2000 },
      steps: { current: 5000, target: 10000 },
      calories: { total: 2000, foodIntake: 1500, exerciseBurned: 300, remaining: 800 },
      nutrition: {
        carbs: { current: 150, target: 200 },
        protein: { current: 100, target: 120 },
        fat: { current: 50, target: 60 },
      },
      exercise: { minutes: 30, calories: 200 },
      records: [],
    } as any;
    const mockData2 = {
      date: new Date(2025, 0, 2),
      weight: { current: 70, target: 65 },
      water: { current: 1500, target: 2000 },
      steps: { current: 5000, target: 10000 },
      calories: { total: 2000, foodIntake: 1500, exerciseBurned: 300, remaining: 800 },
      nutrition: {
        carbs: { current: 150, target: 200 },
        protein: { current: 100, target: 120 },
        fat: { current: 50, target: 60 },
      },
      exercise: { minutes: 30, calories: 200 },
      records: [],
    } as any;

    (dashboardDataService.getDayData as any)
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2);

    const { result, rerender } = renderHook(
      ({ selectedDate }) =>
        useDashboardData({
          userId: mockUserId,
          selectedDate,
          profile: mockProfile,
          showOnboarding: false,
        }),
      {
        initialProps: { selectedDate: new Date(2025, 0, 1) },
        wrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.realTimeData).toBeDefined();
    });

    rerender({ selectedDate: new Date(2025, 0, 2) });

    await waitFor(() => {
      expect(dashboardDataService.getDayData).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle userDayDataOverrides', async () => {
    const mockData = {
      date: new Date(),
      weight: { current: 70, target: 65 },
      water: { current: 1500, target: 2000 },
      steps: { current: 5000, target: 10000 },
      calories: { total: 2000, foodIntake: 1500, exerciseBurned: 300, remaining: 800 },
      nutrition: {
        carbs: { current: 150, target: 200 },
        protein: { current: 100, target: 120 },
        fat: { current: 50, target: 60 },
      },
      exercise: { minutes: 30, calories: 200 },
      records: [],
    } as any;

    (generateMockData as any).mockReturnValue(mockData);

    const { result } = renderHook(() =>
      useDashboardData({
        userId: null,
        selectedDate: new Date(),
        profile: null,
        showOnboarding: false,
      }),
      { wrapper },
    );

    const dateKey = toLocalDateString(new Date());
    act(() => {
      result.current.updateDayData(new Date(), {
        weight: { current: 75, target: 65, hasRecord: true },
      });
    });

    await waitFor(() => {
      expect(result.current.userDayDataOverrides[dateKey]).toBeDefined();
    });
  });
});

