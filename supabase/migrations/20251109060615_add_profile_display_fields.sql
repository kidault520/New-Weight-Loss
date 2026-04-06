/*
  # Add Profile Display Fields and User ID

  1. New Columns Added to user_profiles
    - `display_user_id` (text, unique) - A formatted user ID for display (e.g., "123456")
    - `birthday` (date) - User's date of birth
    - `initial_weight` (numeric) - User's initial weight when they started
    - `target_completion_date` (date) - Target date to achieve fitness goal
    - `dietary_preferences` (text) - User's dietary preferences (JSON string or comma-separated)
    - `food_allergies` (text) - User's food allergies (JSON string or comma-separated)
    - `special_conditions` (text) - Special health conditions (JSON string or comma-separated)
    - `avatar_url` (text) - URL to user's profile avatar image

  2. Function
    - Create trigger function to auto-generate display_user_id from user's UUID
    - Generate 6-digit display ID from the user_id hash

  3. Security
    - All columns maintain existing RLS policies
*/

-- Add new columns to user_profiles table
DO $$
BEGIN
  -- Add display_user_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'display_user_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN display_user_id text UNIQUE;
  END IF;

  -- Add birthday column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'birthday'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN birthday date;
  END IF;

  -- Add initial_weight column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'initial_weight'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN initial_weight numeric;
  END IF;

  -- Add target_completion_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'target_completion_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN target_completion_date date;
  END IF;

  -- Add dietary_preferences column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'dietary_preferences'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN dietary_preferences text;
  END IF;

  -- Add food_allergies column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'food_allergies'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN food_allergies text;
  END IF;

  -- Add special_conditions column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'special_conditions'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN special_conditions text;
  END IF;

  -- Add avatar_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Create function to generate display_user_id from UUID
CREATE OR REPLACE FUNCTION generate_display_user_id(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  hash_value bigint;
  display_id text;
BEGIN
  -- Get a numeric hash from the UUID
  hash_value := ('x' || substring(user_uuid::text, 1, 8))::bit(32)::bigint;
  
  -- Convert to 6-digit number (ensure it's positive and 6 digits)
  display_id := LPAD((ABS(hash_value) % 1000000)::text, 6, '0');
  
  RETURN display_id;
END;
$$;

-- Create trigger function to auto-populate display_user_id
CREATE OR REPLACE FUNCTION set_display_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.display_user_id IS NULL THEN
    NEW.display_user_id := generate_display_user_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_set_display_user_id ON user_profiles;

CREATE TRIGGER trigger_set_display_user_id
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_display_user_id();

-- Update existing records to have display_user_id
UPDATE user_profiles
SET display_user_id = generate_display_user_id(user_id)
WHERE display_user_id IS NULL;