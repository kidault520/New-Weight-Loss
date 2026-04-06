import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { getTodayBeijing, toBeijingDateString } from '../../utils/timezone';
import { MEAL_PLAN_SERVICE_STRUCTURE_BANNER } from '../../config/serviceStructureUi';

interface MealPlan {
  id?: string;
  plan_name: string;
  /** 餐食疗程编号 MTPxxxx，创建后由系统分配 */
  plan_code?: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  description?: string;
  is_active: boolean;
  included_meal_types?: string[];
}

const MEAL_SLOTS = ['早餐', '午餐', '晚餐'] as const;

function defaultIncludedMeals(plan: MealPlan | null): string[] {
  const allowed = new Set<string>(MEAL_SLOTS);
  const raw = plan?.included_meal_types;
  if (Array.isArray(raw) && raw.length > 0) {
    const out = raw.filter((x): x is string => typeof x === 'string' && allowed.has(x));
    if (out.length > 0) return out;
  }
  return ['午餐', '晚餐'];
}

interface MealPlanFormProps {
  plan: MealPlan | null;
  /** 与商品一致：仅锁定结构字段，名称/描述/启用仍可改 */
  structureInService?: boolean;
  onSave: (data: Partial<MealPlan>) => void;
  onCancel: () => void;
}

export default function MealPlanForm({
  plan: planData,
  structureInService = false,
  onSave,
  onCancel,
}: MealPlanFormProps) {
  const [formData, setFormData] = useState<Partial<MealPlan>>({
    plan_name: '',
    duration_days: 7,
    start_date: getTodayBeijing(),
    end_date: '',
    description: '',
    is_active: true,
    included_meal_types: ['午餐', '晚餐'],
  });

  useEffect(() => {
    const meals = defaultIncludedMeals(planData);
    setFormData({
      plan_name: planData?.plan_name ?? '',
      duration_days: planData?.duration_days || 7,
      start_date: planData?.start_date || getTodayBeijing(),
      end_date: planData?.end_date || '',
      description: planData?.description || '',
      is_active: planData?.is_active ?? true,
      included_meal_types: meals,
    });
  }, [planData?.id]);

  useEffect(() => {
    if (formData.start_date && formData.duration_days) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + formData.duration_days - 1);
      setFormData((prev) => ({
        ...prev,
        end_date: toBeijingDateString(endDate),
      }));
    }
  }, [formData.start_date, formData.duration_days]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.plan_name || formData.plan_name.trim() === '') {
      alert('请填写计划名称');
      return;
    }

    if (!formData.start_date) {
      alert('请选择开始日期');
      return;
    }

    if (!formData.duration_days || formData.duration_days < 1) {
      alert('计划时长必须大于0');
      return;
    }

    const included = formData.included_meal_types?.length
      ? formData.included_meal_types
      : defaultIncludedMeals(null);
    if (included.length === 0) {
      alert('请至少选择一餐（每天包含餐次）');
      return;
    }

    onSave({
      ...formData,
      included_meal_types: included,
    });
  };

  const toggleIncludedMeal = (meal: string) => {
    setFormData((prev) => {
      const cur = [...(prev.included_meal_types?.length ? prev.included_meal_types : defaultIncludedMeals(null))];
      const nextSet = new Set(cur);
      if (nextSet.has(meal)) {
        if (nextSet.size <= 1) {
          alert('每天至少保留一餐');
          return prev;
        }
        nextSet.delete(meal);
      } else {
        nextSet.add(meal);
      }
      return { ...prev, included_meal_types: Array.from(nextSet) };
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {planData ? '编辑餐食疗程' : '添加餐食疗程'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {structureInService && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {MEAL_PLAN_SERVICE_STRUCTURE_BANNER}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 items-start">
            {planData?.id && planData.plan_code ? (
              <div className="sm:col-span-2 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  疗程编号（MTP）
                  <span className="ml-2 text-xs text-gray-500 font-normal">(MTP0001)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={planData.plan_code}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm text-gray-800 cursor-default"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                疗程名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.plan_name}
                onChange={(e) =>
                  setFormData({ ...formData, plan_name: e.target.value })
                }
                className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                placeholder="例如: 7日营养疗程"
              />
            </div>

            <div
              className={`min-w-0 ${
                structureInService
                  ? 'rounded-lg border border-gray-200 bg-gray-100 p-3'
                  : ''
              }`}
            >
              <label className="block text-sm font-medium text-gray-700 mb-1">
                疗程时长（天） <span className="text-red-500">*</span>
                {structureInService ? (
                  <span className="ml-2 text-xs font-normal text-amber-800">已锁定</span>
                ) : null}
              </label>
              <div className="relative">
                <Clock
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                    structureInService ? 'text-gray-400' : 'text-gray-400'
                  }`}
                />
                <input
                  type="number"
                  required
                  min="1"
                  disabled={structureInService}
                  value={formData.duration_days}
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 1;
                    setFormData({ ...formData, duration_days: days });
                  }}
                  className={`w-full min-w-0 pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    structureInService
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'border-gray-300 disabled:bg-gray-50 disabled:text-gray-600'
                  }`}
                />
              </div>
            </div>

            <div
              className={`sm:col-span-2 min-w-0 rounded-lg border p-3 ${
                structureInService
                  ? 'border-gray-200 bg-gray-100'
                  : 'border-gray-300 bg-gray-50/60'
              }`}
            >
              <label className="block text-sm font-medium text-gray-700 mb-2">
                每天包含餐次 <span className="text-red-500">*</span>
                {structureInService ? (
                  <span className="ml-2 text-xs font-normal text-amber-800">已锁定</span>
                ) : null}
              </label>
              <div className={`flex flex-wrap gap-4 ${structureInService ? 'opacity-90' : ''}`}>
                {MEAL_SLOTS.map((type) => (
                  <label
                    key={type}
                    className={`flex items-center ${structureInService ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={structureInService}
                      checked={(formData.included_meal_types || []).includes(type)}
                      onChange={() => toggleIncludedMeal(type)}
                      className="mr-2"
                    />
                    <span className={`text-sm ${structureInService ? 'text-gray-500' : 'text-gray-700'}`}>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="hidden">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始日期 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="hidden">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束日期
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  value={formData.end_date || ''}
                  disabled
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  * 结束日期根据开始日期和时长自动计算
                </p>
              </div>
            </div>

            <div className="sm:col-span-2 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                疗程描述
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="输入计划的描述信息..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">启用</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 sticky bottom-0 bg-white pb-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
