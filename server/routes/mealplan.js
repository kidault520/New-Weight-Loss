const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiService');
const router = express.Router();

// Get user's meal plans
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('meal_plans')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ meal_plans: data });
  } catch (error) {
    console.error('Get meal plans error:', error);
    res.status(500).json({ error: 'Failed to get meal plans' });
  }
});

// Create new meal plan
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, duration_days, preferences } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Meal plan name is required' });
    }

    // Get user profile for personalized meal plan
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    // Generate meal plan using AI
    let planData = {};
    try {
      const aiPlan = await aiService.generateMealPlan(profile, preferences);
      planData = typeof aiPlan === 'string' ? JSON.parse(aiPlan) : aiPlan;
    } catch (aiError) {
      console.error('AI meal plan generation failed:', aiError);
      // Fallback to basic meal plan structure
      planData = {
        days: Array.from({ length: duration_days || 7 }, (_, i) => ({
          day: i + 1,
          meals: {
            breakfast: { name: '健康早餐', calories: 300 },
            lunch: { name: '营养午餐', calories: 500 },
            dinner: { name: '轻食晚餐', calories: 400 }
          }
        }))
      };
    }

    const { data, error } = await supabaseAdmin
      .from('meal_plans')
      .insert({
        user_id: req.user.id,
        name,
        description,
        plan_data: planData,
        duration_days: duration_days || 7,
        is_active: false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Meal plan created successfully',
      meal_plan: data
    });
  } catch (error) {
    console.error('Create meal plan error:', error);
    res.status(500).json({ error: 'Failed to create meal plan' });
  }
});

// Activate meal plan
router.put('/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all other meal plans
    await supabaseAdmin
      .from('meal_plans')
      .update({ is_active: false })
      .eq('user_id', req.user.id);

    // Activate selected meal plan
    const { data, error } = await supabaseAdmin
      .from('meal_plans')
      .update({ is_active: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    res.json({
      message: 'Meal plan activated successfully',
      meal_plan: data
    });
  } catch (error) {
    console.error('Activate meal plan error:', error);
    res.status(500).json({ error: 'Failed to activate meal plan' });
  }
});

// Delete meal plan
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('meal_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      throw error;
    }

    res.json({ message: 'Meal plan deleted successfully' });
  } catch (error) {
    console.error('Delete meal plan error:', error);
    res.status(500).json({ error: 'Failed to delete meal plan' });
  }
});

module.exports = router;