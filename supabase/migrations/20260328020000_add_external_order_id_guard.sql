-- Guard callback matching key: external_order_id should be unique when present.
-- If historical duplicates already exist, keep system running and rely on route-level ambiguity guard.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM delivery_schedules
    WHERE external_order_id IS NOT NULL
    GROUP BY external_order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skip unique index idx_delivery_schedules_external_order_id_unique: duplicate external_order_id exists, please clean data first.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_schedules_external_order_id_unique
    ON delivery_schedules (external_order_id)
    WHERE external_order_id IS NOT NULL;
  END IF;
END $$;
