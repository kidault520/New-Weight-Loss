-- Cleanup extra historical snapshots for default config.
-- Intended for current rollout where only v1/v2/v3 should remain.

DO $$
DECLARE
  current_version integer;
BEGIN
  SELECT COALESCE(version, -1)
  INTO current_version
  FROM public.sales_product_config
  WHERE config_key = 'default'
  LIMIT 1;

  -- Safety guard: only cleanup when current version is within v1-v3.
  IF current_version BETWEEN 1 AND 3 THEN
    DELETE FROM public.sales_product_config_versions
    WHERE config_key = 'default'
      AND version > 3;
  END IF;
END
$$;
