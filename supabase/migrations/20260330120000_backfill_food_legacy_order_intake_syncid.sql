-- 一次性回填 health_records（food）：旧版「今日餐 / App 完成摄入」经 saveFoodEntry 写入时无 syncId，
-- 若你平时用 Supabase 网页跑 SQL：请用「先 COUNT、再 UPDATE」的分步脚本：
--   supabase/manual/backfill_legacy_food_syncid_supabase_dashboard.sql
-- 日反馈与营养详情会将其全部算作「加餐」。本迁移仅对高置信度行补 syncId，使其归入早/午/晚。
--
-- 启发式（保守）：
--   - record_type = food，且尚无 syncId；
--   - nutrition_data.mealType 为早/午/晚（中英）；
--   - nutrition_data.source <> 'ai'（避免 AI 快速录入误判为订单同步）；
--   - name 符合客户端写入形态：「早餐|午餐|晚餐」或带「：」前缀（与 TodayMealsCard / handleMealIntakeComplete 一致）。
--
-- syncId 形如 legacy-intake-{uuid}，与真实 order-intake-* 区分，便于审计。
--
-- 回滚：UPDATE health_records SET nutrition_data = nutrition_data - 'syncId'
--       WHERE record_type = 'food' AND nutrition_data->>'syncId' LIKE 'legacy-intake-%';
--       （执行前请先 SELECT 备份受影响行。）

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
