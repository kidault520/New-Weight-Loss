/**
 * 用户偏好服务
 * 管理用户的仪表板配置和其他偏好设置
 * 符合架构规范：直连Supabase，无额外抽象层
 */

import { supabase } from '../config/supabase';

export interface UserPreferences {
  dashboard_card_order: string[];
  hidden_dashboard_cards: string[];
  theme_preference?: string;
  language?: string;
  notification_settings?: Record<string, unknown>;
}

type UserPreferencesUpdateData = {
  updated_at: string;
  dashboard_card_order?: string[];
  hidden_dashboard_cards?: string[];
  theme_preference?: string;
  language?: string;
  notification_settings?: Record<string, unknown>;
};

/**
 * 获取用户偏好设置
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[userPreferencesService] Error loading preferences:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      dashboard_card_order: data.dashboard_card_order || ['calories', 'weight'],
      hidden_dashboard_cards: data.hidden_dashboard_cards || [],
      theme_preference: data.theme_preference || 'light',
      language: data.language || 'zh-CN',
      notification_settings: data.notification_settings || {},
    };
  } catch (error) {
    console.error('[userPreferencesService] Exception loading preferences:', error);
    return null;
  }
}

/**
 * 保存用户偏好设置
 */
export async function saveUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<boolean> {
  try {
    // 先检查是否存在
    const { data: existing, error: checkError } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('[userPreferencesService] Error checking existing preferences:', checkError);
      return false;
    }

    const updateData: UserPreferencesUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (preferences.dashboard_card_order !== undefined) {
      updateData.dashboard_card_order = preferences.dashboard_card_order;
    }
    if (preferences.hidden_dashboard_cards !== undefined) {
      updateData.hidden_dashboard_cards = preferences.hidden_dashboard_cards;
    }
    if (preferences.theme_preference !== undefined) {
      updateData.theme_preference = preferences.theme_preference;
    }
    if (preferences.language !== undefined) {
      updateData.language = preferences.language;
    }
    if (preferences.notification_settings !== undefined) {
      updateData.notification_settings = preferences.notification_settings;
    }

    if (existing) {
      // 更新现有记录
      const { error } = await supabase
        .from('user_preferences')
        .update(updateData)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('[userPreferencesService] ❌ Error updating preferences:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return false;
      }

      return true;
    } else {
      // 创建新记录
      const { error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          ...updateData,
        })
        .select();

      if (error) {
        console.error('[userPreferencesService] ❌ Error creating preferences:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return false;
      }

      return true;
    }
  } catch (error) {
    console.error('[userPreferencesService] ❌ Exception saving preferences:', error);
    return false;
  }
}










