-- 手动在 Supabase SQL Editor 执行：将 meal_plan_config_data.selected_meal_types 与最近有效已支付订单合约餐次对齐。
-- 与 migrations/20260331130000_backfill_meal_plan_config_selected_meal_types_contract.sql 逻辑一致，可重复执行（仅不一致时更新）。
--
-- 用法：从上到下整段执行。会先出现预览结果 would_update_rows，再执行 UPDATE。
-- 切勿粘贴聊天里带「...」省略的 SQL，否则会报 syntax error at/near "..".

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

-- ========== 预览：将有多少行会被 UPDATE（第一个结果集）==========
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
SELECT
  count(*)::bigint AS would_update_rows
FROM public.user_profiles up
INNER JOIN latest_order_contract loc ON up.user_id = loc.user_id
WHERE up.meal_plan_configured IS TRUE
  AND up.meal_plan_config_data IS NOT NULL
  AND up.meal_plan_config_data ? 'selected_meal_types'
  AND jsonb_typeof(up.meal_plan_config_data->'selected_meal_types') = 'array'
  AND public._backfill_intersect_meal_types_json(
    up.meal_plan_config_data->'selected_meal_types',
    loc.allow_en
  ) IS DISTINCT FROM up.meal_plan_config_data->'selected_meal_types';

-- ========== 正式 UPDATE（第二个语句；成功时可能仍显示 No rows returned，属正常）==========
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

-- ========== 可选：需要列出被更新的 user_id 时，不要跑上面的 UPDATE，只跑下面这一段 ==========
-- WITH latest_order_contract AS (
--   SELECT DISTINCT ON (o.user_id)
--     o.user_id,
--     public._backfill_meal_types_zh_to_en_slots(
--       CASE
--         WHEN o.included_meal_types IS NOT NULL AND cardinality(o.included_meal_types) > 0 THEN
--           o.included_meal_types
--         ELSE
--           COALESCE(mp.included_meal_types, ARRAY['午餐', '晚餐']::text[])
--       END
--     ) AS allow_en
--   FROM public.orders o
--   LEFT JOIN public.products p ON p.id = o.product_id
--   LEFT JOIN public.meal_plans mp ON mp.id = p.meal_plan_id
--   WHERE o.payment_status = 'paid'
--     AND o.order_status IS DISTINCT FROM 'cancelled'
--     AND o.order_status IS DISTINCT FROM 'completed'
--   ORDER BY
--     o.user_id,
--     o.payment_time DESC NULLS LAST,
--     o.created_at DESC NULLS LAST
-- )
-- UPDATE public.user_profiles up
-- SET meal_plan_config_data = jsonb_set(
--   up.meal_plan_config_data,
--   '{selected_meal_types}',
--   public._backfill_intersect_meal_types_json(
--     up.meal_plan_config_data->'selected_meal_types',
--     loc.allow_en
--   ),
--   true
-- )
-- FROM latest_order_contract loc
-- WHERE up.user_id = loc.user_id
--   AND up.meal_plan_configured IS TRUE
--   AND up.meal_plan_config_data IS NOT NULL
--   AND up.meal_plan_config_data ? 'selected_meal_types'
--   AND jsonb_typeof(up.meal_plan_config_data->'selected_meal_types') = 'array'
--   AND public._backfill_intersect_meal_types_json(
--     up.meal_plan_config_data->'selected_meal_types',
--     loc.allow_en
--   ) IS DISTINCT FROM up.meal_plan_config_data->'selected_meal_types'
-- RETURNING up.user_id;

-- ========== 诊断：would_update_rows = 0 时单独执行本节（需已创建上方两个函数）==========
-- 用于判断是「数据已对齐」还是「没有命中用户」（例如无未完结已支付订单）。
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
SELECT
  (SELECT count(*)::bigint FROM public.user_profiles WHERE meal_plan_configured IS TRUE) AS profiles_meal_plan_configured,
  (SELECT count(*)::bigint
   FROM public.user_profiles
   WHERE meal_plan_configured IS TRUE
     AND meal_plan_config_data IS NOT NULL
     AND meal_plan_config_data ? 'selected_meal_types'
     AND jsonb_typeof(meal_plan_config_data->'selected_meal_types') = 'array'
  ) AS profiles_with_selected_meal_types_array,
  (SELECT count(*)::bigint FROM latest_order_contract) AS distinct_users_in_contract_pick,
  (SELECT count(*)::bigint
   FROM public.orders
   WHERE payment_status = 'paid'
     AND order_status IS DISTINCT FROM 'cancelled'
     AND order_status IS DISTINCT FROM 'completed'
  ) AS qualifying_order_rows,
  (SELECT count(*)::bigint
   FROM public.user_profiles up
   INNER JOIN latest_order_contract loc ON up.user_id = loc.user_id
   WHERE up.meal_plan_configured IS TRUE
     AND up.meal_plan_config_data IS NOT NULL
     AND up.meal_plan_config_data ? 'selected_meal_types'
     AND jsonb_typeof(up.meal_plan_config_data->'selected_meal_types') = 'array'
  ) AS overlap_profile_and_contract_user,
  (SELECT count(*)::bigint
   FROM public.user_profiles up
   INNER JOIN latest_order_contract loc ON up.user_id = loc.user_id
   WHERE up.meal_plan_configured IS TRUE
     AND up.meal_plan_config_data IS NOT NULL
     AND up.meal_plan_config_data ? 'selected_meal_types'
     AND jsonb_typeof(up.meal_plan_config_data->'selected_meal_types') = 'array'
     AND public._backfill_intersect_meal_types_json(
       up.meal_plan_config_data->'selected_meal_types',
       loc.allow_en
     ) IS NOT DISTINCT FROM up.meal_plan_config_data->'selected_meal_types'
  ) AS overlap_and_already_aligned_json,
  (SELECT count(*)::bigint
   FROM public.user_profiles up
   INNER JOIN latest_order_contract loc ON up.user_id = loc.user_id
   WHERE up.meal_plan_configured IS TRUE
     AND up.meal_plan_config_data IS NOT NULL
     AND up.meal_plan_config_data ? 'selected_meal_types'
     AND jsonb_typeof(up.meal_plan_config_data->'selected_meal_types') = 'array'
     AND public._backfill_intersect_meal_types_json(
       up.meal_plan_config_data->'selected_meal_types',
       loc.allow_en
     ) IS DISTINCT FROM up.meal_plan_config_data->'selected_meal_types'
  ) AS overlap_but_needs_update_equals_preview;

-- 清理辅助函数（若希望保留供以后重跑，可注释掉下面两行）
-- DROP FUNCTION IF EXISTS public._backfill_intersect_meal_types_json(jsonb, text[]);
-- DROP FUNCTION IF EXISTS public._backfill_meal_types_zh_to_en_slots(text[]);
