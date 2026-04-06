/**
 * ExerciseStatsCards - 运动统计卡片组件
 * 从ExerciseStatsDetailScreen.tsx中提取的统计卡片展示
 * 符合架构规范：单一职责，代码复用
 * 性能优化：使用React.memo避免不必要的重渲染
 */

import React from 'react';
import { SectionCard } from './SectionCard';

interface ExerciseStatsCardsProps {
  exerciseMinutes: number;
  activityCalories: number;
}

const ExerciseStatsCardsComponent: React.FC<ExerciseStatsCardsProps> = ({
  exerciseMinutes,
  activityCalories,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SectionCard className="my-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">锻炼分钟数</span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-bold text-blue-500">{exerciseMinutes}</span>
          <span className="text-sm text-gray-500">分钟</span>
        </div>
      </SectionCard>

      <SectionCard className="my-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">活动热量</span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-bold text-orange-500">{activityCalories}</span>
          <span className="text-sm text-gray-500">kcal</span>
        </div>
      </SectionCard>
    </div>
  );
};

export const ExerciseStatsCards = React.memo(ExerciseStatsCardsComponent);

