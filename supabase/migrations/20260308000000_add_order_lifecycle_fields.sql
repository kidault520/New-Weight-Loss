ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirm_status text DEFAULT 'unconfirmed' CHECK (confirm_status IN ('unconfirmed','confirmed'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirm_time timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_state text DEFAULT 'not_started' CHECK (delivery_state IN ('not_started','started','ended'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comment_time timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_confirm_status ON orders(confirm_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_state ON orders(delivery_state);
