const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const {
  mapHealthRowsToEmotionRecords,
  mapHealthRowToEmotionRecord,
  buildEmotionHealthRecordInsert,
} = require('../utils/mapEmotionHealthRecord');
const router = express.Router();

// Get emotion records（存于 health_records.record_type = emotion）
router.get('/records', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, emotion } = req.query;
    
    let query = supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'emotion')
      .order('recorded_at', { ascending: false });

    if (start_date) {
      query = query.gte('recorded_at', start_date);
    }
    if (end_date) {
      query = query.lte('recorded_at', end_date);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    let mapped = mapHealthRowsToEmotionRecords(data || []);
    if (emotion) {
      mapped = mapped.filter((r) => r.emotion === emotion);
    }

    res.json({ records: mapped });
  } catch (error) {
    console.error('Get emotion records error:', error);
    res.status(500).json({ error: 'Failed to get emotion records' });
  }
});

// Add emotion record
router.post('/records', authenticateToken, async (req, res) => {
  try {
    const { emotion, intensity, message, recorded_at } = req.body;

    if (!emotion) {
      return res.status(400).json({ error: 'Emotion is required' });
    }

    const row = buildEmotionHealthRecordInsert(req.user.id, {
      emotion,
      intensity: intensity || 0.5,
      message,
      recorded_at: recorded_at || new Date().toISOString(),
    });

    const { data, error } = await supabaseAdmin
      .from('health_records')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Emotion record added successfully',
      record: mapHealthRowToEmotionRecord(data)
    });
  } catch (error) {
    console.error('Add emotion record error:', error);
    res.status(500).json({ error: 'Failed to add emotion record' });
  }
});

// Get emotion statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
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

    const { data: rawRows, error } = await supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'emotion')
      .gte('recorded_at', startDate.toISOString());

    if (error) {
      throw error;
    }

    const data = mapHealthRowsToEmotionRecords(rawRows || []);

    // Calculate emotion statistics
    const emotionCounts = {};
    const emotionIntensities = {};
    let totalIntensity = 0;
    let totalRecords = data.length;

    data.forEach(record => {
      const emotion = record.emotion;
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      
      if (!emotionIntensities[emotion]) {
        emotionIntensities[emotion] = [];
      }
      emotionIntensities[emotion].push(record.intensity || 0.5);
      totalIntensity += record.intensity || 0.5;
    });

    // Calculate average intensities
    const emotionAverages = {};
    Object.keys(emotionIntensities).forEach(emotion => {
      const intensities = emotionIntensities[emotion];
      emotionAverages[emotion] = intensities.reduce((sum, val) => sum + val, 0) / intensities.length;
    });

    // Find dominant emotion
    const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) => 
      emotionCounts[a] > emotionCounts[b] ? a : b, 'neutral'
    );

    // Calculate mood trend (last 7 days vs previous 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const previous7Days = new Date();
    previous7Days.setDate(previous7Days.getDate() - 14);

    const recentRecords = data.filter(r => new Date(r.recorded_at) >= last7Days);
    const previousRecords = data.filter(r => 
      new Date(r.recorded_at) >= previous7Days && new Date(r.recorded_at) < last7Days
    );

    const recentAvgIntensity = recentRecords.length > 0 
      ? recentRecords.reduce((sum, r) => sum + (r.intensity || 0.5), 0) / recentRecords.length
      : 0.5;
    
    const previousAvgIntensity = previousRecords.length > 0
      ? previousRecords.reduce((sum, r) => sum + (r.intensity || 0.5), 0) / previousRecords.length
      : 0.5;

    const moodTrend = recentAvgIntensity > previousAvgIntensity ? 'improving' : 
                     recentAvgIntensity < previousAvgIntensity ? 'declining' : 'stable';

    const stats = {
      total_records: totalRecords,
      period,
      emotion_counts: emotionCounts,
      emotion_averages: emotionAverages,
      dominant_emotion: dominantEmotion,
      overall_average_intensity: totalRecords > 0 ? totalIntensity / totalRecords : 0.5,
      mood_trend: moodTrend,
      recent_avg_intensity: recentAvgIntensity,
      previous_avg_intensity: previousAvgIntensity
    };

    res.json({ stats, records: data });
  } catch (error) {
    console.error('Get emotion stats error:', error);
    res.status(500).json({ error: 'Failed to get emotion statistics' });
  }
});

// Get mood insights
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const { data: rawRows, error } = await supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'emotion')
      .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: true });

    if (error) {
      throw error;
    }

    const data = mapHealthRowsToEmotionRecords(rawRows || []);

    // Analyze patterns
    const hourlyPatterns = {};
    const dailyPatterns = {};
    const weeklyPatterns = {};

    data.forEach(record => {
      const date = new Date(record.recorded_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const dayOfMonth = date.getDate();

      // Hourly patterns
      if (!hourlyPatterns[hour]) {
        hourlyPatterns[hour] = { count: 0, totalIntensity: 0, emotions: {} };
      }
      hourlyPatterns[hour].count++;
      hourlyPatterns[hour].totalIntensity += record.intensity || 0.5;
      hourlyPatterns[hour].emotions[record.emotion] = (hourlyPatterns[hour].emotions[record.emotion] || 0) + 1;

      // Weekly patterns
      if (!weeklyPatterns[dayOfWeek]) {
        weeklyPatterns[dayOfWeek] = { count: 0, totalIntensity: 0, emotions: {} };
      }
      weeklyPatterns[dayOfWeek].count++;
      weeklyPatterns[dayOfWeek].totalIntensity += record.intensity || 0.5;
      weeklyPatterns[dayOfWeek].emotions[record.emotion] = (weeklyPatterns[dayOfWeek].emotions[record.emotion] || 0) + 1;
    });

    // Find best and worst times
    const bestHour = Object.keys(hourlyPatterns).reduce((best, hour) => {
      const avgIntensity = hourlyPatterns[hour].totalIntensity / hourlyPatterns[hour].count;
      const bestAvg = hourlyPatterns[best] ? hourlyPatterns[best].totalIntensity / hourlyPatterns[best].count : 0;
      return avgIntensity > bestAvg ? hour : best;
    }, '12');

    const bestDay = Object.keys(weeklyPatterns).reduce((best, day) => {
      const avgIntensity = weeklyPatterns[day].totalIntensity / weeklyPatterns[day].count;
      const bestAvg = weeklyPatterns[best] ? weeklyPatterns[best].totalIntensity / weeklyPatterns[best].count : 0;
      return avgIntensity > bestAvg ? day : best;
    }, '0');

    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    const insights = {
      total_records: data.length,
      best_hour: parseInt(bestHour),
      best_day: dayNames[parseInt(bestDay)],
      hourly_patterns: hourlyPatterns,
      weekly_patterns: weeklyPatterns,
      recommendations: [
        `您在${bestHour}点时心情最好，建议在这个时间段安排重要活动`,
        `${dayNames[parseInt(bestDay)]}是您心情最佳的一天，可以多安排一些愉快的事情`,
        data.length > 10 ? '继续保持记录心情的好习惯，这有助于了解自己的情绪模式' : '建议多记录心情，以便更好地分析情绪模式'
      ]
    };

    res.json({ insights });
  } catch (error) {
    console.error('Get emotion insights error:', error);
    res.status(500).json({ error: 'Failed to get emotion insights' });
  }
});

module.exports = router;