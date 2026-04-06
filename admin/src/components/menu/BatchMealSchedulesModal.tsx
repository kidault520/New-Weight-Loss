import { useState } from 'react';
import { X, Calendar, Plus } from 'lucide-react';
import { apiClient } from '../../config/api';
import { toBeijingDateString } from '../../utils/timezone';

interface Props {
  onClose: () => void;
}

export default function BatchMealSchedulesModal({ onClose }: Props) {
  // 线性日历：第1周=startDate，第2周=startDate+7，第3周=startDate+14...
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toBeijingDateString(d);
  });
  const [weeks, setWeeks] = useState(1);
  const [baseName, setBaseName] = useState('');
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toBeijingDateString(d);
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      alert('请选择开始时间');
      return;
    }
    if (weeks < 1) {
      alert('周数必须大于等于 1');
      return;
    }
    // 线性日历：每周开始时间递增 7 天，第1周=startDate，第2周=startDate+7，第3周=startDate+14...
    const entries = Array.from({ length: weeks }).map((_, i) => {
      const d = new Date(`${startDate}T00:00:00+08:00`);
      d.setDate(d.getDate() + i * 7);
      return {
        type: 'meal',
        schedule_name: baseName ? `${baseName} 第${i + 1}周` : `餐食排期 第${i + 1}周`,
        start_time: d.toISOString()
      };
    });
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
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">批量生成餐食排期</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">第1周开始时间</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={yesterdayStr}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">第1周开始日期，后续周自动线性递增（第2周+7天，第3周+14天...）</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">周数</label>
            <input
              type="number"
              min={1}
              value={weeks}
              onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">排期名称前缀（可选）</label>
            <input
              type="text"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="例如：2026年3月排期"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4 inline mr-1" />
              生成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
