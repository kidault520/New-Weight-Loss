ALTER TABLE meal_schedules
ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE meal_schedules
ADD COLUMN IF NOT EXISTS enabled_at timestamptz;

ALTER TABLE meal_schedules
ADD COLUMN IF NOT EXISTS enabled_by uuid;

CREATE INDEX IF NOT EXISTS idx_meal_schedules_is_enabled ON meal_schedules(is_enabled);
