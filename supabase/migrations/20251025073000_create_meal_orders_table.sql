/*
  # Create Meal Orders Table

  1. New Tables
    - `meal_orders`
      - `id` (uuid, primary key) - Unique order identifier
      - `user_id` (uuid, foreign key) - References user_profiles
      - `order_date` (timestamptz) - When the order was placed
      - `delivery_location` (text) - Delivery address
      - `order_status` (text) - Status: pending, confirmed, preparing, delivering, delivered, cancelled
      - `total_amount` (numeric) - Total order amount
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

    - `meal_order_items`
      - `id` (uuid, primary key) - Unique item identifier
      - `order_id` (uuid, foreign key) - References meal_orders
      - `delivery_date` (date) - Date for meal delivery
      - `meal_type` (text) - Type: breakfast, lunch, dinner
      - `meal_plan_day` (integer) - Day number in the meal plan (1-30)
      - `status` (text) - Status: pending, preparing, ready, delivered
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own orders
    - Users can only view and modify their own orders

  3. Indexes
    - Add indexes for common query patterns
    - Index on user_id for quick order lookups
    - Index on delivery_date for scheduling queries
*/

-- Create meal_orders table
CREATE TABLE IF NOT EXISTS meal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  order_date timestamptz DEFAULT now() NOT NULL,
  delivery_location text NOT NULL,
  order_status text DEFAULT 'pending' NOT NULL CHECK (order_status IN ('pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled')),
  total_amount numeric(10, 2) DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create meal_order_items table
CREATE TABLE IF NOT EXISTS meal_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES meal_orders(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  meal_plan_day integer CHECK (meal_plan_day >= 1 AND meal_plan_day <= 30),
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'preparing', 'ready', 'delivered')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE meal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_order_items ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meal_orders_user_id ON meal_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_status ON meal_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_meal_orders_created_at ON meal_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_order_items_order_id ON meal_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_meal_order_items_delivery_date ON meal_order_items(delivery_date);
CREATE INDEX IF NOT EXISTS idx_meal_order_items_status ON meal_order_items(status);

-- RLS Policies for meal_orders

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON meal_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own orders
CREATE POLICY "Users can create own orders"
  ON meal_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own orders
CREATE POLICY "Users can update own orders"
  ON meal_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own orders
CREATE POLICY "Users can delete own orders"
  ON meal_orders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for meal_order_items

-- Users can view order items for their orders
CREATE POLICY "Users can view own order items"
  ON meal_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_orders
      WHERE meal_orders.id = meal_order_items.order_id
      AND meal_orders.user_id = auth.uid()
    )
  );

-- Users can create order items for their orders
CREATE POLICY "Users can create own order items"
  ON meal_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_orders
      WHERE meal_orders.id = meal_order_items.order_id
      AND meal_orders.user_id = auth.uid()
    )
  );

-- Users can update order items for their orders
CREATE POLICY "Users can update own order items"
  ON meal_order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_orders
      WHERE meal_orders.id = meal_order_items.order_id
      AND meal_orders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_orders
      WHERE meal_orders.id = meal_order_items.order_id
      AND meal_orders.user_id = auth.uid()
    )
  );

-- Users can delete order items for their orders
CREATE POLICY "Users can delete own order items"
  ON meal_order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_orders
      WHERE meal_orders.id = meal_order_items.order_id
      AND meal_orders.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_meal_orders_updated_at ON meal_orders;
CREATE TRIGGER update_meal_orders_updated_at
  BEFORE UPDATE ON meal_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meal_order_items_updated_at ON meal_order_items;
CREATE TRIGGER update_meal_order_items_updated_at
  BEFORE UPDATE ON meal_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
