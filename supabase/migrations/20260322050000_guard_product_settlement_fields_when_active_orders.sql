-- Guard product settlement fields when active paid orders exist
-- Any update path (API/SQL) will be blocked if product has paid and non-terminal orders.

CREATE OR REPLACE FUNCTION public.prevent_product_settlement_field_mutation_when_active_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_active_paid_order boolean;
BEGIN
  -- Only care when settlement-related fields are changed
  IF
    NEW.price IS DISTINCT FROM OLD.price OR
    NEW.duration_days IS DISTINCT FROM OLD.duration_days OR
    NEW.meal_plan_id IS DISTINCT FROM OLD.meal_plan_id OR
    NEW.supplement_plan_id IS DISTINCT FROM OLD.supplement_plan_id
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.product_id = OLD.id
        AND o.payment_status = 'paid'
        AND COALESCE(o.order_status, '') NOT IN ('cancelled', 'completed')
      LIMIT 1
    ) INTO has_active_paid_order;

    IF has_active_paid_order THEN
      RAISE EXCEPTION
        'product settlement fields are immutable while active paid orders exist (product id=%)',
        OLD.id
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_settlement_fields_when_active_orders ON public.products;
CREATE TRIGGER trg_guard_product_settlement_fields_when_active_orders
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.prevent_product_settlement_field_mutation_when_active_orders();

