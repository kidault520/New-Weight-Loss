/*
  # Create Food and Exercise Library Tables

  1. New Tables
    - `food_library` - Food items catalog for nutrition tracking
    - `exercise_library` - Exercise items catalog for fitness tracking

  2. Features
    - Support for food categories and nutrition data
    - Support for exercise categories and calorie data
    - Active/inactive status for items
    - Display order for sorting

  3. Security
    - Enable RLS on all tables
    - Add policies for admin access (management)
    - Public read access for active items (for frontend)
*/

-- Food Library table
CREATE TABLE IF NOT EXISTS food_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🍽️',
  image_url text,
  category text NOT NULL DEFAULT '常用',
  calories numeric(10, 2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '份',
  protein numeric(10, 2) DEFAULT 0,
  carbs numeric(10, 2) DEFAULT 0,
  fat numeric(10, 2) DEFAULT 0,
  fiber numeric(10, 2) DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Exercise Library table
CREATE TABLE IF NOT EXISTS exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🏃',
  category text NOT NULL DEFAULT '常用',
  calories numeric(10, 2) NOT NULL DEFAULT 0,
  duration integer NOT NULL DEFAULT 30, -- minutes
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_food_library_category ON food_library(category);
CREATE INDEX IF NOT EXISTS idx_food_library_is_active ON food_library(is_active);
CREATE INDEX IF NOT EXISTS idx_food_library_display_order ON food_library(display_order);
CREATE INDEX IF NOT EXISTS idx_food_library_created_at ON food_library(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_library_category ON exercise_library(category);
CREATE INDEX IF NOT EXISTS idx_exercise_library_is_active ON exercise_library(is_active);
CREATE INDEX IF NOT EXISTS idx_exercise_library_display_order ON exercise_library(display_order);
CREATE INDEX IF NOT EXISTS idx_exercise_library_created_at ON exercise_library(created_at DESC);

-- Enable Row Level Security
ALTER TABLE food_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies for food_library
-- Public read access for active items
CREATE POLICY "Public can view active food items"
  ON food_library FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage food library"
  ON food_library FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- RLS Policies for exercise_library
-- Public read access for active items
CREATE POLICY "Public can view active exercise items"
  ON exercise_library FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage exercise library"
  ON exercise_library FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_food_library_updated_at
  BEFORE UPDATE ON food_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercise_library_updated_at
  BEFORE UPDATE ON exercise_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();














