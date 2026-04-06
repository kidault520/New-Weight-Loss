-- Tighten delivery_schedules write policies:
-- user can only write rows whose delivery_address_id belongs to self (or NULL).

DROP POLICY IF EXISTS "Users can insert own delivery schedules" ON delivery_schedules;
CREATE POLICY "Users can insert own delivery schedules"
  ON delivery_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      delivery_address_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM delivery_addresses da
        WHERE da.id = delivery_schedules.delivery_address_id
          AND da.user_id = auth.uid()
          AND COALESCE(da.is_deleted, false) = false
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own delivery schedules" ON delivery_schedules;
CREATE POLICY "Users can update own delivery schedules"
  ON delivery_schedules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      delivery_address_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM delivery_addresses da
        WHERE da.id = delivery_schedules.delivery_address_id
          AND da.user_id = auth.uid()
          AND COALESCE(da.is_deleted, false) = false
      )
    )
  );
