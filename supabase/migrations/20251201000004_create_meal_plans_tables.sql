/*
  # Create Meal Plans Tables

  1. New Tables
    - `meal_plans` - Meal plan templates/programs
    - `meal_plan_packages` - Relationship between meal plans and meal packages (套餐方案)

  2. Features
    - Meal plans can have multiple packages (breakfast, lunch, dinner)
    - Plan duration and date range management
    - Support for plan activation/deactivation

  3. Security
    - Enable RLS on all tables
    - Add policies for admin access only (menu management)
*/

-- Drop existing meal_plans table if it exists (may have different structure from older migrations)
-- Note: This will delete any existing data. If you need to preserve data, backup first.
DROP TABLE IF EXISTS meal_plan_packages CASCADE;
DROP TABLE IF EXISTS meal_plans CASCADE;

-- Meal plans table
CREATE TABLE meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
  -- Note: Removed valid_duration constraint because trigger will auto-calculate end_date
);

-- Meal plan packages table (套餐方案关联表)
CREATE TABLE meal_plan_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES meal_packages(id) ON DELETE CASCADE,
  package_type text NOT NULL CHECK (package_type IN ('早餐', '午餐', '晚餐')),
  day_number integer NOT NULL CHECK (day_number > 0),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(plan_id, package_id, package_type, day_number)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meal_plans_start_date ON meal_plans(start_date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_end_date ON meal_plans(end_date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_is_active ON meal_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_meal_plan_packages_plan_id ON meal_plan_packages(plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_packages_package_id ON meal_plan_packages(package_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_packages_day_number ON meal_plan_packages(day_number);

-- RLS Policies
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_packages ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
DROP POLICY IF EXISTS "Admins can manage meal plans" ON meal_plans;
CREATE POLICY "Admins can manage meal plans"
  ON meal_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_menu'
    )
  );

DROP POLICY IF EXISTS "Admins can manage meal plan packages" ON meal_plan_packages;
CREATE POLICY "Admins can manage meal plan packages"
  ON meal_plan_packages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_menu'
    )
  );

-- Public can read active meal plans (for frontend display)
DROP POLICY IF EXISTS "Public can read active meal plans" ON meal_plans;
CREATE POLICY "Public can read active meal plans"
  ON meal_plans
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can read meal plan packages" ON meal_plan_packages;
CREATE POLICY "Public can read meal plan packages"
  ON meal_plan_packages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_packages.plan_id
      AND meal_plans.is_active = true
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_meal_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_meal_plans_updated_at ON meal_plans;
CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_plans_updated_at();

-- Function to automatically calculate end_date from start_date and duration
CREATE OR REPLACE FUNCTION calculate_meal_plan_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_date IS NOT NULL AND NEW.duration_days IS NOT NULL THEN
    NEW.end_date = NEW.start_date + (NEW.duration_days - 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate end_date
DROP TRIGGER IF EXISTS calculate_meal_plan_end_date ON meal_plans;
CREATE TRIGGER calculate_meal_plan_end_date
  BEFORE INSERT OR UPDATE ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION calculate_meal_plan_end_date();

