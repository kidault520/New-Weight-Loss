ALTER TABLE meal_schedules
ADD COLUMN IF NOT EXISTS schedule_code text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_schedules_schedule_code
ON meal_schedules(schedule_code)
WHERE schedule_code IS NOT NULL;

WITH ranked AS (
  SELECT
    id,
    to_char(created_at, 'YYYYMM') AS ym,
    row_number() OVER (
      PARTITION BY date_trunc('month', created_at)
      ORDER BY created_at, id
    ) AS rn
  FROM meal_schedules
  WHERE schedule_code IS NULL
)
UPDATE meal_schedules m
SET schedule_code = 'MS-' || ranked.ym || '-' || lpad(ranked.rn::text, 3, '0')
FROM ranked
WHERE m.id = ranked.id;
