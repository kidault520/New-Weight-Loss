 
import React, { useState, useCallback, useMemo } from 'react';
import { Moon, BarChart3, HelpCircle } from 'lucide-react';
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
import { useSleepRecordsQuery } from '../hooks/useSleepRecordsQuery'
import { useSleepChartData } from '../hooks/useSleepChartData'
import { LineChart } from './common/LineChart'
import { useDetailScreen } from '../hooks/useDetailScreen';

function parseSleepNotesObject(notes?: string | null): Record<string, unknown> | null {
  if (notes == null || typeof notes !== 'string') return null;
  const t = notes.trim();
  if (!t.startsWith('{')) return null;
  try {
    const o = JSON.parse(t) as unknown;
    if (typeof o === 'object' && o !== null && !Array.isArray(o)) return o as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function readPositiveNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function normalizeSleepQuality(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const q = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(q) || q < 0) return 0;
  if (q > 1) return Math.min(1, q / 100);
  return q;
}

function sleepQualityStyle(quality: number): { text: string; className: string } {
  if (quality >= 0.8) return { text: '优秀', className: 'text-green-600' };
  if (quality >= 0.6) return { text: '良好', className: 'text-indigo-500' };
  if (quality >= 0.4) return { text: '一般', className: 'text-yellow-600' };
  if (quality > 0) return { text: '较差', className: 'text-red-600' };
  return { text: '', className: 'text-gray-500' };
}

function formatSleepDurationLine(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m <= 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

interface SleepStageRow {
  label: string;
  hours: number;
  color: string;
}

function buildSleepStageRows(parsed: Record<string, unknown>): SleepStageRow[] {
  const rows: SleepStageRow[] = [];
  const stageObj =
    parsed.stages && typeof parsed.stages === 'object' && !Array.isArray(parsed.stages)
      ? (parsed.stages as Record<string, unknown>)
      : parsed;

  const deep =
    readPositiveNumber(stageObj.deep) ??
    readPositiveNumber(stageObj.deepSleep) ??
    readPositiveNumber(stageObj.deep_sleep);
  const light =
    readPositiveNumber(stageObj.light) ??
    readPositiveNumber(stageObj.lightSleep) ??
    readPositiveNumber(stageObj.light_sleep);
  const rem =
    readPositiveNumber(stageObj.rem) ??
    readPositiveNumber(stageObj.remSleep) ??
    readPositiveNumber(stageObj.rem_sleep);

  if (deep !== undefined) rows.push({ label: '深度睡眠', hours: deep, color: 'bg-purple-400' });
  if (light !== undefined) rows.push({ label: '浅度睡眠', hours: light, color: 'bg-blue-400' });
  if (rem !== undefined) rows.push({ label: 'REM睡眠', hours: rem, color: 'bg-green-400' });
  return rows;
}

interface SleepRecord {
  id: string;
  recorded_at: string | Date;
  value?: number;
  hours?: number;
  notes?: string;
}

interface SleepDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
}

const SleepDetailScreen: React.FC<SleepDetailScreenProps> = ({ onClose, selectedDate: initialDate }) => {
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
  } = useDetailScreen<SleepRecord>({
    initialDate,
    initialPeriod: '天',
  });

  // 业务特定的状态
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepMinutes, setSleepMinutes] = useState(30);

  // Use alert hook
  const { alertState, showError, hideAlert } = useAlert();

  // 计算日期范围（用于useSleepRecordsQuery）
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
    records: sleepRecords, 
    isLoading: isLoadingRecords, 
    addRecord: addRecordAsync, 
    updateRecord: updateRecordAsync,
    deleteRecord: deleteRecordAsync,
    refresh
  } = useSleepRecordsQuery(
    dateRange?.start,
    dateRange?.end
  );

  // 包装异步函数以保持接口兼容
  const addRecord = useCallback(async (data: any) => {
    if (data.value && data.recorded_at) {
      await addRecordAsync({ 
        hours: data.value, 
        date: new Date(data.recorded_at),
        notes: data.notes
      });
    }
  }, [addRecordAsync]);

  const deleteHealthRecord = useCallback(async (id: string) => {
    await deleteRecordAsync(id);
  }, [deleteRecordAsync]);

  // 处理关闭（DragPanel已内置拖拽功能，这里只需要简单的关闭处理）
  const handleClose = () => {
    onClose();
  };


  // Generate chart data based on period
  // 基于日期生成固定种子的随机数函数
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // 获取按日期分组的记录
  const getRecordsByDate = useCallback((date: Date) => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();
    
    return sleepRecords.filter((record: any) => {
      const recordDate = new Date(record.recorded_at);
      const recordYear = recordDate.getFullYear();
      const recordMonth = recordDate.getMonth();
      const recordDay = recordDate.getDate();
      
      return recordYear === targetYear && 
             recordMonth === targetMonth && 
             recordDay === targetDay;
    });
  }, [sleepRecords]);

  // 使用图表数据Hook
  const { chartData } = useSleepChartData({
    records: sleepRecords,
    selectedPeriod,
    currentDate: selectedDate,
    getRecordsByDate,
    formatDate,
  });

  const maxValue = Math.max(...chartData.map(d => d.value), 8);

  // 处理数据点选择
  const handleDataPointSelectInternal = (index: number, x: number, y: number) => {
    setSelectedDataPoint({ index, x, y });
  };

  const handleDataPointDeselect = () => {
    setSelectedDataPoint(null);
  };

  // 获取上一周期的数据用于对比 - 使用固定种子
  const previousPeriodData = useMemo(() => {
    if (selectedPeriod !== '月' && selectedPeriod !== '年') {
      return [];
    }

    const prevDate = new Date(selectedDate);
    if (selectedPeriod === '月') {
      prevDate.setMonth(prevDate.getMonth() - 1);
    } else {
      prevDate.setFullYear(prevDate.getFullYear() - 1);
    }

    const data = [];
    if (selectedPeriod === '月') {
      const daysInMonth = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        if (day % 5 === 0 || day === 1 || day === daysInMonth) {
          // 使用年月日作为种子
          const seed = new Date(prevDate.getFullYear(), prevDate.getMonth(), day).getTime();
          const value = 6 + seededRandom(seed) * 2;
          data.push({ label: String(day), value: parseFloat(value.toFixed(1)) });
        }
      }
    } else {
      const year = prevDate.getFullYear();
      for (let month = 0; month < 12; month++) {
        // 使用年月作为种子
        const seed = new Date(year, month, 1).getTime();
        const value = 6 + seededRandom(seed) * 2;
        data.push({ label: `${month + 1}月`, value: parseFloat(value.toFixed(1)) });
      }
    }
    return data;
  }, [selectedPeriod, selectedDate]);

  // 获取本周的记录（固定显示，不受周期切换影响）
  const currentWeekRecords = useMemo(() => {
    return getCurrentWeekRecords(sleepRecords);
  }, [sleepRecords, getCurrentWeekRecords]);

  // 按日期分组本周的记录
  const groupedRecords = useMemo(() => {
    return groupRecordsByDate(currentWeekRecords);
  }, [currentWeekRecords, groupRecordsByDate]);

  const daySleepPrimary = useMemo(() => {
    const list = getRecordsByDate(selectedDate);
    if (list.length === 0) return null;
    return [...list].sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    )[0];
  }, [getRecordsByDate, selectedDate]);

  const daySleepSummary = useMemo(() => {
    if (!daySleepPrimary) {
      return {
        hasRecord: false as const,
        durationHours: 0,
        quality: 0,
        bedTime: '--:--',
        wakeTime: '--:--',
        stageRows: [] as SleepStageRow[],
      };
    }
    const rec = daySleepPrimary as SleepRecord & { hours?: number };
    const valueH = Number(rec.value ?? rec.hours ?? 0) || 0;
    const parsed = parseSleepNotesObject(rec.notes);
    const durFromNotes = parsed ? readPositiveNumber(parsed.duration) : undefined;
    const durationHours = durFromNotes !== undefined ? durFromNotes : valueH;
    const quality = parsed ? normalizeSleepQuality(parsed.quality) : 0;
    let bedTime = '--:--';
    let wakeTime = '--:--';
    if (parsed) {
      if (typeof parsed.bedTime === 'string' && parsed.bedTime.trim()) bedTime = parsed.bedTime.trim();
      if (typeof parsed.wakeTime === 'string' && parsed.wakeTime.trim()) wakeTime = parsed.wakeTime.trim();
    }
    const stageRows = parsed ? buildSleepStageRows(parsed) : [];
    return {
      hasRecord: true as const,
      durationHours,
      quality,
      bedTime,
      wakeTime,
      stageRows,
    };
  }, [daySleepPrimary]);

  const handleSleepAdd = async () => {
    // 立即关闭弹窗，提供即时反馈
    setShowSleepModal(false);
    const savedSleepHours = sleepHours;
    const savedSleepMinutes = sleepMinutes;
    const savedEditingRecord = editingRecord;
    setSleepHours(7);
    setSleepMinutes(30);
    setEditingRecord(null);

    try {
      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      const sleepValue = savedSleepHours + savedSleepMinutes / 60;
      
      if (savedEditingRecord) {
        await updateRecordAsync({
          id: savedEditingRecord.id,
          hours: sleepValue,
          date: recordDate,
          notes: savedEditingRecord.notes ?? '手动记录',
        });
      } else {
        await addRecord({
          value: sleepValue,
          unit: '小时',
          notes: '手动记录',
          recorded_at: recordDate.toISOString()
        });
      }
      await refresh();
      // ✅ Dashboard 数据现在通过 React Query 自动刷新（invalidateQueries）
    } catch (error) {
      console.error('Failed to save sleep record:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      // 保存失败时恢复状态并重新打开弹窗
      setSleepHours(savedSleepHours);
      setSleepMinutes(savedSleepMinutes);
      setEditingRecord(savedEditingRecord);
      setShowSleepModal(true);
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  // 处理编辑记录
  const handleEditRecord = (record: any) => {
    const totalMinutes = Math.round(record.value * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setEditingRecord(record);
    setSleepHours(hours);
    setSleepMinutes(minutes);
    setShowSleepModal(true);
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
      console.error('Failed to delete sleep record:', error);
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
            <DetailHeader title={"睡眠记录"} leftAction={{ label: '返回', onClick: handleClose }} rightAction={{ label: '+', onClick: () => setShowSleepModal(true) }} />
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

          {selectedPeriod === '天' && (
            <DateNavigator
              label={formatDate(selectedDate)}
              onPrev={() => navigateDate('prev')}
              onNext={() => navigateDate('next')}
              className="my-2"
            />
          )}

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
                  <span>{maxValue.toFixed(1)}h</span>
                  <span>{(maxValue / 2).toFixed(1)}h</span>
                  <span>0h</span>
                </div>
                
                {/* Chart area with line graph */}
                <div className="ml-8 h-full relative">
                  <LineChart
                    data={chartData}
                    selectedDataPoint={selectedDataPoint}
                    onDataPointSelectInternal={handleDataPointSelectInternal}
                    onDataPointDeselect={handleDataPointDeselect}
                    unit="小时"
                    maxValue={maxValue}
                    strokeColor="#6366f1"
                    pointColor="#6366f1"
                    showNormalRange={true}
                    normalRangeTop="20%"
                    normalRangeHeight="50%"
                    normalRangeColor="#fef3c7"
                    formatValue={(value) => `${value.toFixed(1)}小时`}
                    formatTime={(time) => time}
                  />
                </div>
              </div>
              
              {/* X-axis labels */}
              <div className="ml-8 flex justify-between text-xs text-gray-500 mt-2">
                {chartData.map((item, index) => {
                  const shouldShow = selectedPeriod === '月' 
                    ? (index % 5 === 0 || index === chartData.length - 1)
                    : selectedPeriod === '年'
                    ? (index % 2 === 0 || index === chartData.length - 1)
                    : true;
                  
                  return shouldShow && item.label ? (
                    <span key={index} className="flex-1 text-center">{item.label}</span>
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
              {(selectedPeriod === '月' || selectedPeriod === '年') && showDataAnalysis && chartData.length > 0 && (
                <div className="mt-4">
                  <DataAnalysisCard
                    currentData={chartData}
                    previousData={previousPeriodData}
                    dataType="sleep"
                    period={selectedPeriod === '月' ? '月' : '年'}
                    valueKey="value"
                  />
                </div>
              )}
            </SectionCard>
          )}

          {/* 所选日期的睡眠摘要（与 health_records 一致，无记录时不展示假数据） */}
          <SectionCard className="my-1">
            <div className="flex items-center space-x-2 mb-4">
              <Moon className="w-5 h-5 text-indigo-500" />
              <span className="text-lg font-medium text-gray-700">
                {formatDate(selectedDate)} 睡眠
              </span>
            </div>

            {isLoadingRecords ? (
              <div className="text-center text-gray-500 text-sm py-8">加载中…</div>
            ) : !daySleepSummary.hasRecord ? (
              <div className="text-center text-gray-500 text-sm py-8">
                所选日期暂无睡眠记录，请点击右上「+」添加
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-indigo-600 mb-2">
                    {formatSleepDurationLine(daySleepSummary.durationHours)}
                  </div>
                  {daySleepSummary.quality > 0 ? (
                    <div className={`text-sm font-medium ${sleepQualityStyle(daySleepSummary.quality).className}`}>
                      睡眠质量: {sleepQualityStyle(daySleepSummary.quality).text}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">未标注睡眠质量（设备 JSON 含 quality 时可显示）</div>
                  )}
                </div>

                {daySleepSummary.bedTime !== '--:--' || daySleepSummary.wakeTime !== '--:--' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-3 text-center">
                      <div className="text-sm text-gray-500 mb-1">入睡时间</div>
                      <div className="text-lg font-bold text-gray-800">{daySleepSummary.bedTime}</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <div className="text-sm text-gray-500 mb-1">起床时间</div>
                      <div className="text-lg font-bold text-gray-800">{daySleepSummary.wakeTime}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm pb-2">
                    入睡/起床时间未记录（设备同步的 notes JSON 含 bedTime、wakeTime 时可显示）
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* 睡眠阶段：仅当 notes JSON 中含阶段字段时展示，避免伪造 */}
          {daySleepSummary.hasRecord && daySleepSummary.stageRows.length > 0 && (
            <SectionCard className="my-1">
              <h3 className="text-lg font-medium text-gray-700 mb-4">睡眠阶段</h3>
              <div className="space-y-3">
                {daySleepSummary.stageRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 ${row.color} rounded-full`} />
                      <span className="text-sm text-gray-600">{row.label}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {formatSleepDurationLine(row.hours)}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Sleep History - Always show current week records */}
          <DataRecordList
              records={Object.values(groupedRecords).flat().map((record: SleepRecord) => ({
                id: record.id,
                value: record.value || record.hours || 0,
                unit: '',
              recorded_at: typeof record.recorded_at === 'string' ? record.recorded_at : record.recorded_at.toISOString(),
                notes: record.notes
              }))}
              groupedRecords={Object.entries(groupedRecords).reduce((acc, [date, dateRecords]) => {
                acc[date] = dateRecords.map((record: SleepRecord) => ({
                  id: record.id,
                  value: record.value || record.hours || 0,
                  unit: '',
                recorded_at: typeof record.recorded_at === 'string' ? record.recorded_at : record.recorded_at.toISOString(),
                  notes: record.notes
                }));
                return acc;
              }, {} as { [key: string]: DataRecord[] })}
              isLoading={isLoadingRecords}
              formatValue={(value) => {
                const totalMinutes = Math.round(value * 60);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
              }}
              valueClassName="text-lg font-semibold text-gray-800 whitespace-nowrap"
              showSourceTag={true}
              showNotes={true}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
              deletingRecordId={deletingRecordId}
              sectionTitle="睡眠历史"
              sectionIcon={<BarChart3 className="w-4 h-4 text-indigo-500" />}
              emptyStateTitle="暂无记录"
              emptyStateDescription={
                selectedPeriod === '天'
                  ? `${formatDate(selectedDate)} 暂无记录，请点击右上「+」添加`
                  : '本周暂无记录，请点击右上「+」添加'
              }
              groupByDate={selectedPeriod === '周'}
              defaultSourceToManual={true}
            />

        </div>
    </DragPanel>

      {/* Sleep Recording Modal */}
      <DragPanel show={showSleepModal} onClose={() => { setShowSleepModal(false); setEditingRecord(null); setSleepHours(7); setSleepMinutes(30); }} zIndex={70} mask={{ visible: true, clickable: true }} maxHeight="70vh" maxWidth="max-w-xs" header={<div className="px-4 py-2 text-center text-sm text-gray-600">{editingRecord ? '编辑睡眠记录' : '添加睡眠记录'}</div>}>
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-indigo-500">{sleepHours}</span>
              <span className="text-lg text-gray-600">小时</span>
              <span className="text-xl font-bold text-indigo-500">{sleepMinutes}</span>
              <span className="text-lg text-gray-600">分钟</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">小时</label>
                <div className="grid grid-cols-4 gap-2">
                  {[6, 7, 8, 9].map((hour) => (
                    <button key={hour} onClick={() => setSleepHours(hour)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${sleepHours === hour ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{hour}</button>
                  ))}
                </div>
                <input type="number" min="0" max="24" value={sleepHours} onChange={(e) => setSleepHours(parseInt(e.target.value, 10) || 0)} className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">分钟</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 15, 30, 45].map((minute) => (
                    <button key={minute} onClick={() => setSleepMinutes(minute)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${sleepMinutes === minute ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{minute}</button>
                  ))}
                </div>
                <input type="number" min="0" max="59" value={sleepMinutes} onChange={(e) => setSleepMinutes(parseInt(e.target.value, 10) || 0)} className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button onClick={() => { setShowSleepModal(false); setEditingRecord(null); setSleepHours(7); setSleepMinutes(30); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">取消</button>
            <button onClick={handleSleepAdd} className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors text-sm">{editingRecord ? '保存' : '添加'}</button>
          </div>
        </div>
      </DragPanel>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteConfirmRecord}
        title="确认删除"
        message={(() => {
          if (!deleteConfirmRecord) return '';
          const totalHours = deleteConfirmRecord.value ?? deleteConfirmRecord.hours ?? 0;
          const hours = Math.floor(totalHours);
          const minutes = Math.round((totalHours % 1) * 60);
          return `确定要删除这条 ${hours} 小时 ${minutes} 分钟 的睡眠记录吗？`;
        })()}
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

export default SleepDetailScreen;
