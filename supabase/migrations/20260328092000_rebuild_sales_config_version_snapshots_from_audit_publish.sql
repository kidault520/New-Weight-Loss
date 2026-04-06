-- Rebuild version snapshots from publish audit logs.
-- Goal: make v1/v2/v3 snapshot payloads match real publish-time content.

BEGIN;

CREATE TEMP TABLE tmp_sales_config_publish_snapshots AS
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
  source = 'audit_rebuild',
  note = COALESCE(v.note, 'rebuilt_from_publish_audit')
FROM tmp_sales_config_publish_snapshots p
WHERE v.config_key = 'default'
  AND v.version = p.seq_version;

ALTER TABLE public.sales_product_config_versions
  ENABLE TRIGGER trg_prevent_update_sales_product_config_versions;

COMMIT;
