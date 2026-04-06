import { useEffect, useState } from 'react';
import { apiClient } from '../config/api';
import { Plus, Trash2, Package, Calendar, Layers, History, Eye } from 'lucide-react';
import ProductForm from '../components/products/ProductForm';
import { ProductConfig } from '../features/b-sales/components/ProductConfig';
import SearchFilterBar from '../components/common/SearchFilterBar';
import ListPagination from '../components/common/ListPagination';
import type { FilterCondition } from '../components/common/SearchFilterBar';

interface MealPlan {
  id: string;
  plan_name: string;
  plan_code?: string;
  duration_days: number;
}

interface SupplementPlan {
  id: string;
  plan_name: string;
  plan_code?: string;
  duration_days: number;
}

interface Product {
  id: string;
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
  has_order_references?: boolean;
  meal_plans?: MealPlan;
  supplement_plans?: SupplementPlan;
  created_at: string;
  updated_at: string;
}

interface ProductAuditLog {
  id: string;
  admin_id?: string | null;
  admin_name?: string | null;
  action: string;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  reason?: string | null;
  created_at: string;
}

interface ConfigVersionRecord {
  id: string;
  version: number;
  config_key?: string;
  effective_at?: string | null;
  source?: string | null;
  note?: string | null;
  created_by_admin_id?: string | null;
  created_by_name?: string | null;
  created_at?: string;
  latest_change_at?: string | null;
  is_current?: boolean;
  covered_order_count?: number;
  applied_order_count?: number;
  categories?: Array<{ id?: string; categoryId?: string; name: string; attributes?: string[]; attributeIds?: Record<string, string> }>;
  discount_rates?: Array<{
    id?: string;
    category: string;
    categoryId?: string;
    attribute?: string;
    attributeId?: string;
    discount_rate?: number;
    discountRate?: number;
  }>;
  product_mappings?: Array<{
    id?: string;
    productId: string;
    productName: string;
    productCode: string;
    category: string;
    categoryId?: string;
    attribute?: string;
    attributeId?: string;
  }>;
}

interface ConfigAuditLog {
  id: string;
  admin_id?: string | null;
  admin_name?: string | null;
  action: string;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  reason?: string | null;
  created_at: string;
}

type TabId = 'products' | 'config-manage';

type ApiClientError = Error & {
  status?: number;
  code?: string;
  reason?: string;
  details?: string;
  hint?: string;
};

const PRODUCT_ERROR_TEXT_MAP: Record<string, string> = {
  PRODUCT_NOT_FOUND: '商品不存在或已删除',
  PRODUCT_IN_ACTIVE_SERVICE: '该商品存在进行中的已支付订单，不能修改疗程/关联计划，可调整价格或新增商品版本',
  PRODUCT_REFERENCED_BY_ORDERS: '该商品已被订单引用，无法删除。请先下架并新建商品版本。',
  VALIDATION_ERROR: '提交参数不合法，请检查后重试',
  VERSION_IN_USE: '正在使用中的配置版本不可删除',
  VERSION_NOT_FOUND: '版本不存在或已被删除',
  VERSION_DELETE_BLOCKED: '数据库规则拦截了删除，请先执行“允许删除非当前版本”的迁移',
  SYSTEM_INTERNAL_ERROR: '系统繁忙，请稍后重试',
};

const resolveProductErrorText = (error: unknown, fallback = '操作失败，请稍后重试') => {
  const e = error as ApiClientError;
  if (e?.code && PRODUCT_ERROR_TEXT_MAP[e.code]) return PRODUCT_ERROR_TEXT_MAP[e.code];
  if (e?.message) return e.message;
  return fallback;
};

const normalizeTextKey = (value: unknown) => String(value ?? '').trim().toLowerCase();
const DEFAULT_BASE_DISCOUNT_RATE = 0.6;

export default function ProductManagement() {
  const [activeTab, setActiveTab] = useState<TabId>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [filterProductCode, setFilterProductCode] = useState('');
  const [filterProductName, setFilterProductName] = useState('');
  const [filterIsActive, setFilterIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [historyLogs, setHistoryLogs] = useState<ProductAuditLog[]>([]);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [configEditorReadonly, setConfigEditorReadonly] = useState(false);
  const [activeConfigRecord, setActiveConfigRecord] = useState<ConfigVersionRecord | null>(null);
  const [snapshotRecord, setSnapshotRecord] = useState<ConfigVersionRecord | null>(null);
  const [historyConfigRecord, setHistoryConfigRecord] = useState<ConfigVersionRecord | null>(null);
  const [configHistoryLoading, setConfigHistoryLoading] = useState(false);
  const [configHistoryLogs, setConfigHistoryLogs] = useState<ConfigAuditLog[]>([]);
  const [configRecords, setConfigRecords] = useState<ConfigVersionRecord[]>([]);
  const [configRecordsLoading, setConfigRecordsLoading] = useState(false);

  useEffect(() => {
    const tid = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(tid);
  }, [searchTerm]);

  useEffect(() => {
    loadProducts();
  }, [page, limit, debouncedSearch, filterProductCode, filterProductName, filterIsActive]);

  useEffect(() => {
    if (activeTab === 'config-manage') {
      void loadConfigRecords();
    }
  }, [activeTab]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterProductCode) params.append('product_code', filterProductCode);
      if (filterProductName) params.append('product_name', filterProductName);
      if (filterIsActive) params.append('is_active', filterIsActive);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const data = await apiClient.get<{ products: Product[]; pagination: any }>(
        `/api/admin/products?${params.toString()}`
      );
      setProducts(data.products || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error('Failed to load products:', error);
      const errorMessage = resolveProductErrorText(error, '未知错误');
      const hint = (error as ApiClientError)?.hint ? `\n\n提示: ${(error as ApiClientError).hint}` : '';
      alert(`加载商品列表失败: ${errorMessage}${hint}`);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此商品吗？删除后无法恢复。')) return;
    try {
      await apiClient.delete(`/api/admin/products/${id}`);
      loadProducts();
    } catch (error: any) {
      alert(resolveProductErrorText(error, '删除失败'));
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await apiClient.patch(`/api/admin/products/${product.id}/toggle-status`);
      loadProducts();
    } catch (error: any) {
      alert(resolveProductErrorText(error, '切换状态失败'));
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (editing) {
        await apiClient.put(`/api/admin/products/${editing.id}`, formData);
      } else {
        await apiClient.post('/api/admin/products', formData);
      }
      setShowForm(false);
      setEditing(null);
      loadProducts();
    } catch (error: any) {
      console.error('Save error:', error);
      alert(resolveProductErrorText(error, '保存失败'));
    }
  };

  const loadProductHistory = async (product: Product) => {
    try {
      setHistoryProduct(product);
      setShowHistory(true);
      setHistoryLoading(true);
      const data = await apiClient.get<{
        history: ProductAuditLog[];
      }>(`/api/admin/products/${product.id}/history?limit=100`);
      setHistoryLogs(data.history || []);
    } catch (error: any) {
      alert(resolveProductErrorText(error, '加载历史记录失败'));
      setShowHistory(false);
      setHistoryProduct(null);
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openProductDetail = (product: Product) => {
    setViewingProduct(product);
  };

  const loadConfigRecords = async () => {
    try {
      setConfigRecordsLoading(true);
      const data = await apiClient.get<{
        success: boolean;
        versions?: ConfigVersionRecord[];
      }>('/api/admin/sales-product-config/versions?limit=200');
      setConfigRecords((data?.versions || []).sort((a, b) => Number(b.version || 0) - Number(a.version || 0)));
    } catch (error: any) {
      alert(resolveProductErrorText(error, '加载配置记录失败'));
    } finally {
      setConfigRecordsLoading(false);
    }
  };

  const deleteConfigVersion = async (record: ConfigVersionRecord) => {
    if (!record?.id) return;
    if (record.is_current) {
      alert('当前使用中的版本不可删除');
      return;
    }
    if (!confirm(`确定删除历史版本 ${formatVersionLabel(displayVersion(record))} 吗？删除后无法恢复。`)) return;
    try {
      await apiClient.delete(`/api/admin/sales-product-config/versions/${record.id}`);
      if (snapshotRecord?.id === record.id) setSnapshotRecord(null);
      if (historyConfigRecord?.id === record.id) {
        setHistoryConfigRecord(null);
        setConfigHistoryLogs([]);
      }
      await loadConfigRecords();
    } catch (error: any) {
      alert(resolveProductErrorText(error, '删除版本失败'));
    }
  };

  const getRateNumber = (rate: { discount_rate?: number; discountRate?: number }) => {
    const n = Number(rate?.discountRate ?? rate?.discount_rate ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const formatRatePercent = (rate: { discount_rate?: number; discountRate?: number }) => {
    const n = getRateNumber(rate);
    return n <= 1 ? `${(n * 100).toFixed(0)}%` : `${n.toFixed(0)}%`;
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      toggle_status: '状态切换',
    };
    return map[action] || action;
  };

  const summarizeChanges = (beforeData?: Record<string, unknown> | null, afterData?: Record<string, unknown> | null) => {
    const beforeObj = beforeData || {};
    const afterObj = afterData || {};
    const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
    const ignored = new Set(['id', 'updated_at', 'created_at']);
    const fieldLabelMap: Record<string, string> = {
      product_code: '商品编号',
      product_name: '商品名称',
      description: '商品描述',
      meal_plan_id: '餐食计划',
      supplement_plan_id: '补剂疗程',
      duration_days: '时长(天)',
      price: '价格(元)',
      original_price: '原价(元)',
      cover_image_url: '封面图片',
      is_active: '启用状态',
    };
    const formatValue = (key: string, value: unknown) => {
      if (value === undefined || value === null || value === '') return '-';
      if (key === 'is_active') return value ? '启用' : '禁用';
      if (key === 'price' || key === 'original_price') {
        const n = Number(value);
        return Number.isFinite(n) ? `¥${n.toFixed(2)}` : String(value);
      }
      if (key === 'duration_days') {
        const n = Number(value);
        return Number.isFinite(n) ? `${n}天` : String(value);
      }
      return String(value);
    };
    const lines: string[] = [];
    for (const key of keys) {
      if (ignored.has(key)) continue;
      const beforeVal = (beforeObj as Record<string, unknown>)[key];
      const afterVal = (afterObj as Record<string, unknown>)[key];
      if (JSON.stringify(beforeVal) === JSON.stringify(afterVal)) continue;
      const b = formatValue(key, beforeVal);
      const a = formatValue(key, afterVal);
      const label = fieldLabelMap[key] || key;
      lines.push(`${label}: ${b} -> ${a}`);
    }
    return lines.length ? lines : ['-'];
  };

  const summarizeConfigVersionDiff = (current: ConfigVersionRecord, previous?: ConfigVersionRecord | null) => {
    if (!previous) return ['初始化配置版本'];

    const lines: string[] = [];

    const catKey = (c: { id?: string; categoryId?: string; name: string }) => c.categoryId || c.id || c.name;
    const currentCat = new Map((current.categories || []).map((c) => [catKey(c), c]));
    const prevCat = new Map((previous.categories || []).map((c) => [catKey(c), c]));
    const allCatKeys = new Set([...currentCat.keys(), ...prevCat.keys()]);
    allCatKeys.forEach((k) => {
      const c = currentCat.get(k);
      const p = prevCat.get(k);
      if (c && !p) {
        lines.push(`新增品类：${c.name}${c.categoryId ? ` (${c.categoryId})` : ''}`);
      } else if (!c && p) {
        lines.push(`删除品类：${p.name}${p.categoryId ? ` (${p.categoryId})` : ''}`);
      } else if (c && p) {
        if (c.name !== p.name) {
          lines.push(`品类名称变更：${p.name} -> ${c.name}`);
        }
        const cAttrs = new Set((c.attributes || []).map((a) => String(a || '').trim()).filter(Boolean));
        const pAttrs = new Set((p.attributes || []).map((a) => String(a || '').trim()).filter(Boolean));
        const allAttrs = new Set([...cAttrs, ...pAttrs]);
        allAttrs.forEach((attr) => {
          const hasC = cAttrs.has(attr);
          const hasP = pAttrs.has(attr);
          if (hasC && !hasP) lines.push(`新增属性：${c.name}/${attr}`);
          if (!hasC && hasP) lines.push(`删除属性：${p.name}/${attr}`);
        });
      }
    });

    const rateKey = (r: { category: string; attribute?: string }) => `${r.category}__${r.attribute || '基础'}`;
    const currentRate = new Map((current.discount_rates || []).map((r) => [rateKey(r), r]));
    const prevRate = new Map((previous.discount_rates || []).map((r) => [rateKey(r), r]));
    const allRateKeys = new Set([...currentRate.keys(), ...prevRate.keys()]);
    allRateKeys.forEach((k) => {
      const c = currentRate.get(k);
      const p = prevRate.get(k);
      if (c && !p) {
        lines.push(`新增折算率：${c.category}/${c.attribute || '基础'} = ${formatRatePercent(c)}`);
      } else if (!c && p) {
        lines.push(`删除折算率：${p.category}/${p.attribute || '基础'}`);
      } else if (c && p && getRateNumber(c) !== getRateNumber(p)) {
        lines.push(
          `折算率调整：${c.category}/${c.attribute || '基础'} ${formatRatePercent(p)} -> ${formatRatePercent(c)}`
        );
      }
    });

    const mapKey = (m: { id?: string; productId: string }) => m.id || m.productId;
    const currentMap = new Map((current.product_mappings || []).map((m) => [mapKey(m), m]));
    const prevMap = new Map((previous.product_mappings || []).map((m) => [mapKey(m), m]));
    const allMapKeys = new Set([...currentMap.keys(), ...prevMap.keys()]);
    allMapKeys.forEach((k) => {
      const c = currentMap.get(k);
      const p = prevMap.get(k);
      if (c && !p) {
        lines.push(`新增商品映射：${c.productCode || '-'} | ${c.productName || c.productId} -> ${c.category}/${c.attribute || '基础'}`);
      } else if (!c && p) {
        lines.push(`删除商品映射：${p.productCode || '-'} | ${p.productName || p.productId}`);
      } else if (c && p) {
        const before = `${p.category}/${p.attribute || '基础'}`;
        const after = `${c.category}/${c.attribute || '基础'}`;
        if (before !== after) {
          lines.push(`商品映射调整：${c.productCode || '-'} | ${c.productName || c.productId} ${before} -> ${after}`);
        }
      }
    });

    if (current.note) lines.push(`备注：${current.note}`);
    return lines.length > 0 ? lines : ['未检测到结构性变更'];
  };

  const summarizeConfigAuditChange = (log: ConfigAuditLog) => {
    const before = (log.before_data || {}) as Record<string, unknown>;
    const after = (log.after_data || {}) as Record<string, unknown>;

    const toVersion = (obj: Record<string, unknown>) => Number(obj.version || 0);
    const beforeVersion = toVersion(before);
    const afterVersion = toVersion(after);

    const lines: string[] = [];
    const noteText = String(after.note || log.reason || '').trim();
    if (beforeVersion || afterVersion) {
      const from = beforeVersion ? formatVersionLabel(beforeVersion) : '-';
      const to = afterVersion ? formatVersionLabel(afterVersion) : '-';
      lines.push(`版本: ${from} -> ${to}${noteText ? `（备注：${noteText}）` : ''}`);
    } else if (noteText) {
      lines.push(`备注：${noteText}`);
    }

    const normalizeAuditConfig = (obj: Record<string, unknown>): ConfigVersionRecord => {
      const categories = (Array.isArray(obj.categories) ? obj.categories : []) as ConfigVersionRecord['categories'];
      const mappingsRaw = (
        Array.isArray(obj.productMappings) ? obj.productMappings : Array.isArray(obj.product_mappings) ? obj.product_mappings : []
      ) as Array<Record<string, unknown>>;
      const ratesRaw = (
        Array.isArray(obj.discountRates) ? obj.discountRates : Array.isArray(obj.discount_rates) ? obj.discount_rates : []
      ) as Array<Record<string, unknown>>;
      return {
        id: String(obj.id || ''),
        version: Number(obj.version || 0),
        effective_at: (obj.effectiveAt || obj.effective_at || null) as string | null,
        categories,
        product_mappings: mappingsRaw.map((m) => ({
          id: String(m.id || ''),
          productId: String(m.productId || m.product_id || ''),
          productName: String(m.productName || m.product_name || ''),
          productCode: String(m.productCode || m.product_code || ''),
          category: String(m.category || ''),
          categoryId: String(m.categoryId || m.category_id || ''),
          attribute: String(m.attribute || ''),
          attributeId: String(m.attributeId || m.attribute_id || ''),
        })),
        discount_rates: ratesRaw.map((r) => ({
          id: String(r.id || ''),
          category: String(r.category || ''),
          categoryId: String(r.categoryId || r.category_id || ''),
          attribute: String(r.attribute || ''),
          attributeId: String(r.attributeId || r.attribute_id || ''),
          discount_rate: getRateNumber({
            discountRate: Number(r.discountRate),
            discount_rate: Number(r.discount_rate),
          }),
          discountRate: getRateNumber({
            discountRate: Number(r.discountRate),
            discount_rate: Number(r.discount_rate),
          }),
        })),
      };
    };

    const beforeConfig = normalizeAuditConfig(before);
    const afterConfig = normalizeAuditConfig(after);
    const diffLines = summarizeConfigVersionDiff(afterConfig, beforeConfig);
    lines.push(...diffLines.filter((line) => line !== '初始化配置版本' && line !== '未检测到结构性变更'));

    if (lines.length === 0) lines.push('配置内容有更新');
    return lines.slice(0, 12);
  };

  const getConfigAuditNote = (log: ConfigAuditLog) => {
    const after = (log.after_data || {}) as Record<string, unknown>;
    const note = String(after.note || log.reason || '').trim();
    return note;
  };

  const isAuditRelatedToVersion = (log: ConfigAuditLog, version: number) => {
    const before = (log.before_data || {}) as Record<string, unknown>;
    const after = (log.after_data || {}) as Record<string, unknown>;
    const beforeVersion = Number(before.version || 0);
    const afterVersion = Number(after.version || 0);
    return beforeVersion === version || afterVersion === version;
  };

  const displayVersionByRaw = (rawVersion: number) => Number(rawVersion || 0);

  const displayVersion = (record: ConfigVersionRecord | null | undefined) => {
    return Number(record?.version || 0);
  };

  const formatVersionLabel = (rawVersion: number) => `v${displayVersionByRaw(rawVersion)}`;

  const selectedConfigVersionNote = (() => {
    if (!historyConfigRecord) return '';
    const fromRecord = String(historyConfigRecord.note || '').trim();
    if (fromRecord) return fromRecord;
    const fromLogs = (configHistoryLogs || []).map(getConfigAuditNote).find((t) => Boolean(t));
    return String(fromLogs || '').trim();
  })();

  return (
    <div>
      <div className="flex gap-2 border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'products'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Package className="w-4 h-4 inline mr-1" />
          商品列表
        </button>
        <button
          onClick={() => setActiveTab('config-manage')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'config-manage'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-1" />
          产品配置管理
        </button>
      </div>

      {activeTab === 'config-manage' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold">版本管理</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveConfigRecord(null);
                setConfigEditorReadonly(false);
                setShowConfigEditor(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加配置
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">版本</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">生效时间</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                    title="覆盖订单：生效时间命中该版本窗口的已支付订单"
                  >
                    覆盖订单
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                    title="应用订单：覆盖订单中，命中该版本商品映射与折算规则的订单"
                  >
                    应用订单
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {configRecordsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        加载中...
                      </div>
                    </td>
                  </tr>
                ) : configRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      暂无配置记录，点击“添加配置”开始
                    </td>
                  </tr>
                ) : (
                  configRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setActiveConfigRecord(record);
                        setConfigEditorReadonly(true);
                        setShowConfigEditor(true);
                      }}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatVersionLabel(displayVersion(record))}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(record.effective_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.covered_order_count || 0} 单</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.applied_order_count || 0} 单</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            record.is_current ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {record.is_current ? '启用中' : '历史版本，停用中'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSnapshotRecord(record);
                            }}
                            className="text-gray-600 hover:text-gray-800"
                            title="查看"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryConfigRecord(record);
                              void (async () => {
                                try {
                                  setConfigHistoryLoading(true);
                                  const data = await apiClient.get<{ history?: ConfigAuditLog[] }>(
                                    '/api/admin/sales-product-config/versions/history?limit=200'
                                  );
                                  const logs = data.history || [];
                                  setConfigHistoryLogs(
                                    logs.filter(
                                      (log) =>
                                        log.action !== 'save_draft' &&
                                        isAuditRelatedToVersion(log, Number(record.version || 0))
                                    )
                                  );
                                } catch (error: any) {
                                  alert(resolveProductErrorText(error, '加载配置历史失败'));
                                  setConfigHistoryLogs([]);
                                } finally {
                                  setConfigHistoryLoading(false);
                                }
                              })();
                            }}
                            className="ml-4 text-gray-600 hover:text-gray-800"
                            title="历史记录"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {!record.is_current && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteConfigVersion(record);
                              }}
                              className="ml-4 text-red-600 hover:text-red-800"
                              title="删除版本"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'products' && (
        <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">商品列表</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加商品
        </button>
      </div>

      {showForm && (
        <ProductForm
          product={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="mb-4">
        <SearchFilterBar
          searchPlaceholder="搜索商品名称或编号..."
          searchValue={searchTerm}
          onSearchChange={(v) => { setSearchTerm(v); setPage(1); }}
          onSearch={() => loadProducts()}
          filterFields={[
            { value: 'product_code', label: '商品编号' },
            { value: 'product_name', label: '商品名称' },
            {
              value: 'is_active',
              label: '状态',
              options: [
                { value: 'true', label: '启用' },
                { value: 'false', label: '禁用' },
              ],
            },
          ]}
          filterConditions={filterConditions}
          onFilterConditionsChange={setFilterConditions}
          onFilterApply={() => {
            let code = '', name = '', active = '';
            filterConditions.forEach((c) => {
              if (c.field === 'product_code') code = c.value;
              if (c.field === 'product_name') name = c.value;
              if (c.field === 'is_active') active = c.value;
            });
            setFilterProductCode(code);
            setFilterProductName(name);
            setFilterIsActive(active);
            setPage(1);
            loadProducts();
          }}
          onFilterClear={() => {
            setFilterConditions([]);
            setFilterProductCode('');
            setFilterProductName('');
            setFilterIsActive('');
            setPage(1);
            loadProducts();
          }}
        />
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品编号</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">包含计划</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时长</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">价格</th>
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
            ) : loadedOnce && products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  暂无商品，点击"添加商品"开始创建
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openProductDetail(product)}
                >
                  <td className="px-4 py-3 text-sm font-mono">{product.product_code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{product.product_name}</div>
                    {product.description && (
                      <div className="text-xs text-gray-500 mt-1">{product.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="space-y-1">
                      {product.meal_plans && (
                        <div className="flex flex-wrap items-center gap-x-1 text-blue-600">
                          <Package className="w-3 h-3 mr-1 shrink-0" />
                          <span>餐食: {product.meal_plans.plan_name}</span>
                          {product.meal_plans.plan_code ? (
                            <span className="font-mono text-xs text-blue-800 bg-blue-50 px-1 rounded">
                              {product.meal_plans.plan_code}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {product.supplement_plans && (
                        <div className="flex flex-wrap items-center gap-x-1 text-green-600">
                          <Package className="w-3 h-3 mr-1 shrink-0" />
                          <span>补剂: {product.supplement_plans.plan_name}</span>
                          {product.supplement_plans.plan_code ? (
                            <span className="font-mono text-xs text-green-800 bg-green-50 px-1 rounded">
                              {product.supplement_plans.plan_code}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                      {product.duration_days} 天
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold text-red-600">¥{product.price.toFixed(2)}</div>
                      {product.original_price && product.original_price > product.price && (
                        <div className="text-xs text-gray-400 line-through">¥{product.original_price.toFixed(2)}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(product);
                      }}
                      className={`px-2 py-1 text-xs rounded ${
                        product.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {product.is_active ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(product.id);
                        }}
                        className={`${
                          product.has_order_references
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-800'
                        }`}
                        title={product.has_order_references ? '该商品已被订单引用，不可删除' : '删除'}
                        disabled={!!product.has_order_references}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadProductHistory(product);
                        }}
                        className="ml-4 text-gray-600 hover:text-gray-800"
                        title="历史"
                      >
                        <History className="w-4 h-4" />
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
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
      />
        </>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">商品历史变更</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {historyProduct ? `${historyProduct.product_code} | ${historyProduct.product_name}` : '-'}
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
            <div className="p-5 overflow-auto max-h-[calc(80vh-76px)]">
              {historyLoading ? (
                <div className="text-center text-gray-500 py-12">加载中...</div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-12">暂无历史记录</div>
              ) : (
                <div className="space-y-4">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">{actionLabel(log.action)}</span>
                          <span className="text-xs text-gray-500">{formatDateTime(log.created_at)}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          操作员: {log.admin_name || '-'}
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-700 break-all">
                        变更: {summarizeChanges(log.before_data, log.after_data).join('；')}
                        {log.reason ? ` ｜ 原因: ${log.reason}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingProduct && (
        <ProductForm
          product={viewingProduct}
          readonly
          onSave={() => {}}
          onCancel={() => setViewingProduct(null)}
          onRequestEdit={() => {
            setEditing(viewingProduct);
            setShowForm(true);
            setViewingProduct(null);
          }}
        />
      )}

      {showConfigEditor && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center overflow-y-auto"
          onClick={() => setShowConfigEditor(false)}
        >
          <div
            className="w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-2">
              <ProductConfig
                mode="currentOnly"
                readonly={configEditorReadonly}
                snapshot={
                  activeConfigRecord
                    ? {
                        version: displayVersion(activeConfigRecord),
                        effective_at: activeConfigRecord.effective_at,
                        is_current: activeConfigRecord.is_current,
                        categories: (activeConfigRecord.categories || []).map((c) => ({
                          id: String(c.id || c.categoryId || c.name || ''),
                          name: c.name,
                          attributes: c.attributes ?? [],
                          categoryId: c.categoryId,
                          attributeIds: c.attributeIds,
                        })),
                        product_mappings: (activeConfigRecord.product_mappings || []).map((m) => ({
                          ...m,
                          productId: String(m.productId || ''),
                          productCode: String(m.productCode || ''),
                          productName: String(m.productName || ''),
                          category: String(m.category || ''),
                          price: 0,
                        })),
                        discount_rates: (activeConfigRecord.discount_rates || []).map((r) => ({
                          category: String(r.category || ''),
                          attribute: r.attribute,
                          discountRate: Number(r.discountRate ?? r.discount_rate ?? 0),
                        })),
                      }
                    : null
                }
                onRequestEdit={
                  activeConfigRecord?.is_current
                    ? () => {
                        setConfigEditorReadonly(false);
                      }
                    : undefined
                }
                onCancel={() => setShowConfigEditor(false)}
                onPublishSuccess={() => {
                  setShowConfigEditor(false);
                  setActiveTab('config-manage');
                  void loadConfigRecords();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {snapshotRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
          onClick={() => setSnapshotRecord(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-6xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">版本快照 {formatVersionLabel(displayVersion(snapshotRecord))}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  生效时间 {snapshotRecord.effective_at ? formatDateTime(snapshotRecord.effective_at) : '-'} ·{' '}
                  {snapshotRecord.is_current ? '当前使用中' : '历史版本，停用中'}
                </p>
              </div>
              <button
                onClick={() => setSnapshotRecord(null)}
                className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">覆盖订单</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">应用订单</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">最近改动时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-700">{snapshotRecord.covered_order_count || 0} 单</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{snapshotRecord.applied_order_count || 0} 单</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDateTime(snapshotRecord.latest_change_at || snapshotRecord.created_at || '')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">品类与折算率配置</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                    <div className="col-span-2 px-4 py-2">品类</div>
                    <div className="col-span-4 px-4 py-2">属性</div>
                    <div className="col-span-6 px-4 py-2">折算率</div>
                  </div>
                  {(snapshotRecord.categories || []).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">暂无</div>
                  ) : (
                    (snapshotRecord.categories || []).map((c, idx) => {
                      const rates = (snapshotRecord.discount_rates || []).filter((r) => {
                        const sameCategoryId =
                          normalizeTextKey(r.categoryId) && normalizeTextKey(c.categoryId)
                            ? normalizeTextKey(r.categoryId) === normalizeTextKey(c.categoryId)
                            : false;
                        const sameCategoryName = normalizeTextKey(r.category) === normalizeTextKey(c.name);
                        return sameCategoryId || sameCategoryName;
                      });
                      const isBaseRate = (r: { attribute?: string; attributeId?: string }) => {
                        const attr = normalizeTextKey(r.attribute);
                        const attrId = normalizeTextKey(r.attributeId);
                        return !attrId && (!attr || attr === '基础' || attr === 'base');
                      };
                      const baseRate = rates.find((r) => isBaseRate(r));
                      return (
                        <div
                          key={`${c.id || c.name}-rate-${idx}`}
                          className="grid grid-cols-12 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="col-span-2 px-4 py-3 text-sm font-semibold text-gray-900">
                            {c.name} {c.categoryId ? `(${c.categoryId})` : ''}
                          </div>
                          <div className="col-span-4 px-4 py-3">
                            {(c.attributes || []).length === 0 ? (
                              <span className="text-sm text-gray-400">-</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {(c.attributes || []).map((attr, attrIdx) => (
                                  <span
                                    key={`${c.id || c.name}-rate-attr-${attr}-${attrIdx}`}
                                    className="inline-flex px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700"
                                  >
                                    {attr}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="col-span-6 px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                                基础 {formatRatePercent(baseRate || { discountRate: DEFAULT_BASE_DISCOUNT_RATE, discount_rate: DEFAULT_BASE_DISCOUNT_RATE })}
                              </span>
                              {(c.attributes || []).map((attr, attrIdx) => {
                                const attrId = c.attributeIds?.[attr] || '';
                                const attrRate = rates.find((r) => {
                                  const sameAttrId =
                                    normalizeTextKey(r.attributeId) && normalizeTextKey(attrId)
                                      ? normalizeTextKey(r.attributeId) === normalizeTextKey(attrId)
                                      : false;
                                  const sameAttrName = normalizeTextKey(r.attribute) === normalizeTextKey(attr);
                                  return sameAttrId || sameAttrName;
                                });
                                return (
                                  <span
                                    key={`${c.id || c.name}-rate-chip-${attr}-${attrIdx}`}
                                    className="inline-flex px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700"
                                  >
                                    {attr} {formatRatePercent(attrRate || { discountRate: 0, discount_rate: 0 })}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">商品映射</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">商品</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">品类</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">属性</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(snapshotRecord.product_mappings || []).length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-3 text-sm text-gray-500">暂无</td></tr>
                      ) : (
                        (snapshotRecord.product_mappings || []).map((m, idx) => (
                          <tr key={`${m.id || m.productId}-${idx}`}>
                            <td className="px-4 py-3 text-sm text-gray-700">{m.productCode || '-'} | {m.productName || m.productId}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{m.category}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{m.attribute || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {historyConfigRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setHistoryConfigRecord(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">配置历史记录</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {formatVersionLabel(displayVersion(historyConfigRecord))} | {formatDateTime(historyConfigRecord.effective_at)}
                </p>
                {selectedConfigVersionNote ? (
                  <p className="text-sm text-indigo-700 mt-1">
                    备注：{selectedConfigVersionNote}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setHistoryConfigRecord(null)}
                className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
            <div className="p-5 overflow-auto max-h-[calc(80vh-76px)]">
              {configHistoryLoading ? (
                <div className="text-center text-gray-500 py-12">加载中...</div>
              ) : configHistoryLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-12">暂无历史记录</div>
              ) : (
                <div className="space-y-4">
                  {configHistoryLogs.map((log) => {
                    const lines = summarizeConfigAuditChange(log);
                    return (
                      <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                              {log.action === 'publish' ? '发布' : log.action === 'delete_version' ? '删除版本' : '更新'}
                            </span>
                            <span className="text-xs text-gray-500">{formatDateTime(log.created_at)}</span>
                          </div>
                          <div className="text-xs text-gray-500">操作员: {log.admin_name || '-'}</div>
                        </div>
                        <div className="mt-3 text-sm text-gray-700 break-all space-y-1">
                          {lines.map((line, idx) => (
                            <div key={`${log.id}-line-${idx}`}>变更: {line}</div>
                          ))}
                          {(() => {
                            const note = getConfigAuditNote(log);
                            const reason = String(log.reason || '').trim();
                            if (!reason) return null;
                            if (note && reason === note) return null;
                            return <div>原因: {reason}</div>;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

