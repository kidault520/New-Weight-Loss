/*
  # Fix user_profiles RLS policies to use user_id instead of id

  **Critical Bug Fix**: The RLS policies were checking `id = auth.uid()` but should check `user_id = auth.uid()`
  
  ## Problem
  - The `user_profiles` table has:
    - `id`: Primary key (auto-generated UUID)
    - `user_id`: Foreign key to auth.users (the actual user identifier)
  - RLS policies were incorrectly checking `id = auth.uid()` which would never match
  - This caused all INSERT/UPDATE operations to fail with permission errors
  
  ## Solution
  - Drop existing incorrect RLS policies
  - Create new policies that correctly check `user_id = auth.uid()`
  
  ## Changes
  1. Drop all existing RLS policies on user_profiles
  2. Create corrected INSERT policy: Users can insert their own profile
  3. Create corrected SELECT policy: Users can read their own profile  
  4. Create corrected UPDATE policy: Users can update their own profile
  
  ## Security
  - RLS remains enabled
  - All policies restrict access to authenticated users
  - Each user can only access their own profile data
*/

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create corrected INSERT policy
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create corrected SELECT policy
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create corrected UPDATE policy
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
