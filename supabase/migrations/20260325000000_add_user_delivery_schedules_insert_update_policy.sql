-- 允许用户对自己的 delivery_schedules 进行 INSERT 和 UPDATE
-- C 端配置配送计划时需写入 delivery_schedules，仅 SELECT 无法完成

DROP POLICY IF EXISTS "Users can insert own delivery schedules" ON delivery_schedules;
CREATE POLICY "Users can insert own delivery schedules"
  ON delivery_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own delivery schedules" ON delivery_schedules;
CREATE POLICY "Users can update own delivery schedules"
  ON delivery_schedules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
