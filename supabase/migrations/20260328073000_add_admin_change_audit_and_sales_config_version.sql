-- Add admin change audit table + sales_product_config version fields

-- 1) Admin change audit logs
CREATE TABLE IF NOT EXISTS public.admin_change_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NULL,
  module text NOT NULL,
  action text NOT NULL,
  entity_id text NULL,
  before_data jsonb NULL,
  after_data jsonb NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_change_audit_logs_module_created
  ON public.admin_change_audit_logs (module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_change_audit_logs_admin_created
  ON public.admin_change_audit_logs (admin_id, created_at DESC);

-- 2) Version fields for sales_product_config
ALTER TABLE public.sales_product_config
  ADD COLUMN IF NOT EXISTS version integer;

ALTER TABLE public.sales_product_config
  ADD COLUMN IF NOT EXISTS effective_at timestamptz;

UPDATE public.sales_product_config
SET
  version = COALESCE(version, 1),
  effective_at = COALESCE(effective_at, now())
WHERE version IS NULL
   OR effective_at IS NULL;

ALTER TABLE public.sales_product_config
  ALTER COLUMN version SET DEFAULT 1;

ALTER TABLE public.sales_product_config
  ALTER COLUMN effective_at SET DEFAULT now();

