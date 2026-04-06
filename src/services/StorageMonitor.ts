/**
 * StorageMonitor - 存储空间监控服务
 * 监控 localStorage 使用情况，防止超出限制
 */

import { localStorageService } from './localStorageService';

export interface StorageInfo {
  used: number; // 已使用字节数
  limit: number; // 限制字节数（估算）
  usagePercent: number; // 使用百分比
  keys: string[]; // 所有键名
}

export class StorageMonitor {
  private static readonly DEFAULT_LIMIT = 5 * 1024 * 1024; // 5MB（保守估计）
  private static readonly WARNING_THRESHOLD = 0.8; // 80% 警告阈值
  private static readonly CLEANUP_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7天

  /**
   * 检查存储空间使用情况
   */
  static checkStorage(): StorageInfo {
    let total = 0;
    const keys: string[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          keys.push(key);
          const value = localStorage.getItem(key);
          if (value) {
            // 估算大小（UTF-16编码，每个字符2字节）
            total += value.length * 2;
          }
        }
      }
    } catch (error) {
      console.error('[StorageMonitor] Error checking storage:', error);
    }

    const limit = this.DEFAULT_LIMIT;
    const usagePercent = (total / limit) * 100;

    return {
      used: total,
      limit,
      usagePercent,
      keys,
    };
  }

  /**
   * 清理过期数据
   */
  static cleanupOldData(maxAge: number = this.CLEANUP_MAX_AGE): number {
    const now = Date.now();
    let cleanedCount = 0;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // 只清理缓存相关的键
        if (key.startsWith('cache:') || key.startsWith('records:')) {
          const item = localStorageService.getItem(key);
          if (item && (now - item.timestamp) > maxAge) {
            keysToRemove.push(key);
          }
        }
      }

      // 删除过期数据
      keysToRemove.forEach(key => {
        localStorageService.remove(key);
        cleanedCount++;
      });

      if (cleanedCount > 0) {
        console.log(`[StorageMonitor] Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('[StorageMonitor] Error cleaning up old data:', error);
    }

    return cleanedCount;
  }

  /**
   * 检查并警告如果接近限制
   */
  static warnIfNearLimit(threshold: number = this.WARNING_THRESHOLD): boolean {
    const info = this.checkStorage();
    const isNearLimit = info.usagePercent > threshold * 100;

    if (isNearLimit) {
      console.warn(
        `[StorageMonitor] Storage usage: ${info.usagePercent.toFixed(1)}% (${(info.used / 1024 / 1024).toFixed(2)}MB / ${(info.limit / 1024 / 1024).toFixed(2)}MB)`
      );

      // 自动清理过期数据
      const cleaned = this.cleanupOldData();
      if (cleaned > 0) {
        console.log(`[StorageMonitor] Auto-cleaned ${cleaned} expired entries`);
      }

      // 如果清理后仍然接近限制，再次警告
      const newInfo = this.checkStorage();
      if (newInfo.usagePercent > threshold * 100) {
        console.warn(
          `[StorageMonitor] Storage still near limit after cleanup: ${newInfo.usagePercent.toFixed(1)}%`
        );
      }
    }

    return isNearLimit;
  }

  /**
   * 获取存储空间使用详情
   */
  static getStorageInfo(): StorageInfo {
    return this.checkStorage();
  }

  /**
   * 初始化监控（应用启动时调用）
   */
  static initialize(): void {
    // 检查存储空间
    this.warnIfNearLimit();

    // 清理过期数据
    this.cleanupOldData();

    // 定期检查（每小时一次）
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.warnIfNearLimit();
        this.cleanupOldData();
      }, 60 * 60 * 1000); // 1小时
    }
  }
}









