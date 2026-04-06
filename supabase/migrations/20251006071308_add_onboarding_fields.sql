/*
  # Add Onboarding Fields to User Profiles

  1. Changes to user_profiles table
    - Add `nickname` (text) - User's chosen or generated nickname
    - Add `fitness_goal` (text) - Primary fitness goal (weight_loss, maintain_health, confidence, other)
    - Add `onboarding_completed` (boolean) - Whether user has completed onboarding flow
    - Add `onboarding_data` (jsonb) - Complete onboarding questionnaire data including:
      - All goal-related answers
      - Body measurements and targets
      - Lifestyle and habit preferences
      - Any additional custom responses
    - Add `unit_preference` (text) - Metric or imperial units preference

  2. Notes
    - onboarding_completed defaults to false for new users
    - onboarding_data is flexible JSONB to accommodate various question types
    - All fields are optional to support gradual profile completion
*/

-- Add new columns to user_profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'nickname'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN nickname text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'fitness_goal'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN fitness_goal text CHECK (fitness_goal IN ('weight_loss', 'maintain_health', 'confidence', 'muscle_gain', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'onboarding_data'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN onboarding_data jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'unit_preference'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN unit_preference text DEFAULT 'metric' CHECK (unit_preference IN ('metric', 'imperial'));
  END IF;
END $$;

-- Create index on onboarding_completed for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(user_id, onboarding_completed);