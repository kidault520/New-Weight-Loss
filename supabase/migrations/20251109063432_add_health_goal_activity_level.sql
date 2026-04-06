/*
  # Add Health Goal and Activity Level Fields to User Profiles

  1. New Columns
    - `health_goal` (text) - User's primary health/fitness goal from onboarding (maps from fitnessGoal)
      Valid values: 'weight_loss', 'maintain_health', 'confidence', 'muscle_gain', 'other'
    - Note: `activity_level` field already exists in the schema

  2. Changes
    - Add health_goal column with CHECK constraint for valid values
    - Ensure activity_level field is properly configured

  3. Security
    - Maintains existing RLS policies
    - No additional security changes needed
*/

-- Add health_goal column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'health_goal'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN health_goal text 
      CHECK (health_goal IN ('weight_loss', 'maintain_health', 'confidence', 'muscle_gain', 'other'));
  END IF;
END $$;

-- Ensure activity_level column exists with proper constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'activity_level'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN activity_level text 
      CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));
  END IF;
END $$;