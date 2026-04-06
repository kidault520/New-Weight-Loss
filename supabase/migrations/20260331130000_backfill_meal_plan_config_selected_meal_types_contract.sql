-- 批量将 user_profiles.meal_plan_config_data.selected_meal_types 与「当前用户最近一笔有效已支付订单」的合约餐次求交并写回，
-- 与前端 intersectMealTypesEn + orderMealPlanSlots 语义对齐（订单快照 included_meal_types 优先，否则 meal_plans）。
-- 仅更新 json 与求交结果不一致的行；无符合条件订单的用户不修改。

CREATE OR REPLACE FUNCTION public._backfill_meal_types_zh_to_en_slots(types text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  res text[] := ARRAY[]::text[];
  t text[];
BEGIN
  t := COALESCE(types, ARRAY[]::text[]);
  IF EXISTS (SELECT 1 FROM unnest(t) AS u(x) WHERE trim(u.x) = '早餐') THEN
    res := array_append(res, 'breakfast');
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(t) AS u(x) WHERE trim(u.x) = '午餐') THEN
    res := array_append(res, 'lunch');
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(t) AS u(x) WHERE trim(u.x) = '晚餐') THEN
    res := array_append(res, 'dinner');
  END IF;
  IF cardinality(res) = 0 THEN
    RETURN ARRAY['lunch', 'dinner']::text[];
  END IF;
  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION public._backfill_intersect_meal_types_json(selected jsonb, allow_en text[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  allow_lower text[];
  hit text[];
  r RECORD;
BEGIN
  IF allow_en IS NULL OR cardinality(allow_en) = 0 THEN
    allow_en := ARRAY['lunch', 'dinner']::text[];
  END IF;
  allow_lower := ARRAY(SELECT lower(x::text) FROM unnest(allow_en) AS x);

  hit := ARRAY[]::text[];
  FOR r IN
    SELECT t.value AS elem
    FROM jsonb_array_elements_text(COALESCE(selected, '[]'::jsonb)) WITH ORDINALITY AS t(value, idx)
    ORDER BY idx
  LOOP
    IF lower(r.elem) = ANY (allow_lower) THEN
      hit := array_append(hit, r.elem);
    END IF;
  END LOOP;

  IF cardinality(hit) > 0 THEN
    RETURN to_jsonb(hit);
  END IF;
  RETURN to_jsonb(allow_en);
END;
$$;

WITH latest_order_contract AS (
  SELECT DISTINCT ON (o.user_id)
    o.user_id,
    public._backfill_meal_types_zh_to_en_slots(
      CASE
        WHEN o.included_meal_types IS NOT NULL AND cardinality(o.included_meal_types) > 0 THEN
          o.included_meal_types
        ELSE
          COALESCE(mp.included_meal_types, ARRAY['午餐', '晚餐']::text[])
      END
    ) AS allow_en
  FROM public.orders o
  LEFT JOIN public.products p ON p.id = o.product_id
  LEFT JOIN public.meal_plans mp ON mp.id = p.meal_plan_id
  WHERE o.payment_status = 'paid'
    AND o.order_status IS DISTINCT FROM 'cancelled'
    AND o.order_status IS DISTINCT FROM 'completed'
  ORDER BY
    o.user_id,
    o.payment_time DESC NULLS LAST,
    o.created_at DESC NULLS LAST
)
UPDATE public.user_profiles up
SET meal_plan_config_data = jsonb_set(
  up.meal_plan_config_data,
  '{selected_meal_types}',
  public._backfill_intersect_meal_types_json(
    up.meal_plan_config_data->'selected_meal_types',
    loc.allow_en
  ),
  true
)
FROM latest_order_contract loc
WHERE up.user_id = loc.user_id
  AND up.meal_plan_configured IS TRUE
  AND up.meal_plan_config_data IS NOT NULL
  AND up.meal_plan_config_data ? 'selected_meal_types'
  AND jsonb_typeof(up.meal_plan_config_data->'selected_meal_types') = 'array'
  AND public._backfill_intersect_meal_types_json(
    up.meal_plan_config_data->'selected_meal_types',
    loc.allow_en
  ) IS DISTINCT FROM up.meal_plan_config_data->'selected_meal_types';

DROP FUNCTION IF EXISTS public._backfill_intersect_meal_types_json(jsonb, text[]);
DROP FUNCTION IF EXISTS public._backfill_meal_types_zh_to_en_slots(text[]);
