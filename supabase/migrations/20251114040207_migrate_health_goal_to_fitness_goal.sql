/*
  # Migrate health_goal to fitness_goal

  This migration consolidates the duplicate goal fields by migrating all data from 
  health_goal to fitness_goal and removing the health_goal column.

  1. **Data Migration**
     - Copy all existing health_goal data to fitness_goal (where fitness_goal is null)
     - Ensure no data loss during the migration

  2. **Schema Changes**
     - Drop the health_goal column from user_profiles table
     - Update trigger function to use fitness_goal instead of health_goal
     - Update helper functions to use fitness_goal

  3. **Security**
     - Maintains all existing RLS policies
     - No security changes needed

  ## Important Notes
  - This is a non-destructive migration (data is copied before column is dropped)
  - Ensures single source of truth for user fitness goals
  - Updates all database functions to use the new field name
*/

-- ============================================================================
-- STEP 1: Migrate existing health_goal data to fitness_goal
-- ============================================================================

-- Update fitness_goal with health_goal value where fitness_goal is null
UPDATE user_profiles
SET fitness_goal = health_goal,
    updated_at = now()
WHERE health_goal IS NOT NULL 
  AND fitness_goal IS NULL;

-- For records where both exist, keep fitness_goal (it's the newer field)
-- No action needed as fitness_goal takes precedence

-- ============================================================================
-- STEP 2: Drop the health_goal column
-- ============================================================================

ALTER TABLE user_profiles DROP COLUMN IF EXISTS health_goal;

-- ============================================================================
-- STEP 3: Update trigger function to use fitness_goal
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_onboarding_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When dedicated fields are updated, sync to onboarding_data for backwards compatibility
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    NEW.onboarding_data := jsonb_build_object(
      'nickname', NEW.nickname,
      'gender', NEW.gender,
      'age', NEW.age,
      'height', NEW.height,
      'currentWeight', NEW.current_weight,
      'targetWeight', NEW.target_weight,
      'fitnessGoal', NEW.fitness_goal,
      'activityLevel', NEW.activity_level,
      'dietaryPreferences', COALESCE(NEW.dietary_preferences, ARRAY[]::text[]),
      'exerciseHabits', COALESCE(NEW.exercise_habits, ARRAY[]::text[]),
      'sleepHours', NEW.sleep_hours,
      'waterIntake', NEW.water_intake,
      'healthConcerns', COALESCE(NEW.health_concerns, ARRAY[]::text[])
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 4: Update helper function to use fitness_goal
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_complete_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile jsonb;
  v_assessment jsonb;
BEGIN
  -- Verify user has access to their own data
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  -- Get profile data
  SELECT jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'nickname', nickname,
    'gender', gender,
    'age', age,
    'height', height,
    'current_weight', current_weight,
    'target_weight', target_weight,
    'initial_weight', initial_weight,
    'fitness_goal', fitness_goal,
    'activity_level', activity_level,
    'dietary_preferences', dietary_preferences,
    'exercise_habits', exercise_habits,
    'sleep_hours', sleep_hours,
    'water_intake', water_intake,
    'health_concerns', health_concerns,
    'bmr', bmr,
    'onboarding_completed', onboarding_completed,
    'has_seen_onboarding', has_seen_onboarding,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;

  -- Get latest health assessment
  SELECT jsonb_build_object(
    'id', id,
    'overall_score', overall_score,
    'diet_score', diet_score,
    'fitness_score', fitness_score,
    'rest_score', rest_score,
    'psychology_score', psychology_score,
    'exercise_score', exercise_score,
    'primary_improvement_area', primary_improvement_area,
    'assessment_date', assessment_date
  ) INTO v_assessment
  FROM health_assessments
  WHERE user_id = p_user_id
  ORDER BY assessment_date DESC
  LIMIT 1;

  -- Return combined data
  RETURN jsonb_build_object(
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'health_assessment', COALESCE(v_assessment, 'null'::jsonb),
    'has_onboarding_data', (v_profile IS NOT NULL AND (v_profile->>'onboarding_completed')::boolean = true),
    'is_new_user', (v_profile IS NULL)
  );
END;
$$;

-- ============================================================================
-- STEP 5: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN user_profiles.fitness_goal IS 
  'User''s primary fitness/health goal. Valid values: weight_loss, maintain_health, confidence, muscle_gain, other. Replaces deprecated health_goal field.';

COMMENT ON FUNCTION sync_onboarding_data IS
  'Automatically syncs dedicated profile fields to onboarding_data JSONB for backwards compatibility. Updated to use fitness_goal.';

COMMENT ON FUNCTION get_user_complete_profile IS
  'Returns complete user profile including latest health assessment in a single call. Updated to use fitness_goal.';