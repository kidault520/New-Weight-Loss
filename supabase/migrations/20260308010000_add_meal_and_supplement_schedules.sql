-- Meal schedules
CREATE TABLE IF NOT EXISTS meal_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES meal_schedules(id) ON DELETE CASCADE,
  date date NOT NULL,
  package_id uuid NOT NULL REFERENCES meal_packages(id) ON DELETE RESTRICT,
  package_type text NOT NULL CHECK (package_type IN ('早餐','午餐','晚餐')),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meal_schedule_entries_schedule ON meal_schedule_entries(schedule_id);
CREATE INDEX IF NOT EXISTS idx_meal_schedule_entries_date ON meal_schedule_entries(date);

-- Supplement schedules
CREATE TABLE IF NOT EXISTS supplement_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name text NOT NULL,
  total_days integer NOT NULL CHECK (total_days > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS supplement_schedule_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES supplement_schedules(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplement_schedule_stages_schedule ON supplement_schedule_stages(schedule_id);
