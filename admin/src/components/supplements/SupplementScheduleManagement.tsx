import { useEffect, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { apiClient } from '../../config/api';
import SearchableSelect from '../common/SearchableSelect';

interface Stage {
  stage_name: string;
  duration_days: number;
  supplement_id?: string;
  per_day_qty?: number;
}

interface Supplement {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
  duration_days: number;
}

export default function SupplementScheduleManagement() {
  const [showForm, setShowForm] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [totalDays, setTotalDays] = useState(0);
  const [stages, setStages] = useState<Stage[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);

  useEffect(() => {
    loadCourses();
    loadSupplements();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await apiClient.get<{ plans: any[] }>('/api/admin/menu/supplement-plans?is_active=true&limit=1000');
      const mapped = (data.plans || []).map(p => ({ id: p.id, name: p.plan_name, duration_days: p.duration_days }));
      setCourses(mapped);
    } catch {}
  };

  // 选择补剂数据来源：补剂产品（supplement_products 表）
  const loadSupplements = async () => {
    try {
      const data = await apiClient.get<{ supplements: any[] }>('/api/admin/content/supplements?limit=1000');
      const mapped = (data.supplements || []).map(s => ({ id: s.id, name: s.name }));
      setSupplements(mapped);
    } catch {}
  };

  useEffect(() => {
    const course = courses.find(c => c.id === selectedCourseId);
    setTotalDays(course ? course.duration_days : 0);
  }, [selectedCourseId, courses]);

  const addStageRow = () => {
    setStages([...stages, { stage_name: '', duration_days: 1, supplement_id: undefined, per_day_qty: 1 }]);
  };

  const updateStage = (index: number, field: keyof Stage, value: any) => {
    const next = [...stages];
    if (field === 'duration_days') {
      const num = Math.max(1, parseInt(String(value)) || 1);
      const othersSum = next.reduce((acc, s, i) => (i === index ? acc : acc + (s.duration_days || 0)), 0);
      const maxAllowed = Math.max(1, (totalDays || 0) - othersSum);
      (next[index] as any)[field] = Math.min(num, maxAllowed);
    } else {
      (next[index] as any)[field] = value;
    }
    setStages(next);
  };

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const saveSchedule = async () => {
    const validStages = stages.filter(s => s.stage_name && s.duration_days >= 1 && s.supplement_id && (s.per_day_qty ?? 1) >= 1);
    if (!selectedCourseId || totalDays < 1) { alert('请选择补剂疗程'); return; }
    const sumDays = validStages.reduce((acc, s) => acc + (s.duration_days || 0), 0);
    if (sumDays > totalDays) { alert(`阶段持续天数之和(${sumDays})不能超过疗程总天数(${totalDays})`); return; }
    if (sumDays !== totalDays) { alert(`阶段持续天数之和(${sumDays})需等于疗程总天数(${totalDays})`); return; }
    if (validStages.length === 0) { alert('请至少添加一个有效阶段'); return; }
    try {
      await apiClient.post('/api/admin/menu/supplement-schedules', {
        schedule_name: courses.find(c => c.id === selectedCourseId)?.name,
        total_days: totalDays,
        stages: validStages
      });
      alert('补剂排期已保存');
      setShowForm(false);
      setSelectedCourseId('');
      setTotalDays(0);
      setStages([]);
    } catch (e: any) {
      alert(e?.response?.data?.error || '保存失败');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedCourseId('');
    setTotalDays(0);
    setStages([]);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">补剂排期</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加补剂排期
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">添加补剂排期</h3>
            <button type="button" onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">选择补剂疗程</label>
                <SearchableSelect
                  value={selectedCourseId}
                  onChange={(value) => setSelectedCourseId(value)}
                  options={[
                    { value: '', label: '请选择补剂疗程' },
                    ...courses.map((c) => ({ value: c.id, label: `${c.name} (${c.duration_days}天)`, keywords: [c.name, String(c.duration_days)] })),
                  ]}
                  placeholder="请选择补剂疗程"
                  searchPlaceholder="输入疗程名称模糊搜索"
                  emptyText="没有匹配疗程"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">总天数</label>
                <input
                  type="number"
                  min={1}
                  value={totalDays}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 w-full">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">添加阶段</h4>
                <button
                  type="button"
                  onClick={addStageRow}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" /> 添加
                </button>
              </div>

              <div className="space-y-3 w-full">
                {stages.length > 0 && totalDays > 0 && (() => {
                  const sumDays = stages.reduce((a, s) => a + (s.duration_days || 0), 0);
                  return (
                    <div className="flex items-center gap-2 py-1 text-sm">
                      <span className="text-gray-600">阶段天数合计：</span>
                      <span className={`font-medium ${sumDays === totalDays ? 'text-green-600' : 'text-amber-600'}`}>
                        {sumDays}
                      </span>
                      <span className="text-gray-500">/ 总天数：{totalDays}</span>
                      {sumDays !== totalDays && (
                        <span className="text-amber-600 text-xs">（需等于总天数）</span>
                      )}
                    </div>
                  );
                })()}
                {stages.map((stage, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_2fr_1fr_auto] gap-6 p-4 bg-white border border-gray-200 rounded-lg w-full items-end">
                    <div className="min-w-0">
                      <label className="block text-xs font-medium mb-1">阶段名称</label>
                      <input
                        value={stage.stage_name}
                        onChange={(e) => updateStage(i, 'stage_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="阶段名称"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-medium mb-1">持续天数（天）</label>
                      <input
                        type="number"
                        min={1}
                        max={totalDays || 999}
                        value={stage.duration_days}
                        onChange={(e) => updateStage(i, 'duration_days', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="1"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-medium mb-1">选择补剂</label>
                      <SearchableSelect
                        value={stage.supplement_id || ''}
                        onChange={(value) => updateStage(i, 'supplement_id', value || undefined)}
                        options={[
                          { value: '', label: '选择补剂' },
                          ...supplements.map((s) => ({ value: s.id, label: s.name, keywords: [s.name, s.id] })),
                        ]}
                        placeholder="选择补剂"
                        searchPlaceholder="输入补剂名称模糊搜索"
                        emptyText="没有匹配补剂"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-medium mb-1">一天颗数</label>
                      <input
                        type="number"
                        min={1}
                        value={stage.per_day_qty ?? 1}
                        onChange={(e) => updateStage(i, 'per_day_qty', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="1"
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => removeStage(i)}
                        className="p-2 text-red-600 hover:text-red-800"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {stages.length === 0 && (
                <p className="text-sm text-gray-500 py-2">点击「添加」按钮添加阶段</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={saveSchedule}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
