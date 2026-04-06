-- 删除旧表 meal_delivery_schedules
-- 执行前请确认：delivery_schedules 中已有完整数据，且业务已切换完成
-- 在 Supabase SQL Editor 中执行

-- 1. 先确认 delivery_schedules 餐食数据量
SELECT 
  count(*) AS delivery_schedules_餐食条数,
  count(DISTINCT user_id) AS 用户数
FROM delivery_schedules
WHERE delivery_type = 'meal' AND meal_type IS NOT NULL;

-- 2. 若 meal_delivery_schedules 存在，查看其数据量
SELECT count(*) AS meal_delivery_schedules条数
FROM meal_delivery_schedules
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_delivery_schedules');

-- 3. 确认无误后，删除旧表
DROP TABLE IF EXISTS meal_delivery_schedules;

-- 4. 验证删除结果
SELECT 
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_delivery_schedules') AS meal_delivery_schedules是否还存在;
