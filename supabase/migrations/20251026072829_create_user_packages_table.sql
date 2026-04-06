/*
  # Create user_packages table for customer package information

  1. New Tables
    - `user_packages`
      - `id` (uuid, primary key) - Unique package identifier
      - `user_id` (uuid, foreign key) - References user_profiles.user_id
      - `package_duration` (integer) - Package duration in days (e.g., 14, 21, 31)
      - `included_meals` (text array) - Array of included meal types: breakfast, lunch, dinner
      - `package_name` (text) - Display name for the package
      - `start_date` (date) - Package start date
      - `end_date` (date) - Package end date (calculated)
      - `is_active` (boolean) - Whether this is the active package for the user
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `user_packages` table
    - Add policy for authenticated users to read their own packages
    - Add policy for authenticated users to insert their own packages
    - Add policy for authenticated users to update their own packages

  3. Indexes
    - Create index on user_id for efficient querying
    - Create index on is_active for filtering active packages

  4. Notes
    - Sample data will be added programmatically after user profiles exist
    - Foreign key constraint ensures data integrity with user_profiles table
*/

-- Create user_packages table
CREATE TABLE IF NOT EXISTS user_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  package_duration integer NOT NULL CHECK (package_duration > 0),
  included_meals text[] NOT NULL DEFAULT '{}',
  package_name text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON user_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_is_active ON user_packages(is_active);

-- Enable RLS
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own packages"
  ON user_packages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own packages"
  ON user_packages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own packages"
  ON user_packages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own packages"
  ON user_packages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_packages_updated_at_trigger ON user_packages;
CREATE TRIGGER update_user_packages_updated_at_trigger
  BEFORE UPDATE ON user_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_user_packages_updated_at();