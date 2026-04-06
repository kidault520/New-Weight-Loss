/*
  # Add Custom Reports and Supplements Tables

  1. New Tables
    - `custom_reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `report_type` (text) - Type of report (health, nutrition, fitness)
      - `title` (text) - Report title
      - `generation_date` (timestamptz) - When report was generated
      - `status` (text) - active, expired, archived
      - `report_data` (jsonb) - Report content and metrics
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `custom_supplements`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `supplement_name` (text) - Name of supplement
      - `supplement_type` (text) - Type category
      - `dosage` (text) - Dosage information
      - `frequency` (text) - How often to take
      - `start_date` (date) - When to start
      - `end_date` (date) - When to end
      - `status` (text) - active, completed, paused
      - `instructions` (text) - Usage instructions
      - `icon_path` (text) - Path to icon image
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read their own data
    - Add policies for authenticated users to insert their own data
    - Add policies for authenticated users to update their own data
    - Add policies for authenticated users to delete their own data

  3. Indexes
    - Index on user_id for both tables
    - Index on status for both tables
    - Index on generation_date for reports
    - Index on start_date and end_date for supplements
*/

-- Create custom_reports table
CREATE TABLE IF NOT EXISTS custom_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL DEFAULT 'health',
  title text NOT NULL,
  generation_date timestamptz DEFAULT now() NOT NULL,
  status text NOT NULL DEFAULT 'active',
  report_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create custom_supplements table
CREATE TABLE IF NOT EXISTS custom_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supplement_name text NOT NULL,
  supplement_type text NOT NULL DEFAULT 'general',
  dosage text NOT NULL,
  frequency text NOT NULL,
  start_date date DEFAULT CURRENT_DATE NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  instructions text DEFAULT '',
  icon_path text DEFAULT '/buji.png',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for custom_reports
CREATE INDEX IF NOT EXISTS idx_custom_reports_user_id ON custom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_status ON custom_reports(status);
CREATE INDEX IF NOT EXISTS idx_custom_reports_generation_date ON custom_reports(generation_date DESC);

-- Create indexes for custom_supplements
CREATE INDEX IF NOT EXISTS idx_custom_supplements_user_id ON custom_supplements(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_supplements_status ON custom_supplements(status);
CREATE INDEX IF NOT EXISTS idx_custom_supplements_dates ON custom_supplements(start_date, end_date);

-- Enable RLS
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_supplements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_reports
CREATE POLICY "Users can view own reports"
  ON custom_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON custom_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON custom_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON custom_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for custom_supplements
CREATE POLICY "Users can view own supplements"
  ON custom_supplements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplements"
  ON custom_supplements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplements"
  ON custom_supplements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplements"
  ON custom_supplements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_custom_reports_updated_at'
  ) THEN
    CREATE TRIGGER update_custom_reports_updated_at
      BEFORE UPDATE ON custom_reports
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_custom_supplements_updated_at'
  ) THEN
    CREATE TRIGGER update_custom_supplements_updated_at
      BEFORE UPDATE ON custom_supplements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;