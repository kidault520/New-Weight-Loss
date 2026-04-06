-- 配送治理 P0/P1：锁定时间、审计日志、回调幂等、地址软删除

-- 1) delivery_schedules 增加 locked_at（锁定时间独立字段）
ALTER TABLE IF EXISTS public.delivery_schedules
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_delivery_schedules_locked_at
  ON public.delivery_schedules (locked_at DESC);

-- 2) delivery_addresses 软删除字段
ALTER TABLE IF EXISTS public.delivery_addresses
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_active
  ON public.delivery_addresses (user_id, is_deleted, created_at DESC);

-- 3) 配送审计日志表
CREATE TABLE IF NOT EXISTS public.delivery_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_audit_logs_user_created
  ON public.delivery_audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_audit_logs_entity
  ON public.delivery_audit_logs (entity_type, entity_id, created_at DESC);

ALTER TABLE public.delivery_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own delivery audit logs" ON public.delivery_audit_logs;
CREATE POLICY "Users can read own delivery audit logs"
  ON public.delivery_audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own delivery audit logs" ON public.delivery_audit_logs;
CREATE POLICY "Users can insert own delivery audit logs"
  ON public.delivery_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4) 三方回调事件幂等表
CREATE TABLE IF NOT EXISTS public.delivery_callback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL,
  event_type text,
  payload jsonb,
  schedule_id uuid REFERENCES public.delivery_schedules(id),
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_delivery_callback_events_provider_key
  ON public.delivery_callback_events (provider, event_key);

CREATE INDEX IF NOT EXISTS idx_delivery_callback_events_schedule
  ON public.delivery_callback_events (schedule_id, created_at DESC);

ALTER TABLE public.delivery_callback_events ENABLE ROW LEVEL SECURITY;
