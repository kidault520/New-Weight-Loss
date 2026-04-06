const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

/**
 * Get system configuration
 * GET /api/admin/config?key=specific_key
 */
router.get('/', checkPermission('manage_config'), async (req, res) => {
  try {
    const key = req.query.key;

    let query = supabaseAdmin
      .from('system_config')
      .select('*');

    if (key) {
      query = query.eq('config_key', key).single();
      const { data, error } = await query;
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return res.json({ config: data || null });
    }

    // Get all configs
    query = query.order('config_key', { ascending: true });
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ configs: data || [] });
  } catch (error) {
    logger.error('Get system config error:', error);
    res.status(500).json({ error: 'Failed to get system config' });
  }
});

/**
 * Update system configuration
 * PUT /api/admin/config/:key
 */
router.put('/:key', checkPermission('manage_config'), async (req, res) => {
  try {
    const configKey = req.params.key;
    const { config_value, description } = req.body;

    if (config_value === undefined) {
      return res.status(400).json({ error: 'config_value is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('system_config')
      .upsert({
        config_key: configKey,
        config_value,
        description,
        updated_by: req.admin.id,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'System config updated successfully',
      config: data
    });
  } catch (error) {
    logger.error('Update system config error:', error);
    res.status(500).json({ error: 'Failed to update system config' });
  }
});

/**
 * Delete system configuration
 * DELETE /api/admin/config/:key
 */
router.delete('/:key', checkPermission('manage_config'), async (req, res) => {
  try {
    const configKey = req.params.key;

    const { error } = await supabaseAdmin
      .from('system_config')
      .delete()
      .eq('config_key', configKey);

    if (error) {
      throw error;
    }

    res.json({ message: 'System config deleted successfully' });
  } catch (error) {
    logger.error('Delete system config error:', error);
    res.status(500).json({ error: 'Failed to delete system config' });
  }
});

module.exports = router;











