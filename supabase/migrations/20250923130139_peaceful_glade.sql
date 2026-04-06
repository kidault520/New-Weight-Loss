/*
  # Add Blood Glucose Tracking Support

  1. Schema Updates
    - Add 'blood_glucose' to valid record types in health_records table
    - Add blood_glucose_data column for structured data storage

  2. Security
    - Existing RLS policies will automatically apply to blood glucose records
    - No additional policies needed as they inherit from health_records table
*/

-- Add blood_glucose to the existing record_type constraint
ALTER TABLE health_records DROP CONSTRAINT IF EXISTS health_records_record_type_check;
ALTER TABLE health_records ADD CONSTRAINT health_records_record_type_check 
  CHECK (record_type = ANY (ARRAY['weight'::text, 'water'::text, 'steps'::text, 'food'::text, 'exercise'::text, 'measurements'::text, 'calories'::text, 'blood_glucose'::text]));

-- Add blood_glucose_data column for structured data (meal timing, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_records' AND column_name = 'blood_glucose_data'
  ) THEN
    ALTER TABLE health_records ADD COLUMN blood_glucose_data jsonb;
  END IF;
END $$;