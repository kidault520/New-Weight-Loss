-- Order audit logs (minimal governance baseline)

CREATE TABLE IF NOT EXISTS public.order_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'order',
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_user_created
  ON public.order_audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_entity
  ON public.order_audit_logs (entity_type, entity_id, created_at DESC);

ALTER TABLE public.order_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own order audit logs" ON public.order_audit_logs;
CREATE POLICY "Users can read own order audit logs"
  ON public.order_audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
