ALTER TABLE supplement_schedule_stages
ADD COLUMN IF NOT EXISTS supplement_id uuid REFERENCES supplement_products(id),
ADD COLUMN IF NOT EXISTS per_day_qty integer CHECK (per_day_qty > 0);
