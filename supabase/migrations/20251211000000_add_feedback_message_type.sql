/*
  # Add feedback message type to chat_messages

  1. Purpose
    - Support feedback notification messages (e.g. "已完成XX记录", "已同步热量")
    - These messages persist in the chat flow like other message types

  2. Schema Changes
    - Update message_type CHECK constraint to include 'feedback'
*/

DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'chat_messages' AND constraint_name = 'chat_messages_message_type_check'
  ) THEN
    ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_message_type_check;
  END IF;

  -- Add new constraint with 'feedback' support
  ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
    CHECK (message_type IN ('user', 'ai', 'quickEntry', 'feedback'));
END $$;

COMMENT ON COLUMN chat_messages.message_type IS 'user: 用户消息, ai: AI回复, quickEntry: 待确认数据卡片, feedback: 反馈通知';
