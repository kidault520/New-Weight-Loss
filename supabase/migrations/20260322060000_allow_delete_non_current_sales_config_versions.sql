-- Allow deleting non-current sales config versions.
-- Keep UPDATE blocked and protect current active version from DELETE.

CREATE OR REPLACE FUNCTION public.prevent_mutation_sales_product_config_versions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_version integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'sales_product_config_versions is immutable. UPDATE is not allowed for id=%',
      COALESCE(OLD.id, NEW.id)
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(version, -1)
    INTO current_version
    FROM public.sales_product_config
    WHERE config_key = COALESCE(OLD.config_key, 'default')
    LIMIT 1;

    IF COALESCE(OLD.version, -1) = COALESCE(current_version, -1) THEN
      RAISE EXCEPTION
        'current active sales_product_config_version cannot be deleted (version=%)',
        OLD.version
        USING ERRCODE = '55000';
    END IF;

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

