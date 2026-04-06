-- Sales product config version history (append-only snapshots)
-- Purpose:
-- 1) Keep immutable snapshots for each version
-- 2) Record effective time and operator for traceability

CREATE TABLE IF NOT EXISTS public.sales_product_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL DEFAULT 'default',
  version integer NOT NULL CHECK (version > 0),
  effective_at timestamptz NOT NULL DEFAULT now(),
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount_rates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_admin_id uuid NULL,
  source text NOT NULL DEFAULT 'manual',
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_product_config_versions_key_version
  ON public.sales_product_config_versions (config_key, version);

CREATE INDEX IF NOT EXISTS idx_sales_product_config_versions_key_effective
  ON public.sales_product_config_versions (config_key, effective_at DESC);

-- Backfill current config as a version snapshot (idempotent)
INSERT INTO public.sales_product_config_versions (
  config_key,
  version,
  effective_at,
  categories,
  product_mappings,
  discount_rates,
  source,
  note
)
SELECT
  config_key,
  COALESCE(version, 1) AS version,
  COALESCE(effective_at, now()) AS effective_at,
  COALESCE(categories, '[]'::jsonb),
  COALESCE(product_mappings, '[]'::jsonb),
  COALESCE(discount_rates, '[]'::jsonb),
  'backfill',
  'initial snapshot from sales_product_config'
FROM public.sales_product_config
WHERE config_key = 'default'
ON CONFLICT (config_key, version) DO NOTHING;

