/*
  # Create Menu Management Tables

  1. New Tables
    - `dishes` - Dish/food items catalog
    - `meal_packages` - Meal package/combos
    - `package_items` - Relationship between packages and dishes

  2. Features
    - Automatic nutrition calculation for meal packages
    - Support for multiple production methods per dish
    - Active/inactive status for dishes and packages

  3. Security
    - Enable RLS on all tables
    - Add policies for admin access only (menu management)
    - Public read access for active items (for frontend)
*/

-- Dishes table
CREATE TABLE IF NOT EXISTS dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_code text NOT NULL UNIQUE,
  name text NOT NULL,
  image_url text,
  dish_type text NOT NULL CHECK (dish_type IN ('主食', '主荤菜', '副荤菜', '主素菜', '副素菜', '饮品', '汤')),
  cuisine text,
  flavor text,
  production_methods jsonb DEFAULT '[]'::jsonb,
  weight_g numeric(10, 2),
  edible_weight_g numeric(10, 2),
  carbohydrate_g numeric(10, 2) DEFAULT 0,
  protein_g numeric(10, 2) DEFAULT 0,
  fat_g numeric(10, 2) DEFAULT 0,
  fiber_g numeric(10, 2) DEFAULT 0,
  calories_kcal numeric(10, 2) DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Meal packages table
CREATE TABLE IF NOT EXISTS meal_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code text NOT NULL UNIQUE,
  name text NOT NULL,
  package_type text NOT NULL CHECK (package_type IN ('早餐', '午餐', '晚餐')),
  cover_image_url text,
  supply_date date,
  total_carbohydrate_g numeric(10, 2) DEFAULT 0,
  total_protein_g numeric(10, 2) DEFAULT 0,
  total_fat_g numeric(10, 2) DEFAULT 0,
  total_fiber_g numeric(10, 2) DEFAULT 0,
  total_weight_g numeric(10, 2) DEFAULT 0,
  total_calories_kcal numeric(10, 2) DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Package items table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES meal_packages(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1 NOT NULL CHECK (quantity > 0),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dishes_dish_code ON dishes(dish_code);
CREATE INDEX IF NOT EXISTS idx_dishes_dish_type ON dishes(dish_type);
CREATE INDEX IF NOT EXISTS idx_dishes_cuisine ON dishes(cuisine);
CREATE INDEX IF NOT EXISTS idx_dishes_is_active ON dishes(is_active);
CREATE INDEX IF NOT EXISTS idx_dishes_created_at ON dishes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_packages_package_code ON meal_packages(package_code);
CREATE INDEX IF NOT EXISTS idx_meal_packages_package_type ON meal_packages(package_type);
CREATE INDEX IF NOT EXISTS idx_meal_packages_supply_date ON meal_packages(supply_date);
CREATE INDEX IF NOT EXISTS idx_meal_packages_is_active ON meal_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_meal_packages_created_at ON meal_packages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_package_items_dish_id ON package_items(dish_id);
CREATE INDEX IF NOT EXISTS idx_package_items_sort_order ON package_items(sort_order);

-- Enable Row Level Security
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dishes
-- Public can read active dishes
DROP POLICY IF EXISTS "Public can read active dishes" ON dishes;
CREATE POLICY "Public can read active dishes"
  ON dishes FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can read all dishes
DROP POLICY IF EXISTS "Admins can read all dishes" ON dishes;
CREATE POLICY "Admins can read all dishes"
  ON dishes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins with menu management permission can modify
DROP POLICY IF EXISTS "Admins can manage dishes" ON dishes;
CREATE POLICY "Admins can manage dishes"
  ON dishes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (
        admin_users.role = 'super_admin' 
        OR admin_users.role = 'admin' 
        OR admin_users.role = 'content_manager'
        OR (admin_users.permissions->>'manage_menu')::boolean = true
      )
    )
  );

-- RLS Policies for meal_packages
-- Public can read active packages
DROP POLICY IF EXISTS "Public can read active meal packages" ON meal_packages;
CREATE POLICY "Public can read active meal packages"
  ON meal_packages FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can read all packages
DROP POLICY IF EXISTS "Admins can read all meal packages" ON meal_packages;
CREATE POLICY "Admins can read all meal packages"
  ON meal_packages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins with menu management permission can modify
DROP POLICY IF EXISTS "Admins can manage meal packages" ON meal_packages;
CREATE POLICY "Admins can manage meal packages"
  ON meal_packages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (
        admin_users.role = 'super_admin' 
        OR admin_users.role = 'admin' 
        OR admin_users.role = 'content_manager'
        OR (admin_users.permissions->>'manage_menu')::boolean = true
      )
    )
  );

-- RLS Policies for package_items
-- Admins can read package items
DROP POLICY IF EXISTS "Admins can read package items" ON package_items;
CREATE POLICY "Admins can read package items"
  ON package_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins with menu management permission can modify
DROP POLICY IF EXISTS "Admins can manage package items" ON package_items;
CREATE POLICY "Admins can manage package items"
  ON package_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (
        admin_users.role = 'super_admin' 
        OR admin_users.role = 'admin' 
        OR admin_users.role = 'content_manager'
        OR (admin_users.permissions->>'manage_menu')::boolean = true
      )
    )
  );

-- Function to calculate and update package nutrition totals
CREATE OR REPLACE FUNCTION calculate_package_nutrition(package_uuid uuid)
RETURNS void AS $$
DECLARE
  total_carb numeric := 0;
  total_protein numeric := 0;
  total_fat numeric := 0;
  total_fiber numeric := 0;
  total_weight numeric := 0;
  total_calories numeric := 0;
BEGIN
  -- Calculate totals from all package items
  SELECT 
    COALESCE(SUM(d.carbohydrate_g * pi.quantity), 0),
    COALESCE(SUM(d.protein_g * pi.quantity), 0),
    COALESCE(SUM(d.fat_g * pi.quantity), 0),
    COALESCE(SUM(d.fiber_g * pi.quantity), 0),
    COALESCE(SUM(d.weight_g * pi.quantity), 0),
    COALESCE(SUM(d.calories_kcal * pi.quantity), 0)
  INTO total_carb, total_protein, total_fat, total_fiber, total_weight, total_calories
  FROM package_items pi
  JOIN dishes d ON d.id = pi.dish_id
  WHERE pi.package_id = package_uuid;

  -- Update package with calculated totals
  UPDATE meal_packages
  SET 
    total_carbohydrate_g = total_carb,
    total_protein_g = total_protein,
    total_fat_g = total_fat,
    total_fiber_g = total_fiber,
    total_weight_g = total_weight,
    total_calories_kcal = total_calories,
    updated_at = now()
  WHERE id = package_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to recalculate package nutrition when items change
CREATE OR REPLACE FUNCTION trigger_recalculate_package_nutrition()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle both INSERT and UPDATE
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_package_nutrition(OLD.package_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_package_nutrition(NEW.package_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for package_items
DROP TRIGGER IF EXISTS recalculate_package_nutrition_on_insert ON package_items;
CREATE TRIGGER recalculate_package_nutrition_on_insert
  AFTER INSERT ON package_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_package_nutrition();

DROP TRIGGER IF EXISTS recalculate_package_nutrition_on_update ON package_items;
CREATE TRIGGER recalculate_package_nutrition_on_update
  AFTER UPDATE ON package_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_package_nutrition();

DROP TRIGGER IF EXISTS recalculate_package_nutrition_on_delete ON package_items;
CREATE TRIGGER recalculate_package_nutrition_on_delete
  AFTER DELETE ON package_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_package_nutrition();

-- Also trigger when dish nutrition values change
CREATE OR REPLACE FUNCTION trigger_recalculate_packages_on_dish_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate nutrition for all packages containing this dish
  PERFORM calculate_package_nutrition(package_id)
  FROM package_items
  WHERE dish_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalculate_packages_on_dish_nutrition_change ON dishes;
CREATE TRIGGER recalculate_packages_on_dish_nutrition_change
  AFTER UPDATE OF carbohydrate_g, protein_g, fat_g, fiber_g, calories_kcal, weight_g ON dishes
  FOR EACH ROW
  WHEN (
    OLD.carbohydrate_g IS DISTINCT FROM NEW.carbohydrate_g OR
    OLD.protein_g IS DISTINCT FROM NEW.protein_g OR
    OLD.fat_g IS DISTINCT FROM NEW.fat_g OR
    OLD.fiber_g IS DISTINCT FROM NEW.fiber_g OR
    OLD.calories_kcal IS DISTINCT FROM NEW.calories_kcal OR
    OLD.weight_g IS DISTINCT FROM NEW.weight_g
  )
  EXECUTE FUNCTION trigger_recalculate_packages_on_dish_update();

-- Create or replace updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on dishes
DROP TRIGGER IF EXISTS update_dishes_updated_at ON dishes;
CREATE TRIGGER update_dishes_updated_at
  BEFORE UPDATE ON dishes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create triggers for updated_at on meal_packages
DROP TRIGGER IF EXISTS update_meal_packages_updated_at ON meal_packages;
CREATE TRIGGER update_meal_packages_updated_at
  BEFORE UPDATE ON meal_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


