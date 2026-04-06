-- Lock immutable fields for paid orders
-- Goal: prevent post-payment changes from altering historical settlement basis.

CREATE OR REPLACE FUNCTION public.prevent_paid_order_key_field_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce immutability after order has been paid.
  IF OLD.payment_status = 'paid' THEN
    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      RAISE EXCEPTION
        'orders.product_id is immutable after payment (order id=%)',
        OLD.id
        USING ERRCODE = '55000';
    END IF;

    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      RAISE EXCEPTION
        'orders.total_amount is immutable after payment (order id=%)',
        OLD.id
        USING ERRCODE = '55000';
    END IF;

    IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
      RAISE EXCEPTION
        'orders.unit_price is immutable after payment (order id=%)',
        OLD.id
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paid_order_key_field_mutation ON public.orders;
CREATE TRIGGER trg_prevent_paid_order_key_field_mutation
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_order_key_field_mutation();

