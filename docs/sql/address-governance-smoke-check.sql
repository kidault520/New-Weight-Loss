-- Address governance smoke check
-- Scope: active addresses only (is_deleted=false)
-- Usage: run whole file; first query returns PASS/FAIL summary.

-- 1) Overall summary
WITH c AS (
  SELECT
    MAX(CASE WHEN conname = 'delivery_addresses_tag_required' AND convalidated THEN 1 ELSE 0 END) AS tag_required,
    MAX(CASE WHEN conname = 'delivery_addresses_phone_cn_valid' AND convalidated THEN 1 ELSE 0 END) AS phone_valid
  FROM pg_constraint
),
i AS (
  SELECT
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'delivery_addresses'
        AND indexname = 'idx_delivery_addresses_user_tag_unique_active'
    ) THEN 1 ELSE 0 END AS unique_index
),
bad_tag AS (
  SELECT COUNT(*)::int AS bad_tag_rows
  FROM public.delivery_addresses
  WHERE COALESCE(is_deleted, false) = false
    AND btrim(COALESCE(tag, '')) = ''
),
bad_phone AS (
  SELECT COUNT(*)::int AS bad_phone_rows
  FROM public.delivery_addresses
  WHERE COALESCE(is_deleted, false) = false
    AND (phone IS NULL OR phone !~ '^1[3-9][0-9]{9}$')
),
dup_tag AS (
  SELECT COUNT(*)::int AS dup_tag_groups
  FROM (
    SELECT user_id, lower(btrim(tag)) AS norm_tag
    FROM public.delivery_addresses
    WHERE COALESCE(is_deleted, false) = false
      AND btrim(COALESCE(tag, '')) <> ''
    GROUP BY user_id, lower(btrim(tag))
    HAVING COUNT(*) > 1
  ) t
)
SELECT
  CASE
    WHEN c.tag_required = 1
      AND c.phone_valid = 1
      AND i.unique_index = 1
      AND bad_tag.bad_tag_rows = 0
      AND bad_phone.bad_phone_rows = 0
      AND dup_tag.dup_tag_groups = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS overall_status,
  c.tag_required,
  c.phone_valid,
  i.unique_index,
  bad_tag.bad_tag_rows,
  bad_phone.bad_phone_rows,
  dup_tag.dup_tag_groups
FROM c, i, bad_tag, bad_phone, dup_tag;

-- 2) Constraint validation detail
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('delivery_addresses_tag_required', 'delivery_addresses_phone_cn_valid')
ORDER BY conname;

-- 3) Unique index existence detail
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'delivery_addresses'
  AND indexname = 'idx_delivery_addresses_user_tag_unique_active';

-- 4) Active dirty rows detail: empty tag
SELECT id, user_id, tag, is_deleted
FROM public.delivery_addresses
WHERE COALESCE(is_deleted, false) = false
  AND btrim(COALESCE(tag, '')) = '';

-- 5) Active dirty rows detail: invalid phone
SELECT id, user_id, phone, is_deleted
FROM public.delivery_addresses
WHERE COALESCE(is_deleted, false) = false
  AND (phone IS NULL OR phone !~ '^1[3-9][0-9]{9}$');

-- 6) Duplicate active tag groups detail
SELECT
  user_id,
  lower(btrim(tag)) AS norm_tag,
  COUNT(*) AS cnt,
  ARRAY_AGG(id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC) AS ids
FROM public.delivery_addresses
WHERE COALESCE(is_deleted, false) = false
  AND btrim(COALESCE(tag, '')) <> ''
GROUP BY user_id, lower(btrim(tag))
HAVING COUNT(*) > 1
ORDER BY cnt DESC, user_id;
