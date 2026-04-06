-- 餐食疗程 / 补剂疗程（supplement_plans）人类可读编号，便于与商品、订单侧核对 UUID
-- 餐食：MTP + 4 位数字；补剂计划：STP + 4 位数字（商品 supplement_plan_id 指向此表）

ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS plan_code text;

ALTER TABLE public.supplement_plans
  ADD COLUMN IF NOT EXISTS plan_code text;

-- 按创建顺序回填（已有数据）
WITH numbered AS (
  SELECT
    id,
    'MTP' || lpad(row_number() OVER (ORDER BY created_at ASC, id ASC)::text, 4, '0') AS code
  FROM public.meal_plans
)
UPDATE public.meal_plans m
SET plan_code = n.code
FROM numbered n
WHERE m.id = n.id
  AND (m.plan_code IS NULL OR btrim(m.plan_code) = '');

WITH numbered AS (
  SELECT
    id,
    'STP' || lpad(row_number() OVER (ORDER BY created_at ASC, id ASC)::text, 4, '0') AS code
  FROM public.supplement_plans
)
UPDATE public.supplement_plans p
SET plan_code = n.code
FROM numbered n
WHERE p.id = n.id
  AND (p.plan_code IS NULL OR btrim(p.plan_code) = '');

CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_plan_code_key ON public.meal_plans (plan_code);
CREATE UNIQUE INDEX IF NOT EXISTS supplement_plans_plan_code_key ON public.supplement_plans (plan_code);

ALTER TABLE public.meal_plans
  ALTER COLUMN plan_code SET NOT NULL;

ALTER TABLE public.supplement_plans
  ALTER COLUMN plan_code SET NOT NULL;

COMMENT ON COLUMN public.meal_plans.plan_code IS '餐食疗程编号，如 MTP0001，与商品 meal_plan_id 对齐';
COMMENT ON COLUMN public.supplement_plans.plan_code IS '补剂疗程（计划）编号，如 STP0001，与商品 supplement_plan_id、排期 course_id 对齐';
