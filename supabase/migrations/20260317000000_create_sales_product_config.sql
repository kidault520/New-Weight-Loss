-- B端商品配置表（品类、商品映射、折算率）
CREATE TABLE IF NOT EXISTS sales_product_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL DEFAULT 'default',
  categories jsonb DEFAULT '[]',
  product_mappings jsonb DEFAULT '[]',
  discount_rates jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 插入默认行（固定ID便于upsert）
INSERT INTO sales_product_config (id, config_key, categories, product_mappings, discount_rates)
VALUES ('a0000000-0000-0000-0000-000000000010'::uuid, 'default', '[]', '[]', '[]')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE sales_product_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_product_config_select" ON sales_product_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_product_config_all" ON sales_product_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
