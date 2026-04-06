-- Resequence sales_product_config versions to dense numbers (v1, v2, v3...)
-- Applies to real DB values (not only UI display), ordered by effective_at asc.

BEGIN;

CREATE TEMP TABLE tmp_sales_config_version_map AS
SELECT
  v.id,
  v.config_key,
  v.version AS old_version,
  ROW_NUMBER() OVER (
    PARTITION BY v.config_key
    ORDER BY v.effective_at ASC, v.version ASC, v.created_at ASC, v.id ASC
  )::integer AS new_version
FROM public.sales_product_config_versions v;

-- Temporarily disable UPDATE guard trigger so resequencing can run.
ALTER TABLE public.sales_product_config_versions
  DISABLE TRIGGER trg_prevent_update_sales_product_config_versions;

-- Two-step update to avoid unique index collisions on (config_key, version).
UPDATE public.sales_product_config_versions v
SET version = m.new_version + 1000000
FROM tmp_sales_config_version_map m
WHERE v.id = m.id;

UPDATE public.sales_product_config_versions v
SET version = m.new_version
FROM tmp_sales_config_version_map m
WHERE v.id = m.id;

-- Align current config version with resequenced snapshot version.
UPDATE public.sales_product_config c
SET version = m.new_version
FROM tmp_sales_config_version_map m
WHERE c.config_key = m.config_key
  AND c.version = m.old_version;

ALTER TABLE public.sales_product_config_versions
  ENABLE TRIGGER trg_prevent_update_sales_product_config_versions;

COMMIT;
