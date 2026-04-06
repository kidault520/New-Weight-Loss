-- Relax product mutation guard:
-- allow price changes even when active paid orders exist,
-- but still block service-structure changes.

CREATE OR REPLACE FUNCTION public.prevent_product_settlement_field_mutation_when_active_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_active_paid_order boolean;
BEGIN
  -- Only guard service-structure fields
  IF
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
        'product service structure fields are immutable while active paid orders exist (product id=%)',
        OLD.id
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

