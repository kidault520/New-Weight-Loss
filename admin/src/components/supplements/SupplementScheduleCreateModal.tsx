import { useEffect, useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { apiClient } from '../../config/api';
import SearchableSelect from '../common/SearchableSelect';
import ListPagination from '../common/ListPagination';

export default function SupplementScheduleCreateModal({ onClose }: { onClose: () => void }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState('');
  const [totalDays, setTotalDays] = useState(0);
  const [supplements, setSupplements] = useState<any[]>([]);
  const [stages, setStages] = useState<Array<{ stage_name: string; duration_days: number; supplement_id?: string; per_day_qty?: number }>>([]);
  const [stageName, setStageName] = useState('');
  const [stageDays, setStageDays] = useState(1);
  const [stageSuppId, setStageSuppId] = useState('');
  const [perDayQty, setPerDayQty] = useState(1);
  const [stagePage, setStagePage] = useState(1);
  const [stageLimit, setStageLimit] = useState(10);

  useEffect(() => {
    loadCourses();
    loadSupplements();
  }, []);

  useEffect(() => {
    const c = courses.find((x) => x.id === courseId);
    setTotalDays(c ? c.duration_days : 0);
  }, [courseId, courses]);

  const loadCourses = async () => {
    const data = await apiClient.get<{ plans: any[] }>('/api/admin/menu/supplement-plans?is_active=true&limit=1000');
    setCourses(data.plans || []);
  };

  const loadSupplements = async () => {
    const data = await apiClient.get<{ supplements: any[] }>('/api/admin/content/supplements?limit=1000');
    setSupplements(data.supplements || []);
  };

  const addStage = () => {
    if (!stageName || stageDays < 1) return;
    setStages([...stages, { stage_name: stageName, duration_days: stageDays, supplement_id: stageSuppId || undefined, per_day_qty: perDayQty || undefined }]);
    setStageName('');
    setStageDays(1);
    setStageSuppId('');
    setPerDayQty(1);
  };

  const stageTotal = stages.length;
  const stageTotalPages = Math.max(1, Math.ceil(stageTotal / stageLimit));
  const paginatedStages = useMemo(() => {
    const start = (stagePage - 1) * stageLimit;
    return stages.slice(start, start + stageLimit);
  }, [stages, stagePage, stageLimit]);

  useEffect(() => {
    if (stagePage > stageTotalPages) setStagePage(stageTotalPages);
  }, [stagePage, stageTotalPages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) { alert('请选择补剂疗程'); return; }
    const sumDays = stages.reduce((acc, s) => acc + (s.duration_days || 0), 0);
    if (sumDays !== totalDays) { alert(`阶段持续天数之和(${sumDays})需等于疗程总天数(${totalDays})`); return; }
    try {
      await apiClient.post('/api/admin/menu/supplement-schedules', { schedule_name: courses.find(c => c.id === courseId)?.plan_name, total_days: totalDays, stages });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || '创建失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">添加补剂排期</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">补剂疗程</label>
            <SearchableSelect
              value={courseId}
              onChange={(value) => setCourseId(value)}
              options={[
                { value: '', label: '请选择补剂疗程' },
                ...courses.map((c) => ({
                  value: c.id,
                  label: c.plan_code
                    ? `${c.plan_code} · ${c.plan_name} (${c.duration_days}天)`
                    : `${c.plan_name} (${c.duration_days}天)`,
                  keywords: [c.plan_name, c.plan_code || '', String(c.duration_days)],
                })),
              ]}
              placeholder="请选择补剂疗程"
              searchPlaceholder="输入疗程名称模糊搜索"
              emptyText="没有匹配疗程"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">总天数</label>
            <input value={totalDays} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600" />
          </div>
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">添加阶段</h4>
            <div className="grid grid-cols-5 gap-2">
              <input value={stageName} onChange={(e) => setStageName(e.target.value)} className="px-3 py-2 border rounded" placeholder="阶段名称" />
              <input type="number" min={1} value={stageDays} onChange={(e) => setStageDays(parseInt(e.target.value) || 1)} className="px-3 py-2 border rounded" placeholder="持续天数（天）" />
              <SearchableSelect
                value={stageSuppId}
                onChange={(value) => setStageSuppId(value)}
                options={[
                  { value: '', label: '选择补剂' },
                  ...supplements.map((s) => ({
                    value: s.id,
                    label: s.item_code ? `${s.item_code} · ${s.name}` : s.name,
                    keywords: [s.name, s.id, s.item_code || ''].filter(Boolean),
                  })),
                ]}
                placeholder="选择补剂"
                searchPlaceholder="输入补剂名称模糊搜索"
                emptyText="没有匹配补剂"
              />
              <input type="number" min={1} value={perDayQty} onChange={(e) => setPerDayQty(parseInt(e.target.value) || 1)} className="px-3 py-2 border rounded" placeholder="一天颗数" />
              <button type="button" onClick={addStage} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <Plus className="w-4 h-4 inline mr-1" /> 添加
              </button>
            </div>
            {stages.length > 0 && (
              <div className="mt-3 space-y-1">
                {paginatedStages.map((s, i) => {
                  const actualIndex = (stagePage - 1) * stageLimit + i;
                  return (
                  <div key={i} className="flex items-center justify-between p-2 border rounded">
                    <span>{s.stage_name}（{s.duration_days} 天）</span>
                    <button type="button" className="text-red-600" onClick={() => setStages(stages.filter((_, idx) => idx !== actualIndex))}>删除</button>
                  </div>
                )})}
                <ListPagination
                  page={stagePage}
                  totalPages={stageTotalPages}
                  total={stageTotal}
                  limit={stageLimit}
                  onPageChange={setStagePage}
                  onLimitChange={(nextLimit) => {
                    setStageLimit(nextLimit);
                    setStagePage(1);
                  }}
                  className="mt-3"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
