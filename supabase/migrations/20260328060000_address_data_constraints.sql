-- Address data constraints hardening (tag uniqueness + phone format + non-empty tag)
-- Goal:
-- 1) Enforce non-empty tag for new/updated rows
-- 2) Enforce mainland China phone format for new/updated rows
-- 3) Enforce unique tag per user among active (is_deleted=false) addresses
--
-- Notes:
-- - Constraints are added as NOT VALID first to avoid breaking historical dirty data.
-- - New writes are still checked immediately after constraint creation.
-- - Validation is attempted only when historical data is clean.

-- 1) tag must be non-empty (for new writes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_addresses_tag_required'
  ) THEN
    ALTER TABLE public.delivery_addresses
      ADD CONSTRAINT delivery_addresses_tag_required
      CHECK (btrim(COALESCE(tag, '')) <> '')
      NOT VALID;
  END IF;
END $$;

-- Try to validate if historical rows are already clean
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_addresses_tag_required'
      AND convalidated = false
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.delivery_addresses
      WHERE btrim(COALESCE(tag, '')) = ''
    ) THEN
      RAISE NOTICE 'Skip validate delivery_addresses_tag_required: historical rows with empty tag still exist.';
    ELSE
      ALTER TABLE public.delivery_addresses
        VALIDATE CONSTRAINT delivery_addresses_tag_required;
    END IF;
  END IF;
END $$;

-- 2) phone must match mainland CN mobile format: 1[3-9] + 9 digits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_addresses_phone_cn_valid'
  ) THEN
    ALTER TABLE public.delivery_addresses
      ADD CONSTRAINT delivery_addresses_phone_cn_valid
      CHECK (phone ~ '^1[3-9][0-9]{9}$')
      NOT VALID;
  END IF;
END $$;

-- Try to validate if historical rows are already clean
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_addresses_phone_cn_valid'
      AND convalidated = false
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.delivery_addresses
      WHERE phone IS NULL
         OR phone !~ '^1[3-9][0-9]{9}$'
    ) THEN
      RAISE NOTICE 'Skip validate delivery_addresses_phone_cn_valid: historical rows with invalid phone still exist.';
    ELSE
      ALTER TABLE public.delivery_addresses
        VALIDATE CONSTRAINT delivery_addresses_phone_cn_valid;
    END IF;
  END IF;
END $$;

-- 3) unique tag per user for active addresses (case-insensitive, trim-aware)
DO $$
DECLARE
  has_dup boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT user_id, lower(btrim(tag)) AS norm_tag, COUNT(*) AS cnt
      FROM public.delivery_addresses
      WHERE is_deleted = false
        AND btrim(COALESCE(tag, '')) <> ''
      GROUP BY user_id, lower(btrim(tag))
      HAVING COUNT(*) > 1
    ) t
  ) INTO has_dup;

  IF has_dup THEN
    RAISE NOTICE 'Skip unique index idx_delivery_addresses_user_tag_unique_active: duplicate active tags exist.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_addresses_user_tag_unique_active
      ON public.delivery_addresses (user_id, lower(btrim(tag)))
      WHERE is_deleted = false
        AND btrim(COALESCE(tag, '')) <> '';
  END IF;
END $$;
