const express = require('express');
const { supabase, supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * Admin login
 * POST /api/admin/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    

    // Create a new client instance for this login request to avoid session conflicts
    const { createClient } = require('@supabase/supabase-js');
    const loginClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Sign in with Supabase Auth (use regular client, not admin client)
    const { data: authData, error: authError } = await loginClient.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      logger.error('Login error:', { 
        email, 
        error: authError?.message, 
        errorCode: authError?.status,
        hasUser: !!authData?.user,
        hasData: !!authData
      });
      return res.status(401).json({ 
        error: 'Invalid email or password',
        details: process.env.NODE_ENV === 'development' ? authError?.message : undefined
      });
    }

    // Check if user is an admin
    // First check if user exists in admin_users table at all
    const { data: adminUserCheck, error: checkError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (checkError) {
      logger.error('Error checking admin user:', {
        userId: authData.user.id,
        email: authData.user.email,
        error: checkError.message,
        code: checkError.code
      });
      await loginClient.auth.signOut();
      return res.status(500).json({ 
        error: 'Failed to check admin status',
        details: process.env.NODE_ENV === 'development' ? checkError.message : undefined
      });
    }

    // If user doesn't exist in admin_users table
    if (!adminUserCheck) {
      logger.warn('User attempted admin login but not in admin_users table:', {
        userId: authData.user.id,
        email: authData.user.email
      });
      await loginClient.auth.signOut();
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        hint: 'This user is not registered as an admin. Please contact a system administrator.'
      });
    }

    // If user exists but is not active
    if (!adminUserCheck.is_active) {
      logger.warn('User attempted admin login but account is inactive:', {
        userId: authData.user.id,
        email: authData.user.email,
        adminId: adminUserCheck.id
      });
      await loginClient.auth.signOut();
      return res.status(403).json({ 
        error: 'Access denied. Admin account is inactive.',
        hint: 'Your admin account has been deactivated. Please contact a system administrator.'
      });
    }

    // User is an active admin
    const adminUser = adminUserCheck;

    // Get role permissions from admin_roles table
    let permissions = adminUser.permissions || {};
    if (adminUser.role) {
      const { data: roleData } = await supabaseAdmin
        .from('admin_roles')
        .select('permissions')
        .eq('role_name', adminUser.role)
        .single();
      
      if (roleData && roleData.permissions) {
        permissions = { ...roleData.permissions, ...permissions };
      }
    }

    // Update last login time
    await supabaseAdmin
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminUser.id);

    // Log audit
    await supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_id: adminUser.id,
        action: 'LOGIN',
        resource_type: 'auth',
        details: {
          email,
          ip_address: req.ip || req.connection.remoteAddress
        },
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('user-agent')
      });

    res.json({
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        admin: {
          id: adminUser.id,
          role: adminUser.role,
          permissions
        }
      },
      session: authData.session
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Admin logout
 * POST /api/admin/auth/logout
 */
router.post('/logout', authenticateAdmin, async (req, res) => {
  try {
    // Log audit
    await supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_id: req.admin.id,
        action: 'LOGOUT',
        resource_type: 'auth',
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('user-agent')
      });

    // Sign out from Supabase (use regular client for user session)
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Admin logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Get current admin user info
 * GET /api/admin/auth/me
 */
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    
    // Get role information
    const { data: roleData } = await supabaseAdmin
      .from('admin_roles')
      .select('*')
      .eq('role_name', req.admin.role)
      .single();

    // Merge permissions
    let permissions = req.admin.permissions || {};
    if (roleData) {
      permissions = { ...roleData.permissions, ...permissions };
    }

    // Use req.user from authenticateAdmin middleware instead of calling getUser again
    if (!req.user) {
      return res.status(401).json({ error: 'User not found in request' });
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        admin: {
          id: req.admin.id,
          role: req.admin.role,
          roleName: roleData?.role_name,
          permissions,
          isActive: req.admin.is_active,
          lastLoginAt: req.admin.last_login_at
        }
      }
    });
  } catch (error) {
    logger.error('Get admin info error:', error);
    res.status(500).json({ error: 'Failed to get admin info' });
  }
});

module.exports = router;


