-- 单颗补剂（supplement_products）人类可读编号 SPM + 4 位，便于列表与疗程内选择对照

ALTER TABLE public.supplement_products
  ADD COLUMN IF NOT EXISTS item_code text;

WITH numbered AS (
  SELECT
    id,
    'SPM' || lpad(row_number() OVER (ORDER BY display_order ASC, created_at ASC, id ASC)::text, 4, '0') AS code
  FROM public.supplement_products
)
UPDATE public.supplement_products p
SET item_code = n.code
FROM numbered n
WHERE p.id = n.id
  AND (p.item_code IS NULL OR btrim(p.item_code) = '');

CREATE UNIQUE INDEX IF NOT EXISTS supplement_products_item_code_key ON public.supplement_products (item_code);

ALTER TABLE public.supplement_products
  ALTER COLUMN item_code SET NOT NULL;

COMMENT ON COLUMN public.supplement_products.item_code IS '单颗补剂编号 SPM0001，列表与排期选择展示';
