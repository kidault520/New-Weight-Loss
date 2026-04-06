-- 历史订单回填：order_status=processing 但 delivery_state/start_time 未同步的订单
-- 修复 C 端显示「服务中」而管理后台显示「未开启」的不一致
-- 若 delivery_state/start_time 列不存在，先添加（兼容未执行 20260308000000 的库）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_state text DEFAULT 'not_started';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS start_time timestamptz;

UPDATE orders
SET
  delivery_state = 'started',
  start_time = COALESCE(start_time, payment_time, updated_at, created_at)
WHERE order_status = 'processing'
  AND (delivery_state IS NULL OR delivery_state != 'started' OR start_time IS NULL);
