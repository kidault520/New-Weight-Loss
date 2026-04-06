-- Emergency rollback for aggressive v1 repair migrations.
-- Scope: only v1 row in sales_product_config_versions for config_key='default'.
-- Strategy: restore v1 from earliest publish audit snapshot (seq 1).
-- No fallback inference / no baseline overwrite.

BEGIN;

CREATE TEMP TABLE tmp_publish_v1 AS
SELECT
  ROW_NUMBER() OVER (
    PARTITION BY module
    ORDER BY
      COALESCE((after_data->>'effectiveAt')::timestamptz, (after_data->>'effective_at')::timestamptz, created_at) ASC,
      created_at ASC,
      id ASC
  )::integer AS seq_version,
  COALESCE((after_data->>'effectiveAt')::timestamptz, (after_data->>'effective_at')::timestamptz, created_at) AS effective_at,
  COALESCE(after_data->'categories', '[]'::jsonb) AS categories,
  COALESCE(after_data->'productMappings', after_data->'product_mappings', '[]'::jsonb) AS product_mappings,
  COALESCE(after_data->'discountRates', after_data->'discount_rates', '[]'::jsonb) AS discount_rates
FROM public.admin_change_audit_logs
WHERE module = 'sales_product_config'
  AND action = 'publish'
  AND after_data IS NOT NULL;

ALTER TABLE public.sales_product_config_versions
  DISABLE TRIGGER trg_prevent_update_sales_product_config_versions;

UPDATE public.sales_product_config_versions v
SET
  effective_at = p.effective_at,
  categories = p.categories,
  product_mappings = p.product_mappings,
  discount_rates = p.discount_rates,
  source = 'rollback_to_publish_v1',
  note = 'rolled back from aggressive v1 repair to publish snapshot'
FROM tmp_publish_v1 p
WHERE v.config_key = 'default'
  AND v.version = 1
  AND p.seq_version = 1
  AND v.source IN (
    'repair_from_order_snapshot',
    'repair_v1_from_publish_audit',
    'repair_v1_from_order_snapshot',
    'repair_v1_infer_categories_from_rates',
    'repair_v1_fallback_baseline'
  );

ALTER TABLE public.sales_product_config_versions
  ENABLE TRIGGER trg_prevent_update_sales_product_config_versions;

COMMIT;
