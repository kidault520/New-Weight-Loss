/*
  # Fix Health Records Constraint - Include All Record Types

  1. Changes
    - Update health_records_record_type_check constraint to include ALL record types
    - Ensures blood_glucose, blood_pressure, hrv, sleep are all included

  2. Purpose
    - Fix constraint violation errors when saving blood_glucose records
    - Ensure all health record types are properly supported
*/

-- Drop the existing check constraint
ALTER TABLE health_records DROP CONSTRAINT IF EXISTS health_records_record_type_check;

-- Add new check constraint with ALL types
ALTER TABLE health_records ADD CONSTRAINT health_records_record_type_check 
  CHECK (record_type IN (
    'weight', 
    'water', 
    'steps', 
    'food', 
    'exercise', 
    'measurements', 
    'calories', 
    'hrv', 
    'blood_pressure', 
    'sleep', 
    'blood_glucose'
  ));

















