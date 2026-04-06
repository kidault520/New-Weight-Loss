import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../config/api';
import { Plus, Trash2, X } from 'lucide-react';
import SupplementPackageForm from './SupplementPackageForm';
import ListPagination from '../common/ListPagination';

interface Supplement {
  id: string;
  name: string;
  description?: string;
  dosage?: string;
  frequency?: string;
  supplement_type: string;
  icon_path: string;
  is_active: boolean;
}

interface PackageItem {
  id?: string;
  supplement_id: string;
  quantity: number;
  sort_order: number;
  supplement?: Supplement;
}

interface SupplementPackage {
  id?: string;
  package_code: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  is_active: boolean;
  created_at?: string;
  items?: PackageItem[];
}

export default function SupplementPackageManagement() {
  const [packages, setPackages] = useState<SupplementPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SupplementPackage | null>(null);
  const [viewingPackage, setViewingPackage] = useState<SupplementPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const data = await apiClient.get<{ packages: SupplementPackage[] }>('/api/admin/content/supplement-packages');
      setPackages(data.packages || []);
    } catch (error: any) {
      console.error('Failed to load supplement packages:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.details || error?.message || '未知错误';
      const hint = error?.response?.data?.hint ? `\n\n提示: ${error.response.data.hint}` : '';
      alert(`加载补剂套餐列表失败: ${errorMessage}${hint}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: Partial<SupplementPackage> & { items: PackageItem[] }) => {
    try {
      const payload = {
        ...formData,
        items: formData.items || []
      };

      if (editing?.id) {
        await apiClient.put(`/api/admin/content/supplement-packages/${editing.id}`, payload);
      } else {
        await apiClient.post('/api/admin/content/supplement-packages', payload);
      }
      setShowForm(false);
      setEditing(null);
      loadPackages();
    } catch (error) {
      console.error('Save error:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此补剂套餐吗？')) return;
    try {
      await apiClient.delete(`/api/admin/content/supplement-packages/${id}`);
      loadPackages();
    } catch (error) {
      alert('删除失败');
    }
  };

  const openPackageDetail = async (pkg: SupplementPackage) => {
    if (!pkg.id) return;
    try {
      const data = await apiClient.get<{ package: SupplementPackage; items: PackageItem[] }>(
        `/api/admin/content/supplement-packages/${pkg.id}`
      );
      const itemsWithSupplements = (data.items || []).map((item) => ({
        ...item,
        supplement: item.supplement || (item as any).supplement_products,
      }));
      setViewingPackage({
        ...data.package,
        items: itemsWithSupplements,
      });
    } catch (error) {
      console.error('Failed to load package details:', error);
      alert('加载套餐详情失败');
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

  if (loading) {
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
        <h2 className="text-lg font-semibold">补剂疗程列表</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加补剂疗程
        </button>
      </div>

      {showForm && (
        <SupplementPackageForm
          package={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {viewingPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center gap-3">
              <h3 className="text-lg font-semibold">补剂疗程详情 - {viewingPackage.name}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(viewingPackage);
                    setViewingPackage(null);
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setViewingPackage(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="关闭"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">套餐编号</p>
                <p className="font-mono font-medium">{viewingPackage.package_code}</p>
              </div>
              {viewingPackage.description ? (
                <p className="text-sm text-gray-700">{viewingPackage.description}</p>
              ) : null}
              <div>
                {viewingPackage.is_active ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">启用</span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">禁用</span>
                )}
              </div>
              {viewingPackage.items && viewingPackage.items.length > 0 ? (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">包含补剂</h4>
                  <ul className="space-y-2 text-sm">
                    {viewingPackage.items.map((item) => (
                      <li key={item.id || item.supplement_id} className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>{item.supplement?.name || '未知补剂'}</span>
                        <span className="text-gray-500">×{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500">暂无补剂明细</p>
              )}
            </div>
          </div>
        </div>
      )}

      {packages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          暂无补剂疗程，点击"添加补剂疗程"开始创建
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedPackages.map((pkg) => (
            <div
              key={pkg.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void openPackageDetail(pkg);
                }
              }}
              className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => void openPackageDetail(pkg)}
            >
              {pkg.cover_image_url && (
                <img
                  src={pkg.cover_image_url}
                  alt={pkg.name}
                  className="w-full h-40 object-cover rounded-lg mb-3 pointer-events-none"
                />
              )}
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold">{pkg.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 font-mono">{pkg.package_code}</p>
                  {pkg.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{pkg.description}</p>
                  )}
                  <div className="mt-2">
                    {pkg.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">启用</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">禁用</span>
                    )}
                  </div>
                  {pkg.items && pkg.items.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      包含 {pkg.items.length} 种补剂
                    </div>
                  )}
                  {pkg.created_at && (
                    <div className="mt-2 text-xs text-gray-400">
                      创建于 {new Date(pkg.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => pkg.id && handleDelete(pkg.id)}
                    className="text-red-600 hover:text-red-800"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
