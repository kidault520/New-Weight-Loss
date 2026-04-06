/*
  # Update User Profiles - Remove Activity Level and TDEE

  1. Schema Changes
    - Remove dependency on activity_level field (mark as deprecated, keep for backward compatibility)
    - Remove dependency on tdee field (mark as deprecated, keep for backward compatibility)
    - Update BMR calculation trigger to only calculate BMR, not TDEE

  2. Function Updates
    - Simplify calculate_bmr() function to only calculate BMR
    - Remove TDEE calculation logic from trigger
    - Activity level will be calculated dynamically from user's actual steps and exercise data

  3. Notes
    - BMR remains as the core metabolic metric
    - TDEE will be calculated on-demand in the application based on real activity data
    - This migration doesn't drop columns to avoid breaking existing data
*/

-- Update the calculate_bmr function to only calculate BMR
CREATE OR REPLACE FUNCTION calculate_bmr()
RETURNS TRIGGER AS $$
DECLARE
  calculated_bmr numeric;
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

    -- Update only the BMR value
    NEW.bmr := calculated_bmr;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger remains the same, but now it only updates BMR
DROP TRIGGER IF EXISTS trigger_calculate_bmr ON user_profiles;
CREATE TRIGGER trigger_calculate_bmr
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_bmr();
