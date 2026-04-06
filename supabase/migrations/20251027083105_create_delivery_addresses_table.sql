/*
  # Create Delivery Addresses Table

  1. New Tables
    - `delivery_addresses`
      - `id` (uuid, primary key) - Unique address identifier
      - `user_id` (uuid, foreign key) - References user_profiles
      - `label` (text) - Address label like "家", "公司", "学校"
      - `address` (text) - Full delivery address
      - `door_number` (text) - Detailed door number/room information
      - `contact_name` (text) - Receiver's name
      - `phone` (text) - Contact phone number
      - `gender` (text) - Gender: male or female
      - `tag` (text) - Additional tag for categorization
      - `is_default` (boolean) - Whether this is the default address
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on delivery_addresses table
    - Add policies for authenticated users to manage their own addresses
    - Users can only view and modify their own addresses

  3. Indexes
    - Add index on user_id for quick address lookups
    - Add index on is_default for default address queries

  4. Important Notes
    - Only one address per user can be marked as default
    - The trigger ensures updated_at is automatically updated
    - Phone numbers are stored as text to preserve formatting
*/

-- Create delivery_addresses table
CREATE TABLE IF NOT EXISTS delivery_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  label text NOT NULL,
  address text NOT NULL,
  door_number text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  gender text DEFAULT 'male' NOT NULL CHECK (gender IN ('male', 'female')),
  tag text,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_id ON delivery_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_is_default ON delivery_addresses(is_default);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_created_at ON delivery_addresses(created_at DESC);

-- RLS Policies for delivery_addresses

-- Users can view their own addresses
CREATE POLICY "Users can view own addresses"
  ON delivery_addresses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own addresses
CREATE POLICY "Users can create own addresses"
  ON delivery_addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own addresses
CREATE POLICY "Users can update own addresses"
  ON delivery_addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own addresses
CREATE POLICY "Users can delete own addresses"
  ON delivery_addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_delivery_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_delivery_addresses_updated_at_trigger ON delivery_addresses;
CREATE TRIGGER update_delivery_addresses_updated_at_trigger
  BEFORE UPDATE ON delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_addresses_updated_at();

-- Create function to ensure only one default address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE delivery_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single default address
DROP TRIGGER IF EXISTS enforce_single_default_address ON delivery_addresses;
CREATE TRIGGER enforce_single_default_address
  BEFORE INSERT OR UPDATE ON delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_address();