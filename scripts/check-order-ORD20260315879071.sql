-- 查询订单 ORD20260315879071 的服务状态与配送计划
-- 在 Supabase SQL Editor 中执行
--
-- 说明：已统一为 delivery_schedules 表，支持 C端/B端/三方配送。

-- 1. 订单基本信息与服务状态
SELECT
  o.id,
  o.order_number,
  o.user_id,
  o.order_status,
  o.payment_status,
  o.payment_time,
  o.delivery_state,
  o.start_time,
  o.created_at,
  CASE
    WHEN o.delivery_state = 'started' AND o.start_time IS NOT NULL THEN '已开启'
    ELSE '未开启'
  END AS 服务状态
FROM orders o
WHERE o.order_number = 'ORD20260315879071';

-- 2. 统一配送计划（delivery_schedules，按 user_id，delivery_type='meal'）
SELECT
  o.order_number,
  o.user_id,
  COUNT(ds.id) AS 配送计划条数,
  CASE WHEN COUNT(ds.id) > 0 THEN '已配置' ELSE '未配置' END AS 配送计划状态
FROM orders o
LEFT JOIN delivery_schedules ds ON ds.user_id = o.user_id AND ds.delivery_type = 'meal' AND ds.meal_type IS NOT NULL
WHERE o.order_number = 'ORD20260315879071'
GROUP BY o.order_number, o.user_id;

-- 3. 配送计划明细（按 user_id 关联，含 order_id 为空或匹配的）
SELECT
  ds.id,
  ds.delivery_date,
  ds.meal_type,
  ds.delivery_time_start,
  ds.delivery_time_end,
  ds.item_name,
  ds.delivery_address_id,
  ds.is_locked,
  ds.status,
  ds.order_id,
  CASE WHEN ds.order_id = o.id THEN '✓ 已关联' ELSE '未关联' END AS 订单关联,
  ds.tracking_number,
  ds.rider_name,
  ds.rider_lat,
  ds.rider_lng
FROM delivery_schedules ds
JOIN orders o ON o.user_id = ds.user_id
WHERE o.order_number = 'ORD20260315879071'
  AND ds.delivery_type = 'meal'
  AND ds.meal_type IS NOT NULL
ORDER BY ds.delivery_date, ds.meal_type;

-- 4. 该订单直接关联的配送计划（order_id = 订单ID）
SELECT
  o.order_number,
  COUNT(ds.id) AS 订单关联配送计划条数,
  CASE WHEN COUNT(ds.id) > 0 THEN '已关联' ELSE '未关联' END AS 订单关联状态
FROM orders o
LEFT JOIN delivery_schedules ds ON ds.order_id = o.id AND ds.delivery_type = 'meal'
WHERE o.order_number = 'ORD20260315879071'
GROUP BY o.order_number;

-- 5. 回填前置检查（执行 backfill-delivery-schedules-for-order.sql 前可先看此结果）
SELECT
  o.order_number,
  o.user_id,
  o.delivery_address_id AS 订单配送地址,
  up.meal_plan_config_data IS NOT NULL AS 有meal_plan配置,
  jsonb_array_length(COALESCE(up.meal_plan_config_data->'selected_dates', '[]'::jsonb)) AS 配置日期数,
  p.duration_days AS 商品天数,
  (COALESCE(o.start_time, o.payment_time, o.created_at))::date AS 推算开始日
FROM orders o
LEFT JOIN user_profiles up ON up.user_id = o.user_id
LEFT JOIN products p ON p.id = o.product_id
WHERE o.order_number = 'ORD20260315879071';
