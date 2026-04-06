/*
  # 添加手机号和档案创建时间字段

  1. 新增列
    - `phone` (text) - 用户注册的手机号
    - `profile_created_at` (timestamptz) - 健康档案创建时间
  
  2. 说明
    - phone 字段存储用户注册时的手机号,用于安全验证和账户恢复
    - profile_created_at 记录用户首次创建健康档案的时间,不同于 created_at(账户创建时间)
    - profile_created_at 默认值为当前时间,对于已存在的记录,使用 created_at 作为初始值
  
  3. 安全性
    - 所有列继承现有的 RLS 策略
    - phone 字段包含在用户可读取的数据中,但应该在客户端做脱敏处理
*/

-- 添加 phone 列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone text;
    COMMENT ON COLUMN user_profiles.phone IS '用户注册的手机号';
  END IF;
END $$;

-- 添加 profile_created_at 列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'profile_created_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN profile_created_at timestamptz DEFAULT now();
    COMMENT ON COLUMN user_profiles.profile_created_at IS '健康档案创建时间';
  END IF;
END $$;

-- 为已存在的记录设置 profile_created_at 为 created_at 的值
UPDATE user_profiles
SET profile_created_at = created_at
WHERE profile_created_at IS NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_created_at ON user_profiles(profile_created_at);
