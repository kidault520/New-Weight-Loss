import { supabase } from '../config/supabase';

function mapHealthRowToEmotionRecord(row: Record<string, unknown>): EmotionRecord {
  const ed = (row.emotion_data && typeof row.emotion_data === 'object'
    ? row.emotion_data
    : {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    emotion: String(ed.emotion ?? 'neutral'),
    intensity: Number(row.value ?? ed.intensity ?? 0.5),
    message: row.notes != null ? String(row.notes) : ed.message != null ? String(ed.message) : undefined,
    recorded_at: String(row.recorded_at),
    created_at: String(row.created_at),
  };
}

export interface EmotionRecord {
  id: string;
  user_id: string;
  emotion: string;
  intensity: number;
  message?: string;
  recorded_at: string;
  created_at: string;
}

export interface HRVRecord {
  id: string;
  user_id: string;
  hrv_value: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  resting_heart_rate?: number;
  notes?: string;
  recorded_at: string;
  created_at: string;
}

export interface EmotionStatistics {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly' | 'yearly';
  period_start: string;
  period_end: string;
  total_records: number;
  emotion_counts: Record<string, number>;
  dominant_emotion?: string;
  average_intensity?: number;
  mood_score?: number;
  dopamine_moments: number;
  trend_direction?: 'improving' | 'stable' | 'declining';
  insights: string[];
}

export interface MoodPattern {
  id: string;
  user_id: string;
  pattern_type: 'time_of_day' | 'weekly' | 'seasonal' | 'trigger';
  pattern_data: any;
  description?: string;
  confidence_score?: number;
}

export interface PeriodData {
  start: Date;
  end: Date;
  label: string;
}

const emotionService = {
  async getEmotionRecords(userId: string, startDate?: Date, endDate?: Date): Promise<EmotionRecord[]> {
    try {
      let query = supabase
        .from('health_records')
        .select('*')
        .eq('user_id', userId)
        .eq('record_type', 'emotion')
        .order('recorded_at', { ascending: false });

      if (startDate) {
        query = query.gte('recorded_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('recorded_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((row) => mapHealthRowToEmotionRecord(row as Record<string, unknown>));
    } catch (error) {
      console.error('Error fetching emotion records:', error);
      return [];
    }
  },

  async addEmotionRecord(
    userId: string,
    emotion: string,
    intensity: number,
    message?: string
  ): Promise<EmotionRecord | null> {
    try {
      const inten = intensity ?? 0.5;
      const { data, error } = await supabase
        .from('health_records')
        .insert({
          user_id: userId,
          record_type: 'emotion',
          value: inten,
          emotion_data: { emotion, intensity: inten, message: message ?? null },
          notes: message ?? null,
          recorded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data ? mapHealthRowToEmotionRecord(data as Record<string, unknown>) : null;
    } catch (error) {
      console.error('Error adding emotion record:', error);
      return null;
    }
  },

  async getHRVRecords(userId: string, limit = 30): Promise<HRVRecord[]> {
    try {
      const { data, error } = await supabase
        .from('hrv_records')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching HRV records:', error);
      return [];
    }
  },

  async getLatestHRV(userId: string): Promise<HRVRecord | null> {
    try {
      const { data, error } = await supabase
        .from('hrv_records')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching latest HRV:', error);
      return null;
    }
  },

  async addHRVRecord(
    userId: string,
    hrvValue: number,
    status: 'excellent' | 'good' | 'fair' | 'poor',
    restingHeartRate?: number,
    notes?: string
  ): Promise<HRVRecord | null> {
    try {
      const { data, error } = await supabase
        .from('hrv_records')
        .insert({
          user_id: userId,
          hrv_value: hrvValue,
          status,
          resting_heart_rate: restingHeartRate,
          notes,
          recorded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding HRV record:', error);
      return null;
    }
  },

  async getEmotionStatistics(
    userId: string,
    periodType: 'weekly' | 'monthly' | 'yearly',
    periodStart: Date
  ): Promise<EmotionStatistics | null> {
    try {
      const { data, error } = await supabase
        .from('emotion_statistics')
        .select('*')
        .eq('user_id', userId)
        .eq('period_type', periodType)
        .eq('period_start', periodStart.toISOString())
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching emotion statistics:', error);
      return null;
    }
  },

  async calculateAndSaveStatistics(
    userId: string,
    periodType: 'weekly' | 'monthly' | 'yearly',
    periodStart: Date,
    periodEnd: Date
  ): Promise<EmotionStatistics | null> {
    try {
      const emotions = await this.getEmotionRecords(userId, periodStart, periodEnd);

      if (emotions.length === 0) {
        return null;
      }

      const emotionCounts: Record<string, number> = {};
      let totalIntensity = 0;
      let dopamineMoments = 0;

      emotions.forEach(record => {
        emotionCounts[record.emotion] = (emotionCounts[record.emotion] || 0) + 1;
        totalIntensity += record.intensity;

        if (record.emotion === 'happy' || record.emotion === 'excited') {
          dopamineMoments++;
        }
      });

      const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) =>
        b[1] > a[1] ? b : a
      )[0];

      const averageIntensity = totalIntensity / emotions.length;
      const moodScore = this.calculateMoodScore(emotionCounts, averageIntensity);
      const trendDirection = await this.calculateTrendDirection(userId, periodType, periodStart);
      const insights = this.generateInsights(emotions, emotionCounts, periodType);

      const { data, error } = await supabase
        .from('emotion_statistics')
        .upsert({
          user_id: userId,
          period_type: periodType,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          total_records: emotions.length,
          emotion_counts: emotionCounts,
          dominant_emotion: dominantEmotion,
          average_intensity: averageIntensity,
          mood_score: moodScore,
          dopamine_moments: dopamineMoments,
          trend_direction: trendDirection,
          insights: insights,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error calculating emotion statistics:', error);
      return null;
    }
  },

  calculateMoodScore(emotionCounts: Record<string, number>, averageIntensity: number): number {
    const positiveEmotions = ['happy', 'excited', 'neutral'];
    const negativeEmotions = ['sad', 'angry', 'worried', 'tired'];

    let positiveCount = 0;
    let negativeCount = 0;

    Object.entries(emotionCounts).forEach(([emotion, count]) => {
      if (positiveEmotions.includes(emotion)) {
        positiveCount += count;
      } else if (negativeEmotions.includes(emotion)) {
        negativeCount += count;
      }
    });

    const total = positiveCount + negativeCount;
    if (total === 0) return 50;

    const baseScore = (positiveCount / total) * 100;
    const intensityAdjustment = (averageIntensity - 0.5) * 20;

    return Math.max(0, Math.min(100, baseScore + intensityAdjustment));
  },

  async calculateTrendDirection(
    userId: string,
    periodType: 'weekly' | 'monthly' | 'yearly',
    currentPeriodStart: Date
  ): Promise<'improving' | 'stable' | 'declining' | undefined> {
    try {
      let previousPeriodStart: Date;

      if (periodType === 'weekly') {
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      } else if (periodType === 'monthly') {
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      } else {
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
      }

      const previousStats = await this.getEmotionStatistics(userId, periodType, previousPeriodStart);

      if (!previousStats || !previousStats.mood_score) return undefined;

      const currentStats = await this.getEmotionStatistics(userId, periodType, currentPeriodStart);
      if (!currentStats || !currentStats.mood_score) return undefined;

      const difference = currentStats.mood_score - previousStats.mood_score;

      if (difference > 5) return 'improving';
      if (difference < -5) return 'declining';
      return 'stable';
    } catch (error) {
      console.error('Error calculating trend direction:', error);
      return undefined;
    }
  },

  generateInsights(
    emotions: EmotionRecord[],
    emotionCounts: Record<string, number>,
    periodType: string
  ): string[] {
    void periodType;
    const insights: string[] = [];

    const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) =>
      b[1] > a[1] ? b : a
    )[0];

    if (dominantEmotion === 'happy' || dominantEmotion === 'excited') {
      insights.push('您在这段时间保持了积极的心态');
    } else if (dominantEmotion === 'sad' || dominantEmotion === 'worried') {
      insights.push('建议增加一些放松活动来改善心情');
    }

    const timeOfDayPattern = this.analyzeTimeOfDayPattern(emotions);
    if (timeOfDayPattern) {
      insights.push(timeOfDayPattern);
    }

    if (emotionCounts['tired'] && emotionCounts['tired'] > emotions.length * 0.3) {
      insights.push('注意休息，保持充足睡眠');
    }

    return insights;
  },

  analyzeTimeOfDayPattern(emotions: EmotionRecord[]): string | null {
    const morningEmotions = emotions.filter(e => {
      const hour = new Date(e.recorded_at).getHours();
      return hour >= 6 && hour < 12;
    });

    const afternoonEmotions = emotions.filter(e => {
      const hour = new Date(e.recorded_at).getHours();
      return hour >= 12 && hour < 18;
    });

    const eveningEmotions = emotions.filter(e => {
      const hour = new Date(e.recorded_at).getHours();
      return hour >= 18 || hour < 6;
    });

    const positiveEmotions = ['happy', 'excited'];

    const morningPositive = morningEmotions.filter(e => positiveEmotions.includes(e.emotion)).length;
    const afternoonPositive = afternoonEmotions.filter(e => positiveEmotions.includes(e.emotion)).length;
    const eveningPositive = eveningEmotions.filter(e => positiveEmotions.includes(e.emotion)).length;

    const morningRatio = morningEmotions.length > 0 ? morningPositive / morningEmotions.length : 0;
    const afternoonRatio = afternoonEmotions.length > 0 ? afternoonPositive / afternoonEmotions.length : 0;
    const eveningRatio = eveningEmotions.length > 0 ? eveningPositive / eveningEmotions.length : 0;

    if (afternoonRatio > morningRatio && afternoonRatio > eveningRatio) {
      return '您在下午时段情绪较为积极';
    } else if (morningRatio > afternoonRatio && morningRatio > eveningRatio) {
      return '您在早晨时段情绪较为积极';
    } else if (eveningRatio > morningRatio && eveningRatio > afternoonRatio) {
      return '您在晚间时段情绪较为积极';
    }

    return null;
  },

  async getMoodPatterns(userId: string): Promise<MoodPattern[]> {
    try {
      const { data, error } = await supabase
        .from('mood_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching mood patterns:', error);
      return [];
    }
  },

  getWeekPeriod(date: Date): PeriodData {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
      label: `${start.getFullYear()}年第${this.getWeekNumber(start)}周`
    };
  },

  getMonthPeriod(year: number, month: number): PeriodData {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return {
      start,
      end,
      label: `${year}年${month}月`
    };
  },

  getYearPeriod(year: number): PeriodData {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    return {
      start,
      end,
      label: `${year}年`
    };
  },

  getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  },

  async getOrCreateStatistics(
    userId: string,
    periodType: 'weekly' | 'monthly' | 'yearly',
    date: Date
  ): Promise<EmotionStatistics | null> {
    let period: PeriodData;

    if (periodType === 'weekly') {
      period = this.getWeekPeriod(date);
    } else if (periodType === 'monthly') {
      period = this.getMonthPeriod(date.getFullYear(), date.getMonth() + 1);
    } else {
      period = this.getYearPeriod(date.getFullYear());
    }

    let stats = await this.getEmotionStatistics(userId, periodType, period.start);

    if (!stats) {
      stats = await this.calculateAndSaveStatistics(userId, periodType, period.start, period.end);
    }

    return stats;
  }
};

export default emotionService;
