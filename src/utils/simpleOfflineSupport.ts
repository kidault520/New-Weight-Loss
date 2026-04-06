/**
 * 简单离线支持工具
 * 符合架构规范：仅提供网络检测，不提供离线队列功能
 * V1版本：断网时直接提示错误，禁止写入操作
 */

export const simpleOfflineSupport = {
  // 检查网络状态
  isOnline(): boolean {
    return navigator.onLine;
  },

  // 添加简单重试（仅在网络可用时）
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!this.isOnline()) {
          throw new Error('网络连接已断开，请检查网络');
        }
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('重试次数用尽');
  },
};




