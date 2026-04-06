/*
  # Add AI Companion Settings to User Profiles

  1. Changes
    - Add `ai_companion_settings` jsonb field to user_profiles table
    - This will store AI companion customization including:
      - name: AI companion's name (e.g., "小瑞", "TATA")
      - owner_name: What the AI should call the user (e.g., "owner")
      - gender: AI companion's gender preference
      - identity: AI companion's role/identity (e.g., "你的教练", "你的助手")
      - description: AI companion's personality description

  2. Notes
    - Using jsonb for flexibility in storing AI settings
    - Default settings match the existing UI defaults
    - Settings are user-specific and customizable
*/

-- Add AI companion settings column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'ai_companion_settings'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN ai_companion_settings jsonb DEFAULT jsonb_build_object(
      'name', 'TATA',
      'owner_name', 'owner',
      'gender', '保密',
      'identity', '你的教练',
      'description', '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。'
    );
  END IF;
END $$;

-- Create index for faster jsonb queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_ai_settings ON user_profiles USING gin(ai_companion_settings);
