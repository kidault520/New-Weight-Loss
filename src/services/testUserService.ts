import { supabase } from '../config/supabase';
import { isTestMode } from '../config/testMode';

const TEST_USER_EMAIL = 'test@healthapp.dev';
const TEST_USER_PASSWORD = 'test-password-2024';

export const testUserService = {
  /**
   * Clear all test user data from localStorage and database
   */
  async clearTestUserData(): Promise<void> {
    try {
      console.log('🧹 [TestUserService] Starting test user data cleanup...');

      // 1. Clear all localStorage data
      const keysToRemove = [
        // Onboarding related
        'has_seen_onboarding',
        'onboarding_completed',
        'onboarding_skipped',
        'onboarding_data',
        'onboarding_step',
        'health_report_saved',
        // User profile
        'userProfile',
        // Health data
        'userDayDataOverrides',
        'health_records_test',
        // Meal plan
        'meal_plan_configured',
        'meal_plan_config_data',
        'mealAddresses',
        'mealPlan_lockedMeals',
        'mealPlan_justReset',
        // Dashboard
        'dashboardCardOrder',
        'hiddenDashboardCards',
      ];

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`  ✓ Removed: ${key}`);
      });

      // 2. Reset database - test user profile
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        console.log('🔄 [TestUserService] Resetting test user profile in database...');

        // Reset has_seen_onboarding to false
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            has_seen_onboarding: false,
            onboarding_completed: false,
            // onboarding_data JSON 字段已移除
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (profileError) {
          console.error('❌ [TestUserService] Error resetting profile:', profileError);
        } else {
          console.log('  ✓ Profile reset in database');
        }

        // 3. Delete all health records
        const { error: healthError } = await supabase
          .from('health_records')
          .delete()
          .eq('user_id', user.id);

        if (healthError) {
          console.error('❌ [TestUserService] Error deleting health records:', healthError);
        } else {
          console.log('  ✓ Health records deleted');
        }

        // 4. Delete health assessments
        const { error: assessmentError } = await supabase
          .from('health_assessments')
          .delete()
          .eq('user_id', user.id);

        if (assessmentError) {
          console.error('❌ [TestUserService] Error deleting health assessments:', assessmentError);
        } else {
          console.log('  ✓ Health assessments deleted');
        }
      }

      console.log('✅ [TestUserService] Test user data cleanup completed!');

      // Trigger events to refresh UI
      window.dispatchEvent(new CustomEvent('testUserDataCleared'));
    } catch (error) {
      console.error('❌ [TestUserService] Error during cleanup:', error);
      throw error;
    }
  },

  async ensureTestUserLoggedIn(): Promise<boolean> {
    if (!isTestMode()) {
      return false;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        console.log('✅ [TestUserService] Test user already logged in:', user.id);
        return true;
      }

      console.log('🔐 [TestUserService] No user session found, attempting to sign in test user...');

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          console.log('👤 [TestUserService] Test user not found, creating new test user...');

          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
            options: {
              data: {
                nickname: '测试用户',
              },
              emailRedirectTo: undefined,
            }
          });

          if (signUpError) {
            console.error('❌ [TestUserService] Failed to create test user:', signUpError);
            return false;
          }

          if (signUpData.user) {
            console.log('✅ [TestUserService] Test user created successfully:', signUpData.user.id);

            const { error: profileError } = await supabase
              .from('user_profiles')
              .upsert({
                user_id: signUpData.user.id,
                nickname: '测试用户',
                email: TEST_USER_EMAIL,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (profileError) {
              console.error('⚠️ [TestUserService] Failed to create profile:', profileError);
            } else {
              console.log('✅ [TestUserService] Test user profile created');
            }

            return true;
          }
        } else {
          console.error('❌ [TestUserService] Sign in error:', signInError);
          return false;
        }
      }

      if (signInData.user) {
        console.log('✅ [TestUserService] Test user signed in successfully:', signInData.user.id);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ [TestUserService] Unexpected error:', error);
      return false;
    }
  },

  async getTestUserId(): Promise<string | null> {
    if (!isTestMode()) {
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      console.error('❌ [TestUserService] Failed to get user ID:', error);
      return null;
    }
  },

  /**
   * Check if we need to clear data (e.g., when switching from another phone number back to test mode)
   */
  async checkAndClearIfNeeded(): Promise<void> {
    if (!isTestMode()) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if this is a fresh login (has_seen_onboarding exists in DB)
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('has_seen_onboarding, onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        // If profile doesn't exist or onboarding was never completed, ensure clean state
        if (!profileData || !profileData.has_seen_onboarding) {
          console.log('🔍 [TestUserService] New test user session detected, ensuring clean state');
          await this.clearTestUserData();
        }
      }
    } catch (error) {
      console.error('❌ [TestUserService] Error checking data state:', error);
    }
  }
};
