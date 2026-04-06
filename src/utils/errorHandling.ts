/**
 * 统一错误处理工具函数
 * 符合架构规范：用户友好的错误提示
 */

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('操作失败:', error);
    
    // 用户友好的错误提示
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('Network')) {
        alert('网络连接失败，请检查网络后重试');
      } else if (error.message.includes('auth') || error.message.includes('Auth')) {
        alert('登录已过期，请重新登录');
      } else if (error.message.includes('permission') || error.message.includes('Permission')) {
        alert('没有权限执行此操作');
      } else {
        alert('操作失败，请稍后重试');
      }
    } else {
      alert('操作失败，请稍后重试');
    }
    
    // 返回降级数据
    if (fallback !== undefined) {
      return fallback;
    }
    
    throw error;
  }
}




