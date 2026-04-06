-- Harden delivery address data guards:
-- 1) tag must be non-empty
-- 2) phone must match CN mainland mobile format
-- 3) unique tag per user among active (not deleted) addresses

-- 1) tag non-empty check (allow legacy rows via NOT VALID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_addresses_tag_not_blank'
  ) THEN
    RAISE NOTICE 'Constraint delivery_addresses_tag_not_blank already exists, skip.';
  ELSE
    ALTER TABLE public.delivery_addresses
      ADD CONSTRAINT delivery_addresses_tag_not_blank
      CHECK (btrim(COALESCE(tag, '')) <> '')
      NOT VALID;
  END IF;
END $$;

-- 2) phone format check (allow legacy rows via NOT VALID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_addresses_phone_cn_valid'
  ) THEN
    RAISE NOTICE 'Constraint delivery_addresses_phone_cn_valid already exists, skip.';
  ELSE
    ALTER TABLE public.delivery_addresses
      ADD CONSTRAINT delivery_addresses_phone_cn_valid
      CHECK (phone ~ '^1[3-9][0-9]{9}$')
      NOT VALID;
  END IF;
END $$;

-- 3) unique tag per user for active addresses
--    Normalization: lower(trim(tag))
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_delivery_addresses_user_tag_active_unique'
  ) THEN
    RAISE NOTICE 'Index idx_delivery_addresses_user_tag_active_unique already exists, skip.';
  ELSIF EXISTS (
    SELECT 1
    FROM public.delivery_addresses
    WHERE COALESCE(is_deleted, false) = false
      AND btrim(COALESCE(tag, '')) <> ''
    GROUP BY user_id, lower(btrim(tag))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skip creating idx_delivery_addresses_user_tag_active_unique: duplicate active tags exist per user. Please clean data first.';
  ELSE
    CREATE UNIQUE INDEX idx_delivery_addresses_user_tag_active_unique
      ON public.delivery_addresses (user_id, lower(btrim(tag)))
      WHERE COALESCE(is_deleted, false) = false
        AND btrim(COALESCE(tag, '')) <> '';
  END IF;
END $$;

-- Optional follow-up after data cleanup:
-- ALTER TABLE public.delivery_addresses VALIDATE CONSTRAINT delivery_addresses_tag_not_blank;
-- ALTER TABLE public.delivery_addresses VALIDATE CONSTRAINT delivery_addresses_phone_cn_valid;
