 
/**
 * Development Tools for Testing
 * Use these functions in browser console for testing
 */

import { clearMealPlanConfig } from '../services/mealPlanConfigService';
import { testUserService } from '../services/testUserService';
import { isTestMode } from '../config/testMode';
import { getUserStorageItem, removeUserStorageItem } from './userStorage';

/**
 * Reset all meal plan data (localStorage + session state)
 * Usage in console: window.resetMealPlanData()
 */
export async function resetMealPlanData(userId?: string | null) {
  console.log('🧹 Starting meal plan data reset...');

  try {
    // Clear localStorage
    const keysToRemove = [
      'mealAddresses',
      'selectedOrderDates',
      'selectedMealTypes',
      'selectedDeliveryAddressId',
      'deliveryPlanStartDate',
      'deliveryPlanEndDate',
      'deliveryPlanDates',
      'meal_plan_configured',
      'meal_plan_config_data'
    ];

    console.log('📦 Clearing localStorage...');
    for (const key of keysToRemove) {
      await removeUserStorageItem(key);
      console.log(`  ✓ Cleared: ${key}`);
    }

    // Clear database configuration
    if (userId) {
      console.log('🗄️ Clearing database configuration...');
      const success = await clearMealPlanConfig(userId);
      if (success) {
        console.log('  ✓ Database configuration cleared');
      } else {
        console.warn('  ⚠️ Failed to clear database configuration');
      }
    }

    console.log('✅ Meal plan data reset complete!');
    console.log('🔄 Please refresh the page to see changes.');

    return true;
  } catch (error) {
    console.error('❌ Error resetting meal plan data:', error);
    return false;
  }
}

/**
 * Show current meal plan data status
 * Usage in console: window.checkMealPlanData()
 */
export async function checkMealPlanData() {
  console.log('🔍 Checking meal plan data status...');
  console.log('');

  const keysToCheck = [
    'mealAddresses',
    'selectedOrderDates',
    'selectedMealTypes',
    'selectedDeliveryAddressId',
    'meal_plan_configured',
    'meal_plan_config_data'
  ];

  let hasAnyData = false;

  for (const key of keysToCheck) {
    const value = await getUserStorageItem<string>(key);
    if (value && value !== '[]' && value !== '{}' && value !== '""' && value !== 'null') {
      hasAnyData = true;
      console.log(`✓ ${key}:`, value);

      // Try to parse and show details
      try {
        if (key === 'mealAddresses') {
          const parsed = JSON.parse(value);
          const count = Object.keys(parsed).length;
          console.log(`  → Contains ${count} meal address mappings`);
        } else if (key === 'selectedOrderDates') {
          const parsed = JSON.parse(value);
          console.log(`  → ${parsed.length} dates selected`);
        } else if (key === 'selectedMealTypes') {
          const parsed = JSON.parse(value);
          console.log(`  → Meal types: ${parsed.join(', ')}`);
        }
      } catch {
        // Not JSON or already logged
      }
    } else {
      console.log(`✗ ${key}: (empty)`);
    }
  }

  console.log('');
  if (hasAnyData) {
    console.log('📊 Status: Meal plan data exists');
    console.log('💡 To reset, run: window.resetMealPlanData()');
  } else {
    console.log('📊 Status: No meal plan data (clean state)');
  }
}

/**
 * Get user ID from current session
 */
export function getCurrentUserId(): string | null {
  // Try to get from session storage or localStorage
  const sessionData = localStorage.getItem('sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token');
  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData);
      return parsed?.user?.id || null;
    } catch (e) {
      console.error('Error parsing session data:', e);
    }
  }
  return null;
}

/**
 * Reset test user data (Test Mode only)
 * Usage in console: window.resetTestUser()
 */
export async function resetTestUser() {
  if (!isTestMode()) {
    console.error('❌ 本地「测试模式 / 假用户」已移除，统一走 Supabase；请用真实账号与后台数据联调。');
    return false;
  }

  console.log('🧪 Starting test user reset...');
  console.log('');

  try {
    await testUserService.clearTestUserData();

    console.log('');
    console.log('✅ Test user reset complete!');
    console.log('🔄 Please refresh the page to restart from onboarding.');
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Error resetting test user:', error);
    return false;
  }
}

/**
 * Check test mode status and display info
 * Usage in console: window.checkTestMode()
 */
export function checkTestMode() {
  console.log('🔍 Test Mode Status Check');
  console.log('');

  const testModeEnabled = isTestMode();

  if (testModeEnabled) {
    console.log('✅ Test Mode: ENABLED');
    console.log('');
    console.log('Available test commands:');
    console.log('  • window.resetTestUser() - Reset test user and clear all data');
    console.log('  • window.checkMealPlanData() - Check meal plan data status');
    console.log('  • window.resetMealPlanData() - Reset meal plan data only');
  } else {
    console.log('❌ Test Mode: DISABLED（已固定关闭，开发与生产均走真实 Auth + 数据库）');
  }

  console.log('');
}

// Expose functions to window for console access
if (typeof window !== 'undefined') {
  (window as any).resetMealPlanData = async () => {
    const userId = getCurrentUserId();
    if (userId) {
      console.log('👤 Found user ID:', userId);
    } else {
      console.log('⚠️ No user ID found, will only clear localStorage');
    }
    return await resetMealPlanData(userId);
  };

  (window as any).checkMealPlanData = async () => {
    await checkMealPlanData();
  };
  (window as any).resetTestUser = resetTestUser;
  (window as any).checkTestMode = checkTestMode;

  console.log('🛠️ Dev tools loaded!');
  console.log('');
  console.log('Available commands:');
  console.log('  • window.checkTestMode() - Check test mode status');
  console.log('  • window.resetTestUser() - 已禁用（无假用户模式）');
  console.log('  • window.checkMealPlanData() - Check meal plan data');
  console.log('  • window.resetMealPlanData() - Reset meal plan data');
  console.log('');
}
