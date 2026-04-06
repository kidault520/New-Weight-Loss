const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/** health_records 运动行 → 旧 API 扁平结构（兼容老客户端） */
function mapHealthRowToLegacyRecord(row) {
  const ed = row.exercise_data && typeof row.exercise_data === 'object' ? row.exercise_data : {};
  return {
    id: row.id,
    user_id: row.user_id,
    exercise_name: ed.name || '运动',
    duration_minutes: Number(ed.duration) || 0,
    calories_burned: Number(ed.calories_burned ?? row.value) || 0,
    exercise_type: ed.exercise_type || 'other',
    intensity: ed.intensity || 'moderate',
    notes: row.notes,
    recorded_at: row.recorded_at,
    source: ed.source || 'manual',
  };
}

// Get exercise records
router.get('/records', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, exercise_type } = req.query;

    let query = supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'exercise')
      .order('recorded_at', { ascending: false });

    if (start_date) {
      query = query.gte('recorded_at', start_date);
    }
    if (end_date) {
      query = query.lte('recorded_at', end_date);
    }
    if (exercise_type) {
      query = query.contains('exercise_data', { exercise_type });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ records: (data || []).map(mapHealthRowToLegacyRecord) });
  } catch (error) {
    console.error('Get exercise records error:', error);
    res.status(500).json({ error: 'Failed to get exercise records' });
  }
});

// Add exercise record
router.post('/records', authenticateToken, async (req, res) => {
  try {
    const {
      exercise_name,
      duration_minutes,
      calories_burned,
      exercise_type,
      intensity,
      notes,
      recorded_at,
    } = req.body;

    if (!exercise_name || !duration_minutes) {
      return res.status(400).json({ error: 'Exercise name and duration are required' });
    }

    const kcal = calories_burned || 0;
    const exercise_data = {
      name: exercise_name,
      exercise_type: exercise_type || 'other',
      duration: duration_minutes,
      calories_burned: kcal,
      intensity: intensity || 'moderate',
      source: 'manual',
    };

    const { data, error } = await supabaseAdmin
      .from('health_records')
      .insert({
        user_id: req.user.id,
        record_type: 'exercise',
        value: kcal,
        unit: 'kcal',
        exercise_data,
        notes: notes || null,
        recorded_at: recorded_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Exercise record added successfully',
      record: mapHealthRowToLegacyRecord(data),
    });
  } catch (error) {
    console.error('Add exercise record error:', error);
    res.status(500).json({ error: 'Failed to add exercise record' });
  }
});

// Get exercise statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const { data, error } = await supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'exercise')
      .gte('recorded_at', startDate.toISOString());

    if (error) {
      throw error;
    }

    const legacy = (data || []).map(mapHealthRowToLegacyRecord);

    const stats = {
      total_exercises: legacy.length,
      total_duration: legacy.reduce((sum, record) => sum + (record.duration_minutes || 0), 0),
      total_calories: legacy.reduce((sum, record) => sum + (record.calories_burned || 0), 0),
      by_type: {},
      by_intensity: {},
      average_duration: 0,
      average_calories: 0,
    };

    legacy.forEach((record) => {
      const type = record.exercise_type || 'other';
      if (!stats.by_type[type]) {
        stats.by_type[type] = { count: 0, duration: 0, calories: 0 };
      }
      stats.by_type[type].count++;
      stats.by_type[type].duration += record.duration_minutes || 0;
      stats.by_type[type].calories += record.calories_burned || 0;

      const inten = record.intensity || 'moderate';
      if (!stats.by_intensity[inten]) {
        stats.by_intensity[inten] = { count: 0, duration: 0, calories: 0 };
      }
      stats.by_intensity[inten].count++;
      stats.by_intensity[inten].duration += record.duration_minutes || 0;
      stats.by_intensity[inten].calories += record.calories_burned || 0;
    });

    if (stats.total_exercises > 0) {
      stats.average_duration = Math.round(stats.total_duration / stats.total_exercises);
      stats.average_calories = Math.round(stats.total_calories / stats.total_exercises);
    }

    res.json({
      period,
      stats,
      records: legacy,
    });
  } catch (error) {
    console.error('Get exercise stats error:', error);
    res.status(500).json({ error: 'Failed to get exercise statistics' });
  }
});

module.exports = router;
