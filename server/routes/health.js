const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { toBeijingDateString, toBeijingDayRangeISO } = require('../utils/timezone');
const router = express.Router();

// Get health records for a date range
router.get('/records', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, type } = req.query;
    
    let query = supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .order('recorded_at', { ascending: false });

    if (start_date) {
      query = query.gte('recorded_at', start_date);
    }
    if (end_date) {
      query = query.lte('recorded_at', end_date);
    }
    if (type) {
      query = query.eq('record_type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ records: data });
  } catch (error) {
    console.error('Get health records error:', error);
    res.status(500).json({ error: 'Failed to get health records' });
  }
});

// Add health record
router.post('/records', authenticateToken, async (req, res) => {
  try {
    const { record_type, value, unit, notes, recorded_at } = req.body;

    if (!record_type || value === undefined) {
      return res.status(400).json({ error: 'Record type and value are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('health_records')
      .insert({
        user_id: req.user.id,
        record_type,
        value,
        unit,
        notes,
        recorded_at: recorded_at || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Health record added successfully',
      record: data
    });
  } catch (error) {
    console.error('Add health record error:', error);
    res.status(500).json({ error: 'Failed to add health record' });
  }
});

// Update health record
router.put('/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { value, unit, notes } = req.body;

    const { data, error } = await supabaseAdmin
      .from('health_records')
      .update({
        value,
        unit,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({
      message: 'Health record updated successfully',
      record: data
    });
  } catch (error) {
    console.error('Update health record error:', error);
    res.status(500).json({ error: 'Failed to update health record' });
  }
});

// Delete health record
router.delete('/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('health_records')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      throw error;
    }

    res.json({ message: 'Health record deleted successfully' });
  } catch (error) {
    console.error('Delete health record error:', error);
    res.status(500).json({ error: 'Failed to delete health record' });
  }
});

// Get nutrition analysis
router.get('/nutrition/analysis', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || toBeijingDateString(new Date());
    const dayRange = toBeijingDayRangeISO(targetDate);
    if (!dayRange) {
      return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
    }

    const { data, error } = await supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'food')
      .gte('recorded_at', dayRange.start)
      .lte('recorded_at', dayRange.end);

    if (error) {
      throw error;
    }

    // Calculate nutrition totals
    const totals = data.reduce((acc, record) => {
      const nutrition = record.nutrition_data || {};
      acc.calories += nutrition.calories || 0;
      acc.protein += nutrition.protein || 0;
      acc.carbs += nutrition.carbs || 0;
      acc.fat += nutrition.fat || 0;
      acc.fiber += nutrition.fiber || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    res.json({ 
      date: targetDate,
      records: data,
      totals 
    });
  } catch (error) {
    console.error('Get nutrition analysis error:', error);
    res.status(500).json({ error: 'Failed to get nutrition analysis' });
  }
});

module.exports = router;