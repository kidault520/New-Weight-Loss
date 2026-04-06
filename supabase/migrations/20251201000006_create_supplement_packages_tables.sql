/*
  # Create Supplement Packages Tables

  Prerequisites:
    - This migration requires that the `supplement_products` table exists
    - Please ensure `20251201000001_create_content_management_tables.sql` has been executed first

  1. New Tables
    - `supplement_packages` - 补剂套餐表（类似餐食套餐）
    - `supplement_package_items` - 补剂套餐关联表（套餐包含的补剂）

  2. Features
    - 补剂套餐包含多个补剂产品
    - 每个补剂有数量配置
    - 支持套餐启用/禁用

  3. Security
    - Enable RLS on all tables
    - Add policies for admin access only
*/

-- Check if supplement_products table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'supplement_products'
  ) THEN
    RAISE EXCEPTION 'Table "supplement_products" does not exist. Please execute migration 20251201000001_create_content_management_tables.sql first.';
  END IF;
END $$;

-- Supplement packages table (补剂套餐表)
CREATE TABLE IF NOT EXISTS supplement_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  cover_image_url text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Supplement package items table (补剂套餐关联表)
CREATE TABLE IF NOT EXISTS supplement_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES supplement_packages(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES supplement_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(package_id, supplement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplement_packages_code ON supplement_packages(package_code);
CREATE INDEX IF NOT EXISTS idx_supplement_packages_active ON supplement_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_supplement_package_items_package_id ON supplement_package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_supplement_package_items_supplement_id ON supplement_package_items(supplement_id);

-- RLS Policies
ALTER TABLE supplement_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_package_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
-- Admin can manage supplement packages
DROP POLICY IF EXISTS "Admins can manage supplement packages" ON supplement_packages;
CREATE POLICY "Admins can manage supplement packages"
  ON supplement_packages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_content'
    )
  );

-- Public can read active supplement packages
DROP POLICY IF EXISTS "Public can read active supplement packages" ON supplement_packages;
CREATE POLICY "Public can read active supplement packages"
  ON supplement_packages
  FOR SELECT
  USING (is_active = true);

-- Admin can manage supplement package items
DROP POLICY IF EXISTS "Admins can manage supplement package items" ON supplement_package_items;
CREATE POLICY "Admins can manage supplement package items"
  ON supplement_package_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_content'
    )
  );

-- Public can read supplement package items
DROP POLICY IF EXISTS "Public can read supplement package items" ON supplement_package_items;
CREATE POLICY "Public can read supplement package items"
  ON supplement_package_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplement_packages
      WHERE supplement_packages.id = supplement_package_items.package_id
      AND supplement_packages.is_active = true
    )
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_supplement_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_supplement_packages_updated_at ON supplement_packages;
CREATE TRIGGER update_supplement_packages_updated_at
  BEFORE UPDATE ON supplement_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_supplement_packages_updated_at();

