/*
  # Create Category Management Tables

  1. New Tables
    - `food_categories` - Food categories for food library
    - `exercise_categories` - Exercise categories for exercise library

  2. Features
    - Support for category name, description, icon
    - Display order for sorting
    - Active/inactive status
    - System categories vs custom categories

  3. Security
    - Enable RLS on all tables
    - Add policies for admin access (management)
    - Public read access for active categories
*/

-- Food Categories table
CREATE TABLE IF NOT EXISTS food_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  display_order integer DEFAULT 0,
  is_system boolean DEFAULT false NOT NULL, -- System categories cannot be deleted
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Exercise Categories table
CREATE TABLE IF NOT EXISTS exercise_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  display_order integer DEFAULT 0,
  is_system boolean DEFAULT false NOT NULL, -- System categories cannot be deleted
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_food_categories_display_order ON food_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_food_categories_is_active ON food_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_food_categories_is_system ON food_categories(is_system);

CREATE INDEX IF NOT EXISTS idx_exercise_categories_display_order ON exercise_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_exercise_categories_is_active ON exercise_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_exercise_categories_is_system ON exercise_categories(is_system);

-- Enable Row Level Security
ALTER TABLE food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for food_categories
-- Public read access for active categories
CREATE POLICY "Public can view active food categories"
  ON food_categories FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage food categories"
  ON food_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- RLS Policies for exercise_categories
-- Public read access for active categories
CREATE POLICY "Public can view active exercise categories"
  ON exercise_categories FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage exercise categories"
  ON exercise_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_food_categories_updated_at
  BEFORE UPDATE ON food_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercise_categories_updated_at
  BEFORE UPDATE ON exercise_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial food categories (system categories)
INSERT INTO food_categories (name, description, display_order, is_system, is_active) VALUES
('自定义', '用户自定义食物', 1, true, true),
('收藏', '用户收藏的食物', 2, true, true),
('常用', '常用食物', 3, true, true),
('库迪', '库迪品牌食物', 4, true, true),
('瑞幸', '瑞幸品牌食物', 5, true, true),
('主食杂粮', '主食和杂粮类', 6, true, true),
('肉蛋奶', '肉类、蛋类和奶制品', 7, true, true),
('蔬果', '蔬菜和水果', 8, true, true),
('海鲜水产', '海鲜和水产品', 9, true, true),
('豆类坚果', '豆类和坚果', 10, true, true),
('中西菜肴', '中式和西式菜肴', 11, true, true),
('零食饮料', '零食和饮料', 12, true, true)
ON CONFLICT (name) DO NOTHING;

-- Insert initial exercise categories (system categories)
INSERT INTO exercise_categories (name, description, display_order, is_system, is_active) VALUES
('自定义', '用户自定义运动', 1, true, true),
('收藏', '用户收藏的运动', 2, true, true),
('常用', '常用运动', 3, true, true),
('有氧', '有氧运动', 4, true, true),
('力量', '力量训练', 5, true, true),
('塑形', '塑形运动', 6, true, true),
('球类', '球类运动', 7, true, true),
('户外', '户外运动', 8, true, true),
('室内', '室内运动', 9, true, true),
('基础', '基础运动', 10, true, true),
('竞技', '竞技运动', 11, true, true)
ON CONFLICT (name) DO NOTHING;














