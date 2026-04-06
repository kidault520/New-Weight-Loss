/*
  # Create User Devices Table

  1. New Tables
    - `user_devices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `device_name` (text) - Name of the device
      - `device_type` (text) - Type of device (e.g., 'fitness_tracker', 'smart_watch', 'smart_scale')
      - `brand` (text) - Device brand (e.g., 'Apple', 'Fitbit', 'Xiaomi')
      - `model` (text) - Device model
      - `connection_status` (text) - Status: 'connected', 'disconnected', 'error'
      - `last_sync_at` (timestamptz) - Last successful sync timestamp
      - `connected_at` (timestamptz) - When device was first connected
      - `sync_frequency` (text) - Sync frequency setting
      - `synced_metrics` (text[]) - Array of metrics synced from device
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `user_devices` table
    - Add policy for users to read their own devices
    - Add policy for users to insert their own devices
    - Add policy for users to update their own devices
    - Add policy for users to delete their own devices
*/

CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_name text NOT NULL,
  device_type text NOT NULL DEFAULT 'fitness_tracker',
  brand text,
  model text,
  connection_status text NOT NULL DEFAULT 'connected',
  last_sync_at timestamptz,
  connected_at timestamptz DEFAULT now(),
  sync_frequency text DEFAULT 'automatic',
  synced_metrics text[] DEFAULT ARRAY['steps', 'heart_rate', 'sleep'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own devices"
  ON user_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON user_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON user_devices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON user_devices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_status ON user_devices(connection_status);