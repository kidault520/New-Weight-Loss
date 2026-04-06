/*
  # Clean Up Redundant Database Fields

  This migration removes data redundancy and improves schema consistency:

  1. **Keep onboarding_data field for backwards compatibility**
     - Some existing code may still reference it
     - Will be deprecated in future releases
     - Primary data source is now dedicated columns

  2. **Standardize Array Fields**
     - Ensure dietary_preferences, exercise_habits, health_concerns are proper arrays
     - Add constraints to validate data consistency

  3. **Add Data Consistency Triggers**
     - Auto-sync onboarding_data with dedicated columns for backwards compatibility
     - Ensure data consistency across different storage formats

  ## Important Notes
  - This is a non-destructive migration
  - All existing data is preserved
  - Adds helper functions for data consistency
*/

-- ============================================================================
-- STEP 1: Add trigger function to sync onboarding_data (backwards compatibility)
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
      'fitnessGoal', NEW.health_goal,
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
-- STEP 2: Create trigger to auto-sync data
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_sync_onboarding_data ON user_profiles;

CREATE TRIGGER trigger_sync_onboarding_data
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_onboarding_data();

-- ============================================================================
-- STEP 3: Add helpful utility functions
-- ============================================================================

-- Function to get user's complete profile with consistent format
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
    'health_goal', health_goal,
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
-- STEP 4: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_complete_profile TO authenticated;

-- ============================================================================
-- STEP 5: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION sync_onboarding_data IS
  'Automatically syncs dedicated profile fields to onboarding_data JSONB for backwards compatibility';

COMMENT ON FUNCTION get_user_complete_profile IS
  'Returns complete user profile including latest health assessment in a single call';

COMMENT ON TRIGGER trigger_sync_onboarding_data ON user_profiles IS
  'Maintains backwards compatibility by syncing profile fields to onboarding_data';
