const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

// ==================== Roles Management ====================

/**
 * Get roles list
 * GET /api/admin/permissions/roles
 */
router.get('/roles', checkPermission('manage_roles'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_roles')
      .select('*')
      .order('role_name', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ roles: data || [] });
  } catch (error) {
    logger.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

/**
 * Create role
 * POST /api/admin/permissions/roles
 */
router.post('/roles', checkPermission('manage_roles'), async (req, res) => {
  try {
    const { role_name, permissions, description } = req.body;

    if (!role_name) {
      return res.status(400).json({ error: 'role_name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_roles')
      .insert({
        role_name,
        permissions: permissions || {},
        description
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Role name already exists' });
      }
      throw error;
    }

    res.status(201).json({
      message: 'Role created successfully',
      role: data
    });
  } catch (error) {
    logger.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

/**
 * Update role
 * PUT /api/admin/permissions/roles/:id
 */
router.put('/roles/:id', checkPermission('manage_roles'), async (req, res) => {
  try {
    const roleId = req.params.id;
    const { role_name, permissions, description } = req.body;

    const updateData = {};
    if (role_name !== undefined) updateData.role_name = role_name;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (description !== undefined) updateData.description = description;

    const { data, error } = await supabaseAdmin
      .from('admin_roles')
      .update(updateData)
      .eq('id', roleId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Role not found' });
      }
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Role name already exists' });
      }
      throw error;
    }

    res.json({
      message: 'Role updated successfully',
      role: data
    });
  } catch (error) {
    logger.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * Delete role
 * DELETE /api/admin/permissions/roles/:id
 */
router.delete('/roles/:id', checkPermission('manage_roles'), async (req, res) => {
  try {
    const roleId = req.params.id;

    // Check if any admin users are using this role
    const { data: usersWithRole } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('role', roleId)
      .limit(1);

    if (usersWithRole && usersWithRole.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role. There are admin users assigned to this role.' 
      });
    }

    const { error } = await supabaseAdmin
      .from('admin_roles')
      .delete()
      .eq('id', roleId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    logger.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// ==================== Admin Users Management ====================

/**
 * Get admin users list
 * GET /api/admin/permissions/admins
 */
router.get('/admins', checkPermission('manage_admins'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('*, admin_roles(*)')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get email for each admin
    const adminsWithEmail = await Promise.all(
      (data || []).map(async (admin) => {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(admin.user_id);
        return {
          ...admin,
          email: authData?.user?.email || null
        };
      })
    );

    res.json({ admins: adminsWithEmail || [] });
  } catch (error) {
    logger.error('Get admin users error:', error);
    res.status(500).json({ error: 'Failed to get admin users' });
  }
});

/**
 * Create admin user
 * POST /api/admin/permissions/admins
 */
router.post('/admins', checkPermission('manage_admins'), async (req, res) => {
  try {
    const { email, password, role, permissions } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Failed to create user' });
    }

    // Create admin user record
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        user_id: authData.user.id,
        role: role || 'admin',
        permissions: permissions || {}
      })
      .select()
      .single();

    if (adminError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw adminError;
    }

    res.status(201).json({
      message: 'Admin user created successfully',
      admin: adminData
    });
  } catch (error) {
    logger.error('Create admin user error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

/**
 * Update admin user
 * PUT /api/admin/permissions/admins/:id
 */
router.put('/admins/:id', checkPermission('manage_admins'), async (req, res) => {
  try {
    const adminId = req.params.id;
    const { role, permissions, is_active } = req.body;

    // Prevent self-deactivation
    if (adminId === req.admin.id && is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update(updateData)
      .eq('id', adminId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Admin user not found' });
      }
      throw error;
    }

    res.json({
      message: 'Admin user updated successfully',
      admin: data
    });
  } catch (error) {
    logger.error('Update admin user error:', error);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

/**
 * Delete admin user
 * DELETE /api/admin/permissions/admins/:id
 */
router.delete('/admins/:id', checkPermission('manage_admins'), async (req, res) => {
  try {
    const adminId = req.params.id;

    // Prevent self-deletion
    if (adminId === req.admin.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get admin user to get user_id
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('id', adminId)
      .single();

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Delete admin user record (this will cascade delete audit logs)
    const { error: deleteError } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('id', adminId);

    if (deleteError) {
      throw deleteError;
    }

    // Delete auth user
    await supabaseAdmin.auth.admin.deleteUser(adminUser.user_id);

    res.json({ message: 'Admin user deleted successfully' });
  } catch (error) {
    logger.error('Delete admin user error:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

module.exports = router;











