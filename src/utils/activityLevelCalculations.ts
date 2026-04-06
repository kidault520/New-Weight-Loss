import { supabase } from '../config/supabase';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

interface ActivityMultipliers {
  sedentary: number;
  light: number;
  moderate: number;
  active: number;
  very_active: number;
}

const ACTIVITY_MULTIPLIERS: ActivityMultipliers = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

interface StepsData {
  averageSteps: number;
  totalDays: number;
}

interface ExerciseData {
  totalSessions: number;
  totalMinutes: number;
  averageIntensity: 'low' | 'moderate' | 'high';
}

export const getActivityMultiplier = (activityLevel: ActivityLevel): number => {
  return ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentary;
};

export const calculateDynamicActivityLevel = async (
  userId: string,
  daysPeriod: number = 7
): Promise<ActivityLevel> => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysPeriod);

    const stepsData = await getAverageSteps(userId, startDate);
    const exerciseData = await getExerciseData(userId, startDate);

    return determineActivityLevel(stepsData, exerciseData);
  } catch (error) {
    console.error('Error calculating dynamic activity level:', error);
    return 'moderate';
  }
};

const getAverageSteps = async (
  userId: string,
  startDate: Date
): Promise<StepsData> => {
  const { data, error } = await supabase
    .from('health_records')
    .select('value, recorded_at')
    .eq('user_id', userId)
    .eq('record_type', 'steps')
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return { averageSteps: 0, totalDays: 0 };
  }

  const totalSteps = data.reduce((sum, record) => sum + Number(record.value), 0);
  const averageSteps = Math.round(totalSteps / data.length);

  return {
    averageSteps,
    totalDays: data.length,
  };
};

const getExerciseData = async (
  userId: string,
  startDate: Date
): Promise<ExerciseData> => {
  const { data, error } = await supabase
    .from('health_records')
    .select('exercise_data, recorded_at')
    .eq('user_id', userId)
    .eq('record_type', 'exercise')
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return {
      totalSessions: 0,
      totalMinutes: 0,
      averageIntensity: 'low',
    };
  }

  const totalMinutes = data.reduce((sum, record) => {
    const ed = record.exercise_data as { duration?: number } | null;
    return sum + (Number(ed?.duration) || 0);
  }, 0);

  const intensityScores = data
    .map((r) => (r.exercise_data as { intensity?: string } | null)?.intensity)
    .filter((intensity): intensity is string => Boolean(intensity))
    .map((intensity) => {
      switch (intensity) {
        case 'high': return 3;
        case 'moderate': return 2;
        case 'low': return 1;
        default: return 1;
      }
    });

  const avgIntensityScore = intensityScores.length > 0
    ? intensityScores.reduce((a, b) => a + b, 0) / intensityScores.length
    : 1;

  let averageIntensity: 'low' | 'moderate' | 'high' = 'low';
  if (avgIntensityScore >= 2.5) averageIntensity = 'high';
  else if (avgIntensityScore >= 1.5) averageIntensity = 'moderate';

  return {
    totalSessions: data.length,
    totalMinutes,
    averageIntensity,
  };
};

const determineActivityLevel = (
  stepsData: StepsData,
  exerciseData: ExerciseData
): ActivityLevel => {
  const { averageSteps } = stepsData;
  const { totalSessions, totalMinutes, averageIntensity } = exerciseData;

  let score = 0;

  if (averageSteps < 3000) {
    score += 1;
  } else if (averageSteps < 6000) {
    score += 2;
  } else if (averageSteps < 10000) {
    score += 3;
  } else if (averageSteps < 15000) {
    score += 4;
  } else {
    score += 5;
  }

  if (totalSessions === 0) {
    score += 0;
  } else if (totalSessions < 3) {
    score += 1;
  } else if (totalSessions < 5) {
    score += 2;
  } else if (totalSessions < 7) {
    score += 3;
  } else {
    score += 4;
  }

  if (averageIntensity === 'high') {
    score += 2;
  } else if (averageIntensity === 'moderate') {
    score += 1;
  }

  const weeklyExerciseMinutes = totalMinutes;
  if (weeklyExerciseMinutes >= 300) {
    score += 2;
  } else if (weeklyExerciseMinutes >= 150) {
    score += 1;
  }

  if (score <= 3) return 'sedentary';
  if (score <= 6) return 'light';
  if (score <= 9) return 'moderate';
  if (score <= 12) return 'active';
  return 'very_active';
};

export const calculateDynamicTDEE = async (
  bmr: number,
  userId: string,
  daysPeriod: number = 7
): Promise<number> => {
  const activityLevel = await calculateDynamicActivityLevel(userId, daysPeriod);
  const multiplier = getActivityMultiplier(activityLevel);
  return Math.round(bmr * multiplier);
};

export const getActivityLevelDescription = (level: ActivityLevel): string => {
  const descriptions: Record<ActivityLevel, string> = {
    sedentary: '久坐 - 很少或没有运动',
    light: '轻度活动 - 每周运动1-3天',
    moderate: '中度活动 - 每周运动3-5天',
    active: '高度活动 - 每周运动6-7天',
    very_active: '极度活动 - 每天剧烈运动',
  };
  return descriptions[level];
};
