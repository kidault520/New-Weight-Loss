/**
 * WeightTargetCard - 体重目标卡片组件
 * 从WeightDetailScreen.tsx中提取的目标体重展示
 * 符合架构规范：单一职责，代码复用
 * 性能优化：使用React.memo避免不必要的重渲染
 */

import React from 'react';
import { Target } from 'lucide-react';
import { SectionCard } from './SectionCard';

interface WeightTargetCardProps {
  latestWeight: number | null;
  initialWeight: number;
  targetWeight: number;
}

const WeightTargetCardComponent: React.FC<WeightTargetCardProps> = ({
  latestWeight,
  initialWeight,
  targetWeight,
}) => {
  return (
    <SectionCard>
      <div className="flex items-center space-x-2 mb-4">
        <Target className="w-5 h-5 text-gray-400" />
        <span className="text-lg font-medium text-gray-700">当前体重</span>
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-gray-800">
          {latestWeight ? `${latestWeight.toFixed(1)}kg` : '--'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-1">初始体重</div>
          <div className="text-xl font-bold text-gray-800">
            {initialWeight > 0 ? `${initialWeight.toFixed(1)}kg` : '--'}
          </div>
        </div>
        <div className="text-center border-l border-gray-200 pl-6">
          <div className="text-sm text-gray-500 mb-1">目标体重</div>
          <div className="text-xl font-bold text-gray-800">
            {targetWeight > 0 ? `${targetWeight.toFixed(1)}kg` : '--'}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

export const WeightTargetCard = React.memo(WeightTargetCardComponent);

