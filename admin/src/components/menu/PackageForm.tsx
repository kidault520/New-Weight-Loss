import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../config/api';
import ImageUpload from './ImageUpload';
import SearchableSelect, { type SearchableSelectOption } from '../common/SearchableSelect';

interface Dish {
  id: string;
  dish_code: string;
  name: string;
  image_url?: string;
  dish_type: string;
  cuisine?: string;
  flavor?: string;
  carbohydrate_g?: number;
  protein_g?: number;
  fat_g?: number;
  fiber_g?: number;
  calories_kcal?: number;
}

interface PackageItem {
  id?: string;
  dish_id: string;
  quantity: number;
  sort_order: number;
  dish?: Dish;
  dishes?: Dish; // 后端返回的字段名（从 package_items JOIN dishes 查询得到）
}

interface MealPackage {
  id?: string;
  package_code: string;
  name: string;
  package_type: string;
  cover_image_url?: string;
  supply_date?: string;
  items?: PackageItem[];
  is_active: boolean;
}

interface PackageFormProps {
  package: MealPackage | null;
  onSave: (data: Partial<MealPackage> & { items: PackageItem[] }) => void;
  onCancel: () => void;
}

export default function PackageForm({ package: packageData, onSave, onCancel }: PackageFormProps) {
  const [formData, setFormData] = useState<Partial<MealPackage>>({
    package_code: packageData?.package_code || undefined,
    name: packageData?.name || '',
    package_type: packageData?.package_type || '早餐',
    cover_image_url: packageData?.cover_image_url || '',
    supply_date: packageData?.supply_date || '',
    is_active: packageData?.is_active ?? true,
  });

  const [items, setItems] = useState<PackageItem[]>(
    (packageData?.items && Array.isArray(packageData.items))
      ? packageData.items.map(item => ({
          id: item.id,
          dish_id: item.dish_id,
          quantity: item.quantity || 1,
          sort_order: item.sort_order || 0,
          dish: item.dish || item.dishes, // 支持两种字段名
          dishes: item.dishes || item.dish,
        }))
      : []
  );

  const [availableDishes, setAvailableDishes] = useState<Dish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(true);
  const [selectedDishId, setSelectedDishId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  const packageTypes = ['早餐', '午餐', '晚餐'];

  useEffect(() => {
    loadAvailableDishes();
  }, []);

  // Update form data when packageData changes (for edit mode)
  useEffect(() => {
    if (packageData) {
      setFormData({
        package_code: packageData.package_code || undefined,
        name: packageData.name || '',
        package_type: packageData.package_type || '早餐',
        cover_image_url: packageData.cover_image_url || '',
        supply_date: packageData.supply_date || '',
        is_active: packageData.is_active ?? true,
      });
      setItems(
        (packageData.items && Array.isArray(packageData.items))
          ? packageData.items.map(item => ({
              id: item.id,
              dish_id: item.dish_id,
              quantity: item.quantity || 1,
              sort_order: item.sort_order || 0,
              dish: item.dish || item.dishes, // 支持两种字段名
              dishes: item.dishes || item.dish,
            }))
          : []
      );
    } else {
      // Reset for new package
      setFormData({
        package_code: undefined,
        name: '',
        package_type: '早餐',
        cover_image_url: '',
        supply_date: '',
        is_active: true,
      });
      setItems([]);
    }
  }, [packageData]);

  const loadAvailableDishes = async () => {
    try {
      setLoadingDishes(true);
      const data = await apiClient.get<{ dishes: Dish[]; pagination: any }>(
        '/api/admin/menu/dishes?is_active=true&limit=1000'
      );
      setAvailableDishes(data.dishes || []);
    } catch (error) {
      console.error('Failed to load dishes:', error);
    } finally {
      setLoadingDishes(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证必填字段
    if (!formData.name || formData.name.trim() === '') {
      alert('请填写套餐名称');
      return;
    }
    
    // 验证是否有有效的菜品
    const validItems = items.filter(item => item.dish_id && item.dish_id.trim() !== '');
    if (validItems.length === 0) {
      alert('请至少添加一个菜品到套餐中');
      return;
    }
    
    // 验证每个菜品的数量
    const hasInvalidQuantity = validItems.some(item => !item.quantity || item.quantity < 1);
    if (hasInvalidQuantity) {
      alert('所有菜品的数量必须大于0');
      return;
    }
    
    const packageItems = validItems.map((item, index) => ({
      dish_id: item.dish_id,
      quantity: item.quantity || 1,
      sort_order: index,
    }));
    
    onSave({ ...formData, items: packageItems } as any);
  };

  const addDish = () => {
    if (!selectedDishId) return;

    const dish = availableDishes.find(d => d.id === selectedDishId);
    if (!dish) return;

    // Check if dish already added
    if (items.some(item => item.dish_id === selectedDishId)) {
      alert('该菜品已添加到套餐中');
      return;
    }

    setItems([
      ...items,
      {
        dish_id: selectedDishId,
        quantity: selectedQuantity,
        sort_order: items.length,
        dish,
      },
    ]);

    setSelectedDishId('');
    setSelectedQuantity(1);
  };

  const removeDish = (index: number) => {
    setItems(items.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      sort_order: i,
    })));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, quantity);
    setItems(newItems);
  };

  const calculateNutrition = () => {
    let totalCarb = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalCalories = 0;

    items.forEach(item => {
      // 优先使用 item.dish，如果没有则使用 item.dishes
      const dish = item.dish || item.dishes || availableDishes.find(d => d.id === item.dish_id);
      if (dish) {
        const qty = item.quantity || 1;
        totalCarb += (dish.carbohydrate_g || 0) * qty;
        totalProtein += (dish.protein_g || 0) * qty;
        totalFat += (dish.fat_g || 0) * qty;
        totalFiber += (dish.fiber_g || 0) * qty;
        totalCalories += (dish.calories_kcal || 0) * qty;
      }
    });

    return {
      total_carbohydrate_g: totalCarb,
      total_protein_g: totalProtein,
      total_fat_g: totalFat,
      total_fiber_g: totalFiber,
      total_calories_kcal: totalCalories,
    };
  };

  const nutrition = calculateNutrition();
  const unusedDishes = availableDishes.filter(
    dish => !items.some(item => item.dish_id === dish.id)
  );

  const dishOptions = useMemo<SearchableSelectOption[]>(
    () =>
      unusedDishes.map((dish) => ({
        value: dish.id,
        label: `${dish.dish_code} - ${dish.name} (${dish.dish_type})`,
        keywords: [dish.dish_code, dish.name, dish.dish_type, dish.cuisine || ''],
      })),
    [unusedDishes]
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {packageData ? '编辑套餐' : '添加套餐'}
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
            {/* Left Column - Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  套餐编号
                  <span className="ml-2 text-xs text-gray-500 font-normal">(tcXXXX)</span>
                </label>
                <input
                  type="text"
                  value={formData.package_code || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, package_code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="留空自动生成，格式: tc0001"
                  disabled={!packageData}
                />
                {!packageData && (
                  <p className="mt-1 text-xs text-gray-500">新建时留空即可，保存后由系统自动生成 tc 编号</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  套餐名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 营养早餐套餐"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  套餐类型 <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={formData.package_type ?? ''}
                  onChange={(value) =>
                    setFormData({ ...formData, package_type: value })
                  }
                  options={packageTypes.map((type) => ({ value: type, label: type }))}
                  placeholder="请选择套餐类型"
                  searchPlaceholder="输入关键词筛选套餐类型"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  供应日期
                </label>
                <input
                  type="date"
                  value={formData.supply_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, supply_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  套餐封面图片
                </label>
                <ImageUpload
                  value={formData.cover_image_url}
                  onChange={(url) =>
                    setFormData({ ...formData, cover_image_url: url })
                  }
                  folder="packages"
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

            {/* Right Column - Nutrition Summary */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  营养成分汇总
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">总热量</span>
                    <span className="text-sm font-semibold">
                      {nutrition.total_calories_kcal.toFixed(1)} kcal
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">碳水</span>
                    <span className="text-sm font-semibold">
                      {nutrition.total_carbohydrate_g.toFixed(1)} g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">蛋白质</span>
                    <span className="text-sm font-semibold">
                      {nutrition.total_protein_g.toFixed(1)} g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">脂肪</span>
                    <span className="text-sm font-semibold">
                      {nutrition.total_fat_g.toFixed(1)} g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">膳食纤维</span>
                    <span className="text-sm font-semibold">
                      {nutrition.total_fiber_g.toFixed(1)} g
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  * 营养成分根据所选菜品自动计算
                </p>
              </div>
            </div>
          </div>

          {/* Dishes Selection */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-4">
              套餐菜品 <span className="text-red-500">*</span>
            </h4>

            {/* Add Dish Section */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    选择菜品
                  </label>
                  <SearchableSelect
                    value={selectedDishId}
                    onChange={(value) => setSelectedDishId(value)}
                    options={dishOptions}
                    placeholder={
                      loadingDishes
                        ? '加载中...'
                        : unusedDishes.length === 0
                        ? '没有可用菜品'
                        : '请选择菜品'
                    }
                    searchPlaceholder="输入菜品编号/名称/类型模糊搜索"
                    disabled={loadingDishes || unusedDishes.length === 0}
                    loading={loadingDishes}
                    emptyText="没有匹配的菜品"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    数量
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(e) =>
                      setSelectedQuantity(parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addDish}
                    disabled={!selectedDishId}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    添加
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Dishes List */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                请添加菜品到套餐中
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => {
                  // 优先使用 item.dish，如果没有则使用 item.dishes，再没有则从 availableDishes 中查找
                  const dish = item.dish || item.dishes || availableDishes.find((d) => d.id === item.dish_id);
                  // 如果找不到菜品信息，但 dish_id 存在，仍然显示（可能是加载中）
                  if (!dish && !item.dish_id) return null;
                  
                  // 类型保护：如果 dish 不存在，不渲染详细信息
                  if (!dish) {
                    return (
                      <div
                        key={item.dish_id || index}
                        className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div className="text-sm text-yellow-800">菜品加载中... (ID: {item.dish_id})</div>
                        <button
                          type="button"
                          onClick={() => removeDish(index)}
                          className="text-red-600 hover:text-red-800"
                          title="移除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.dish_id || index}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center flex-1">
                        {dish.image_url && (
                          <img
                            src={dish.image_url}
                            alt={dish.name || '菜品'}
                            className="w-12 h-12 object-cover rounded mr-3"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {dish.dish_code} - {dish.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {dish.dish_type} | {dish.calories_kcal || 0} kcal/份
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          <label className="text-xs text-gray-600 mr-2">
                            数量:
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(
                                index,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDish(index)}
                          className="text-red-600 hover:text-red-800"
                          title="移除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white pb-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={items.length === 0 || !formData.name || formData.name.trim() === '' || items.some(item => !item.dish_id)}
              onClick={(e) => {
                // 确保事件能够正常触发
                if (items.length === 0) {
                  e.preventDefault();
                  alert('请至少添加一个菜品');
                  return;
                }
                if (!formData.name || formData.name.trim() === '') {
                  e.preventDefault();
                  alert('请填写套餐名称');
                  return;
                }
                if (items.some(item => !item.dish_id)) {
                  e.preventDefault();
                  alert('存在无效的菜品项，请移除后重试');
                  return;
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors z-10 relative"
              title={items.length === 0 ? '请至少添加一个菜品' : !formData.name || formData.name.trim() === '' ? '请填写套餐名称' : items.some(item => !item.dish_id) ? '存在无效的菜品项' : '保存套餐'}
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

