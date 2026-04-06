const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate admin users
 * Verifies JWT token and checks if user is an active admin
 */
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    

    // Verify Supabase JWT token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Check if user is an admin
    // First check if user exists in admin_users table at all
    const { data: adminUserCheck, error: checkError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (checkError) {
      logger.error('Error checking admin user in middleware:', {
        userId: user.id,
        email: user.email,
        error: checkError.message,
        code: checkError.code
      });
      return res.status(500).json({ 
        error: 'Failed to verify admin status',
        details: process.env.NODE_ENV === 'development' ? checkError.message : undefined
      });
    }

    // If user doesn't exist in admin_users table
    if (!adminUserCheck) {
      logger.warn('User attempted to access admin route but not in admin_users table:', {
        userId: user.id,
        email: user.email,
        path: req.path
      });
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        hint: 'This user is not registered as an admin.'
      });
    }

    // If user exists but is not active
    if (!adminUserCheck.is_active) {
      logger.warn('User attempted to access admin route but account is inactive:', {
        userId: user.id,
        email: user.email,
        adminId: adminUserCheck.id,
        path: req.path
      });
      return res.status(403).json({ 
        error: 'Access denied. Admin account is inactive.',
        hint: 'Your admin account has been deactivated.'
      });
    }

    // User is an active admin
    const adminUser = adminUserCheck;

    // Attach user and admin info to request
    req.user = user;
    req.admin = adminUser;

    // Update last login time
    await supabaseAdmin
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminUser.id);

    next();
  } catch (error) {
    logger.error('Admin auth middleware error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware to check if admin has specific permission
 * @param {string|string[]} requiredPermissions - Permission(s) required
 */
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({ error: 'Admin authentication required' });
    }

    const permissions = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions];

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    // Check role-based permissions
    const { data: roleData } = await supabaseAdmin
      .from('admin_roles')
      .select('permissions')
      .eq('role_name', req.admin.role)
      .single();

    const rolePermissions = roleData?.permissions || {};
    const userPermissions = req.admin.permissions || {};

    // Merge role and user-specific permissions
    const allPermissions = { ...rolePermissions, ...userPermissions };

    // Check if admin has at least one of the required permissions
    const hasPermission = permissions.some(perm => {
      // Support nested permissions like "manage_content.templates"
      const permParts = perm.split('.');
      let current = allPermissions;
      
      for (const part of permParts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return false;
        }
      }
      
      return current === true;
    });

    if (!hasPermission) {
      logger.warn(`Admin ${req.admin.id} attempted to access resource requiring permissions: ${permissions.join(', ')}`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions 
      });
    }

    next();
  };
};

/**
 * Middleware to log admin actions to audit log
 */
const auditLog = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;

  // Override json method to capture response
  res.json = function(body) {
    // Log the action after response is sent
    setImmediate(async () => {
      try {
        const action = `${req.method} ${req.path}`;
        const resourceType = req.params.resourceType || 
          req.path.split('/').filter(p => p && p !== 'api' && p !== 'admin')[0] || 
          'unknown';
        const resourceId = req.params.id || req.body?.id || null;

        await supabaseAdmin
          .from('admin_audit_logs')
          .insert({
            admin_id: req.admin?.id,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              body: req.body,
              query: req.query
            },
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent')
          });
      } catch (error) {
        logger.error('Failed to write audit log:', error);
      }
    });

    // Call original json method
    return originalJson.call(this, body);
  };

  next();
};

module.exports = {
  authenticateAdmin,
  checkPermission,
  auditLog
};











