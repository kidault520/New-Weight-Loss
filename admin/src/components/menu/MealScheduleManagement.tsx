import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../config/api';
import BatchMealSchedulesModal from './BatchMealSchedulesModal';
import MealScheduleCreateModal from './MealScheduleCreateModal';
import MealScheduleDetailModal from './MealScheduleDetailModal';
import { toBeijingDateString } from '../../utils/timezone';
import ListPagination from '../common/ListPagination';

export default function MealScheduleManagement() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ schedules: any[] }>('/api/admin/menu/meal-schedules');
      setSchedules(data.schedules || []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  };

  const handleNameSave = async (s: any) => {
    const trimmed = editingNameValue.trim();
    if (!trimmed) {
      setEditingNameId(null);
      return;
    }
    if (trimmed === s.schedule_name) {
      setEditingNameId(null);
      return;
    }
    try {
      await apiClient.patch(`/api/admin/menu/meal-schedules/${s.id}`, { schedule_name: trimmed });
      setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, schedule_name: trimmed } : x)));
    } catch (e: any) {
      alert(e?.message || '修改失败');
    }
    setEditingNameId(null);
  };

  const startEditName = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(s.id);
    setEditingNameValue(s.schedule_name || '');
  };

  const handleDelete = async (s: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (s.in_use_this_week || s.is_enabled) {
      alert('使用中的排期无法删除');
      return;
    }
    if (!confirm(`确定删除排期「${s.schedule_name}」？`)) return;
    try {
      await apiClient.delete(`/api/admin/menu/meal-schedules/${s.id}`);
      setSchedules((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err: any) {
      console.error('Delete meal schedule error:', err);
      alert(err?.message || '删除失败');
    }
  };

  const total = schedules.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedSchedules = useMemo(() => {
    const start = (page - 1) * limit;
    return schedules.slice(start, start + limit);
  }, [schedules, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const formatScheduleStartDate = (startTime?: string | null) => {
    if (!startTime) return '-';
    return toBeijingDateString(startTime);
  };

  const formatScheduleEndDate = (schedule: { start_time?: string | null; end_time?: string | null }) => {
    if (schedule.start_time) {
      // 业务定义为固定 7 天排期，展示按开始日 + 6 天，避免历史 end_time 边界值导致 +1 天错觉。
      const startDateStr = toBeijingDateString(schedule.start_time);
      const start = new Date(`${startDateStr}T00:00:00+08:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return toBeijingDateString(end);
    }
    if (schedule.end_time) return toBeijingDateString(schedule.end_time);
    return '-';
  };

  const todayStr = toBeijingDateString(new Date());
  const getScheduleRuntimeStatus = (schedule: { start_time?: string | null; end_time?: string | null }) => {
    const start = formatScheduleStartDate(schedule.start_time);
    const end = formatScheduleEndDate(schedule);
    if (start === '-' || end === '-') return 'unknown' as const;
    if (end < todayStr) return 'expired' as const;
    if (start <= todayStr && todayStr <= end) return 'current' as const;
    return 'upcoming' as const;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">排期</h2>
        <div className="space-x-2">
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            添加排期
          </button>
          <button
            onClick={() => setShowBatch(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            批量生成排期
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium mb-1">已创建排期</h3>
          <p className="text-xs text-gray-500 mb-2">
            {new Date().getFullYear()}年{new Date().getMonth() + 1}月
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">编号</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">名称</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">开始</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">结束</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">状态</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">创建时间</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-500" colSpan={7}>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        加载中...
                      </div>
                    </td>
                  </tr>
                ) : loadedOnce && schedules.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-500" colSpan={7}>暂无排期</td>
                  </tr>
                ) : paginatedSchedules.map(s => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setDetailId(s.id);
                      setDetailMode('view');
                    }}
                    title="点击查看详情"
                  >
                    <td className="px-3 py-2 text-xs text-gray-600 font-mono">{s.schedule_code || '-'}</td>
                    <td className="px-3 py-2 text-sm" onClick={(e) => startEditName(s, e)}>
                      {editingNameId === s.id ? (
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={() => handleNameSave(s)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNameSave(s);
                            if (e.key === 'Escape') setEditingNameId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 border rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="cursor-text hover:bg-gray-100 px-1 rounded" title="点击修改名称">
                          {s.schedule_name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm">{formatScheduleStartDate(s.start_time)}</td>
                    <td className="px-3 py-2 text-sm">{formatScheduleEndDate(s)}</td>
                    <td className="px-3 py-2 text-sm">
                      {getScheduleRuntimeStatus(s) === 'expired' ? (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">已过期</span>
                      ) : getScheduleRuntimeStatus(s) === 'current' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">使用中</span>
                      ) : getScheduleRuntimeStatus(s) === 'upcoming' ? (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">待使用</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">未知</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm">{s.created_at ? new Date(s.created_at).toLocaleString('zh-CN') : '-'}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          disabled
                          className={`px-2 py-1 text-xs rounded ${
                            getScheduleRuntimeStatus(s) === 'expired'
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : getScheduleRuntimeStatus(s) === 'current'
                                ? 'bg-emerald-100 text-emerald-600 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-700 cursor-not-allowed'
                          }`}
                          title={
                            getScheduleRuntimeStatus(s) === 'expired'
                              ? '该排期已过期'
                              : getScheduleRuntimeStatus(s) === 'current'
                                ? '当前日期区间内自动使用'
                                : '未到开始日期，系统将自动切换'
                          }
                        >
                          {getScheduleRuntimeStatus(s) === 'expired'
                            ? '已过期'
                            : getScheduleRuntimeStatus(s) === 'current'
                              ? '使用中'
                              : '待使用'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailId(s.id);
                            setDetailMode('edit');
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="配置套餐"
                        >
                          添加套餐
                        </button>
                        <button
                          onClick={(e) => handleDelete(s, e)}
                          disabled={s.in_use_this_week || s.is_enabled}
                          className={`px-2 py-1 text-xs rounded ${(s.in_use_this_week || s.is_enabled) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                          title={(s.in_use_this_week || s.is_enabled) ? '使用中的排期无法删除' : '删除'}
                        >
                          删除
                        </button>
                      </div>
                    </td>
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

      {showBatch && <BatchMealSchedulesModal onClose={() => { setShowBatch(false); loadSchedules(); }} />}
      {showCreate && <MealScheduleCreateModal onClose={() => { setShowCreate(false); loadSchedules(); }} />}
      {detailId && (
        <MealScheduleDetailModal
          id={detailId}
          initialMode={detailMode}
          onClose={() => setDetailId(null)}
          onRefresh={loadSchedules}
        />
      )}
    </div>
  );
}
