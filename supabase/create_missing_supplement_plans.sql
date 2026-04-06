-- 为没有关联 supplement_plan 的 supplement_schedule 创建对应的 plan
-- 适用于：补剂疗程管理里创建的疗程，在 create_plan 功能添加之前，可能没有对应的 supplement_plan
-- 在 Supabase Dashboard → SQL Editor 中执行

DO $$
DECLARE
  r RECORD;
  new_plan_id uuid;
BEGIN
  FOR r IN
    SELECT ss.id AS schedule_id, ss.schedule_name, COALESCE(ss.total_days, 30) AS total_days
    FROM supplement_schedules ss
    WHERE ss.course_id IS NULL
  LOOP
    INSERT INTO supplement_plans (plan_name, duration_days, is_active, created_at, updated_at)
    VALUES (r.schedule_name, r.total_days, true, now(), now())
    RETURNING id INTO new_plan_id;
    
    UPDATE supplement_schedules SET course_id = new_plan_id WHERE id = r.schedule_id;
  END LOOP;
END $$;
