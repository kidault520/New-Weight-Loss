/*
  # Add Quick Entry Card Support to Chat Messages

  1. Schema Changes
    - Add `quick_entry_data` jsonb column to store QuickEntryCard data
    - Add `is_quick_entry_confirmed` boolean column to track card confirmation status
    - Update message_type to support 'quickEntry' type
  
  2. Purpose
    - Enable persistence of health metric detection cards in chat history
    - Store daily counter information with cards
    - Maintain card state across sessions
  
  3. Notes
    - The quick_entry_data will store the complete QuickEntryData interface
    - Cards can be displayed from history with full interactivity
    - Confirmed cards remain in history with their confirmed state
*/

-- Add quick_entry_data column to store card data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'quick_entry_data'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN quick_entry_data jsonb;
  END IF;
END $$;

-- Add is_quick_entry_confirmed column to track confirmation status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'is_quick_entry_confirmed'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN is_quick_entry_confirmed boolean DEFAULT false;
  END IF;
END $$;

-- Update message_type constraint to allow 'quickEntry'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'chat_messages' AND constraint_name = 'chat_messages_message_type_check'
  ) THEN
    ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_message_type_check;
  END IF;

  -- Add new constraint with 'quickEntry' support
  ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
    CHECK (message_type IN ('user', 'ai', 'quickEntry'));
END $$;

-- Add comment to explain the columns
COMMENT ON COLUMN chat_messages.quick_entry_data IS 'Stores QuickEntryCard data including metric type, values, and daily count';
COMMENT ON COLUMN chat_messages.is_quick_entry_confirmed IS 'Tracks whether the quick entry card has been confirmed by user';
