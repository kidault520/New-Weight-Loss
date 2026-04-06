/*
  # Add UPDATE Policy to Chat Messages Table

  1. Changes
    - Add UPDATE policy to allow users to update their own chat messages
    - This enables updating quick_entry_data and is_quick_entry_confirmed fields

  2. Security
    - Users can only update their own messages
    - Maintains data isolation between users
*/

-- Policy: Users can update their own chat messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_messages' 
    AND policyname = 'Users can update own chat messages'
  ) THEN
    CREATE POLICY "Users can update own chat messages"
      ON chat_messages
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
