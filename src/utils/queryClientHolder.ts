import type { QueryClient } from '@tanstack/react-query';

let appQueryClient: QueryClient | null = null;

/** 供非 React 模块（如 quickEntrySyncService）在同步成功后失效 RQ 缓存 */
export function registerAppQueryClient(client: QueryClient | null): void {
  appQueryClient = client;
}

export function getAppQueryClient(): QueryClient | null {
  return appQueryClient;
}
