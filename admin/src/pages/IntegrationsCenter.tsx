import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../config/api';
import {
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  RefreshCw,
  Save,
  FlaskConical,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

type IntegrationState = 'ready' | 'partial' | 'planned';
type IntegrationTestMode = 'callback' | 'create';

interface EnvStatus {
  key: string;
  configured: boolean;
  valueMasked: string;
}

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  description: string;
  state: IntegrationState;
  backendPrepared: boolean;
  health: {
    ok: boolean;
    message: string;
    checkedAt: string;
  };
  missing: string[];
  config: {
    required: EnvStatus[];
    optional: EnvStatus[];
  };
  customConfig?: Record<string, unknown>;
  runtime?: {
    checksTotal: number;
    checksFailed: number;
    testsTotal: number;
    testsFailed: number;
    lastCheckAt: string | null;
    lastCheckOk: boolean | null;
    lastCheckMessage: string;
    lastTestAt: string | null;
    lastTestOk: boolean | null;
    lastTestMessage: string;
    lastErrorAt: string | null;
    lastErrorMessage: string;
  };
}

interface IntegrationsResponse {
  integrations: IntegrationItem[];
  summary: {
    total: number;
    ready: number;
    partial: number;
    planned: number;
  };
  generatedAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  auth: '认证与安全',
  commerce: '交易与支付',
  logistics: '物流配送',
  location: '位置服务',
  ai: 'AI 能力',
  notification: '消息通知',
  iot: '设备与 IoT',
};

/** 分类标签：浅底 + 饱和字色 */
const CATEGORY_TAG_CLASS: Record<string, string> = {
  auth: 'bg-sky-100 text-sky-700',
  commerce: 'bg-emerald-100 text-emerald-700',
  logistics: 'bg-violet-100 text-violet-700',
  location: 'bg-cyan-100 text-cyan-700',
  ai: 'bg-purple-100 text-purple-700',
  notification: 'bg-orange-100 text-orange-700',
  iot: 'bg-teal-100 text-teal-700',
};

const stateLabel: Record<IntegrationState, string> = {
  ready: '已就绪',
  partial: '部分就绪',
  planned: '待接入',
};

const stateCompactClass: Record<IntegrationState, string> = {
  ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-800 border-amber-200',
  planned: 'bg-slate-100 text-slate-600 border-slate-200',
};

const titleToneByState: Record<IntegrationState, string> = {
  ready: 'text-emerald-900',
  partial: 'text-amber-950',
  planned: 'text-slate-700',
};

const dotByState: Record<IntegrationState, string> = {
  ready: 'bg-emerald-500',
  partial: 'bg-amber-500',
  planned: 'bg-slate-400',
};

function StateIcon({ state }: { state: IntegrationState }) {
  if (state === 'ready') return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (state === 'partial') return <AlertTriangle className="w-3.5 h-3.5" />;
  return <CircleDashed className="w-3.5 h-3.5" />;
}

function categoryLabel(cat: string) {
  return CATEGORY_LABEL[cat] || cat || '其它';
}

function categoryTagClass(cat: string) {
  return CATEGORY_TAG_CLASS[cat] || 'bg-gray-100 text-gray-700';
}

export default function IntegrationsCenter() {
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [smsTestPhone, setSmsTestPhone] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>('all');

  const [testPayloadDraft, setTestPayloadDraft] = useState<Record<string, string>>({
    payment: JSON.stringify(
      {
        payment_event_id: `evt-${Date.now()}`,
        external_order_id: 'ORDER_NO',
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
      },
      null,
      2
    ),
    delivery: JSON.stringify(
      {
        provider: 'mock',
        external_order_id: 'ORDER_NO',
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      },
      null,
      2
    ),
  });
  const [testModeDraft, setTestModeDraft] = useState<Record<string, IntegrationTestMode>>({
    payment: 'callback',
    delivery: 'callback',
  });

  const load = async () => {
    setLoading(true);
    setErrorText('');
    setSuccessText('');
    try {
      const resp = await apiClient.get<IntegrationsResponse>('/api/admin/integrations');
      setData(resp);
      const nextDraft: Record<string, string> = {};
      (resp.integrations || []).forEach((it) => {
        nextDraft[it.id] = JSON.stringify(it.customConfig || {}, null, 2);
      });
      setConfigDraft(nextDraft);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sortedItems = useMemo(() => {
    const items = data?.integrations || [];
    return [...items].sort((a, b) => {
      const rank = (s: IntegrationState) => (s === 'ready' ? 0 : s === 'partial' ? 1 : 2);
      const r = rank(a.state) - rank(b.state);
      if (r !== 0) return r;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  }, [data?.integrations]);

  const tabCategories = useMemo(() => {
    const set = new Set<string>();
    sortedItems.forEach((i) => set.add(i.category));
    return [...set].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), 'zh-CN'));
  }, [sortedItems]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    sortedItems.forEach((i) => m.set(i.category, (m.get(i.category) || 0) + 1));
    return m;
  }, [sortedItems]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return sortedItems;
    return sortedItems.filter((i) => i.category === activeTab);
  }, [sortedItems, activeTab]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const runHealthCheck = async (id: string) => {
    setCheckingId(id);
    setErrorText('');
    setSuccessText('');
    try {
      await apiClient.post(`/api/admin/integrations/${id}/health-check`);
      setSuccessText(`已完成 ${id} 健康检查`);
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '健康检查失败');
    } finally {
      setCheckingId(null);
    }
  };

  const runTest = async (id: string) => {
    setTestingId(id);
    setErrorText('');
    setSuccessText('');
    try {
      const payload: Record<string, unknown> = { dryRun: true };
      if (id === 'sms' && /^1[3-9]\d{9}$/.test(smsTestPhone.trim())) {
        payload.phone = smsTestPhone.trim();
        payload.dryRun = false;
      }
      if (id === 'payment' || id === 'delivery') {
        const raw = testPayloadDraft[id] || '{}';
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new Error('联调 payload JSON 格式不正确');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('联调 payload 必须是 JSON 对象');
        }
        payload.mode = testModeDraft[id] || 'callback';
        payload.payload = parsed;
      }
      const resp = await apiClient.post<{ test?: { message?: string } }>(`/api/admin/integrations/${id}/test`, payload);
      setSuccessText(resp?.test?.message || `已完成 ${id} 联调测试`);
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '联调测试失败');
    } finally {
      setTestingId(null);
    }
  };

  const saveConfig = async (id: string) => {
    setSavingId(id);
    setErrorText('');
    setSuccessText('');
    try {
      let parsed: unknown = {};
      const raw = configDraft[id] || '{}';
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('配置 JSON 格式不正确');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('配置必须是 JSON 对象');
      }
      await apiClient.put(`/api/admin/integrations/${id}/config`, { config: parsed });
      setSuccessText(`已保存 ${id} 配置`);
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '保存配置失败');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-full -mx-4 -mt-2 px-4 pb-8 bg-slate-50/90 rounded-xl">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">三方集成中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            统一查看三方接口配置、接入就绪度与运行健康状态
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {errorText && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorText}
        </div>
      )}
      {successText && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successText}
        </div>
      )}

      {loading ? (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 text-gray-500 shadow-sm">加载中...</div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-1 border-b border-gray-200 pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'all'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              全部 ({sortedItems.length})
            </button>
            {tabCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveTab(cat)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === cat
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                {categoryLabel(cat)} ({categoryCounts.get(cat) ?? 0})
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="总项数" value={data?.summary.total ?? 0} />
            <SummaryCard label="已就绪" value={data?.summary.ready ?? 0} tone="ready" />
            <SummaryCard label="部分就绪" value={data?.summary.partial ?? 0} tone="partial" />
            <SummaryCard label="待接入" value={data?.summary.planned ?? 0} tone="planned" />
          </div>

          <div className="mt-4 space-y-2">
            {filteredItems.map((item) => {
              const open = !!expanded[item.id];
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/80 transition-colors"
                  >
                    <span className="text-gray-400 shrink-0">
                      {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${categoryTagClass(item.category)}`}
                    >
                      {categoryLabel(item.category)}
                    </span>
                    <span
                      className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${dotByState[item.state]}`}
                      title={stateLabel[item.state]}
                      aria-hidden
                    />
                    <span className={`flex-1 min-w-0 font-semibold text-base ${titleToneByState[item.state]}`}>
                      {item.name}
                    </span>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border ${stateCompactClass[item.state]}`}
                    >
                      <StateIcon state={item.state} />
                      {stateLabel[item.state]}
                    </span>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className={`text-lg font-bold ${titleToneByState[item.state]}`}>{item.name}</h2>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${stateCompactClass[item.state]}`}
                            >
                              <StateIcon state={item.state} />
                              {stateLabel[item.state]}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs rounded-md font-medium ${categoryTagClass(item.category)}`}
                            >
                              {item.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1.5">{item.description}</p>
                          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                            后端封装：{item.backendPrepared ? '已准备' : '待完善'} · 健康：{item.health.message}
                            <br />
                            近况：检查 {item.runtime?.checksTotal ?? 0} 次（失败 {item.runtime?.checksFailed ?? 0}） · 测试{' '}
                            {item.runtime?.testsTotal ?? 0} 次（失败 {item.runtime?.testsFailed ?? 0}）
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              runHealthCheck(item.id);
                            }}
                            disabled={checkingId === item.id}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 shadow-sm"
                          >
                            <RefreshCw className={`w-4 h-4 ${checkingId === item.id ? 'animate-spin' : ''}`} />
                            健康检查
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              runTest(item.id);
                            }}
                            disabled={testingId === item.id}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 shadow-sm"
                          >
                            <FlaskConical className={`w-4 h-4 ${testingId === item.id ? 'animate-pulse' : ''}`} />
                            联调测试
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <ConfigBlock title="必填配置" list={item.config.required} />
                        <ConfigBlock title="可选配置" list={item.config.optional} />
                      </div>

                      {item.id === 'sms' && (
                        <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50/50 p-3">
                          <div className="text-xs text-gray-600 mb-2 font-medium">短信联调（可选）</div>
                          <input
                            value={smsTestPhone}
                            onChange={(e) => setSmsTestPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            className="w-full md:w-64 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            placeholder="输入手机号可真实发测，不填则 dry-run"
                          />
                        </div>
                      )}

                      {(item.id === 'payment' || item.id === 'delivery') && (
                        <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50/50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-gray-600 font-medium">
                              {item.id === 'payment' ? '支付联调 payload' : '配送联调 payload'}
                            </div>
                            <select
                              value={testModeDraft[item.id] || 'callback'}
                              onChange={(e) =>
                                setTestModeDraft((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value as IntegrationTestMode,
                                }))
                              }
                              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                            >
                              <option value="callback">回调模拟</option>
                              <option value="create">主动下发</option>
                            </select>
                          </div>
                          <textarea
                            value={testPayloadDraft[item.id] || '{}'}
                            onChange={(e) => setTestPayloadDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-full min-h-[120px] px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                          />
                          <div className="text-[11px] text-gray-500 mt-1.5 space-y-0.5">
                            <p>
                              {testModeDraft[item.id] === 'create'
                                ? item.id === 'payment'
                                  ? 'create：生产推荐 PAYMENT_PROVIDER=webhook（或 aggregator）+ 聚合下单 URL；wechat_pay 为直连备选。'
                                  : 'create：生产推荐 DELIVERY_PROVIDER=webhook（或 aggregator）+ 聚合下发 URL；sf_city 为直连备选。'
                                : 'callback 模式将调用真实回调接口（需先配置对应 callback token 与订单号）。'}
                            </p>
                            <p>
                              {testModeDraft[item.id] === 'create'
                                ? item.id === 'payment'
                                  ? '支付 create 至少包含：order_number, amount（元）；或用 amount_cents（分）。'
                                  : '配送 create 至少包含：external_order_id；可附 receive / order_detail 或 user_* 测试字段。'
                                : item.id === 'payment'
                                  ? '支付 callback 至少包含：payment_event_id, external_order_id, payment_status'
                                  : '配送 callback 至少包含：provider, external_order_id, status（顺丰回调建议 provider=sf）'}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-gray-800">后台配置（非敏感）</div>
                          <button
                            type="button"
                            onClick={() => saveConfig(item.id)}
                            disabled={savingId === item.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 shadow-sm"
                          >
                            <Save className="w-3.5 h-3.5" />
                            保存配置
                          </button>
                        </div>
                        <textarea
                          value={configDraft[item.id] || '{}'}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-full min-h-[120px] px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                        <div className="text-[11px] text-gray-500 mt-1.5">
                          仅保存白名单字段（例如 provider、enabled、webhook_url 等），敏感密钥请继续走环境变量。
                        </div>
                      </div>

                      {item.missing.length > 0 && (
                        <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          缺失项：{item.missing.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'ready' | 'partial' | 'planned';
}) {
  const toneClass =
    tone === 'ready'
      ? 'text-emerald-600'
      : tone === 'partial'
        ? 'text-amber-600'
        : tone === 'planned'
          ? 'text-slate-600'
          : 'text-gray-900';
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

function ConfigBlock({ title, list }: { title: string; list: EnvStatus[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-50/40 p-3">
      <div className="text-sm font-medium text-gray-800 mb-2">{title}</div>
      {list.length === 0 ? (
        <div className="text-xs text-gray-500">无</div>
      ) : (
        <div className="space-y-1.5">
          {list.map((it) => (
            <div key={it.key} className="flex items-center justify-between text-xs gap-2">
              <span className="text-gray-600 truncate" title={it.key}>
                {it.key}
              </span>
              <span className={`shrink-0 ${it.configured ? 'text-emerald-600' : 'text-red-500'}`}>
                {it.configured ? `已配置 (${it.valueMasked})` : '未配置'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
