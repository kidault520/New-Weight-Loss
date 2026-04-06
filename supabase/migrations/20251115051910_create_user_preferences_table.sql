/*
  # Create User Preferences Table for Dashboard Customization

  1. New Tables
    - `user_preferences` - Store user dashboard customization and app preferences
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `dashboard_card_order` (text array) - Order of dashboard cards
      - `hidden_dashboard_cards` (text array) - Hidden dashboard cards
      - `theme_preference` (text) - User's theme preference
      - `language` (text) - User's language preference
      - `notification_settings` (jsonb) - Notification preferences
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_preferences` table
    - Add policies for authenticated users to read/write their own preferences
*/

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_card_order text[] DEFAULT ARRAY['calories', 'weight'],
  hidden_dashboard_cards text[] DEFAULT ARRAY['nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose'],
  theme_preference text DEFAULT 'light',
  language text DEFAULT 'zh-CN',
  notification_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for user_preferences
CREATE POLICY "Users can read own preferences"
  ON user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
  ON user_preferences(user_id);

-- Add comment
COMMENT ON TABLE user_preferences IS 'Stores user dashboard customization and application preferences';
