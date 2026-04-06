import { supabase } from '../config/supabase';

/** 未保存过设置时的默认 AI 伙伴名称（聊天、反馈文案等与此一致） */
export const DEFAULT_AI_COMPANION_NAME = '小瑞';

export interface AICompanionSettings {
  name: string;
  owner_name: string;
  gender: string;
  identity: string;
  description: string;
}

/** 历史默认名；库里仍是 TATA 时展示与聊天统一为当前默认「小瑞」 */
const LEGACY_DEFAULT_AI_NAME = 'TATA';

function normalizeCompanionSettingsFromDb(raw: AICompanionSettings): AICompanionSettings {
  const name = String(raw.name ?? '').trim();
  if (name === LEGACY_DEFAULT_AI_NAME) {
    return { ...raw, name: DEFAULT_AI_COMPANION_NAME };
  }
  return raw;
}

function parseSettingsRaw(raw: unknown): AICompanionSettings | null {
  let obj: unknown = raw;
  if (!obj) return null;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const ownerSnake = typeof rec.owner_name === 'string' ? rec.owner_name.trim() : '';
  const ownerCamel = typeof rec.ownerName === 'string' ? rec.ownerName.trim() : '';
  const name = typeof rec.name === 'string' ? rec.name.trim() : '';
  const gender = typeof rec.gender === 'string' ? rec.gender.trim() : '保密';
  const identity = typeof rec.identity === 'string' ? rec.identity.trim() : '你的教练';
  const description = typeof rec.description === 'string' ? rec.description.trim() : '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。';
  return {
    name: name || DEFAULT_AI_COMPANION_NAME,
    owner_name: ownerSnake || ownerCamel || 'owner',
    gender: gender || '保密',
    identity: identity || '你的教练',
    description: description || '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。',
  };
}

export const aiSettingsService = {
  // Get AI companion settings for the current user
  async getSettings(userId: string): Promise<AICompanionSettings | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('ai_companion_settings')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching AI settings:', error);
        throw error;
      }

      if (!data || !data.ai_companion_settings) {
        // Return default settings if none exist
        return {
          name: DEFAULT_AI_COMPANION_NAME,
          owner_name: 'owner',
          gender: '保密',
          identity: '你的教练',
          description: '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。'
        };
      }

      const parsed = parseSettingsRaw(data.ai_companion_settings);
      if (!parsed) {
        return {
          name: DEFAULT_AI_COMPANION_NAME,
          owner_name: 'owner',
          gender: '保密',
          identity: '你的教练',
          description: '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。'
        };
      }
      return normalizeCompanionSettingsFromDb(parsed);
    } catch (error) {
      console.error('Failed to get AI settings:', error);
      return null;
    }
  },

  // Update AI companion settings for the current user
  async updateSettings(userId: string, settings: AICompanionSettings): Promise<boolean> {
    try {
      console.log('Updating AI settings in database...');
      console.log('User ID:', userId);
      console.log('Settings:', settings);

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ai_companion_settings: settings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Supabase error updating AI settings:', error);
        throw error;
      }

      console.log('Update result:', data);

      if (!data || data.length === 0) {
        console.warn('No rows were updated. User profile may not exist.');
        throw new Error('用户配置文件不存在');
      }

      console.log('✅ AI settings updated successfully');
      return true;
    } catch (error) {
      console.error('Failed to update AI settings:', error);
      return false;
    }
  },

  // Get system prompt with user's AI settings
  getSystemPrompt(settings: AICompanionSettings): string {
    return `你是${settings.name}，${settings.identity}。你的性格特点：${settings.description}

你需要：
1. 用温暖、友好的语气与用户交流，称呼用户为"${settings.owner_name}"
2. 提供专业的健康建议
3. 帮助用户分析饮食、运动和健康数据
4. 识别用户的情绪状态并给予适当回应
5. 保持简洁但有用的回答
6. 体现你的性格特点，让对话更有温度`;
  }
};
