import { useState, useCallback, useMemo } from 'react';
import { getBeijingTime, formatWeekLabel } from '../utils/dateUtils';

export type PeriodType = '天' | '周' | '月' | '年';

export interface UseDetailScreenOptions {
  initialDate: Date;
  initialPeriod?: PeriodType;
}

export interface UseDetailScreenReturn<TRecord> {
  // 日期和周期状态
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedPeriod: PeriodType;
  setSelectedPeriod: (period: PeriodType) => void;
  
  // 数据点选择
  selectedDataPoint: { index: number; x: number; y: number } | null;
  setSelectedDataPoint: (point: { index: number; x: number; y: number } | null) => void;
  
  // 记录编辑/删除状态
  editingRecord: TRecord | null;
  setEditingRecord: (record: TRecord | null) => void;
  deleteConfirmRecord: TRecord | null;
  setDeleteConfirmRecord: (record: TRecord | null) => void;
  deletingRecordId: string | null;
  setDeletingRecordId: (id: string | null) => void;
  
  // 数据解读显示
  showDataAnalysis: boolean;
  setShowDataAnalysis: (show: boolean) => void;
  
  // 日期格式化
  formatDate: (date: Date) => string;
  
  // 日期导航
  navigateDate: (direction: 'prev' | 'next') => void;
  
  // 周范围计算
  currentWeekRange: { start: Date; end: Date };
  
  // 记录分组（按日期）
  groupRecordsByDate: <T extends { recorded_at: string | Date }>(
    records: T[]
  ) => { [key: string]: T[] };
  
  // 获取本周记录
  getCurrentWeekRecords: <T extends { recorded_at: string | Date }>(
    records: T[]
  ) => T[];
}

/**
 * 统一的DetailScreen Hook
 * 提取所有DetailScreen组件的通用状态管理和工具函数
 */
export function useDetailScreen<TRecord extends { id: string; recorded_at: string | Date }>(
  options: UseDetailScreenOptions
): UseDetailScreenReturn<TRecord> {
  const { initialDate, initialPeriod = '天' } = options;

  // 日期和周期状态
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(initialPeriod);
  
  // 数据点选择
  const [selectedDataPoint, setSelectedDataPoint] = useState<{ index: number; x: number; y: number } | null>(null);
  
  // 记录编辑/删除状态
  const [editingRecord, setEditingRecord] = useState<TRecord | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<TRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  
  // 数据解读显示
  const [showDataAnalysis, setShowDataAnalysis] = useState(false);

  // 日期格式化
  const formatDate = useCallback((date: Date) => {
    const beijingDate = getBeijingTime(date);
    const year = beijingDate.getFullYear();
    const month = String(beijingDate.getMonth() + 1).padStart(2, '0');
    const day = String(beijingDate.getDate()).padStart(2, '0');
    
    switch (selectedPeriod) {
      case '天':
        return `${year}-${month}-${day}`;
      case '周':
        return formatWeekLabel(date);
      case '月':
        return `${year}年${month}月`;
      case '年':
        return `${year}年`;
      default:
        return `${year}-${month}-${day}`;
    }
  }, [selectedPeriod]);

  // 日期导航
  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate);
      
      switch (selectedPeriod) {
        case '天':
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
          break;
        case '周':
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
          break;
        case '月':
          newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
          break;
        case '年':
          newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
          break;
      }
      
      return newDate;
    });
  }, [selectedPeriod]);

  // 计算本周的日期范围
  const currentWeekRange = useMemo(() => {
    const weekStart = new Date(selectedDate);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 周一为开始
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    return { start: weekStart, end: weekEnd };
  }, [selectedDate]);

  // 获取本周的记录
  const getCurrentWeekRecords = useCallback(<T extends { recorded_at: string | Date }>(
    records: T[]
  ): T[] => {
    return records.filter(record => {
      const recordDate = new Date(record.recorded_at);
      return recordDate >= currentWeekRange.start && recordDate <= currentWeekRange.end;
    });
  }, [currentWeekRange]);

  // 按日期分组记录
  const groupRecordsByDate = useCallback(<T extends { recorded_at: string | Date }>(
    records: T[]
  ): { [key: string]: T[] } => {
    const grouped: { [key: string]: T[] } = {};
    records.forEach(record => {
      const recordDate = new Date(record.recorded_at);
      const dateKey = recordDate.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(record);
    });
    
    // 按日期排序，然后每个日期内的记录按时间倒序
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => 
        new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      );
    });
    
    return grouped;
  }, []);

  return {
    selectedDate,
    setSelectedDate,
    selectedPeriod,
    setSelectedPeriod,
    selectedDataPoint,
    setSelectedDataPoint,
    editingRecord,
    setEditingRecord,
    deleteConfirmRecord,
    setDeleteConfirmRecord,
    deletingRecordId,
    setDeletingRecordId,
    showDataAnalysis,
    setShowDataAnalysis,
    formatDate,
    navigateDate,
    currentWeekRange,
    groupRecordsByDate,
    getCurrentWeekRecords,
  };
}

















