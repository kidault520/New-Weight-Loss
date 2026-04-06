/*
  # Add has_viewed_health_report field to user_profiles

  1. Changes
    - Add `has_viewed_health_report` boolean field to `user_profiles` table
    - Default value is false
    - This field tracks whether user has viewed their health report after completing onboarding questionnaire
  
  2. Purpose
    - Distinguish between users who completed questionnaire but haven't viewed health report
    - Ensure all first-time users see their health report page
    - Support proper onboarding flow completion tracking
*/

-- Add has_viewed_health_report field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'has_viewed_health_report'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN has_viewed_health_report BOOLEAN DEFAULT false;
    COMMENT ON COLUMN user_profiles.has_viewed_health_report IS 'Tracks if user has viewed their health report after completing onboarding';
  END IF;
END $$;