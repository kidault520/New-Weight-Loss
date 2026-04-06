-- Repair v1 to ensure category structure exists and baseline rate is available.
-- Priority:
-- 1) earliest publish audit snapshot with non-empty categories
-- 2) earliest order_settlement_snapshots config_snapshot with non-empty categories
-- 3) infer categories from v1 discount_rates
-- 4) final fallback: 减酯类 + 61%

BEGIN;

ALTER TABLE public.sales_product_config_versions
  DISABLE TRIGGER trg_prevent_update_sales_product_config_versions;

-- 1) Candidate from publish audit logs (non-empty categories)
CREATE TEMP TABLE tmp_v1_candidate_from_publish AS
SELECT
  COALESCE(after_data->'categories', '[]'::jsonb) AS categories,
  COALESCE(after_data->'productMappings', after_data->'product_mappings', '[]'::jsonb) AS product_mappings,
  COALESCE(after_data->'discountRates', after_data->'discount_rates', '[]'::jsonb) AS discount_rates
FROM public.admin_change_audit_logs
WHERE module = 'sales_product_config'
  AND action = 'publish'
  AND after_data IS NOT NULL
  AND jsonb_typeof(COALESCE(after_data->'categories', '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(after_data->'categories', '[]'::jsonb)) > 0
ORDER BY COALESCE((after_data->>'effectiveAt')::timestamptz, (after_data->>'effective_at')::timestamptz, created_at) ASC, created_at ASC, id ASC
LIMIT 1;

-- 2) Candidate from earliest order settlement snapshot (non-empty categories)
CREATE TEMP TABLE tmp_v1_candidate_from_order_snapshot AS
SELECT
  COALESCE(config_snapshot->'categories', '[]'::jsonb) AS categories,
  COALESCE(config_snapshot->'product_mappings', '[]'::jsonb) AS product_mappings,
  COALESCE(config_snapshot->'discount_rates', '[]'::jsonb) AS discount_rates
FROM public.order_settlement_snapshots
WHERE config_snapshot IS NOT NULL
  AND jsonb_typeof(COALESCE(config_snapshot->'categories', '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(config_snapshot->'categories', '[]'::jsonb)) > 0
ORDER BY COALESCE(payment_time, created_at) ASC, created_at ASC, id ASC
LIMIT 1;

-- Apply publish candidate first.
UPDATE public.sales_product_config_versions v
SET
  categories = c.categories,
  product_mappings = c.product_mappings,
  discount_rates = c.discount_rates,
  source = 'repair_v1_from_publish_audit',
  note = 'v1 repaired from earliest publish audit snapshot'
FROM tmp_v1_candidate_from_publish c
WHERE v.config_key = 'default'
  AND v.version = 1;

-- If still empty categories, apply order snapshot candidate.
UPDATE public.sales_product_config_versions v
SET
  categories = c.categories,
  product_mappings = c.product_mappings,
  discount_rates = c.discount_rates,
  source = 'repair_v1_from_order_snapshot',
  note = 'v1 repaired from earliest order settlement snapshot'
FROM tmp_v1_candidate_from_order_snapshot c
WHERE v.config_key = 'default'
  AND v.version = 1
  AND jsonb_array_length(COALESCE(v.categories, '[]'::jsonb)) = 0;

-- 3) If categories still empty, infer categories from existing v1 discount_rates.
WITH v1 AS (
  SELECT id, COALESCE(discount_rates, '[]'::jsonb) AS discount_rates
  FROM public.sales_product_config_versions
  WHERE config_key = 'default' AND version = 1
  LIMIT 1
),
rates AS (
  SELECT
    NULLIF(BTRIM(r->>'category'), '') AS category_name,
    NULLIF(BTRIM(r->>'attribute'), '') AS attr_name
  FROM v1, LATERAL jsonb_array_elements(v1.discount_rates) AS r
  WHERE NULLIF(BTRIM(r->>'category'), '') IS NOT NULL
),
cat_group AS (
  SELECT
    category_name,
    jsonb_agg(attr_name ORDER BY attr_name) FILTER (WHERE attr_name IS NOT NULL) AS attrs
  FROM rates
  GROUP BY category_name
),
cat_rank AS (
  SELECT
    category_name,
    COALESCE(attrs, '[]'::jsonb) AS attrs,
    ROW_NUMBER() OVER (ORDER BY category_name) AS rn
  FROM cat_group
),
cats_json AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', 'cat-' || rn,
        'name', category_name,
        'categoryId', 'pl' || LPAD(rn::text, 2, '0'),
        'attributes', attrs,
        'attributeIds', '{}'::jsonb
      ) ORDER BY rn
    ),
    '[]'::jsonb
  ) AS categories
  FROM cat_rank
)
UPDATE public.sales_product_config_versions v
SET
  categories = c.categories,
  source = 'repair_v1_infer_categories_from_rates',
  note = 'v1 categories inferred from existing discount rates'
FROM cats_json c
WHERE v.config_key = 'default'
  AND v.version = 1
  AND jsonb_array_length(COALESCE(v.categories, '[]'::jsonb)) = 0
  AND jsonb_array_length(c.categories) > 0;

-- 4) Final fallback: enforce baseline "减酯类 61%" only when v1 still broken.
UPDATE public.sales_product_config_versions v
SET
  categories = jsonb_build_array(
    jsonb_build_object(
      'id', 'cat-1',
      'name', '减酯类',
      'categoryId', 'pl01',
      'attributes', '[]'::jsonb,
      'attributeIds', '{}'::jsonb
    )
  ),
  discount_rates = jsonb_build_array(
    jsonb_build_object(
      'category', '减酯类',
      'categoryId', 'pl01',
      'discountRate', 0.61
    )
  ),
  source = 'repair_v1_fallback_baseline',
  note = 'v1 fallback baseline: 减酯类 61%'
WHERE v.config_key = 'default'
  AND v.version = 1
  AND jsonb_array_length(COALESCE(v.categories, '[]'::jsonb)) = 0;

ALTER TABLE public.sales_product_config_versions
  ENABLE TRIGGER trg_prevent_update_sales_product_config_versions;

COMMIT;
