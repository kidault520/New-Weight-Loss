import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import type { Persister } from '@tanstack/query-persist-client-core';
import type { PersistedClient } from '@tanstack/query-persist-client-core';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { UserProfileProvider } from './contexts/UserProfileContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { enforceBeijingTimezone } from './utils/enforceBeijingTimezone';

enforceBeijingTimezone();

// 生产环境默认静默调试日志，避免业务控制台噪音影响排障。
// 如需临时放开，可设置 VITE_ENABLE_CLIENT_LOGS=1。
const shouldEnableClientLogs = import.meta.env.DEV || import.meta.env.VITE_ENABLE_CLIENT_LOGS === '1';
if (!shouldEnableClientLogs && typeof window !== 'undefined') {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
}

if (import.meta.env.DEV) {
  import('./utils/devTools');
}

function sanitizePersistedClient(raw: unknown): PersistedClient | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Record<string, unknown>;
  const clientState = candidate.clientState;
  if (!clientState || typeof clientState !== 'object') return undefined;

  const safe = candidate as unknown as PersistedClient;
  const cs = safe.clientState as unknown as {
    queries?: Array<{ state?: Record<string, unknown> }>;
    mutations?: Array<{ state?: Record<string, unknown> }>;
  };

  const stripPromiseField = (state?: Record<string, unknown>) => {
    if (!state || !('promise' in state)) return;
    // 持久化到 localStorage 后 promise 会丢失为普通对象，恢复时 hydrate 会调用 .then 导致崩溃
    delete state.promise;
  };

  if (Array.isArray(cs.queries)) {
    cs.queries.forEach((q) => {
      stripPromiseField(q?.state);
      // v5 dehydrate：pending 查询带顶层 promise，JSON 后变成 {}，hydrate 会 tryResolveSync 崩溃
      if (q && typeof q === 'object' && 'promise' in q) {
        delete (q as Record<string, unknown>).promise;
      }
    });
  }
  if (Array.isArray(cs.mutations)) {
    cs.mutations.forEach((m) => stripPromiseField(m?.state));
  }

  return safe;
}

function preparePersistedClientForStorage(client: PersistedClient): PersistedClient {
  const sourceState = client.clientState as unknown as {
    queries?: Array<Record<string, unknown> & { state?: Record<string, unknown> }>;
    mutations?: Array<Record<string, unknown> & { state?: Record<string, unknown> }>;
  };

  const cleanState = (state?: Record<string, unknown>) => {
    if (!state) return state;
    const next = { ...state };
    if ('promise' in next) delete next.promise;
    return next;
  };

  const normalizedClient: PersistedClient = {
    ...client,
    clientState: {
      ...(client.clientState as object),
      queries: Array.isArray(sourceState.queries)
        ? sourceState.queries.map((q) => {
            const { promise: _p, ...rest } = q;
            return { ...rest, state: cleanState(rest.state) };
          })
        : [],
      mutations: Array.isArray(sourceState.mutations)
        ? sourceState.mutations.map((m) => ({ ...m, state: cleanState(m.state) }))
        : [],
    } as unknown as PersistedClient['clientState'],
  };

  return normalizedClient;
}

// 创建localStorage persister
const localStoragePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      const normalized = preparePersistedClientForStorage(client);
      localStorage.setItem('REACT_QUERY_OFFLINE_CACHE', JSON.stringify(normalized));
    } catch (error) {
      console.error('Failed to persist query client:', error);
    }
  },
  restoreClient: async () => {
    try {
      const cached = localStorage.getItem('REACT_QUERY_OFFLINE_CACHE');
      if (cached) {
        const parsed = JSON.parse(cached);
        const sanitized = sanitizePersistedClient(parsed);
        if (!sanitized) {
          localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
          return undefined;
        }
        return sanitized;
      }
    } catch (error) {
      console.error('Failed to restore query client:', error);
      localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
    }
    return undefined;
  },
  removeClient: async () => {
    try {
      localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
    } catch (error) {
      console.error('Failed to remove query client:', error);
    }
  },
};

// 创建 React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟缓存
      retry: 2,
      refetchOnWindowFocus: false, // 🔥 修复：禁用聚焦时自动刷新，避免切换窗口时重新加载导致状态丢失
      refetchOnReconnect: true, // 网络恢复时自动刷新
      refetchOnMount: false, // 🔥 修复：禁用挂载时自动刷新，避免组件重新挂载时丢失状态
    },
  },
});

// 启用持久化（排除 today-consumed-meals，该数据以 health_records 为源，每次打开今日餐时从 DB 拉取）
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24小时
  buster: 'rq-cache-v4-no-profile-persist-pending', // 丢弃旧快照；user-profile 不再脱水
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      const key = query.queryKey[0];
      if (typeof key === 'string' && key === 'today-consumed-meals') return false;
      // 用户态强相关：勿持久化，避免 pending→reject 脱水报错与多账号串档
      if (typeof key === 'string' && key === 'user-profile') return false;
      if (query.state.status === 'pending') return false;
      return true;
    },
  },
});

// 添加全局错误处理
window.addEventListener('error', (event) => {
  console.error('❌ [Global] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Global] Unhandled promise rejection:', event.reason);
});

// StrictMode 在开发环境会双次挂载/卸载，与浏览器扩展、翻译等外部 DOM 修改叠加时易触发 removeChild 错误
const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML =
    '<p style="padding:24px;font-family:system-ui,sans-serif">错误：找不到 #root 节点，无法挂载应用。</p>';
} else {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UserProfileProvider>
            <App />
          </UserProfileProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}
