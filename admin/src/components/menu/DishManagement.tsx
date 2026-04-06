import { useEffect, useState } from 'react';
import { apiClient } from '../../config/api';
import { Plus, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import DishForm from './DishForm';
import SearchFilterBar from '../common/SearchFilterBar';
import SearchableSelect from '../common/SearchableSelect';
import type { FilterCondition } from '../common/SearchFilterBar';

interface Dish {
  id: string;
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
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function DishManagement() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterCuisine, setFilterCuisine] = useState('');
  const [filterDishCode, setFilterDishCode] = useState('');
  const [filterName, setFilterName] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    const tid = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(tid);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
    loadDishes(1);
  }, [filterType, filterCuisine, filterDishCode, filterName]);

  useEffect(() => {
    loadDishes(page);
  }, [page, limit, debouncedSearch, filterDishCode, filterName]);

  const loadDishes = async (targetPage: number = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const searchVal = debouncedSearch || filterDishCode || filterName;
      if (searchVal) params.append('search', searchVal);
      if (filterType) params.append('dish_type', filterType);
      if (filterCuisine) params.append('cuisine', filterCuisine);
      params.append('page', targetPage.toString());
      params.append('limit', limit.toString());

      const data = await apiClient.get<{ dishes: Dish[]; pagination: Pagination }>(
        `/api/admin/menu/dishes?${params.toString()}`
      );
      setDishes(data.dishes || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error('Failed to load dishes:', error);
      const errorMessage = error?.message || '未知错误';
      alert(`加载菜品列表失败: ${errorMessage}\n\n请检查:\n1. 后端服务是否运行\n2. 数据库表是否已创建\n3. 是否有权限访问`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: Partial<Dish>) => {
    try {
      if (editing) {
        await apiClient.put(`/api/admin/menu/dishes/${editing.id}`, formData);
      } else {
        await apiClient.post('/api/admin/menu/dishes', formData);
      }
      setShowForm(false);
      setEditing(null);
      loadDishes();
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此菜品吗？')) return;
    try {
      await apiClient.delete(`/api/admin/menu/dishes/${id}`);
      loadDishes();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleToggleStatus = async (dish: Dish) => {
    try {
      await apiClient.patch(`/api/admin/menu/dishes/${dish.id}/toggle-status`);
      loadDishes();
    } catch (error) {
      alert('切换状态失败');
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const dishTypes = ['主食', '主荤菜', '副荤菜', '主素菜', '副素菜', '饮品', '汤'];
  const cuisines = ['主食-面类', '主食-饭类', '饮品', '家常菜', '粤菜'];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">菜品列表</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加菜品
        </button>
      </div>

      <div className="mb-4">
        <SearchFilterBar
          searchPlaceholder="搜索菜品名称或编号..."
          searchValue={searchTerm}
          onSearchChange={(v) => { setSearchTerm(v); setPage(1); }}
          onSearch={() => loadDishes(1)}
          filterFields={[
            { value: 'dish_code', label: '编号' },
            { value: 'name', label: '名称' },
            {
              value: 'dish_type',
              label: '类型',
              options: dishTypes.map((type) => ({ value: type, label: type })),
            },
            {
              value: 'cuisine',
              label: '菜系',
              options: cuisines.map((c) => ({ value: c, label: c })),
            },
          ]}
          filterConditions={filterConditions}
          onFilterConditionsChange={setFilterConditions}
          onFilterApply={() => {
            let t = '', c = '', code = '', n = '';
            filterConditions.forEach((cond) => {
              if (cond.field === 'dish_type') t = cond.value;
              if (cond.field === 'cuisine') c = cond.value;
              if (cond.field === 'dish_code') code = cond.value;
              if (cond.field === 'name') n = cond.value;
            });
            setFilterType(t);
            setFilterCuisine(c);
            setFilterDishCode(code);
            setFilterName(n);
            setPage(1);
            loadDishes(1);
          }}
          onFilterClear={() => {
            setFilterConditions([]);
            setFilterType('');
            setFilterCuisine('');
            setFilterDishCode('');
            setFilterName('');
            setPage(1);
            loadDishes(1);
          }}
        />
      </div>

      {showForm && (
        <DishForm
          dish={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Dishes Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">编号</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">图片</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">菜系</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">热量(kcal)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    加载中...
                  </div>
                </td>
              </tr>
            ) : dishes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  暂无菜品，点击"添加菜品"开始创建
                </td>
              </tr>
            ) : (
              dishes.map((dish) => (
                <tr
                  key={dish.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedDish(dish)}
                >
                  <td className="px-4 py-3 text-sm font-mono">{dish.dish_code}</td>
                  <td className="px-4 py-3">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                        无图片
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{dish.name}</td>
                  <td className="px-4 py-3 text-sm">{dish.dish_type}</td>
                  <td className="px-4 py-3 text-sm">{dish.cuisine || '-'}</td>
                  <td className="px-4 py-3 text-sm">{dish.calories_kcal || 0}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleStatus(dish)}
                      className={`px-2 py-1 text-xs rounded ${
                        dish.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {dish.is_active ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDelete(dish.id)}
                        className="text-red-600 hover:text-red-800"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 菜品详情弹窗 */}
      {selectedDish && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center gap-3">
              <h3 className="text-lg font-semibold">菜品详情 - {selectedDish.name}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(selectedDish);
                    setSelectedDish(null);
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDish(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="关闭"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">编号</p>
                  <p className="font-medium">{selectedDish.dish_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">名称</p>
                  <p className="font-medium">{selectedDish.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">类型</p>
                  <p className="font-medium">{selectedDish.dish_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">菜系</p>
                  <p className="font-medium">{selectedDish.cuisine || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">热量 (kcal)</p>
                  <p className="font-medium">{selectedDish.calories_kcal ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">状态</p>
                  <p className="font-medium">{selectedDish.is_active ? '启用' : '禁用'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700">碳水 (g)</p>
                  <p className="text-xl font-semibold text-amber-900">{selectedDish.carbohydrate_g ?? 0}</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                  <p className="text-xs text-sky-700">蛋白质 (g)</p>
                  <p className="text-xl font-semibold text-sky-900">{selectedDish.protein_g ?? 0}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-xs text-rose-700">脂肪 (g)</p>
                  <p className="text-xl font-semibold text-rose-900">{selectedDish.fat_g ?? 0}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-700">膳食纤维 (g)</p>
                  <p className="text-xl font-semibold text-emerald-900">{selectedDish.fiber_g ?? 0}</p>
                </div>
              </div>
              {selectedDish.image_url && (
                <div className="mt-6">
                  <p className="text-sm text-gray-500 mb-2">图片</p>
                  <img
                    src={selectedDish.image_url}
                    alt={selectedDish.name}
                    className="w-32 h-32 object-cover rounded"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">每页显示:</span>
            <SearchableSelect
              value={String(limit)}
              onChange={(value) => handleLimitChange(Number(value || 20))}
              options={[
                { value: '10', label: '10' },
                { value: '20', label: '20' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
              ]}
              placeholder="每页条数"
              searchPlaceholder="输入数字快速筛选"
              className="w-24"
            />
            <span className="text-sm text-gray-600">
              共 {pagination.total} 条记录
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className={`p-2 rounded-lg border ${
                page === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {/* 显示页码按钮 */}
              {(() => {
                const pages = [];
                const maxButtons = 7;
                let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
                const endPage = Math.min(pagination.totalPages, startPage + maxButtons - 1);

                if (endPage - startPage < maxButtons - 1) {
                  startPage = Math.max(1, endPage - maxButtons + 1);
                }

                if (startPage > 1) {
                  pages.push(
                    <button
                      key={1}
                      onClick={() => handlePageChange(1)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      1
                    </button>
                  );
                  if (startPage > 2) {
                    pages.push(
                      <span key="ellipsis1" className="px-2 text-gray-400">
                        ...
                      </span>
                    );
                  }
                }

                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      className={`px-3 py-1 text-sm border rounded-lg ${
                        i === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }

                if (endPage < pagination.totalPages) {
                  if (endPage < pagination.totalPages - 1) {
                    pages.push(
                      <span key="ellipsis2" className="px-2 text-gray-400">
                        ...
                      </span>
                    );
                  }
                  pages.push(
                    <button
                      key={pagination.totalPages}
                      onClick={() => handlePageChange(pagination.totalPages)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {pagination.totalPages}
                    </button>
                  );
                }

                return pages;
              })()}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === pagination.totalPages}
              className={`p-2 rounded-lg border ${
                page === pagination.totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <span className="text-sm text-gray-600 ml-2">
              第 {page} / {pagination.totalPages} 页
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

