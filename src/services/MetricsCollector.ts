/**
 * MetricsCollector - 监控指标收集器
 * 收集同步成功率、缓存命中率等关键指标
 */

export interface MetricsStats {
  syncSuccessRate: number; // 同步成功率（0-1）
  cacheHitRate: number; // 缓存命中率（0-1）
  avgSyncTime: number; // 平均同步时间（毫秒）
  totalSyncSuccess: number; // 总成功次数
  totalSyncFailed: number; // 总失败次数
  totalCacheHit: number; // 总缓存命中次数
  totalCacheMiss: number; // 总缓存未命中次数
}

class MetricsCollector {
  private syncSuccess: number = 0;
  private syncFailed: number = 0;
  private cacheHit: number = 0;
  private cacheMiss: number = 0;
  private syncTimes: number[] = [];

  /**
   * 记录同步成功
   */
  recordSyncSuccess(time: number): void {
    this.syncSuccess++;
    this.syncTimes.push(time);
    // 只保留最近100次的时间记录
    if (this.syncTimes.length > 100) {
      this.syncTimes.shift();
    }
    this.saveMetrics();
  }

  /**
   * 记录同步失败
   */
  recordSyncFailed(): void {
    this.syncFailed++;
    this.saveMetrics();
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(): void {
    this.cacheHit++;
    this.saveMetrics();
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss(): void {
    this.cacheMiss++;
    this.saveMetrics();
  }

  /**
   * 获取统计信息
   */
  getStats(): MetricsStats {
    const totalSync = this.syncSuccess + this.syncFailed;
    const totalCache = this.cacheHit + this.cacheMiss;

    return {
      syncSuccessRate: totalSync > 0 ? this.syncSuccess / totalSync : 0,
      cacheHitRate: totalCache > 0 ? this.cacheHit / totalCache : 0,
      avgSyncTime: this.syncTimes.length > 0
        ? this.syncTimes.reduce((a, b) => a + b, 0) / this.syncTimes.length
        : 0,
      totalSyncSuccess: this.syncSuccess,
      totalSyncFailed: this.syncFailed,
      totalCacheHit: this.cacheHit,
      totalCacheMiss: this.cacheMiss,
    };
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.syncSuccess = 0;
    this.syncFailed = 0;
    this.cacheHit = 0;
    this.cacheMiss = 0;
    this.syncTimes = [];
    this.saveMetrics();
  }

  /**
   * 保存指标到 localStorage（持久化）
   */
  private saveMetrics(): void {
    try {
      const metrics = {
        syncSuccess: this.syncSuccess,
        syncFailed: this.syncFailed,
        cacheHit: this.cacheHit,
        cacheMiss: this.cacheMiss,
        syncTimes: this.syncTimes.slice(-50), // 只保存最近50次
      };
      localStorage.setItem('metrics_collector', JSON.stringify(metrics));
    } catch (error) {
      console.error('[MetricsCollector] Error saving metrics:', error);
    }
  }

  /**
   * 从 localStorage 加载指标
   */
  loadMetrics(): void {
    try {
      const stored = localStorage.getItem('metrics_collector');
      if (stored) {
        const metrics = JSON.parse(stored);
        this.syncSuccess = metrics.syncSuccess || 0;
        this.syncFailed = metrics.syncFailed || 0;
        this.cacheHit = metrics.cacheHit || 0;
        this.cacheMiss = metrics.cacheMiss || 0;
        this.syncTimes = metrics.syncTimes || [];
      }
    } catch (error) {
      console.error('[MetricsCollector] Error loading metrics:', error);
    }
  }
}

// 创建全局实例
export const metricsCollector = new MetricsCollector();

// 应用启动时加载历史指标
if (typeof window !== 'undefined') {
  metricsCollector.loadMetrics();
}









