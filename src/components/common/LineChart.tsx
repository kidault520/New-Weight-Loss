/**
 * LineChart - 折线图组件
 * 多个DetailScreen组件共用的折线图渲染
 * 符合架构规范：单一职责，代码复用
 * 性能优化：使用React.memo避免不必要的重渲染
 */

import React, { useCallback } from 'react';
import { ChartTooltip } from './ChartTooltip';

interface ChartDataPoint {
  value: number;
  label?: string;
  date?: string;
  time?: string;
  recorded_at?: string;
}

interface SelectedDataPoint {
  index: number;
  x: number;
  y: number;
}

interface LineChartProps {
  data: ChartDataPoint[];
  selectedDataPoint: SelectedDataPoint | null;
  onDataPointSelect?: (x: number, y: number, rect: DOMRect) => void;
  onDataPointDeselect?: () => void;
  onDataPointSelectInternal?: (index: number, x: number, y: number) => void;
  unit: string;
  minValue?: number;
  maxValue?: number;
  height?: number;
  strokeColor?: string;
  pointColor?: string;
  selectedPointColor?: string;
  showNormalRange?: boolean;
  normalRangeTop?: string;
  normalRangeHeight?: string;
  normalRangeColor?: string; // 支持 Tailwind 类名或十六进制颜色值
  formatValue?: (value: number) => string;
  formatTime?: (time: string) => string;
  emptyStateMessage?: string;
}

const LineChartComponent: React.FC<LineChartProps> = ({
  data,
  selectedDataPoint,
  onDataPointSelect,
  onDataPointDeselect,
  onDataPointSelectInternal,
  unit,
  minValue,
  maxValue,
  height = 200,
  strokeColor = '#3b82f6',
  pointColor = '#3b82f6',
  selectedPointColor = '#3b82f6', // 改为蓝色，与普通点颜色一致，避免红点
  showNormalRange = false,
  normalRangeTop = '25%',
  normalRangeHeight = '40%',
  normalRangeColor = '#fef3c7', // bg-yellow-100 的十六进制颜色
  formatValue,
  formatTime,
  emptyStateMessage = '暂无数据',
}) => {
  // 计算实际的最小值和最大值（基于所有数据点，包括0值）
  // 这样Y坐标计算才能正确对应实际值
  const allValues = data.map(d => d.value);
  const actualMinValue = minValue ?? (allValues.length > 0 ? Math.min(...allValues) : 0);
  const actualMaxValue = maxValue ?? (allValues.length > 0 ? Math.max(...allValues, actualMinValue + 1) : 1);
  const valueRange = actualMaxValue - actualMinValue || 1;

  // 过滤有效数据点
  const validDataPoints = data.filter(item => item.value > 0);
  const shouldShowLine = validDataPoints.length > 1;
  const hasValidData = validDataPoints.length > 0;

  // 计算SVG宽度
  const svgWidth = Math.max(200, data.length * 20);

  // 处理数据点选择（内部逻辑）
  const handleDataPointSelectInternal = useCallback((x: number, _y: number, rect: DOMRect) => {
    if (data.length === 0 || !onDataPointSelectInternal) return;
    
    const pointWidth = data.length > 1 ? (svgWidth - 40) / (data.length - 1) : svgWidth - 40;
    const clickedIndex = data.length > 1 
      ? Math.round((x / rect.width) * (svgWidth - 40) / pointWidth)
      : 0;
    
    if (clickedIndex >= 0 && clickedIndex < data.length && data[clickedIndex].value > 0) {
      const pointX = data.length > 1 
        ? (clickedIndex / (data.length - 1)) * (svgWidth - 40) + 20
        : svgWidth / 2;
      const pointY = height - ((data[clickedIndex].value - actualMinValue) / valueRange) * (height - 20);
      onDataPointSelectInternal(clickedIndex, (pointX / svgWidth) * rect.width, (pointY / height) * rect.height);
    }
  }, [data, svgWidth, height, actualMinValue, valueRange, onDataPointSelectInternal]);

  // 处理触摸事件
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    if (onDataPointSelectInternal) {
      handleDataPointSelectInternal(x, y, rect);
    } else if (onDataPointSelect) {
      onDataPointSelect(x, y, rect);
    }
  }, [onDataPointSelect, onDataPointSelectInternal, handleDataPointSelectInternal]);

  // 处理鼠标事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (onDataPointSelectInternal) {
      handleDataPointSelectInternal(x, y, rect);
    } else if (onDataPointSelect) {
      onDataPointSelect(x, y, rect);
    }
  }, [onDataPointSelect, onDataPointSelectInternal, handleDataPointSelectInternal]);

  // 处理点击事件（取消选择）
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onDataPointDeselect) {
      onDataPointDeselect();
    }
  }, [onDataPointDeselect]);

  // 计算折线点（只包含有效数据点，value > 0）
  const points = data
    .map((item, index) => {
      // 跳过无效数据点，但保留索引用于X坐标计算
      if (item.value <= 0) return null;
      const x = data.length > 1 
        ? (index / (data.length - 1)) * (svgWidth - 40) + 20
        : svgWidth / 2;
      const y = height - ((item.value - actualMinValue) / valueRange) * (height - 20);
      return `${x},${y}`;
    })
    .filter((point): point is string => point !== null)
    .join(' ');

  if (data.length === 0 || !hasValidData) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {emptyStateMessage}
      </div>
    );
  }

  const selectedData = selectedDataPoint && data[selectedDataPoint.index] 
    ? data[selectedDataPoint.index] 
    : null;

  return (
    <div 
      className="absolute inset-0"
      onTouchStart={handleTouchStart}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox={`0 0 ${svgWidth} ${height}`} 
        preserveAspectRatio="none"
      >
        {/* Normal range background */}
        {showNormalRange && (() => {
          // 将 Tailwind 类名转换为实际颜色值
          const getColorValue = (color: string): string => {
            const colorMap: Record<string, string> = {
              'bg-yellow-100': '#fef3c7',
              'bg-blue-100': '#dbeafe',
              'bg-green-100': '#dcfce7',
              'bg-orange-100': '#ffedd5',
              'bg-indigo-100': '#e0e7ff',
              'bg-red-100': '#fee2e2',
            };
            return colorMap[color] || color.startsWith('#') ? color : '#fef3c7';
          };
          
          return (
            <rect
              x="0"
              y={height * parseFloat(normalRangeTop) / 100}
              width={svgWidth}
              height={height * parseFloat(normalRangeHeight) / 100}
              fill={getColorValue(normalRangeColor)}
              opacity="0.3"
            />
          );
        })()}

        {/* Line */}
        {shouldShowLine && (
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            points={points}
          />
        )}

        {/* Data points */}
        {data.map((item, index) => {
          if (item.value <= 0) return null;
          const x = data.length > 1 
            ? (index / (data.length - 1)) * (svgWidth - 40) + 20
            : svgWidth / 2;
          const y = height - ((item.value - actualMinValue) / valueRange) * (height - 20);
          return (
            <circle 
              key={index} 
              cx={x} 
              cy={y} 
              r="4" 
              fill={pointColor}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Selected data point highlight */}
        {selectedDataPoint && data[selectedDataPoint.index] && (
          <circle 
            cx={data.length > 1
              ? (selectedDataPoint.index / (data.length - 1)) * (svgWidth - 40) + 20
              : svgWidth / 2}
            cy={height - ((data[selectedDataPoint.index].value - actualMinValue) / valueRange) * (height - 20)}
            r="6" 
            fill={selectedPointColor}
            stroke="#fff"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Tooltip */}
      <ChartTooltip
        selectedDataPoint={selectedDataPoint}
        dataPoint={selectedData}
        unit={unit}
        formatValue={formatValue}
        formatTime={formatTime}
        onAutoDeselect={onDataPointDeselect}
      />
    </div>
  );
};

export const LineChart = React.memo(LineChartComponent);

