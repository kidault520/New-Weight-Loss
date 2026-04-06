-- 为 user_profiles 增加 user_type 字段
-- 用于区分：c_user（C端用户）、salesperson（销售员）、admin（管理员）
-- 登录后根据 user_type 跳转不同应用

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS user_type text
  DEFAULT 'c_user'
  CHECK (user_type IN ('c_user', 'salesperson', 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON user_profiles(user_type);

COMMENT ON COLUMN user_profiles.user_type IS '用户类型：c_user=C端用户，salesperson=销售员，admin=管理员';
