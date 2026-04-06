 
import { supabase } from '../config/supabase';
import { toBeijingDateString } from '../utils/dateUtils';
import { getUserStorageItem } from '../utils/userStorage';
import type { ChatAiClientContext } from '../utils/chatAiContext';

/** 与 TodaySupplementsCard / useDailyFeedbackFixed 一致，用于 AI 对话同步当日补剂勾选 */
const TODAY_SUPPLEMENTS_INGESTED_KEY = 'today-supplements-ingested';

// 开发环境优先走 /api 代理，避免跨域/设备访问 localhost 导致请求落空
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw == null || String(raw).trim() === '') {
    return '/api';
  }
  let u = String(raw).trim().replace(/\/+$/, '');
  // 绝对 URL 且未带 /api 时，与后端 app.use('/api/...') 对齐（避免请求打到 /auth/... → 404）
  if (u.startsWith('http://') || u.startsWith('https://')) {
    if (!u.endsWith('/api')) {
      return `${u}/api`;
    }
  }
  return u.startsWith('/') ? u : `/${u}`;
}

/** 未配置时用同源 /api，避免生产包误连 localhost */
export const API_BASE_URL = resolveApiBaseUrl();

// 错误类型枚举
export enum ApiErrorType {
  NetworkError = 'NetworkError',
  AuthError = 'AuthError',
  ServerError = 'ServerError',
  TimeoutError = 'TimeoutError',
  ValidationError = 'ValidationError',
  UnknownError = 'UnknownError',
}

// API 错误类
export class ApiError extends Error {
  constructor(
    public type: ApiErrorType,
    message: string,
    public originalError?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 重试配置接口
interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryableErrors?: ApiErrorType[];
}

// 默认重试配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  retryableErrors: [ApiErrorType.NetworkError, ApiErrorType.ServerError, ApiErrorType.TimeoutError],
};

// API client with authentication
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * 统一错误处理函数
   */
  private handleError(error: any, response?: Response): ApiError {
    // 超时错误
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return new ApiError(
        ApiErrorType.TimeoutError,
        '请求超时，请检查网络连接后重试',
        error
      );
    }

    // 网络错误（无法连接到服务器）
    if (!response && (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError'))) {
      return new ApiError(
        ApiErrorType.NetworkError,
        '网络连接失败，请检查网络设置',
        error
      );
    }

    // HTTP 响应错误
    if (response) {
      const status = response.status;

      // 认证错误 (401, 403)
      if (status === 401 || status === 403) {
        return new ApiError(
          ApiErrorType.AuthError,
          '登录已过期，请重新登录',
          error,
          status
        );
      }

      // 客户端错误 (400, 422)
      if (status === 400 || status === 422) {
        return new ApiError(
          ApiErrorType.ValidationError,
          '请求参数错误，请检查输入',
          error,
          status
        );
      }

      // 服务器错误 (500-599)
      if (status >= 500 && status < 600) {
        return new ApiError(
          ApiErrorType.ServerError,
          '服务器错误，请稍后重试',
          error,
          status
        );
      }

      // 其他 HTTP 错误
      return new ApiError(
        ApiErrorType.UnknownError,
        `请求失败 (${status})`,
        error,
        status
      );
    }

    // 其他未知错误
    return new ApiError(
      ApiErrorType.UnknownError,
      error.message || '未知错误，请稍后重试',
      error
    );
  }

  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token && {
        'Authorization': `Bearer ${session.access_token}`
      })
    };
  }

  /**
   * 获取默认超时时间（根据端点类型）
   */
  private getDefaultTimeout(endpoint: string): number {
    // AI 相关请求使用更长的超时时间
    const aiEndpoints = [
      '/ai/chat',
      '/functions/v1/ai-chat',
      '/functions/v1/generate-health-report',
      '/functions/v1/analyze-glucose',
      '/functions/v1/personalized-plan',
    ];

    if (aiEndpoints.some(aiEndpoint => endpoint.includes(aiEndpoint))) {
      return 120000; // 120秒
    }

    return 30000; // 30秒（默认）
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: ApiError, retryConfig: RetryConfig): boolean {
    // 认证错误和验证错误不重试
    if (error.type === ApiErrorType.AuthError || error.type === ApiErrorType.ValidationError) {
      return false;
    }

    // 检查错误类型是否在可重试列表中
    const retryableErrors = retryConfig.retryableErrors || DEFAULT_RETRY_CONFIG.retryableErrors || [];
    return retryableErrors.includes(error.type);
  }

  /**
   * 计算重试延迟（指数退避）
   */
  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * 检查网络状态
   */
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * 带重试的请求方法
   */
  private async requestWithRetry(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {},
    retryConfig: RetryConfig = {},
    isFullUrl: boolean = false // 新增参数：是否为完整 URL
  ): Promise<any> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    const maxRetries = config.maxRetries || 3;
    const baseDelay = config.retryDelay || 1000;

    // 检查网络状态
    if (!this.isOnline()) {
      throw new ApiError(
        ApiErrorType.NetworkError,
        '网络连接已断开，请检查网络设置',
        new Error('Offline')
      );
    }

    let lastError: ApiError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options, isFullUrl);
      } catch (error) {
        lastError = error instanceof ApiError ? error : this.handleError(error);

        // 如果是最后一次尝试或错误不可重试，直接抛出
        if (attempt === maxRetries || !this.isRetryableError(lastError, config)) {
          throw lastError;
        }

        // 再次检查网络状态
        if (!this.isOnline()) {
          throw new ApiError(
            ApiErrorType.NetworkError,
            '网络连接已断开，请检查网络设置',
            new Error('Offline')
          );
        }

        // 计算延迟时间（指数退避）
        const delay = this.calculateRetryDelay(attempt, baseDelay);
        console.log(`[ApiClient] 请求失败，${delay}ms 后重试 (${attempt}/${maxRetries}):`, lastError.message);

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  private async request(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {},
    isFullUrl: boolean = false // 新增参数：是否为完整 URL
  ) {
    const headers = await this.getAuthHeaders();
    const timeout = options.timeout || this.getDefaultTimeout(endpoint);
    const externalSignal = options.signal;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    const onExternalAbort = () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const { timeout: _timeoutOpt, signal: _sigOpt, ...fetchRest } = options;

    try {
      // 如果是完整 URL（以 http:// 或 https:// 开头），直接使用；否则拼接 baseURL
      const url = isFullUrl || endpoint.startsWith('http://') || endpoint.startsWith('https://')
        ? endpoint
        : `${this.baseURL}${endpoint}`;
      
      const response = await fetch(url, {
        ...fetchRest,
        headers: {
          ...headers,
          ...fetchRest.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (!response.ok) {
        interface ErrorResponse {
          error?: string;
          message?: string;
        }
        let errorData: ErrorResponse = {};
        try {
          errorData = await response.json() as ErrorResponse;
        } catch {
          // 如果响应不是JSON，使用默认错误信息
        }
        
        const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        throw this.handleError(error, response);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }

      // 如果已经是 ApiError，直接抛出
      if (error instanceof ApiError) {
        throw error;
      }

      // 否则转换为 ApiError
      throw this.handleError(error);
    }
  }

  /** 仅用于走 Node `/api` 代理的 GET（如配送日程）；健康档案等请用 Supabase 客户端与 RPC。 */
  async get<T = any>(endpoint: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
    return this.requestWithRetry(endpoint, { ...options, method: 'GET' }) as Promise<T>;
  }

  // AI methods
  async chatWithAI(
    message: string,
    conversationId?: string,
    parsedMetrics?: Array<{
      metricType: string;
      value?: number;
      unit?: string;
      foodName?: string;
      exerciseName?: string;
      supplementName?: string;
      duration?: number;
      calories?: number;
      quantity?: number;
      emotionType?: string;
      measurements?: {
        chest?: number;
        waist?: number;
        upperArm?: number;
        hips?: number;
        thigh?: number;
        calf?: number;
      };
    }>,
    /** 客户端对话上下文：未确认卡片数、最近卡片指标摘要，供 Edge 指代/催促场景 */
    chatClientContext?: ChatAiClientContext,
    signal?: AbortSignal,
  ) {
    const todayKey = toBeijingDateString(new Date());
    let client_daily_context:
      | { beijing_date: string; supplements_ingested_ids: string[] }
      | undefined;
    try {
      const raw = await getUserStorageItem<{ dateKey: string; ingestedIds: string[] }>(
        TODAY_SUPPLEMENTS_INGESTED_KEY,
      );
      if (raw?.dateKey === todayKey && Array.isArray(raw.ingestedIds)) {
        client_daily_context = {
          beijing_date: todayKey,
          supplements_ingested_ids: raw.ingestedIds,
        };
      }
    } catch {
      /* 忽略本地存储异常，由 Edge 侧提示以 App 为准 */
    }

    return this.callSupabaseFunction(
      'ai-chat',
      {
        message,
        conversation_id: conversationId,
        parsed_metrics: parsedMetrics,
        ...(client_daily_context ? { client_daily_context } : {}),
        ...(chatClientContext ? { chat_client_context: chatClientContext } : {}),
      },
      120000,
      signal,
    );
  }

  /**
   * 调用 Supabase Edge Function 的辅助方法（带重试）
   */
  private async callSupabaseFunction(
    functionName: string,
    body: any,
    timeout: number = 120000,
    externalSignal?: AbortSignal,
  ): Promise<any> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Get user session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new ApiError(ApiErrorType.AuthError, '未登录，请先登录');
    }

    // 构建完整的 URL（Supabase Edge Function 使用完整 URL，不需要拼接 baseURL）
    const fullUrl = `${supabaseUrl}/functions/v1/${functionName}`;
    
    // 直接使用 fetch，因为这是完整 URL
    return this.requestWithRetry(
      fullUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        timeout,
        ...(externalSignal ? { signal: externalSignal } : {}),
      },
      { maxRetries: 2 }, // AI 请求减少重试次数
      true // 标记为完整 URL，不需要拼接 baseURL
    );
  }

  async generateHealthReport() {
    return this.callSupabaseFunction('generate-health-report', {});
  }

  async analyzeGlucose(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    return this.callSupabaseFunction('analyze-glucose', { period });
  }

  async generatePersonalizedPlan() {
    return this.callSupabaseFunction('personalized-plan', {});
  }
}

export const apiClient = new ApiClient(API_BASE_URL);