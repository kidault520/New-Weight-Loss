-- 为 delivery_schedules 增加用户和订单号快照列
-- Admin 配送管理展示用户昵称、手机、订单号时优先使用快照，避免 user_profiles/auth 查询失败导致为空

ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_user_nickname text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_user_phone text;
ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS delivery_order_number text;

COMMENT ON COLUMN delivery_schedules.delivery_user_nickname IS '用户昵称快照，创建/更新时写入';
COMMENT ON COLUMN delivery_schedules.delivery_user_phone IS '用户手机快照';
COMMENT ON COLUMN delivery_schedules.delivery_order_number IS '订单号快照';
