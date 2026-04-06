-- Freeze settlement basis at payment time.
-- One paid order => one immutable settlement snapshot.

CREATE TABLE IF NOT EXISTS public.order_settlement_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number text NULL,
  user_id uuid NULL,
  salesperson_id uuid NULL,
  product_id uuid NULL REFERENCES public.products(id),
  payment_time timestamptz NULL,
  settled_amount numeric(12,2) NOT NULL DEFAULT 0,
  config_version integer NULL,
  discount_rate numeric(8,6) NOT NULL,
  commission_rate numeric(8,6) NOT NULL,
  estimated_commission numeric(12,2) NOT NULL DEFAULT 0,
  config_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_settlement_snapshots_order_id
  ON public.order_settlement_snapshots(order_id);

CREATE INDEX IF NOT EXISTS idx_order_settlement_snapshots_salesperson
  ON public.order_settlement_snapshots(salesperson_id);

CREATE INDEX IF NOT EXISTS idx_order_settlement_snapshots_payment_time
  ON public.order_settlement_snapshots(payment_time DESC);

