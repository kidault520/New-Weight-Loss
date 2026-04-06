/**
 * StatisticsCards - 统计卡片组件
 * 多个DetailScreen组件共用的统计卡片展示
 * 符合架构规范：单一职责，代码复用
 * 性能优化：使用React.memo避免不必要的重渲染
 */

import React from 'react';
import { Info } from 'lucide-react';
import { SectionCard } from './SectionCard';

interface StatisticsCardsProps {
  stats: {
    highest: number;
    lowest: number;
    average: number;
    fluctuation?: number;
  };
  unit: string;
  labels: {
    highest: string;
    lowest: string;
    average: string;
    fluctuation?: string;
  };
  showFluctuation?: boolean;
  formatValue?: (value: number) => string;
}

const StatisticsCardsComponent: React.FC<StatisticsCardsProps> = ({
  stats,
  unit,
  labels,
  showFluctuation = false,
  formatValue = (value) => value.toFixed(1),
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <SectionCard className="my-1">
        <div className="text-sm text-gray-600 mb-2">{labels.highest}</div>
        <div className="text-2xl font-bold text-gray-800 mb-1">
          {stats.highest > 0 ? formatValue(stats.highest) : '--'}
        </div>
        <div className="text-sm text-gray-500">{unit}</div>
      </SectionCard>

      <SectionCard className="my-1">
        <div className="text-sm text-gray-600 mb-2">{labels.lowest}</div>
        <div className="text-2xl font-bold text-gray-800 mb-1">
          {stats.lowest > 0 ? formatValue(stats.lowest) : '--'}
        </div>
        <div className="text-sm text-gray-500">{unit}</div>
      </SectionCard>

      {showFluctuation && stats.fluctuation !== undefined && (
        <SectionCard className="my-1">
          <div className="flex items-center space-x-1 mb-2">
            <span className="text-sm text-gray-600">{labels.fluctuation || '波动'}</span>
            <Info className="w-3 h-3 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-800 mb-1">
            {stats.fluctuation > 0 ? formatValue(stats.fluctuation) : '--'}
          </div>
          <div className="text-sm text-gray-500">{unit}</div>
        </SectionCard>
      )}

      <SectionCard className="my-1">
        <div className="text-sm text-gray-600 mb-2">{labels.average}</div>
        <div className="text-2xl font-bold text-gray-800 mb-1">
          {stats.average > 0 ? formatValue(stats.average) : '--'}
        </div>
        <div className="text-sm text-gray-500">{unit}</div>
      </SectionCard>
    </div>
  );
};

export const StatisticsCards = React.memo(StatisticsCardsComponent);


