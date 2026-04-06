-- 诊断配送计划 22a1bfb1-6dc5-4e40-beb7-ff20287cf8c4 的数据
-- 在 Supabase SQL Editor 中执行，查看 user_id、order_id、快照、user_profiles、orders 等

SELECT
  ds.id,
  ds.user_id,
  ds.order_id,
  ds.delivery_date,
  ds.meal_type,
  ds.delivery_user_nickname,
  ds.delivery_user_phone,
  ds.delivery_order_number,
  ds.delivery_address,
  ds.delivery_contact_name,
  ds.delivery_contact_phone
FROM delivery_schedules ds
WHERE ds.id = '22a1bfb1-6dc5-4e40-beb7-ff20287cf8c4';

-- user_profiles 中是否有该用户
SELECT up.user_id, up.nickname, up.name, up.phone
FROM user_profiles up
WHERE up.user_id = (SELECT user_id FROM delivery_schedules WHERE id = '22a1bfb1-6dc5-4e40-beb7-ff20287cf8c4');

-- 该用户的订单（用于回填 order_id）
SELECT o.id, o.order_number, o.payment_status, o.order_status, o.created_at
FROM orders o
WHERE o.user_id = (SELECT user_id FROM delivery_schedules WHERE id = '22a1bfb1-6dc5-4e40-beb7-ff20287cf8c4')
ORDER BY COALESCE(o.payment_time, o.created_at) DESC
LIMIT 5;
