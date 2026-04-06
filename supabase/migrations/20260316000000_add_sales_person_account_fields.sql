-- 收展员独立ID、手机号、激活状态
-- display_id: 独立展示ID，格式 S+8位数字，与 code 1:1 对应
-- phone: 手机号，销售默认登录账号
-- password_hash: 密码哈希
-- is_activated: 是否已激活（首次登录后为 true）

ALTER TABLE sales_persons
  ADD COLUMN IF NOT EXISTS display_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone text UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS is_activated boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sales_persons_display_id ON sales_persons(display_id);
CREATE INDEX IF NOT EXISTS idx_sales_persons_phone ON sales_persons(phone);

COMMENT ON COLUMN sales_persons.display_id IS '独立展示ID，格式 S+8位数字，与 code 1:1 对应';
COMMENT ON COLUMN sales_persons.phone IS '手机号，销售默认登录账号';
COMMENT ON COLUMN sales_persons.password_hash IS '密码哈希（bcrypt）';
COMMENT ON COLUMN sales_persons.is_activated IS '是否已激活（首次登录后为 true）';
