export interface LocalStorageItem<T> {
  data: T;
  timestamp: number;
  version: string; // 保留字段以兼容现有数据，但不再使用迁移功能
}

/**
 * 简化的localStorage服务
 * 符合架构规范：简单提示，非完整队列
 * React Query内置缓存即可，不需要复杂的版本迁移
 */

export const localStorageService = {
  /**
   * 保存数据到本地存储（简化版，无版本迁移）
   */
  save<T>(key: string, data: T): void {
    try {
      const item: LocalStorageItem<T> = {
        data,
        timestamp: Date.now(),
        version: '1.0.0' // 固定版本，不再支持迁移
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.error(`Error saving to localStorage: ${key}`, error);
    }
  },

  /**
   * 从本地存储获取数据（简化版，无版本迁移）
   */
  get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;

      const item: LocalStorageItem<T> = JSON.parse(itemStr);
      return item.data;
    } catch (error) {
      console.error(`Error getting from localStorage: ${key}`, error);
      return null;
    }
  },

  /**
   * 从本地存储获取数据，包括元数据
   */
  getItem<T>(key: string): LocalStorageItem<T> | null {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;

      return JSON.parse(itemStr) as LocalStorageItem<T>;
    } catch (error) {
      console.error(`Error getting item from localStorage: ${key}`, error);
      return null;
    }
  },

  /**
   * 从本地存储删除数据
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error);
    }
  },

  /**
   * 清空本地存储
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage', error);
    }
  },

  /**
   * 检查数据是否过期（简单实现）
   */
  isExpired(key: string, maxAge: number): boolean {
    try {
      const item = this.getItem(key);
      if (!item) return true;
      
      const now = Date.now();
      return (now - item.timestamp) > maxAge;
    } catch (error) {
      console.error(`Error checking expiration for ${key}`, error);
      return true;
    }
  },

  /**
   * 简单的离线操作队列（仅保存最近9条，符合规范要求）
   */
  saveForLater(key: string, data: any): void {
    try {
      const ops = JSON.parse(localStorage.getItem('offline_ops') || '[]');
      const updatedOps = [...ops.slice(-9), { key, data, timestamp: Date.now() }];
      localStorage.setItem('offline_ops', JSON.stringify(updatedOps));
    } catch (error) {
      console.error('Error saving offline operation:', error);
    }
  },

  /**
   * 获取离线操作队列
   */
  getOfflineOps(): Array<{ key: string; data: any; timestamp: number }> {
    try {
      return JSON.parse(localStorage.getItem('offline_ops') || '[]');
    } catch (error) {
      console.error('Error getting offline operations:', error);
      return [];
    }
  },

  /**
   * 清空离线操作队列
   */
  clearOfflineOps(): void {
    try {
      localStorage.removeItem('offline_ops');
    } catch (error) {
      console.error('Error clearing offline operations:', error);
    }
  },
};
