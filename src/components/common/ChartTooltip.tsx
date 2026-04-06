/**
 * ChartTooltip - 图表数据点提示框组件
 * 多个DetailScreen组件共用的图表tooltip
 * 符合架构规范：单一职责，代码复用
 * 性能优化：使用React.memo避免不必要的重渲染
 */
 

import React, { useEffect } from 'react';

interface ChartTooltipProps {
  selectedDataPoint: {
    index: number;
    x: number;
    y: number;
  } | null;
  dataPoint: {
    label?: string;
    date?: string;
    time?: string;
    value: number;
    recorded_at?: string;
  } | null;
  unit: string;
  formatValue?: (value: number) => string;
  formatTime?: (time: string) => string;
  onAutoDeselect?: () => void;
}

const ChartTooltipComponent: React.FC<ChartTooltipProps> = ({
  selectedDataPoint,
  dataPoint,
  unit,
  formatValue = (value) => value.toFixed(1),
  formatTime,
  onAutoDeselect,
}) => {
  // 3秒后自动清除 tooltip
  useEffect(() => {
    if (selectedDataPoint && onAutoDeselect) {
      const timer = setTimeout(() => {
        onAutoDeselect();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedDataPoint, onAutoDeselect]);

  if (!selectedDataPoint || !dataPoint) {
    return null;
  }

  // 判断是否是时间格式（天视图）
  const isTimeFormat = (str: string | undefined): boolean => {
    if (!str) return false;
    return str.includes(':') && /^\d{1,2}:\d{2}$/.test(str);
  };

  // 格式化日期显示（非天视图显示日期，格式：X月X日）
  const formatDateDisplay = () => {
    // 如果 time 是时间格式（天视图），不显示日期，只显示时间
    if (isTimeFormat(dataPoint.time)) {
      return null;
    }
    
    // 优先从 recorded_at 提取日期，格式化为 "X月X日"
    if (dataPoint.recorded_at) {
      try {
        const date = new Date(dataPoint.recorded_at);
        if (!isNaN(date.getTime())) {
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return `${month}月${day}日`;
        }
      } catch (e) {
        // 忽略错误
      }
    }
    
    // 如果 label 是月份格式（如 "12月"），直接返回
    if (dataPoint.label && dataPoint.label.includes('月') && !dataPoint.label.includes('日')) {
      // 如果只有月份，尝试从 recorded_at 补充日期
      if (dataPoint.recorded_at) {
        try {
          const date = new Date(dataPoint.recorded_at);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${month}月${day}日`;
          }
        } catch (e) {
          // 忽略错误
        }
      }
      return dataPoint.label;
    }
    
    // 如果 date 字段存在，尝试解析并格式化
    if (dataPoint.date) {
      // 如果已经是 "X月X日" 格式，直接返回
      if (dataPoint.date.includes('月') && dataPoint.date.includes('日')) {
        return dataPoint.date;
      }
      // 如果是 "MM/DD" 格式，转换为 "X月X日"
      if (dataPoint.date.includes('/')) {
        const parts = dataPoint.date.split('/');
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const day = parseInt(parts[1], 10);
          if (!isNaN(month) && !isNaN(day)) {
            return `${month}月${day}日`;
          }
        }
      }
      // 如果 recorded_at 存在，优先使用它
      if (dataPoint.recorded_at) {
        try {
          const date = new Date(dataPoint.recorded_at);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${month}月${day}日`;
          }
        } catch (e) {
          // 忽略错误
        }
      }
      return dataPoint.date;
    }
    
    // 最后尝试从 label 解析
    if (dataPoint.label) {
      // 如果 label 是数字（可能是日期），尝试从 recorded_at 获取
      if (dataPoint.recorded_at) {
        try {
          const date = new Date(dataPoint.recorded_at);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${month}月${day}日`;
          }
        } catch (e) {
          // 忽略错误
        }
      }
      return dataPoint.label;
    }
    
    return null;
  };

  // 格式化时间显示（只在天视图显示时间）
  const formatTimeDisplay = () => {
    // 只在 time 是时间格式时显示（天视图）
    if (dataPoint.time && isTimeFormat(dataPoint.time)) {
      // 如果 time 已经是时间格式（HH:mm），直接使用，不需要再次格式化
      // 只有当 recorded_at 存在且 formatTime 可用时，才尝试格式化 recorded_at
      if (dataPoint.recorded_at && formatTime) {
        try {
          return formatTime(dataPoint.recorded_at);
        } catch (e) {
          // 如果格式化失败，使用原始的 time
          return dataPoint.time;
        }
      }
      return dataPoint.time;
    }
    // 非天视图不显示时间
    return null;
  };

  const dateDisplay = formatDateDisplay();
  const timeDisplay = formatTimeDisplay();

  // 格式化值显示，检查是否已包含单位
  const formattedValue = formatValue(dataPoint.value);
  // 检查 formattedValue 是否已包含单位（去除空格后检查）
  const formattedValueTrimmed = formattedValue.replace(/\s+/g, '');
  const unitTrimmed = unit.replace(/\s+/g, '');
  const valueAlreadyHasUnit = formattedValueTrimmed.toLowerCase().endsWith(unitTrimmed.toLowerCase());
  const displayValue = valueAlreadyHasUnit ? formattedValue : `${formattedValue} ${unit}`;

  return (
    <div 
      className="absolute text-xs px-2 py-1 rounded shadow-lg z-10 pointer-events-none"
      style={{
        backgroundColor: '#fef3c7', // 浅黄色背景
        color: '#78350f', // 深棕色文字，确保在浅黄色背景上可读
        left: `${selectedDataPoint.x}px`,
        top: `${selectedDataPoint.y - 30}px`,
        transform: 'translateX(-50%)'
      }}
    >
      {dateDisplay && <div className="font-medium">{dateDisplay}</div>}
      {timeDisplay && (
        <div className="text-gray-700 text-xs">{timeDisplay}</div>
      )}
      <div className="font-bold">{displayValue}</div>
    </div>
  );
};

export const ChartTooltip = React.memo(ChartTooltipComponent);


