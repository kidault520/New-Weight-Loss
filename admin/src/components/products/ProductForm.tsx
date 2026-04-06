import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../config/api';
import ImageUpload from '../menu/ImageUpload';
import SearchableSelect, { type SearchableSelectOption } from '../common/SearchableSelect';
import { PRODUCT_SERVICE_STRUCTURE_BANNER } from '../../config/serviceStructureUi';

interface Product {
  id?: string;
  product_code: string;
  product_name: string;
  description?: string;
  meal_plan_id?: string;
  supplement_plan_id?: string;
  duration_days: number;
  price: number;
  original_price?: number;
  cover_image_url?: string;
  is_active: boolean;
  has_active_paid_orders?: boolean;
  meal_plans?: { plan_name?: string; plan_code?: string; duration_days?: number } | null;
  supplement_plans?: { plan_name?: string; plan_code?: string; duration_days?: number } | null;
}

interface MealPlan {
  id: string;
  plan_name: string;
  plan_code?: string;
  duration_days: number;
  included_meal_types?: string[];
}

interface SupplementPlan {
  id: string;
  plan_name: string;
  plan_code?: string;
  duration_days: number;
  description?: string | null;
}

interface ProductFormProps {
  product: Product | null;
  onSave: (data: Partial<Product>) => void;
  onCancel: () => void;
  readonly?: boolean;
  onRequestEdit?: () => void;
}

export default function ProductForm({
  product: productData,
  onSave,
  onCancel,
  readonly = false,
  onRequestEdit,
}: ProductFormProps) {
  const [formData, setFormData] = useState<Partial<Product>>({
    product_name: productData?.product_name || '',
    description: productData?.description || '',
    meal_plan_id: productData?.meal_plan_id || undefined,
    supplement_plan_id: productData?.supplement_plan_id || undefined,
    duration_days: productData?.duration_days,
    price: productData?.price || 0,
    original_price: productData?.original_price || undefined,
    cover_image_url: productData?.cover_image_url || '',
    is_active: productData?.is_active ?? true,
  });

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [supplementPlans, setSupplementPlans] = useState<SupplementPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const isLockedServiceStructure = Boolean(productData?.id && productData?.has_active_paid_orders);
  const isReadonly = readonly;

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (productData) {
      setFormData({
        product_name: productData.product_name || '',
        description: productData.description || '',
        meal_plan_id: productData.meal_plan_id || undefined,
        supplement_plan_id: productData.supplement_plan_id || undefined,
        duration_days: productData.duration_days,
        price: productData.price || 0,
        original_price: productData.original_price || undefined,
        cover_image_url: productData.cover_image_url || '',
        is_active: productData.is_active ?? true,
      });
    }
  }, [productData]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      
      // Load meal plans
      try {
        const mealData = await apiClient.get<{ plans: MealPlan[]; pagination: any }>(
          '/api/admin/menu/plans?is_active=true&limit=1000'
        );
        setMealPlans(mealData.plans || []);
        console.log('Loaded meal plans:', mealData.plans?.length || 0);
      } catch (error: any) {
        console.error('Failed to load meal plans:', error);
        const errorMessage = error?.response?.data?.error || error?.message || '未知错误';
        console.error('Meal plans error details:', errorMessage);
        // Continue even if meal plans fail to load
      }

      // Load supplement plans
      try {
        const supplementData = await apiClient.get<{ plans: SupplementPlan[]; pagination: any }>(
          '/api/admin/menu/supplement-plans?is_active=true&limit=1000'
        );
        setSupplementPlans(supplementData.plans || []);
        console.log('Loaded supplement plans:', supplementData.plans?.length || 0);
      } catch (error: any) {
        console.error('Failed to load supplement plans:', error);
        const errorMessage = error?.response?.data?.error || error?.message || '未知错误';
        console.error('Supplement plans error details:', errorMessage);
        // Continue even if supplement plans fail to load
      }
      
    } catch (error: any) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const durationNum = formData.duration_days != null && formData.duration_days >= 1
    ? Number(formData.duration_days)
    : null;
  const filteredMealPlans = durationNum
    ? mealPlans.filter((p) => Number(p.duration_days) === durationNum)
    : [];
  const filteredSupplementPlans = durationNum
    ? supplementPlans.filter((p) => Number(p.duration_days) === durationNum)
    : [];

  const mealPlanOptions = useMemo<SearchableSelectOption[]>(
    () =>
      filteredMealPlans.map((plan) => ({
        value: plan.id,
        label: `${plan.plan_name} (${plan.duration_days}天)${plan.plan_code ? ` · ${plan.plan_code}` : ''}`,
        keywords: [plan.plan_name, String(plan.duration_days), plan.plan_code || ''].filter(Boolean),
      })),
    [filteredMealPlans]
  );

  const supplementPlanOptions = useMemo<SearchableSelectOption[]>(
    () =>
      filteredSupplementPlans.map((plan) => ({
        value: plan.id,
        label: `${plan.plan_name} (${plan.duration_days}天)${plan.plan_code ? ` · ${plan.plan_code}` : ''}`,
        keywords: [plan.plan_name, String(plan.duration_days), plan.plan_code || ''].filter(Boolean),
      })),
    [filteredSupplementPlans]
  );

  const selectedMealPlanName = useMemo(() => {
    const id = formData.meal_plan_id;
    if (!id) return '';
    const fromList = mealPlans.find((p) => p.id === id)?.plan_name;
    if (fromList) return fromList;
    const fromProduct = productData?.meal_plans?.plan_name;
    return fromProduct || id;
  }, [formData.meal_plan_id, mealPlans, productData]);

  const selectedSupplementPlanName = useMemo(() => {
    const id = formData.supplement_plan_id;
    if (!id) return '';
    const fromList = supplementPlans.find((p) => p.id === id)?.plan_name;
    if (fromList) return fromList;
    const fromProduct = productData?.supplement_plans?.plan_name;
    return fromProduct || id;
  }, [formData.supplement_plan_id, supplementPlans, productData]);

  const mealPlanSummary = useMemo(() => {
    if (!formData.meal_plan_id) {
      return { labels: '', mealsPerDay: 0, totalMeals: 0 };
    }
    const plan = filteredMealPlans.find((x) => x.id === formData.meal_plan_id);
    const labels = plan?.included_meal_types?.length ? plan.included_meal_types : ['午餐', '晚餐'];
    const mealsPerDay = labels.length;
    const days = durationNum || 0;
    return {
      labels: labels.join('、'),
      mealsPerDay,
      totalMeals: Math.max(0, mealsPerDay * days),
    };
  }, [formData.meal_plan_id, filteredMealPlans, durationNum]);

  const supplementDays = durationNum || 0;

  const handleDurationChange = (value: string) => {
    const num = value === '' ? undefined : Math.max(1, parseInt(value) || 1);
    setFormData((prev) => {
      const next = { ...prev, duration_days: num };
      if (num == null) {
        next.meal_plan_id = undefined;
        next.supplement_plan_id = undefined;
      } else {
        const mealMatch = prev.meal_plan_id && mealPlans.find((p) => p.id === prev.meal_plan_id);
        const suppMatch = prev.supplement_plan_id && supplementPlans.find((p) => p.id === prev.supplement_plan_id);
        if (mealMatch && Number(mealMatch.duration_days) !== num) next.meal_plan_id = undefined;
        if (suppMatch && Number(suppMatch.duration_days) !== num) next.supplement_plan_id = undefined;
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadonly) return;

    if (!formData.product_name || formData.product_name.trim() === '') {
      alert('请填写商品名称');
      return;
    }

    const dur = formData.duration_days;
    if (dur == null || dur < 1) {
      alert('请填写时长（天）');
      return;
    }

    if (!formData.meal_plan_id && !formData.supplement_plan_id) {
      alert('请至少选择一个餐食计划或补剂疗程');
      return;
    }

    if (formData.price === undefined || formData.price === null || formData.price < 0) {
      alert('请填写有效的价格');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {isReadonly ? '商品详情' : (productData ? '编辑商品' : '添加商品')}
          </h3>
          <div className="flex items-center gap-4">
            {isReadonly ? (
              <span
                className={`px-2 py-1 text-xs rounded ${
                  formData.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {formData.is_active ? '启用中' : '已禁用'}
              </span>
            ) : (
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
            )}
            {isReadonly && onRequestEdit ? (
              <button
                type="button"
                onClick={onRequestEdit}
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                编辑
              </button>
            ) : null}
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {isLockedServiceStructure && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {PRODUCT_SERVICE_STRUCTURE_BANNER}
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.product_name}
                onChange={(e) =>
                  setFormData({ ...formData, product_name: e.target.value })
                }
                disabled={isReadonly}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  isReadonly ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-300'
                }`}
                placeholder="例如: 21天减肥计划"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                时长（天） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.duration_days ?? ''}
                onChange={(e) => handleDurationChange(e.target.value)}
                disabled={isReadonly || isLockedServiceStructure}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  (isReadonly || isLockedServiceStructure) ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'
                }`}
                placeholder="例如: 21"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                餐食计划
              </label>
              {isReadonly ? (
                <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 border-gray-200 min-h-[42px] flex items-center">
                  {selectedMealPlanName || '—'}
                </div>
              ) : (
                <SearchableSelect
                  value={formData.meal_plan_id || ''}
                  onChange={(value) =>
                    setFormData({ ...formData, meal_plan_id: value || undefined })
                  }
                  options={mealPlanOptions}
                  placeholder={
                    durationNum
                      ? '请选择餐食计划（可选）'
                      : '请先填写时长'
                  }
                  searchPlaceholder="输入计划名进行模糊搜索"
                  disabled={loading || !durationNum || isLockedServiceStructure}
                  loading={loading}
                  emptyText="没有匹配的餐食计划"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                餐次
                <span className="ml-2 text-xs text-slate-500 font-normal">与客户端选日期、地址、配送计划中的餐次一致</span>
              </label>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                {mealPlanSummary.labels ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-green-200 text-green-800 text-sm font-bold">餐</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{mealPlanSummary.labels}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {durationNum || 0}天 × {mealPlanSummary.mealsPerDay}餐/天 = {mealPlanSummary.totalMeals}餐
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{mealPlanSummary.totalMeals}餐</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">选择左侧餐食计划后展示</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                补剂疗程
              </label>
              {isReadonly ? (
                <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 border-gray-200 min-h-[42px] flex items-center">
                  {selectedSupplementPlanName || '—'}
                </div>
              ) : (
                <SearchableSelect
                  value={formData.supplement_plan_id || ''}
                  onChange={(value) =>
                    setFormData({ ...formData, supplement_plan_id: value || undefined })
                  }
                  options={supplementPlanOptions}
                  placeholder={
                    !durationNum
                      ? '请先填写时长'
                      : filteredSupplementPlans.length === 0
                      ? `暂无 ${durationNum} 天的补剂疗程`
                      : '请选择补剂疗程（可选）'
                  }
                  searchPlaceholder="输入疗程名进行模糊搜索"
                  disabled={loading || !durationNum || isLockedServiceStructure}
                  loading={loading}
                  emptyText="没有匹配的补剂疗程"
                />
              )}
              <p className="mt-1 text-xs text-gray-500">
                * 至少需要选择一个计划，仅显示与时长匹配的选项
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">补剂内容</label>
              <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2">
                {formData.supplement_plan_id ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-200 text-amber-800 text-sm font-bold">补</span>
                      <div>
                        <p className="text-sm font-medium text-amber-950">个性化补剂方案</p>
                        <p className="text-xs text-amber-800/80">{supplementDays}天</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-amber-900">{supplementDays}份</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">选择左侧补剂疗程后展示</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                价格（元） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  // 允许空值，在提交时验证
                  setFormData({ 
                    ...formData, 
                    price: value === '' ? undefined : (parseFloat(value) || 0)
                  });
                }}
                onBlur={(e) => {
                  // 失去焦点时，如果为空则设置为0
                  if (e.target.value === '') {
                    setFormData({ ...formData, price: 0 });
                  }
                }}
                disabled={isReadonly}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  isReadonly ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                原价（元）
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.original_price || ''}
                onChange={(e) =>
                  setFormData({ ...formData, original_price: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                disabled={isReadonly}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  isReadonly ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-300'
                }`}
                placeholder="可选，用于显示折扣"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品描述
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                disabled={isReadonly}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  isReadonly ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-300'
                }`}
                placeholder="输入商品描述信息..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                封面图片
              </label>
              {isReadonly ? (
                formData.cover_image_url ? (
                  <img
                    src={formData.cover_image_url}
                    alt="封面"
                    className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm flex items-center justify-center">
                    暂无图片
                  </div>
                )
              ) : (
                <ImageUpload
                  value={formData.cover_image_url}
                  onChange={(url) =>
                    setFormData({ ...formData, cover_image_url: url })
                  }
                  folder="products"
                />
              )}
            </div>
          </div>

          {!isReadonly && (
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

