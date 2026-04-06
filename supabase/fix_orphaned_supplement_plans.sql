-- 清理已删除补剂疗程对应的 supplement_plans：将没有关联 supplement_schedule 的 plan 设为不可用
-- 在 Supabase Dashboard → SQL Editor 中执行

UPDATE supplement_plans sp
SET is_active = false, updated_at = now()
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM supplement_schedules ss
    WHERE ss.course_id = sp.id
  );
