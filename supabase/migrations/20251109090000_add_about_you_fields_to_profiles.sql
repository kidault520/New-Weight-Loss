/*
  # Add "About You" Section Fields to User Profiles

  1. New Columns
    - `dietary_preferences` (text array) - User's dietary preferences from onboarding
      Examples: ['balanced', 'low_carb', 'high_protein', 'vegetarian', 'keto', 'mediterranean']
    - `exercise_habits` (text array) - User's preferred exercise types
      Examples: ['cardio', 'strength', 'yoga', 'sports', 'walking', 'swimming']
    - `sleep_hours` (numeric) - Average sleep duration in hours (e.g., 7.5)
    - `water_intake` (integer) - Daily water intake in milliliters (e.g., 2000)
    - `health_concerns` (text array) - User's health concerns
      Examples: ['blood_sugar', 'blood_pressure', 'cholesterol', 'digestive', 'energy', 'stress', 'none']

  2. Data Migration
    - Migrate existing data from onboarding_data JSONB to new dedicated columns
    - Preserve original onboarding_data for backward compatibility
    - Handle null values gracefully

  3. Validation Constraints
    - sleep_hours: Must be between 0 and 24 hours
    - water_intake: Must be between 0 and 10000 ml

  4. Security
    - Maintains existing RLS policies
    - No additional security changes needed as data is already protected by user_id policies
*/

-- Check if dietary_preferences exists and convert from text to text array if needed
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'user_profiles' AND column_name = 'dietary_preferences';

  IF col_type IS NULL THEN
    -- Column doesn't exist, create as text array
    ALTER TABLE user_profiles ADD COLUMN dietary_preferences text[];
    COMMENT ON COLUMN user_profiles.dietary_preferences IS 'User dietary preferences from onboarding (e.g., balanced, low_carb, vegetarian)';
  ELSIF col_type = 'text' THEN
    -- Column exists as text, need to convert to text array
    -- First, backup existing data by splitting comma-separated values
    ALTER TABLE user_profiles RENAME COLUMN dietary_preferences TO dietary_preferences_old;
    ALTER TABLE user_profiles ADD COLUMN dietary_preferences text[];

    -- Migrate data: split comma-separated text into array
    UPDATE user_profiles
    SET dietary_preferences = string_to_array(dietary_preferences_old, ', ')
    WHERE dietary_preferences_old IS NOT NULL AND dietary_preferences_old != '';

    -- Drop old column
    ALTER TABLE user_profiles DROP COLUMN dietary_preferences_old;
    COMMENT ON COLUMN user_profiles.dietary_preferences IS 'User dietary preferences from onboarding (e.g., balanced, low_carb, vegetarian)';
  END IF;
END $$;

-- Add exercise_habits column (text array)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'exercise_habits'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN exercise_habits text[];
    COMMENT ON COLUMN user_profiles.exercise_habits IS 'User preferred exercise types (e.g., cardio, strength, yoga)';
  END IF;
END $$;

-- Add sleep_hours column (numeric with validation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sleep_hours'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sleep_hours numeric(4,1)
      CHECK (sleep_hours >= 0 AND sleep_hours <= 24);
    COMMENT ON COLUMN user_profiles.sleep_hours IS 'Average sleep duration in hours (0-24)';
  END IF;
END $$;

-- Add water_intake column (integer with validation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'water_intake'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN water_intake integer
      CHECK (water_intake >= 0 AND water_intake <= 10000);
    COMMENT ON COLUMN user_profiles.water_intake IS 'Daily water intake in milliliters (0-10000)';
  END IF;
END $$;

-- Add health_concerns column (text array)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'health_concerns'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN health_concerns text[];
    COMMENT ON COLUMN user_profiles.health_concerns IS 'User health concerns (e.g., blood_sugar, blood_pressure, stress)';
  END IF;
END $$;

-- Note: Indexes on text arrays can be added later if needed for performance optimization
-- Standard B-tree indexes work for most array queries

-- Migrate existing data from onboarding_data JSONB to new columns
DO $$
DECLARE
  profile_record RECORD;
  dietary_prefs text[];
  exercise_habs text[];
  health_cons text[];
BEGIN
  FOR profile_record IN
    SELECT id, user_id, onboarding_data
    FROM user_profiles
    WHERE onboarding_data IS NOT NULL
      AND onboarding_data != '{}'::jsonb
  LOOP
    -- Extract dietary preferences
    IF profile_record.onboarding_data ? 'dietaryPreferences' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(profile_record.onboarding_data->'dietaryPreferences'))
      INTO dietary_prefs;
    ELSE
      dietary_prefs := NULL;
    END IF;

    -- Extract exercise habits
    IF profile_record.onboarding_data ? 'exerciseHabits' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(profile_record.onboarding_data->'exerciseHabits'))
      INTO exercise_habs;
    ELSE
      exercise_habs := NULL;
    END IF;

    -- Extract health concerns
    IF profile_record.onboarding_data ? 'healthConcerns' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(profile_record.onboarding_data->'healthConcerns'))
      INTO health_cons;
    ELSE
      health_cons := NULL;
    END IF;

    -- Update the profile with extracted data
    UPDATE user_profiles
    SET
      dietary_preferences = COALESCE(dietary_preferences, dietary_prefs),
      exercise_habits = COALESCE(exercise_habits, exercise_habs),
      sleep_hours = COALESCE(
        sleep_hours,
        CASE
          WHEN profile_record.onboarding_data ? 'sleepHours'
          THEN (profile_record.onboarding_data->>'sleepHours')::numeric
          ELSE NULL
        END
      ),
      water_intake = COALESCE(
        water_intake,
        CASE
          WHEN profile_record.onboarding_data ? 'waterIntake'
          THEN (profile_record.onboarding_data->>'waterIntake')::integer
          ELSE NULL
        END
      ),
      health_concerns = COALESCE(health_concerns, health_cons),
      updated_at = now()
    WHERE id = profile_record.id;
  END LOOP;

  RAISE NOTICE 'Successfully migrated onboarding data to dedicated columns';
END $$;
