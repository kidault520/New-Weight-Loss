/*
  # Create Content Management Tables

  Prerequisites:
    - This migration requires that the `admin_users` table exists
    - Please ensure `20251201000000_create_admin_tables.sql` has been executed first

  1. New Tables
    - `content_templates` - Generic content templates (AI prompts, health advice, etc.)
    - `supplement_products` - Supplement product catalog
    - `nutrition_solution_content` - Nutrition solution page content
    - `system_config` - System configuration settings

  2. Security
    - Enable RLS on all tables
    - Add policies for admin access
    - Public read access for active content (for frontend)
*/

-- Check if admin_users table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_users'
  ) THEN
    RAISE EXCEPTION 'Table "admin_users" does not exist. Please execute migration 20251201000000_create_admin_tables.sql first.';
  END IF;
END $$;

-- Content templates table
CREATE TABLE IF NOT EXISTS content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('ai_prompts', 'nutrition_templates', 'health_advice', 'meal_plans', 'exercise_templates', 'assessment_questions')),
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Supplement products table
CREATE TABLE IF NOT EXISTS supplement_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  dosage text,
  frequency text,
  supplement_type text DEFAULT 'general',
  icon_path text DEFAULT '/buji.png',
  tags jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Nutrition solution content table
CREATE TABLE IF NOT EXISTS nutrition_solution_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_type text NOT NULL CHECK (section_type IN ('supplement', 'diet', 'lifestyle')),
  content_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- System config table
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(content_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_supplement_products_active ON supplement_products(is_active);
CREATE INDEX IF NOT EXISTS idx_supplement_products_order ON supplement_products(display_order);
CREATE INDEX IF NOT EXISTS idx_nutrition_solution_type ON nutrition_solution_content(section_type);
CREATE INDEX IF NOT EXISTS idx_nutrition_solution_active ON nutrition_solution_content(is_active);
CREATE INDEX IF NOT EXISTS idx_nutrition_solution_order ON nutrition_solution_content(display_order);

-- Enable Row Level Security
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_solution_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_templates
-- Public can read active templates
CREATE POLICY "Public can read active content templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can read all templates
CREATE POLICY "Admins can read all content templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins with content management permission can modify
CREATE POLICY "Admins can manage content templates"
  ON content_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (admin_users.role = 'super_admin' OR admin_users.role = 'admin' OR admin_users.role = 'content_manager' OR (admin_users.permissions->>'manage_content')::boolean = true)
    )
  );

-- RLS Policies for supplement_products
-- Public can read active products
CREATE POLICY "Public can read active supplement products"
  ON supplement_products FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can read all products
CREATE POLICY "Admins can read all supplement products"
  ON supplement_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins with content management permission can modify
CREATE POLICY "Admins can manage supplement products"
  ON supplement_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (admin_users.role = 'super_admin' OR admin_users.role = 'admin' OR admin_users.role = 'content_manager' OR (admin_users.permissions->>'manage_content')::boolean = true)
    )
  );

-- RLS Policies for nutrition_solution_content
-- Public can read active content
CREATE POLICY "Public can read active nutrition solution content"
  ON nutrition_solution_content FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can read all content
CREATE POLICY "Admins can read all nutrition solution content"
  ON nutrition_solution_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins with content management permission can modify
CREATE POLICY "Admins can manage nutrition solution content"
  ON nutrition_solution_content FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (admin_users.role = 'super_admin' OR admin_users.role = 'admin' OR admin_users.role = 'content_manager' OR (admin_users.permissions->>'manage_content')::boolean = true)
    )
  );

-- RLS Policies for system_config
-- Admins can read config
CREATE POLICY "Admins can read system config"
  ON system_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Only super admins and admins with config permission can modify
CREATE POLICY "Admins can manage system config"
  ON system_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (admin_users.role = 'super_admin' OR admin_users.role = 'admin' OR (admin_users.permissions->>'manage_config')::boolean = true)
    )
  );

-- Create triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_content_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_content_templates_updated_at
      BEFORE UPDATE ON content_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_supplement_products_updated_at'
  ) THEN
    CREATE TRIGGER update_supplement_products_updated_at
      BEFORE UPDATE ON supplement_products
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_nutrition_solution_content_updated_at'
  ) THEN
    CREATE TRIGGER update_nutrition_solution_content_updated_at
      BEFORE UPDATE ON nutrition_solution_content
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_system_config_updated_at'
  ) THEN
    CREATE TRIGGER update_system_config_updated_at
      BEFORE UPDATE ON system_config
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;






