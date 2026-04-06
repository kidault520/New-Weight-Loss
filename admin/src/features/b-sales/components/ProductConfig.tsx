/**
 * B 端产品配置
 * 流程：1. 品类/属性/折算率一体配置 → 2. 商品从商品管理同步
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  DollarSign,
  Tag,
  Layers,
  RefreshCw,
  X,
} from 'lucide-react';
import { apiClient } from '@/config/api';
import { ProductDiscountRate } from '../types/commissionRules';

const STORAGE_KEY = 'b_sales_product_config';

// 品类与属性
interface CategoryConfig {
  id: string;
  name: string;
  attributes: string[];
  categoryId?: string;
  attributeIds?: Record<string, string>;
}

// 商品与品类/属性的映射（从商品管理同步）
interface ProductMapping {
  productId: string;
  productCode: string;
  productName: string;
  price: number;
  category: string;
  attribute?: string;
  mappingId?: string;
  categoryId?: string;
  attributeId?: string;
}

interface StoredConfig {
  categories: CategoryConfig[];
  productMappings: ProductMapping[];
  discountRates: ProductDiscountRate[];
}

const normalizeRateKey = (rate: (Partial<ProductDiscountRate> & { categoryId?: string; attributeId?: string })) =>
  `${String(rate?.categoryId || rate?.category || '').trim().toLowerCase()}__${String(rate?.attributeId || rate?.attribute || '').trim().toLowerCase()}`;
const normalizeEntityKey = (value?: string) => String(value || '').trim().toLowerCase();
const categoryLockKey = (cat: { categoryId?: string; name?: string }) =>
  normalizeEntityKey(cat.categoryId || cat.name);
const attributeLockKey = (cat: { categoryId?: string; name?: string }, attr?: string, attrId?: string) =>
  `${categoryLockKey(cat)}__${normalizeEntityKey(attrId || attr)}`;
const mappingLockKey = (m: ProductMapping) =>
  normalizeEntityKey(m.mappingId || `${m.productId || ''}__${m.categoryId || m.category || ''}__${m.attributeId || m.attribute || ''}`);

const categoryLabel = (cat: CategoryConfig) => `${cat.name}${cat.categoryId ? ` (${cat.categoryId})` : ''}`;
const attrLabel = (cat: CategoryConfig, attr: string) => `${attr}${cat.attributeIds?.[attr] ? ` (${cat.attributeIds[attr]})` : ''}`;
const mappingCategoryLabel = (m: ProductMapping) => `${m.category}${m.categoryId ? ` (${m.categoryId})` : ''}`;
const mappingAttributeLabel = (m: ProductMapping) =>
  m.attribute ? `${m.attribute}${m.attributeId ? ` (${m.attributeId})` : ''}` : '';
const rateCategoryLabel = (r: ProductDiscountRate & { categoryId?: string }) =>
  `${r.category || '未选择品类'}${r.categoryId ? ` (${r.categoryId})` : ''}`;
const rateAttributeLabel = (r: ProductDiscountRate & { attributeId?: string }) =>
  r.attribute ? `${r.attribute}${r.attributeId ? ` (${r.attributeId})` : ''}` : '';
const DEFAULT_DISCOUNT_RATE = 0.6;
const pad2 = (n: number) => String(n).padStart(2, '0');
const parsePlIndex = (value?: string) => {
  const m = String(value || '').match(/^pl(\d+)$/i);
  return m ? Number(m[1]) : null;
};
const nextCategoryIdPreview = (categories: CategoryConfig[]) => {
  const max = categories.reduce((acc, c) => {
    const v = parsePlIndex(c.categoryId);
    return v && v > acc ? v : acc;
  }, 0);
  return `pl${pad2(max + 1)}`;
};

const upsertCategoryRates = (
  allRates: ProductDiscountRate[],
  categoryName: string,
  entries: Array<{ attribute?: string; discountRate: number }>
) => {
  const keep = allRates.filter((r) => r.category !== categoryName);
  const hasAttributeEntries = entries.some((e) => String(e.attribute || '').trim().length > 0);
  const normalizedEntries = hasAttributeEntries
    ? entries.filter((e) => String(e.attribute || '').trim().length > 0)
    : entries;
  const add = normalizedEntries.map((e) => ({
    category: categoryName,
    attribute: e.attribute || undefined,
    discountRate: Number.isFinite(Number(e.discountRate)) ? Number(e.discountRate) : DEFAULT_DISCOUNT_RATE,
  }));
  return dedupeRates([...keep, ...add]);
};

const toPercentDisplay = (rate: number) => Number((Number(rate || 0) * 100).toFixed(2));
const fromPercentInput = (value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.min(100, Math.max(0, n));
  return clamped / 100;
};


const dedupeRates = (rates: ProductDiscountRate[]): ProductDiscountRate[] => {
  const list = Array.isArray(rates) ? rates : [];
  const seen = new Set<string>();
  const out: ProductDiscountRate[] = [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    const key = normalizeRateKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.unshift(item);
  }
  return out;
};

const loadConfig = (): StoredConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        categories: parsed.categories || [],
        productMappings: parsed.productMappings || [],
        discountRates: dedupeRates(parsed.discountRates || []),
      };
    }
  } catch (e) {
    console.error('Load config error:', e);
  }
  return { categories: [], productMappings: [], discountRates: [] };
};

const saveConfig = (config: StoredConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

const countDraftChanges = (base: StoredConfig | null, next: StoredConfig): number => {
  if (!base) return 0;
  let count = 0;
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  const baseCats = new Map((base.categories || []).map((c) => [categoryLockKey(c), c]));
  const nextCats = new Map((next.categories || []).map((c) => [categoryLockKey(c), c]));
  const allCatKeys = new Set([...baseCats.keys(), ...nextCats.keys()]);
  allCatKeys.forEach((k) => {
    const b = baseCats.get(k);
    const n = nextCats.get(k);
    if (!b || !n) {
      count += 1;
      return;
    }
    if (!same({ name: b.name, attributes: b.attributes, attributeIds: b.attributeIds }, { name: n.name, attributes: n.attributes, attributeIds: n.attributeIds })) {
      count += 1;
    }
  });

  const baseMappings = new Map((base.productMappings || []).map((m) => [String(m.mappingId || m.productId), m]));
  const nextMappings = new Map((next.productMappings || []).map((m) => [String(m.mappingId || m.productId), m]));
  const allMappingKeys = new Set([...baseMappings.keys(), ...nextMappings.keys()]);
  allMappingKeys.forEach((k) => {
    const b = baseMappings.get(k);
    const n = nextMappings.get(k);
    if (!b || !n || !same({ productId: b.productId, categoryId: b.categoryId, attributeId: b.attributeId, category: b.category, attribute: b.attribute }, { productId: n.productId, categoryId: n.categoryId, attributeId: n.attributeId, category: n.category, attribute: n.attribute })) {
      count += 1;
    }
  });

  const baseRates = new Map((base.discountRates || []).map((r) => [normalizeRateKey(r), r]));
  const nextRates = new Map((next.discountRates || []).map((r) => [normalizeRateKey(r), r]));
  const allRateKeys = new Set([...baseRates.keys(), ...nextRates.keys()]);
  allRateKeys.forEach((k) => {
    const b = baseRates.get(k);
    const n = nextRates.get(k);
    if (!b || !n || Number(b.discountRate || 0) !== Number(n.discountRate || 0)) {
      count += 1;
    }
  });
  return count;
};

const hasAttributeDetailRates = (category: CategoryConfig, rates: ProductDiscountRate[]) => {
  const attrs = new Set((category.attributes || []).map((a) => String(a || '').trim()));
  return rates.some((r) => r.category === category.name && String(r.attribute || '').trim() && attrs.has(String(r.attribute || '').trim()));
};

const resolveSyncErrorText = (error: any) => {
  if (!error) return '保存配置失败，请稍后重试。';
  const detail = String(error?.hint || error?.details || error?.message || '').trim();
  if (error?.code === 'CONFIG_ENTITY_IN_USE') {
    return '发布失败：存在已被生效订单使用的品类/属性/映射/折算率被修改或删除。请仅新增，或在编辑弹窗中保留灰色锁定字段。';
  }
  if (error?.code === 'VALIDATION_ERROR' && detail) return detail;
  if (detail) return detail;
  return '保存配置失败，请稍后重试。';
};

type SalesProductConfigResponse = {
  success: boolean;
  config?: {
    categories?: CategoryConfig[];
    productMappings?: ProductMapping[];
    discountRates?: ProductDiscountRate[];
    version?: number;
    effectiveAt?: string | null;
    updatedAt?: string | null;
  };
};

type SalesProductConfigVersion = {
  id: string;
  config_key: string;
  version: number;
  effective_at: string;
  source?: string | null;
  note?: string | null;
  created_by_admin_id?: string | null;
  created_at?: string;
  latest_change_at?: string | null;
  is_current?: boolean;
  covered_order_count?: number;
  covered_total_amount?: number;
  applied_order_count?: number;
  applied_total_amount?: number;
  category_breakdown?: Array<{
    category: string;
    attribute?: string | null;
    order_count: number;
    total_amount: number;
  }>;
  categories?: CategoryConfig[];
  product_mappings?: ProductMapping[];
  discount_rates?: ProductDiscountRate[];
};

type UsageLocksPayload = {
  usedCategoryKeys: string[];
  usedAttributeKeys: string[];
  usedRateKeys: string[];
  usedMappingKeys: string[];
};

type ProductConfigMode = 'full' | 'currentOnly' | 'versionsOnly';

export const ProductConfig: React.FC<{
  mode?: ProductConfigMode;
  onPublishSuccess?: () => void;
  onCancel?: () => void;
  readonly?: boolean;
  onRequestEdit?: () => void;
  snapshot?: {
    version?: number;
    effectiveAt?: string | null;
    effective_at?: string | null;
    isCurrent?: boolean;
    is_current?: boolean;
    categories?: CategoryConfig[];
    productMappings?: ProductMapping[];
    product_mappings?: ProductMapping[];
    discountRates?: ProductDiscountRate[];
    discount_rates?: ProductDiscountRate[];
  } | null;
}> = ({ mode = 'full', onPublishSuccess, onCancel, readonly = false, onRequestEdit, snapshot = null }) => {
  const isReadonly = Boolean(readonly);
  const [config, setConfig] = useState<StoredConfig>(loadConfig);
  const [configVersion, setConfigVersion] = useState<number>(1);
  const [configEffectiveAt, setConfigEffectiveAt] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<SalesProductConfigVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string>('');
  const [currentSnapshotIsCurrent, setCurrentSnapshotIsCurrent] = useState<boolean>(true);
  const [mainTab, setMainTab] = useState<'current' | 'versions'>(
    mode === 'versionsOnly' ? 'versions' : 'current'
  );
  const [currentSubTab, setCurrentSubTab] = useState<'categories' | 'products'>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ProductMapping | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<SalesProductConfigVersion | null>(null);
  const [savedInCurrentSession, setSavedInCurrentSession] = useState(false);
  const [versionTag, setVersionTag] = useState('');
  const [publishedBaseConfig, setPublishedBaseConfig] = useState<StoredConfig | null>(null);
  const [usedCategoryKeys, setUsedCategoryKeys] = useState<Set<string>>(new Set());
  const [usedAttributeKeys, setUsedAttributeKeys] = useState<Set<string>>(new Set());
  const [usedRateKeys, setUsedRateKeys] = useState<Set<string>>(new Set());
  const [usedMappingKeys, setUsedMappingKeys] = useState<Set<string>>(new Set());
  const [usageLocksStatus, setUsageLocksStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    if (snapshot) {
      const next: StoredConfig = {
        categories: snapshot.categories || [],
        productMappings: snapshot.productMappings || snapshot.product_mappings || [],
        discountRates: dedupeRates(snapshot.discountRates || snapshot.discount_rates || []),
      };
      setConfig(next);
      setPublishedBaseConfig(next);
      setConfigVersion(Number(snapshot.version || 1));
      setConfigEffectiveAt(snapshot.effectiveAt || snapshot.effective_at || null);
      setCurrentSnapshotIsCurrent(Boolean(snapshot.isCurrent ?? snapshot.is_current));
      setSavedInCurrentSession(true);
      setLoadingRemote(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingRemote(true);
        const data = await apiClient.get<SalesProductConfigResponse>('/api/admin/sales-product-config');
        if (cancelled || !data?.success) return;
        const next: StoredConfig = {
          categories: data.config?.categories || [],
          productMappings: data.config?.productMappings || [],
          discountRates: dedupeRates(data.config?.discountRates || []),
        };
        setConfig(next);
        setPublishedBaseConfig(next);
        saveConfig(next);
        setConfigVersion(data.config?.version || 1);
        setConfigEffectiveAt(data.config?.effectiveAt || null);
        setCurrentSnapshotIsCurrent(true);
      } catch (e) {
        if (!cancelled) {
          setSyncNotice('配置读取失败，当前使用本地缓存。');
        }
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  const loadUsageLocks = async () => {
    try {
      setUsageLocksStatus('loading');
      const data = await apiClient.get<{
        success: boolean;
        locks?: Partial<UsageLocksPayload>;
      }>('/api/admin/sales-product-config/usage-locks');
      const locks = data?.locks || {};
      setUsedCategoryKeys(new Set((locks.usedCategoryKeys || []).map((k) => normalizeEntityKey(k))));
      setUsedAttributeKeys(new Set((locks.usedAttributeKeys || []).map((k) => normalizeEntityKey(k))));
      setUsedRateKeys(new Set((locks.usedRateKeys || []).map((k) => normalizeEntityKey(k))));
      setUsedMappingKeys(new Set((locks.usedMappingKeys || []).map((k) => normalizeEntityKey(k))));
      setUsageLocksStatus('ready');
    } catch (e) {
      // Fallback: derive locks from version usage breakdown.
      try {
        const data = await apiClient.get<{ success: boolean; versions?: SalesProductConfigVersion[] }>(
          '/api/admin/sales-product-config/versions?limit=200'
        );
        const versions = data?.versions || [];
        const categorySet = new Set<string>();
        const attributeSet = new Set<string>();
        const rateSet = new Set<string>();
        const mappingSet = new Set<string>();

        versions.forEach((v) => {
          const categoriesMap = new Map<string, CategoryConfig>();
          (v.categories || []).forEach((c) => {
            categoriesMap.set(normalizeEntityKey(c.name), c);
            categoriesMap.set(normalizeEntityKey(c.categoryId), c);
          });
          (v.category_breakdown || []).forEach((item) => {
            if (!item || Number(item.order_count || 0) <= 0) return;
            const catKey = normalizeEntityKey(item.category);
            const attrKey = normalizeEntityKey(item.attribute || '');
            const catObj = categoriesMap.get(catKey);
            const categoryIdOrName = normalizeEntityKey(catObj?.categoryId || catObj?.name || item.category);
            if (!categoryIdOrName) return;
            categorySet.add(categoryIdOrName);
            const combined = `${categoryIdOrName}__${attrKey}`;
            attributeSet.add(combined);
            rateSet.add(combined);
            if (!attrKey) {
              rateSet.add(`${categoryIdOrName}__`);
            }
          });
        });

        // Best-effort fallback mapping locks: lock mappings whose category/attribute are already locked.
        (config.productMappings || []).forEach((m) => {
          const cKey = normalizeEntityKey(m.categoryId || m.category);
          const aKey = `${cKey}__${normalizeEntityKey(m.attributeId || m.attribute)}`;
          if (attributeSet.has(aKey) || (categorySet.has(cKey) && !m.attribute)) {
            mappingSet.add(mappingLockKey(m));
          }
        });

        setUsedCategoryKeys(categorySet);
        setUsedAttributeKeys(attributeSet);
        setUsedRateKeys(rateSet);
        setUsedMappingKeys(mappingSet);
        setUsageLocksStatus('ready');
      } catch (fallbackErr) {
        setUsageLocksStatus('failed');
      }
    }
  };

  useEffect(() => {
    void loadUsageLocks();
  }, [configVersion]);

  const allowCurrent = mode !== 'versionsOnly';
  const allowVersions = mode !== 'currentOnly';

  useEffect(() => {
    if (mode === 'versionsOnly' && mainTab !== 'versions') setMainTab('versions');
    if (mode === 'currentOnly' && mainTab !== 'current') setMainTab('current');
  }, [mode, mainTab]);

  useEffect(() => {
    if (!allowVersions) return;
    if (mainTab !== 'versions') return;
    void loadVersionHistory();
  }, [mainTab, configVersion, allowVersions]);

  const loadVersionHistory = async () => {
    try {
      setLoadingVersions(true);
      const data = await apiClient.get<{ success: boolean; versions?: SalesProductConfigVersion[] }>(
        '/api/admin/sales-product-config/versions?limit=100'
      );
      setVersionHistory(data.versions || []);
    } catch (e) {
      setSyncNotice('版本历史加载失败，请稍后重试。');
    } finally {
      setLoadingVersions(false);
    }
  };

  const syncToServer = async (
    next: StoredConfig,
    options?: { publishVersion?: boolean; note?: string }
  ): Promise<{ ok: true } | { ok: false; error: any }> => {
    try {
      const data = await apiClient.put<SalesProductConfigResponse>('/api/admin/sales-product-config', {
        categories: next.categories,
        productMappings: next.productMappings,
        discountRates: next.discountRates,
        publishVersion: Boolean(options?.publishVersion),
        note: options?.note || undefined,
      });
      setConfigVersion(data.config?.version || configVersion);
      setConfigEffectiveAt(data.config?.effectiveAt || configEffectiveAt);
      void loadVersionHistory();
      setSyncNotice('');
      return { ok: true };
    } catch (e) {
      setSyncNotice('配置已本地保存，后端同步失败，请稍后重试。');
      return { ok: false, error: e };
    }
  };

  const persist = async (up: Partial<StoredConfig>): Promise<boolean> => {
    if (isReadonly) return false;
    const next = { ...config, ...up, discountRates: dedupeRates((up.discountRates || config.discountRates) as ProductDiscountRate[]) };
    setConfig(next);
    saveConfig(next);
    setSyncNotice('当前为草稿，点击“发布版本”后才会生效并进入历史。');
    return true;
  };

  const categories = config.categories;
  const productMappings = config.productMappings;
  const discountRates = config.discountRates;

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);
  const filteredMappings = useMemo(() => {
    let list = productMappings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.productName.toLowerCase().includes(q) ||
          m.productCode.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.attribute?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== '全部') {
      list = list.filter((m) => m.category === categoryFilter);
    }
    return list;
  }, [productMappings, searchQuery, categoryFilter]);

  const publishNewVersion = async () => {
    if (isReadonly) return;
    let note = '';
    if (mode === 'currentOnly') {
      note = versionTag.trim();
      if (!note) {
        alert('请先填写版本标识（例如：v21-折算率修正-2026-03-22）。');
        return;
      }
    } else {
      const input = window.prompt('请输入版本标识（必填），用于历史追踪：', '');
      note = String(input || '').trim();
      if (!note) return;
    }
    const result = await syncToServer(config, { publishVersion: true, note });
    if (!result.ok) {
      alert(resolveSyncErrorText(result.error));
      return;
    }
    if (mode === 'currentOnly') setVersionTag('');
    setPublishedBaseConfig(config);
    setSavedInCurrentSession(true);
    setSyncNotice('');
    setMainTab('versions');
    void loadVersionHistory();
    void loadUsageLocks();
    onPublishSuccess?.();
  };

  const draftChangeCount = useMemo(() => countDraftChanges(publishedBaseConfig, config), [publishedBaseConfig, config]);

  return (
    <div className={`h-full overflow-y-auto ${mode === 'currentOnly' ? 'bg-white' : 'bg-slate-50'}`}>
      <div className={mode === 'currentOnly' ? 'px-2 pt-2 pb-2 mb-2 border-b border-slate-200' : 'bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6'}>
        <div className={`flex items-center justify-between ${mode === 'currentOnly' ? 'mb-2' : 'mb-4'}`}>
          <div className="flex items-center gap-3">
            {mode !== 'currentOnly' && (
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800">产品配置</h1>
                {mode === 'currentOnly' && (
                  <span
                    className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      currentSnapshotIsCurrent
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {currentSnapshotIsCurrent ? '当前使用中' : '历史版本，停用中'}
                  </span>
                )}
              </div>
              {loadingRemote ? <p className="text-sm text-slate-500">（同步中）</p> : null}
              {(mode !== 'currentOnly' || savedInCurrentSession) && (
                <p className="text-xs text-slate-400 mt-1">
                  当前版本 v{configVersion}
                  {configEffectiveAt ? ` · 生效时间 ${new Date(configEffectiveAt).toLocaleString('zh-CN')}` : ''}
                </p>
              )}
              {syncNotice ? (
                <p className="text-xs text-amber-600 mt-1">{syncNotice}</p>
              ) : null}
            </div>
          </div>
          {mainTab === 'current' ? (
            mode === 'currentOnly' ? (
              <div className="flex items-center gap-3">
                {isReadonly && onRequestEdit ? (
                  <button
                    type="button"
                    onClick={() => onRequestEdit()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                  >
                    编辑
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onCancel?.()}
                  className="text-slate-400 hover:text-slate-600"
                  title="关闭"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void publishNewVersion()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                添加版本
              </button>
            )
          ) : null}
        </div>

        {mode === 'full' && (
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setMainTab('current')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                mainTab === 'current'
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-1" />
              当前版本 v{configVersion}
            </button>
            <button
              onClick={() => setMainTab('versions')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                mainTab === 'versions'
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              版本管理
            </button>
          </div>
        )}
      </div>

      {allowCurrent && mainTab === 'current' && (
        <div className="p-0 mb-6">
          <div className="flex gap-2 border-b border-slate-200 mb-4">
            <button
              onClick={() => setCurrentSubTab('categories')}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                currentSubTab === 'categories'
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              品类与折算率 ({categories.length}/{discountRates.length})
            </button>
            <button
              onClick={() => setCurrentSubTab('products')}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                currentSubTab === 'products'
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              商品同步 ({productMappings.length})
            </button>
          </div>
          {currentSubTab === 'categories' && (
            <CategoryConfigTab
              categories={categories}
              discountRates={discountRates}
              readonly={isReadonly}
              usedCategoryKeys={usedCategoryKeys}
              usedAttributeKeys={usedAttributeKeys}
              usedRateKeys={usedRateKeys}
              locksReady={usageLocksStatus === 'ready'}
              onSaveAll={(cats, rates) => persist({ categories: cats, discountRates: rates })}
            />
          )}
          {currentSubTab === 'products' && (
            <div className="bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">从商品管理同步商品，并关联品类与属性</p>
                {!isReadonly && (
                  <button
                    onClick={() => setShowSyncModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    从商品管理同步
                  </button>
                )}
              </div>

              <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索商品名称、品类或属性..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
                  >
                    <option value="全部">全部品类</option>
                    {categoryNames.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredMappings.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无同步商品，请先配置品类与属性，再点击「从商品管理同步」</p>
                  </div>
                ) : (
                  filteredMappings.map((m) => (
                    (() => {
                      const mappingLocked = usageLocksStatus === 'ready' && usedMappingKeys.has(mappingLockKey(m));
                      return (
                    <div
                      key={m.productId}
                      className={`p-4 border rounded-lg transition-colors ${mappingLocked ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-semibold text-slate-800">{m.productName}</h3>
                            <span className="text-xs text-slate-400">{m.productCode}</span>
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded">
                              {mappingCategoryLabel(m)}
                            </span>
                            {m.attribute && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                                {mappingAttributeLabel(m)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex items-center gap-1 text-sm text-indigo-600">
                            <DollarSign className="w-4 h-4" />
                            <span className="font-semibold">¥{Number(m.price).toLocaleString()}</span>
                          </div>
                          {!isReadonly && (
                            <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingMapping(m)}
                              disabled={mappingLocked}
                              className={`p-2 rounded transition-colors ${mappingLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                              title={mappingLocked ? '该商品映射已被生效订单使用，禁止修改' : '编辑关联'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (mappingLocked) return;
                                if (confirm('确定移除此商品的同步吗？')) {
                                  void persist({
                                    productMappings: productMappings.filter((p) => p.productId !== m.productId),
                                  });
                                }
                              }}
                              disabled={mappingLocked}
                              className={`p-2 rounded transition-colors ${mappingLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                              title={mappingLocked ? '该商品映射已被生效订单使用，禁止移除' : '移除'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                      );
                    })()
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'currentOnly' && mainTab === 'current' && !isReadonly && currentSubTab === 'categories' && (
        <div className="border-t border-slate-200 pt-4 pb-1 mt-4 flex justify-end gap-3">
          <div className="mr-auto flex items-center text-xs text-slate-500">
            草稿变更 {draftChangeCount} 项（未发布仅本地）
          </div>
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => setCurrentSubTab('products')}
            className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700"
          >
            下一步
          </button>
        </div>
      )}

      {mode === 'currentOnly' && mainTab === 'current' && !isReadonly && currentSubTab === 'products' && (
        <div className="border-t border-slate-200 pt-4 pb-1 mt-4 flex justify-end gap-3">
          <div className="mr-auto flex items-center text-xs text-slate-500">
            草稿变更 {draftChangeCount} 项（未发布仅本地）
          </div>
          <input
            type="text"
            value={versionTag}
            onChange={(e) => setVersionTag(e.target.value)}
            placeholder="版本标识（必填），如：v21-折算率修正-2026-03-22"
            className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          />
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void publishNewVersion()}
            className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700"
          >
            发布版本
          </button>
        </div>
      )}

      {/* 版本管理 */}
      {allowVersions && mainTab === 'versions' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">版本管理</h2>
              <p className="text-sm text-slate-500 mt-1">版本信息自动记录，按生效时间倒序展示</p>
            </div>
            <button
              type="button"
              onClick={() => void loadVersionHistory()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              刷新
            </button>
          </div>

          {loadingVersions ? (
            <div className="text-center py-10 text-slate-500">加载版本历史中...</div>
          ) : versionHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-400">暂无历史版本</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">版本</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">生效时间</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">覆盖/应用订单</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">品类明细</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">来源</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">创建时间</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">更新历史时间</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">状态</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">明细</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versionHistory
                    .slice()
                    .sort((a, b) => new Date(b.effective_at).getTime() - new Date(a.effective_at).getTime())
                    .map((v) => {
                      const isCurrent = Number(v.version) === Number(configVersion);
                      return (
                        <tr
                          key={v.id}
                          className={`${isCurrent ? 'bg-emerald-50' : 'bg-white'} cursor-pointer hover:bg-indigo-50`}
                          onClick={() => setSelectedVersion(v)}
                          title="点击查看版本快照详情"
                        >
                          <td className="px-3 py-2 text-sm font-medium text-slate-800">v{v.version}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            {v.effective_at ? new Date(v.effective_at).toLocaleString('zh-CN') : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
                            <div>覆盖 {Number(v.covered_order_count || 0)} 单</div>
                            <div>应用 {Number(v.applied_order_count || 0)} 单</div>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600 min-w-[260px]">
                            {(v.category_breakdown || []).length === 0 ? (
                              <span>-</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {(v.category_breakdown || []).slice(0, 3).map((item, idx) => (
                                  <span
                                    key={`${item.category}-${item.attribute || ''}-${idx}`}
                                    className="inline-flex px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700"
                                    title={`${item.category}${item.attribute ? `/${item.attribute}` : ''}：${item.order_count}单，¥${Number(item.total_amount || 0).toFixed(2)}`}
                                  >
                                    {item.category}
                                    {item.attribute ? `/${item.attribute}` : ''} · {item.order_count}单
                                  </span>
                                ))}
                                {(v.category_breakdown || []).length > 3 && (
                                  <span className="inline-flex px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                                    +{(v.category_breakdown || []).length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">{v.source || '-'}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">
                            {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">
                            {v.latest_change_at ? new Date(v.latest_change_at).toLocaleString('zh-CN') : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {isCurrent ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 font-medium">
                                当前使用中
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                                历史版本，停用中
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-indigo-600">查看</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 从商品管理同步弹窗 */}
      {!isReadonly && showSyncModal && (
        <SyncProductsModal
          categories={categories}
          existingMappings={productMappings}
          onClose={() => setShowSyncModal(false)}
          onSync={async (newMappings) => {
            const merged = [...productMappings];
            newMappings.forEach((nm) => {
              const idx = merged.findIndex((m) => m.productId === nm.productId);
              if (idx >= 0) merged[idx] = nm;
              else merged.push(nm);
            });
            const ok = await persist({ productMappings: merged });
            if (ok) setShowSyncModal(false);
          }}
        />
      )}

      {/* 编辑商品关联弹窗 */}
      {!isReadonly && editingMapping && (
        <EditMappingDialog
          mapping={editingMapping}
          categories={categories}
          onSave={async (updated) => {
            const ok = await persist({
              productMappings: productMappings.map((m) =>
                m.productId === updated.productId ? updated : m
              ),
            });
            if (ok) setEditingMapping(null);
          }}
          onCancel={() => setEditingMapping(null)}
        />
      )}

      {selectedVersion && (
        <VersionSnapshotModal
          version={selectedVersion}
          isCurrent={Number(selectedVersion.version) === Number(configVersion)}
          onClose={() => setSelectedVersion(null)}
        />
      )}
    </div>
  );
};

const VersionSnapshotModal: React.FC<{
  version: SalesProductConfigVersion;
  isCurrent: boolean;
  onClose: () => void;
}> = ({ version, isCurrent, onClose }) => {
  const categories = version.categories || [];
  const mappings = version.product_mappings || [];
  const rates = version.discount_rates || [];
  const breakdown = version.category_breakdown || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">版本快照 v{version.version}</h3>
            <p className="text-sm text-slate-500 mt-1">
              生效时间 {version.effective_at ? new Date(version.effective_at).toLocaleString('zh-CN') : '-'}
              {isCurrent ? ' · 当前使用中' : ' · 历史版本，停用中'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">覆盖订单</p>
              <p className="text-lg font-semibold text-slate-800">{Number(version.covered_order_count || 0)} 单</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">应用订单</p>
              <p className="text-lg font-semibold text-slate-800">{Number(version.applied_order_count || 0)} 单</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">覆盖金额</p>
              <p className="text-lg font-semibold text-slate-800">¥{Number(version.covered_total_amount || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">应用金额</p>
              <p className="text-lg font-semibold text-slate-800">¥{Number(version.applied_total_amount || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">商品品类应用明细</h4>
            {breakdown.length === 0 ? (
              <p className="text-sm text-slate-400">暂无应用明细</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-3">品类</th>
                      <th className="py-2 pr-3">属性</th>
                      <th className="py-2 pr-3">订单数</th>
                      <th className="py-2 pr-3">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((item, idx) => (
                      <tr key={`${item.category}-${item.attribute || ''}-${idx}`} className="border-b border-slate-50">
                        <td className="py-2 pr-3 text-slate-700">{item.category}</td>
                        <td className="py-2 pr-3 text-slate-600">{item.attribute || '-'}</td>
                        <td className="py-2 pr-3 text-slate-700">{item.order_count}</td>
                        <td className="py-2 pr-3 text-slate-700">¥{Number(item.total_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">品类配置 ({categories.length})</h4>
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400">无</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div key={cat.id || cat.name} className="text-sm">
                      <p className="text-slate-700 font-medium">{categoryLabel(cat)}</p>
                      <p className="text-slate-500">
                        {(cat.attributes || []).map((a) => attrLabel(cat, a)).join(' / ') || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">商品映射 ({mappings.length})</h4>
              {mappings.length === 0 ? (
                <p className="text-sm text-slate-400">无</p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {mappings.map((m) => (
                    <div key={m.productId} className="text-sm border border-slate-100 rounded p-2">
                      <p className="text-slate-700">{m.productName} ({m.productCode})</p>
                      <p className="text-slate-500">{mappingCategoryLabel(m)}{m.attribute ? ` / ${mappingAttributeLabel(m)}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">折算率配置 ({rates.length})</h4>
            {rates.length === 0 ? (
              <p className="text-sm text-slate-400">无</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {rates.map((r, idx) => (
                  <div key={`${r.category}-${r.attribute || ''}-${idx}`} className="text-sm border border-slate-100 rounded p-2 text-slate-700">
                    {rateCategoryLabel(r as ProductDiscountRate & { categoryId?: string })}
                    {r.attribute ? ` / ${rateAttributeLabel(r as ProductDiscountRate & { attributeId?: string })}` : ''}
                    {' '}· {(Number(r.discountRate || 0) * 100).toFixed(1)}%
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 品类与属性配置
const CategoryConfigTab: React.FC<{
  categories: CategoryConfig[];
  discountRates: ProductDiscountRate[];
  readonly?: boolean;
  usedCategoryKeys: Set<string>;
  usedAttributeKeys: Set<string>;
  usedRateKeys: Set<string>;
  locksReady: boolean;
  onSaveAll: (categories: CategoryConfig[], discountRates: ProductDiscountRate[]) => void;
}> = ({ categories, discountRates, readonly = false, usedCategoryKeys, usedAttributeKeys, usedRateKeys, locksReady, onSaveAll }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newBaseRate, setNewBaseRate] = useState<number>(DEFAULT_DISCOUNT_RATE);
  const [newAttrInput, setNewAttrInput] = useState('');
  const [draftAttributes, setDraftAttributes] = useState<Array<{ id: string; name: string; discountRate: number }>>([]);
  const [editingCategory, setEditingCategory] = useState<CategoryConfig | null>(null);
  const [viewingCategory, setViewingCategory] = useState<CategoryConfig | null>(null);
  const previewCategoryId = nextCategoryIdPreview(categories);
  const getRate = (categoryName: string, attribute?: string) =>
    discountRates.find((r) => r.category === categoryName && (r.attribute || '') === (attribute || ''))?.discountRate
    ?? DEFAULT_DISCOUNT_RATE;
  const isCategoryLocked = (cat: CategoryConfig) => {
    const cKey = categoryLockKey(cat);
    if (usedCategoryKeys.has(cKey) || usedRateKeys.has(`${cKey}__`)) return true;
    return (cat.attributes || []).some((attr) => {
      const key = normalizeEntityKey(attributeLockKey(cat, attr, cat.attributeIds?.[attr]));
      return usedAttributeKeys.has(key) || usedRateKeys.has(key);
    });
  };

  const handleAdd = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.some((c) => c.name === name)) {
      alert('该品类已存在');
      return;
    }
    const cleanedAttrs = draftAttributes
      .map((a) => ({ ...a, name: a.name.trim() }))
      .filter((a) => a.name);
    const dup = cleanedAttrs.some((a, i) => cleanedAttrs.findIndex((x) => x.name === a.name) !== i);
    if (dup) {
      alert('属性名称不能重复');
      return;
    }
    const nextCategories = [
      ...categories,
      {
        id: `cat-${Date.now()}`,
        categoryId: previewCategoryId,
        name,
        attributes: cleanedAttrs.map((a) => a.name),
        attributeIds: cleanedAttrs.reduce((acc, a) => ({ ...acc, [a.name]: a.id }), {}),
      },
    ];
    const nextRates = upsertCategoryRates(
      discountRates,
      name,
      [
        { discountRate: newBaseRate },
        ...cleanedAttrs.map((a) => ({ attribute: a.name, discountRate: a.discountRate })),
      ]
    );
    setShowAddModal(false);
    setNewCategoryName('');
    setNewBaseRate(DEFAULT_DISCOUNT_RATE);
    setNewAttrInput('');
    setDraftAttributes([]);
    onSaveAll(nextCategories, nextRates);
  };

  const handleDeleteCategory = (catId: string) => {
    if (!locksReady) {
      alert('锁定规则加载中，暂不可删除，请稍后重试。');
      return;
    }
    if (!confirm('确定删除该品类吗？')) return;
    const category = categories.find((c) => c.id === catId);
    if (!category) return;
    if (isCategoryLocked(category)) {
      alert('该品类/属性折算率已被生效订单使用，禁止编辑或删除。');
      return;
    }
    onSaveAll(
      categories.filter((c) => c.id !== catId),
      discountRates.filter((r) => r.category !== category.name)
    );
  };

  return (
    <div className="bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div />
        {!readonly && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加品类+折算率
          </button>
        )}
      </div>

      {/* 添加品类弹窗 */}
      {!readonly && showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAddModal(false); setNewCategoryName(''); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-4">添加</h3>
            <p className="text-xs text-slate-500 mb-4">1. 品类名称 → 2. 属性列表 → 3. 折算率配置</p>
            <div className="mb-3">
              <label className="block text-sm font-semibold text-slate-700 mb-1">品类编号</label>
              <input
                type="text"
                value={previewCategoryId}
                readOnly
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500"
              />
            </div>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="请输入品类名称（如：长寿管理、抗衰产品）"
                className="md:col-span-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={toPercentDisplay(newBaseRate)}
                  onChange={(e) => setNewBaseRate(fromPercentInput(e.target.value))}
                  disabled={draftAttributes.length > 0}
                  className={`w-full px-3 py-2 pr-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    draftAttributes.length > 0 ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
              </div>
            </div>
            {draftAttributes.length > 0 && (
              <p className="text-xs text-slate-500 mb-3">已添加属性明细折算率，基础折算率自动失效，不参与计算。</p>
            )}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">2) 添加属性</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newAttrInput}
                  onChange={(e) => setNewAttrInput(e.target.value)}
                  placeholder="属性名称（如：尊享版）"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const attr = newAttrInput.trim();
                    if (!attr) return;
                    if (draftAttributes.some((a) => a.name.trim() === attr)) return;
                    let id = pad2(draftAttributes.length + 1);
                    const used = new Set(draftAttributes.map((a) => a.id));
                    while (used.has(id)) id = pad2(Number(id) + 1);
                    setDraftAttributes((prev) => [...prev, { id, name: attr, discountRate: DEFAULT_DISCOUNT_RATE }]);
                    setNewAttrInput('');
                  }}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                >
                  添加
                </button>
              </div>
              <div className="space-y-2">
                {draftAttributes.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={a.id}
                      readOnly
                      className="w-16 px-2 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500 text-sm text-center"
                    />
                    <input
                      type="text"
                      value={a.name}
                      onChange={(e) => setDraftAttributes((prev) => prev.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)))}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <div className="relative w-28">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={toPercentDisplay(a.discountRate)}
                        onChange={(e) => setDraftAttributes((prev) => prev.map((x) => (x.id === a.id ? { ...x, discountRate: fromPercentInput(e.target.value) } : x)))}
                        className="w-full px-2 py-2 pr-6 border border-slate-300 rounded-lg text-sm"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftAttributes((prev) => prev.filter((x) => x.id !== a.id))}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setNewCategoryName('');
                  setNewBaseRate(DEFAULT_DISCOUNT_RATE);
                  setNewAttrInput('');
                  setDraftAttributes([]);
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                一次完成配置
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {categories.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无品类，请先添加品类</p>
          </div>
        ) : (
          <table className="min-w-full bg-white border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">品类</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">属性</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">折算率</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {categories.map((cat) => (
                (() => {
                  const locked = locksReady && isCategoryLocked(cat);
                  return (
                <tr
                  key={cat.id}
                  className={`cursor-pointer hover:bg-slate-50 ${locked ? 'bg-slate-50/40' : ''}`}
                  onClick={() => setViewingCategory(cat)}
                >
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{categoryLabel(cat)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {cat.attributes.length === 0 ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {cat.attributes.map((attr) => (
                          <span
                            key={attr}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded"
                          >
                            {attrLabel(cat, attr)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex flex-wrap gap-1.5">
                      {hasAttributeDetailRates(cat, discountRates) ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-xs">
                          基础（属性明细生效，已失效）
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                          基础 {(getRate(cat.name) * 100).toFixed(0)}%
                        </span>
                      )}
                      {cat.attributes.map((attr) => (
                        <span key={`${cat.id}-${attr}`} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs">
                          {attr} {(getRate(cat.name, attr) * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!readonly ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(cat);
                          }}
                          className="text-slate-500 hover:text-indigo-600"
                          title={locked ? '包含已使用字段，进入后可见灰色锁定项' : '编辑'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(cat.id);
                          }}
                          className="text-slate-500 hover:text-rose-600"
                          title={locked ? '包含已使用字段，删除时将被拦截' : '删除'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 编辑品类弹窗 */}
      {!readonly && editingCategory && (
        <EditCategoryModal
          category={categories.find((c) => c.id === editingCategory.id) || editingCategory}
          categories={categories}
          discountRates={discountRates}
          usedAttributeKeys={usedAttributeKeys}
          usedRateKeys={usedRateKeys}
          onSaveAll={(updatedCategory, entries) => {
            const nextCategories = categories.map((c) => (c.id === updatedCategory.id ? updatedCategory : c));
            const ratesWithoutOld = discountRates.filter((r) => r.category !== editingCategory.name);
            const nextRates = upsertCategoryRates(ratesWithoutOld, updatedCategory.name, entries);
            onSaveAll(nextCategories, nextRates);
            setEditingCategory(null);
          }}
          onCancel={() => setEditingCategory(null)}
        />
      )}

      {viewingCategory && (
        <CategoryDetailModal
          category={viewingCategory}
          discountRates={discountRates}
          onClose={() => setViewingCategory(null)}
        />
      )}
    </div>
  );
};

const CategoryDetailModal: React.FC<{
  category: CategoryConfig;
  discountRates: ProductDiscountRate[];
  onClose: () => void;
}> = ({ category, discountRates, onClose }) => {
  const baseRate =
    discountRates.find((r) => r.category === category.name && !r.attribute)?.discountRate ?? DEFAULT_DISCOUNT_RATE;
  const baseInactive = hasAttributeDetailRates(category, discountRates);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">品类详情</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-slate-500">品类</p>
            <p className="font-medium text-slate-800">{categoryLabel(category)}</p>
          </div>
          <div>
            <p className="text-slate-500">基础折算率</p>
            <p className={`font-medium ${baseInactive ? 'text-slate-400' : 'text-slate-800'}`}>
              {baseInactive ? '属性明细生效，基础已失效' : `${(baseRate * 100).toFixed(0)}%`}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">属性与折算率</p>
            {category.attributes.length === 0 ? (
              <p className="text-slate-400">暂无属性</p>
            ) : (
              <div className="space-y-1">
                {category.attributes.map((attr) => {
                  const rate =
                    discountRates.find((r) => r.category === category.name && (r.attribute || '') === attr)
                      ?.discountRate ?? DEFAULT_DISCOUNT_RATE;
                  return (
                    <div key={attr} className="flex items-center justify-between border border-slate-100 rounded px-2 py-1">
                      <span className="text-slate-700">{attrLabel(category, attr)}</span>
                      <span className="text-indigo-700 font-medium">{(rate * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EditCategoryModal: React.FC<{
  category: CategoryConfig;
  categories: CategoryConfig[];
  discountRates: ProductDiscountRate[];
  usedAttributeKeys: Set<string>;
  usedRateKeys: Set<string>;
  onSaveAll: (category: CategoryConfig, entries: Array<{ attribute?: string; discountRate: number }>) => void;
  onCancel: () => void;
}> = ({ category, categories, discountRates, usedAttributeKeys, usedRateKeys, onSaveAll, onCancel }) => {
  const [name, setName] = useState(category.name);
  const [baseRate, setBaseRate] = useState<number>(
    discountRates.find((r) => r.category === category.name && !r.attribute)?.discountRate ?? DEFAULT_DISCOUNT_RATE
  );
  const [newAttrInput, setNewAttrInput] = useState('');
  const [draftAttributes, setDraftAttributes] = useState<Array<{ id: string; name: string; discountRate: number }>>(() =>
    category.attributes.map((a, idx) => ({
      id: category.attributeIds?.[a] || pad2(idx + 1),
      name: a,
      discountRate: discountRates.find((r) => r.category === category.name && (r.attribute || '') === a)?.discountRate ?? DEFAULT_DISCOUNT_RATE,
    }))
  );
  const hasAttrRatesMode = draftAttributes.some((a) => String(a.name || '').trim().length > 0);
  const categoryKey = categoryLockKey(category);
  const baseLocked = usedRateKeys.has(`${categoryKey}__`);
  const isAttrLocked = (item: { id: string; name: string }) => {
    const key = normalizeEntityKey(attributeLockKey(category, item.name, item.id));
    return usedAttributeKeys.has(key) || usedRateKeys.has(key);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed !== category.name && categories.some((c) => c.name === trimmed)) {
      alert('该品类名称已存在');
      return;
    }
    const cleanedAttrs = draftAttributes
      .map((a) => ({ ...a, name: a.name.trim() }))
      .filter((a) => a.name);
    const dup = cleanedAttrs.some((a, i) => cleanedAttrs.findIndex((x) => x.name === a.name) !== i);
    if (dup) {
      alert('属性名称不能重复');
      return;
    }
    onSaveAll(
      {
        ...category,
        name: trimmed,
        attributes: cleanedAttrs.map((a) => a.name),
        attributeIds: cleanedAttrs.reduce((acc, a) => ({ ...acc, [a.name]: a.id }), {}),
      },
      [
        ...(cleanedAttrs.length > 0 ? [] : [{ discountRate: baseRate }]),
        ...cleanedAttrs.map((a) => ({ attribute: a.name, discountRate: a.discountRate })),
      ]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">编辑</h3>
        <p className="text-xs text-slate-500 mb-4">1. 修改品类名称 → 2. 修改属性名称 → 3. 调整折算率</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">品类编号（自动）</label>
            <input
              type="text"
              value={category.categoryId || nextCategoryIdPreview(categories)}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">品类名称 + 默认折算率</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={baseLocked}
                className={`md:col-span-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  baseLocked ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300'
                }`}
              />
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={toPercentDisplay(baseRate)}
                  onChange={(e) => setBaseRate(fromPercentInput(e.target.value))}
                  disabled={baseLocked || hasAttrRatesMode}
                  className={`w-full px-3 py-2 pr-8 border rounded-lg ${
                    (baseLocked || hasAttrRatesMode) ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
              </div>
            </div>
            {baseLocked && (
              <p className="text-xs text-amber-600 mt-1">该品类基础折算率已被生效订单使用，已锁定。</p>
            )}
            {!baseLocked && hasAttrRatesMode && (
              <p className="text-xs text-slate-500 mt-1">已配置属性明细折算率，基础折算率自动失效，不参与计算。</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">2) 添加属性</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAttrInput}
                onChange={(e) => setNewAttrInput(e.target.value)}
                placeholder="属性名称"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const attr = newAttrInput.trim();
                  if (!attr) return;
                  if (draftAttributes.some((a) => a.name === attr)) return;
                  let id = pad2(draftAttributes.length + 1);
                  const used = new Set(draftAttributes.map((a) => a.id));
                  while (used.has(id)) id = pad2(Number(id) + 1);
                  setDraftAttributes((prev) => [...prev, { id, name: attr, discountRate: DEFAULT_DISCOUNT_RATE }]);
                  setNewAttrInput('');
                }}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
              >
                添加
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draftAttributes.map((item) => (
                (() => {
                  const locked = isAttrLocked(item);
                  return (
                <div key={item.id} className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={item.id}
                    readOnly
                    className="w-16 px-2 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500 text-sm text-center"
                  />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => setDraftAttributes((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)))}
                    disabled={locked}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm ${
                      locked ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300'
                    }`}
                  />
                  <div className="relative w-28">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={toPercentDisplay(item.discountRate)}
                      onChange={(e) => setDraftAttributes((prev) => prev.map((x) => (x.id === item.id ? { ...x, discountRate: fromPercentInput(e.target.value) } : x)))}
                      disabled={locked}
                      className={`w-full px-2 py-2 pr-6 border rounded-lg text-sm ${
                        locked ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300'
                      }`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (locked) return;
                      setDraftAttributes((prev) => prev.filter((a) => a.id !== item.id));
                    }}
                    disabled={locked}
                    className={`p-2 rounded ${locked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                  );
                })()
              ))}
            </div>
          </div>
          
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
            取消
          </button>
          <button type="button" onClick={handleSave} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// 折算率配置
const DiscountRateConfigTab: React.FC<{
  categories: CategoryConfig[];
  discountRates: ProductDiscountRate[];
  onSave: (rates: ProductDiscountRate[]) => void;
}> = ({ categories, discountRates, onSave }) => {
  const [rates, setRates] = useState<ProductDiscountRate[]>(discountRates);
  const [editingRateIndex, setEditingRateIndex] = useState<number | null>(null);
  const [creatingRate, setCreatingRate] = useState(false);

  useEffect(() => {
    setRates(discountRates);
  }, [discountRates]);

  const categoryNames = categories.map((c) => c.name);

  const handleAddRate = () => {
    if (categoryNames.length === 0) return;
    setCreatingRate(true);
  };

  const handleDeleteRate = (index: number) => {
    if (!confirm('确定删除该折算率配置吗？')) return;
    const next = rates.filter((_, i) => i !== index);
    setRates(next);
    onSave(next);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">折算率配置</h2>
          <p className="text-sm text-slate-500 mt-1">为不同品类和属性设置折算率，用于佣金计算</p>
        </div>
        <button
          onClick={handleAddRate}
          disabled={categoryNames.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          添加配置
        </button>
      </div>

      <div className="space-y-3">
        {rates.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无折算率配置，请先完成品类与属性配置</p>
          </div>
        ) : (
          rates.map((rate, index) => (
            <div
              key={index}
              className="p-4 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded">
                      {rateCategoryLabel(rate as ProductDiscountRate & { categoryId?: string })}
                    </span>
                    {rate.attribute && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                        {rateAttributeLabel(rate as ProductDiscountRate & { attributeId?: string })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-indigo-600">折算率 {(rate.discountRate * 100).toFixed(1)}%</span>
                  <button
                    type="button"
                    onClick={() => setEditingRateIndex(index)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRate(index)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 编辑折算率弹窗 */}
      {editingRateIndex !== null && (
        <EditDiscountRateModal
          rate={rates[editingRateIndex]}
          categories={categories}
          onSave={(updated) => {
            const duplicate = rates.some((r, idx) => (
              idx !== editingRateIndex &&
              r.category === updated.category &&
              (r.attribute || '') === (updated.attribute || '')
            ));
            if (duplicate) {
              alert('该品类/属性的折算率配置已存在，请勿重复添加');
              return;
            }
            const next = [...rates];
            next[editingRateIndex] = updated;
            setRates(next);
            onSave(next);
            setEditingRateIndex(null);
          }}
          onCancel={() => setEditingRateIndex(null)}
        />
      )}

      {creatingRate && (
        <EditDiscountRateModal
          rate={{ category: categoryNames[0] || '', attribute: undefined, discountRate: 0.6 }}
          categories={categories}
          onSave={(created) => {
            const duplicate = rates.some((r) => (
              r.category === created.category &&
              (r.attribute || '') === (created.attribute || '')
            ));
            if (duplicate) {
              alert('该品类/属性的折算率配置已存在，请勿重复添加');
              return;
            }
            const next = [...rates, created];
            setRates(next);
            onSave(next);
            setCreatingRate(false);
          }}
          onCancel={() => setCreatingRate(false)}
        />
      )}
    </div>
  );
};
void DiscountRateConfigTab;

// 编辑折算率弹窗
const EditDiscountRateModal: React.FC<{
  rate: ProductDiscountRate;
  categories: CategoryConfig[];
  onSave: (r: ProductDiscountRate) => void;
  onCancel: () => void;
}> = ({ rate, categories, onSave, onCancel }) => {
  const [category, setCategory] = useState(rate.category);
  const [attribute, setAttribute] = useState(rate.attribute || '');
  const [discountRate, setDiscountRate] = useState(rate.discountRate);

  const attrs = categories.find((c) => c.name === category)?.attributes || [];

  const handleSave = () => {
    if (!category) {
      alert('请选择商品品类');
      return;
    }
    if (discountRate < 0 || discountRate > 1) {
      alert('折算率范围需在 0 到 1 之间');
      return;
    }
    onSave({
      category,
      attribute: attribute || undefined,
      discountRate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">编辑折算率</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">商品品类</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setAttribute('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">请选择品类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">商品属性（可选）</label>
            <select
              value={attribute}
              onChange={(e) => setAttribute(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-</option>
              {attrs.map((a) => {
                const cat = categories.find((c) => c.name === category) || { id: 'x', name: '', attributes: [] };
                return <option key={a} value={a}>{attrLabel(cat, a)}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">折算率</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={discountRate}
                onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-800 w-12 text-right">
                {(discountRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
            取消
          </button>
          <button type="button" onClick={handleSave} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// 从商品管理同步弹窗
interface ApiProduct {
  id: string;
  product_code: string;
  product_name: string;
  price: number;
}

const SyncProductsModal: React.FC<{
  categories: CategoryConfig[];
  existingMappings: ProductMapping[];
  onClose: () => void;
  onSync: (mappings: ProductMapping[]) => void;
}> = ({ categories, existingMappings, onClose, onSync }) => {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, { category: string; attribute?: string }>>({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<{ products: ApiProduct[] }>(
          '/api/admin/products?limit=1000&is_active=true'
        );
        setProducts(data.products || []);
        const init: Record<string, { category: string; attribute?: string }> = {};
        existingMappings.forEach((m) => {
          init[m.productId] = { category: m.category, attribute: m.attribute };
        });
        (data.products || []).forEach((p) => {
          if (!init[p.id]) {
            init[p.id] = { category: categories[0]?.name || '', attribute: undefined };
          }
        });
        setSelected(init);
      } catch (e: any) {
        console.error(e);
        alert(e.message || '加载商品失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [categories, existingMappings]);

  const getAttributesForCategory = (catName: string) => {
    const cat = categories.find((c) => c.name === catName);
    return cat?.attributes || [];
  };

  const handleSync = () => {
    const mappings: ProductMapping[] = [];
    for (const p of products) {
      const s = selected[p.id];
      if (!s?.category) continue;
      mappings.push({
        productId: p.id,
        productCode: p.product_code,
        productName: p.product_name,
        price: p.price,
        category: s.category,
        attribute: s.attribute,
      });
    }
    onSync(mappings);
  };

  const selectedCount = Object.values(selected).filter((s) => s?.category).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">从商品管理同步</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">加载中...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-slate-500">商品管理暂无商品</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-amber-600">请先配置品类与属性</div>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 p-3 border border-slate-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{p.product_name}</div>
                    <div className="text-xs text-slate-500">
                      {p.product_code} · ¥{Number(p.price).toLocaleString()}
                    </div>
                  </div>
                  <select
                    value={selected[p.id]?.category || ''}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [p.id]: {
                          category: e.target.value,
                          attribute: undefined,
                        },
                      }))
                    }
                    className="w-32 px-2 py-1.5 border border-slate-300 rounded text-sm"
                  >
                    <option value="">不同步</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selected[p.id]?.attribute || ''}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [p.id]: {
                          ...prev[p.id],
                          attribute: e.target.value || undefined,
                        },
                      }))
                    }
                    disabled={!selected[p.id]?.category || getAttributesForCategory(selected[p.id].category).length === 0}
                    className="w-36 px-2 py-1.5 border border-slate-300 rounded text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {!selected[p.id]?.category
                        ? '先选品类'
                        : getAttributesForCategory(selected[p.id].category).length === 0
                          ? '无属性'
                          : '选择属性'}
                    </option>
                    {selected[p.id]?.category && getAttributesForCategory(selected[p.id].category).map((attr) => {
                      const catObj = categories.find((c) => c.name === selected[p.id].category) || { id: 'x', name: '', attributes: [] };
                      return (
                        <option key={attr} value={attr}>
                          {attrLabel(catObj, attr)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSync}
            disabled={loading || categories.length === 0 || selectedCount === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            同步 ({selectedCount} 个商品)
          </button>
        </div>
      </div>
    </div>
  );
};

// 编辑商品关联
const EditMappingDialog: React.FC<{
  mapping: ProductMapping;
  categories: CategoryConfig[];
  onSave: (m: ProductMapping) => void;
  onCancel: () => void;
}> = ({ mapping, categories, onSave, onCancel }) => {
  const [category, setCategory] = useState(mapping.category);
  const [attribute, setAttribute] = useState(mapping.attribute || '');

  const attrs = categories.find((c) => c.name === category)?.attributes || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">编辑关联</h3>
        <p className="text-sm text-slate-600 mb-4">{mapping.productName}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">品类</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setAttribute('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">属性（可选）</label>
            <select
              value={attribute}
              onChange={(e) => setAttribute(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-</option>
              {attrs.map((a) => {
                const cat = categories.find((c) => c.name === category) || { id: 'x', name: '', attributes: [] };
                return (
                  <option key={a} value={a}>
                    {attrLabel(cat, a)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={() =>
              onSave({
                ...mapping,
                category,
                attribute: attribute || undefined,
              })
            }
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
