/**
 * HealthRadarChart - 健康雷达图组件
 * 从HealthReportPage.tsx中提取的雷达图渲染逻辑
 * 性能优化：使用React.memo避免不必要的重渲染
 */

import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface HealthRadarChartProps {
  data: Array<{
    dimension: string;
    score: number;
    fullMark: number;
  }>;
}

const HealthRadarChartComponent: React.FC<HealthRadarChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" strokeWidth={1} />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: '#1f2937', fontSize: 14, fontWeight: 500 }}
        />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#fbbf24"
          fill="#fde047"
          fillOpacity={0.7}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export const HealthRadarChart = React.memo(HealthRadarChartComponent);

