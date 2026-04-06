-- 订单数据修复：销售人员、支付状态、开启状态
-- 0. 若 sales_persons 为空则插入基础人员（兜底）
-- 1. 为无销售人员的订单从组织人员（sales_persons）中轮询分配
-- 2. 修复错误支付状态：payment_status=paid 但 payment_time 为空 → pending
-- 3. 修复服务中订单的开启状态：order_status=processing 时同步 delivery_state 和 start_time

-- 确保 delivery_state、start_time 列存在（兼容未执行 20260308000000 的库）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_state text DEFAULT 'not_started';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS start_time timestamptz;

-- ========== 0. 若 sales_persons 为空则插入基础人员 ==========
INSERT INTO sales_persons (id, code, name, level, original_level, status, join_date)
SELECT * FROM (VALUES
  ('a1000000-0000-0000-0000-000000000001'::uuid, 'SP001', '区经理 Y', '区经理', '区经理', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000002'::uuid, 'SP002', '东莞市种子组织', '收展员', '收展员', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000003'::uuid, 'SP003', '武汉市种子', '区经理', '区经理', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000004'::uuid, 'SP004', '销售顾问 A', '收展员', '收展员', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000005'::uuid, 'SP005', '销售顾问 B', '收展员', '收展员', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000006'::uuid, 'SP006', '销售顾问 C', '组经理', '组经理', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000007'::uuid, 'SP007', '销售顾问 D', '部经理', '部经理', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000008'::uuid, 'SP008', '销售顾问 E', '收展员', '收展员', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000009'::uuid, 'SP009', '销售顾问 F', '收展员', '收展员', '活跃', '2026-03-15'::date),
  ('a1000000-0000-0000-0000-000000000010'::uuid, 'SP010', '销售顾问 G', '收展员', '收展员', '活跃', '2026-03-15'::date)
) AS v(id, code, name, level, original_level, status, join_date)
WHERE NOT EXISTS (SELECT 1 FROM sales_persons LIMIT 1);

-- ========== 1. 分配销售人员（从 sales_persons 中轮询分配）==========
DO $$
DECLARE
  sp_ids uuid[];
  sp_count int;
  ord_rec record;
  i int := 0;
BEGIN
  SELECT array_agg(id ORDER BY id) INTO sp_ids
  FROM sales_persons
  WHERE (status = '活跃' OR status = '晋升中' OR status IS NULL);

  IF sp_ids IS NULL OR array_length(sp_ids, 1) = 0 THEN
    SELECT array_agg(id ORDER BY id) INTO sp_ids FROM sales_persons;
  END IF;

  IF sp_ids IS NULL OR array_length(sp_ids, 1) = 0 THEN
    RAISE NOTICE 'sales_persons 表仍为空，跳过销售人员分配';
    RETURN;
  END IF;

  sp_count := array_length(sp_ids, 1);
  RAISE NOTICE '将为无销售人员的订单分配 % 名销售人员', sp_count;

  FOR ord_rec IN
    SELECT id FROM orders WHERE salesperson_id IS NULL ORDER BY created_at
  LOOP
    UPDATE orders
    SET salesperson_id = sp_ids[(i % sp_count) + 1]
    WHERE id = ord_rec.id;
    i := i + 1;
  END LOOP;

  RAISE NOTICE '已为 % 个订单分配销售人员', i;
END $$;

-- ========== 2. 修复错误支付状态 ==========
-- 已标记为 paid 但无 payment_time 的订单，视为数据错误，改为 pending
UPDATE orders
SET
  payment_status = 'pending',
  payment_time = NULL
WHERE payment_status = 'paid'
  AND payment_time IS NULL;

-- ========== 3. 修复服务中订单的开启状态 ==========
-- order_status=processing 表示服务进行中，应同步 delivery_state='started' 和 start_time
UPDATE orders
SET
  delivery_state = 'started',
  start_time = COALESCE(start_time, payment_time, updated_at, created_at)
WHERE order_status = 'processing'
  AND (delivery_state IS NULL OR delivery_state != 'started' OR start_time IS NULL);
