/*
  # Add Weight and BMR Fields to User Profiles

  1. Schema Changes
    - Add `current_weight` field to user_profiles table (numeric, in kg)
    - Add `bmr` field to store calculated Basal Metabolic Rate (numeric)
    - Add `tdee` field to store Total Daily Energy Expenditure (numeric)
    - Add `unit_preference` field for user's preferred unit system (metric/imperial)

  2. Function Creation
    - Create function to calculate BMR using Mifflin-St Jeor equation
    - Create trigger to auto-calculate BMR when profile data changes

  3. Notes
    - BMR calculation requires gender, age, weight, and height
    - Mifflin-St Jeor formula:
      - Men: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) + 5
      - Women: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) - 161
    - TDEE = BMR * activity multiplier
*/

-- Add new columns to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_weight'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_weight numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'bmr'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN bmr numeric(7,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'tdee'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN tdee numeric(7,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'unit_preference'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN unit_preference text DEFAULT 'metric' CHECK (unit_preference IN ('metric', 'imperial'));
  END IF;
END $$;

-- Create function to calculate BMR using Mifflin-St Jeor equation
CREATE OR REPLACE FUNCTION calculate_bmr()
RETURNS TRIGGER AS $$
DECLARE
  calculated_bmr numeric;
  calculated_tdee numeric;
  activity_multiplier numeric;
BEGIN
  -- Only calculate if we have all required fields
  IF NEW.gender IS NOT NULL AND NEW.age IS NOT NULL AND NEW.current_weight IS NOT NULL AND NEW.height IS NOT NULL THEN
    
    -- Calculate BMR using Mifflin-St Jeor equation
    IF NEW.gender = 'male' THEN
      calculated_bmr := (10 * NEW.current_weight) + (6.25 * NEW.height) - (5 * NEW.age) + 5;
    ELSIF NEW.gender = 'female' THEN
      calculated_bmr := (10 * NEW.current_weight) + (6.25 * NEW.height) - (5 * NEW.age) - 161;
    ELSE
      -- For 'other' gender, use average of male and female formulas
      calculated_bmr := (10 * NEW.current_weight) + (6.25 * NEW.height) - (5 * NEW.age) - 78;
    END IF;

    -- Calculate TDEE based on activity level
    CASE NEW.activity_level
      WHEN 'sedentary' THEN activity_multiplier := 1.2;
      WHEN 'light' THEN activity_multiplier := 1.375;
      WHEN 'moderate' THEN activity_multiplier := 1.55;
      WHEN 'active' THEN activity_multiplier := 1.725;
      WHEN 'very_active' THEN activity_multiplier := 1.9;
      ELSE activity_multiplier := 1.2;
    END CASE;

    calculated_tdee := calculated_bmr * activity_multiplier;

    -- Update the BMR and TDEE values
    NEW.bmr := calculated_bmr;
    NEW.tdee := calculated_tdee;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate BMR on insert or update
DROP TRIGGER IF EXISTS trigger_calculate_bmr ON user_profiles;
CREATE TRIGGER trigger_calculate_bmr
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_bmr();

-- Create index for efficient profile lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);