import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../config/api';
import SearchableSelect from '../common/SearchableSelect';
import ListPagination from '../common/ListPagination';

export default function SupplementScheduleDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [schedule, setSchedule] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [supplements, setSupplements] = useState<any[]>([]);
  const [stageName, setStageName] = useState('');
  const [duration, setDuration] = useState(1);
  const [suppId, setSuppId] = useState('');
  const [qty, setQty] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    loadDetail();
    loadSupplements();
  }, [id]);

  const loadDetail = async () => {
    const data = await apiClient.get<{ schedule: any; stages: any[] }>(`/api/admin/menu/supplement-schedules/${id}`);
    setSchedule(data.schedule);
    setStages(data.stages || []);
  };

  const loadSupplements = async () => {
    const data = await apiClient.get<{ supplements: any[] }>('/api/admin/content/supplements?limit=1000');
    setSupplements(data.supplements || []);
  };

  const add = async () => {
    if (!stageName || duration < 1) return;
    await apiClient.post(`/api/admin/menu/supplement-schedules/${id}/stages`, {
      stage_name: stageName,
      duration_days: duration,
      supplement_id: suppId || null,
      per_day_qty: qty || null
    });
    setStageName('');
    setDuration(1);
    setSuppId('');
    setQty(1);
    loadDetail();
  };

  const remove = async (stageId: string) => {
    await apiClient.delete(`/api/admin/menu/supplement-schedules/${id}/stages/${stageId}`);
    loadDetail();
  };

  const total = stages.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedStages = useMemo(() => {
    const start = (page - 1) * limit;
    return stages.slice(start, start + limit);
  }, [stages, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">补剂排期详情</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {schedule && (
            <div className="text-sm text-gray-700">
              <div className="mb-2">名称：{schedule.schedule_name}</div>
              <div className="mb-2">疗程天数：{schedule.total_days}</div>
              <div className="mb-2">范围：{schedule.start_time ? new Date(schedule.start_time).toLocaleDateString('zh-CN') : '-'} ~ {schedule.end_time ? new Date(schedule.end_time).toLocaleDateString('zh-CN') : '-'}</div>
            </div>
          )}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">添加阶段</h4>
              <button onClick={add} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-1" /> 添加
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input value={stageName} onChange={(e) => setStageName(e.target.value)} className="px-3 py-2 border rounded" placeholder="阶段名称" />
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 1)} className="px-3 py-2 border rounded" placeholder="持续天数（天）" />
              <SearchableSelect
                value={suppId}
                onChange={(value) => setSuppId(value)}
                options={[
                  { value: '', label: '选择补剂' },
                  ...supplements.map((s) => ({ value: s.id, label: s.name, keywords: [s.name, s.id] })),
                ]}
                placeholder="选择补剂"
                searchPlaceholder="输入补剂名称模糊搜索"
                emptyText="没有匹配补剂"
              />
              <input type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} className="px-3 py-2 border rounded" placeholder="一天颗数" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">阶段</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">天数</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">补剂</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">一天颗数</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stages.length === 0 ? (
                  <tr><td className="px-3 py-4 text-gray-500" colSpan={5}>暂无明细</td></tr>
                ) : paginatedStages.map(s => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 text-sm">{s.stage_name}</td>
                    <td className="px-3 py-2 text-sm">{s.duration_days}</td>
                    <td className="px-3 py-2 text-sm">{s.supplements ? s.supplements.name : '-'}</td>
                    <td className="px-3 py-2 text-sm">{s.per_day_qty || '-'}</td>
                    <td className="px-3 py-2 text-right"><button className="text-red-600" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4 inline" /> 删除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
