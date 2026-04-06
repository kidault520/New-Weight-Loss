import React, { useState, useMemo, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import { formatWeekLabel } from '../utils/dateUtils';
import { PeriodSelector } from './common/PeriodSelector'
import { DateNavigator } from './common/DateNavigator'
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import { useMeasurementsRecordsQuery, type MeasurementRecord } from '../hooks/useMeasurementsRecordsQuery'
import { ConfirmModal } from './common/ConfirmModal'
import { AlertDialog } from './common/AlertDialog'
import { useAlert } from '../hooks/useAlert'

interface MeasurementsDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
}

type MeasurementForm = {
  chest: string;
  waist: string;
  upperArm: string;
  hips: string;
  thigh: string;
  calf: string;
};

const FIELD_DEFS: { key: keyof MeasurementForm; label: string; emoji: string }[] = [
  { key: 'chest', label: '胸围', emoji: '👕' },
  { key: 'waist', label: '腰围', emoji: '👖' },
  { key: 'upperArm', label: '上臂围', emoji: '💪' },
  { key: 'hips', label: '臀围', emoji: '🍑' },
  { key: 'thigh', label: '大腿围', emoji: '🦵' },
  { key: 'calf', label: '小腿围', emoji: '🦵' },
];

const emptyForm = (): MeasurementForm => ({
  chest: '',
  waist: '',
  upperArm: '',
  hips: '',
  thigh: '',
  calf: '',
});

const MeasurementsDetailScreen: React.FC<MeasurementsDetailScreenProps> = ({ onClose, selectedDate: initialDate }) => {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedPeriod, setSelectedPeriod] = useState<'天' | '周' | '月' | '年'>('天');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MeasurementRecord | null>(null);
  const [form, setForm] = useState<MeasurementForm>(emptyForm);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<MeasurementRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const { alertState, showError, hideAlert } = useAlert();

  // 计算本周的日期范围（用于记录部分，固定显示本周）
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

  const {
    records: allMeasurementRecords,
    addRecord,
    updateRecord,
    deleteRecord,
    refresh,
    isAdding,
    isUpdating,
  } = useMeasurementsRecordsQuery(currentWeekRange.start, currentWeekRange.end);

  // 获取本周的记录（固定显示，不受周期切换影响）
  const measurementRecords = useMemo(() => {
    return allMeasurementRecords || [];
  }, [allMeasurementRecords]);

  // 从记录中提取测量数据
  const measurementData = useMemo(() => {
    if (measurementRecords && measurementRecords.length > 0) {
      const latestRecord = measurementRecords[0];
      const measurementDataFromDB = latestRecord.measurement_data || {};
      return {
        chest: measurementDataFromDB.chest || null,
        waist: measurementDataFromDB.waist || null,
        upperArm: measurementDataFromDB.upperArm || null,
        hips: measurementDataFromDB.hips || null,
        thigh: measurementDataFromDB.thigh || null,
        calf: measurementDataFromDB.calf || null
      };
    }
    return {
      chest: null,
      waist: null,
      upperArm: null,
      hips: null,
      thigh: null,
      calf: null
    };
  }, [measurementRecords]);

  const formatDate = (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
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
    } catch (error) {
      console.error('Error formatting date:', error);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  // 围度数据 - 从数据库加载的实际值
  const measurements = [
    { name: '胸围', icon: '👕', color: 'text-teal-500', value: measurementData.chest },
    { name: '腰围', icon: '👖', color: 'text-blue-500', value: measurementData.waist },
    { name: '上臂围', icon: '💪', color: 'text-pink-500', value: measurementData.upperArm },
    { name: '臀围', icon: '🍑', color: 'text-purple-500', value: measurementData.hips },
    { name: '大腿围', icon: '🦵', color: 'text-red-500', value: measurementData.thigh },
    { name: '小腿围', icon: '🦵', color: 'text-orange-500', value: measurementData.calf },
  ];

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    
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
    
    setSelectedDate(newDate);
  };

  const openAddModal = useCallback(() => {
    setEditingRecord(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((record: MeasurementRecord) => {
    const d = record.measurement_data || {};
    setEditingRecord(record);
    setForm({
      chest: d.chest != null ? String(d.chest) : '',
      waist: d.waist != null ? String(d.waist) : '',
      upperArm: d.upperArm != null ? String(d.upperArm) : '',
      hips: d.hips != null ? String(d.hips) : '',
      thigh: d.thigh != null ? String(d.thigh) : '',
      calf: d.calf != null ? String(d.calf) : '',
    });
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setForm(emptyForm());
  }, []);

  const parseOptionalCm = (s: string): number | null => {
    const t = s.trim();
    if (t === '') return null;
    const n = parseFloat(t);
    if (Number.isNaN(n) || n <= 0 || n > 300) return null;
    return n;
  };

  const handleSaveMeasurements = async () => {
    const body = {
      chest: parseOptionalCm(form.chest),
      waist: parseOptionalCm(form.waist),
      upperArm: parseOptionalCm(form.upperArm),
      hips: parseOptionalCm(form.hips),
      thigh: parseOptionalCm(form.thigh),
      calf: parseOptionalCm(form.calf),
    };
    const hasAny =
      body.chest != null ||
      body.waist != null ||
      body.upperArm != null ||
      body.hips != null ||
      body.thigh != null ||
      body.calf != null;
    if (!hasAny) {
      showError('请至少填写一项', '围度请填写至少一个有效数值（厘米，1–300）');
      return;
    }

    setIsModalOpen(false);
    const savedForm = { ...form };
    const savedEditing = editingRecord;
    setForm(emptyForm());
    setEditingRecord(null);

    try {
      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

      if (savedEditing) {
        await updateRecord({
          id: savedEditing.id,
          body,
          date: recordDate,
          notes: savedEditing.notes,
        });
      } else {
        await addRecord({ body, date: recordDate });
      }
      await refresh();
    } catch (e) {
      console.error('[Measurements] save failed', e);
      setForm(savedForm);
      setEditingRecord(savedEditing);
      setIsModalOpen(true);
      showError('保存失败', e instanceof Error ? e.message : '请稍后重试');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmRecord) return;
    setDeletingRecordId(deleteConfirmRecord.id);
    const id = deleteConfirmRecord.id;
    setDeleteConfirmRecord(null);
    try {
      await deleteRecord(id);
      await refresh();
    } catch (e) {
      console.error('[Measurements] delete failed', e);
      showError('删除失败', '请稍后重试');
    } finally {
      setDeletingRecordId(null);
    }
  };

  return (
    <>
    <DragPanel show={true} onClose={onClose} zIndex={60} mask={{ visible: false }}
      header={
        <>
          <DetailHeader 
            title="围度记录" 
            leftAction={{ label: '返回', onClick: onClose }} 
            rightAction={{ label: '+', onClick: openAddModal }}
          />
          {/* Period Selector */}
          <div className="bg-gray-50 px-4 pt-2 pb-1">
            <PeriodSelector
              options={['天','周','月','年'].map(l => ({ label: l, value: l }))}
              value={selectedPeriod}
              onChange={(v) => setSelectedPeriod(v as '天'|'周'|'月'|'年')}
            />
          </div>
        </>
      }>
      
      <div className="px-4 space-y-1 flex-1 overflow-y-auto pb-4 scrollbar-hide">
        {/* Charts Section - Only show for non-day periods */}
        {selectedPeriod !== '天' && (
          <SectionCard className="my-1 px-3 py-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">围度统计</h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              多周期趋势图将按真实记录汇总展示，当前版本请在「天」视图查看明细；下方「记录」为本周数据。
            </p>
            <div className="flex items-center justify-center pt-4">
              <DateNavigator
                label={formatDate(selectedDate)}
                onPrev={() => navigateDate('prev')}
                onNext={() => navigateDate('next')}
              />
            </div>
          </SectionCard>
        )}
        
        {/* Measurements Grid - Always show */}
        <SectionCard className="my-1">
          <div className="grid grid-cols-3 gap-6">
            {measurements.map((measurement, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl mb-2">{measurement.icon}</div>
                <div className={`text-sm font-medium mb-1 ${measurement.color}`}>
                  {measurement.name}
                </div>
                <div className={`text-lg font-bold ${measurement.value !== null && measurement.value !== undefined ? 'text-gray-800' : 'text-gray-400'}`}>
                  {measurement.value !== null && measurement.value !== undefined ? measurement.value : '--'}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Records Section - Always show current week records */}
        <SectionCard className="my-1">
            <div className="flex items-center space-x-2 mb-6">
              <BarChart3 className="w-5 h-5 text-gray-400" />
              <span className="text-lg font-medium text-gray-700">记录</span>
            </div>

            {measurementRecords.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-sm">
                  暂无记录，请点击右上「+」添加
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {measurementRecords.map((record: any) => {
                  const recordData = record.measurement_data || {};
                  const recordTime = new Date(record.recorded_at);
                  
                  // 🔥 修复：如果是昨天的记录，显示日期+时间；如果是今天的记录，只显示时间
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const recordDate = new Date(recordTime);
                  recordDate.setHours(0, 0, 0, 0);
                  
                  const isToday = recordDate.getTime() === today.getTime();
                  const isYesterday = recordDate.getTime() === today.getTime() - 24 * 60 * 60 * 1000;
                  
                  let timeDisplay = '';
                  if (isToday) {
                    timeDisplay = recordTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                  } else if (isYesterday) {
                    timeDisplay = `昨天 ${recordTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
                  } else {
                    // 更早的日期，显示完整日期+时间
                    timeDisplay = recordTime.toLocaleString('zh-CN', { 
                      month: '2-digit', 
                      day: '2-digit', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                  }
                  
                  return (
                    <div key={record.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="mb-3">
                          <div className="text-xs text-gray-400 mb-2">
                            {timeDisplay}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {recordData.chest !== null && recordData.chest !== undefined && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">👕</span>
                                <div>
                                  <div className="text-xs text-teal-500">胸围</div>
                                  <div className="text-sm font-bold text-gray-800">{recordData.chest}</div>
                                </div>
                              </div>
                            )}
                            {recordData.waist !== null && recordData.waist !== undefined && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">👖</span>
                                <div>
                                  <div className="text-xs text-blue-500">腰围</div>
                                  <div className="text-sm font-bold text-gray-800">{recordData.waist}</div>
                                </div>
                              </div>
                            )}
                            {recordData.upperArm !== null && recordData.upperArm !== undefined && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">💪</span>
                                <div>
                                  <div className="text-xs text-pink-500">上臂围</div>
                                  <div className="text-sm font-bold text-gray-800">{recordData.upperArm}</div>
                                </div>
                              </div>
                            )}
                            {recordData.hips !== null && recordData.hips !== undefined && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">🍑</span>
                                <div>
                                  <div className="text-xs text-purple-500">臀围</div>
                                  <div className="text-sm font-bold text-gray-800">{recordData.hips}</div>
                                </div>
                              </div>
                            )}
                            {recordData.thigh !== null && recordData.thigh !== undefined && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">🦵</span>
                                <div>
                                  <div className="text-xs text-red-500">大腿围</div>
                                  <div className="text-sm font-bold text-gray-800">{recordData.thigh}</div>
                                </div>
                              </div>
                            )}
                            {recordData.calf !== null && recordData.calf !== undefined && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">🦵</span>
                                <div>
                                  <div className="text-xs text-orange-500">小腿围</div>
                                  <div className="text-sm font-bold text-gray-800">{recordData.calf}</div>
                                </div>
                              </div>
                            )}
                          </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800"
                            onClick={() => openEditModal(record)}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            disabled={deletingRecordId === record.id}
                            className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 disabled:opacity-50"
                            onClick={() => setDeleteConfirmRecord(record)}
                          >
                            删除
                          </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

        {/* Bottom spacing */}
        <div className="h-2"></div>
      </div>
    </DragPanel>

      <DragPanel
        show={isModalOpen}
        onClose={closeModal}
        zIndex={70}
        mask={{ visible: true, clickable: true }}
        maxHeight="85vh"
        maxWidth="max-w-xs"
        header={
          <div className="px-4 py-2 text-center text-sm text-gray-600">
            {editingRecord ? '编辑围度' : '添加围度'}
          </div>
        }
      >
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-500">至少填写一项，单位：厘米（1–300）</p>
          <div className="grid grid-cols-2 gap-3">
            {FIELD_DEFS.map(({ key, label, emoji }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">
                  {emoji} {label}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={300}
                  step={0.1}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder="—"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isAdding || isUpdating}
              onClick={handleSaveMeasurements}
              className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {editingRecord ? '保存' : '添加'}
            </button>
          </div>
        </div>
      </DragPanel>

      <ConfirmModal
        show={!!deleteConfirmRecord}
        title="删除围度记录"
        message={deleteConfirmRecord ? new Date(deleteConfirmRecord.recorded_at).toLocaleString('zh-CN') : ''}
        onCancel={() => setDeleteConfirmRecord(null)}
        onConfirm={confirmDelete}
      />

      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
      />
    </>
  );
};

export default MeasurementsDetailScreen;
