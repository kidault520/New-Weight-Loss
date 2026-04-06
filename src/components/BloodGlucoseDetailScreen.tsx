 
import React, { useState, useMemo, useCallback } from 'react';
import { BarChart3, HelpCircle } from 'lucide-react';
import { DragPanel } from './common/DragPanel'
import { useBloodGlucoseRecordsQuery } from '../hooks/useBloodGlucoseRecordsQuery'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import { PeriodSelector } from './common/PeriodSelector'
import { DateNavigator } from './common/DateNavigator'
import { DataAnalysisCard } from './common/DataAnalysisCard'
import { ConfirmModal } from './common/ConfirmModal'
import { AlertDialog } from './common/AlertDialog'
import { DataRecordList, DataRecord } from './features/DataRecordList'
import { useAlert } from '../hooks/useAlert'
import { useBloodGlucoseChartData } from '../hooks/useBloodGlucoseChartData'
import { useBloodGlucoseStats } from '../hooks/useBloodGlucoseStats'
import { StatisticsCards } from './common/StatisticsCards'
import { LineChart } from './common/LineChart'
import { useDetailScreen } from '../hooks/useDetailScreen';
import { formatTimeChinese } from '../utils/dateUtils';

interface BloodGlucoseRecord {
  id: string;
  recorded_at: string | Date;
  value?: number;
  notes?: string;
  /** 健康记录扩展字段（编辑时回传） */
  blood_glucose_data?: Record<string, unknown> | null;
}

interface BloodGlucoseDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
}

const BloodGlucoseDetailScreen: React.FC<BloodGlucoseDetailScreenProps> = ({ onClose, selectedDate: initialDate }) => {
  // 使用统一的DetailScreen Hook管理通用状态（使用'月'代替'季度'，因为Hook不支持季度）
  const {
    selectedDate,
    setSelectedDate,
    selectedPeriod: baseSelectedPeriod,
    setSelectedPeriod: setBaseSelectedPeriod,
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
    formatDate: baseFormatDate,
    navigateDate: baseNavigateDate,
    currentWeekRange,
    getCurrentWeekRecords,
    groupRecordsByDate,
  } = useDetailScreen<BloodGlucoseRecord>({
    initialDate,
    initialPeriod: '天',
  });

  // 业务特定的状态
  const [selectedPeriod, setSelectedPeriod] = useState<'天' | '周' | '月' | '季度'>('天');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'3小时' | '8小时' | '12小时' | '24小时'>('3小时');
  const [showGlucoseModal, setShowGlucoseModal] = useState(false);
  const [glucoseValue, setGlucoseValue] = useState(5.5);
  
  // 同步selectedPeriod到Hook（将'季度'映射为'月'）
  React.useEffect(() => {
    const hookPeriod = selectedPeriod === '季度' ? '月' : selectedPeriod;
    if (baseSelectedPeriod !== hookPeriod) {
      setBaseSelectedPeriod(hookPeriod as '天' | '周' | '月' | '年');
    }
  }, [selectedPeriod, baseSelectedPeriod, setBaseSelectedPeriod]);
  
  // Use alert hook
  const { alertState, showError, hideAlert } = useAlert();

  // 计算日期范围（用于useBloodGlucoseRecordsQuery）
  const dateRange = useMemo(() => {
    if (selectedPeriod === '天') {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else if (selectedPeriod === '周') {
      return { start: currentWeekRange.start, end: currentWeekRange.end };
    }
    return undefined;
  }, [selectedPeriod, selectedDate, currentWeekRange]);

  // 使用 React Query Hook 加载数据
  const { 
    records: bloodGlucoseRecords, 
    isLoading: isLoadingRecords, 
    addRecord: addRecordAsync, 
    updateRecord: updateRecordAsync,
    deleteRecord: deleteRecordAsync,
    refresh: refreshBloodGlucoseRecords,
  } = useBloodGlucoseRecordsQuery(
    dateRange?.start,
    dateRange?.end
  );

  // 包装异步函数以保持接口兼容
  const addRecord = useCallback(async (data: any) => {
    if (data.value && data.recorded_at) {
      await addRecordAsync({ 
        value: data.value, 
        date: new Date(data.recorded_at),
        notes: data.notes,
        extraData: data.blood_glucose_data
      });
    }
  }, [addRecordAsync]);

  const deleteHealthRecord = useCallback(async (id: string) => {
    await deleteRecordAsync(id);
  }, [deleteRecordAsync]);

  const timeRanges = ['3小时', '8小时', '12小时', '24小时'] as const;

  // 自定义formatDate以支持'季度'周期
  const formatDate = (date: Date) => {
    if (selectedPeriod === '季度') {
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${year}年Q${quarter}`;
    }
    return baseFormatDate(date);
  };

  // 自定义navigateDate以支持'季度'周期
  const navigateDate = (direction: 'prev' | 'next') => {
    if (selectedPeriod === '季度') {
      const newDate = new Date(selectedDate);
      newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 3 : -3));
      setSelectedDate(newDate);
    } else {
      baseNavigateDate(direction);
    }
  };


  // 使用useBloodGlucoseChartData Hook替代图表数据计算逻辑
  const { chartData, previousPeriodData } = useBloodGlucoseChartData({
    records: bloodGlucoseRecords,
    selectedPeriod,
    currentDate: selectedDate,
    selectedTimeRange,
  });

  // 使用useBloodGlucoseStats Hook替代统计计算逻辑
  const stats = useBloodGlucoseStats({ chartData });


  // 获取本周的记录（固定显示，不受周期切换影响）
  const currentWeekRecords = useMemo(() => {
    return getCurrentWeekRecords(bloodGlucoseRecords);
  }, [bloodGlucoseRecords, getCurrentWeekRecords]);

  // 按日期分组本周的记录
  const groupedRecords = useMemo(() => {
    return groupRecordsByDate(currentWeekRecords);
  }, [currentWeekRecords, groupRecordsByDate]);

  const handleGlucoseAdd = async () => {
    // 立即关闭弹窗，提供即时反馈
    setShowGlucoseModal(false);
    const savedGlucoseValue = glucoseValue;
    const savedEditingRecord = editingRecord;
    setGlucoseValue(5.5);
    setEditingRecord(null);

    try {
      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      if (savedEditingRecord) {
        await updateRecordAsync({
          id: savedEditingRecord.id,
          value: savedGlucoseValue,
          date: recordDate,
          notes: savedEditingRecord.notes ?? '手动记录',
          extraData: savedEditingRecord.blood_glucose_data,
        });
      } else {
        await addRecord({
          value: savedGlucoseValue,
          unit: 'mmol/L',
          notes: '手动记录',
          recorded_at: recordDate.toISOString()
        });
      }
      await refreshBloodGlucoseRecords();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to save blood glucose record:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      // 保存失败时恢复状态并重新打开弹窗
      setGlucoseValue(savedGlucoseValue);
      setEditingRecord(savedEditingRecord);
      setShowGlucoseModal(true);
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  // 处理编辑记录
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setGlucoseValue(record.value);
    setShowGlucoseModal(true);
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
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to delete blood glucose record:', error);
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
    <DragPanel show={true} onClose={onClose} zIndex={80} mask={{ visible: false }}
      header={
        <>
          <DetailHeader title={"血糖"} leftAction={{ label: '返回', onClick: onClose }} rightAction={{ label: '+', onClick: () => setShowGlucoseModal(true) }} />
          {/* Period Selector */}
          <div className="bg-gray-50 px-4 pt-2 pb-1">
            <PeriodSelector
              options={['天','周','月','季度'].map(l => ({ label: l, value: l }))}
              value={selectedPeriod}
              onChange={(v) => setSelectedPeriod(v as '天'|'周'|'月'|'季度')}
            />
          </div>
        </>
      }
    >

        <div className="px-4 space-y-1 flex-1 overflow-y-auto pb-4 scrollbar-hide">
          {/* Time Range Selector - Only show for 天 period */}
          {selectedPeriod === '天' && (
            <SectionCard className="my-1 p-3">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTimeRange === range
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Chart Area - Show for all periods including 天 */}
          <SectionCard className="my-1 px-3 pt-3 pb-1">
            {/* 问号按钮在右上角 - 只在非天周期时显示 */}
            {selectedPeriod !== '天' && (
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
                <span>{Math.max(...chartData.map((d) => d.value || 0), 12)}</span>
                <span>{Math.round(Math.max(...chartData.map((d) => d.value || 0), 12) * 0.75)}</span>
                <span>{Math.round(Math.max(...chartData.map((d) => d.value || 0), 12) * 0.5)}</span>
                <span>{Math.round(Math.max(...chartData.map((d) => d.value || 0), 12) * 0.25)}</span>
                <span>0</span>
              </div>
              
              {/* Chart area with line graph */}
              <div className="ml-8 h-full relative">
                <LineChart
                  data={chartData}
                  selectedDataPoint={selectedDataPoint}
                  onDataPointSelectInternal={(index, x, y) => {
                    setSelectedDataPoint({ index, x, y });
                  }}
                  onDataPointDeselect={() => setSelectedDataPoint(null)}
                  unit="mmol/L"
                  minValue={0}
                  maxValue={Math.max(...chartData.map((d) => d.value || 0), 12)}
                  height={192}
                  showNormalRange={selectedPeriod !== '天'}
                  normalRangeColor="#fef3c7"
                  formatValue={(value) => value.toFixed(1)}
                  formatTime={formatTimeChinese}
                  emptyStateMessage="暂无数据"
                />
              </div>
            </div>
            
            {/* X-axis labels */}
            <div className="ml-8 flex justify-between text-xs text-gray-500 mt-2">
              {chartData.map((item, index: number) => {
                const shouldShow = selectedPeriod === '月' 
                  ? (index % 5 === 0 || index === chartData.length - 1)
                  : selectedPeriod === '季度'
                  ? true // 季度显示所有3个月份
                  : selectedPeriod === '天'
                  ? true // 天视图显示所有时间点
                  : true;
                
                // 天视图显示时间，其他视图显示标签（不显示时间）
                const label = selectedPeriod === '天' ? (item.time || item.label) : item.label;
                
                return shouldShow ? (
                  <span key={index} className="flex-1 text-center">{label}</span>
                ) : null;
              })}
            </div>
            
            {/* Date display for 天 period */}
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
            {showDataAnalysis && selectedPeriod !== '天' && chartData.length > 0 && (
              <div className="mt-4">
                <DataAnalysisCard
                  currentData={chartData.map((item: any) => ({ ...item, value: item.value }))}
                  previousData={previousPeriodData.map((item: any) => ({ ...item, value: item.value }))}
                  dataType="bloodGlucose"
                  period={selectedPeriod === '月' ? '月' : '季度'}
                  valueKey="value"
                />
              </div>
            )}
          </SectionCard>


          {/* Statistics Cards - Always show */}
          <StatisticsCards
              stats={stats}
              unit="mmol/L"
              labels={{
                highest: '最高血糖',
                lowest: '最低血糖',
                average: '平均血糖',
                fluctuation: '最大血糖波动',
              }}
              showFluctuation={true}
            />

          {/* Measurement Records - Always show current week records */}
          <DataRecordList
              records={Object.values(groupedRecords).flat().map((record: BloodGlucoseRecord) => ({
                id: record.id,
                value: record.value || 0,
                unit: 'mmol/L',
                recorded_at:
                  typeof record.recorded_at === 'string'
                    ? record.recorded_at
                    : record.recorded_at.toISOString(),
                notes: record.notes
              }))}
              groupedRecords={Object.entries(groupedRecords).reduce((acc, [date, dateRecords]) => {
                acc[date] = dateRecords.map((record: BloodGlucoseRecord) => ({
                  id: record.id,
                  value: record.value || 0,
                  unit: 'mmol/L',
                  recorded_at:
                    typeof record.recorded_at === 'string'
                      ? record.recorded_at
                      : record.recorded_at.toISOString(),
                  notes: record.notes
                }));
                return acc;
              }, {} as { [key: string]: DataRecord[] })}
              isLoading={isLoadingRecords}
              formatValue={(value) => value.toFixed(1)}
              showSourceTag={true}
              showNotes={true}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
              deletingRecordId={deletingRecordId}
              sectionTitle="测量记录"
              sectionIcon={<BarChart3 className="w-4 h-4 text-red-500" />}
              emptyStateTitle="暂无记录"
              emptyStateDescription="暂无记录，请点击右上「+」添加"
              groupByDate={true}
              defaultSourceToManual={true}
            />

          {/* Bottom spacing */}
          <div className="h-2"></div>
        </div>
    </DragPanel>

      {/* Blood Glucose Recording Modal */}
      <DragPanel show={showGlucoseModal} onClose={() => { setShowGlucoseModal(false); setEditingRecord(null); setGlucoseValue(5.5); }} zIndex={90} mask={{ visible: true, clickable: true }} maxHeight="70vh" maxWidth="max-w-xs" header={<div className="px-4 py-2 text-center text-sm text-gray-600">{editingRecord ? '编辑血糖记录' : '添加血糖记录'}</div>}>
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-red-500">{glucoseValue.toFixed(1)}</span>
              <span className="text-lg text-gray-600">mmol/L</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[4.0, 5.0, 6.0, 7.0].map((value) => (
                <button key={value} onClick={() => setGlucoseValue(value)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${Math.abs(glucoseValue - value) < 0.1 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{value}</button>
              ))}
            </div>
            <div className="mb-3">
              <input type="number" min="2.0" max="20.0" step="0.1" value={glucoseValue} onChange={(e) => setGlucoseValue(parseFloat(e.target.value) || 5.5)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="text-center text-xs text-gray-500">
              正常范围: 3.9 - 7.8 mmol/L
            </div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button onClick={() => { setShowGlucoseModal(false); setEditingRecord(null); setGlucoseValue(5.5); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">取消</button>
            <button onClick={handleGlucoseAdd} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors text-sm">{editingRecord ? '保存' : '添加'}</button>
          </div>
        </div>
      </DragPanel>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteConfirmRecord}
        title="确认删除"
        message={
          deleteConfirmRecord
            ? `确定要删除这条 ${(deleteConfirmRecord.value ?? 0).toFixed(1)} mmol/L 的血糖记录吗？`
            : ''
        }
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        zIndex={100}
      />

      {/* Alert Dialog */}
      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
        zIndex={100}
      />
    </>
  );
};

export default BloodGlucoseDetailScreen;
