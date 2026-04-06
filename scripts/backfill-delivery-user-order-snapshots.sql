-- 回填 delivery_schedules 的用户昵称、手机、订单号快照
-- 在 Supabase SQL Editor 中执行

-- 1. 从 user_profiles 回填用户快照
UPDATE delivery_schedules ds
SET
  delivery_user_nickname = COALESCE(NULLIF(TRIM(up.nickname), ''), up.name, '用户'),
  delivery_user_phone = COALESCE(ds.delivery_user_phone, up.phone),
  updated_at = now()
FROM user_profiles up
WHERE ds.user_id = up.user_id
  AND (ds.delivery_user_nickname IS NULL OR ds.delivery_user_nickname = '用户')
  AND (up.nickname IS NOT NULL OR up.name IS NOT NULL OR up.phone IS NOT NULL);

-- 2. 从 orders 回填订单号快照
UPDATE delivery_schedules ds
SET
  delivery_order_number = o.order_number,
  updated_at = now()
FROM orders o
WHERE ds.order_id = o.id
  AND ds.delivery_order_number IS NULL
  AND o.order_number IS NOT NULL;

-- 3. 回填 order_id 为空的记录：取用户最近已支付且未完成订单
UPDATE delivery_schedules ds
SET
  order_id = sub.o_id,
  delivery_order_number = sub.order_number,
  updated_at = now()
FROM (
  SELECT ds2.id AS ds_id, o.id AS o_id, o.order_number
  FROM delivery_schedules ds2
  CROSS JOIN LATERAL (
    SELECT o2.id, o2.order_number
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
