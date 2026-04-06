-- =============================================================================
-- Supabase 网页：Dashboard → SQL Editor 中按顺序执行（不要与 migration 重复 UPDATE）
-- =============================================================================
-- 若你已通过 `supabase db push` 或迁移流水线跑过
--   20260330120000_backfill_food_legacy_order_intake_syncid.sql
-- 则不要再执行下面的「③ 正式更新」，否则会尝试写入已存在的 syncId（WHERE 会筛掉已有的行，实际 0 行更新，无害但多余）。
-- =============================================================================

-- ① 命中条数（与迁移 WHERE 完全一致）
SELECT count(*) AS rows_to_update
FROM public.health_records
WHERE record_type = 'food'
  AND nutrition_data IS NOT NULL
  AND jsonb_typeof(nutrition_data) = 'object'
  AND (nutrition_data->>'syncId' IS NULL OR btrim(nutrition_data->>'syncId') = '')
  AND (nutrition_data->>'mealType') IN (
    '早餐', '午餐', '晚餐',
    'breakfast', 'lunch', 'dinner'
  )
  AND COALESCE(btrim(nutrition_data->>'source'), '') <> 'ai'
  AND (
    (nutrition_data->>'name') ~ '^(早餐|午餐|晚餐)(：|$)'
    OR (nutrition_data->>'name') IN ('早餐', '午餐', '晚餐')
    OR (nutrition_data->>'name') ~* '^(breakfast|lunch|dinner)(:|$)'
    OR lower(btrim(COALESCE(nutrition_data->>'name', ''))) IN ('breakfast', 'lunch', 'dinner')
  );

-- ② 样本预览（可选，改 LIMIT）
SELECT
  id,
  user_id,
  recorded_at,
  nutrition_data->>'mealType' AS meal_type,
  nutrition_data->>'name' AS name,
  nutrition_data->>'source' AS source,
  nutrition_data->>'syncId' AS sync_id_before
FROM public.health_records
WHERE record_type = 'food'
  AND nutrition_data IS NOT NULL
  AND jsonb_typeof(nutrition_data) = 'object'
  AND (nutrition_data->>'syncId' IS NULL OR btrim(nutrition_data->>'syncId') = '')
  AND (nutrition_data->>'mealType') IN (
    '早餐', '午餐', '晚餐',
    'breakfast', 'lunch', 'dinner'
  )
  AND COALESCE(btrim(nutrition_data->>'source'), '') <> 'ai'
  AND (
    (nutrition_data->>'name') ~ '^(早餐|午餐|晚餐)(：|$)'
    OR (nutrition_data->>'name') IN ('早餐', '午餐', '晚餐')
    OR (nutrition_data->>'name') ~* '^(breakfast|lunch|dinner)(:|$)'
    OR lower(btrim(COALESCE(nutrition_data->>'name', ''))) IN ('breakfast', 'lunch', 'dinner')
  )
ORDER BY recorded_at DESC
LIMIT 50;

-- ③ 正式更新（与迁移内 UPDATE 相同；确认 ① 的数字后再执行）
UPDATE public.health_records
SET nutrition_data = nutrition_data || jsonb_build_object('syncId', 'legacy-intake-' || id::text)
WHERE record_type = 'food'
  AND nutrition_data IS NOT NULL
  AND jsonb_typeof(nutrition_data) = 'object'
  AND (nutrition_data->>'syncId' IS NULL OR btrim(nutrition_data->>'syncId') = '')
  AND (nutrition_data->>'mealType') IN (
    '早餐', '午餐', '晚餐',
    'breakfast', 'lunch', 'dinner'
  )
  AND COALESCE(btrim(nutrition_data->>'source'), '') <> 'ai'
  AND (
    (nutrition_data->>'name') ~ '^(早餐|午餐|晚餐)(：|$)'
    OR (nutrition_data->>'name') IN ('早餐', '午餐', '晚餐')
    OR (nutrition_data->>'name') ~* '^(breakfast|lunch|dinner)(:|$)'
    OR lower(btrim(COALESCE(nutrition_data->>'name', ''))) IN ('breakfast', 'lunch', 'dinner')
  );

-- ④ 回滚（仅在误跑需要撤销时；执行前请再 SELECT 确认）
-- UPDATE public.health_records
-- SET nutrition_data = nutrition_data - 'syncId'
-- WHERE record_type = 'food'
--   AND nutrition_data->>'syncId' LIKE 'legacy-intake-%';
