/*
  # Add Has Seen Onboarding Field

  1. Changes to user_profiles table
    - Add `has_seen_onboarding` (boolean) - Tracks if user has seen the onboarding flow
      - Defaults to false for new users
      - Set to true when user either completes or skips onboarding
      - Used to determine if onboarding should be shown again

  2. Purpose
    - Distinguish between users who have never seen onboarding vs users who skipped it
    - Allow users who skipped to complete onboarding later through profile settings
    - Prevent showing onboarding repeatedly to users who explicitly skipped it

  3. Security
    - No RLS changes needed as existing policies apply to this new column
*/

-- Add has_seen_onboarding column to user_profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'has_seen_onboarding'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN has_seen_onboarding boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster queries on onboarding status
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_status 
ON user_profiles(user_id, has_seen_onboarding, onboarding_completed);