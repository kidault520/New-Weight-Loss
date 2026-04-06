import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../config/api';
import { Calendar, User, X, Plus, RotateCcw } from 'lucide-react';
import OrderForm from '../components/orders/OrderForm';
import SearchFilterBar from '../components/common/SearchFilterBar';
import ListPagination from '../components/common/ListPagination';

interface Order {
  id: string;
  order_number: string;
  user_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  payment_time?: string;
  order_status: string;
  confirm_status?: string;
  confirm_time?: string;
  delivery_state?: string;
  start_time?: string;
  end_time?: string;
  comment_time?: string;
  delivery_address_id?: string;
  notes?: string;
  salesperson_id?: string;
  created_at: string;
  updated_at?: string;
  products?: {
    id: string;
    product_code: string;
    product_name: string;
    duration_days: number;
    meal_plans?: { plan_name: string; plan_code?: string; duration_days: number; included_meal_types?: string[] };
    supplement_plans?: { plan_name: string; plan_code?: string; duration_days: number };
  };
  included_meal_types?: string[];
  user_profiles?: {
    user_id?: string;
    nickname?: string;
    phone?: string;
    meal_plan_configured?: boolean;
    meal_plan_config_data?: { start_date?: string; end_date?: string } | null;
  };
  /** 与 Node 管理订单接口一致：由档案 meal_plan_configured + 起止日推导 */
  plan_configured?: boolean;
  plan_config_state?: string;
  plan_config_state_zh?: string;
  sales_person?: {
    id: string;
    name: string;
    code?: string;
    display_id?: string;
    level?: string;
    team_name?: string;
  } | null;
  refund_amount?: number | null;
  refund_time?: string | null;
  refund_reason?: string | null;
  items?: any[];
  delivery_schedules?: {
    id: string;
    delivery_date?: string;
    meal_type?: string;
    status?: string;
  }[];
  [key: string]: any;
}

type ApiClientError = Error & {
  status?: number;
  code?: string;
  reason?: string;
  details?: string;
  hint?: string;
};

const ORDER_ERROR_TEXT_MAP: Record<string, string> = {
  ORDER_NOT_FOUND: '订单不存在',
  ORDER_STATE_CONFLICT: '订单状态冲突，请刷新后重试',
  ORDER_REFUND_NOT_ALLOWED: '仅可对已支付订单执行退单',
  ORDER_CANCEL_NOT_ALLOWED: '已支付订单不可取消，请使用退单',
  ORDER_DELETE_NOT_ALLOWED: '已支付订单不可删除',
  ORDER_UPDATE_NOT_ALLOWED: '订单创建后仅可修改备注',
  PRODUCT_NOT_FOUND: '商品不存在或已下架',
  VALIDATION_ERROR: '提交参数不合法，请检查后重试',
  SYSTEM_INTERNAL_ERROR: '系统繁忙，请稍后重试',
};

const resolveOrderErrorText = (error: unknown, fallback = '操作失败，请稍后重试') => {
  const e = error as ApiClientError;
  if (e?.code && ORDER_ERROR_TEXT_MAP[e.code]) return ORDER_ERROR_TEXT_MAP[e.code];
  if (e?.message) return e.message;
  return fallback;
};

/** 管理端列表：与 Node `getPlanConfigStateFromProfile` 同口径（档案起止日兼容 camelCase + 履约信号）；优先接口 plan_configured */
function extractBoundaryDatesFromRaw(raw: unknown): { start: string; end: string } {
  if (raw == null) return { start: '', end: '' };
  let o: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return { start: '', end: '' };
    try {
      o = JSON.parse(t) as Record<string, unknown>;
    } catch {
      return { start: '', end: '' };
    }
  } else if (typeof raw === 'object') {
    o = raw as Record<string, unknown>;
  }
  if (!o) return { start: '', end: '' };
  const s = o.start_date ?? o.startDate;
  const e = o.end_date ?? o.endDate;
  const norm = (v: unknown) =>
    typeof v === 'string' ? v.trim() : v != null && v !== '' ? String(v).trim() : '';
  return { start: norm(s), end: norm(e) };
}

function isOrderPlanConfigured(order: Order): boolean {
  if (typeof order.plan_configured === 'boolean') return order.plan_configured;
  const p = order.user_profiles;
  if (p) {
    const { start, end } = extractBoundaryDatesFromRaw(p.meal_plan_config_data);
    if (start.length > 0 && end.length > 0) return true;
  }
  const st = String(order.order_status || '').toLowerCase();
  if (st === 'processing' || st === 'completed') return true;
  if (order.start_time) return true;
  if (Array.isArray(order.delivery_schedules) && order.delivery_schedules.length > 0) return true;
  return false;
}

function latestStatus(order: Order) {
  if (order.payment_status === 'refunded') return { label: '已退款', time: order.refund_time || order.updated_at || order.created_at };
  if (order.order_status === 'cancelled') return { label: '已取消', time: order.updated_at || order.created_at };
  if (order.end_time) return { label: '交付结束', time: order.end_time };
  if (order.payment_status === 'paid' && order.payment_time) {
    const planOn = isOrderPlanConfigured(order);
    return {
      label: planOn ? '已支付 · 已开启计划' : '已支付 · 未开启计划',
      time: order.payment_time,
    };
  }
  if (order.confirm_status === 'confirmed' && order.confirm_time) return { label: '已确认', time: order.confirm_time };
  return { label: '已创建', time: order.created_at };
}

function isOrderInactive(order: Order) {
  return order.order_status === 'cancelled' || order.payment_status === 'refunded';
}

/** 订单状态流：创/付/确/开/结/评 单字图标，带颜色 */
const ORDER_STATUS_STEPS = [
  { key: 'create', char: '创', full: '创建' },
  { key: 'pay', char: '付', full: '支付' },
  { key: 'confirm', char: '确', full: '确认' },
  { key: 'start', char: '计', full: '配送计划' },
  { key: 'end', char: '结', full: '结束' },
  { key: 'comment', char: '评', full: '评论' },
] as const;

function OrderStatusFlow({ order, showLabels = false }: { order: Order; showLabels?: boolean }) {
  if (!order) return null;
  const isCancelled = order.order_status === 'cancelled';
  const isRefunded = order.payment_status === 'refunded';
  const steps = {
    create: true,
    pay: order.payment_status === 'paid' && !!order.payment_time,
    confirm: order.confirm_status === 'confirmed' && !!order.confirm_time,
    start: isOrderPlanConfigured(order),
    end: !!order.end_time,
    comment: !!order.comment_time,
  };

  if (isRefunded) {
    return <span className="text-xs text-gray-500 font-medium">已退款</span>;
  }
  if (isCancelled) {
    return <span className="text-xs text-gray-500 font-medium">已取消</span>;
  }
  return (
    <div className="flex items-center gap-0.5 flex-wrap" title={ORDER_STATUS_STEPS.map(s => `${s.full}:${steps[s.key] ? '✓' : '-'}`).join(' ')}>
      {ORDER_STATUS_STEPS.map((step) => {
        const done = steps[step.key];
        const colorClass = isCancelled
          ? 'bg-gray-200 text-gray-500'
          : done
          ? step.key === 'create'
            ? 'bg-slate-500 text-white'
            : step.key === 'pay'
            ? 'bg-emerald-500 text-white'
            : step.key === 'confirm'
            ? 'bg-blue-500 text-white'
            : step.key === 'start'
            ? 'bg-indigo-500 text-white'
            : step.key === 'end'
            ? 'bg-violet-500 text-white'
            : 'bg-amber-500 text-white'
          : 'bg-gray-200 text-gray-400';
        return (
          <span
            key={step.key}
            className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`}
            title={`${step.full}: ${done ? '已完成' : '未完成'}`}
          >
            {step.char}
          </span>
        );
      })}
      {showLabels && (
        <span className="ml-2 text-xs text-gray-500">
          创·付·确·计·结·评
        </span>
      )}
    </div>
  );
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [refundModal, setRefundModal] = useState<Order | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [orderFormSubmitting, setOrderFormSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterOrderStatus, setFilterOrderStatus] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterSalespersonId, setFilterSalespersonId] = useState('');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [filterConditions, setFilterConditions] = useState<{ id: string; field: string; operator: string; value: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; product_name: string; product_code: string }[]>([]);
  const [salesPersons, setSalesPersons] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const detailRequestTokenRef = useRef(0);

  const closeOrderDetail = () => {
    detailRequestTokenRef.current += 1;
    setSelectedOrder(null);
  };


  // 搜索框输入时自动搜索（防抖 400ms）
  useEffect(() => {
    const tid = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(tid);
  }, [searchTerm]);

  useEffect(() => {
    loadOrders('orders');
  }, [page, limit, filterPaymentStatus, filterOrderStatus, filterProductId, filterSalespersonId, filterAmountMin, filterAmountMax, debouncedSearch]);

  useEffect(() => {
    Promise.all([
      apiClient.get<{ products: any[] }>('/api/admin/products?is_active=true&limit=500'),
      apiClient.get<{ salesPersons: any[] }>('/api/admin/sales-persons?limit=500'),
    ]).then(([pRes, sRes]) => {
      setProducts(pRes?.products || []);
      setSalesPersons(sRes?.salesPersons || []);
    }).catch(() => {});
  }, []);

  const loadOrders = async (
    tab: 'orders' = 'orders',
    overrides?: {
      search?: string; payment?: string; order?: string;
      productId?: string; salespersonId?: string; amountMin?: string; amountMax?: string;
      pageOverride?: number;
    }
  ) => {
    try {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams();
      params.append('list_type', tab);
      const search = overrides?.search ?? debouncedSearch;
      const payment = overrides?.payment ?? filterPaymentStatus;
      const order = overrides?.order ?? filterOrderStatus;
      const productId = overrides?.productId ?? filterProductId;
      const salespersonId = overrides?.salespersonId ?? filterSalespersonId;
      const amountMin = overrides?.amountMin ?? filterAmountMin;
      const amountMax = overrides?.amountMax ?? filterAmountMax;
      const pageNum = overrides?.pageOverride ?? page;
      if (search) params.append('search', search);
      if (tab === 'orders') {
        if (payment) params.append('payment_status', payment);
        if (order) params.append('order_status', order);
        if (productId) params.append('product_id', productId);
        if (salespersonId) params.append('salesperson_id', salespersonId);
        if (amountMin) params.append('total_amount_min', amountMin);
        if (amountMax) params.append('total_amount_max', amountMax);
      }
      params.append('page', pageNum.toString());
      params.append('limit', limit.toString());

      const data = await apiClient.get<{ orders: Order[]; pagination: any }>(
        `/api/admin/orders?${params.toString()}`
      );
      setOrders(data.orders || []);
      setLoadError(null);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      const errorMessage = resolveOrderErrorText(error, '未知错误');
      setLoadError(`加载失败: ${errorMessage}。请确认后端服务已启动（默认端口 3001）`);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadOrders('orders');
  };

  const handleRefund = async () => {
    if (!refundModal) return;
    const amount = refundAmount.trim() ? parseFloat(refundAmount) : undefined;
    if (amount != null && (isNaN(amount) || amount < 0)) {
      alert('请输入有效的退款金额');
      return;
    }
    setRefundSubmitting(true);
    try {
      await apiClient.post(`/api/admin/orders/${refundModal.id}/refund`, {
        refund_amount: amount,
        refund_reason: refundReason.trim() || undefined,
      });
      setRefundModal(null);
      setRefundAmount('');
      setRefundReason('');
      closeOrderDetail();
      loadOrders('orders');
    } catch (e: any) {
      alert(resolveOrderErrorText(e, '退单失败'));
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    if (order.payment_status === 'paid') {
      alert('已支付订单不可取消，请使用退单');
      return;
    }
    if (!confirm(`确定取消订单 ${order.order_number}？`)) return;
    try {
      await apiClient.post(`/api/admin/orders/${order.id}/cancel`);
      closeOrderDetail();
      loadOrders('orders');
    } catch (e: any) {
      alert(resolveOrderErrorText(e, '取消失败'));
    }
  };

  const handleSave = async (formData: any) => {
    if (orderFormSubmitting) return;
    setOrderFormSubmitting(true);
    try {
      await apiClient.post('/api/admin/orders', formData);
      setShowForm(false);
      setEditingOrder(null);
      loadOrders('orders');
    } catch (error: any) {
      console.error('Save error:', error);
      alert(resolveOrderErrorText(error, '保存失败'));
    } finally {
      setOrderFormSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOrderStateLabel = (order: Order) => {
    const status = String(order.order_status || '').toLowerCase();
    if (status === 'cancelled') return '已取消';
    if (status === 'completed') return '已完成';
    if (status === 'processing') return '服务中';
    if (status === 'confirmed') return '已确认';
    return '待确认';
  };
  const getPaymentStateLabel = (order: Order) => (
    order.payment_status === 'refunded' ? '已退款' : order.payment_status === 'paid' ? '已支付' : '待支付'
  );
  const getAuditStateLabel = (order: Order) => (order.confirm_status === 'confirmed' ? '已确认' : '待确认');
  /** 侧栏「计划状态」：档案起止日（兼容历史字段）或本单履约（排期/已开启服务/服务中或已完成），与 payment 独立 */
  const getPlanConfigStateLabel = (order: Order) => {
    if (order.end_time) return '已结束';
    if (order.plan_config_state_zh) return order.plan_config_state_zh;
    return isOrderPlanConfigured(order) ? '已开启计划' : '未开启计划';
  };
  const getOrderStateTime = (order: Order) => (
    order.order_status === 'cancelled' ? formatDate(order.updated_at) : formatDate(order.created_at)
  );
  const getPaymentStateTime = (order: Order) => (
    order.payment_status === 'refunded'
      ? formatDate(order.refund_time || order.updated_at)
      : order.payment_status === 'paid'
        ? formatDate(order.payment_time)
        : formatDate(order.created_at)
  );
  const getAuditStateTime = (order: Order) => (
    order.confirm_status === 'confirmed' ? formatDate(order.confirm_time) : '-'
  );
  const getPlanConfigStateTime = (order: Order) => {
    if (order.end_time) return formatDate(order.end_time);
    const { start } = extractBoundaryDatesFromRaw(order.user_profiles?.meal_plan_config_data);
    if (isOrderPlanConfigured(order) && start) return start;
    return '-';
  };

  const getFlowStatusBadgeClass = (label: string, status: string) => {
    if (label === '订单状态') {
      if (status === '已取消') return 'bg-gray-100 text-gray-700';
      return 'bg-slate-100 text-slate-700';
    }
    if (label === '支付状态') {
      if (status === '已支付') return 'bg-green-100 text-green-700';
      if (status === '已退款') return 'bg-red-100 text-red-700';
      return 'bg-amber-100 text-amber-700';
    }
    if (label === '审核状态') {
      if (status === '已确认') return 'bg-blue-100 text-blue-700';
      return 'bg-yellow-100 text-yellow-700';
    }
    if (label === '计划状态') {
      if (status === '已开启计划') return 'bg-sky-100 text-sky-800';
      if (status === '已结束') return 'bg-violet-100 text-violet-700';
      return 'bg-gray-100 text-gray-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const pickFirst = (obj: any, keys: string[]) => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
    }
    return '-';
  };

  const getPaymentPlatform = (order: Order) =>
    pickFirst(order, ['payment_platform', 'payment_channel', 'pay_channel', 'channel_name']);
  const getPaymentTradeNo = (order: Order) =>
    pickFirst(order, ['payment_transaction_no', 'payment_trade_no', 'trade_no', 'transaction_id', 'payment_no']);
  const getReviewerName = (order: Order) =>
    pickFirst(order, ['reviewer_name', 'auditor_name', 'confirm_by_name', 'confirmer_name']);
  const getReviewNote = (order: Order) =>
    pickFirst(order, ['review_note', 'audit_note', 'confirm_note']);
  const getDeliveryPlanGroup = (order: Order) => {
    const groupName = pickFirst(order, ['delivery_plan_group_name', 'delivery_group_name', 'schedule_group_name']);
    if (groupName !== '-') return groupName;
    const schedules = order.delivery_schedules || [];
    return schedules.length > 0 ? `已关联 ${schedules.length} 条配送计划` : '-';
  };

  const getOrderMealTypes = (order: Order): string[] =>
    (order.included_meal_types && order.included_meal_types.length > 0)
      ? order.included_meal_types
      : ['午餐', '晚餐'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0 border-b border-gray-200">
          <span className="px-4 py-2 text-sm font-medium border-b-2 -mb-px border-blue-600 text-blue-600">
            订单列表
          </span>
        </div>
        <button
          onClick={() => { setEditingOrder(null); setShowForm(true); }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加订单
        </button>
      </div>

      {showForm && (
        <OrderForm
          order={editingOrder}
          onSave={handleSave}
          onCancel={() => { if (!orderFormSubmitting) { setShowForm(false); setEditingOrder(null); } }}
          isSubmitting={orderFormSubmitting}
        />
      )}

      {/* 搜索与筛选栏（按截图样式） */}
      <div className="mb-4">
        <SearchFilterBar
          searchPlaceholder="搜索订单号..."
          searchValue={searchTerm}
          onSearchChange={(v) => { setSearchTerm(v); setPage(1); }}
          onSearch={handleSearch}
          showAdvancedFilter={true}
          filterFields={[
            { value: 'order_number', label: '订单号' },
            {
              value: 'product_id',
              label: '商品',
              options: products.map((p) => ({ value: p.id, label: `${p.product_name} (${p.product_code})` })),
            },
            {
              value: 'payment_status',
              label: '支付状态',
              options: [
                { value: 'pending', label: '待支付' },
                { value: 'paid', label: '已支付' },
                { value: 'refunded', label: '已退款' },
              ],
            },
            {
              value: 'order_status',
              label: '订单状态',
              options: [
                { value: 'pending', label: '待确认' },
                { value: 'confirmed', label: '已确认' },
                { value: 'processing', label: '服务中' },
                { value: 'completed', label: '已完成' },
                { value: 'cancelled', label: '已取消' },
              ],
            },
            {
              value: 'salesperson_id',
              label: '销售人员',
              options: salesPersons.map((s) => ({ value: s.id, label: s.name })),
            },
            { value: 'total_amount_min', label: '金额（最低）' },
            { value: 'total_amount_max', label: '金额（最高）' },
            { value: 'created_at', label: '创建时间' },
          ]}
          filterConditions={filterConditions}
          onFilterConditionsChange={setFilterConditions}
          onFilterApply={() => {
            let newSearch = searchTerm;
            let newPayment = filterPaymentStatus;
            let newOrder = filterOrderStatus;
            let newProduct = filterProductId;
            let newSalesperson = filterSalespersonId;
            let newAmountMin = filterAmountMin;
            let newAmountMax = filterAmountMax;
            filterConditions.forEach((c) => {
              if (c.field === 'order_number' && c.value) newSearch = c.value;
              if (c.field === 'payment_status' && c.value) newPayment = c.value;
              if (c.field === 'order_status' && c.value) newOrder = c.value;
              if (c.field === 'product_id' && c.value) newProduct = c.value;
              if (c.field === 'salesperson_id' && c.value) newSalesperson = c.value;
              if (c.field === 'total_amount_min' && c.value) newAmountMin = c.value;
              if (c.field === 'total_amount_max' && c.value) newAmountMax = c.value;
            });
            setSearchTerm(newSearch);
            setFilterPaymentStatus(newPayment);
            setFilterOrderStatus(newOrder);
            setFilterProductId(newProduct);
            setFilterSalespersonId(newSalesperson);
            setFilterAmountMin(newAmountMin);
            setFilterAmountMax(newAmountMax);
            setPage(1);
            loadOrders('orders', {
              search: newSearch, payment: newPayment, order: newOrder,
              productId: newProduct, salespersonId: newSalesperson,
              amountMin: newAmountMin, amountMax: newAmountMax,
              pageOverride: 1,
            });
          }}
          onFilterClear={() => {
            setSearchTerm('');
            setFilterPaymentStatus('');
            setFilterOrderStatus('');
            setFilterProductId('');
            setFilterSalespersonId('');
            setFilterAmountMin('');
            setFilterAmountMax('');
            setPage(1);
            loadOrders('orders', {
              search: '', payment: '', order: '',
              productId: '', salespersonId: '',
              amountMin: '', amountMax: '',
              pageOverride: 1,
            });
          }}
          rightSlot={
            <div className="flex gap-2 ml-2">
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => { setFilterPaymentStatus(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">所有支付状态</option>
                  <option value="pending">待支付</option>
                  <option value="paid">已支付</option>
                  <option value="refunded">已退款</option>
                </select>
                <select
                  value={filterOrderStatus}
                  onChange={(e) => { setFilterOrderStatus(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">所有订单状态</option>
                  <option value="pending">待确认</option>
                  <option value="confirmed">已确认</option>
                  <option value="processing">服务中</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
          }
        />
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">销售人员</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单状态</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">最新状态</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loadError ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <p className="text-red-600 text-sm">{loadError}</p>
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  暂无订单
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const inactive = isOrderInactive(order);
                return (
                <tr
                  key={order.id}
                  className={`hover:bg-gray-50 cursor-pointer ${inactive ? 'bg-gray-100 text-gray-500' : ''}`}
                  onClick={async () => {
                    const token = detailRequestTokenRef.current + 1;
                    detailRequestTokenRef.current = token;
                    setSelectedOrder(order);
                    try {
                      const data = await apiClient.get<{ order: Order; items: any[]; delivery_schedules?: any[] }>(
                        `/api/admin/orders/${order.id}`
                      );
                      if (detailRequestTokenRef.current !== token) return;
                      setSelectedOrder({ ...data.order, items: data.items, delivery_schedules: data.delivery_schedules || [] });
                    } catch {
                      // 保留基础信息，不中断弹窗
                    }
                  }}
                >
                  <td className="px-3 py-3 text-sm font-mono">{order.order_number}</td>
                  <td className="px-3 py-3 text-sm">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1 text-gray-400" />
                      <div>
                        <div className="font-medium">{order.user_profiles?.nickname || '用户'}</div>
                        <div className="text-xs text-gray-500">{order.user_profiles?.phone || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="font-medium">{order.products?.product_name || '-'}</div>
                    <div className="text-xs text-gray-500">{order.products?.product_code || '-'}</div>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="flex items-center font-semibold text-red-600">
                      ¥{Number(order.total_amount ?? 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">×{order.quantity ?? 1}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">
                    {order.sales_person?.name || '—'}
                  </td>
                  <td className="px-3 py-3"><OrderStatusFlow order={order} /></td>
                  <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span className="text-gray-700">{latestStatus(order).label}</span>
                      <span className="text-gray-500">{formatDate(latestStatus(order).time)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    {order.payment_status !== 'paid' && order.payment_status !== 'refunded' && order.order_status !== 'cancelled' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancelOrder(order); }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 text-sm font-medium shadow-sm"
                      >
                        取消订单
                      </button>
                    )}
                    {(order.payment_status === 'paid' || order.payment_status === 'refunded' || order.order_status === 'cancelled') && (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
              </tr>
            );
            })
          )}
          </tbody>
        </table>
      </div>

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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">订单详情 - {selectedOrder.order_number}</h3>
              <div className="flex items-center gap-2">
                {selectedOrder.payment_status === 'paid' && (
                  <button
                    onClick={() => {
                      setRefundModal(selectedOrder);
                      setRefundAmount('');
                      setRefundReason('');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    退单
                  </button>
                )}
                <button
                  onClick={closeOrderDetail}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-5">
                <div>
                  <div className="space-y-4 mb-6">
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">订单号</span>
                          <span className="font-mono text-base">{selectedOrder.order_number}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">用户</span>
                          <span className="font-medium">
                            {selectedOrder.user_profiles?.nickname || '-'}
                            {selectedOrder.user_profiles?.phone ? `（${selectedOrder.user_profiles.phone}）` : ''}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">销售人员</span>
                          <div>
                            {selectedOrder.sales_person ? (
                              <p className="font-medium">
                                {selectedOrder.sales_person.name}
                                {(selectedOrder.sales_person.display_id || selectedOrder.sales_person.code || selectedOrder.sales_person.level) && (
                                  `（${selectedOrder.sales_person.display_id || selectedOrder.sales_person.code || '-'} ${selectedOrder.sales_person.level || '-'}）`
                                )}
                              </p>
                            ) : (
                              <>
                                <p className="text-gray-400">—</p>
                                <p className="text-xs text-amber-600 mt-1">
                                  创建时未关联，订单创建后不可修改。新建订单时请务必选择销售人员。
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">订单流程</span>
                          <div>
                            <OrderStatusFlow order={selectedOrder} showLabels />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">商品</span>
                          <span className="font-medium">
                            {selectedOrder.products?.product_name || '-'}
                            {selectedOrder.products?.product_code ? `（${selectedOrder.products.product_code}）` : ''}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">方案内容</span>
                          <div className="flex-1 space-y-2">
                            {selectedOrder.products?.meal_plans ? (
                              (() => {
                                const orderMealTypes = getOrderMealTypes(selectedOrder);
                                const durationDays =
                                  selectedOrder.products.duration_days ||
                                  selectedOrder.products.meal_plans.duration_days ||
                                  0;
                                return (
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center">
                                      <span className="text-green-700 text-xs font-bold">餐</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">
                                        {durationDays}天健康餐包
                                        {selectedOrder.products?.meal_plans?.plan_code ? (
                                          <span className="ml-2 font-mono text-xs font-normal text-emerald-900">
                                            {selectedOrder.products.meal_plans.plan_code}
                                          </span>
                                        ) : null}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        包含 {orderMealTypes.join(' + ')}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {durationDays * orderMealTypes.length}份
                                  </span>
                                </div>
                              </div>
                                );
                              })()
                            ) : null}
                            {selectedOrder.products?.supplement_plans ? (
                              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center">
                                      <span className="text-orange-700 text-xs font-bold">补</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">
                                        个性化补剂方案
                                        {selectedOrder.products?.supplement_plans?.plan_code ? (
                                          <span className="ml-2 font-mono text-xs font-normal text-orange-900">
                                            {selectedOrder.products.supplement_plans.plan_code}
                                          </span>
                                        ) : null}
                                      </p>
                                      <p className="text-xs text-gray-600">个性化营养补充</p>
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {selectedOrder.products.supplement_plans.duration_days || selectedOrder.products.duration_days || 0}份
                                  </span>
                                </div>
                              </div>
                            ) : null}
                            {!selectedOrder.products?.meal_plans && !selectedOrder.products?.supplement_plans ? (
                              <span className="text-gray-400">—</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">总金额</span>
                          <span className="font-semibold text-red-600 text-3xl">¥{Number(selectedOrder.total_amount ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">支付方式</span>
                          <span>{selectedOrder.payment_method || '-'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">支付平台</span>
                          <span>{getPaymentPlatform(selectedOrder)}</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">支付流水</span>
                          <span className="break-all">{getPaymentTradeNo(selectedOrder)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">审核人员</span>
                          <span>{getReviewerName(selectedOrder)}</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">审核备注</span>
                          <span className="break-words">{getReviewNote(selectedOrder)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm shrink-0 w-20">配送计划组</span>
                          <span>{getDeliveryPlanGroup(selectedOrder)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
                    {selectedOrder.payment_status !== 'paid' && selectedOrder.payment_status !== 'refunded' && selectedOrder.order_status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancelOrder(selectedOrder)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
                      >
                        取消订单
                      </button>
                    )}
                  </div>
                </div>

                <aside className="border border-gray-200 rounded-lg p-4 bg-white h-fit">
                  <p className="text-sm font-medium text-gray-800 mb-3">订单流</p>
                  <div className="relative pl-5">
                    <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200" />

                    {[
                      { label: '订单状态', status: getOrderStateLabel(selectedOrder), time: getOrderStateTime(selectedOrder) },
                      { label: '支付状态', status: getPaymentStateLabel(selectedOrder), time: getPaymentStateTime(selectedOrder) },
                      { label: '审核状态', status: getAuditStateLabel(selectedOrder), time: getAuditStateTime(selectedOrder) },
                      { label: '计划状态', status: getPlanConfigStateLabel(selectedOrder), time: getPlanConfigStateTime(selectedOrder) },
                    ].map((item, index) => (
                      <div key={`${item.label}-${index}`} className="relative pb-3 last:pb-0">
                        <span className="absolute -left-5 top-1.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-white shadow-sm" />
                        <div className="text-sm">
                          <p className="text-gray-500">{item.label}</p>
                          <p className="mt-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${getFlowStatusBadgeClass(item.label, item.status)}`}>
                              {item.status}
                            </span>
                          </p>
                          <p className="text-gray-500">{item.time}</p>
                        </div>
                      </div>
                    ))}

                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 退单确认弹窗 */}
      {refundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h4 className="text-lg font-semibold mb-4">退单 - {refundModal.order_number}</h4>
            <p className="text-sm text-gray-600 mb-2">
              订单金额 ¥{Number(refundModal.total_amount ?? 0).toFixed(2)}，退单后该订单将从销售业绩与佣金统计中排除。
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">退款金额（留空=全额）</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`全额 ¥${Number(refundModal.total_amount ?? 0).toFixed(2)}`}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">退单原因</label>
                <input
                  type="text"
                  placeholder="如：用户申请、服务未开启等"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRefundModal(null); setRefundAmount(''); setRefundReason(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleRefund}
                disabled={refundSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {refundSubmitting ? '处理中...' : '确认退单'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
