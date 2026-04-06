/**
 * B端-销售业绩：按订单汇总业绩，展示订单明细与佣金
 */

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../config/api';
import { Package, TrendingUp, DollarSign } from 'lucide-react';
import ListPagination from '../components/common/ListPagination';

interface OrderItem {
  id: string;
  order_number: string;
  total_amount: number;
  created_at: string;
  payment_time?: string | null;
  used_discount_rate?: number;
  used_commission_rate?: number;
  used_config_version?: number | null;
  estimated_commission?: number;
}

interface SalesSummary {
  salesperson_id: string;
  total_amount: number;
  order_count: number;
  estimated_commission_total?: number;
  orders: OrderItem[];
  salesperson: { id: string; code?: string; display_id?: string; name: string; level?: string } | null;
}

interface SettlementSnapshotItem {
  id: string;
  order_id: string;
  order_number: string;
  salesperson_id?: string | null;
  salesperson?: { id: string; code?: string; display_id?: string; name: string; level?: string } | null;
  payment_time?: string | null;
  settled_amount: number;
  config_version?: number | null;
  discount_rate: number;
  commission_rate: number;
  estimated_commission: number;
  created_at: string;
  config_snapshot?: {
    version?: number;
    effective_at?: string;
    product_mappings?: SnapshotProductMapping[];
    discount_rates?: SnapshotDiscountRate[];
  } | null;
}

interface SnapshotProductMapping {
  productId?: string;
  product_id?: string;
  product_code?: string;
  product_name?: string;
  category?: string;
  attribute?: string;
}

interface SnapshotDiscountRate {
  category?: string;
  attribute?: string;
  discountRate?: number;
  discount_rate?: number;
}

/** 快照折算率按品类汇总：每品类一行，属性与折算率在单元格内标签横排 */
function groupSnapshotDiscountRatesByCategory(rates: SnapshotDiscountRate[]) {
  const byCat = new Map<string, SnapshotDiscountRate[]>();
  for (const r of rates) {
    const c = String(r.category ?? '').trim() || '-';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(r);
  }
  const out: Array<{
    category: string;
    base: SnapshotDiscountRate | null;
    attributes: Array<{ attribute: string; rate: number }>;
  }> = [];
  for (const [category, list] of byCat) {
    const base = list.find((x) => !String(x.attribute ?? '').trim()) ?? null;
    const attrMap = new Map<string, number>();
    for (const x of list) {
      const a = String(x.attribute ?? '').trim();
      if (!a) continue;
      attrMap.set(a, Number(x.discountRate ?? x.discount_rate ?? 0));
    }
    const attributes = Array.from(attrMap.entries())
      .map(([attribute, rate]) => ({ attribute, rate }))
      .sort((a, b) => a.attribute.localeCompare(b.attribute, 'zh-CN'));
    out.push({ category, base, attributes });
  }
  out.sort((a, b) => a.category.localeCompare(b.category, 'zh-CN'));
  return out;
}

interface ProductRef {
  id: string;
  product_code?: string;
  product_name?: string;
}

export default function BSalesPerformance() {
  const [summary, setSummary] = useState<SalesSummary[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalEstimatedCommission, setTotalEstimatedCommission] = useState(0);
  const [snapshotList, setSnapshotList] = useState<SettlementSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [snapshotOrderNumber, setSnapshotOrderNumber] = useState('');
  const [snapshotSalespersonKeyword, setSnapshotSalespersonKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<'performance' | 'snapshot'>('performance');
  const [selectedSnapshot, setSelectedSnapshot] = useState<SettlementSnapshotItem | null>(null);
  const [productRefMap, setProductRefMap] = useState<Record<string, ProductRef>>({});
  const [performancePage, setPerformancePage] = useState(1);
  const [performanceLimit, setPerformanceLimit] = useState(20);
  const [snapshotPage, setSnapshotPage] = useState(1);
  const [snapshotLimit, setSnapshotLimit] = useState(20);

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const data = await apiClient.get<{
        summary: SalesSummary[];
        total_orders: number;
        total_amount: number;
      }>(`/api/admin/sales-persons/performance?${params.toString()}`);
      setSummary(data.summary || []);
      setTotalOrders(data.total_orders || 0);
      setTotalAmount(data.total_amount || 0);
      setTotalEstimatedCommission(
        (data.summary || []).reduce(
          (sum, row) => sum + Number(row.estimated_commission_total || 0),
          0
        )
      );
    } catch (e) {
      console.error('Load performance failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (snapshotOrderNumber.trim()) params.append('order_number', snapshotOrderNumber.trim());
      if (snapshotSalespersonKeyword.trim()) params.append('salesperson_keyword', snapshotSalespersonKeyword.trim());
      params.append('limit', '500');
      const data = await apiClient.get<{
        summary: { total_count: number; total_amount: number; total_estimated_commission: number };
        snapshots: SettlementSnapshotItem[];
        product_ref_map?: Record<string, ProductRef>;
      }>(`/api/admin/sales-persons/settlement-snapshots?${params.toString()}`);
      setSnapshotList(data.snapshots || []);
      setProductRefMap(data.product_ref_map || {});
      setTotalOrders(Number(data.summary?.total_count || 0));
      setTotalAmount(Number(data.summary?.total_amount || 0));
      setTotalEstimatedCommission(Number(data.summary?.total_estimated_commission || 0));
    } catch (e) {
      console.error('Load settlement snapshots failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const calcSalesCommission = (s: SalesSummary) =>
    Number(s.estimated_commission_total || 0);

  const formatDate = (s?: string) => {
    if (!s) return '-';
    return new Date(s).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSnapshotMappings = (snapshot?: SettlementSnapshotItem | null) =>
    Array.isArray(snapshot?.config_snapshot?.product_mappings)
      ? snapshot!.config_snapshot!.product_mappings!
      : [];

  const getSnapshotRates = (snapshot?: SettlementSnapshotItem | null) =>
    Array.isArray(snapshot?.config_snapshot?.discount_rates)
      ? snapshot!.config_snapshot!.discount_rates!
      : [];

  const renderProductLabel = (mapping: SnapshotProductMapping) => {
    const embeddedCode = String(mapping.product_code || '').trim();
    const embeddedName = String(mapping.product_name || '').trim();
    if (embeddedCode && embeddedName) return `${embeddedCode} | ${embeddedName}`;
    if (embeddedCode || embeddedName) return embeddedCode || embeddedName;

    const productId = String(mapping.productId || mapping.product_id || '').trim();
    if (!productId) return '-';
    const ref = productRefMap[productId];
    if (!ref) return productId;
    const code = String(ref.product_code || '').trim();
    const name = String(ref.product_name || '').trim();
    if (code && name) return `${code} | ${name}`;
    return code || name || productId;
  };

  const paginatedSummary = useMemo(() => {
    const start = (performancePage - 1) * performanceLimit;
    return summary.slice(start, start + performanceLimit);
  }, [summary, performancePage, performanceLimit]);
  const performanceTotal = summary.length;
  const performanceTotalPages = Math.max(1, Math.ceil(performanceTotal / performanceLimit));

  const paginatedSnapshots = useMemo(() => {
    const start = (snapshotPage - 1) * snapshotLimit;
    return snapshotList.slice(start, start + snapshotLimit);
  }, [snapshotList, snapshotPage, snapshotLimit]);
  const snapshotTotal = snapshotList.length;
  const snapshotTotalPages = Math.max(1, Math.ceil(snapshotTotal / snapshotLimit));

  const snapshotRatesFlat = useMemo(
    () => getSnapshotRates(selectedSnapshot),
    [selectedSnapshot]
  );
  const groupedSnapshotRates = useMemo(
    () => groupSnapshotDiscountRatesByCategory(snapshotRatesFlat),
    [snapshotRatesFlat]
  );

  useEffect(() => {
    if (performancePage > performanceTotalPages) setPerformancePage(performanceTotalPages);
  }, [performancePage, performanceTotalPages]);

  useEffect(() => {
    if (snapshotPage > snapshotTotalPages) setSnapshotPage(snapshotTotalPages);
  }, [snapshotPage, snapshotTotalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">销售业绩与结算快照</h2>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => {
            setActiveTab('performance');
            if (summary.length === 0) loadPerformance();
          }}
          className={`px-4 py-2 rounded-lg border ${
            activeTab === 'performance'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          销售业绩
        </button>
        <button
          onClick={() => {
            setActiveTab('snapshot');
            if (snapshotList.length === 0) loadSnapshots();
          }}
          className={`px-4 py-2 rounded-lg border ${
            activeTab === 'snapshot'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          结算快照
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="self-center text-gray-500">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {activeTab === 'snapshot' && (
          <>
            <input
              type="text"
              value={snapshotOrderNumber}
              onChange={(e) => setSnapshotOrderNumber(e.target.value)}
              placeholder="订单号（模糊）"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={snapshotSalespersonKeyword}
              onChange={(e) => setSnapshotSalespersonKeyword(e.target.value)}
              placeholder="销售员姓名/工号"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </>
        )}
        <button
          onClick={activeTab === 'performance' ? loadPerformance : loadSnapshots}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          查询
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">已支付订单数</p>
            <p className="text-xl font-semibold">{totalOrders}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">已支付总金额</p>
            <p className="text-xl font-semibold text-red-600">¥{totalAmount.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">佣金合计（估算）</p>
            <p className="text-xl font-semibold text-amber-600">¥{totalEstimatedCommission.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {activeTab === 'performance' ? (
        <div className="space-y-4">
          {summary.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              暂无订单业绩数据（需订单关联销售员且已支付）
            </div>
          ) : (
            paginatedSummary.map((s) => (
              <div
                key={s.salesperson_id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expandedId === s.salesperson_id ? null : s.salesperson_id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {s.salesperson?.name || '未知'}
                        {s.salesperson?.level && (
                          <span className="ml-2 text-gray-500 text-sm">{s.salesperson.level}</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        {s.salesperson?.code && `工号 ${s.salesperson.code}`}
                        {s.order_count} 笔订单
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-6">
                    <div>
                      <p className="text-xs text-gray-500">业绩</p>
                      <p className="font-semibold text-red-600">¥{s.total_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">销售佣金（估算）</p>
                      <p className="font-semibold text-amber-600">
                        ¥{calcSalesCommission(s).toFixed(2)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">{s.order_count} 笔</p>
                  </div>
                  <span
                    className={`text-gray-400 transition-transform ${expandedId === s.salesperson_id ? 'rotate-180' : ''}`}
                  >
                    ▼
                  </span>
                </div>
                {expandedId === s.salesperson_id && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-gray-600">订单号</th>
                          <th className="px-4 py-2 text-left text-gray-600">金额</th>
                          <th className="px-4 py-2 text-left text-gray-600">折算率版本</th>
                          <th className="px-4 py-2 text-left text-gray-600">折算率</th>
                          <th className="px-4 py-2 text-left text-gray-600">佣金（估算）</th>
                          <th className="px-4 py-2 text-left text-gray-600">支付时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.orders.map((o) => (
                          <tr key={o.id} className="border-b border-gray-100">
                            <td className="px-4 py-2 font-mono">{o.order_number}</td>
                            <td className="px-4 py-2 text-red-600">¥{Number(o.total_amount).toFixed(2)}</td>
                            <td className="px-4 py-2 text-gray-600">{o.used_config_version ? `v${o.used_config_version}` : '-'}</td>
                            <td className="px-4 py-2 text-gray-600">
                              {typeof o.used_discount_rate === 'number' ? `${(o.used_discount_rate * 100).toFixed(1)}%` : '-'}
                            </td>
                            <td className="px-4 py-2 text-amber-600">
                              ¥{Number(o.estimated_commission || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-gray-500">{formatDate(o.payment_time || o.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}

          <ListPagination
            page={performancePage}
            totalPages={performanceTotalPages}
            total={performanceTotal}
            limit={performanceLimit}
            onPageChange={setPerformancePage}
            onLimitChange={(nextLimit) => {
              setPerformanceLimit(nextLimit);
              setPerformancePage(1);
            }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {snapshotList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无结算快照</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-gray-600">订单号</th>
                    <th className="px-4 py-2 text-left text-gray-600">销售员</th>
                    <th className="px-4 py-2 text-left text-gray-600">结算金额</th>
                    <th className="px-4 py-2 text-left text-gray-600">折算率版本</th>
                    <th className="px-4 py-2 text-left text-gray-600">折算率</th>
                    <th className="px-4 py-2 text-left text-gray-600">佣金率</th>
                    <th className="px-4 py-2 text-left text-gray-600">佣金（估算）</th>
                    <th className="px-4 py-2 text-left text-gray-600">支付时间</th>
                    <th className="px-4 py-2 text-left text-gray-600">快照内容</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSnapshots.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 align-top">
                      <td className="px-4 py-2 font-mono">{row.order_number || '-'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {row.salesperson?.name || '-'}
                        {row.salesperson?.code ? `（${row.salesperson.code}）` : ''}
                      </td>
                      <td className="px-4 py-2 text-red-600">¥{Number(row.settled_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-gray-600">{row.config_version ? `v${row.config_version}` : '-'}</td>
                      <td className="px-4 py-2 text-gray-600">{(Number(row.discount_rate || 0) * 100).toFixed(2)}%</td>
                      <td className="px-4 py-2 text-gray-600">{(Number(row.commission_rate || 0) * 100).toFixed(2)}%</td>
                      <td className="px-4 py-2 text-amber-600">¥{Number(row.estimated_commission || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-gray-500">{formatDate(row.payment_time || row.created_at)}</td>
                      <td className="px-4 py-2 text-gray-500">
                        <button
                          onClick={() => setSelectedSnapshot(row)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'snapshot' && (
        <ListPagination
          page={snapshotPage}
          totalPages={snapshotTotalPages}
          total={snapshotTotal}
          limit={snapshotLimit}
          onPageChange={setSnapshotPage}
          onLimitChange={(nextLimit) => {
            setSnapshotLimit(nextLimit);
            setSnapshotPage(1);
          }}
        />
      )}

      {selectedSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div
            className="w-full max-w-5xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold">结算快照详情</h3>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-auto p-5">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">订单号</p>
                  <p className="mt-1 font-mono">{selectedSnapshot.order_number || '-'}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">折算率版本</p>
                  <p className="mt-1 font-medium">
                    {selectedSnapshot.config_version ? `v${selectedSnapshot.config_version}` : '-'}
                  </p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">支付时间</p>
                  <p className="mt-1">{formatDate(selectedSnapshot.payment_time || selectedSnapshot.created_at)}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">快照生成时间</p>
                  <p className="mt-1">{formatDate(selectedSnapshot.created_at)}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">结算金额</p>
                  <p className="mt-1 text-red-600">¥{Number(selectedSnapshot.settled_amount || 0).toFixed(2)}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">折算率</p>
                  <p className="mt-1">{(Number(selectedSnapshot.discount_rate || 0) * 100).toFixed(2)}%</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">佣金率</p>
                  <p className="mt-1">{(Number(selectedSnapshot.commission_rate || 0) * 100).toFixed(2)}%</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-gray-500">佣金（估算）</p>
                  <p className="mt-1 text-amber-600">¥{Number(selectedSnapshot.estimated_commission || 0).toFixed(2)}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-800">
                  商品映射（{getSnapshotMappings(selectedSnapshot).length}）
                </h4>
                <div className="overflow-x-auto rounded border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-gray-600">商品（编号 | 名称）</th>
                        <th className="px-3 py-2 text-left text-gray-600">品类</th>
                        <th className="px-3 py-2 text-left text-gray-600">属性</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSnapshotMappings(selectedSnapshot).length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-gray-500" colSpan={3}>无</td>
                        </tr>
                      ) : (
                        getSnapshotMappings(selectedSnapshot).map((m, idx) => (
                          <tr key={`${String(m.productId || m.product_id || '')}-${idx}`} className="border-t border-gray-100">
                            <td className="px-3 py-2">{renderProductLabel(m)}</td>
                            <td className="px-3 py-2">{m.category || '-'}</td>
                            <td className="px-3 py-2">{m.attribute || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-800">
                  折算率配置（{groupedSnapshotRates.length} 个品类
                  {snapshotRatesFlat.length > 0 ? `，明细 ${snapshotRatesFlat.length} 条` : ''}）
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">品类</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">属性</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">折算率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {groupedSnapshotRates.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-slate-400" colSpan={3}>无</td>
                        </tr>
                      ) : (
                        groupedSnapshotRates.map((g) => {
                          const hasAttr = g.attributes.length > 0;
                          const baseRate = g.base
                            ? Number(g.base.discountRate ?? g.base.discount_rate ?? 0)
                            : 0;
                          return (
                            <tr key={g.category}>
                              <td className="px-4 py-3 font-semibold text-slate-900">{g.category}</td>
                              <td className="px-4 py-3 text-slate-700">
                                {hasAttr ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {g.attributes.map((a) => (
                                      <span
                                        key={a.attribute}
                                        className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700"
                                      >
                                        {a.attribute}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <div className="flex flex-wrap gap-1.5">
                                  {hasAttr ? (
                                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                                      基础（属性明细生效，已失效）
                                    </span>
                                  ) : (
                                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                      基础 {(baseRate * 100).toFixed(0)}%
                                    </span>
                                  )}
                                  {hasAttr &&
                                    g.attributes.map((a) => (
                                      <span
                                        key={a.attribute}
                                        className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                                      >
                                        {a.attribute} {(a.rate * 100).toFixed(0)}%
                                      </span>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
