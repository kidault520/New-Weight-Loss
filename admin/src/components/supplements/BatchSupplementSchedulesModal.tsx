import { useEffect, useMemo, useState } from 'react';
import { X, Calendar, CheckSquare } from 'lucide-react';
import { apiClient } from '../../config/api';
import { toBeijingDateString } from '../../utils/timezone';
import ListPagination from '../common/ListPagination';

interface Course {
  id: string;
  plan_name: string;
  duration_days: number;
}

interface Props {
  onClose: () => void;
}

export default function BatchSupplementSchedulesModal({ onClose }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toBeijingDateString(d);
  });
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toBeijingDateString(d);
  })();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await apiClient.get<{ plans: Course[] }>('/api/admin/menu/supplement-plans?is_active=true&limit=1000');
      setCourses(data.plans || []);
    } catch {}
  };

  const toggle = (id: string) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const total = courses.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedCourses = useMemo(() => {
    const start = (page - 1) * limit;
    return courses.slice(start, start + limit);
  }, [courses, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || startDate !== yesterdayStr) {
      alert(`开始时间必须为 ${yesterdayStr}`);
      return;
    }
    const chosen = courses.filter(c => selected[c.id]);
    if (chosen.length === 0) {
      alert('请选择至少一个补剂疗程');
      return;
    }
    const entries = chosen.map(c => ({
      type: 'supplement',
      schedule_name: c.plan_name,
      course_id: c.id,
      total_days: c.duration_days,
      start_time: new Date(`${startDate}T00:00:00+08:00`).toISOString()
    }));
    try {
      const data = await apiClient.post<{ success: number; failure: number }>(
        '/api/admin/schedules/batch',
        { entries }
      );
      alert(`创建成功 ${data.success} 条，失败 ${data.failure} 条`);
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || '创建失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">批量生成补剂排期</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">开始时间</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={yesterdayStr}
                max={yesterdayStr}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">只能选择昨天，系统自动按疗程总天数计算结束时间</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">选择补剂疗程</label>
            <div className="max-h-64 overflow-y-auto border rounded">
              {paginatedCourses.map(c => (
                <label key={c.id} className="flex items-center px-3 py-2 border-b last:border-b-0">
                  <input
                    type="checkbox"
                    checked={!!selected[c.id]}
                    onChange={() => toggle(c.id)}
                    className="mr-2"
                  />
                  <span className="flex-1">{c.plan_name}</span>
                  <span className="text-xs text-gray-500">{c.duration_days} 天</span>
                  <CheckSquare className={`w-4 h-4 ml-2 ${selected[c.id] ? 'text-blue-600' : 'text-gray-300'}`} />
                </label>
              ))}
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
              className="mt-3"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              生成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
