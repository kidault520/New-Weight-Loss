/*
  # Add unique constraint to health_assessments table

  1. Changes
    - Add unique index on (user_id, DATE(assessment_date)) to prevent duplicate assessments on the same day
    - This ensures only one health assessment can be created per user per day

  2. Security
    - No changes to RLS policies
    - Existing policies remain in effect
*/

-- Add unique index to prevent duplicate assessments on the same day
-- Note: Using a partial unique index that checks the date part of assessment_date
CREATE UNIQUE INDEX IF NOT EXISTS health_assessments_user_date_unique
ON health_assessments (user_id, DATE(assessment_date));
