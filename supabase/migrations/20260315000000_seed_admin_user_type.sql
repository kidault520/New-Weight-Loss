-- 将已有 admin_users 中的用户同步到 user_profiles.user_type
-- 先确保 user_type 列存在，再更新

-- 1. 添加 user_type 列（若不存在）
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS user_type text
  DEFAULT 'c_user'
  CHECK (user_type IN ('c_user', 'salesperson', 'admin'));

-- 2. 若 admin_users 存在，同步 admin 到 user_profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN
    UPDATE user_profiles up
    SET user_type = 'admin'
    FROM admin_users au
    WHERE up.user_id = au.user_id
      AND (up.user_type IS NULL OR up.user_type = 'c_user');
  END IF;
END $$;

-- 可选：手动指定某个邮箱为 admin（替换为实际邮箱后执行）
-- UPDATE user_profiles SET user_type = 'admin'
-- WHERE id IN (SELECT id FROM auth.users WHERE email = 'admin@example.com');
