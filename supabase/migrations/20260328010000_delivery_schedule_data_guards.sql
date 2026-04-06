-- P0 guards for meal schedule integrity and delivery address defaults

-- 1) Prevent duplicate meal entries for same day/type under one schedule
CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_schedule_entries_schedule_date_type
ON meal_schedule_entries (schedule_id, date, package_type);

-- 2) Ensure default_meal_types keeps only allowed meal types and array shape
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_addresses_default_meal_types_valid'
  ) THEN
    ALTER TABLE delivery_addresses
      ADD CONSTRAINT delivery_addresses_default_meal_types_valid
      CHECK (
        jsonb_typeof(default_meal_types) = 'array'
        AND NOT jsonb_path_exists(
          default_meal_types,
          '$[*] ? (@ != "breakfast" && @ != "lunch" && @ != "dinner")'
        )
      ) NOT VALID;
  END IF;
END $$;
