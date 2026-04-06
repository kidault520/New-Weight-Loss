-- 退单相关字段：支持部分/全额退款，记录退单时间与原因
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount numeric(10, 2) CHECK (refund_amount >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_time timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason text;
COMMENT ON COLUMN orders.refund_amount IS '实际退款金额，为空表示全额退款';
COMMENT ON COLUMN orders.refund_time IS '退单操作时间';
COMMENT ON COLUMN orders.refund_reason IS '退单原因（如：用户申请、服务未开启等）';
