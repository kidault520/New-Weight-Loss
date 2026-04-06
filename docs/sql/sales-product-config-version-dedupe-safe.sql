-- sales-product-config-version-dedupe-safe.sql
-- 目的：清理 sales_product_config_versions 中“连续重复保存导致的噪音版本”
-- 规则：仅清理“与前一个版本内容完全一致”的记录（按 config_key + 生效时间/版本排序）
-- 安全性：
-- 1) 先预览再删除
-- 2) 删除前完整备份到 public.sales_product_config_versions_cleanup_backup
-- 3) 支持按时间窗口限制（建议仅清理今天/某次异常时段）

BEGIN;

-- 可选：将这两个时间改成你要清理的窗口（北京时间换算为 UTC 后填写）
-- 不想限制时间窗口可把两个条件去掉。
WITH params AS (
  SELECT
    'default'::text AS p_config_key,
    '2026-03-22 00:00:00+08'::timestamptz AS p_start_time,
    '2026-03-23 00:00:00+08'::timestamptz AS p_end_time
),
ordered AS (
  SELECT
    v.id,
    v.config_key,
    v.version,
    v.effective_at,
    md5(
      COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
      COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
      COALESCE(v.discount_rates, '[]'::jsonb)::text
    ) AS sig,
    lag(
      md5(
        COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
        COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
        COALESCE(v.discount_rates, '[]'::jsonb)::text
      )
    ) OVER (PARTITION BY v.config_key ORDER BY v.effective_at, v.version) AS prev_sig
  FROM public.sales_product_config_versions v
  JOIN params p ON p.p_config_key = v.config_key
),
candidates AS (
  SELECT o.*
  FROM ordered o
  JOIN params p ON true
  WHERE o.sig = o.prev_sig
    AND o.effective_at >= p.p_start_time
    AND o.effective_at < p.p_end_time
)
SELECT
  'preview_candidates' AS section,
  c.config_key,
  c.version,
  c.effective_at,
  c.id
FROM candidates c
ORDER BY c.effective_at, c.version;

-- 预览 2：候选总数
WITH params AS (
  SELECT
    'default'::text AS p_config_key,
    '2026-03-22 00:00:00+08'::timestamptz AS p_start_time,
    '2026-03-23 00:00:00+08'::timestamptz AS p_end_time
),
ordered AS (
  SELECT
    v.id,
    v.config_key,
    v.version,
    v.effective_at,
    md5(
      COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
      COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
      COALESCE(v.discount_rates, '[]'::jsonb)::text
    ) AS sig,
    lag(
      md5(
        COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
        COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
        COALESCE(v.discount_rates, '[]'::jsonb)::text
      )
    ) OVER (PARTITION BY v.config_key ORDER BY v.effective_at, v.version) AS prev_sig
  FROM public.sales_product_config_versions v
  JOIN params p ON p.p_config_key = v.config_key
),
candidates AS (
  SELECT o.*
  FROM ordered o
  JOIN params p ON true
  WHERE o.sig = o.prev_sig
    AND o.effective_at >= p.p_start_time
    AND o.effective_at < p.p_end_time
)
SELECT 'preview_count' AS section, count(*)::int AS candidate_count
FROM candidates;

-- 删除前备份表（永久表）
CREATE TABLE IF NOT EXISTS public.sales_product_config_versions_cleanup_backup (
  backup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_batch text NOT NULL,
  cleanup_reason text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL,
  config_key text NOT NULL,
  version integer NOT NULL,
  effective_at timestamptz NOT NULL,
  categories jsonb NOT NULL,
  product_mappings jsonb NOT NULL,
  discount_rates jsonb NOT NULL,
  created_by_admin_id uuid NULL,
  source text NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL
);

-- 执行删除：仅删除 candidates（连续重复项），且先写备份
WITH params AS (
  SELECT
    'default'::text AS p_config_key,
    '2026-03-22 00:00:00+08'::timestamptz AS p_start_time,
    '2026-03-23 00:00:00+08'::timestamptz AS p_end_time,
    to_char(now(), 'YYYYMMDDHH24MISS') AS p_batch
),
ordered AS (
  SELECT
    v.id,
    v.config_key,
    v.version,
    v.effective_at,
    md5(
      COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
      COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
      COALESCE(v.discount_rates, '[]'::jsonb)::text
    ) AS sig,
    lag(
      md5(
        COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
        COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
        COALESCE(v.discount_rates, '[]'::jsonb)::text
      )
    ) OVER (PARTITION BY v.config_key ORDER BY v.effective_at, v.version) AS prev_sig
  FROM public.sales_product_config_versions v
  JOIN params p ON p.p_config_key = v.config_key
),
candidates AS (
  SELECT o.id
  FROM ordered o
  JOIN params p ON true
  WHERE o.sig = o.prev_sig
    AND o.effective_at >= p.p_start_time
    AND o.effective_at < p.p_end_time
),
backup AS (
  INSERT INTO public.sales_product_config_versions_cleanup_backup (
    cleanup_batch,
    cleanup_reason,
    id,
    config_key,
    version,
    effective_at,
    categories,
    product_mappings,
    discount_rates,
    created_by_admin_id,
    source,
    note,
    created_at
  )
  SELECT
    p.p_batch,
    'dedupe_adjacent_same_config_snapshot',
    v.id,
    v.config_key,
    v.version,
    v.effective_at,
    v.categories,
    v.product_mappings,
    v.discount_rates,
    v.created_by_admin_id,
    v.source,
    v.note,
    v.created_at
  FROM public.sales_product_config_versions v
  JOIN candidates c ON c.id = v.id
  JOIN params p ON true
  RETURNING id
),
del AS (
  DELETE FROM public.sales_product_config_versions v
  USING candidates c
  WHERE v.id = c.id
  RETURNING v.id
)
SELECT
  (SELECT count(*)::int FROM backup) AS backup_rows,
  (SELECT count(*)::int FROM del) AS deleted_rows;

-- 删除后快速校验：是否仍有连续重复（同窗口内）
WITH params AS (
  SELECT
    'default'::text AS p_config_key,
    '2026-03-22 00:00:00+08'::timestamptz AS p_start_time,
    '2026-03-23 00:00:00+08'::timestamptz AS p_end_time
),
ordered AS (
  SELECT
    v.id,
    v.config_key,
    v.version,
    v.effective_at,
    md5(
      COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
      COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
      COALESCE(v.discount_rates, '[]'::jsonb)::text
    ) AS sig,
    lag(
      md5(
        COALESCE(v.categories, '[]'::jsonb)::text || '|' ||
        COALESCE(v.product_mappings, '[]'::jsonb)::text || '|' ||
        COALESCE(v.discount_rates, '[]'::jsonb)::text
      )
    ) OVER (PARTITION BY v.config_key ORDER BY v.effective_at, v.version) AS prev_sig
  FROM public.sales_product_config_versions v
  JOIN params p ON p.p_config_key = v.config_key
),
remaining AS (
  SELECT o.id
  FROM ordered o
  JOIN params p ON true
  WHERE o.sig = o.prev_sig
    AND o.effective_at >= p.p_start_time
    AND o.effective_at < p.p_end_time
)
SELECT 'remaining_adjacent_duplicates' AS section, count(*)::int AS remaining_count
FROM remaining;

COMMIT;

-- 若只想预览，不删除：
-- 1) 先执行到 preview 两段
-- 2) 或者整段执行后把 COMMIT 改为 ROLLBACK
