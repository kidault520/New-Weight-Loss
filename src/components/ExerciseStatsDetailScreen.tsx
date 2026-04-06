 
import React, { useState, useCallback, useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { formatWeekLabel, toLocalDateString } from '../utils/dateUtils';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import { PeriodSelector } from './common/PeriodSelector'
import { DateNavigator } from './common/DateNavigator'
import { DataAnalysisCard } from './common/DataAnalysisCard'
import { ConfirmModal } from './common/ConfirmModal'
import { useAlert } from '../hooks/useAlert'
import { useExerciseRecordsQuery } from '../hooks/useExerciseRecordsQuery'
import type { ExerciseRecord as ServiceExerciseRecord } from '../services/exerciseService'
import { useExerciseChartData } from '../hooks/useExerciseChartData'
import { useExerciseStats } from '../hooks/useExerciseStats'
import { LineChart } from './common/LineChart'
import { ExerciseStatsCards } from './common/ExerciseStatsCards'
import { ExerciseRecordList } from './common/ExerciseRecordList'

interface ExerciseRecord {
  id: string;
  type: 'food' | 'exercise' | 'water';
  name: string;
  calories?: number;
  time: string;
  exercise_data?: {
    name: string;
    icon: string;
    calories: number;
    duration: number;
    originalId: string;
  };
}

interface ExerciseStatsDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
  exerciseData?: {
    minutes: number;
    calories: number;
  };
  stepsData?: number;
  exerciseRecords?: ExerciseRecord[];
  onOpenExerciseLibrary?: () => void;
  userDayDataOverrides?: Record<string, any>;
  onDeleteLocalRecord?: (recordId: string, date: Date) => void;
}

const ExerciseStatsDetailScreen: React.FC<ExerciseStatsDetailScreenProps> = ({
  onClose,
  selectedDate,
  exerciseData = { minutes: 0, calories: 0 },
  stepsData = 0,
  exerciseRecords = [],
  onOpenExerciseLibrary,
  userDayDataOverrides = {},
  onDeleteLocalRecord
}) => {
  void exerciseData;
  void stepsData;
  void exerciseRecords;
  // Helper function - must be defined before use
  const formatDateKey = (date: Date) => {
    return toLocalDateString(date);
  };

  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [currentWeekStart, setCurrentWeekStart] = useState(selectedDate);
  const [showDataAnalysis, setShowDataAnalysis] = useState(false);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<ExerciseRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [showExerciseEditModal, setShowExerciseEditModal] = useState(false);
  const [editingExerciseRow, setEditingExerciseRow] = useState<ServiceExerciseRecord | null>(null);
  const [editExName, setEditExName] = useState('');
  const [editExDuration, setEditExDuration] = useState(0);
  const [editExCalories, setEditExCalories] = useState(0);
  
  // Use alert hook
  const { showError } = useAlert();

  // 计算本周的日期范围（用于记录部分，固定显示本周）
  const currentWeekRange = useMemo(() => {
    const weekStart = new Date(currentWeekStart);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 周一为开始
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    return { start: weekStart, end: weekEnd };
  }, [currentWeekStart]);

  // 使用本周的日期范围加载记录数据
  const dateRange = currentWeekRange;

  // 使用 React Query Hook 加载数据
  const {
    records: exerciseRecordsFromDB,
    updateRecord: updateRecordAsync,
    deleteRecord: deleteRecordAsync,
    refresh,
    isUpdating: isUpdatingExercise,
  } = useExerciseRecordsQuery(
    dateRange?.start,
    dateRange?.end
  );

  const deleteHealthRecord = useCallback(async (id: string) => {
    await deleteRecordAsync(id);
  }, [deleteRecordAsync]);

  const handleClose = useCallback(() => {
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // 使用提取的Hook计算统计信息
  const { activityCalories, exerciseMinutes } = useExerciseStats({
    selectedDate,
    userDayDataOverrides,
    exerciseRecordsFromDB,
  });

  // Sync currentWeekStart with selectedDate when it changes
  React.useEffect(() => {
    setCurrentWeekStart(selectedDate);
  }, [selectedDate]);

  const formatDate = (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      if (timePeriod === 'day') {
        return `${year}-${month}-${day}`;
      } else if (timePeriod === 'week') {
        return formatWeekLabel(date);
      } else if (timePeriod === 'month') {
        return `${year}年${month}月`;
      } else {
        return `${year}年`;
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  // 使用提取的Hook计算图表数据（使用图表日期范围）
  const { chartData, previousPeriodData, yAxisMax, yAxisMin } = useExerciseChartData({
    timePeriod,
    currentWeekStart,
    userDayDataOverrides,
    exerciseRecordsFromDB,
  });

  // 获取本周的记录（固定显示，不受周期切换影响）
  const currentWeekRecords = useMemo(() => {
    // 从数据库记录中筛选本周
    const dbRecords = exerciseRecordsFromDB.filter((record: any) => {
      const recordDate = new Date(record.recorded_at);
      return recordDate >= currentWeekRange.start && recordDate <= currentWeekRange.end;
    });

    // 从userDayDataOverrides中获取本周的记录
    const localRecords: any[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekRange.start);
      date.setDate(currentWeekRange.start.getDate() + i);
      const dateKey = formatDateKey(date);
      const dayData = userDayDataOverrides[dateKey];
      if (dayData && dayData.records) {
        const exerciseRecords = dayData.records.filter((record: any) => record.type === 'exercise');
        localRecords.push(...exerciseRecords);
      }
    }

    // 转换数据库记录格式
    // 注意：dbRecords 已经是 ExerciseRecord 格式（通过 mapDatabaseRecordToExerciseRecord 转换）
    // 包含：id, exercise_name, duration, calories_burned, icon, originalId, recorded_at, source 等字段
    const formattedDbRecords = dbRecords.map((record: any) => {
      const recordTime = new Date(record.recorded_at);
      
      // 🔥 修复：如果是昨天的记录，显示日期+时间；如果是今天的记录，只显示时间
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recordDate = new Date(recordTime);
      recordDate.setHours(0, 0, 0, 0);
      
      const isToday = recordDate.getTime() === today.getTime();
      const isYesterday = recordDate.getTime() === today.getTime() - 24 * 60 * 60 * 1000;
      
      const hh = String(recordTime.getHours()).padStart(2, '0');
      const min = String(recordTime.getMinutes()).padStart(2, '0');
      const mm = String(recordTime.getMonth() + 1).padStart(2, '0');
      const dd = String(recordTime.getDate()).padStart(2, '0');
      let timeDisplay = '';
      if (isToday) {
        timeDisplay = `${hh}:${min}`;
      } else if (isYesterday) {
        timeDisplay = `昨天 ${hh}:${min}`;
      } else {
        // 固定「MM/DD HH:mm」单行，避免 zh-CN locale 在窄宽下把「分钟」折行
        timeDisplay = `${mm}/${dd} ${hh}:${min}`;
      }
      
      return {
        id: record.id,
        type: 'exercise' as const,
        name: record.exercise_name || '',
        calories: record.calories_burned || 0,
        time: timeDisplay,
        exercise_data: {
          name: record.exercise_name || '',
          icon: record.icon || '🏃',
          calories: record.calories_burned || 0,
          duration: record.duration || 0,
          originalId: record.originalId || record.id,
          source: record.source || 'manual' // 🔥 修复：确保从 record.source 获取
        }
      };
    });

    // 合并并去重（优先数据库记录）
    const allRecords = [...formattedDbRecords, ...localRecords];
    const uniqueRecords = Array.from(
      new Map(allRecords.map(record => [record.id, record])).values()
    );

    return uniqueRecords;
  }, [exerciseRecordsFromDB, userDayDataOverrides, currentWeekRange]);

  // 使用本周的记录（固定显示，不受周期切换影响）
  const currentDisplayRecords = currentWeekRecords;

  const goToPrevious = () => {
    const newDate = new Date(currentWeekStart);
    if (timePeriod === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (timePeriod === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (timePeriod === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (timePeriod === 'year') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentWeekStart(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentWeekStart);
    if (timePeriod === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (timePeriod === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (timePeriod === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (timePeriod === 'year') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentWeekStart(newDate);
  };

  // 处理删除记录
  const handleDeleteRecord = (record: ExerciseRecord) => {
    setDeleteConfirmRecord(record);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmRecord) return;

    setDeletingRecordId(deleteConfirmRecord.id);
    const recordIdToDelete = deleteConfirmRecord.id;
    setDeleteConfirmRecord(null);

    try {
      // 检查记录是否在 userDayDataOverrides 中
      // 遍历本周的所有日期，查找包含该记录的日期
      let foundLocalRecord = false;
      let recordDate = selectedDate;
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekRange.start);
        date.setDate(currentWeekRange.start.getDate() + i);
        const dateKey = formatDateKey(date);
        const dayData = userDayDataOverrides[dateKey];
        if (dayData?.records?.some((r: any) => r.id === recordIdToDelete)) {
          foundLocalRecord = true;
          recordDate = date;
          break;
        }
      }
      
      // 如果记录在 userDayDataOverrides 中，先从中删除
      if (foundLocalRecord && onDeleteLocalRecord) {
        onDeleteLocalRecord(recordIdToDelete, recordDate);
        setDeletingRecordId(null);
        return; // 本地记录删除完成
      }
      
      // 如果记录有id且不是本地临时记录，需要从数据库删除
      if (recordIdToDelete && !recordIdToDelete.startsWith('exercise-')) {
        // 使用乐观更新，删除会立即从UI中移除
        await deleteHealthRecord(recordIdToDelete);
        // React Query 的乐观更新已经处理了UI更新，这里只需要重置删除状态
        setDeletingRecordId(null);
      } else {
        setDeletingRecordId(null);
      }
    } catch (error) {
      console.error('Failed to delete exercise record:', error);
      showError('删除失败', '删除失败，请重试');
      setDeletingRecordId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmRecord(null);
  };

  const closeExerciseEditModal = useCallback(() => {
    setShowExerciseEditModal(false);
    setEditingExerciseRow(null);
    setEditExName('');
    setEditExDuration(0);
    setEditExCalories(0);
  }, []);

  const handleEditExerciseRecord = useCallback(
    (record: ExerciseRecord) => {
      const found = exerciseRecordsFromDB.find((r) => r.id === record.id);
      if (!found?.id || String(found.id).startsWith('temp-')) {
        showError('无法编辑', '仅已保存到账户的运动记录可编辑；本地未同步条目请删除后重新添加。');
        return;
      }
      setEditingExerciseRow(found);
      setEditExName(found.exercise_name?.trim() || record.exercise_data?.name || '运动');
      setEditExDuration(Number(found.duration ?? record.exercise_data?.duration) || 0);
      setEditExCalories(Number(found.calories_burned ?? record.exercise_data?.calories) || 0);
      setShowExerciseEditModal(true);
    },
    [exerciseRecordsFromDB, showError]
  );

  const handleSaveExerciseEdit = useCallback(async () => {
    if (!editingExerciseRow?.id) return;
    const name = editExName.trim() || '运动';
    const duration = Math.max(0, Math.floor(editExDuration));
    const calories = Math.max(0, Math.floor(editExCalories));
    try {
      await updateRecordAsync({
        id: editingExerciseRow.id,
        updates: {
          exercise_name: name,
          duration,
          calories_burned: calories,
          icon: editingExerciseRow.icon,
          originalId: editingExerciseRow.originalId,
          source: editingExerciseRow.source,
        },
      });
      await refresh();
      closeExerciseEditModal();
    } catch (e) {
      console.error('[ExerciseStats] update failed', e);
      showError('保存失败', '请稍后重试');
    }
  }, [
    editingExerciseRow,
    editExName,
    editExDuration,
    editExCalories,
    updateRecordAsync,
    refresh,
    closeExerciseEditModal,
    showError,
  ]);

  return (
    <>
    <DragPanel show={true} onClose={handleClose} zIndex={60} mask={{ visible: false }}
      header={
        <>
          <DetailHeader title={"运动统计"} leftAction={{ label: '返回', onClick: handleClose }} rightAction={{ label: '添加', onClick: onOpenExerciseLibrary }} />
          {/* Period Selector */}
          <div className="bg-gray-50 px-4 pt-2 pb-1">
            <PeriodSelector
              options={[
                { label: '天', value: 'day' },
                { label: '周', value: 'week' },
                { label: '月', value: 'month' },
                { label: '年', value: 'year' }
              ]}
              value={timePeriod}
              onChange={(v) => setTimePeriod(v as 'day' | 'week' | 'month' | 'year')}
            />
          </div>
        </>
      }
    >

        <div className="px-4 space-y-1 flex-1 overflow-y-auto pb-4 scrollbar-hide">
            {/* Chart Area - Show for all periods including day */}
            <SectionCard className="my-1 px-3 pt-3 pb-1">
              {/* 问号按钮在右上角 - 只在非天周期时显示 */}
              {timePeriod !== 'day' && (
                <div className="flex justify-end mb-2">
                  <button 
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    onClick={() => setShowDataAnalysis(!showDataAnalysis)}
                  >
                    <HelpCircle className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              )}

              {/* Line Chart */}
              <div className="relative h-48 mb-2">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 flex flex-col justify-between h-full text-xs text-gray-400">
                  <span>{yAxisMax}</span>
                  <span>{Math.round(yAxisMax * 0.75)}</span>
                  <span>{Math.round(yAxisMax * 0.5)}</span>
                  <span>{Math.round(yAxisMax * 0.25)}</span>
                  <span>{yAxisMin}</span>
                </div>
                
                {/* Chart area with line graph */}
                <div className="ml-8 h-full relative">
                  <LineChart
                    data={chartData.map(item => ({
                      value: item.calories,
                      label: item.label,
                      time: item.label,
                    }))}
                    selectedDataPoint={null}
                    unit="kcal"
                    minValue={yAxisMin}
                    maxValue={yAxisMax}
                    height={200}
                    strokeColor="#f59e0b"
                    pointColor="#f59e0b"
                    showNormalRange={timePeriod !== 'day'}
                    normalRangeTop="50%"
                    normalRangeHeight="30%"
                    normalRangeColor="#fef3c7"
                    formatValue={(value) => `${value} kcal`}
                    formatTime={(time) => time || ''}
                    emptyStateMessage="暂无数据"
                  />
                </div>
              </div>
              
              {/* X-axis labels */}
              <div className="ml-8 flex justify-between text-xs text-gray-500 mt-2">
                {chartData.map((item, index) => {
                  const shouldShow = timePeriod === 'month' 
                    ? (index % 5 === 0 || index === chartData.length - 1)
                    : timePeriod === 'year'
                    ? (index % 2 === 0 || index === chartData.length - 1)
                    : timePeriod === 'day'
                    ? true // 天视图显示所有时间点
                    : true;
                  
                  return shouldShow ? (
                    <span key={index} className="flex-1 text-center">{item.label}</span>
                  ) : null;
                })}
              </div>

              {/* Date display for day period */}
              {timePeriod === 'day' && (
                <div className="ml-8 text-center text-sm text-gray-800 font-medium mt-2">
                  {formatDate(currentWeekStart)}
                </div>
              )}

              {/* Date Navigator - 只在非天周期时显示 */}
              {timePeriod !== 'day' && (
                <DateNavigator
                  label={formatDate(currentWeekStart)}
                  onPrev={goToPrevious}
                  onNext={goToNext}
                  className="pt-1"
                />
              )}

              {/* 数据解读（可折叠，只在非天周期时显示） */}
              {showDataAnalysis && (timePeriod === 'month' || timePeriod === 'year') && chartData.length > 0 && (
                <div className="mt-4">
                  <DataAnalysisCard
                    currentData={chartData}
                    previousData={previousPeriodData}
                    dataType="exercise"
                    period={timePeriod === 'month' ? '月' : '年'}
                    valueKey="calories"
                  />
                </div>
              )}
            </SectionCard>

            {/* Exercise Stats Cards - Always show */}
            <ExerciseStatsCards
              exerciseMinutes={exerciseMinutes}
              activityCalories={activityCalories}
            />

            {/* Exercise Records - Always show last 7 days records */}
            <ExerciseRecordList
              records={currentDisplayRecords}
              deletingRecordId={deletingRecordId}
              onDelete={handleDeleteRecord}
              onEdit={handleEditExerciseRecord}
              onAddExercise={onOpenExerciseLibrary}
            />
        </div>
    </DragPanel>

      <ConfirmModal
        show={!!deleteConfirmRecord}
        title="确认删除"
        message={deleteConfirmRecord ? (
          <>
            确定要删除这条运动记录吗？
            {deleteConfirmRecord.exercise_data && (
              <span className="block mt-1">
                {deleteConfirmRecord.exercise_data.name} - {deleteConfirmRecord.exercise_data.calories} kcal
              </span>
            )}
          </>
        ) : ''}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        zIndex={80}
      />

      <DragPanel
        show={showExerciseEditModal}
        onClose={closeExerciseEditModal}
        zIndex={75}
        mask={{ visible: true, clickable: true }}
        maxHeight="70vh"
        maxWidth="max-w-xs"
        header={
          <div className="px-4 py-2 text-center text-sm text-gray-600">编辑运动记录</div>
        }
      >
        <div className="px-5 pb-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">项目名称</label>
            <input
              type="text"
              value={editExName}
              onChange={(e) => setEditExName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              placeholder="运动名称"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">时长（分钟）</label>
            <input
              type="number"
              min={0}
              step={1}
              value={editExDuration || ''}
              onChange={(e) => setEditExDuration(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">消耗热量（kcal）</label>
            <input
              type="number"
              min={0}
              step={1}
              value={editExCalories || ''}
              onChange={(e) => setEditExCalories(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={closeExerciseEditModal}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isUpdatingExercise}
              onClick={() => void handleSaveExerciseEdit()}
              className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {isUpdatingExercise ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </DragPanel>
    </>
  );
};

export default ExerciseStatsDetailScreen;
