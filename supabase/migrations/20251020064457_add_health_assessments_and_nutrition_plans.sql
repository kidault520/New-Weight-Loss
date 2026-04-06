/*
  # Health Assessment and Nutrition Plans System

  ## New Tables
  
  ### `health_assessments`
  Stores user health assessment questionnaire results and dimension scores
  - `id` (uuid, primary key) - Unique assessment identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `assessment_date` (timestamptz) - When assessment was completed
  - `diet_score` (integer) - Diet dimension score (0-100)
  - `fitness_score` (integer) - Physical fitness dimension score (0-100)
  - `rest_score` (integer) - Rest/Sleep dimension score (0-100)
  - `psychology_score` (integer) - Psychology dimension score (0-100)
  - `exercise_score` (integer) - Exercise dimension score (0-100)
  - `overall_score` (integer) - Calculated overall health score (0-100)
  - `questionnaire_data` (jsonb) - Raw questionnaire responses
  - `primary_improvement_area` (text) - Main area needing improvement
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `nutrition_plans`
  Stores recommended and user-selected nutrition plans
  - `id` (uuid, primary key) - Unique plan identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `assessment_id` (uuid, foreign key) - References health_assessments
  - `plan_type` (text) - Type: 'supplement' or 'diet'
  - `plan_name` (text) - Name of the plan
  - `plan_data` (jsonb) - Detailed plan information
  - `is_selected` (boolean) - Whether user selected this plan
  - `subscription_status` (text) - Status: 'active', 'inactive', 'trial'
  - `subscription_start_date` (timestamptz) - When subscription started
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users to access their own data only
  - Prevent unauthorized access to health assessment data
*/

-- Health assessments table
CREATE TABLE IF NOT EXISTS health_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assessment_date timestamptz DEFAULT now() NOT NULL,
  diet_score integer CHECK (diet_score >= 0 AND diet_score <= 100),
  fitness_score integer CHECK (fitness_score >= 0 AND fitness_score <= 100),
  rest_score integer CHECK (rest_score >= 0 AND rest_score <= 100),
  psychology_score integer CHECK (psychology_score >= 0 AND psychology_score <= 100),
  exercise_score integer CHECK (exercise_score >= 0 AND exercise_score <= 100),
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  questionnaire_data jsonb DEFAULT '{}',
  primary_improvement_area text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Nutrition plans table
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assessment_id uuid REFERENCES health_assessments(id) ON DELETE CASCADE,
  plan_type text CHECK (plan_type IN ('supplement', 'diet')) NOT NULL,
  plan_name text NOT NULL,
  plan_data jsonb DEFAULT '{}',
  is_selected boolean DEFAULT false,
  subscription_status text CHECK (subscription_status IN ('active', 'inactive', 'trial')) DEFAULT 'inactive',
  subscription_start_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE health_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for health_assessments
CREATE POLICY "Users can read own health assessments"
  ON health_assessments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health assessments"
  ON health_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health assessments"
  ON health_assessments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health assessments"
  ON health_assessments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for nutrition_plans
CREATE POLICY "Users can read own nutrition plans"
  ON nutrition_plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition plans"
  ON nutrition_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition plans"
  ON nutrition_plans
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition plans"
  ON nutrition_plans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_health_assessments_user_date 
  ON health_assessments(user_id, assessment_date DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_assessment 
  ON nutrition_plans(user_id, assessment_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_type 
  ON nutrition_plans(user_id, plan_type, is_selected);