/**
 * BMICard - BMI展示卡片组件
 * 从WeightDetailScreen.tsx中提取的BMI展示逻辑
 * 符合架构规范：单一职责，代码复用
 * 性能优化：使用React.memo避免不必要的重渲染
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { SectionCard } from './SectionCard';

interface BMIData {
  bmi: number;
  category: string;
  color: 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';
}

interface BMICardProps {
  bmiData: BMIData;
  hasData: boolean;
}

const BMICardComponent: React.FC<BMICardProps> = ({ bmiData, hasData }) => {
  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#f59e0b',
    orange: '#f97316',
    red: '#ef4444',
    gray: '#6b7280',
  };

  if (!hasData) {
    return (
      <SectionCard>
        <div className="flex items-center space-x-2 mb-6">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <span className="text-lg font-medium text-gray-700">BMI</span>
        </div>
        <div className="text-center py-8">
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e7eb" strokeWidth="4"/>
              <text x="50" y="55" textAnchor="middle" fontSize="24" fill="#d1d5db" fontWeight="bold">BMI</text>
              <path d="M30 65 Q50 75 70 65" stroke="#d1d5db" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-gray-400 text-sm">
            请添加身高和体重数据
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center space-x-2 mb-6">
        <BarChart3 className="w-5 h-5 text-gray-400" />
        <span className="text-lg font-medium text-gray-700">BMI</span>
      </div>

      <div className="flex items-end space-x-2 mb-4">
        <span className="text-4xl font-bold text-gray-800">
          {bmiData.bmi > 0 ? bmiData.bmi.toFixed(1) : '--'}
        </span>
        <span
          className="text-lg font-medium mb-1"
          style={{ color: colorMap[bmiData.color] }}
        >
          {bmiData.category}
        </span>
      </div>

      <div className="relative mb-6">
        <div className="flex h-3 rounded-full overflow-hidden mb-3">
          <div className="flex-1 bg-blue-400"></div>
          <div className="flex-1 bg-green-400"></div>
          <div className="flex-1 bg-yellow-400"></div>
          <div className="flex-1 bg-orange-400"></div>
          <div className="flex-1 bg-red-400"></div>
        </div>

        <div
          className="absolute top-0 transform -translate-x-1/2 -translate-y-1"
          style={{
            left: `${Math.min(Math.max((bmiData.bmi - 12) / (45 - 12) * 100, 0), 100)}%`,
          }}
        >
          <div className="w-0.5 h-5 bg-gray-800"></div>
          <div className="w-3 h-3 bg-gray-800 rounded-full -mt-1 -ml-1.5"></div>
        </div>

        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>12</span>
          <span>18.5</span>
          <span>25</span>
          <span>30</span>
          <span>35</span>
          <span>45</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-xs">
        <div className="text-center">
          <div className="w-3 h-3 bg-blue-400 rounded-full mx-auto mb-1"></div>
          <div className="text-gray-600">偏瘦</div>
          <div className="text-gray-400">&lt;18.5</div>
        </div>
        <div className="text-center">
          <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-1"></div>
          <div className="text-gray-600">正常</div>
          <div className="text-gray-400">18.5-25</div>
        </div>
        <div className="text-center">
          <div className="w-3 h-3 bg-yellow-400 rounded-full mx-auto mb-1"></div>
          <div className="text-gray-600">超重</div>
          <div className="text-gray-400">25-30</div>
        </div>
        <div className="text-center">
          <div className="w-3 h-3 bg-orange-400 rounded-full mx-auto mb-1"></div>
          <div className="text-gray-600">肥胖</div>
          <div className="text-gray-400">30-35</div>
        </div>
        <div className="text-center">
          <div className="w-3 h-3 bg-red-400 rounded-full mx-auto mb-1"></div>
          <div className="text-gray-600">重度</div>
          <div className="text-gray-400">&gt;35</div>
        </div>
      </div>
    </SectionCard>
  );
};

export const BMICard = React.memo(BMICardComponent);

