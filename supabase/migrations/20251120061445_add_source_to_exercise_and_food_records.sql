/*
  # Add source field to exercise_records and health_records

  1. Changes
    - Add `source` field to `exercise_records` table
      - Possible values: 'ai', 'manual'
      - Default: 'manual'
    - Add `source` field to `nutrition_data` in `health_records` table for food records
    
  2. Purpose
    - Track whether a record was created by AI or manually by the user
    - Enable filtering and displaying different UI for AI-generated vs manual records
*/

-- Add source field to exercise_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercise_records' AND column_name = 'source'
  ) THEN
    ALTER TABLE exercise_records ADD COLUMN source text DEFAULT 'manual';
    
    -- Add comment
    COMMENT ON COLUMN exercise_records.source IS 'Data source: ai (AI-generated) or manual (user input)';
    
    -- Add check constraint to ensure valid values
    ALTER TABLE exercise_records ADD CONSTRAINT exercise_records_source_check 
      CHECK (source IN ('ai', 'manual'));
  END IF;
END $$;

-- Note: For food records in health_records table, source is stored in nutrition_data JSONB field
-- No schema change needed, just ensure the application saves source: 'ai' or 'manual' in nutrition_data