/**
 * 用户隔离的 localStorage 工具函数
 * 所有用户相关的数据都应该使用这些函数来确保按用户ID隔离
 */

import { supabase } from '../config/supabase';

/**
 * 获取当前用户ID（带缓存）
 */
let cachedUserId: string | null | undefined = undefined;
let userIdCacheTime: number = 0;
const USER_ID_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

export async function getCurrentUserId(): Promise<string | null> {
  // 如果缓存有效，直接返回
  if (cachedUserId !== undefined && Date.now() - userIdCacheTime < USER_ID_CACHE_TTL) {
    return cachedUserId;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    cachedUserId = userId;
    userIdCacheTime = Date.now();
    return userId;
  } catch (error) {
    console.error('[userStorage] Error getting current user ID:', error);
    cachedUserId = null;
    userIdCacheTime = Date.now();
    return null;
  }
}

/**
 * 清除用户ID缓存（当用户切换时调用）
 */
export function clearUserIdCache(): void {
  cachedUserId = undefined;
  userIdCacheTime = 0;
}

/**
 * 生成带用户ID的存储键
 */
export async function getUserStorageKey(baseKey: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (userId) {
    return `${baseKey}:user:${userId}`;
  }
  // 如果没有用户，使用匿名键（但这种情况应该很少）
  return `${baseKey}:user:anonymous`;
}

/**
 * 同步版本：生成带用户ID的存储键（使用缓存的用户ID）
 * 注意：如果用户ID未缓存，会返回匿名键
 */
export function getUserStorageKeySync(baseKey: string, userId: string | null): string {
  if (userId) {
    return `${baseKey}:user:${userId}`;
  }
  return `${baseKey}:user:anonymous`;
}

/**
 * 获取用户相关的 localStorage 项
 */
export async function getUserStorageItem<T = unknown>(baseKey: string): Promise<T | null> {
  try {
    const key = await getUserStorageKey(baseKey);
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`[userStorage] Error getting ${baseKey}:`, error);
    return null;
  }
}

/**
 * 设置用户相关的 localStorage 项
 */
export async function setUserStorageItem<T = unknown>(baseKey: string, value: T): Promise<void> {
  try {
    const key = await getUserStorageKey(baseKey);
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[userStorage] Error setting ${baseKey}:`, error);
  }
}

/**
 * 删除用户相关的 localStorage 项
 */
export async function removeUserStorageItem(baseKey: string): Promise<void> {
  try {
    const key = await getUserStorageKey(baseKey);
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[userStorage] Error removing ${baseKey}:`, error);
  }
}

/**
 * 清除指定用户的所有 localStorage 数据
 * 包括新格式键（:user:userId）和该用户的同步相关键
 */
export function clearUserStorage(userId: string): void {
  console.log(`[userStorage] Clearing all storage for user: ${userId}`);
  
  const keysToRemove: string[] = [];
  
  // 收集所有需要清除的键
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    // 跳过 Supabase 的键（由 Supabase 管理）
    if (key.startsWith('sb-') || key.includes('supabase')) {
      continue;
    }
    
    // 跳过系统级键
    if (key === 'admin_token') {
      continue;
    }
    
    // 清除新格式键（:user:userId）
    if (key.includes(`:user:${userId}`)) {
      keysToRemove.push(key);
    }
  }
  
  // 批量删除
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`  ✓ Removed: ${key}`);
    } catch (error) {
      console.error(`  ✗ Failed to remove ${key}:`, error);
    }
  });
  
  console.log(`[userStorage] Cleared ${keysToRemove.length} items for user ${userId}`);
}

/**
 * 清除所有用户的 localStorage 数据（用于登出时）
 * 包括新格式键（:user:userId）和旧格式键（向后兼容）
 */
export function clearAllUserStorage(): void {
  console.log('[userStorage] Clearing all user storage...');
  
  const keysToRemove: string[] = [];
  const allKeys: string[] = [];
  
  // 收集所有键
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      allKeys.push(key);
    }
  }
  
  // 需要清除的键模式
  const patternsToRemove = [
    // Dashboard缓存键（每个日期一个键，会无限累积）
    /^dashboard:[^:]+:\d{4}-\d{2}-\d{2}$/,
    // 新格式：带用户ID的键
    /:user:[^:]+$/,
    // 旧格式：未隔离的键（向后兼容）
    /^(userProfile|onboarding_data|onboarding_step|mealAddresses|userDayDataOverrides|dashboardCardOrder|hiddenDashboardCards|meal_plan_configured|meal_plan_config_data|mealPlan_lockedMeals|mealPlan_manuallyModifiedMeals|customFoods|customExercises|addressCustomTags|has_seen_onboarding|onboarding_completed|onboarding_skipped|health_report_saved|step14_profile_saved|mealPlan_justReset)$/,
    // 缓存和记录键
    /^(cache:|records:)/,
    // 同步相关键（离线队列已移除）
    /^sync_last_sync_times:user:/,
    // 聊天相关键
    /chat_(messages|history)/,
    // 测试数据键
    /health_records_test/,
    // Supabase 相关键（保留，由 Supabase 自己管理）
    // 注意：不删除 sb- 开头的键，因为 Supabase 需要它们
  ];
  
  // 需要保留的键（系统级，不应清除）
  const keysToKeep = [
    'admin_token', // 管理员 token（如果存在）
  ];
  
  // 检查每个键
  for (const key of allKeys) {
    // 跳过需要保留的键
    if (keysToKeep.includes(key)) {
      continue;
    }
    
    // 跳过 Supabase 的键（由 Supabase 管理）
    if (key.startsWith('sb-') || key.includes('supabase')) {
      continue;
    }
    
    // 检查是否匹配需要清除的模式
    const shouldRemove = patternsToRemove.some(pattern => pattern.test(key));
    
    if (shouldRemove) {
      keysToRemove.push(key);
    }
  }
  
  // 批量删除
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`  ✓ Removed: ${key}`);
    } catch (error) {
      console.error(`  ✗ Failed to remove ${key}:`, error);
    }
  });
  
  console.log(`[userStorage] Cleared ${keysToRemove.length} items`);
  
  // 清除用户ID缓存
  clearUserIdCache();
}

/**
 * 清除 Supabase session 存储（用于退出登录时强制清除）
 * 只在退出登录时调用，不要在其他场景使用
 */
export function clearSupabaseSession(): void {
  console.log('[userStorage] Clearing Supabase session...');
  
  const supabaseKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      supabaseKeys.push(key);
    }
  }
  
  supabaseKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`  ✓ Removed Supabase key: ${key}`);
  });
  
  console.log(`[userStorage] Cleared ${supabaseKeys.length} Supabase session keys`);
}

/**
 * 清理dashboard缓存，只保留最近N天的缓存
 * @param keepDays 保留最近多少天的缓存（默认7天）
 */
export async function cleanupDashboardCache(keepDays: number = 7): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    
    const keysToRemove: string[] = [];
    const prefix = `dashboard:${userId}:`;

    // 遍历所有dashboard缓存键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      // 提取日期部分
      const dateStr = key.replace(prefix, '');
      try {
        const cacheDate = new Date(dateStr);
        
        // 如果缓存日期早于保留期限，标记为删除
        if (cacheDate < cutoffDate) {
          keysToRemove.push(key);
        }
      } catch {
        // 日期格式错误，也删除
        keysToRemove.push(key);
      }
    }

    // 批量删除过期缓存
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`  ✓ Removed old dashboard cache: ${key}`);
    });

    if (keysToRemove.length > 0) {
      console.log(`[userStorage] Cleaned up ${keysToRemove.length} old dashboard cache entries (keeping last ${keepDays} days)`);
    }
  } catch (error) {
    console.error('[userStorage] Error cleaning up dashboard cache:', error);
  }
}

/**
 * 清理测试数据键
 */
export function clearTestData(): void {
  console.log('[userStorage] Clearing test data...');
  
  const testDataKeys = [
    'health_records_test',
    // 可以添加其他测试数据键
  ];
  
  const keysToRemove: string[] = [];
  
  // 检查并收集所有测试数据键
  for (const testKey of testDataKeys) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(testKey)) {
        keysToRemove.push(key);
      }
    }
  }
  
  // 批量删除
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`  ✓ Removed test data key: ${key}`);
  });
  
  console.log(`[userStorage] Cleared ${keysToRemove.length} test data keys`);
}

