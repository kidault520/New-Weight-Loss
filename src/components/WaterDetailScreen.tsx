import React, { useState, useMemo } from 'react';
import { Droplets, BarChart3, Edit3, HelpCircle } from 'lucide-react';
import { useWaterRecords, WaterRecord } from '../hooks/useWaterRecords';
import { useUserProfile } from '../contexts/UserProfileContext';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import { PeriodSelector } from './common/PeriodSelector'
import { DateNavigator } from './common/DateNavigator'
import { ConfirmModal } from './common/ConfirmModal'
import { AlertDialog } from './common/AlertDialog';
import { DataAnalysisCard } from './common/DataAnalysisCard';
import { DataRecordList } from './features/DataRecordList';
import { type DataRecord } from './features/DataRecordCard';
import { useAlert } from '../hooks/useAlert';
import { useWaterChartData } from '../hooks/useWaterChartData';
import { LineChart } from './common/LineChart';
import { useDetailScreen } from '../hooks/useDetailScreen';

interface WaterDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
}

const WaterDetailScreen: React.FC<WaterDetailScreenProps> = ({ onClose, selectedDate: initialDate }) => {
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
  } = useDetailScreen<WaterRecord>({
    initialDate,
    initialPeriod: '天',
  });

  // 业务特定的状态
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [waterAmount, setWaterAmount] = useState(250);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<number>(2500);
  
  // Use alert hook
  const { alertState, showError, hideAlert } = useAlert();
  
  const { records, isLoading, addRecord, updateRecord, deleteRecord, getRecordsByDate, refreshRecords } = useWaterRecords();
  const { profile, updateProfile } = useUserProfile();
  
  // 从用户配置获取目标值，如果没有则使用默认值2500ml
  const targetAmount = profile?.water_intake || 2500;
  
  // 获取当前选中日期的记录（包含所有记录：AI和手动）
  const dayRecords = useMemo(() => {
    return getRecordsByDate(selectedDate);
  }, [selectedDate, getRecordsByDate]);
  
  // 汇总合计包含所有记录（AI和手动）
  const totalAmount = useMemo(() => {
    if (!dayRecords || dayRecords.length === 0) {
      return 0;
    }
    const sum = dayRecords.reduce((total, record) => {
      const value = Number(record.value) || 0;
      return total + value;
    }, 0);
    return sum;
  }, [dayRecords]);

  // 获取本周的记录（固定显示，不受周期切换影响）
  const currentWeekRecords = useMemo(() => {
    return getCurrentWeekRecords(records);
  }, [records, getCurrentWeekRecords]);

  // 按日期分组本周的记录
  const groupedRecords = useMemo(() => {
    return groupRecordsByDate(currentWeekRecords);
  }, [currentWeekRecords, groupRecordsByDate]);

  // 处理关闭（DragPanel已内置拖拽功能，这里只需要简单的关闭处理）
  const handleClose = () => {
    onClose();
  };

  // 处理添加/编辑饮水记录
  const handleWaterAdd = async () => {
    // 立即关闭弹窗，提供即时反馈
    setShowWaterModal(false);
    const savedWaterAmount = waterAmount;
    const savedEditingRecord = editingRecord;
    setWaterAmount(250);
    setEditingRecord(null);

    try {
      // 使用当前时间，但日期部分使用selectedDate
      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      if (savedEditingRecord) {
        await updateRecord(
          savedEditingRecord.id,
          savedWaterAmount,
          recordDate,
          savedEditingRecord.notes
        );
      } else {
        // 乐观更新：立即显示，后台同步
        await addRecord(savedWaterAmount, recordDate);
      }
      await refreshRecords();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to save water record:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      // 保存失败时恢复状态并重新打开弹窗
      setWaterAmount(savedWaterAmount);
      setEditingRecord(savedEditingRecord);
      setShowWaterModal(true);
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  // 处理编辑记录
  const handleEditRecord = (record: WaterRecord) => {
    setEditingRecord(record);
    setWaterAmount(record.value);
    setShowWaterModal(true);
  };

  // 处理删除记录
  const handleDeleteRecord = (record: WaterRecord) => {
    setDeleteConfirmRecord(record);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmRecord) return;

    setDeletingRecordId(deleteConfirmRecord.id);
    const recordIdToDelete = deleteConfirmRecord.id;
    setDeleteConfirmRecord(null);

    try {
      // 乐观更新：立即从 UI 移除，后台同步
      await deleteRecord(recordIdToDelete);
      await refreshRecords();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to delete water record:', error);
      showError('删除失败', '删除失败，请重试');
    } finally {
      setDeletingRecordId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmRecord(null);
  };

  // 处理编辑目标
  const handleEditTarget = () => {
    setEditingTarget(targetAmount);
    setShowTargetModal(true);
  };

  // 保存目标
  const handleSaveTarget = async () => {
    try {
      await updateProfile({ water_intake: editingTarget });
      setShowTargetModal(false);
      // React Query 会自动处理数据更新，无需派发事件
    } catch (error) {
      console.error('Failed to update water target:', error);
      showError('保存失败', '保存失败，请重试');
    }
  };

  // 使用图表数据Hook
  const { chartData: chartDataRaw, previousPeriodData } = useWaterChartData({
    records,
    selectedPeriod,
    selectedDate,
    getRecordsByDate,
  });

  // 转换数据格式以适配LineChart（amount -> value）
  const chartData = useMemo(() => {
    return chartDataRaw.map(item => ({
      ...item,
      value: item.value,
    }));
  }, [chartDataRaw]);

  const maxAmount = Math.max(...chartData.map(d => d.value), targetAmount);
  // 进度计算：允许超过100%
  const progress = targetAmount > 0 ? (totalAmount / targetAmount) * 100 : 0;

  // 处理数据点选择
  const handleDataPointSelectInternal = (index: number, x: number, y: number) => {
    setSelectedDataPoint({ index, x, y });
  };

  const handleDataPointDeselect = () => {
    setSelectedDataPoint(null);
  };

  return (
    <>
    <DragPanel show={true} onClose={handleClose} zIndex={60} mask={{ visible: false }}
      header={
        <>
          <DetailHeader title={"喝水"} leftAction={{ label: '返回', onClick: handleClose }} rightAction={{ label: '+', onClick: () => setShowWaterModal(true) }} />
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
            <div className="relative h-40 mb-2">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 flex flex-col justify-between h-full text-xs text-gray-400">
                <span>{Math.round(maxAmount)}</span>
                <span>{Math.round(maxAmount * 0.5)}</span>
                <span>0</span>
              </div>
              
              {/* Chart area with line graph */}
              <div className="ml-8 h-full relative">
                <LineChart
                  data={chartData}
                  selectedDataPoint={selectedDataPoint}
                  onDataPointSelectInternal={handleDataPointSelectInternal}
                  onDataPointDeselect={handleDataPointDeselect}
                  unit="ml"
                  maxValue={maxAmount}
                  strokeColor="#3b82f6"
                  pointColor="#3b82f6"
                  showNormalRange={selectedPeriod !== '天'}
                  normalRangeTop="20%"
                  normalRangeHeight="60%"
                  normalRangeColor="#fef3c7"
                  formatValue={(value) => `${value}ml`}
                  formatTime={(time) => time || ''}
                />
              </div>
            </div>
            
            {/* X-axis labels */}
            <div className="ml-8 flex justify-between text-xs text-gray-500 mt-2">
              {chartData.map((item, index) => {
                const shouldShow = selectedPeriod === '月' 
                  ? (index === 0 || (index + 1) % 5 === 0 || index === chartData.length - 1)
                  : selectedPeriod === '天'
                  ? true // 天视图显示所有时间点
                  : true;
                
                // 天视图显示时间，其他视图显示日期（不显示时间）
                const label = selectedPeriod === '天' ? (item.time || item.date) : item.date;
                
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
                  currentData={chartData}
                  previousData={previousPeriodData}
                  dataType="water"
                  period={selectedPeriod === '月' ? '月' : '年'}
                  valueKey="value"
                />
              </div>
            )}
          </SectionCard>

          {/* Goal Progress Section - Always show */}
          <SectionCard className="my-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-lg font-medium text-gray-700">目标</span>
                </div>
                <span className="text-sm text-blue-500">进度 {Math.round(progress)}%</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-gray-600 text-sm">我的饮水量</span>
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    {totalAmount}ml
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-gray-600 text-sm">目标</span>
                    <button
                      onClick={handleEditTarget}
                      className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                    >
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                  <div className="text-xl font-bold text-gray-800">{targetAmount}ml</div>
                </div>
              </div>
            </SectionCard>

          {/* Records Section - Always show current week records */}
          <DataRecordList
              records={Object.values(groupedRecords).flat().map(record => ({
                id: record.id,
                value: record.value,
                unit: 'ml',
                recorded_at: record.recorded_at,
                notes: record.notes
              }))}
              groupedRecords={Object.entries(groupedRecords).reduce((acc, [date, dateRecords]) => {
                acc[date] = dateRecords.map(record => ({
                  id: record.id,
                  value: record.value,
                  unit: 'ml',
                  recorded_at: record.recorded_at,
                  notes: record.notes
                }));
                return acc;
              }, {} as { [key: string]: DataRecord[] })}
              isLoading={isLoading}
              formatValue={(value) => value}
              showSourceTag={true}
              showNotes={true}
              onEdit={(record) => {
                const waterRecord = records.find(r => r.id === record.id);
                if (waterRecord) handleEditRecord(waterRecord);
              }}
              onDelete={(record) => {
                const waterRecord = records.find(r => r.id === record.id);
                if (waterRecord) handleDeleteRecord(waterRecord);
              }}
              deletingRecordId={deletingRecordId}
              sectionTitle="记录"
              sectionIcon={<BarChart3 className="w-4 h-4 text-blue-500" />}
              emptyStateTitle="暂无记录"
              emptyStateDescription="今日暂无记录，请点击右上「+」添加"
              groupByDate={true}
              defaultSourceToManual={false}
            />

          {/* Bottom spacing */}
          <div className="h-2"></div>
        </div>
    </DragPanel>

      {/* Water Recording Modal */}
      <DragPanel show={showWaterModal} onClose={() => setShowWaterModal(false)} zIndex={70} mask={{ visible: true, clickable: true }} maxHeight="70vh" maxWidth="max-w-xs" header={<div className="px-4 py-2 text-center text-sm text-gray-600">{editingRecord ? '编辑饮水记录' : '添加饮水'}</div>}>
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-blue-500">{waterAmount}</span>
              <span className="text-lg text-gray-600">ml</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[100, 200, 250, 500].map((amount) => (
                <button key={amount} onClick={() => setWaterAmount(amount)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${waterAmount === amount ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{amount}ml</button>
              ))}
            </div>
            <div className="text-center text-sm text-gray-500">今日已饮水: {totalAmount}ml / {targetAmount}ml</div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button onClick={() => { setShowWaterModal(false); setEditingRecord(null); setWaterAmount(250); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">取消</button>
            <button onClick={handleWaterAdd} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors text-sm">{editingRecord ? '保存' : '添加'}</button>
          </div>
        </div>
      </DragPanel>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteConfirmRecord}
        title="确认删除"
        message={deleteConfirmRecord ? `确定要删除这条 ${deleteConfirmRecord.value}ml 的饮水记录吗？` : ''}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        zIndex={80}
      />

      {/* Edit Target Modal */}
      <DragPanel show={showTargetModal} onClose={() => setShowTargetModal(false)} zIndex={80} mask={{ visible: true, clickable: true }} maxHeight="70vh" maxWidth="max-w-xs" header={<div className="px-4 py-2 text-center text-sm text-gray-600">编辑目标</div>}>
        <div className="px-5 pb-4">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-blue-500">{editingTarget}</span>
              <span className="text-lg text-gray-600">ml</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[1500, 2000, 2500, 3000].map((amount) => (
                <button key={amount} onClick={() => setEditingTarget(amount)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${editingTarget === amount ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{amount}ml</button>
              ))}
            </div>
            <div className="mb-3">
              <input type="number" min="500" max="5000" step="100" value={editingTarget} onChange={(e) => setEditingTarget(parseInt(e.target.value, 10) || 2500)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setShowTargetModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">取消</button>
            <button onClick={handleSaveTarget} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors text-sm">保存</button>
          </div>
        </div>
      </DragPanel>

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

export default WaterDetailScreen;
