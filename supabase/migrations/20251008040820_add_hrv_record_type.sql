/*
  # Add HRV Record Type to Health Records

  1. Changes
    - Add 'hrv' to the allowed record_type values in health_records table
    - Add 'blood_pressure' and 'sleep' types for future health tracking features

  2. Notes
    - HRV (Heart Rate Variability) is an important health metric
    - This allows users to track HRV data from their devices
*/

-- Drop the existing check constraint
ALTER TABLE health_records DROP CONSTRAINT IF EXISTS health_records_record_type_check;

-- Add new check constraint with expanded types
ALTER TABLE health_records ADD CONSTRAINT health_records_record_type_check 
  CHECK (record_type IN ('weight', 'water', 'steps', 'food', 'exercise', 'measurements', 'calories', 'hrv', 'blood_pressure', 'sleep', 'blood_glucose'));
