/**
 * LazyComponents - 按需加载组件配置
 * 符合架构规范：使用React.lazy()按需加载大型页面组件
 * 提升初始加载性能
 * 
 * 🔥 修复：添加重试机制，解决动态导入失败问题
 */

import { lazy } from 'react';

/**
 * 带重试机制的动态导入包装器
 * 解决开发环境中偶尔出现的 "Failed to fetch dynamically imported module" 错误
 */
const lazyWithRetry = (componentImport: () => Promise<any>, componentName?: string) => {
  return lazy(async () => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const module = await componentImport();
        if (i > 0) {
          console.log(`✅ [LazyComponents] ${componentName || '组件'} 重试成功 (${i + 1}/${maxRetries})`);
        }
        return module;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // 只对网络错误和动态导入错误进行重试
        if (
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('dynamically imported') ||
          errorMessage.includes('Loading chunk') ||
          errorMessage.includes('NetworkError')
        ) {
          console.warn(
            `⚠️ [LazyComponents] ${componentName || '组件'} 动态导入失败，重试 ${i + 1}/${maxRetries}:`,
            errorMessage
          );
          
          // 指数退避：等待时间逐渐增加
          if (i < maxRetries - 1) {
            const delay = 1000 * Math.pow(2, i);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          // 非网络错误，直接抛出
          throw error;
        }
      }
    }

    // 所有重试都失败
    console.error(
      `🔴 [LazyComponents] ${componentName || '组件'} 动态导入失败，已重试 ${maxRetries} 次`,
      lastError
    );
    throw lastError || new Error('动态导入失败');
  });
};

// 大型页面组件 - 按需加载（带重试机制）
export const LazyDeliveryPlanPage = lazyWithRetry(
  () => import('../DeliveryPlanPage'),
  'DeliveryPlanPage'
);
export const LazyAddDeliveryAddressPage = lazyWithRetry(
  () => import('../AddDeliveryAddressPage'),
  'AddDeliveryAddressPage'
);
export const LazyHealthReportView = lazyWithRetry(
  () => import('../HealthReportView'),
  'HealthReportView'
);
export const LazyNutritionSolutionPage = lazyWithRetry(
  () => import('../onboarding/NutritionSolutionPage'),
  'NutritionSolutionPage'
);
export const LazyCustomReportScreen = lazyWithRetry(
  () => import('../CustomReportScreen'),
  'CustomReportScreen'
);
export const LazyMyReportsScreen = lazyWithRetry(
  () => import('../MyReportsScreen'),
  'MyReportsScreen'
);

export const LazyMyDevicesScreen = lazyWithRetry(
  () => import('../MyDevicesScreen'),
  'MyDevicesScreen'
);
export const LazyMyHealthProfileScreen = lazyWithRetry(
  () => import('../MyHealthProfileScreen'),
  'MyHealthProfileScreen'
);
export const LazyProfileSettingsScreen = lazyWithRetry(
  () => import('../ProfileSettingsScreen'),
  'ProfileSettingsScreen'
);

// DetailScreen组件 - 按需加载（带重试机制）
export const LazyWeightDetailScreen = lazyWithRetry(
  () => import('../WeightDetailScreen'),
  'WeightDetailScreen'
);
export const LazyWaterDetailScreen = lazyWithRetry(
  () => import('../WaterDetailScreen'),
  'WaterDetailScreen'
);
export const LazyStepsDetailScreen = lazyWithRetry(
  () => import('../StepsDetailScreen'),
  'StepsDetailScreen'
);
export const LazyMeasurementsDetailScreen = lazyWithRetry(
  () => import('../MeasurementsDetailScreen'),
  'MeasurementsDetailScreen'
);
export const LazyExerciseDetailScreen = lazyWithRetry(
  () => import('../ExerciseDetailScreen'),
  'ExerciseDetailScreen'
);
export const LazyExerciseStatsDetailScreen = lazyWithRetry(
  () => import('../ExerciseStatsDetailScreen'),
  'ExerciseStatsDetailScreen'
);
export const LazyBloodGlucoseDetailScreen = lazyWithRetry(
  () => import('../BloodGlucoseDetailScreen'),
  'BloodGlucoseDetailScreen'
);
export const LazySleepDetailScreen = lazyWithRetry(
  () => import('../SleepDetailScreen'),
  'SleepDetailScreen'
);




