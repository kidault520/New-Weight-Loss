-- 检查执行计划数据的查询脚本
-- 用于调试：查看当前用户的执行计划状态

-- 1. 查看所有执行计划
SELECT 
  ep.id,
  ep.user_id,
  ep.order_id,
  ep.program_type,
  ep.start_date,
  ep.end_date,
  ep.status,
  ep.current_day,
  ep.total_days,
  ep.created_at,
  ep.updated_at,
  o.payment_status,
  o.payment_time
FROM execution_programs ep
LEFT JOIN orders o ON ep.order_id = o.id
ORDER BY ep.created_at DESC
LIMIT 10;

-- 2. 查看特定用户的执行计划（替换 YOUR_USER_ID）
-- SELECT 
--   ep.id,
--   ep.user_id,
--   ep.order_id,
--   ep.program_type,
--   ep.start_date,
--   ep.end_date,
--   ep.status,
--   ep.current_day,
--   ep.total_days,
--   ep.created_at,
--   ep.updated_at,
--   o.payment_status,
--   o.payment_time
-- FROM execution_programs ep
-- LEFT JOIN orders o ON ep.order_id = o.id
-- WHERE ep.user_id = '0531fee0-45a5-4bba-8d3f-84cd6c31c1bf'
-- ORDER BY ep.created_at DESC;

-- 3. 查看今日任务
SELECT 
  dt.id,
  dt.program_id,
  dt.task_date,
  dt.task_type,
  dt.task_status,
  dt.scheduled_time,
  dt.task_data,
  dt.completed_at,
  ep.user_id,
  ep.current_day
FROM daily_execution_tasks dt
JOIN execution_programs ep ON dt.program_id = ep.id
WHERE dt.task_date = CURRENT_DATE
ORDER BY dt.scheduled_time ASC
LIMIT 20;

-- 4. 检查用户是否有已支付订单
-- SELECT 
--   o.id,
--   o.user_id,
--   o.product_id,
--   o.payment_status,
--   o.payment_time,
--   o.created_at,
--   p.duration_days,
--   p.product_name
-- FROM orders o
-- LEFT JOIN products p ON o.product_id = p.id
-- WHERE o.user_id = '0531fee0-45a5-4bba-8d3f-84cd6c31c1bf'
--   AND o.payment_status = 'paid'
-- ORDER BY o.payment_time DESC, o.created_at DESC
-- LIMIT 5;



