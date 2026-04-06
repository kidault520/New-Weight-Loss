import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../config/api';
import { Plus, Trash2, Search, X } from 'lucide-react';
import PackageForm from './PackageForm';
import ListPagination from '../common/ListPagination';

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
  dishes?: Dish; // 后端返回的字段名
}

interface MealPackage {
  id?: string;
  package_code: string;
  name: string;
  package_type: string;
  cover_image_url?: string;
  supply_date?: string;
  total_carbohydrate_g?: number;
  total_protein_g?: number;
  total_fat_g?: number;
  total_fiber_g?: number;
  total_weight_g?: number;
  total_calories_kcal?: number;
  is_active: boolean;
  items?: PackageItem[];
}

export default function MealPackageManagement() {
  const [packages, setPackages] = useState<MealPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<MealPackage | null>(null);
  const [editing, setEditing] = useState<MealPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      params.append('limit', '1000');

      const data = await apiClient.get<{ packages: MealPackage[]; pagination: any }>(
        `/api/admin/menu/packages?${params.toString()}`
      );
      setPackages(data.packages || []);
    } catch (error: any) {
      console.error('Failed to load packages:', error);
      const errorMessage = error?.message || '未知错误';
      alert(`加载餐次列表失败: ${errorMessage}\n\n请检查:\n1. 后端服务是否运行\n2. 数据库表是否已创建\n3. 是否有权限访问`);
    } finally {
      setLoading(false);
    }
  };

  const total = packages.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedPackages = useMemo(() => {
    const start = (page - 1) * limit;
    return packages.slice(start, start + limit);
  }, [packages, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此餐次吗？')) return;
    try {
      await apiClient.delete(`/api/admin/menu/packages/${id}`);
      loadPackages();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleToggleStatus = async (pkg: MealPackage) => {
    try {
      await apiClient.patch(`/api/admin/menu/packages/${pkg.id}/toggle-status`);
      loadPackages();
    } catch (error) {
      alert('切换状态失败');
    }
  };

  const handleSave = async (formData: Partial<MealPackage> & { items: PackageItem[] }) => {
    try {
      if (editing) {
        // Update package
        await apiClient.put(`/api/admin/menu/packages/${editing.id}`, {
          name: formData.name,
          package_type: formData.package_type,
          cover_image_url: formData.cover_image_url,
          supply_date: formData.supply_date,
          is_active: formData.is_active,
        });

        // Update items - first remove all, then add new ones
        // Note: This is a simplified approach. In production, you might want to optimize this.
        if (formData.items) {
          // Delete all existing items
          const existingData = await apiClient.get<{ package: MealPackage; items: PackageItem[] }>(
            `/api/admin/menu/packages/${editing.id}`
          );
          
          if (existingData && existingData.items && Array.isArray(existingData.items)) {
            for (const item of existingData.items) {
              if (item.id) {
                try {
                  await apiClient.delete(`/api/admin/menu/packages/${editing.id}/items/${item.id}`);
                } catch (e) {
                  // Ignore errors if item doesn't exist
                  console.warn('Failed to delete item:', e);
                }
              }
            }
          }

          // Add new items
          for (const item of formData.items) {
            await apiClient.post(`/api/admin/menu/packages/${editing.id}/items`, {
              dish_id: item.dish_id,
              quantity: item.quantity,
              sort_order: item.sort_order,
            });
          }
        }
      } else {
        // Create new package
        await apiClient.post('/api/admin/menu/packages', formData);
      }
      setShowForm(false);
      setEditing(null);
      loadPackages();
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || '保存失败');
    }
  };

  const handleViewDetails = async (pkg: MealPackage) => {
    // 先秒开弹窗，避免等待接口导致体感卡顿
    setSelectedPackage(pkg);
    setDetailLoading(true);
    try {
      const data = await apiClient.get<{ package: MealPackage; items: PackageItem[] }>(
        `/api/admin/menu/packages/${pkg.id}`
      );
      if (data && data.package) {
        setSelectedPackage((prev) => ({
          ...(prev || {}),
          ...data.package,
          items: data.items || [],
        }));
      } else {
        throw new Error('无效的响应数据');
      }
    } catch (error: any) {
      console.error('Failed to load package details:', error);
      alert(error.message || '加载餐次详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const openPackageEditorFromDetail = async () => {
    const pkg = selectedPackage;
    if (!pkg?.id) return;
    try {
      const response = await apiClient.get<{ package: MealPackage; items: PackageItem[] }>(
        `/api/admin/menu/packages/${pkg.id}`
      );
      if (response?.package) {
        const formattedItems: PackageItem[] = (response.items || []).map((item) => ({
          id: item.id,
          dish_id: item.dish_id,
          quantity: item.quantity || 1,
          sort_order: item.sort_order || 0,
          dish: item.dish || item.dishes,
          dishes: item.dishes || item.dish,
        }));
        setEditing({
          ...response.package,
          items: formattedItems,
        });
        setSelectedPackage(null);
        setShowForm(true);
      } else {
        throw new Error('无效的响应数据');
      }
    } catch (error: any) {
      console.error('Failed to load package for editing:', error);
      alert(error.message || '加载餐次详情失败');
    }
  };

  if (loading && packages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">餐次列表</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加餐次
        </button>
      </div>

      {showForm && (
        <PackageForm
          package={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="搜索餐次名称或编号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && loadPackages()}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={loadPackages}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          搜索
        </button>
      </div>

      {/* Packages Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">编号</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">供应日期</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">总热量(kcal)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    加载中...
                  </div>
                </td>
              </tr>
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  暂无餐次，点击「添加餐次」开始创建
                </td>
              </tr>
            ) : (
              paginatedPackages.map((pkg) => (
                <tr
                  key={pkg.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewDetails(pkg)}
                >
                  <td className="px-4 py-3 text-sm">{pkg.package_code}</td>
                  <td className="px-4 py-3 text-sm font-medium">{pkg.name}</td>
                  <td className="px-4 py-3 text-sm">{pkg.package_type}</td>
                  <td className="px-4 py-3 text-sm">{pkg.supply_date || '-'}</td>
                  <td className="px-4 py-3 text-sm">{pkg.total_calories_kcal || 0}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleStatus(pkg)}
                      className={`px-2 py-1 text-xs rounded ${
                        pkg.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {pkg.is_active ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => pkg.id && handleDelete(pkg.id)}
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

      {/* Package Details Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center gap-3">
              <h3 className="text-lg font-semibold">餐次详情 - {selectedPackage.name}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void openPackageEditorFromDetail()}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPackage(null)}
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
                  <p className="text-sm text-gray-500">餐次编号</p>
                  <p className="font-medium">{selectedPackage.package_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">餐次类型</p>
                  <p className="font-medium">{selectedPackage.package_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">供应日期</p>
                  <p className="font-medium">{selectedPackage.supply_date || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">状态</p>
                  <p className="font-medium">{selectedPackage.is_active ? '启用' : '禁用'}</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-medium mb-3">营养成分</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">总热量</p>
                    <p className="text-lg font-semibold">{selectedPackage.total_calories_kcal || 0} kcal</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">碳水</p>
                    <p className="text-lg font-semibold">{selectedPackage.total_carbohydrate_g || 0} g</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">蛋白质</p>
                    <p className="text-lg font-semibold">{selectedPackage.total_protein_g || 0} g</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">脂肪</p>
                    <p className="text-lg font-semibold">{selectedPackage.total_fat_g || 0} g</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">膳食纤维</p>
                    <p className="text-lg font-semibold">{selectedPackage.total_fiber_g || 0} g</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">总重量</p>
                    <p className="text-lg font-semibold">{selectedPackage.total_weight_g || 0} g</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">包含菜品</h4>
                {detailLoading && (
                  <p className="text-sm text-gray-500 mb-2">正在加载菜品明细...</p>
                )}
                {selectedPackage.items && selectedPackage.items.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedPackage.items.map((item) => (
                      <li key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>
                          {item.dishes?.name || '未知菜品'} ({item.dishes?.dish_code || '-'})
                          {item.dishes?.dish_type ? (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                              {item.dishes.dish_type}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-sm text-gray-500">x{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">暂无菜品</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

