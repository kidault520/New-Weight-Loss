-- 为 order_id 为空的 delivery_schedules 回填关联订单
-- 规则：取该用户最近一条已支付且未完成的订单
-- 在 Supabase SQL Editor 中执行

UPDATE delivery_schedules ds
SET order_id = sub.o_id, updated_at = now()
FROM (
  SELECT ds2.id AS ds_id, o.id AS o_id
  FROM delivery_schedules ds2
  CROSS JOIN LATERAL (
    SELECT o2.id
    FROM orders o2
    WHERE o2.user_id = ds2.user_id
      AND o2.payment_status = 'paid'
      AND o2.order_status NOT IN ('cancelled', 'completed')
    ORDER BY COALESCE(o2.payment_time, o2.created_at) DESC
    LIMIT 1
  ) o
  WHERE ds2.order_id IS NULL
    AND ds2.delivery_type = 'meal'
) sub
WHERE ds.id = sub.ds_id;
