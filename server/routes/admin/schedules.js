const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const { toBeijingDateString, parseBeijingDate } = require('../../utils/timezone');
const router = express.Router();

router.use(authenticateAdmin);
router.use(auditLog);

router.post('/batch', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries required' });
    }
    if (entries.length > 1000) {
      return res.status(400).json({ error: 'entries limit exceeded' });
    }
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = toBeijingDateString(yesterday);

    const yTime = yesterday.getTime();
    for (const e of entries) {
      if (!e.start_time) return res.status(400).json({ error: 'start_time required' });
      const startDate = new Date(e.start_time);
      const startStr = toBeijingDateString(startDate);
      if (e.type === 'meal') {
        const parsedStart = parseBeijingDate(startStr);
        const diffMs = (parsedStart ? parsedStart.getTime() : 0) - yTime;
        const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
        if (diffDays < 0) {
          return res.status(400).json({ error: `meal start_time 不能早于 ${yDate}` });
        }
      } else if (e.type === 'supplement') {
        if (startStr !== yDate) {
          return res.status(400).json({ error: `start_time must equal ${yDate}` });
        }
        if (!e.course_id) {
          return res.status(400).json({ error: 'course_id required for supplement' });
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .rpc('schedules_batch_insert', {
        entries: entries,
        creator: req.admin.user_id
      });
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({
      success: data.success,
      failure: data.failure,
      failures: data.failures
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
