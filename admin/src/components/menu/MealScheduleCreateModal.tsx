import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { apiClient } from '../../config/api';
import { toBeijingDateString } from '../../utils/timezone';

export default function MealScheduleCreateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { alert('请输入排期名称'); return; }
    if (startDate !== yesterdayStr) { alert(`开始时间必须为 ${yesterdayStr}`); return; }
    try {
      const startTime = new Date(`${startDate}T00:00:00+08:00`).toISOString();
      const endD = new Date(`${startDate}T00:00:00+08:00`);
      endD.setDate(endD.getDate() + 6);
      endD.setHours(23, 59, 59, 999);
      const endTime = endD.toISOString();
      await apiClient.post('/api/admin/menu/meal-schedules', {
        schedule_name: name,
        entries: [],
        start_time: startTime,
        end_time: endTime,
      });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || '创建失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">添加餐食排期</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              排期编号
              <span className="ml-2 text-xs text-gray-500 font-normal">(MS-yyyyMM-序号)</span>
            </label>
            <input
              type="text"
              disabled
              value=""
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              placeholder="留空自动生成，例如 MS-202603-001"
            />
            <p className="mt-1 text-xs text-gray-500">保存后由系统按当月顺序自动生成 MS- 编号</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">排期名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="例如：2026年3月第2周排期"
            />
          </div>
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
