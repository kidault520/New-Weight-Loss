import { useState } from 'react';
import { X } from 'lucide-react';
import ImageUpload from './ImageUpload';
import SearchableSelect from '../common/SearchableSelect';

interface Dish {
  id?: string;
  dish_code: string;
  name: string;
  image_url?: string;
  dish_type: string;
  cuisine?: string;
  flavor?: string;
  production_methods?: string[];
  weight_g?: number;
  edible_weight_g?: number;
  carbohydrate_g: number;
  protein_g: number;
  fat_g: number;
  fiber_g: number;
  calories_kcal: number;
  is_active: boolean;
}

interface DishFormProps {
  dish: Dish | null;
  onSave: (data: Partial<Dish>) => void;
  onCancel: () => void;
}

export default function DishForm({ dish, onSave, onCancel }: DishFormProps) {
  const [formData, setFormData] = useState<Partial<Dish>>({
    dish_code: dish?.dish_code || undefined, // 新建时不设置，让后端自动生成
    name: dish?.name || '',
    image_url: dish?.image_url || '',
    dish_type: dish?.dish_type || '主食',
    cuisine: dish?.cuisine || '',
    flavor: dish?.flavor || '',
    production_methods: dish?.production_methods || [],
    weight_g: dish?.weight_g || undefined,
    edible_weight_g: dish?.edible_weight_g || undefined,
    carbohydrate_g: dish?.carbohydrate_g || 0,
    protein_g: dish?.protein_g || 0,
    fat_g: dish?.fat_g || 0,
    fiber_g: dish?.fiber_g || 0,
    calories_kcal: dish?.calories_kcal || 0,
    is_active: dish?.is_active ?? true,
  });

  const [newMethod, setNewMethod] = useState('');

  const dishTypes = ['主食', '主荤菜', '副荤菜', '主素菜', '副素菜', '饮品', '汤'];
  const cuisines = ['主食-面类', '主食-饭类', '饮品', '家常菜', '粤菜'];
  const flavors = ['鲜甜', '麻辣', '清淡', '酸甜', '咸鲜', '香辣'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addProductionMethod = () => {
    if (newMethod && !formData.production_methods?.includes(newMethod)) {
      setFormData({
        ...formData,
        production_methods: [...(formData.production_methods || []), newMethod],
      });
      setNewMethod('');
    }
  };

  const removeProductionMethod = (method: string) => {
    setFormData({
      ...formData,
      production_methods: formData.production_methods?.filter((m) => m !== method),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {dish ? '编辑菜品' : '添加菜品'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  菜品编号
                  <span className="ml-2 text-xs text-gray-500 font-normal">(cpXXXX)</span>
                </label>
                <input
                  type="text"
                  value={formData.dish_code || ''}
                  onChange={(e) => setFormData({ ...formData, dish_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="留空自动生成，格式: cp0001"
                  disabled={!dish}
                />
                {!dish && (
                  <p className="mt-1 text-xs text-gray-500">新建时留空即可，保存后由系统自动生成 cp 编号</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  菜品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  菜品类型 <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={formData.dish_type ?? ''}
                  onChange={(value) => setFormData({ ...formData, dish_type: value })}
                  options={dishTypes.map((type) => ({ value: type, label: type }))}
                  placeholder="请选择菜品类型"
                  searchPlaceholder="输入关键词筛选菜品类型"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜系</label>
                <SearchableSelect
                  value={formData.cuisine || ''}
                  onChange={(value) => setFormData({ ...formData, cuisine: value || undefined })}
                  options={[{ value: '', label: '请选择' }, ...cuisines.map((cuisine) => ({ value: cuisine, label: cuisine }))]}
                  placeholder="请选择菜系"
                  searchPlaceholder="输入关键词筛选菜系"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">口味</label>
                <SearchableSelect
                  value={formData.flavor || ''}
                  onChange={(value) => setFormData({ ...formData, flavor: value || undefined })}
                  options={[{ value: '', label: '请选择' }, ...flavors.map((flavor) => ({ value: flavor, label: flavor }))]}
                  placeholder="请选择口味"
                  searchPlaceholder="输入关键词筛选口味"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">制作工艺</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProductionMethod())}
                    placeholder="例如: 红烧"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addProductionMethod}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    添加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.production_methods?.map((method) => (
                    <span
                      key={method}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                    >
                      {method}
                      <button
                        type="button"
                        onClick={() => removeProductionMethod(method)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜品图片</label>
                <ImageUpload
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  folder="dishes"
                />
              </div>
            </div>

            {/* Right Column - Nutrition Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜品克重 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight_g || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weight_g: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">可食用重量 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.edible_weight_g || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      edible_weight_g: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">碳水含量 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.carbohydrate_g || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      carbohydrate_g: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">蛋白质含量 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.protein_g || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      protein_g: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">脂肪含量 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.fat_g || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fat_g: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">膳食纤维含量 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.fiber_g || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fiber_g: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">卡路里 (kcal)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.calories_kcal || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      calories_kcal: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
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
          </div>

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
        </form>
      </div>
    </div>
  );
}

