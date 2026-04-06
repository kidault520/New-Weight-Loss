import { useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../config/api';
import { toBeijingDateString } from '../../utils/timezone';

interface Props {
  schedule: { id: string; schedule_name: string; start_time?: string; end_time?: string };
  onClose: () => void;
  onSaved: () => void;
}

export default function MealScheduleEditModal({ schedule, onClose, onSaved }: Props) {
  const [name, setName] = useState(schedule.schedule_name);
  const [startDate, setStartDate] = useState(() => {
    if (schedule.start_time) {
      return toBeijingDateString(schedule.start_time);
    }
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toBeijingDateString(d);
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请输入排期名称');
      return;
    }
    setSaving(true);
    try {
      const startTime = new Date(`${startDate}T00:00:00+08:00`).toISOString();
      const endD = new Date(`${startDate}T00:00:00+08:00`);
      endD.setDate(endD.getDate() + 6);
      endD.setHours(23, 59, 59, 999);
      const endTime = endD.toISOString();
      await apiClient.patch(`/api/admin/menu/meal-schedules/${schedule.id}`, {
        schedule_name: name.trim(),
        start_time: startTime,
        end_time: endTime,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">编辑排期</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
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
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
