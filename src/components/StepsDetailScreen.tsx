import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BarChart3, Target, CreditCard as Edit3, HelpCircle } from 'lucide-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { calculateStepsData } from '../services/calorieCalculations';
import { dashboardDataService } from '../services/dashboardDataService';
import { generateMockData, type DayData } from '../utils/mockData';
import { toLocalDateString } from '../utils/dateUtils';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import { PeriodSelector } from './common/PeriodSelector'
import { DateNavigator } from './common/DateNavigator'
import { DataAnalysisCard } from './common/DataAnalysisCard'
import { ConfirmModal } from './common/ConfirmModal'
import { AlertDialog } from './common/AlertDialog'
import { DataRecordList, DataRecord } from './features/DataRecordList'
import { useAlert } from '../hooks/useAlert'
import { useStepsRecordsQuery } from '../hooks/useStepsRecordsQuery'
import { useStepsChartData } from '../hooks/useStepsChartData'
import { LineChart } from './common/LineChart'
import { useDetailScreen } from '../hooks/useDetailScreen';

interface StepsRecord {
  id: string;
  recorded_at: string | Date;
  value?: number;
  steps?: number;
  notes?: string;
}

interface StepsDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
  userId: string | null;
  showTutorialData?: boolean;
  userDayDataOverrides?: Record<string, Partial<DayData>>;
}

const StepsDetailScreen: React.FC<StepsDetailScreenProps> = ({
  onClose,
  selectedDate: initialDate,
  userId,
  showTutorialData = false,
  userDayDataOverrides = {},
}) => {
  const { profile, updateProfile } = useUserProfile();
  const queryClient = useQueryClient();
  
  // 使用统一的DetailScreen Hook管理通用状态
  const {
    selectedDate,
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
    getCurrentWeekRecords,
    groupRecordsByDate,
  } = useDetailScreen<StepsRecord>({
    initialDate,
    initialPeriod: '天',
  });

  // 业务特定的状态
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [stepsAmount, setStepsAmount] = useState(1000);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editingStepsTarget, setEditingStepsTarget] = useState(8000);
  
  // Use alert hook
  const { alertState, showError, hideAlert } = useAlert();
  
  // 将中文周期转换为英文周期（用于useStepsRecordsQuery）
  const timePeriod = useMemo(() => {
    const periodMap: Record<'天' | '周' | '月' | '年', 'day' | 'week' | 'month' | 'year'> = {
      '天': 'day',
      '周': 'week',
      '月': 'month',
      '年': 'year',
    };
    return periodMap[selectedPeriod];
  }, [selectedPeriod]);

  // 计算日期范围（用于useStepsRecordsQuery）
  const dateRange = useMemo(() => {
    if (timePeriod === 'day') {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else if (timePeriod === 'week') {
      return { start: currentWeekRange.start, end: currentWeekRange.end };
    }
    return undefined;
  }, [timePeriod, selectedDate, currentWeekRange]);

  // 使用 React Query Hook 加载数据
  const { 
    records: stepsRecords, 
    isLoading: isLoadingRecords, 
    addRecord: addRecordAsync, 
    updateRecord: updateRecordAsync,
    deleteRecord: deleteRecordAsync, 
    refresh 
  } = useStepsRecordsQuery(
    dateRange?.start,
    dateRange?.end
  );

  const dayKey = toLocalDateString(selectedDate);

  const dayDashboardQuery = useQuery({
    queryKey: [
      'dashboard-data',
      userId,
      dayKey,
      !!showTutorialData,
      profile?.target_weight,
      profile?.daily_steps_goal,
    ],
    queryFn: async () => {
      if (!userId) {
        return generateMockData(selectedDate);
      }
      return dashboardDataService.getDayData(selectedDate, {
        showTutorialData: !!showTutorialData,
        targetWeight: profile?.target_weight || 60,
        userProfile: profile,
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const dayOverride = userDayDataOverrides[dayKey];
  const mergedSteps = useMemo(() => {
    const base =
      dayDashboardQuery.data?.steps ?? {
        current: 0,
        target: 8000,
        hourlyData: new Array(24).fill(0),
        floors: 0,
      };
    const merged = dayOverride?.steps ? { ...base, ...dayOverride.steps } : base;
    const g = profile?.daily_steps_goal;
    const targetFromProfile =
      typeof g === 'number' && Number.isFinite(g) && g >= 1000 && g <= 100000
        ? Math.round(g)
        : merged.target;
    return { ...merged, target: targetFromProfile };
  }, [dayDashboardQuery.data?.steps, dayOverride?.steps, profile?.daily_steps_goal]);

  // 包装异步函数以保持接口兼容
  const addRecord = useCallback(async (data: any) => {
    if (data.value && data.recorded_at) {
      await addRecordAsync({ 
        steps: data.value, 
        date: new Date(data.recorded_at),
        notes: data.notes 
      });
    }
  }, [addRecordAsync]);

  const deleteHealthRecord = useCallback(async (id: string) => {
    await deleteRecordAsync(id);
  }, [deleteRecordAsync]);

  const userWeight = profile?.current_weight || 70;

  // 处理关闭（DragPanel已内置拖拽功能，这里只需要简单的关闭处理）
  const handleClose = () => {
    onClose();
  };

  // 获取上一周期的数据用于对比
  const getPreviousPeriodData = useMemo(() => {
    if (timePeriod !== 'month' && timePeriod !== 'year') {
      return [];
    }

    const prevDate = new Date(selectedDate);
    if (timePeriod === 'month') {
      prevDate.setMonth(prevDate.getMonth() - 1);
    } else {
      prevDate.setFullYear(prevDate.getFullYear() - 1);
    }

    const data = [];
    const deterministicBySeed = (seed: number, min: number, max: number) => {
      // 用日期种子生成稳定演示值，避免每次渲染随机跳动误导用户。
      const normalized = Math.abs(Math.sin(seed)) % 1;
      return Math.round(min + normalized * (max - min));
    };
    if (timePeriod === 'month') {
      const year = prevDate.getFullYear();
      const month = prevDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const mockSteps = deterministicBySeed(year * 10000 + month * 100 + day, 1000, 7000);
        data.push({
          label: String(day),
          steps: mockSteps
        });
      }
    } else if (timePeriod === 'year') {
      for (let month = 0; month < 12; month++) {
        const mockSteps = deterministicBySeed(prevDate.getFullYear() * 100 + month, 80000, 230000);
        data.push({
          label: `${month + 1}`,
          steps: mockSteps
        });
      }
    }

    return data;
  }, [timePeriod, selectedDate]);

  // 获取按日期分组的记录（用于周视图）
  const getRecordsByDate = useCallback((date: Date) => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();
    
    return stepsRecords.filter((record: any) => {
      const recordDate = new Date(record.recorded_at);
      const recordYear = recordDate.getFullYear();
      const recordMonth = recordDate.getMonth();
      const recordDay = recordDate.getDate();
      
      return recordYear === targetYear && 
             recordMonth === targetMonth && 
             recordDay === targetDay;
    });
  }, [stepsRecords]);

  const stepsFromRecordsForSelectedDay = useMemo(() => {
    return getRecordsByDate(selectedDate).reduce((sum, r: any) => sum + (Number(r.value) || 0), 0);
  }, [selectedDate, getRecordsByDate]);

  const stepsTotalForLoadedRange = useMemo(() => {
    return stepsRecords.reduce((sum, r: any) => sum + (Number(r.value) || 0), 0);
  }, [stepsRecords]);

  const displaySteps =
    timePeriod === 'day' ? stepsFromRecordsForSelectedDay : stepsTotalForLoadedRange;
  const displayFloors = timePeriod === 'day' ? (mergedSteps.floors ?? 0) : 0;

  const stepsData = calculateStepsData(displaySteps, displayFloors, userWeight);

  const targetStepsForDay = Math.max(1, mergedSteps.target || 8000);
  const dayProgressPct =
    timePeriod === 'day'
      ? Math.min(100, Math.round((stepsFromRecordsForSelectedDay / targetStepsForDay) * 100))
      : 0;

  const handleOpenStepsTarget = () => {
    setEditingStepsTarget(Math.round(mergedSteps.target || 8000));
    setShowTargetModal(true);
  };

  const handleSaveStepsTarget = async () => {
    const next = Math.max(1000, Math.min(100000, Math.round(editingStepsTarget)));
    if (!userId) {
      showError('无法保存', '请先登录后再保存步数目标');
      return;
    }
    try {
      await updateProfile({ daily_steps_goal: next });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId] });
      setShowTargetModal(false);
    } catch (error) {
      console.error('Failed to save daily_steps_goal:', error);
      showError('保存失败', '保存失败，请稍后重试');
    }
  };

  // 使用图表数据Hook
  const { chartData: chartDataRaw } = useStepsChartData({
    records: stepsRecords,
    timePeriod,
    currentWeekStart: selectedDate,
    getRecordsByDate,
    formatDate,
  });

  const chartData = chartDataRaw;
  const maxSteps = Math.max(...chartData.map(d => d.value), 100);

  // 处理数据点选择
  const handleDataPointSelectInternal = (index: number, x: number, y: number) => {
    setSelectedDataPoint({ index, x, y });
  };

  const handleDataPointDeselect = () => {
    setSelectedDataPoint(null);
  };

  // 获取本周的记录（固定显示，不受周期切换影响）
  const currentWeekRecords = useMemo(() => {
    return getCurrentWeekRecords(stepsRecords);
  }, [stepsRecords, getCurrentWeekRecords]);

  // 按日期分组本周的记录
  const groupedRecords = useMemo(() => {
    return groupRecordsByDate(currentWeekRecords);
  }, [currentWeekRecords, groupRecordsByDate]);

  const handleStepsAdd = async () => {
    // 立即关闭弹窗，提供即时反馈
    setShowStepsModal(false);
    const savedStepsAmount = stepsAmount;
    const savedEditingRecord = editingRecord;
    setStepsAmount(1000);
    setEditingRecord(null);

    try {
      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      if (savedEditingRecord) {
        await updateRecordAsync({
          id: savedEditingRecord.id,
          steps: savedStepsAmount,
          date: recordDate,
          notes: savedEditingRecord.notes,
        });
      } else {
        await addRecord({
          value: savedStepsAmount,
          unit: 'steps',
          recorded_at: recordDate.toISOString(),
        });
      }
      await refresh();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to save steps record:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      // 保存失败时恢复状态并重新打开弹窗
      setStepsAmount(savedStepsAmount);
      setEditingRecord(savedEditingRecord);
      setShowStepsModal(true);
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  // 处理编辑记录
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setStepsAmount(record.value);
    setShowStepsModal(true);
  };

  // 处理删除记录
  const handleDeleteRecord = (record: any) => {
    setDeleteConfirmRecord(record);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmRecord) return;

    setDeletingRecordId(deleteConfirmRecord.id);
    const recordIdToDelete = deleteConfirmRecord.id;
    setDeleteConfirmRecord(null);

    try {
      await deleteHealthRecord(recordIdToDelete);
      await refresh();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to delete steps record:', error);
      showError('删除失败', '删除失败，请重试');
    } finally {
      setDeletingRecordId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmRecord(null);
  };

  return (
    <>
    <DragPanel show={true} onClose={handleClose} zIndex={60} mask={{ visible: false }}
      header={
        <>
          <DetailHeader title={"步数"} leftAction={{ label: '返回', onClick: handleClose }} rightAction={{ label: '+', onClick: () => setShowStepsModal(true) }} />
          {/* Period Selector */}
          <div className="bg-gray-50 px-4 pt-2 pb-1">
            <PeriodSelector
              options={['天','周','月','年'].map(l => ({ label: l, value: l }))}
              value={selectedPeriod}
              onChange={(v) => setSelectedPeriod(v as '天'|'周'|'月'|'年')}
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
            <div className="relative h-40 mb-2">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 flex flex-col justify-between h-full text-xs text-gray-400">
                <span>{Math.round(maxSteps)}</span>
                <span>{Math.round(maxSteps * 0.5)}</span>
                <span>0</span>
              </div>
              
              {/* Chart area with line graph */}
              <div className="ml-8 h-full relative">
                <LineChart
                  data={chartData}
                  selectedDataPoint={selectedDataPoint}
                  onDataPointSelectInternal={handleDataPointSelectInternal}
                  onDataPointDeselect={handleDataPointDeselect}
                  unit="步"
                  maxValue={maxSteps}
                  strokeColor="#fbbf24"
                  pointColor="#fbbf24"
                  showNormalRange={timePeriod !== 'day'}
                  normalRangeTop="30%"
                  normalRangeHeight="40%"
                  normalRangeColor="#fef3c7"
                  formatValue={(value) => `${value}步`}
                  formatTime={(time) => time || ''}
                />
              </div>
            </div>
            
            {/* X-axis labels */}
            <div className="ml-8 flex justify-between text-xs text-gray-500 mt-2">
              {chartData.map((item, index) => {
                const shouldShow = timePeriod === 'month' 
                  ? (index === 0 || (index + 1) % 5 === 0 || index === chartData.length - 1)
                  : timePeriod === 'day'
                  ? true // 天视图显示所有时间点
                  : true;
                
                // 天视图显示时间，其他视图显示标签（不显示时间）
                const label = timePeriod === 'day' ? (item.time || item.label) : item.label;
                
                return shouldShow ? (
                  <span key={index} className="flex-1 text-center">{label}</span>
                ) : null;
              })}
            </div>

            {/* Date display for day period */}
            {selectedPeriod === '天' && (
              <div className="ml-8 text-center text-sm text-gray-800 font-medium mt-2">
                {formatDate(selectedDate)}
              </div>
            )}

            {/* Date Navigator - 只在非天周期时显示 */}
            {selectedPeriod !== '天' && (
              <DateNavigator
                label={formatDate(selectedDate)}
                onPrev={() => navigateDate('prev')}
                onNext={() => navigateDate('next')}
                className="mt-1"
              />
            )}

            {/* 数据解读（可折叠，只在非天周期时显示） */}
            {showDataAnalysis && timePeriod !== 'day' && chartData.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                  当前周期对比中的“上一周期”为演示数据，用于趋势说明，不代表真实设备同步结果。
                </p>
                <DataAnalysisCard
                  currentData={chartData}
                  previousData={getPreviousPeriodData.map(item => ({ ...item, value: item.steps }))}
                  dataType="steps"
                  period={timePeriod === 'month' ? '月' : timePeriod === 'year' ? '年' : '周'}
                  valueKey="value"
                />
              </div>
            )}
          </SectionCard>

          {/* Goal Progress Section - Only show for day period */}
          {timePeriod === 'day' && (
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-gray-400" />
                  <span className="text-lg font-medium text-gray-700">目标进度</span>
                </div>
                <span className="text-sm text-orange-500">进度 {dayProgressPct}%</span>
              </div>
              
              <div className="mb-6">
                <div className="flex items-end space-x-2 mb-2">
                  <span className="text-4xl font-bold text-gray-800">{stepsFromRecordsForSelectedDay}</span>
                  <span className="text-lg text-gray-600 mb-1">步</span>
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-6 border-transparent border-t-gray-800"></div>
              </div>

              <button
                type="button"
                onClick={handleOpenStepsTarget}
                className="w-full flex items-center justify-between bg-gray-50 rounded-xl p-4 text-left hover:bg-gray-100 transition-colors"
              >
                <span className="text-gray-600">目标</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-gray-800">{targetStepsForDay}步</span>
                  <Edit3 className="w-4 h-4 text-gray-400" aria-hidden />
                </div>
              </button>
              <p className="text-xs text-gray-500 mt-2 px-0.5">
                步数目标与饮水目标相同，会保存到您的健康档案；当日步数来自记录汇总。连接 Apple 健康等设备后可在「我的设备」自动同步，爬楼层亦将随设备数据展示。
              </p>
            </SectionCard>
          )}

          {/* Movement Distance Section - Always show */}
          <SectionCard>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-gray-600">移动距离</span>
                </div>
                <div className="flex items-end space-x-1">
                  <span className="text-2xl font-bold text-gray-800">{stepsData.distance}</span>
                  <span className="text-sm text-gray-500 mb-1">公里</span>
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-gray-600">已爬楼层</span>
                </div>
                <div className="flex items-end space-x-1">
                  <span className="text-2xl font-bold text-gray-800">{displayFloors}</span>
                  <span className="text-sm text-gray-500 mb-1">层</span>
                </div>
              </div>
            </div>
            {timePeriod !== 'day' && (
              <p className="text-xs text-gray-500 mt-3">
                周/月/年视图为当前区间内步数合计；距离与热量按合计步数估算，爬楼仅支持按日展示（来自当日同步数据）。
              </p>
            )}
          </SectionCard>

          {/* Calories Burned Section - Always show */}
          <SectionCard>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-500 text-sm">🔥</span>
              </div>
              <span className="text-lg font-medium text-gray-700">消耗热量</span>
            </div>

            <div className="flex items-end space-x-2 mb-3">
              <span className="text-3xl font-bold text-gray-800">{stepsData.totalCalories}</span>
              <span className="text-lg text-gray-600 mb-1">kcal</span>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">步行消耗</span>
                <span className="text-gray-700 font-medium">{stepsData.calories} kcal</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">爬楼消耗</span>
                <span className="text-gray-700 font-medium">{stepsData.floorsCalories} kcal</span>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              基于您的体重 ({userWeight}kg) 计算消耗的卡路里
            </p>
          </SectionCard>

          {/* Records Section - Always show current week records */}
          <DataRecordList
              records={Object.values(groupedRecords).flat().map(record => ({
                id: record.id,
                value: record.value,
                unit: '步',
                recorded_at: record.recorded_at,
                notes: record.notes
              }))}
              groupedRecords={Object.entries(groupedRecords).reduce((acc, [date, dateRecords]) => {
                acc[date] = dateRecords.map(record => ({
                  id: record.id,
                  value: record.value,
                  unit: '步',
                  recorded_at: record.recorded_at,
                  notes: record.notes
                }));
                return acc;
              }, {} as { [key: string]: DataRecord[] })}
              isLoading={isLoadingRecords}
              formatValue={(value) => value}
              showSourceTag={true}
              showNotes={true}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
              deletingRecordId={deletingRecordId}
              sectionTitle="记录"
              sectionIcon={<BarChart3 className="w-4 h-4 text-yellow-500" />}
              emptyStateTitle="暂无记录"
              emptyStateDescription="暂无记录，请点击右上「+」添加"
              groupByDate={true}
              defaultSourceToManual={true}
            />

          {/* Bottom spacing */}
          <div className="h-2"></div>
        </div>
    </DragPanel>

      {/* Steps Recording Modal */}
      <DragPanel show={showStepsModal} onClose={() => { setShowStepsModal(false); setEditingRecord(null); setStepsAmount(1000); }} zIndex={70} mask={{ visible: true, clickable: true }} maxHeight="70vh" maxWidth="max-w-xs" header={<div className="px-4 py-2 text-center text-sm text-gray-600">{editingRecord ? '编辑步数记录' : '添加步数记录'}</div>}>
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-yellow-500">{stepsAmount}</span>
              <span className="text-lg text-gray-600">步</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[1000, 3000, 5000, 10000].map((amount) => (
                <button key={amount} onClick={() => setStepsAmount(amount)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${stepsAmount === amount ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{amount}步</button>
              ))}
            </div>
            <div className="mb-3">
              <input type="number" min="0" max="100000" step="100" value={stepsAmount} onChange={(e) => setStepsAmount(parseInt(e.target.value, 10) || 1000)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button onClick={() => { setShowStepsModal(false); setEditingRecord(null); setStepsAmount(1000); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">取消</button>
            <button onClick={handleStepsAdd} className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition-colors text-sm">{editingRecord ? '保存' : '添加'}</button>
          </div>
        </div>
      </DragPanel>

      {/* 编辑每日步数目标（与首页 Dashboard 覆盖合并） */}
      <DragPanel
        show={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        zIndex={80}
        mask={{ visible: true, clickable: true }}
        maxHeight="70vh"
        maxWidth="max-w-xs"
        header={<div className="px-4 py-2 text-center text-sm text-gray-600">编辑步数目标</div>}
      >
        <div className="px-5 pb-4">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-yellow-500">{editingStepsTarget}</span>
              <span className="text-lg text-gray-600">步/天</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[5000, 8000, 10000, 12000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setEditingStepsTarget(amount)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                    editingStepsTarget === amount
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1000}
              max={100000}
              step={500}
              value={editingStepsTarget}
              onChange={(e) => setEditingStepsTarget(parseInt(e.target.value, 10) || 8000)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setShowTargetModal(false)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveStepsTarget}
              className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition-colors text-sm"
            >
              保存
            </button>
          </div>
        </div>
      </DragPanel>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteConfirmRecord}
        title="确认删除"
        message={deleteConfirmRecord ? `确定要删除这条 ${deleteConfirmRecord.value} 步的步数记录吗？` : ''}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        zIndex={80}
      />

      {/* Alert Dialog */}
      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
        zIndex={80}
      />
    </>
  );
};

export default StepsDetailScreen;
