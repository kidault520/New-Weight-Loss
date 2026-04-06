 
import React from 'react';
import { Sparkles } from 'lucide-react';

export type RecordSource = 'manual' | 'ai' | 'device' | 'onboarding' | 'guide';

interface RecordSourceTagProps {
  source: RecordSource;
  deviceName?: string;
  className?: string;
}

/**
 * 通用数据来源标签组件
 * 支持：手动记录、AI记录、设备记录、引导记录
 */
export const RecordSourceTag: React.FC<RecordSourceTagProps> = ({ 
  source, 
  deviceName,
  className = ''
}) => {
  const getTagConfig = () => {
    switch (source) {
      case 'manual':
        return {
          text: '手动记录',
          bg: 'bg-blue-100',
          textColor: 'text-blue-700',
          icon: null
        };
      case 'ai':
        return {
          text: 'AI记录',
          bg: 'bg-purple-100',
          textColor: 'text-purple-700',
          icon: null
        };
      case 'device':
        return {
          text: deviceName ? `${deviceName}记录` : '设备记录',
          bg: 'bg-green-100',
          textColor: 'text-green-700',
          icon: null
        };
      case 'onboarding':
      case 'guide':
        return {
          text: '引导记录',
          bg: 'bg-emerald-100',
          textColor: 'text-emerald-700',
          icon: <Sparkles className="w-3 h-3" />
        };
      default:
        return {
          text: '未知来源',
          bg: 'bg-gray-100',
          textColor: 'text-gray-700',
          icon: null
        };
    }
  };

  const config = getTagConfig();

  // 如果 className 中包含 'relative' 或 'inline'，则不使用绝对定位
  const isAbsolute = !className.includes('relative') && !className.includes('inline');
  const positionClass = isAbsolute ? 'absolute top-2 right-2' : '';
  
  return (
    <div className={`${positionClass} flex items-center space-x-1 ${config.bg} ${config.textColor} px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};

/**
 * 从记录的notes字段中提取数据来源
 * @param notes 记录的notes字段
 * @param defaultToManual 如果notes为空，是否默认返回'manual'（用于体重等手动录入的记录）
 * @returns RecordSource | null
 */
export function extractRecordSource(notes?: string, defaultToManual: boolean = false): RecordSource | null {
  // 如果notes为空且defaultToManual为true，默认返回'manual'
  if (!notes) {
    return defaultToManual ? 'manual' : null;
  }
  
  if (notes.includes('初始体重记录') || notes.includes('引导流程') || notes.includes('引导记录')) {
    return 'guide';
  }
  if (notes.includes('手动记录') || notes.includes('手动')) {
    return 'manual';
  }
  if (notes.includes('AI记录') || notes.includes('AI创建') || notes.includes('AI')) {
    return 'ai';
  }
  // 设备记录通常会有设备名称，如"Apple Watch记录"、"小米手环记录"等
  if (notes.includes('记录') && !notes.includes('手动') && !notes.includes('AI') && !notes.includes('引导')) {
    // 尝试提取设备名称
    const deviceMatch = notes.match(/(.+?)记录/);
    if (deviceMatch && deviceMatch[1]) {
      return 'device';
    }
  }
  
  // 如果notes不为空但没有匹配到任何来源，且defaultToManual为true，默认返回'manual'
  return defaultToManual ? 'manual' : null;
}

/**
 * 从记录的notes字段中提取设备名称
 * @param notes 记录的notes字段
 * @returns 设备名称或null
 */
export function extractDeviceName(notes?: string): string | null {
  if (!notes) return null;
  
  // 匹配"XX设备记录"或"XX记录"格式
  const deviceMatch = notes.match(/(.+?)(?:设备)?记录/);
  if (deviceMatch && deviceMatch[1] && 
      !deviceMatch[1].includes('手动') && 
      !deviceMatch[1].includes('AI') && 
      !deviceMatch[1].includes('引导')) {
    return deviceMatch[1].trim();
  }
  
  return null;
}

