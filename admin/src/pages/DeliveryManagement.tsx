import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiClient } from '../config/api';
import { Package, ChevronDown, ChevronRight, RefreshCw, ClipboardList, ReceiptText, MessageSquareMore, Wrench } from 'lucide-react';
import SearchFilterBar from '../components/common/SearchFilterBar';
import ListPagination from '../components/common/ListPagination';
import type { FilterCondition } from '../components/common/SearchFilterBar';
import { toBeijingDateString } from '../utils/timezone';

interface Delivery {
  id: string;
  order_id: string | null;
  user_id: string;
  delivery_type: string;
  delivery_date: string;
  delivery_time?: string;
  item_name: string;
  quantity: number;
  status: string;
  delivery_feedback_status?: string;
  tracking_number?: string;
  delivery_provider?: string | null;
  external_order_id?: string | null;
  estimated_arrival_time?: string | null;
  delivered_at?: string;
  is_locked?: boolean;
  lock_time?: string | null;
  created_at?: string;
  updated_at?: string;
  status_updated_at?: string | null;
  last_callback_at?: string | null;
  delivery_address?: string;
  delivery_address_label?: string;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  orders?: {
    order_number: string;
    order_status?: string;
  } | null;
  user_profiles?: {
    nickname?: string;
    phone?: string;
  } | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// 餐型标识颜色：一眼区分午餐/晚餐
const mealTypeStyles: Record<string, string> = {
  lunch: 'bg-amber-100 text-amber-800 border border-amber-200',
  dinner: 'bg-violet-100 text-violet-800 border border-violet-200',
  breakfast: 'bg-sky-100 text-sky-800 border border-sky-200',
};

const getMealTypeKey = (itemName?: string) => {
  if (!itemName) return 'breakfast';
  if (itemName.includes('午餐')) return 'lunch';
  if (itemName.includes('晚餐')) return 'dinner';
  return 'breakfast';
};

const parseDateOnly = (dateStr?: string) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDateCN = (dateStr?: string) => {
  const d = parseDateOnly(dateStr);
  if (!d) return '-';
  return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
};

const formatDateTimeCN = (dateTime?: string | null) => {
  if (!dateTime) return '—';
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' });
};

const getStatusLabel = (status?: string) => {
  if (status === 'pending') return '待配送';
  if (status === 'scheduled') return '已安排';
  if (status === 'preparing') return '准备中';
  if (status === 'shipped') return '已发货';
  if (status === 'delivered') return '已送达';
  if (status === 'cancelled') return '已取消';
  return status || '未知';
};

const statusOrder: Record<string, number> = {
  pending: 10,
  scheduled: 20,
  preparing: 30,
  shipped: 40,
  delivered: 50,
  cancelled: 60,
};

const getAllowedNextStatuses = (current?: string) => {
  const normalized = String(current || 'pending').toLowerCase();
  const currentRank = statusOrder[normalized] || statusOrder.pending;

  if (normalized === 'delivered' || normalized === 'cancelled') return [normalized];

  return ['pending', 'scheduled', 'preparing', 'shipped', 'delivered', 'cancelled'].filter((s) => {
    if (s === 'cancelled') return true;
    return (statusOrder[s] || 0) >= currentRank;
  });
};

const feedbackColors: Record<string, string> = {
  '已配送完成': 'bg-green-100 text-green-800',
  '配送中': 'bg-blue-100 text-blue-800',
  '即将配送': 'bg-amber-100 text-amber-800',
  '待配送': 'bg-gray-100 text-gray-700',
  '已取消': 'bg-red-100 text-red-700',
};

const toDateOnlyStr = (date: Date) => {
  return toBeijingDateString(date);
};

const getAddressTagClass = (label?: string) => {
  const v = (label || '').trim();
  if (!v) return 'bg-gray-100 text-gray-600';
  if (v.includes('公司')) return 'bg-violet-100 text-violet-700';
  if (v.includes('家')) return 'bg-blue-100 text-blue-700';
  if (v.includes('学校')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-amber-100 text-amber-700';
};

export default function DeliveryManagement() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'this_week' | 'next_week' | 'all'>('today');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterItemName, setFilterItemName] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>('');
  const [showManualStatusEditor, setShowManualStatusEditor] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [categorized, setCategorized] = useState<any>({
    today: [],
    tomorrow: [],
    this_week: [],
    next_week: []
  });
  const todayStr = useMemo(() => toDateOnlyStr(new Date()), []);

  useEffect(() => {
    const tid = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(tid);
  }, [search]);

  const loadDeliveries = useCallback(async (options: { silent?: boolean; showError?: boolean } = {}) => {
    const { silent = false, showError = true } = options;
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const params = new URLSearchParams();
      
      // Map activeTab to time_filter
      if (activeTab !== 'all') {
        params.append('time_filter', activeTab);
      }
      
      if (filterStatus) params.append('status', filterStatus);
      if (filterType) params.append('delivery_type', filterType);
      if (filterItemName) params.append('item_name', filterItemName);
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('limit', '1000'); // Load more for categorization

      const data = await apiClient.get<{ deliveries: Delivery[]; categorized: any; pagination: any }>(
        `/api/admin/deliveries?${params.toString()}`
      );
      
      setDeliveries(data.deliveries || []);
      if (data.categorized) {
        setCategorized(data.categorized);
      }
      setLastRefreshAt(new Date().toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Shanghai' }));
    } catch (error: any) {
      console.error('Failed to load deliveries:', error);
      if (showError) {
        const errorMessage = error?.message || error?.details || '未知错误';
        const hint = error?.hint ? `\n\n提示: ${error.hint}` : '';
        alert(`加载配送计划失败: ${errorMessage}${hint}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, filterStatus, filterType, filterItemName, debouncedSearch]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDeliveries({ silent: true, showError: false });
      }
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDeliveries({ silent: true, showError: false });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadDeliveries]);

  useEffect(() => {
    if (selectedDelivery?.status) {
      setNextStatus(selectedDelivery.status);
    } else {
      setNextStatus('');
    }
  }, [selectedDelivery]);

  useEffect(() => {
    if (selectedDelivery) {
      setShowManualStatusEditor(false);
    }
  }, [selectedDelivery]);

  const getDisplayDeliveries = (): Delivery[] => {
    if (activeTab === 'today') return categorized.today || [];
    if (activeTab === 'tomorrow') return categorized.tomorrow || [];
    if (activeTab === 'this_week') return categorized.this_week || [];
    if (activeTab === 'next_week') return categorized.next_week || [];
    return deliveries;
  };

  // 按「用户 + 订单号」分组，不再按地址拆分
  const deliveryGroups = useMemo(() => {
    const list = getDisplayDeliveries();
    const map = new Map<string, Delivery[]>();
    list.forEach((d) => {
      const key = `${d.user_id}|${d.order_id ?? 'no-order'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries()).map(([key, items]) => {
      const first = items[0];
      // 配置时间：取组内最早 created_at（首次生成确认时间）
      const configEffectiveAt = items.reduce<string | null>((acc, d) => {
        const t = d.created_at || d.updated_at;
        if (!t) return acc;
        if (!acc) return t;
        return new Date(t) < new Date(acc) ? t : acc;
      }, null);
      return {
        key,
        userNickname: first.user_profiles?.nickname || '用户',
        userPhone: first.user_profiles?.phone || '',
        orderNumber: first.orders?.order_number || '—',
        configEffectiveAt,
        mealCounts: items.reduce((acc, d) => {
          const k = getMealTypeKey(d.item_name);
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        items: items.sort((a, b) => {
          const da = parseDateOnly(a.delivery_date)?.getTime() || 0;
          const db = parseDateOnly(b.delivery_date)?.getTime() || 0;
          if (da !== db) return da - db;
          const mealOrder = { breakfast: 1, lunch: 2, dinner: 3 };
          return (mealOrder[a.item_name?.includes('早餐') ? 'breakfast' : a.item_name?.includes('午餐') ? 'lunch' : 'dinner'] ?? 99)
            - (mealOrder[b.item_name?.includes('早餐') ? 'breakfast' : b.item_name?.includes('午餐') ? 'lunch' : 'dinner'] ?? 99);
        }),
      };
    });
  }, [activeTab, categorized, deliveries]);

  const totalGroupCount = deliveryGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroupCount / limit));
  const paginatedDeliveryGroups = useMemo(() => {
    const start = (page - 1) * limit;
    return deliveryGroups.slice(start, start + limit);
  }, [deliveryGroups, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, filterStatus, filterType, filterItemName, debouncedSearch]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getDayOfWeek = (dateString: string) => {
    const date = parseDateOnly(dateString) || new Date();
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  };

  const handleUpdateDeliveryStatus = useCallback(async () => {
    if (!selectedDelivery || !nextStatus || nextStatus === selectedDelivery.status) return;
    try {
      setUpdatingStatus(true);
      const data = await apiClient.patch<{ delivery: Delivery }>(
        `/api/admin/deliveries/${selectedDelivery.id}/status`,
        { status: nextStatus }
      );

      const updated = data?.delivery;
      if (!updated) throw new Error('状态更新失败：未返回最新配送数据');

      setSelectedDelivery(updated);
      setDeliveries((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      setCategorized((prev: any) => {
        const patchList = (arr: Delivery[] = []) => arr.map((d) => (d.id === updated.id ? { ...d, ...updated } : d));
        return {
          today: patchList(prev?.today || []),
          tomorrow: patchList(prev?.tomorrow || []),
          this_week: patchList(prev?.this_week || []),
          next_week: patchList(prev?.next_week || []),
        };
      });

      await loadDeliveries({ silent: true, showError: false });
      alert('配送状态更新成功');
    } catch (error: any) {
      alert(error?.message || '配送状态更新失败，请重试');
    } finally {
      setUpdatingStatus(false);
    }
  }, [loadDeliveries, nextStatus, selectedDelivery]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">配送管理</h2>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => loadDeliveries({ silent: true, showError: true })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            立即刷新
          </button>
          <div className="text-xs text-gray-500">
            {lastRefreshAt ? `刷新成功：${lastRefreshAt}` : '等待首次刷新...'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex -mb-px space-x-4">
          {[
            { id: 'today', label: '今天' },
            { id: 'tomorrow', label: '明天' },
            { id: 'this_week', label: '本周' },
            { id: 'next_week', label: '下周' },
            { id: 'all', label: '全部' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (activeTab === tab.id) return;
                // 切换时间维度时先进入加载态，避免出现“暂无配送计划”闪烁
                setLoading(true);
                setActiveTab(tab.id as any);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mb-4">
        <SearchFilterBar
          searchPlaceholder="搜索用户昵称、手机号、配送项..."
          searchValue={search}
          onSearchChange={(v) => setSearch(v)}
          onSearch={() => loadDeliveries()}
          filterFields={[
            {
              value: 'status',
              label: '状态',
              options: [
                { value: 'pending', label: '待配送' },
                { value: 'scheduled', label: '已安排' },
                { value: 'preparing', label: '准备中' },
                { value: 'shipped', label: '已发货' },
                { value: 'delivered', label: '已送达' },
                { value: 'cancelled', label: '已取消' },
              ],
            },
            {
              value: 'delivery_type',
              label: '类型',
              options: [
                { value: 'meal', label: '餐食' },
                { value: 'supplement', label: '补剂' },
              ],
            },
            { value: 'item_name', label: '配送项' },
          ]}
          filterConditions={filterConditions}
          onFilterConditionsChange={setFilterConditions}
          onFilterApply={() => {
            let s = '', t = '', n = '';
            filterConditions.forEach((c) => {
              if (c.field === 'status') s = c.value;
              if (c.field === 'delivery_type') t = c.value;
              if (c.field === 'item_name') n = c.value;
            });
            setFilterStatus(s);
            setFilterType(t);
            setFilterItemName(n);
            loadDeliveries();
          }}
          onFilterClear={() => {
            setFilterConditions([]);
            setFilterStatus('');
            setFilterType('');
            setFilterItemName('');
            loadDeliveries();
          }}
        />
      </div>

      {/* 分组折叠列表 */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center text-gray-500">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            正在加载配送计划...
          </div>
        ) : deliveryGroups.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center text-gray-500">
            暂无配送计划
          </div>
        ) : (
          paginatedDeliveryGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            return (
              <div
                key={group.key}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* 组头：用户 + 订单，点击展开/折叠 */}
                <div
                  onClick={() => toggleGroup(group.key)}
                  className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                >
                  {/* 第一行：标题栏 */}
                  <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <span className="text-gray-400 shrink-0">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </span>
                    <div className="flex-1 min-w-0 grid gap-x-4 gap-y-2 text-xs items-center" style={{ gridTemplateColumns: '36% minmax(0,1fr) auto' }}>
                      <div className="min-w-0 flex gap-2 items-center">
                        <span className="font-medium text-gray-500 shrink-0">用户名</span>
                        <span className="text-gray-700 truncate">{[group.userNickname, group.userPhone].filter(Boolean).join(' ') || '—'}</span>
                      </div>
                      <div className="min-w-0 grid items-center" style={{ gridTemplateColumns: '40% 60%' }}>
                        <div className="min-w-0 flex gap-2 items-center">
                          <span className="font-medium text-gray-500 shrink-0 w-14">订单号</span>
                          <span className="text-gray-700 font-mono truncate">{group.orderNumber}</span>
                        </div>
                        <div className="min-w-0 flex gap-2 items-center pl-2">
                          <span className="font-medium text-gray-500 shrink-0">配置时间</span>
                          <span className="text-gray-600 truncate">
                            {group.configEffectiveAt ? new Date(group.configEffectiveAt).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' }) : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {group.mealCounts?.lunch ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">午 {group.mealCounts.lunch}</span>
                        ) : null}
                        {group.mealCounts?.dinner ? (
                          <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700">晚 {group.mealCounts.dinner}</span>
                        ) : null}
                        {group.mealCounts?.breakfast ? (
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700">早 {group.mealCounts.breakfast}</span>
                        ) : null}
                        <span className="text-gray-400">{group.items.length} 条</span>
                      </div>
                      <div />
                    </div>
                  </div>
                </div>

                {/* 明细：展开后显示 */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">配送日期</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">餐型</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">配送时间</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">配送地标签</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">配送反馈</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">锁定</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {group.items.map((delivery) => {
                          const isLocked = delivery.is_locked === true;
                          const isExpired = !!delivery.delivery_date && delivery.delivery_date < todayStr;
                          const feedbackStatus = delivery.delivery_feedback_status || '待配送';
                          return (
                            <tr
                              key={delivery.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedDelivery(delivery); }}
                              className={`cursor-pointer hover:bg-gray-50 ${
                                isExpired ? 'bg-gray-100 text-gray-400' : (isLocked ? 'bg-yellow-50/50' : '')
                              }`}
                            >
                              <td className={`px-4 py-2 text-sm font-mono ${isExpired ? 'text-gray-400' : 'text-gray-500'}`} title={delivery.id}>
                                {delivery.id.slice(0, 8)}…
                              </td>
                              <td className={`px-4 py-2 text-sm ${isExpired ? 'text-gray-400' : ''}`}>
                                {formatDateCN(delivery.delivery_date)} ({getDayOfWeek(delivery.delivery_date)})
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                                  isExpired ? 'bg-gray-200 text-gray-500 border border-gray-300' : (mealTypeStyles[getMealTypeKey(delivery.item_name)] || 'bg-gray-100')
                                }`}>
                                  <Package className="w-3.5 h-3.5" />
                                  {delivery.item_name || (delivery.delivery_type === 'meal' ? '餐食' : '补剂')}
                                </span>
                              </td>
                              <td className={`px-4 py-2 text-sm ${isExpired ? 'text-gray-400' : 'text-gray-500'}`}>
                                {delivery.delivery_time || '-'}
                              </td>
                              <td className={`px-4 py-2 text-sm ${isExpired ? 'text-gray-400' : 'text-gray-600'}`}>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isExpired ? 'bg-gray-200 text-gray-500' : getAddressTagClass(delivery.delivery_address_label)
                                }`}>
                                  {delivery.delivery_address_label || '未标记'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  isExpired ? 'bg-gray-200 text-gray-500' : (statusColors[delivery.status] || 'bg-gray-100')
                                }`} title={`状态更新时间：${formatDateTimeCN(delivery.status_updated_at || delivery.updated_at)}`}>
                                  {getStatusLabel(delivery.status)}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  isExpired ? 'bg-gray-200 text-gray-500' : (feedbackColors[feedbackStatus] || 'bg-gray-100 text-gray-700')
                                }`}>
                                  {feedbackStatus}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                {isLocked ? (
                                  <div className={`text-xs ${isExpired ? 'text-gray-500' : 'text-red-600'}`}>
                                    <div>🔒 已锁定</div>
                                    <div className={`text-[11px] mt-0.5 ${isExpired ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {(delivery.lock_time || delivery.updated_at || delivery.created_at)
                                        ? new Date(delivery.lock_time || delivery.updated_at || delivery.created_at || '').toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' })
                                        : '—'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className={`text-xs ${isExpired ? 'text-gray-500' : 'text-green-600'}`}>可修改</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ListPagination
        page={page}
        totalPages={totalPages}
        total={totalGroupCount}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
      />

      {/* 配送计划详情弹窗 */}
      {selectedDelivery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedDelivery(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">配送计划详情</h3>
                <button
                  onClick={() => setSelectedDelivery(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                    <ReceiptText className="w-4 h-4 text-gray-500" />
                    订单信息
                  </h4>
                  <div>
                    <div className="text-gray-500">用户</div>
                    <div>{[selectedDelivery.user_profiles?.nickname || '用户', selectedDelivery.user_profiles?.phone].filter(Boolean).join(' ') || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">订单号</div>
                    <div className="font-mono">{selectedDelivery.orders?.order_number || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">配送计划 ID</div>
                    <div className="font-mono text-gray-900 break-all">{selectedDelivery.id}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">配置生效时间</div>
                    <div>{(selectedDelivery.updated_at || selectedDelivery.created_at)
                      ? new Date(selectedDelivery.updated_at || selectedDelivery.created_at || '').toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' })
                      : '—'}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-gray-500" />
                    配送计划信息
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 py-0.5">
                      <span className="text-gray-500 shrink-0 w-20">配送日期</span>
                      <span>{formatDateCN(selectedDelivery.delivery_date)} {selectedDelivery.delivery_time ? `(${selectedDelivery.delivery_time})` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 py-0.5">
                      <span className="text-gray-500 shrink-0 w-20">餐型</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${mealTypeStyles[getMealTypeKey(selectedDelivery.item_name)] || 'bg-gray-100 text-gray-700'}`}>
                        <Package className="w-3.5 h-3.5" />
                        {selectedDelivery.item_name || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 py-0.5">
                      <span className="text-gray-500 shrink-0 w-20">锁定</span>
                      <span className={selectedDelivery.is_locked ? 'text-red-600' : 'text-green-600'}>
                        {selectedDelivery.is_locked ? '🔒 已锁定' : '可修改'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 py-0.5">
                      <span className="text-gray-500 shrink-0 w-20">锁定时间</span>
                      <span>{(selectedDelivery.lock_time || selectedDelivery.updated_at || selectedDelivery.created_at)
                        ? new Date(selectedDelivery.lock_time || selectedDelivery.updated_at || selectedDelivery.created_at || '').toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' })
                        : '—'}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-blue-700 font-medium inline-flex items-center gap-1">
                      配送地址信息
                      <span className="text-blue-500">→</span>
                      </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAddressTagClass(selectedDelivery.delivery_address_label)}`}>
                      {selectedDelivery.delivery_address_label || '未标记'}
                    </span>
                  </div>
                    <div className="space-y-1 text-gray-800">
                    <div><span className="text-gray-500 mr-2">地址</span>{selectedDelivery.delivery_address || '—'}</div>
                    <div><span className="text-gray-500 mr-2">联系人</span>{selectedDelivery.delivery_contact_name || '—'}</div>
                    <div><span className="text-gray-500 mr-2">联系电话</span>{selectedDelivery.delivery_contact_phone || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                  <MessageSquareMore className="w-4 h-4 text-gray-500" />
                  配送反馈信息
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-gray-500">状态</div>
                    <span className={`inline-flex mt-1 px-2 py-0.5 text-xs rounded ${statusColors[selectedDelivery.status] || 'bg-gray-100 text-gray-700'}`}>
                      {getStatusLabel(selectedDelivery.status)}
                    </span>
                  </div>
                  <div>
                    <div className="text-gray-500">状态更新时间</div>
                    <div>{formatDateTimeCN(selectedDelivery.status_updated_at || selectedDelivery.updated_at)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">最后回调时间</div>
                    <div>{formatDateTimeCN(selectedDelivery.last_callback_at)}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">
                    当前状态默认由系统流程/三方回调自动同步；仅在异常场景下手动修正。
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualStatusEditor((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-white"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {showManualStatusEditor ? '收起手动修正' : '展开手动修正'}
                  </button>
                  {showManualStatusEditor ? (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value)}
                        className="border rounded px-2 py-1 text-sm bg-white"
                        disabled={updatingStatus}
                      >
                        {getAllowedNextStatuses(selectedDelivery.status).map((s) => (
                          <option key={s} value={s}>
                            {getStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleUpdateDeliveryStatus}
                        disabled={updatingStatus || !nextStatus || nextStatus === selectedDelivery.status}
                        className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatingStatus ? '更新中...' : '保存状态'}
                      </button>
                    </div>
                  ) : null}
                </div>
                {(selectedDelivery.status === 'delivered' || selectedDelivery.status === 'cancelled') ? (
                  <div className="text-xs text-gray-500">当前为终态，仅允许保持原状态。</div>
                ) : null}
                {showManualStatusEditor ? (
                  <div className="text-xs text-gray-500">
                    手动修正后，后续状态仍以系统流转与回调为准。
                </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

