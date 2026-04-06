/*
  # Create Admin Management System Tables

  Prerequisites:
    - This migration requires Supabase Auth to be enabled
    - The `auth.users` table should exist (it's created automatically by Supabase)

  1. New Tables
    - `admin_roles` - Role definitions for admin users
    - `admin_users` - Admin user accounts (linked to auth.users)
    - `admin_audit_logs` - Audit logs for admin operations

  2. Security
    - Enable RLS on all tables
    - Add policies for admin access only
*/

-- Check if auth.users table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'Table "auth.users" does not exist. Please ensure Supabase Auth is enabled.';
  END IF;
END $$;

-- Admin roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add foreign key constraint separately (if not exists)
DO $$ 
DECLARE
  fk_exists boolean;
  auth_table_exists boolean;
  auth_id_exists boolean;
BEGIN
  -- Check if auth.users table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'users'
  ) INTO auth_table_exists;
  
  IF NOT auth_table_exists THEN
    RAISE EXCEPTION 'Table "auth.users" does not exist. Please ensure Supabase Auth is enabled.';
  END IF;
  
  -- Check if auth.users.id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users'
    AND column_name = 'id'
  ) INTO auth_id_exists;
  
  IF NOT auth_id_exists THEN
    RAISE EXCEPTION 'Column "auth.users.id" does not exist.';
  END IF;
  
  -- Check if foreign key constraint already exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'admin_users'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) INTO fk_exists;
  
  IF NOT fk_exists THEN
    -- Add foreign key constraint using dynamic SQL to ensure schema resolution
    BEGIN
      -- Use EXECUTE format to properly resolve auth schema
      EXECUTE format('
        ALTER TABLE public.admin_users
        ADD CONSTRAINT admin_users_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES %I.%I(id) 
        ON DELETE CASCADE
      ', 'auth', 'users');
      
      RAISE NOTICE 'Foreign key constraint added successfully';
    EXCEPTION WHEN OTHERS THEN
      -- Provide detailed error information
      RAISE EXCEPTION 'Failed to add foreign key constraint. Error: %. SQLSTATE: %. auth.users table exists: %, auth.users.id column exists: %', 
        SQLERRM, SQLSTATE, auth_table_exists, auth_id_exists;
    END;
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

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

-- System can insert audit logs (via service role)
-- Note: Service role bypasses RLS, so we don't need an INSERT policy

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






