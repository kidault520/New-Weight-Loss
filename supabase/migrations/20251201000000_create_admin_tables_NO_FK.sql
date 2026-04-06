/*
  # Create Admin Management System Tables (No Foreign Key to auth.users)

  这是一个备用版本，不依赖 auth.users 表的外键约束
  如果 auth.users 表不存在，可以使用这个版本

  注意：这个版本失去了与 auth.users 的数据完整性保障，
  建议在生产环境中确保 auth.users 表存在后使用原版本。

  1. New Tables
    - `admin_roles` - Role definitions for admin users
    - `admin_users` - Admin user accounts (no FK to auth.users)
    - `admin_audit_logs` - Audit logs for admin operations

  2. Security
    - Enable RLS on all tables
    - Add policies for admin access only
*/

-- Admin roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Admin users table (无外键约束版本)
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,  -- 注意：移除了 REFERENCES auth.users(id)
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Admin audit logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_roles
-- Only admins can view roles
CREATE POLICY "Admins can view roles"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Only super admins can modify roles
CREATE POLICY "Super admins can modify roles"
  ON admin_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (admin_users.role = 'super_admin' OR (admin_users.permissions->>'manage_roles')::boolean = true)
    )
  );

-- RLS Policies for admin_users
-- Admins can view other admins
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

-- Admins can view their own record
CREATE POLICY "Admins can view own record"
  ON admin_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only super admins can create/update/delete admin users
CREATE POLICY "Super admins can manage admin users"
  ON admin_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (admin_users.role = 'super_admin' OR (admin_users.permissions->>'manage_admins')::boolean = true)
    )
  );

-- RLS Policies for admin_audit_logs
-- Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_roles_updated_at'
  ) THEN
    CREATE TRIGGER update_admin_roles_updated_at
      BEFORE UPDATE ON admin_roles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_users_updated_at'
  ) THEN
    CREATE TRIGGER update_admin_users_updated_at
      BEFORE UPDATE ON admin_users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Insert default roles
INSERT INTO admin_roles (role_name, permissions, description) VALUES
  ('super_admin', '{"manage_users": true, "manage_content": true, "manage_admins": true, "manage_roles": true, "view_statistics": true, "manage_config": true}'::jsonb, 'Super administrator with all permissions'),
  ('admin', '{"manage_users": true, "manage_content": true, "view_statistics": true}'::jsonb, 'Standard administrator'),
  ('content_manager', '{"manage_content": true}'::jsonb, 'Content manager with content editing permissions'),
  ('support', '{"manage_users": true, "view_statistics": true}'::jsonb, 'Support staff with user management permissions')
ON CONFLICT (role_name) DO NOTHING;





