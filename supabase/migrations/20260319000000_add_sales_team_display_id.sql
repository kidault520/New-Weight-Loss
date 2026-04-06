-- 战队组织 display_id：统一格式 team-YYMMDD-regionCode001（如 team-260315-hd001）
-- 编号(code) 统一为 TXXXXXX（6位数字），由应用层生成
ALTER TABLE sales_teams ADD COLUMN IF NOT EXISTS display_id text;

CREATE INDEX IF NOT EXISTS idx_sales_teams_display_id ON sales_teams(display_id) WHERE display_id IS NOT NULL;
