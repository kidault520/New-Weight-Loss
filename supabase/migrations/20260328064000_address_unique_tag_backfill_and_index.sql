-- Backfill duplicate active tags, then enforce unique index.
-- Goal:
-- 1) Resolve historical duplicate tags among active addresses (same user + normalized tag)
-- 2) Create unique index to enforce future uniqueness
--
-- Strategy:
-- - Keep one row in each duplicate group (prefer default, then latest updated/created)
-- - Soft-delete the rest (is_deleted=true, set deleted_at/updated_at)
-- - Build unique index on normalized tag for active rows

DO $$
BEGIN
  -- Step 1: soft-delete duplicate active tags (keep best row per group)
  WITH ranked AS (
    SELECT
      id,
      user_id,
      lower(btrim(tag)) AS norm_tag,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, lower(btrim(tag))
        ORDER BY
          COALESCE(is_default, false) DESC,
          updated_at DESC NULLS LAST,
          created_at DESC NULLS LAST,
          id DESC
      ) AS rn
    FROM public.delivery_addresses
    WHERE COALESCE(is_deleted, false) = false
      AND btrim(COALESCE(tag, '')) <> ''
  )
  UPDATE public.delivery_addresses d
  SET
    is_deleted = true,
    deleted_at = COALESCE(d.deleted_at, now()),
    updated_at = now()
  FROM ranked r
  WHERE d.id = r.id
    AND r.rn > 1
    AND COALESCE(d.is_deleted, false) = false;

  -- Step 2: create unique index for active normalized tag
  CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_addresses_user_tag_unique_active
    ON public.delivery_addresses (user_id, lower(btrim(tag)))
    WHERE is_deleted = false
      AND btrim(COALESCE(tag, '')) <> '';
END $$;

