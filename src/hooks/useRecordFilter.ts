 
import { useMemo } from 'react';
import { isSameDay, isSameWeek, formatDateChinese } from '../utils/dateUtils';

/**
 * 通用记录过滤hook
 * 根据selectedPeriod过滤记录：
 * - 天：只显示当天的记录
 * - 周：只显示当周的记录
 * - 月/年：返回空对象（不显示记录）
 * 
 * @param records 记录数组，必须包含recorded_at字段
 * @param selectedPeriod 选中的时间段
 * @param selectedDate 选中的日期
 * @param getRecordsByDate 可选：用于获取特定日期的记录的函数（如果记录需要额外处理）
 * @returns 按日期分组的记录对象 { [date: string]: T[] }
 */
export function useRecordFilter<T extends { recorded_at: string }>(
  records: T[],
  selectedPeriod: '天' | '周' | '月' | '年',
  selectedDate: Date,
  _getRecordsByDate?: (date: Date) => T[]
): { [key: string]: T[] } {
  void _getRecordsByDate;
  return useMemo(() => {
    console.log('🔍 [useRecordFilter] Starting filter:', {
      recordsCount: records.length,
      selectedPeriod,
      selectedDate: selectedDate.toISOString(),
      selectedDateLocal: selectedDate.toLocaleString('zh-CN')
    });
    
    // 月/年不显示记录
    if (selectedPeriod === '月' || selectedPeriod === '年') {
      console.log('⚠️ [useRecordFilter] Period is 月 or 年, returning empty');
      return {};
    }
    
    const groups: { [key: string]: T[] } = {};
    
    if (selectedPeriod === '天') {
      // 只显示当天的记录 - 统一使用isSameDay确保时区一致性
      const dayRecords = records.filter(record => {
        const isSame = isSameDay(record.recorded_at, selectedDate);
        if (records.length <= 5) {
          console.log('🔍 [useRecordFilter] Day check:', {
            recordDate: record.recorded_at,
            recordDateLocal: new Date(record.recorded_at).toLocaleString('zh-CN'),
            selectedDate: selectedDate.toISOString(),
            isSameDay: isSame
          });
        }
        return isSame;
      });
      
      console.log('📊 [useRecordFilter] Day records filtered:', dayRecords.length, 'out of', records.length);
      
      if (dayRecords.length > 0) {
        const dateStr = formatDateChinese(selectedDate);
        groups[dateStr] = dayRecords;
      }
    } else if (selectedPeriod === '周') {
      // 只显示当周的记录 - 统一使用isSameWeek确保时区一致性
      console.log('🔍 [useRecordFilter] Filtering week records...');
      const weekRecords = records.filter((record, index) => {
        const isSame = isSameWeek(record.recorded_at, selectedDate);
        // 输出前3条记录的详细匹配信息，帮助调试
        if (index < 3) {
          console.log('🔍 [useRecordFilter] Week check:', {
            index,
            recordDate: record.recorded_at,
            recordDateLocal: new Date(record.recorded_at).toLocaleString('zh-CN'),
            selectedDate: selectedDate.toISOString(),
            selectedDateLocal: selectedDate.toLocaleString('zh-CN'),
            isSameWeek: isSame
          });
        }
        return isSame;
      });
      
      console.log('📊 [useRecordFilter] Week records filtered:', weekRecords.length, 'out of', records.length);
      
      // 按日期分组
      weekRecords.forEach(record => {
        const dateStr = formatDateChinese(record.recorded_at);
        if (!groups[dateStr]) {
          groups[dateStr] = [];
        }
        groups[dateStr].push(record);
      });
    }
    
    console.log('✅ [useRecordFilter] Final groups:', {
      groupCount: Object.keys(groups).length,
      groups: Object.keys(groups),
      totalRecords: Object.values(groups).flat().length
    });
    
    // 按日期倒序排列
    return Object.fromEntries(
      Object.entries(groups).sort((a, b) => {
        const dateA = new Date(a[0].replace(/\//g, '-'));
        const dateB = new Date(b[0].replace(/\//g, '-'));
        return dateB.getTime() - dateA.getTime();
      })
    );
  }, [records, selectedPeriod, selectedDate]);
}

