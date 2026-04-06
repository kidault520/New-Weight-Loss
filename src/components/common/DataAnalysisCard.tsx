/**
 * DataAnalysisCard - 数据分析卡片组件
 * 性能优化：使用React.memo避免不必要的重渲染
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { SectionCard } from './SectionCard';

type DataPoint = {
  value: number;
  [key: string]: any;
};

type DataAnalysisCardProps = {
  currentData: DataPoint[];
  previousData?: DataPoint[];
  dataType: 'steps' | 'weight' | 'water' | 'exercise' | 'sleep' | 'bloodGlucose' | 'measurements';
  period: '月' | '年' | '季度' | '周';
  valueKey?: string; // 数据点的值字段名，默认为'value'，也可以是'steps', 'calories', 'amount'等
};

const DataAnalysisCardComponent: React.FC<DataAnalysisCardProps> = ({
  currentData,
  previousData,
  dataType,
  period,
  valueKey
}) => {
  // 设置默认值
  const finalValueKey: string = valueKey ?? 'value';
  // 计算统计指标
  const stats = useMemo(() => {
    const values = currentData
      .map(d => {
        const val = d[finalValueKey] || d.value || d.steps || d.calories || d.amount || 0;
        return typeof val === 'number' ? val : 0;
      })
      .filter(v => v > 0);

    if (values.length === 0) {
      return {
        avg: 0,
        max: 0,
        min: 0,
        hasData: false
      };
    }

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    return {
      avg: avg,
      max: max,
      min: min,
      hasData: true
    };
  }, [currentData, finalValueKey]);

  // 计算上一周期的统计指标
  const previousStats = useMemo(() => {
    if (!previousData || previousData.length === 0) {
      return null;
    }

    const values = previousData
      .map(d => {
        const val = d[finalValueKey] || d.value || d.steps || d.calories || d.amount || 0;
        return typeof val === 'number' ? val : 0;
      })
      .filter(v => v > 0);

    if (values.length === 0) {
      return null;
    }

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return { avg };
  }, [previousData, finalValueKey]);

  // 计算变化百分比
  const changePercent = useMemo(() => {
    if (!previousStats || stats.avg === 0) {
      return null;
    }

    if (previousStats.avg === 0) {
      return stats.avg > 0 ? 100 : null;
    }

    return ((stats.avg - previousStats.avg) / previousStats.avg) * 100;
  }, [stats.avg, previousStats]);

  // 判断趋势
  const trend = useMemo(() => {
    if (changePercent === null) {
      return 'stable';
    }
    if (changePercent > 5) {
      return 'up';
    } else if (changePercent < -5) {
      return 'down';
    } else {
      return 'stable';
    }
  }, [changePercent]);

  // 生成可能的原因说明
  const getReasonExplanation = (): string[] => {
    if (!stats.hasData) {
      return ['数据不足，无法进行分析'];
    }

    const reasons: string[] = [];

    if (changePercent === null) {
      reasons.push('暂无对比数据');
      return reasons;
    }

    switch (dataType) {
      case 'steps':
        if (trend === 'up') {
          reasons.push('运动习惯可能有所改善');
          reasons.push('日常活动量可能增加');
          reasons.push('可能增加了步行或运动时间');
        } else if (trend === 'down') {
          reasons.push('活动量可能减少');
          reasons.push('可能因身体不适或休息日增加');
          reasons.push('日常运动习惯可能有所改变');
        } else {
          reasons.push('步数保持相对稳定');
          reasons.push('运动习惯较为规律');
        }
        break;

      case 'weight':
        if (trend === 'up') {
          reasons.push('饮食摄入可能增加');
          reasons.push('运动量可能减少');
          reasons.push('可能处于增重期或恢复期');
        } else if (trend === 'down') {
          reasons.push('饮食控制可能更严格');
          reasons.push('运动量可能增加');
          reasons.push('可能处于减重期');
        } else {
          reasons.push('体重保持相对稳定');
          reasons.push('饮食和运动可能较为平衡');
        }
        break;

      case 'water':
        if (trend === 'up') {
          reasons.push('饮水量可能增加');
          reasons.push('可能更注重水分补充');
          reasons.push('天气或活动量可能增加');
        } else if (trend === 'down') {
          reasons.push('饮水量可能减少');
          reasons.push('可能忘记及时补充水分');
          reasons.push('活动量可能减少');
        } else {
          reasons.push('饮水量保持相对稳定');
          reasons.push('水分补充习惯较为规律');
        }
        break;

      case 'exercise':
        if (trend === 'up') {
          reasons.push('运动强度或时长可能增加');
          reasons.push('可能增加了新的运动项目');
          reasons.push('运动频率可能提高');
        } else if (trend === 'down') {
          reasons.push('运动量可能减少');
          reasons.push('可能因时间安排或身体原因减少运动');
          reasons.push('运动强度可能降低');
        } else {
          reasons.push('运动量保持相对稳定');
          reasons.push('运动习惯较为规律');
        }
        break;

      case 'sleep':
        if (trend === 'up') {
          reasons.push('睡眠时长可能增加');
          reasons.push('作息可能更加规律');
          reasons.push('睡眠质量可能改善');
        } else if (trend === 'down') {
          reasons.push('睡眠时长可能减少');
          reasons.push('可能因工作压力或作息不规律');
          reasons.push('睡眠质量可能下降');
        } else {
          reasons.push('睡眠时长保持相对稳定');
          reasons.push('作息习惯较为规律');
        }
        break;

      case 'bloodGlucose':
        if (trend === 'up') {
          reasons.push('血糖水平可能上升');
          reasons.push('饮食结构可能发生变化');
          reasons.push('可能需要调整饮食或运动计划');
        } else if (trend === 'down') {
          reasons.push('血糖水平可能下降');
          reasons.push('饮食控制可能更有效');
          reasons.push('运动可能对血糖控制有帮助');
        } else {
          reasons.push('血糖水平保持相对稳定');
          reasons.push('血糖管理较为良好');
        }
        break;

      case 'measurements':
        if (trend === 'up') {
          reasons.push('围度可能有所增加');
          reasons.push('可能处于增肌或增重期');
          reasons.push('运动或饮食可能发生变化');
        } else if (trend === 'down') {
          reasons.push('围度可能有所减少');
          reasons.push('可能处于减脂期');
          reasons.push('运动或饮食控制可能更有效');
        } else {
          reasons.push('围度保持相对稳定');
          reasons.push('身体状态较为稳定');
        }
        break;

      default:
        reasons.push('数据变化需要进一步观察');
    }

    return reasons;
  };

  const reasons = getReasonExplanation();

  // 格式化数值
  const formatValue = (value: number): string => {
    if (dataType === 'weight') {
      return `${value.toFixed(1)}kg`;
    } else if (dataType === 'water') {
      return `${value.toFixed(0)}ml`;
    } else if (dataType === 'exercise') {
      return `${value.toFixed(0)}kcal`;
    } else if (dataType === 'sleep') {
      return `${value.toFixed(1)}h`;
    } else if (dataType === 'bloodGlucose') {
      return `${value.toFixed(1)}mmol/L`;
    } else if (dataType === 'measurements') {
      return `${value.toFixed(1)}cm`;
    } else {
      return `${value.toFixed(0)}`;
    }
  };

  if (!stats.hasData) {
    return null;
  }

  return (
    <SectionCard className="my-1">
      <div className="flex items-center space-x-2 mb-4">
        <BarChart3 className="w-5 h-5 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-700">数据解读</h3>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">平均值</div>
          <div className="text-lg font-bold text-gray-800">{formatValue(stats.avg)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">最高值</div>
          <div className="text-lg font-bold text-gray-800">{formatValue(stats.max)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">最低值</div>
          <div className="text-lg font-bold text-gray-800">{formatValue(stats.min)}</div>
        </div>
      </div>

      {/* 变化趋势 */}
      {changePercent !== null && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {trend === 'up' && <TrendingUp className="w-5 h-5 text-green-500" />}
              {trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
              {trend === 'stable' && <Minus className="w-5 h-5 text-gray-500" />}
              <span className="text-sm text-gray-600">
                较上{period === '季度' ? '季度' : period === '月' ? '月' : period === '周' ? '周' : '年'}
              </span>
            </div>
            <div
              className={`text-lg font-bold ${
                trend === 'up'
                  ? 'text-green-600'
                  : trend === 'down'
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}
            >
              {changePercent > 0 ? '+' : ''}
              {changePercent.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* 可能的原因说明 */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">可能的原因：</div>
        <ul className="space-y-1">
          {reasons.map((reason, index) => (
            <li key={index} className="text-sm text-gray-600 flex items-start">
              <span className="text-gray-400 mr-2">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
};

export const DataAnalysisCard = React.memo(DataAnalysisCardComponent);


















