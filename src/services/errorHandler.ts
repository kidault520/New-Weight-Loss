/**
 * 统一的错误处理工具
 * 所有服务层应该使用此工具处理错误，确保错误处理的一致性
 */

export class ServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * 处理服务层错误
 * 统一将各种错误转换为 ServiceError
 */
export function handleServiceError(error: unknown, context?: string): never {
  if (error instanceof ServiceError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new ServiceError(
      context ? `${context}: ${error.message}` : error.message,
      undefined,
      error
    );
  }

  throw new ServiceError(
    context ? `${context}: Unknown error occurred` : 'Unknown error occurred',
    'UNKNOWN_ERROR',
    error
  );
}

/**
 * 处理认证错误
 */
export function handleAuthError(error: unknown): never {
  if (error instanceof Error && error.message.includes('not authenticated')) {
    throw new ServiceError('User not authenticated', 'AUTH_ERROR', error);
  }
  handleServiceError(error, 'Authentication');
}

/**
 * 处理数据库错误
 */
export function handleDatabaseError(error: unknown, operation?: string): never {
  const context = operation ? `Database ${operation}` : 'Database operation';
  handleServiceError(error, context);
}

/**
 * 安全地执行异步操作，返回默认值而不是抛出错误
 * 适用于某些场景下希望静默失败的情况
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  defaultValue: T,
  errorContext?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorContext || 'Operation failed:', error);
    return defaultValue;
  }
}




