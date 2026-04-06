/*
  # Add Meal Plan Configuration Fields to User Profiles

  1. Changes to user_profiles table
    - Add `meal_plan_configured` (boolean) - Tracks whether user has completed meal plan setup
    - Add `meal_plan_config_data` (jsonb) - Stores meal plan configuration details
  
  2. Details
    - `meal_plan_configured` defaults to false for new users
    - `meal_plan_config_data` stores: selected dates, meal types, delivery address ID
    - Both fields are nullable for backward compatibility
  
  3. Purpose
    - Enable conditional modal flow for meal plan configuration
    - Persist user's meal plan preferences across sessions
    - Track completion status of configuration process
*/

-- Add meal_plan_configured field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'meal_plan_configured'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN meal_plan_configured boolean DEFAULT false;
  END IF;
END $$;

-- Add meal_plan_config_data field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'meal_plan_config_data'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN meal_plan_config_data jsonb;
  END IF;
END $$;

-- Create index on meal_plan_configured for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_meal_plan_configured 
ON user_profiles(meal_plan_configured);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.meal_plan_configured IS 'Indicates whether user has completed meal plan configuration';
COMMENT ON COLUMN user_profiles.meal_plan_config_data IS 'Stores meal plan configuration including dates, meal types, and delivery address';