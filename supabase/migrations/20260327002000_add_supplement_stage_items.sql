CREATE TABLE IF NOT EXISTS supplement_schedule_stage_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES supplement_schedule_stages(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES supplement_products(id) ON DELETE RESTRICT,
  per_day_qty integer NOT NULL DEFAULT 1 CHECK (per_day_qty > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supp_stage_items_stage ON supplement_schedule_stage_items(stage_id);
CREATE INDEX IF NOT EXISTS idx_supp_stage_items_supplement ON supplement_schedule_stage_items(supplement_id);
