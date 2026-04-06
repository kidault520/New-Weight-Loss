-- 订单快照：记录下单时关联餐食疗程的包含餐次，避免后续读取依赖跨表权限
ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS included_meal_types text[];

ALTER TABLE public.meal_plans
  ALTER COLUMN included_meal_types SET DEFAULT ARRAY['午餐', '晚餐']::text[];

UPDATE public.meal_plans
SET included_meal_types = ARRAY['午餐', '晚餐']::text[]
WHERE included_meal_types IS NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS included_meal_types text[];

COMMENT ON COLUMN public.orders.included_meal_types IS
  '订单快照餐次（来自 products.meal_plan_id -> meal_plans.included_meal_types）';

-- 历史订单回填
UPDATE public.orders o
SET included_meal_types = CASE
  WHEN p.meal_plan_id IS NULL THEN NULL
  ELSE COALESCE(mp.included_meal_types, ARRAY['午餐', '晚餐']::text[])
END
FROM public.products p
LEFT JOIN public.meal_plans mp ON mp.id = p.meal_plan_id
WHERE o.product_id = p.id
  AND (
    o.included_meal_types IS NULL
    OR cardinality(o.included_meal_types) = 0
  );

-- 下单/改单时自动写入快照
CREATE OR REPLACE FUNCTION public.set_order_included_meal_types_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_meal_plan_id uuid;
  v_types text[];
BEGIN
  IF NEW.product_id IS NULL THEN
    NEW.included_meal_types := NULL;
    RETURN NEW;
  END IF;

  SELECT meal_plan_id
  INTO v_meal_plan_id
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_meal_plan_id IS NULL THEN
    NEW.included_meal_types := NULL;
    RETURN NEW;
  END IF;

  SELECT included_meal_types
  INTO v_types
  FROM public.meal_plans
  WHERE id = v_meal_plan_id;

  NEW.included_meal_types := COALESCE(v_types, ARRAY['午餐', '晚餐']::text[]);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_included_meal_types_snapshot ON public.orders;

CREATE TRIGGER trg_set_order_included_meal_types_snapshot
BEFORE INSERT OR UPDATE OF product_id
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_included_meal_types_snapshot();
