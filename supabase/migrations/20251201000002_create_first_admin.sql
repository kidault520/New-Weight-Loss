/*
  # Create First Admin User Helper Function
  
  This migration creates a function that can be used to create the first admin user
  by temporarily bypassing RLS using SECURITY DEFINER.
  
  Usage:
  SELECT create_first_admin('USER_ID_HERE', 'super_admin');
  
  Or directly insert (if running as service role):
  INSERT INTO admin_users (user_id, role, permissions, is_active)
  VALUES ('USER_ID_HERE', 'super_admin', '{}'::jsonb, true);
*/

-- Function to create first admin (bypasses RLS)
CREATE OR REPLACE FUNCTION create_first_admin(
  p_user_id uuid,
  p_role text DEFAULT 'super_admin'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Insert admin user (bypasses RLS because of SECURITY DEFINER)
  INSERT INTO admin_users (user_id, role, permissions, is_active)
  VALUES (p_user_id, p_role, '{}'::jsonb, true)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    role = p_role,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_first_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_first_admin(uuid, text) TO anon;


