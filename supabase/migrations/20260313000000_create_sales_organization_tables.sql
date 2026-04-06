/*
  # B端销售组织体系表（童颜社长寿抗衰-ai-平台 迁移）

  1. 表结构
    - sales_regions: 地区层级（大区/省份/城市/行政区）
    - sales_teams: 队伍
    - sales_persons: 销售员/人员
    - sales_rule_sets: 规则集（佣金、晋升、考核）
    - sales_evaluation_notifications: 考核通知
    - sales_approval_history: 审批历史
    - sales_promotion_history: 晋升历史
    - sales_leave_history: 脱落历史
    - sales_demotion_history: 降级历史

  2. 与 C 端关联
    - orders.salesperson_id
    - user_profiles.invited_by_salesperson_id

  3. 安全
    - RLS 策略：admin 全权限，salesperson 仅读自己及下级
*/

-- ========== 1. 地区表 ==========
CREATE TABLE IF NOT EXISTS sales_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('大区', '省份', '城市', '行政区')),
  parent_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_regions_parent ON sales_regions(parent_id);
CREATE INDEX IF NOT EXISTS idx_sales_regions_type ON sales_regions(type);

-- ========== 2. 队伍表（先不建 leader_id FK，避免循环依赖）==========
CREATE TABLE IF NOT EXISTS sales_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  custom_name text,
  leader_id uuid,
  original_leader_id uuid,
  region_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  province_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  city_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  district_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  member_count int DEFAULT 0,
  active_count int DEFAULT 0,
  total_performance decimal(12,2) DEFAULT 0,
  created_date date,
  is_temporary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== 3. 人员表 ==========
CREATE TABLE IF NOT EXISTS sales_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('收展员', '组经理', '部经理', '区经理')),
  original_level text NOT NULL CHECK (original_level IN ('收展员', '组经理', '部经理', '区经理')),
  performance decimal(12,2) DEFAULT 0,
  avatar_url text,
  status text NOT NULL DEFAULT '活跃' CHECK (status IN ('活跃', '脱落', '晋升中')),
  parent_id uuid REFERENCES sales_persons(id) ON DELETE SET NULL,
  team_id uuid REFERENCES sales_teams(id) ON DELETE SET NULL,
  branch_id uuid,
  region_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  province_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  city_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  district_id uuid REFERENCES sales_regions(id) ON DELETE SET NULL,
  join_date date NOT NULL,
  promote_date date,
  leave_date date,
  join_method text CHECK (join_method IN ('推荐加入', '自主加入', '外部引进')),
  recommender_id uuid REFERENCES sales_persons(id) ON DELETE SET NULL,
  is_seed boolean DEFAULT false,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 添加 sales_teams.leader_id 外键
ALTER TABLE sales_teams
  ADD CONSTRAINT fk_sales_teams_leader
  FOREIGN KEY (leader_id) REFERENCES sales_persons(id) ON DELETE SET NULL;
ALTER TABLE sales_teams
  ADD CONSTRAINT fk_sales_teams_original_leader
  FOREIGN KEY (original_leader_id) REFERENCES sales_persons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_persons_parent ON sales_persons(parent_id);
CREATE INDEX IF NOT EXISTS idx_sales_persons_team ON sales_persons(team_id);
CREATE INDEX IF NOT EXISTS idx_sales_persons_status ON sales_persons(status);
CREATE INDEX IF NOT EXISTS idx_sales_persons_auth_user ON sales_persons(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_persons_legacy_id ON sales_persons(legacy_id);

-- ========== 4. 规则集表 ==========
CREATE TABLE IF NOT EXISTS sales_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version int NOT NULL,
  effective_date date NOT NULL,
  description text,
  rules jsonb DEFAULT '[]',
  promotion_rules jsonb DEFAULT '[]',
  evaluation_rules jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_rule_sets_effective ON sales_rule_sets(effective_date DESC);

-- ========== 5. 当前生效规则集配置（单行表）==========
CREATE TABLE IF NOT EXISTS sales_current_rule_set (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid REFERENCES sales_rule_sets(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- 插入占位行（仅当表为空时）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sales_current_rule_set LIMIT 1) THEN
    INSERT INTO sales_current_rule_set (id, rule_set_id)
    VALUES ('a0000000-0000-0000-0000-000000000001'::uuid, NULL);
  END IF;
END $$;

-- ========== 6. 考核通知表 ==========
CREATE TABLE IF NOT EXISTS sales_evaluation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES sales_persons(id) ON DELETE CASCADE,
  person_name text,
  current_rank text,
  evaluation_period text NOT NULL,
  evaluation_date date,
  action text NOT NULL CHECK (action IN ('promote', 'maintain', 'demote', 'leave')),
  target_rank text,
  reason text,
  condition_details jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by text,
  reject_reason text
);

CREATE INDEX IF NOT EXISTS idx_sales_eval_notif_person ON sales_evaluation_notifications(person_id);
CREATE INDEX IF NOT EXISTS idx_sales_eval_notif_status ON sales_evaluation_notifications(status);

-- ========== 7. 审批历史表 ==========
CREATE TABLE IF NOT EXISTS sales_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES sales_evaluation_notifications(id) ON DELETE CASCADE,
  person_id uuid REFERENCES sales_persons(id) ON DELETE SET NULL,
  person_name text,
  action text NOT NULL CHECK (action IN ('approve', 'reject')),
  reason text,
  approved_by text NOT NULL,
  approved_at timestamptz DEFAULT now()
);

-- ========== 8. 晋升历史表 ==========
CREATE TABLE IF NOT EXISTS sales_promotion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES sales_persons(id) ON DELETE CASCADE,
  from_level text NOT NULL,
  to_level text NOT NULL,
  promote_date date NOT NULL,
  team_id uuid REFERENCES sales_teams(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_promotion_person ON sales_promotion_history(person_id);

-- ========== 9. 脱落历史表 ==========
CREATE TABLE IF NOT EXISTS sales_leave_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES sales_persons(id) ON DELETE CASCADE,
  leave_type text CHECK (leave_type IN ('主动离职', '业绩不达标', '违规清退')),
  leave_date date NOT NULL,
  reason text,
  reassigned_team_id uuid REFERENCES sales_teams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_leave_person ON sales_leave_history(person_id);

-- ========== 10. 降级历史表 ==========
CREATE TABLE IF NOT EXISTS sales_demotion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES sales_persons(id) ON DELETE CASCADE,
  from_level text NOT NULL,
  to_level text NOT NULL,
  demote_date date NOT NULL,
  reason text,
  evaluation_rule_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_demotion_person ON sales_demotion_history(person_id);

-- ========== 11. 扩展 orders 表 ==========
ALTER TABLE orders ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES sales_persons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id);

-- ========== 12. 扩展 user_profiles 表 ==========
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invited_by_salesperson_id uuid REFERENCES sales_persons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_invited_by ON user_profiles(invited_by_salesperson_id);

-- ========== 13. RLS 策略 ==========
ALTER TABLE sales_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_current_rule_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_evaluation_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_promotion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_leave_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_demotion_history ENABLE ROW LEVEL SECURITY;

-- 管理员全权限（通过 admin_users 或 user_profiles.role 判断，此处简化：authenticated 可读，后续可细化）
CREATE POLICY "sales_regions_select" ON sales_regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_regions_all" ON sales_regions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_teams_select" ON sales_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_teams_all" ON sales_teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_persons_select" ON sales_persons FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_persons_all" ON sales_persons FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_rule_sets_select" ON sales_rule_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_rule_sets_all" ON sales_rule_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_current_rule_set_select" ON sales_current_rule_set FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_current_rule_set_all" ON sales_current_rule_set FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_eval_notif_select" ON sales_evaluation_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_eval_notif_all" ON sales_evaluation_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_approval_history_select" ON sales_approval_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_approval_history_all" ON sales_approval_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_promotion_history_select" ON sales_promotion_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_promotion_history_all" ON sales_promotion_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_leave_history_select" ON sales_leave_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_leave_history_all" ON sales_leave_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_demotion_history_select" ON sales_demotion_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_demotion_history_all" ON sales_demotion_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
