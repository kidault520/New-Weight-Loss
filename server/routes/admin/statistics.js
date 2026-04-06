const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const { toBeijingDateString } = require('../../utils/timezone');
const logger = require('../../utils/logger');
const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

/**
 * Get platform overview statistics
 * GET /api/admin/statistics/overview
 */
router.get('/overview', checkPermission('view_statistics'), async (req, res) => {
  try {
    // Total users
    const { count: totalUsers } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    // Active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Note: We can't easily query last_sign_in_at from user_profiles
    // This would require joining with auth.users which is complex
    // For now, we'll use a simpler metric

    // New users in last 30 days
    const { count: newUsers } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Total health records
    const { count: totalHealthRecords } = await supabaseAdmin
      .from('health_records')
      .select('*', { count: 'exact', head: true });

    // Total assessments
    const { count: totalAssessments } = await supabaseAdmin
      .from('health_assessments')
      .select('*', { count: 'exact', head: true });

    // Total meal plans
    const { count: totalMealPlans } = await supabaseAdmin
      .from('meal_plans')
      .select('*', { count: 'exact', head: true });

    // Users with completed onboarding
    const { count: completedOnboarding } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_completed', true);

    res.json({
      overview: {
        totalUsers: totalUsers || 0,
        newUsersLast30Days: newUsers || 0,
        completedOnboarding: completedOnboarding || 0,
        totalHealthRecords: totalHealthRecords || 0,
        totalAssessments: totalAssessments || 0,
        totalMealPlans: totalMealPlans || 0
      }
    });
  } catch (error) {
    logger.error('Get overview statistics error:', error);
    res.status(500).json({ error: 'Failed to get overview statistics' });
  }
});

/**
 * Get user statistics
 * GET /api/admin/statistics/users?period=week|month|year
 */
router.get('/users', checkPermission('view_statistics'), async (req, res) => {
  try {
    const period = req.query.period || 'month';
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
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    // User registration trend
    const { data: registrationTrend } = await supabaseAdmin
      .from('user_profiles')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Group by date
    const trendMap = {};
    (registrationTrend || []).forEach(profile => {
      const date = toBeijingDateString(profile.created_at);
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const registrationTrendData = Object.entries(trendMap).map(([date, count]) => ({
      date,
      count
    }));

    // Users by gender
    const { data: genderData } = await supabaseAdmin
      .from('user_profiles')
      .select('gender')
      .not('gender', 'is', null);

    const genderStats = {};
    (genderData || []).forEach(profile => {
      genderStats[profile.gender] = (genderStats[profile.gender] || 0) + 1;
    });

    // Users by activity level
    const { data: activityData } = await supabaseAdmin
      .from('user_profiles')
      .select('activity_level')
      .not('activity_level', 'is', null);

    const activityStats = {};
    (activityData || []).forEach(profile => {
      activityStats[profile.activity_level] = (activityStats[profile.activity_level] || 0) + 1;
    });

    // Onboarding completion rate
    const { count: total } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: completed } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_completed', true);

    res.json({
      period,
      registrationTrend: registrationTrendData,
      genderDistribution: genderStats,
      activityLevelDistribution: activityStats,
      onboardingCompletionRate: total > 0 ? (completed / total) * 100 : 0,
      totalUsers: total || 0,
      completedOnboarding: completed || 0
    });
  } catch (error) {
    logger.error('Get user statistics error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

/**
 * Get health data statistics
 * GET /api/admin/statistics/health-data?period=week|month|year
 */
router.get('/health-data', checkPermission('view_statistics'), async (req, res) => {
  try {
    const period = req.query.period || 'month';
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
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    // Health records by type
    const { data: recordsByType } = await supabaseAdmin
      .from('health_records')
      .select('record_type')
      .gte('created_at', startDate.toISOString());

    const typeStats = {};
    (recordsByType || []).forEach(record => {
      typeStats[record.record_type] = (typeStats[record.record_type] || 0) + 1;
    });

    // Average health assessment scores
    const { data: assessments } = await supabaseAdmin
      .from('health_assessments')
      .select('diet_score, fitness_score, rest_score, psychology_score, exercise_score, overall_score')
      .gte('assessment_date', startDate.toISOString());

    const avgScores = {
      diet: 0,
      fitness: 0,
      rest: 0,
      psychology: 0,
      exercise: 0,
      overall: 0
    };

    if (assessments && assessments.length > 0) {
      assessments.forEach(assessment => {
        avgScores.diet += assessment.diet_score || 0;
        avgScores.fitness += assessment.fitness_score || 0;
        avgScores.rest += assessment.rest_score || 0;
        avgScores.psychology += assessment.psychology_score || 0;
        avgScores.exercise += assessment.exercise_score || 0;
        avgScores.overall += assessment.overall_score || 0;
      });

      const count = assessments.length;
      Object.keys(avgScores).forEach(key => {
        avgScores[key] = avgScores[key] / count;
      });
    }

    // Emotion records distribution（health_records.record_type = emotion）
    const { data: emotionRows } = await supabaseAdmin
      .from('health_records')
      .select('emotion_data')
      .eq('record_type', 'emotion')
      .gte('recorded_at', startDate.toISOString());

    const emotionStats = {};
    (emotionRows || []).forEach((row) => {
      const emo =
        row.emotion_data && typeof row.emotion_data === 'object' && row.emotion_data.emotion
          ? row.emotion_data.emotion
          : 'neutral';
      emotionStats[emo] = (emotionStats[emo] || 0) + 1;
    });

    // Exercise records（health_records 统一表）
    const { count: exerciseCount } = await supabaseAdmin
      .from('health_records')
      .select('*', { count: 'exact', head: true })
      .eq('record_type', 'exercise')
      .gte('recorded_at', startDate.toISOString());

    // Meal plans
    const { count: mealPlanCount } = await supabaseAdmin
      .from('meal_plans')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString());

    res.json({
      period,
      recordsByType: typeStats,
      averageAssessmentScores: avgScores,
      emotionDistribution: emotionStats,
      totalExerciseRecords: exerciseCount || 0,
      totalMealPlans: mealPlanCount || 0
    });
  } catch (error) {
    logger.error('Get health data statistics error:', error);
    res.status(500).json({ error: 'Failed to get health data statistics' });
  }
});

module.exports = router;











