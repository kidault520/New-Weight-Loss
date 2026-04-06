/*
  # Remove Onboarding Data Redundancy

  ## Summary
  This migration removes the redundant `onboarding_data` JSONB column from user_profiles table.
  All onboarding information is now stored in dedicated, properly-typed columns:
  - dietary_preferences (text[])
  - exercise_habits (text[])
  - health_concerns (text[])
  - sleep_hours (integer)
  - water_intake (integer)
  - And other dedicated columns for nickname, gender, age, height, weight, etc.

  ## Changes
  1. Drop the `onboarding_data` JSONB column from user_profiles
  2. This eliminates data duplication and inconsistency
  3. All data is now stored in proper, strongly-typed columns

  ## Important Notes
  - This migration is safe because all data has already been migrated to dedicated columns
  - No data loss occurs as all information is preserved in the dedicated columns
  - This improves database performance and query efficiency
  - Type safety is improved by using proper column types instead of JSONB
*/

-- Remove the redundant onboarding_data JSONB column
-- All onboarding data is now stored in dedicated columns
ALTER TABLE user_profiles DROP COLUMN IF EXISTS onboarding_data;
