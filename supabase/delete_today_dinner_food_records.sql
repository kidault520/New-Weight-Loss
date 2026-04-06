-- 删除当日 record_type = 'food' 且 nutrition_data->>'mealType' = '晚餐' 的记录
-- 执行前请确认日期范围，默认删除今日

DELETE FROM health_records
WHERE record_type = 'food'
  AND (nutrition_data->>'mealType' = '晚餐' OR nutrition_data->>'mealType' = 'dinner')
  AND recorded_at >= date_trunc('day', now())
  AND recorded_at < date_trunc('day', now()) + interval '1 day';
