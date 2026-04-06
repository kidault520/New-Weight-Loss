/*
  # Create Emotion Statistics and Enhanced Tracking Tables

  1. New Tables
    - `emotion_statistics` - Aggregated emotion statistics by period (weekly, monthly, yearly)
    - `hrv_records` - Heart Rate Variability tracking data
    - `mood_patterns` - Identified mood patterns and insights

  2. Changes to Existing Tables
    - Add additional metadata fields to `emotion_records` for better tracking
    - Add indexes for efficient time-based queries

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to access their own data

  ## Important Notes
  - All timestamps use timestamptz for proper timezone handling
  - Statistics are pre-aggregated for better query performance
  - HRV data stored separately for specialized health tracking
*/

-- HRV (Heart Rate Variability) records table
CREATE TABLE IF NOT EXISTS hrv_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  hrv_value numeric(6,2) NOT NULL,
  status text CHECK (status IN ('excellent', 'good', 'fair', 'poor')) DEFAULT 'good',
  resting_heart_rate integer,
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Emotion statistics aggregation table
CREATE TABLE IF NOT EXISTS emotion_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'yearly')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_records integer DEFAULT 0,
  emotion_counts jsonb DEFAULT '{}'::jsonb,
  dominant_emotion text,
  average_intensity numeric(3,2),
  mood_score numeric(5,2),
  dopamine_moments integer DEFAULT 0,
  trend_direction text CHECK (trend_direction IN ('improving', 'stable', 'declining')),
  insights jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, period_type, period_start)
);

-- Mood patterns and insights table
CREATE TABLE IF NOT EXISTS mood_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type text NOT NULL CHECK (pattern_type IN ('time_of_day', 'weekly', 'seasonal', 'trigger')),
  pattern_data jsonb NOT NULL,
  description text,
  confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  first_detected timestamptz DEFAULT now(),
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE hrv_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies for hrv_records
CREATE POLICY "Users can read own HRV records"
  ON hrv_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own HRV records"
  ON hrv_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own HRV records"
  ON hrv_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own HRV records"
  ON hrv_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for emotion_statistics
CREATE POLICY "Users can read own emotion statistics"
  ON emotion_statistics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emotion statistics"
  ON emotion_statistics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emotion statistics"
  ON emotion_statistics
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own emotion statistics"
  ON emotion_statistics
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for mood_patterns
CREATE POLICY "Users can read own mood patterns"
  ON mood_patterns
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood patterns"
  ON mood_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mood patterns"
  ON mood_patterns
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mood patterns"
  ON mood_patterns
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hrv_records_user_date ON hrv_records(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_statistics_user_period ON emotion_statistics(user_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_mood_patterns_user_type ON mood_patterns(user_id, pattern_type, last_updated DESC);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_hrv_records_updated_at') THEN
    CREATE TRIGGER update_hrv_records_updated_at
      BEFORE UPDATE ON hrv_records
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_emotion_statistics_updated_at') THEN
    CREATE TRIGGER update_emotion_statistics_updated_at
      BEFORE UPDATE ON emotion_statistics
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;