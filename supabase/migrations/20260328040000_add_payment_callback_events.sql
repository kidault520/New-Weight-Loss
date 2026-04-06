-- Payment callback idempotency/event ledger (minimal)
-- Keep this table server-write only (via service role).

CREATE TABLE IF NOT EXISTS payment_callback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_event_id text NOT NULL,
  external_order_id text NOT NULL,
  order_id uuid NULL REFERENCES orders(id) ON DELETE SET NULL,
  callback_payment_status text NOT NULL CHECK (callback_payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  process_result text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_callback_events_event_id_unique
  ON payment_callback_events(payment_event_id);

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_external_order_id
  ON payment_callback_events(external_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_order_id
  ON payment_callback_events(order_id);

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_created_at
  ON payment_callback_events(created_at DESC);
