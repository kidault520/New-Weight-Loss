-- Fix: make address checks apply to active rows only.
-- Reason:
-- Historical soft-deleted rows may contain empty tag/invalid phone and block VALIDATE.
-- Business rule should constrain active addresses (is_deleted=false), not deleted history.

-- 1) Rebuild tag required constraint (active rows only)
ALTER TABLE public.delivery_addresses
  DROP CONSTRAINT IF EXISTS delivery_addresses_tag_required;

ALTER TABLE public.delivery_addresses
  ADD CONSTRAINT delivery_addresses_tag_required
  CHECK (
    COALESCE(is_deleted, false) = true
    OR btrim(COALESCE(tag, '')) <> ''
  )
  NOT VALID;

-- 2) Rebuild phone format constraint (active rows only)
ALTER TABLE public.delivery_addresses
  DROP CONSTRAINT IF EXISTS delivery_addresses_phone_cn_valid;

ALTER TABLE public.delivery_addresses
  ADD CONSTRAINT delivery_addresses_phone_cn_valid
  CHECK (
    COALESCE(is_deleted, false) = true
    OR phone ~ '^1[3-9][0-9]{9}$'
  )
  NOT VALID;

-- 3) Validate only when active rows are clean
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.delivery_addresses
    WHERE COALESCE(is_deleted, false) = false
      AND btrim(COALESCE(tag, '')) = ''
  ) THEN
    RAISE NOTICE 'Skip validate delivery_addresses_tag_required: active rows with empty tag still exist.';
  ELSE
    ALTER TABLE public.delivery_addresses
      VALIDATE CONSTRAINT delivery_addresses_tag_required;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.delivery_addresses
    WHERE COALESCE(is_deleted, false) = false
      AND (
        phone IS NULL
        OR phone !~ '^1[3-9][0-9]{9}$'
      )
  ) THEN
    RAISE NOTICE 'Skip validate delivery_addresses_phone_cn_valid: active rows with invalid phone still exist.';
  ELSE
    ALTER TABLE public.delivery_addresses
      VALIDATE CONSTRAINT delivery_addresses_phone_cn_valid;
  END IF;
END $$;
