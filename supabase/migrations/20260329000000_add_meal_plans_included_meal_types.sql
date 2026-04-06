-- 餐食疗程：每日包含餐次（早餐/午餐/晚餐），至少一项；历史数据默认午餐+晚餐
ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS included_meal_types text[];

UPDATE public.meal_plans
SET included_meal_types = ARRAY['午餐', '晚餐']::text[]
WHERE included_meal_types IS NULL;

ALTER TABLE public.meal_plans
  ALTER COLUMN included_meal_types SET NOT NULL;

ALTER TABLE public.meal_plans
  ALTER COLUMN included_meal_types SET DEFAULT ARRAY['午餐', '晚餐']::text[];

COMMENT ON COLUMN public.meal_plans.included_meal_types IS '每日包含餐次：早餐、午餐、晚餐，至少一项';

ALTER TABLE public.meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_included_meal_types_nonempty;

ALTER TABLE public.meal_plans
  ADD CONSTRAINT meal_plans_included_meal_types_nonempty
  CHECK (cardinality(included_meal_types) >= 1);

ALTER TABLE public.meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_included_meal_types_allowed;

ALTER TABLE public.meal_plans
  ADD CONSTRAINT meal_plans_included_meal_types_allowed
  CHECK (included_meal_types <@ ARRAY['早餐', '午餐', '晚餐']::text[]);

-- 明确将「7天减脂」类计划设为午餐+晚餐（与默认一致，便于后续检索/审计）
UPDATE public.meal_plans
SET included_meal_types = ARRAY['午餐', '晚餐']::text[]
WHERE plan_name LIKE '%7天%减脂%'
   OR plan_name LIKE '%7日%减脂%';
