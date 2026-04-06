/*
  # Remove unique constraint from health_assessments table

  1. Changes
    - Drop unique index on (user_id, DATE(assessment_date))
    - This allows users to create multiple health assessments per day (e.g., for reassessments)
    - Each assessment will be an independent record with its own timestamp

  2. Rationale
    - Users should be able to perform multiple reassessments on the same day
    - Each reassessment generates a new, independent health report
    - Historical assessments should never be modified - only new records should be created
    - The unique constraint was preventing valid use cases where users want to reassess their health multiple times

  3. Security
    - No changes to RLS policies
    - Existing policies remain in effect
*/

-- Drop the unique index that prevents multiple assessments per day
DROP INDEX IF EXISTS health_assessments_user_date_unique;
