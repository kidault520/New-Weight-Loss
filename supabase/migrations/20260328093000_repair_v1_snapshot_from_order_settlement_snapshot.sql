-- Repair v1 snapshot using earliest persisted order settlement snapshot.
-- Use this when earliest config version row was deleted/overwritten.

BEGIN;

CREATE TEMP TABLE tmp_v1_snapshot_candidate AS
SELECT
  COALESCE(config_snapshot->'categories', '[]'::jsonb) AS categories,
  COALESCE(config_snapshot->'product_mappings', '[]'::jsonb) AS product_mappings,
  COALESCE(config_snapshot->'discount_rates', '[]'::jsonb) AS discount_rates,
  COALESCE((config_snapshot->>'effective_at')::timestamptz, payment_time, created_at, now()) AS effective_at
FROM public.order_settlement_snapshots
WHERE config_snapshot IS NOT NULL
ORDER BY COALESCE(payment_time, created_at) ASC, created_at ASC, id ASC
LIMIT 1;

ALTER TABLE public.sales_product_config_versions
  DISABLE TRIGGER trg_prevent_update_sales_product_config_versions;

UPDATE public.sales_product_config_versions v
SET
  categories = c.categories,
  product_mappings = c.product_mappings,
  discount_rates = c.discount_rates,
  effective_at = COALESCE(v.effective_at, c.effective_at),
  source = 'repair_from_order_snapshot',
  note = 'v1 repaired from earliest order_settlement_snapshots.config_snapshot'
FROM tmp_v1_snapshot_candidate c
WHERE v.config_key = 'default'
  AND v.version = 1;

ALTER TABLE public.sales_product_config_versions
  ENABLE TRIGGER trg_prevent_update_sales_product_config_versions;

COMMIT;
