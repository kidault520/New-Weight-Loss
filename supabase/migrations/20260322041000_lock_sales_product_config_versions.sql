-- Lock immutable sales_product_config_versions snapshots
-- Goal: prevent accidental UPDATE/DELETE on historical snapshots.

CREATE OR REPLACE FUNCTION public.prevent_mutation_sales_product_config_versions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'sales_product_config_versions is append-only. % is not allowed for id=%',
    TG_OP,
    COALESCE(OLD.id, NEW.id)
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_update_sales_product_config_versions ON public.sales_product_config_versions;
CREATE TRIGGER trg_prevent_update_sales_product_config_versions
BEFORE UPDATE ON public.sales_product_config_versions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_mutation_sales_product_config_versions();

DROP TRIGGER IF EXISTS trg_prevent_delete_sales_product_config_versions ON public.sales_product_config_versions;
CREATE TRIGGER trg_prevent_delete_sales_product_config_versions
BEFORE DELETE ON public.sales_product_config_versions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_mutation_sales_product_config_versions();

