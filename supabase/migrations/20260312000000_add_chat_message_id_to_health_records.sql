/*
  # Add chat_message_id to health_records (and legacy exercise_records if still present)

  1. Purpose
    - 建立 QuickEntry 卡片与健康记录的稳定跨表关联
    - 支持按 chat_message_id 精确去重，替代启发式匹配

  2. Changes
    - health_records: 新增 chat_message_id (uuid, 可空, 引用 chat_messages.id) + 索引
    - exercise_records: 仅当表仍存在时执行（历史独立运动表）
      后续 20260323120000 将数据迁入 health_records（record_type = exercise），
      20260324130000 会 DROP exercise_records；迁完后线上不应再存在该表。
      应用侧运动读写见 exerciseService 等 → 统一 health_records。
*/

-- health_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'health_records' AND column_name = 'chat_message_id'
  ) THEN
    ALTER TABLE health_records
    ADD COLUMN chat_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_health_records_chat_message_id
  ON health_records(chat_message_id) WHERE chat_message_id IS NOT NULL;

-- exercise_records：仅存于未跑迁移+下线的旧库；已合并并 DROP 的环境跳过即可
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exercise_records'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exercise_records' AND column_name = 'chat_message_id'
  ) THEN
    ALTER TABLE exercise_records
    ADD COLUMN chat_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exercise_records'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_exercise_records_chat_message_id ON exercise_records(chat_message_id) WHERE chat_message_id IS NOT NULL';
  END IF;
END $$;
