-- Keep settlement snapshots immutable (append-only).

CREATE OR REPLACE FUNCTION public.prevent_mutation_order_settlement_snapshots()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'order_settlement_snapshots is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_order_settlement_snapshots_prevent_update ON public.order_settlement_snapshots;
CREATE TRIGGER trg_order_settlement_snapshots_prevent_update
BEFORE UPDATE ON public.order_settlement_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.prevent_mutation_order_settlement_snapshots();

DROP TRIGGER IF EXISTS trg_order_settlement_snapshots_prevent_delete ON public.order_settlement_snapshots;
CREATE TRIGGER trg_order_settlement_snapshots_prevent_delete
BEFORE DELETE ON public.order_settlement_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.prevent_mutation_order_settlement_snapshots();

