-- =============================================================================
-- health_records 结构核查（Supabase Dashboard → SQL Editor）
-- 若某段返回 0 行，请看段末说明。
-- =============================================================================

-- A) 表是否存在 + 全部列（应有 user_id, record_type, value；还应有 chat_message_id）
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'health_records'
ORDER BY ordinal_position;

-- B) 该表上**所有** CHECK 约束（名称不一定是 health_records_record_type_check）
SELECT c.conname AS constraint_name,
       pg_get_constraintdef(c.oid) AS constraint_def
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'health_records'
  AND c.contype = 'c'
ORDER BY c.conname;

-- C) 仅当仓库迁移已采用固定约束名时才有行；0 行 = 线上约束名不同，以查询 B 为准
SELECT pg_get_constraintdef(c.oid) AS constraint_def
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'health_records'
  AND c.conname = 'health_records_record_type_check';

-- -----------------------------------------------------------------------------
-- 结果说明
-- · 查询 A 返回 0 行：public.health_records 不存在或不在 public（极少见）。
-- · 查询 A 无 chat_message_id：未跑 20260312000000_add_chat_message_id_to_health_records，
--   客户端对 chat_message_id 过滤可能 400（PGRST204）。
-- · 查询 B 的 CHECK 里若没有 food / supplement：需跑仓库中较新的 record_type 迁移
--   （如 20251202000000 及 20260403120000_health_records_add_supplement_record_type.sql）。
-- · 查询 C 无行：正常，只要 B 里已有含 food 等的 CHECK 即可。
-- -----------------------------------------------------------------------------
