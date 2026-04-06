/**
 * userProfileService - 用户档案服务
 * 符合架构规范：Service层直接操作Supabase
 */

import { supabase } from '../config/supabase';
import type { UserProfile } from '../utils/bmrCalculations';
const DEFAULT_PROFILE: UserProfile = {
  gender: 'male',
  age: 25,
  current_weight: 70,
  height: 170,
  unit_preference: 'metric',
};

type ProfileDataShape = Partial<UserProfile> & {
  has_seen_onboarding?: boolean;
  onboarding_completed?: boolean;
};

/**
 * 格式化数据库数据为用户档案格式
 */
function formatProfileFromDB(profileData: ProfileDataShape): UserProfile {
  return {
    gender: profileData.gender || DEFAULT_PROFILE.gender,
    age: Number(profileData.age) || DEFAULT_PROFILE.age,
    current_weight: Number(profileData.current_weight) || DEFAULT_PROFILE.current_weight,
    height: Number(profileData.height) || DEFAULT_PROFILE.height,
    target_weight: profileData.target_weight ? Number(profileData.target_weight) : undefined,
    unit_preference: profileData.unit_preference || DEFAULT_PROFILE.unit_preference,
    bmr: profileData.bmr ? Number(profileData.bmr) : undefined,
    nickname: profileData.nickname,
    display_user_id: profileData.display_user_id,
    birthday: profileData.birthday,
    initial_weight: profileData.initial_weight ? Number(profileData.initial_weight) : undefined,
    target_completion_date: profileData.target_completion_date,
    // 统一数据格式：确保数组字段始终是数组
    dietary_preferences: Array.isArray(profileData.dietary_preferences)
      ? profileData.dietary_preferences
      : (profileData.dietary_preferences ? [profileData.dietary_preferences] : undefined),
    food_allergies: profileData.food_allergies,
    special_conditions: profileData.special_conditions,
    avatar_url: profileData.avatar_url,
    fitness_goal: profileData.fitness_goal,
    activity_level: profileData.activity_level,
    phone: profileData.phone,
    profile_created_at: profileData.profile_created_at,
    // 统一数据格式：确保数组字段始终是数组
    exercise_habits: Array.isArray(profileData.exercise_habits)
      ? profileData.exercise_habits
      : undefined,
    sleep_hours: profileData.sleep_hours ? Number(profileData.sleep_hours) : undefined,
    water_intake: profileData.water_intake ? Number(profileData.water_intake) : undefined,
    daily_steps_goal: profileData.daily_steps_goal ? Number(profileData.daily_steps_goal) : undefined,
    // 统一数据格式：确保数组字段始终是数组
    health_concerns: Array.isArray(profileData.health_concerns)
      ? profileData.health_concerns
      : undefined,
    meal_plan_configured: profileData.meal_plan_configured || false,
    meal_plan_config_data: profileData.meal_plan_config_data,
    // ✅ onboarding 状态（老用户是否进引导页的关键）
    has_seen_onboarding: typeof profileData.has_seen_onboarding === 'boolean' ? profileData.has_seen_onboarding : undefined,
    onboarding_completed: typeof profileData.onboarding_completed === 'boolean' ? profileData.onboarding_completed : undefined,
    user_id: profileData.user_id,
  };
}

export const userProfileService = {
  /**
   * 获取用户档案
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      // ✅ 移除多余的认证检查，调用方已经验证了用户身份
      // 这样可以减少一次 API 调用，提升性能

      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile from database:', error);
        throw error;
      }

      if (!profileData) {
        if (import.meta.env.DEV) {
          console.log('⚠️ [userProfileService] No profile found in database for user:', userId);
        }
        // 返回null，让调用方决定是否创建默认profile
        return null;
      }

      if (import.meta.env.DEV) {
        console.log('✅ [userProfileService] Profile loaded:', {
          userId,
          nickname: profileData.nickname,
          display_user_id: profileData.display_user_id,
          hasData: !!profileData
        });
      }
      return formatProfileFromDB(profileData);
    } catch (error) {
      console.error('userProfileService.getProfile error:', error);
      throw error;
    }
  },

  /**
   * 更新用户档案（支持upsert：不存在则创建）
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      // ✅ 移除多余的认证检查，调用方已经验证了用户身份

      // 先检查记录是否存在
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      // 准备数据库更新数据
      const dbData: Partial<UserProfile> & { user_id: string; updated_at: string } = {
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      let profileData;
      let error;

      if (existingProfile) {
        // 更新现有记录
        const result = await supabase
          .from('user_profiles')
          .update(dbData)
          .eq('user_id', userId)
          .select()
          .single();
        profileData = result.data;
        error = result.error;
      } else {
        // 创建新记录
        const result = await supabase
          .from('user_profiles')
          .insert({
            ...dbData,
            profile_created_at: dbData.profile_created_at || new Date().toISOString(),
          })
          .select()
          .single();
        profileData = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }

      if (!profileData) {
        throw new Error('Failed to update profile: no data returned');
      }

      return formatProfileFromDB(profileData);
    } catch (error) {
      console.error('userProfileService.updateProfile error:', error);
      throw error;
    }
  },
};
