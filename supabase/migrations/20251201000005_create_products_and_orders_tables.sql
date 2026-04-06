/*
  # Create Products and Orders Management Tables

  1. New Tables
    - `products` - 商品表（餐食计划 + 补剂计划的组合）
    - `product_components` - 商品组件关联表（关联餐食计划和补剂计划）
    - `orders` - 订单表（用户购买的商品订单）
    - `order_items` - 订单明细表（订单中的商品明细）
    - `supplement_plans` - 补剂计划表（用于商品管理）
    - `delivery_schedules` - 配送计划表（基于订单生成的配送明细）

  2. Features
    - 商品由餐食计划和补剂计划组成
    - 订单包含支付信息（支付方式、支付金额）
    - 配送计划基于订单生成，包含时间分类和状态

  3. Security
    - Enable RLS on all tables
    - Add policies for admin access only (management)
    - Users can view their own orders
*/

-- Supplement plans table (补剂计划)
CREATE TABLE IF NOT EXISTS supplement_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  description text,
  supplement_data jsonb DEFAULT '{}'::jsonb, -- 补剂配置数据
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Products table (商品表 - 餐食计划 + 补剂计划)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL UNIQUE,
  product_name text NOT NULL,
  description text,
  meal_plan_id uuid REFERENCES meal_plans(id) ON DELETE SET NULL,
  supplement_plan_id uuid REFERENCES supplement_plans(id) ON DELETE SET NULL,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  original_price numeric(10, 2) CHECK (original_price >= 0),
  cover_image_url text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT has_components CHECK (
    meal_plan_id IS NOT NULL OR supplement_plan_id IS NOT NULL
  )
);

-- Orders table (订单表)
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE, -- 订单号
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_amount numeric(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('支付宝', '微信支付', '银行卡', '其他')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
  payment_time timestamptz,
  order_status text NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
  delivery_address_id uuid REFERENCES delivery_addresses(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Order items table (订单明细表 - 存储订单的商品详情)
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('meal_plan', 'supplement_plan')),
  item_id uuid NOT NULL, -- 指向 meal_plan_id 或 supplement_plan_id
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Delivery schedules table (配送计划表)
CREATE TABLE IF NOT EXISTS delivery_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_type text NOT NULL CHECK (delivery_type IN ('meal', 'supplement')),
  delivery_date date NOT NULL,
  delivery_time text, -- 配送时间段，如 "09:00-12:00"
  item_id uuid, -- 关联的具体餐食或补剂ID
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  delivery_address_id uuid REFERENCES delivery_addresses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'preparing', 'shipped', 'delivered', 'cancelled')),
  tracking_number text,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplement_plans_active ON supplement_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_supplement_plans_duration ON supplement_plans(duration_days);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_meal_plan ON products(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_products_supplement_plan ON products(supplement_plan_id);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_type ON order_items(item_type);

CREATE INDEX IF NOT EXISTS idx_delivery_schedules_order_id ON delivery_schedules(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_user_id ON delivery_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_delivery_date ON delivery_schedules(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_status ON delivery_schedules(status);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_type ON delivery_schedules(delivery_type);

-- RLS Policies
ALTER TABLE supplement_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DO $$ 
BEGIN
  -- Supplement plans policies
  DROP POLICY IF EXISTS "Admins can manage supplement plans" ON supplement_plans;
  DROP POLICY IF EXISTS "Public can read active supplement plans" ON supplement_plans;
  
  -- Products policies
  DROP POLICY IF EXISTS "Admins can manage products" ON products;
  DROP POLICY IF EXISTS "Public can read active products" ON products;
  
  -- Orders policies
  DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
  DROP POLICY IF EXISTS "Users can view own orders" ON orders;
  DROP POLICY IF EXISTS "Users can create own orders" ON orders;
  
  -- Order items policies
  DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;
  DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
  
  -- Delivery schedules policies
  DROP POLICY IF EXISTS "Admins can manage all delivery schedules" ON delivery_schedules;
  DROP POLICY IF EXISTS "Users can view own delivery schedules" ON delivery_schedules;
END $$;

-- Admin policies for supplement_plans
DROP POLICY IF EXISTS "Admins can manage supplement plans" ON supplement_plans;
CREATE POLICY "Admins can manage supplement plans"
  ON supplement_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_menu'
    )
  );

-- Public can read active supplement plans
DROP POLICY IF EXISTS "Public can read active supplement plans" ON supplement_plans;
CREATE POLICY "Public can read active supplement plans"
  ON supplement_plans
  FOR SELECT
  USING (is_active = true);

-- Admin policies for products
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products"
  ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_menu'
    )
  );

-- Public can read active products
DROP POLICY IF EXISTS "Public can read active products" ON products;
CREATE POLICY "Public can read active products"
  ON products
  FOR SELECT
  USING (is_active = true);

-- Admin can manage all orders
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
CREATE POLICY "Admins can manage all orders"
  ON orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_orders'
    )
  );

-- Users can view their own orders
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own orders
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
CREATE POLICY "Users can create own orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin can manage all order items
DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;
CREATE POLICY "Admins can manage all order items"
  ON order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_orders'
    )
  );

-- Users can view order items for their orders
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
CREATE POLICY "Users can view own order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Admin can manage all delivery schedules
DROP POLICY IF EXISTS "Admins can manage all delivery schedules" ON delivery_schedules;
CREATE POLICY "Admins can manage all delivery schedules"
  ON delivery_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.permissions ? 'manage_deliveries'
    )
  );

-- Users can view their own delivery schedules
DROP POLICY IF EXISTS "Users can view own delivery schedules" ON delivery_schedules;
CREATE POLICY "Users can view own delivery schedules"
  ON delivery_schedules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Functions and Triggers

-- Function to generate order number (trigger function)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  -- Only generate if order_number is empty or null
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    LOOP
      -- Format: ORD + YYYYMMDD + 6位随机数
      new_number := 'ORD' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
      
      SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO exists_check;
      
      EXIT WHEN NOT exists_check;
    END LOOP;
    
    NEW.order_number := new_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
DROP TRIGGER IF EXISTS auto_generate_order_number ON orders;
CREATE TRIGGER auto_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_supplement_plans_updated_at ON supplement_plans;
CREATE TRIGGER update_supplement_plans_updated_at
  BEFORE UPDATE ON supplement_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

DROP TRIGGER IF EXISTS update_delivery_schedules_updated_at ON delivery_schedules;
CREATE TRIGGER update_delivery_schedules_updated_at
  BEFORE UPDATE ON delivery_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

