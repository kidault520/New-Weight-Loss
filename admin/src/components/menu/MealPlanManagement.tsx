import { useEffect, useState } from 'react';
import { apiClient } from '../../config/api';
import { Plus, Trash2, Search, X, Calendar, Clock } from 'lucide-react';
import MealPlanForm from './MealPlanForm';
import ListPagination from '../common/ListPagination';
import {
  ENTITY_DELETE_BLOCKED_IN_SERVICE,
  LIST_SERVICE_STRUCTURE_LOCKED_BADGE,
} from '../../config/serviceStructureUi';

interface MealPlan {
  id: string;
  plan_name: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  description?: string;
  is_active: boolean;
  included_meal_types?: string[];
  created_at: string;
  updated_at: string;
  /** 列表/详情接口返回：与商品 has_active_paid_orders 语义一致 */
  structure_in_service?: boolean;
  /** 餐食疗程编号，如 MTP0001，与商品 meal_plan_id 对齐 */
  plan_code?: string;
}

export default function MealPlanManagement() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MealPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  useEffect(() => {
    loadPlans();
  }, [page, limit]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const data = await apiClient.get<{ plans: MealPlan[]; pagination: any }>(
        `/api/admin/menu/plans?${params.toString()}`
      );
      setPlans(data.plans || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error('Failed to load meal plans:', error);
      alert(`加载餐食计划列表失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadPlans();
  };

  const handleDelete = async (id: string) => {
    const row = plans.find((p) => p.id === id);
    if (row?.structure_in_service) {
      alert(ENTITY_DELETE_BLOCKED_IN_SERVICE);
      return;
    }
    if (!confirm('确定要删除此餐食计划吗？删除后无法恢复。')) return;
    try {
      await apiClient.delete(`/api/admin/menu/plans/${id}`);
      loadPlans();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleToggleStatus = async (plan: MealPlan) => {
    try {
      await apiClient.patch(`/api/admin/menu/plans/${plan.id}/toggle-status`);
      loadPlans();
    } catch (error) {
      alert('切换状态失败');
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (editing) {
        await apiClient.put(`/api/admin/menu/plans/${editing.id}`, formData);
      } else {
        await apiClient.post('/api/admin/menu/plans', formData);
      }
      setShowForm(false);
      setEditing(null);
      loadPlans();
    } catch (error: any) {
      console.error('Save error:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.details || error?.message || '保存失败';
      const details = error?.response?.data?.details ? `\n详细信息: ${error.response.data.details}` : '';
      alert(`保存失败: ${errorMessage}${details}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">餐食疗程列表</h2>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加餐食疗程
        </button>
      </div>

      {showForm && (
        <MealPlanForm
          plan={editing}
          structureInService={!!editing?.structure_in_service}
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
            placeholder="搜索名称、描述或疗程编号（如 MTP0001）..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          搜索
        </button>
      </div>

      {/* Plans Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">疗程编号</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">疗程名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">每天餐次</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">疗程时长</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">删除</th>
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
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  暂无餐食计划，点击"添加餐食计划"开始创建
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedPlan(plan)}
                >
                  <td className="px-4 py-3 text-sm font-mono text-gray-800 whitespace-nowrap">
                    {plan.plan_code ? (
                      <span title="Meal treatment plan code，与商品餐食疗程一致">{plan.plan_code}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{plan.plan_name}</span>
                      {plan.structure_in_service ? (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200"
                          title="存在进行中的已支付订单引用该疗程，编辑时将锁定结构字段"
                        >
                          {LIST_SERVICE_STRUCTURE_LOCKED_BADGE}
                        </span>
                      ) : null}
                    </div>
                    {plan.description && (
                      <div className="text-xs text-gray-500 mt-1">{plan.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {(plan.included_meal_types && plan.included_meal_types.length > 0
                      ? plan.included_meal_types
                      : ['午餐', '晚餐']
                    ).join('、')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-400" />
                      {plan.duration_days} 天
                    </div>
                  </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                    {formatDate(plan.created_at)}
                  </div>
                </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(plan)}
                      className={`px-2 py-1 text-xs rounded ${
                        plan.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {plan.is_active ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => plan.id && handleDelete(plan.id)}
                      disabled={!!plan.structure_in_service}
                      title={plan.structure_in_service ? ENTITY_DELETE_BLOCKED_IN_SERVICE : '删除'}
                      className={`${plan.structure_in_service ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 餐食疗程详情弹窗 */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center gap-3">
              <h3 className="text-lg font-semibold">餐食疗程详情 - {selectedPlan.plan_name}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  onClick={async () => {
                    try {
                      const data = await apiClient.get<{ plan: MealPlan }>(
                        `/api/admin/menu/plans/${selectedPlan.id}`
                      );
                      if (data?.plan) {
                        setEditing(data.plan);
                        setSelectedPlan(null);
                        setShowForm(true);
                      } else {
                        throw new Error('无效的响应数据');
                      }
                    } catch (error: any) {
                      alert(error.message || '加载计划失败');
                    }
                  }}
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="关闭"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">疗程编号（MTP）</p>
                  <p className="font-mono font-medium">{selectedPlan.plan_code || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">疗程名称</p>
                  <p className="font-medium">{selectedPlan.plan_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">每天包含餐次</p>
                  <p className="font-medium">
                    {(selectedPlan.included_meal_types && selectedPlan.included_meal_types.length > 0
                      ? selectedPlan.included_meal_types
                      : ['午餐', '晚餐']
                    ).join('、')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">疗程时长</p>
                  <p className="font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-1 text-gray-400" />
                    {selectedPlan.duration_days} 天
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">创建时间</p>
                  <p className="font-medium flex items-center">
                    <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                    {formatDate(selectedPlan.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">状态</p>
                  <p className="font-medium">
                    {selectedPlan.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">启用</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">禁用</span>
                    )}
                  </p>
                </div>
                {selectedPlan.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">描述</p>
                    <p className="font-medium text-gray-700">{selectedPlan.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ListPagination
        page={page}
        totalPages={pagination.totalPages}
        total={pagination.total}
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
