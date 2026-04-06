const express = require('express');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const {
  listIntegrations,
  getIntegrationById,
  summarize,
  runIntegrationHealthCheck,
  runIntegrationTest,
  updateIntegrationConfig,
} = require('../../services/integrationCenterService');

const router = express.Router();

router.use(authenticateAdmin);
router.use(auditLog);

router.get('/', checkPermission('manage_config'), async (req, res) => {
  try {
    const integrations = await listIntegrations();
    return res.json({
      integrations,
      summary: summarize(integrations),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[admin/integrations] list failed:', error);
    return res.status(500).json({ error: 'Failed to load integrations' });
  }
});

router.get('/:id', checkPermission('manage_config'), async (req, res) => {
  try {
    const integration = await getIntegrationById(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    return res.json({ integration });
  } catch (error) {
    logger.error('[admin/integrations] detail failed:', error);
    return res.status(500).json({ error: 'Failed to load integration detail' });
  }
});

router.put('/:id/config', checkPermission('manage_config'), async (req, res) => {
  try {
    const payload = req.body?.config;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'config object is required' });
    }
    const result = await updateIntegrationConfig(req.params.id, payload, req.admin?.id || null);
    if (!result) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    return res.json({
      message: 'Integration config saved',
      integration: result.integration,
      saved: result.saved,
    });
  } catch (error) {
    logger.error('[admin/integrations] save config failed:', error);
    return res.status(500).json({ error: 'Failed to save integration config' });
  }
});

router.post('/:id/health-check', checkPermission('manage_config'), async (req, res) => {
  try {
    const check = await runIntegrationHealthCheck(req.params.id, req.admin?.id || null);
    if (!check) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    const integration = await getIntegrationById(req.params.id);
    return res.json({
      integration,
      check,
      checkedAt: check.checkedAt,
      message: check.message,
    });
  } catch (error) {
    logger.error('[admin/integrations] health-check failed:', error);
    return res.status(500).json({ error: 'Failed to execute health check' });
  }
});

router.post('/:id/test', checkPermission('manage_config'), async (req, res) => {
  try {
    const test = await runIntegrationTest(req.params.id, req.body || {}, req.admin?.id || null);
    if (!test) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    const integration = await getIntegrationById(req.params.id);
    return res.json({
      integration,
      test,
      testedAt: test.testedAt,
      message: test.message,
    });
  } catch (error) {
    logger.error('[admin/integrations] test failed:', error);
    return res.status(500).json({ error: 'Failed to run integration test' });
  }
});

module.exports = router;
