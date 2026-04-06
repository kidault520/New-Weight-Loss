-- 若迁移后 delivery_schedules 仍无餐食数据，可手动从 meal_delivery_schedules 迁移
-- 在 Supabase SQL Editor 中执行

-- 1. 检查：先单独执行，看 meal_delivery_schedules 是否存在
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_delivery_schedules') AS 表是否存在;

-- 2. 手动迁移（仅当 meal_delivery_schedules 表存在时执行）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_delivery_schedules') THEN
    INSERT INTO delivery_schedules (
  user_id,
  order_id,
  delivery_type,
  delivery_date,
  delivery_time,
  delivery_time_start,
  delivery_time_end,
  meal_type,
  item_name,
  quantity,
  delivery_address_id,
  status,
  is_locked,
  created_at,
  updated_at
)
SELECT DISTINCT ON (mds.user_id, mds.delivery_date, mds.meal_type)
  mds.user_id,
  NULL,
  'meal',
  mds.delivery_date,
  CASE WHEN mds.delivery_time_start IS NOT NULL AND mds.delivery_time_end IS NOT NULL
       THEN mds.delivery_time_start || '-' || mds.delivery_time_end ELSE NULL END,
  mds.delivery_time_start,
  mds.delivery_time_end,
  mds.meal_type,
  COALESCE(
    CASE mds.meal_type WHEN 'breakfast' THEN '早餐健康餐' WHEN 'lunch' THEN '午餐健康餐' WHEN 'dinner' THEN '晚餐健康餐' ELSE '健康餐' END,
    '健康餐'
  ),
  1,
  mds.delivery_address_id,
  COALESCE(mds.status, 'scheduled'),
  COALESCE(mds.is_locked, false),
  COALESCE(mds.created_at, now()),
  COALESCE(mds.updated_at, now())
FROM meal_delivery_schedules mds
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_schedules ds
  WHERE ds.user_id = mds.user_id
    AND ds.delivery_date = mds.delivery_date
    AND ds.meal_type IS NOT DISTINCT FROM mds.meal_type
    AND ds.order_id IS NULL
)
ORDER BY mds.user_id, mds.delivery_date, mds.meal_type;
    RAISE NOTICE '迁移完成';
  ELSE
    RAISE NOTICE 'meal_delivery_schedules 表不存在，跳过迁移';
  END IF;
END $$;
