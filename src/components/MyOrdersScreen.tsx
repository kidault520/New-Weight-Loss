import React, { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { DrawerScreen } from './common/DrawerScreen';
import { LoadingState } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';
import { PaymentModal, PaymentOrderInfo } from './PaymentModal';
import { formatDate } from '../utils/dateFormatters';
import { isOrderInService } from '../utils/orderStatusUtils';
import { useExecutionProgram } from '../hooks/useExecutionProgram';
import { useUserProfile } from '../contexts/UserProfileContext';
import { useAuth } from '../contexts/AuthContext';
import { dismissProfileBadge } from '../hooks/useProfileBadges';
import { SUPABASE_TABLE_QUERY_TIMEOUT_MS } from '../constants/authTimeouts';

/** PostgREST 嵌套 select 在部分库/视图上会长时间无响应；订单列表改为扁平查询 + 分批拉取关联表。 */
const ORDERS_FLAT_COLUMNS = `
  id,
  order_number,
  user_id,
  product_id,
  quantity,
  unit_price,
  total_amount,
  payment_method,
  payment_status,
  payment_time,
  included_meal_types,
  order_status,
  created_at,
  salesperson_id
`.replace(/\s+/g, ' ').trim();

async function withAbortTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number, label: string): Promise<T> {
  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), ms);
  try {
    return await run(ac.signal);
  } catch (e: unknown) {
    if (ac.signal.aborted) {
      throw new Error(`${label}_TIMEOUT`);
    }
    throw e;
  } finally {
    window.clearTimeout(t);
  }
}

interface OrderProduct {
  id: string;
  product_name: string;
  product_code?: string;
  duration_days?: number;
  meal_plan_id?: string | null;
  supplement_plan_id?: string | null;
}

interface OrderRecord {
  id: string;
  order_number: string;
  user_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  payment_time: string | null;
  confirm_status?: 'unconfirmed' | 'confirmed' | null;
  confirm_time?: string | null;
  included_meal_types?: string[] | null;
  order_status: string;
  created_at: string;
  products: OrderProduct | null;
  sales_persons?: { id: string; name: string } | null;
}

interface OrdersFlatRow {
  id: string;
  order_number: string;
  user_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  payment_time: string | null;
  included_meal_types: string[] | null;
  order_status: string;
  created_at: string;
  salesperson_id: string | null;
  confirm_status?: 'unconfirmed' | 'confirmed' | null;
  confirm_time?: string | null;
}

async function enrichOrdersFromFlatRows(rows: OrdersFlatRow[], signal: AbortSignal): Promise<OrderRecord[]> {
  if (rows.length === 0) return [];

  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
  const salesIds = [...new Set(rows.map((r) => r.salesperson_id).filter(Boolean))] as string[];

  const [productsRes, salesRes] = await Promise.all([
    productIds.length > 0
      ? supabase
          .from('products')
          .select('id, product_name, product_code, duration_days, meal_plan_id, supplement_plan_id')
          .in('id', productIds)
          .abortSignal(signal)
      : Promise.resolve({ data: [] as OrderProduct[], error: null }),
    salesIds.length > 0
      ? supabase.from('sales_persons').select('id, name').in('id', salesIds).abortSignal(signal)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (salesRes.error) throw salesRes.error;

  const pmap = new Map((productsRes.data || []).map((p) => [p.id, p as OrderProduct]));
  const smap = new Map((salesRes.data || []).map((s) => [s.id, s]));

  return rows.map((row) => {
    const { salesperson_id, ...core } = row;
    return {
      ...core,
      products: row.product_id ? pmap.get(row.product_id) ?? null : null,
      sales_persons: salesperson_id ? smap.get(salesperson_id) ?? null : null,
    } as OrderRecord;
  });
}

interface MyOrdersScreenProps {
  onClose: () => void;
  /** 点击「开启服务」时跳转到配置配送计划 */
  onOpenDeliveryPlan?: (durationDays?: number, orderId?: string) => void;
  /** 点击「续订套餐」时跳转到服务套餐页 */
  onRenewPackage?: () => void;
}

const PAYMENT_STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待支付', color: 'bg-amber-100 text-amber-700' },
  paid: { text: '已支付', color: 'bg-green-100 text-green-700' },
  refunded: { text: '已退款', color: 'bg-gray-100 text-gray-600' },
  cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-500' },
};

const ORDER_AGREEMENT_FIELDS_SUPPORTED_STORAGE_KEY = 'orders_agreement_fields_supported';

const getPersistedAgreementSupport = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ORDER_AGREEMENT_FIELDS_SUPPORTED_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
};

const persistAgreementSupport = (supported: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ORDER_AGREEMENT_FIELDS_SUPPORTED_STORAGE_KEY, String(supported));
  } catch {
    // Ignore storage write errors in private mode or restricted environments.
  }
};

// 进程级缓存 + 本地持久化：默认按“不支持 confirm_*”处理，彻底避免首发 400
let orderAgreementFieldsSupportedCache = getPersistedAgreementSupport() ?? false;

/** 默认服务协议确认模板（非第三方电子签） */
const DEFAULT_CONTRACT = `一、服务内容
甲方（服务方）为乙方（用户）提供个性化营养方案及健康管理服务，包括但不限于：定制餐食计划、补剂方案、体重与健康数据跟踪等。

二、服务期限
以订单约定的方案时长为准，自方案正式生效之日起计算。

三、费用与支付
1. 乙方应按照订单金额在签约后完成支付；
2. 支付完成后，甲方将按约定启动服务。

四、用户义务
1. 乙方应如实提供健康信息，配合完成评估；
2. 乙方应按照方案建议执行，如有疑问及时沟通。

五、退款政策
具体退款规则以实际服务协议为准，如有争议可联系客服协商。

六、其他
本服务协议在用户确认后生效，电子签链路按后续版本接入。`;

const MyOrdersScreen: React.FC<MyOrdersScreenProps> = ({ onClose, onOpenDeliveryPlan, onRenewPackage }) => {
  const queryClient = useQueryClient();
  const { hasActiveSession, user: authUser } = useAuth();
  const { program: executionProgram } = useExecutionProgram();
  const { mealPlanConfigured } = useUserProfile();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [agreementFieldsSupported, setAgreementFieldsSupported] = useState(orderAgreementFieldsSupportedCache);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrderInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadGenRef = useRef(0);

  const handlePaymentSuccess = async () => {
    await loadOrders();
    queryClient.invalidateQueries({ queryKey: ['profile-badges'] });
  };

  useEffect(() => {
    if (!hasActiveSession || !authUser?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadOrders();
  }, [hasActiveSession, authUser?.id]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['execution-program'] });
  }, [queryClient]);

  useEffect(() => {
    dismissProfileBadge('orders').then(() =>
      queryClient.invalidateQueries({ queryKey: ['profile-badges'] })
    );
  }, [queryClient]);

  const loadOrders = async () => {
    const gen = ++loadGenRef.current;
    try {
      setLoadError(null);
      const userId = authUser?.id;
      if (!userId) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const knownAgreementSupport = orderAgreementFieldsSupportedCache;
      const confirmCols = ', confirm_status, confirm_time';

      const fetchOrderRows = (includeConfirm: boolean, signal: AbortSignal) =>
        Promise.resolve(
          supabase
            .from('orders')
            .select(ORDERS_FLAT_COLUMNS + (includeConfirm ? confirmCols : ''))
            .eq('user_id', userId)
            .neq('order_status', 'cancelled')
            .order('created_at', { ascending: false })
            .abortSignal(signal),
        );

      let agreementSupported = knownAgreementSupport;
      let listRes = await withAbortTimeout(
        (signal) => fetchOrderRows(agreementSupported, signal),
        SUPABASE_TABLE_QUERY_TIMEOUT_MS,
        'orders_flat_list'
      );

      if (listRes.error && knownAgreementSupport) {
        agreementSupported = false;
        orderAgreementFieldsSupportedCache = false;
        persistAgreementSupport(false);
        listRes = await withAbortTimeout(
          (signal) => fetchOrderRows(false, signal),
          SUPABASE_TABLE_QUERY_TIMEOUT_MS,
          'orders_flat_retry'
        );
      }

      setAgreementFieldsSupported(agreementSupported);
      orderAgreementFieldsSupportedCache = agreementSupported;
      persistAgreementSupport(agreementSupported);

      if (listRes.error) throw listRes.error;

      const rows = (listRes.data || []) as unknown as OrdersFlatRow[];

      const enriched = await withAbortTimeout(
        (signal) => enrichOrdersFromFlatRows(rows, signal),
        SUPABASE_TABLE_QUERY_TIMEOUT_MS,
        'orders_enrich'
      );

      if (loadGenRef.current !== gen) return;

      setOrders(enriched);
    } catch (error) {
      if (loadGenRef.current !== gen) return;
      console.error('Failed to load orders:', error);
      setOrders([]);
      const isTimeout = error instanceof Error && /_TIMEOUT$/.test(error.message);
      setLoadError(
        isTimeout ? '加载超时，请检查网络后重试' : '订单加载失败，请稍后重试'
      );
    } finally {
      if (loadGenRef.current === gen) {
        setLoading(false);
      }
    }
  };

  const getPaymentStatusDisplay = (status: string) =>
    PAYMENT_STATUS_MAP[status] || { text: status, color: 'bg-gray-100 text-gray-600' };

  const formatAmount = (amount: number) =>
    `¥${Number(amount).toFixed(2)}`;

  const handleConfirmAgreement = async (orderId: string) => {
    try {
      setConfirmingOrderId(orderId);
      if (!authUser?.id) return;
      const { error } = await supabase
        .from('orders')
        .update({
          confirm_status: 'confirmed',
          confirm_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('user_id', authUser.id);
      if (error) throw error;
      await loadOrders();
    } catch (error) {
      console.error('Failed to confirm service agreement:', error);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  /** 判断订单是否已结束（根据支付时间+方案时长） */
  const isOrderEnded = (order: OrderRecord) => {
    if (order.payment_status !== 'paid' || !order.payment_time) return false;
    const durationDays = order.products?.duration_days || 0;
    if (durationDays <= 0) return false;
    const startDate = new Date(order.payment_time);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays - 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > endDate;
  };

  const handleOpenService = (durationDays?: number, orderId?: string) => {
    if (onOpenDeliveryPlan) {
      onOpenDeliveryPlan(durationDays, orderId); // 已包含关闭订单页并打开配送计划
    } else {
      onClose();
    }
  };

  return (
    <DrawerScreen show={true} onClose={onClose} showDragHandle={false} showMask={false}>
      <div className="flex flex-col h-full bg-gray-50">
        <SecondaryPageHeader title="我的订单" onClose={onClose} />

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <LoadingState />
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Package className="w-10 h-10 text-amber-500 mb-3" />
              <p className="text-sm text-gray-700 text-center mb-4">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(null);
                  setLoading(true);
                  void loadOrders();
                }}
                className="px-5 py-2.5 rounded-xl bg-yellow-400 text-gray-900 text-sm font-semibold hover:bg-yellow-500 transition-colors"
              >
                重试
              </button>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<Package className="w-10 h-10 text-gray-400" />}
              title="暂无订单记录"
              description="开始您的健康之旅，创建第一个营养方案"
            />
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const productName = order.products?.product_name || '营养方案';
                const durationDays = order.products?.duration_days || 0;
                const hasMealPlan =
                  !!order.products?.meal_plan_id ||
                  (Array.isArray(order.included_meal_types) && order.included_meal_types.length > 0);
                const hasSupplementPlan = !!order.products?.supplement_plan_id;
                const orderMealTypes = hasMealPlan
                  ? (Array.isArray(order.included_meal_types) && order.included_meal_types.length > 0
                    ? order.included_meal_types
                    : ['午餐', '晚餐'])
                  : [];
                const mealsPerDay = orderMealTypes.length;
                const mealPortions = hasMealPlan ? Math.max(0, durationDays * mealsPerDay) : 0;
                const orderEnded = isOrderEnded(order);
                const latestPaidOrderId = orders.find((o) => o.payment_status === 'paid')?.id;
                const isServiceActive =
                  isOrderInService(order, orderEnded) ||
                  (!!executionProgram?.order_id &&
                    executionProgram.order_id === order.id &&
                    executionProgram.status === 'active' &&
                    !orderEnded) ||
                  (mealPlanConfigured &&
                    order.payment_status === 'paid' &&
                    !orderEnded &&
                    order.id === latestPaidOrderId);
                const isOrderCancelled =
                  order.order_status === 'cancelled' || order.payment_status === 'cancelled';
                const statusDisplay = isOrderCancelled
                  ? getPaymentStatusDisplay('cancelled')
                  : isServiceActive
                    ? { text: '服务中', color: 'bg-blue-100 text-blue-700' }
                    : getPaymentStatusDisplay(order.payment_status);
                const isExpanded = expandedOrderId === order.id;
                const isAgreementConfirmed = !agreementFieldsSupported || order.confirm_status === 'confirmed';

                return (
                  <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <h3 className="text-base font-semibold text-gray-800">
                              {productName}
                            </h3>
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusDisplay.color}`}>
                              {statusDisplay.text}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            订单号：{order.order_number}
                          </p>
                          <p className="text-xs text-gray-500">
                            下单日期：{formatDate(order.created_at)}
                          </p>
                        </div>
                        <Package className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                      </div>

                      <div className="space-y-2.5 mb-3">
                        <div className="flex items-center gap-4 text-sm text-gray-700">
                          <span><span className="font-medium">数量：</span><span className="ml-1">×{order.quantity}</span></span>
                          {durationDays > 0 && (
                            <span><span className="font-medium">时长：</span><span className="ml-1">{durationDays} 天</span></span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
                          <span>
                            <span className="font-medium">金额：</span>
                            <span className="ml-1 text-red-600 font-semibold">{formatAmount(order.total_amount)}</span>
                          </span>
                          <span>
                            <span className="font-medium">健康顾问：</span>
                            <span className="ml-1">{order.sales_persons?.name || '—'}</span>
                          </span>
                        </div>
                      </div>

                      {/* 已支付订单：套餐内容 + 操作按钮 */}
                      {order.payment_status === 'paid' && (
                        <>
                          <div className="border-t border-gray-100 pt-3 space-y-2">
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">套餐内容</h4>
                            {hasMealPlan && (
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center">
                                      <span className="text-green-700 text-xs font-bold">餐</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{durationDays}天健康餐包</p>
                                      <p className="text-xs text-gray-600">包含 {orderMealTypes.join(' + ')}</p>
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-500">{mealPortions}份</span>
                                </div>
                              </div>
                            )}
                            {hasSupplementPlan && (
                              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center">
                                      <span className="text-orange-700 text-xs font-bold">补</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">个性化补剂方案</p>
                                      <p className="text-xs text-gray-600">个性化营养补充</p>
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-500">{durationDays}份</span>
                                </div>
                              </div>
                            )}
                            {!hasMealPlan && !hasSupplementPlan && (
                              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                该订单未包含餐食或补剂计划
                              </div>
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            {orderEnded ? (
                              <button
                                onClick={() => {
                                  onClose();
                                  onRenewPackage?.();
                                }}
                                className="w-full py-2.5 rounded-xl bg-yellow-400 text-gray-900 text-sm font-semibold hover:bg-yellow-500 transition-colors"
                              >
                                续订套餐
                              </button>
                            ) : isServiceActive ? (
                              <button
                                type="button"
                                disabled
                                className="w-full py-2.5 rounded-xl bg-blue-100 text-blue-700 text-sm font-semibold border border-blue-200 cursor-default"
                              >
                                服务中
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenService(durationDays, order.id)}
                                className="w-full py-2.5 rounded-xl bg-yellow-400 text-gray-900 text-sm font-semibold hover:bg-yellow-500 transition-colors"
                              >
                                开启服务
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {order.payment_status === 'pending' && !isOrderCancelled && (
                        <>
                          {agreementFieldsSupported && (
                            <button
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium border-2 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 transition-colors"
                            >
                              {isExpanded ? '收起' : '查看协议详情'}
                            </button>
                          )}

                          {agreementFieldsSupported && isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto">
                                <h5 className="text-sm font-semibold text-gray-800 mb-2">服务协议确认</h5>
                                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                                  {DEFAULT_CONTRACT}
                                </pre>
                              </div>
                              {!isAgreementConfirmed ? (
                                <button
                                  onClick={() => handleConfirmAgreement(order.id)}
                                  disabled={confirmingOrderId === order.id}
                                  className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                                >
                                  {confirmingOrderId === order.id ? '确认中...' : '确认协议'}
                                </button>
                              ) : (
                                <p className="text-xs text-green-600 font-medium">✓ 已确认协议</p>
                              )}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <button
                              disabled={agreementFieldsSupported && !isAgreementConfirmed}
                              onClick={() =>
                                isAgreementConfirmed &&
                                setPaymentOrder({
                                  id: order.id,
                                  order_number: order.order_number,
                                  product_name: order.products?.product_name || '营养方案',
                                  total_amount: order.total_amount,
                                  payment_method: order.payment_method,
                                  agreementFieldsSupported,
                                  agreementConfirmedOnServer: order.confirm_status === 'confirmed',
                                })
                              }
                              className="w-full py-2.5 rounded-xl bg-yellow-400 text-gray-900 text-sm font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAgreementConfirmed ? '去支付' : '请先确认服务协议'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 h-4"></div>
      </div>

      <PaymentModal
        show={!!paymentOrder}
        onClose={() => setPaymentOrder(null)}
        order={paymentOrder}
        onSuccess={handlePaymentSuccess}
        onEnsureServerAgreement={
          paymentOrder
            ? async () => {
                await handleConfirmAgreement(paymentOrder.id);
              }
            : undefined
        }
      />
    </DrawerScreen>
  );
};

export default MyOrdersScreen;
