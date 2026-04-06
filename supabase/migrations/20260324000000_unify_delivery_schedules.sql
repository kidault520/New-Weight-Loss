-- 统一配送计划表：合并 meal_delivery_schedules 与 delivery_schedules
-- 支持 C端配置、B端管理、三方配送 API 对接（骑手、实时位置等）
-- 设计文档：docs/delivery-schedules-unified-design.md

-- 1. 扩展 delivery_schedules 表
-- 1.1 order_id 改为可空（C端配置时可能尚未关联订单）
ALTER TABLE delivery_schedules ALTER COLUMN order_id DROP NOT NULL;

-- 1.2 item_name 改为可空（迁移时可为空，后续由业务填充）
ALTER TABLE delivery_schedules ALTER COLUMN item_name DROP NOT NULL;

-- 1.3 新增 C端字段
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner'));
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_time_start text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_time_end text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false NOT NULL;

-- 1.4 新增地址快照（配送时展示，避免地址变更影响历史）
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_address_label text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_contact_name text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_contact_phone text;

-- 1.5 新增三方配送字段
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS external_order_id text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_provider text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS estimated_arrival_time timestamptz;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS rider_id text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS rider_name text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS rider_phone text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS rider_lat numeric;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS rider_lng numeric;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS rider_position_updated_at timestamptz;

-- 1.6 扩展 status 约束（兼容现有）
ALTER TABLE delivery_schedules DROP CONSTRAINT IF EXISTS delivery_schedules_status_check;
ALTER TABLE delivery_schedules ADD CONSTRAINT delivery_schedules_status_check
  CHECK (status IN ('pending', 'scheduled', 'preparing', 'shipped', 'delivered', 'cancelled'));

-- 1.7 扩展 delivery_type 约束（保持 meal/supplement）
ALTER TABLE delivery_schedules DROP CONSTRAINT IF EXISTS delivery_schedules_delivery_type_check;
ALTER TABLE delivery_schedules ADD CONSTRAINT delivery_schedules_delivery_type_check
  CHECK (delivery_type IN ('meal', 'supplement'));

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_meal_type ON delivery_schedules(meal_type);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_delivery_provider ON delivery_schedules(delivery_provider);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_external_order_id ON delivery_schedules(external_order_id);

-- 3. 餐食级唯一约束：同一用户同一天同一餐次仅一条
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_schedules_user_date_meal_unique
  ON delivery_schedules (user_id, delivery_date, meal_type)
  WHERE meal_type IS NOT NULL;

-- 4. 从 meal_delivery_schedules 迁移数据（若表存在，去重插入）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'meal_delivery_schedules'
  ) THEN
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
      CASE
        WHEN mds.delivery_time_start IS NOT NULL AND mds.delivery_time_end IS NOT NULL
        THEN mds.delivery_time_start || '-' || mds.delivery_time_end
        ELSE NULL
      END,
      mds.delivery_time_start,
      mds.delivery_time_end,
      mds.meal_type,
      COALESCE(
        CASE mds.meal_type
          WHEN 'breakfast' THEN '早餐健康餐'
          WHEN 'lunch' THEN '午餐健康餐'
          WHEN 'dinner' THEN '晚餐健康餐'
          ELSE '健康餐'
        END,
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
  END IF;
END $$;

-- 5. 迁移完成后需更新代码使用 delivery_schedules（见 deliveryScheduleService、addressService、server/routes）

-- 6. 可选：确认无误后删除 meal_delivery_schedules 表
-- DROP TABLE IF EXISTS meal_delivery_schedules;

COMMENT ON COLUMN delivery_schedules.order_id IS '关联订单，C端配置时可为空';
COMMENT ON COLUMN delivery_schedules.meal_type IS '餐次：breakfast/lunch/dinner，餐食时必填';
COMMENT ON COLUMN delivery_schedules.is_locked IS 'C端：用户是否锁定该餐次';
COMMENT ON COLUMN delivery_schedules.delivery_provider IS '配送商：meituan/eleme/custom';
COMMENT ON COLUMN delivery_schedules.rider_lat IS '骑手纬度，三方 API 实时位置';
COMMENT ON COLUMN delivery_schedules.rider_lng IS '骑手经度，三方 API 实时位置';
