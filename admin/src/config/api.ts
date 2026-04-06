/** 未配置或为空时：开发走 Vite 同源代理 /api；生产走部署侧 /api 反代 */
function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw !== undefined && String(raw).trim() !== '') {
    return String(raw).trim().replace(/\/$/, '');
  }
  return import.meta.env.DEV ? '' : '/api';
}

const API_BASE_URL = resolveApiBase();

// Default timeout: 120 seconds (for AI generation requests)
const DEFAULT_TIMEOUT = 120000;

export const apiClient = {
  baseURL: API_BASE_URL,
  
  async request<T>(endpoint: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
    const token = localStorage.getItem('admin_token');
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        let msg = error.error || `HTTP error! status: ${response.status}`;

        // 配送状态流转冲突：给管理端更直观的失败原因
        if (response.status === 409 && error.error === 'Invalid status transition') {
          if (error.reason === 'terminal_status_locked') {
            msg = '状态更新失败：已是终态（已送达/已取消），不能再改回';
          } else if (error.reason === 'status_rollback_not_allowed') {
            msg = '状态更新失败：不允许回退到更早状态';
          } else {
            msg = '状态更新失败：当前状态不允许跳转到目标状态';
          }
        }
        if (error.details) msg = `${msg}（${error.details}）`;
        if (error.hint) msg = `${msg}\n提示: ${error.hint}`;

        if (response.status === 401 || response.status === 403) {
          if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
            try { localStorage.removeItem('admin_token'); } catch {}
            try { window.location.href = '/admin/login'; } catch {}
          }
        }
        const requestError = new Error(msg) as Error & {
          status?: number;
          code?: string;
          reason?: string;
          details?: string;
          hint?: string;
        };
        requestError.status = response.status;
        requestError.code = error.code;
        requestError.reason = error.reason;
        requestError.details = error.details;
        requestError.hint = error.hint;
        throw requestError;
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`请求超时（${timeout / 1000}秒），请稍后重试`);
      }
      
      throw error;
    }
  },

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  },

  post<T>(endpoint: string, data?: unknown, options?: { timeout?: number }): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: options?.timeout,
    });
  },

  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  },

  patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};




