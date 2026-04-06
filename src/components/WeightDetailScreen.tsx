 
import React, { useState, useContext, useMemo } from 'react';
import { BarChart3, HelpCircle } from 'lucide-react';
import { useWeightRecords, WeightRecord } from '../hooks/useWeightRecords';
import { UserProfileContext } from '../contexts/UserProfileContext';
import WeightRulerSlider from './WeightRulerSlider';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import { PeriodSelector } from './common/PeriodSelector'
import { DateNavigator } from './common/DateNavigator'
import { ConfirmModal } from './common/ConfirmModal'
import { AlertDialog } from './common/AlertDialog'
import { DataAnalysisCard } from './common/DataAnalysisCard'
import { DataRecordList, DataRecord } from './features/DataRecordList'
import { useAlert } from '../hooks/useAlert'
import { useWeightChartData } from '../hooks/useWeightChartData'
import { useWeightStats } from '../hooks/useWeightStats'
import { LineChart } from './common/LineChart'
import { WeightTargetCard } from './common/WeightTargetCard'
import { BMICard } from './common/BMICard'
import { useDetailScreen } from '../hooks/useDetailScreen';

interface WeightDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
}

const WeightDetailScreen: React.FC<WeightDetailScreenProps> = ({ onClose, selectedDate: initialDate }) => {
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
    getCurrentWeekRecords,
    groupRecordsByDate,
  } = useDetailScreen<WeightRecord>({
    initialDate,
    initialPeriod: '天',
  });

  // 业务特定的状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState<string>('');

  // Use alert hook
  const { alertState, showError, hideAlert } = useAlert();

  const { records, isLoading, addRecord, updateRecord, deleteRecord, getLatestRecord, getRecordsByDate, refreshRecords } = useWeightRecords();
  const profileContext = useContext(UserProfileContext);
  const userProfile = profileContext?.profile;

  // 处理关闭（DragPanel已内置拖拽功能，这里只需要简单的关闭处理）
  const handleClose = () => {
    onClose();
  };

  const latestRecord = getLatestRecord();

  // 使用提取的Hook计算统计信息
  const { initialWeight, targetWeight, bmiData } = useWeightStats({
    records,
    latestRecord,
    userProfile: userProfile ?? undefined,
  });

  // 使用提取的Hook计算图表数据
  const { chartData, previousPeriodData, chartMaxValue, chartMinValue } = useWeightChartData({
    records,
    selectedPeriod,
    selectedDate,
    getRecordsByDate,
  });

  // 处理数据点选择
  const handleDataPointSelectInternal = (index: number, x: number, y: number) => {
    setSelectedDataPoint({ index, x, y });
  };

  // 获取本周的记录（固定显示，不受周期切换影响）
  const currentWeekRecords = useMemo(() => {
    return getCurrentWeekRecords(records);
  }, [records, getCurrentWeekRecords]);

  // 按日期分组本周的记录
  const groupedRecords = useMemo(() => {
    return groupRecordsByDate(currentWeekRecords);
  }, [currentWeekRecords, groupRecordsByDate]);

  const handleSaveWeight = async () => {
    const weightValue = parseFloat(weightInput) || editingRecord?.value || profileContext?.profile?.current_weight || 60;
    
    if (isNaN(weightValue) || weightValue <= 0) {
      showError('输入无效', '请输入有效的体重值');
      return;
    }

    if (weightValue < 30 || weightValue > 200) {
      showError('输入超出范围', '体重值应在 30-200kg 之间');
      return;
    }

    // 立即关闭弹窗，提供即时反馈
    setIsModalOpen(false);
    const savedWeightInput = weightInput;
    const savedEditingRecord = editingRecord;
    setWeightInput('');
    setEditingRecord(null);

    try {
      // 使用 selectedDate 而不是当前时间，确保记录保存到正确的日期
      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      if (savedEditingRecord) {
        // 乐观更新：立即显示，后台同步
        await updateRecord(savedEditingRecord.id, weightValue, recordDate, savedEditingRecord.notes);
      } else {
        // 乐观更新：立即显示，后台同步
        await addRecord(weightValue, recordDate, '手动记录');
      }
      await refreshRecords();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to save weight:', error);
      // 保存失败时恢复状态并重新打开弹窗
      setWeightInput(savedWeightInput);
      setEditingRecord(savedEditingRecord);
      setIsModalOpen(true);
      showError('保存失败', '保存失败，请重试');
    }
  };

  const handleEditRecord = (record: DataRecord) => {
    const full = Object.values(groupedRecords).flat().find((r) => r.id === record.id);
    if (!full) return;
    setEditingRecord(full);
    setWeightInput(full.value.toFixed(1));
    setIsModalOpen(true);
  };

  const handleDeleteRecord = (record: DataRecord) => {
    const full = Object.values(groupedRecords).flat().find((r) => r.id === record.id);
    if (!full) return;
    setDeleteConfirmRecord(full);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmRecord) return;

    setDeletingRecordId(deleteConfirmRecord.id);
    setDeleteConfirmRecord(null);

    try {
      await deleteRecord(deleteConfirmRecord.id);
      await refreshRecords();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to delete weight record:', error);
      showError('删除失败', '删除失败，请重试');
    } finally {
      setDeletingRecordId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmRecord(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setWeightInput('');
  };

  return (
    <>
    <DragPanel show={true} onClose={handleClose} zIndex={60} mask={{ visible: false }}
      header={
        <>
          <DetailHeader title={"体重"} leftAction={{ label: '返回', onClick: handleClose }} rightAction={{ label: '+', onClick: () => {
            const initialValue = editingRecord?.value || profileContext?.profile?.current_weight || 60;
            setWeightInput(initialValue.toFixed(1));
            setIsModalOpen(true);
          }}} />
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
          {/* Chart Area - Only show for non-day periods */}
          {selectedPeriod !== '天' && (
            <SectionCard className="my-1 px-3 pt-3 pb-1">
              {/* 问号按钮在右上角 */}
              <div className="flex justify-end mb-2">
                <button 
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => setShowDataAnalysis(!showDataAnalysis)}
                >
                  <HelpCircle className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Line Chart */}
              <div className="relative h-40 mb-2">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 flex flex-col justify-between h-full text-xs text-gray-400">
                  <span>{chartMaxValue.toFixed(1)}</span>
                  <span>{((chartMaxValue + chartMinValue) / 2).toFixed(1)}</span>
                  <span>{chartMinValue.toFixed(1)}</span>
                </div>
                
                {/* Chart area with line graph */}
                <div className="ml-8 h-full relative">
                  <LineChart
                    data={chartData.map(item => ({
                      value: item.value,
                      label: item.date,
                      date: item.date,
                      time: item.time,
                      recorded_at: item.recorded_at,
                    }))}
                    selectedDataPoint={selectedDataPoint}
                    onDataPointSelectInternal={handleDataPointSelectInternal}
                    onDataPointDeselect={() => setSelectedDataPoint(null)}
                    unit="kg"
                    minValue={chartMinValue}
                    maxValue={chartMaxValue}
                    height={200}
                    showNormalRange={true}
                    normalRangeTop="20%"
                    normalRangeHeight="60%"
                    normalRangeColor="#fef3c7"
                    formatValue={(value) => value.toFixed(1)}
                    emptyStateMessage="暂无数据"
                  />
                </div>
              </div>

              {/* X-axis labels */}
              <div className="ml-8 flex justify-between text-xs text-gray-500 mt-2">
                {chartData.map((item, index) => {
                  const shouldShow = selectedPeriod === '月' 
                    ? (index === 0 || (index + 1) % 5 === 0 || index === chartData.length - 1)
                    : selectedPeriod === '年'
                    ? true
                    : true;
                  
                  return shouldShow ? (
                    <span key={index} className="flex-1 text-center">{item.date}</span>
                  ) : null;
                })}
              </div>

              <DateNavigator
                label={formatDate(selectedDate)}
                onPrev={() => navigateDate('prev')}
                onNext={() => navigateDate('next')}
                className="mt-1"
              />

              {/* 数据解读（可折叠，只在非天周期时显示） */}
              {showDataAnalysis && chartData.length > 0 && (
                <div className="mt-4">
                  <DataAnalysisCard
                    currentData={chartData}
                    previousData={previousPeriodData}
                    dataType="weight"
                    period={selectedPeriod === '月' ? '月' : selectedPeriod === '年' ? '年' : selectedPeriod === '周' ? '周' : '季度'}
                    valueKey="value"
                  />
                </div>
              )}
            </SectionCard>
          )}

          {/* Target Section - Always show */}
          <WeightTargetCard
            latestWeight={latestRecord?.value || null}
            initialWeight={initialWeight}
            targetWeight={targetWeight}
          />

          {/* Records Section - Always show current week records */}
          <DataRecordList
              records={Object.values(groupedRecords).flat().map(record => ({
                id: record.id,
                value: record.value,
                unit: record.unit || 'kg',
                recorded_at: record.recorded_at,
                notes: record.notes
              }))}
              groupedRecords={Object.entries(groupedRecords).reduce((acc, [date, dateRecords]) => {
                acc[date] = dateRecords.map(record => ({
                  id: record.id,
                  value: record.value,
                  unit: record.unit || 'kg',
                  recorded_at: record.recorded_at,
                  notes: record.notes
                }));
                return acc;
              }, {} as { [key: string]: DataRecord[] })}
              isLoading={isLoading}
              formatValue={(value) => value.toFixed(1)}
              showSourceTag={true}
              showNotes={true}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
              deletingRecordId={deletingRecordId}
              sectionTitle="记录"
              sectionIcon={<BarChart3 className="w-5 h-5 text-gray-400" />}
              emptyStateTitle="暂无记录"
              emptyStateDescription="请点击右上「+」添加"
              highlightSource={['guide', 'onboarding']}
              defaultSourceToManual={true}
            />

          {/* BMI Section - Always show */}
          <BMICard
            bmiData={bmiData}
            hasData={!!((latestRecord || userProfile?.current_weight) && userProfile?.height)}
          />

        </div>
        
    </DragPanel>

      {/* Weight Entry Modal */}
      <DragPanel show={isModalOpen} onClose={handleCloseModal} zIndex={70} mask={{ visible: true, clickable: true }} maxHeight="70vh" maxWidth="max-w-xs" header={<div className="px-4 py-2 text-center text-sm text-gray-600">{editingRecord ? '编辑体重' : '添加体重'}</div>}>
        <div className="px-5">
          <div className="mb-4">
            <WeightRulerSlider
              value={parseFloat(weightInput) || editingRecord?.value || profileContext?.profile?.current_weight || 60}
              onChange={(newValue) => setWeightInput(newValue.toFixed(1))}
              min={30}
              max={200}
              step={0.1}
            />
          </div>
          <div className="flex space-x-3 pb-4">
            <button onClick={handleCloseModal} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">取消</button>
            <button onClick={handleSaveWeight} className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors text-sm">{editingRecord ? '保存修改' : '保存'}</button>
          </div>
        </div>
      </DragPanel>

      <ConfirmModal
        show={!!deleteConfirmRecord}
        title={deleteConfirmRecord ? `删除体重记录 ${deleteConfirmRecord.value.toFixed(1)}kg` : '删除体重记录'}
        message={deleteConfirmRecord ? new Date(deleteConfirmRecord.recorded_at).toLocaleString('zh-CN') : ''}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
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

export default WeightDetailScreen;
