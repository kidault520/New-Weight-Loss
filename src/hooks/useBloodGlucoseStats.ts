/**
 * useBloodGlucoseStats - 血糖统计计算Hook
 * 从BloodGlucoseDetailScreen.tsx中提取的统计计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { useMemo } from 'react';

interface ChartDataPoint {
  value: number;
}

interface UseBloodGlucoseStatsOptions {
  chartData: ChartDataPoint[];
}

export function useBloodGlucoseStats({ chartData }: UseBloodGlucoseStatsOptions) {
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        highest: 0,
        lowest: 0,
        average: 0,
        fluctuation: 0,
      };
    }

    const values = chartData.map((d) => d.value).filter(v => v > 0);
    
    if (values.length === 0) {
      return {
        highest: 0,
        lowest: 0,
        average: 0,
        fluctuation: 0,
      };
    }

    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    const fluctuation = highest - lowest;

    return {
      highest,
      lowest,
      average,
      fluctuation,
    };
  }, [chartData]);

  return stats;
}




