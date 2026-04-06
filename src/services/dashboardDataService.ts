 
import { DayData, generateMockData } from '../utils/mockData';
import { supabase } from '../config/supabase';
import { UserProfile, calculateBMR } from '../utils/bmrCalculations';
import { calculateStepsData } from './calorieCalculations';
import { nutritionSyncService } from './nutritionSyncService';
import { weightService } from './weightService';
import { waterService } from './waterService';
import { stepsService } from './stepsService';
import { foodService } from './foodService';
import { sleepService } from './sleepService';
import { bloodGlucoseService } from './bloodGlucoseService';
import { measurementsService } from './measurementsService';
import { exerciseService } from './exerciseService';
import emotionService, { EmotionRecord } from './emotionService';
import { isOrderSyncedFoodNutrition } from '../utils/mealUtils';
import { getBeijingDayBoundsForInstant } from '../utils/dateUtils';

/**
 * Service to provide dashboard data
 * - For authenticated users: fetches real data from database
 * - For new users with no data: shows empty state
 * - During onboarding: can show tutorial data
 * - 使用缓存优先策略：先返回缓存，后台更新
 */

export interface DashboardDataOptions {
  showTutorialData?: boolean; // Show demo data even for authenticated users (onboarding mode)
  targetWeight?: number;
  userProfile?: UserProfile | null; // User profile for personalized targets
}

/**
 * Health record interface (used internally)
 */
interface HealthRecord {
  id: string;
  user_id: string;
  record_type: string;
  value: number;
  unit?: string;
  recorded_at: string;
  notes?: string;
  nutrition_data?: any;
  exercise_data?: any;
  measurement_data?: any;
  blood_glucose_data?: any;
  created_at: string;
  updated_at: string;
}

/**
 * Day health data interface - aggregated data for a specific day
 */
export interface DayHealthData {
  date: Date;
  weight: {
    records: HealthRecord[];
    latest: number | null;
    hasRecord: boolean;
  };
  water: {
    records: HealthRecord[];
    total: number;
  };
  steps: {
    records: HealthRecord[];
    total: number;
    hourlyData: number[];
  };
  food: {
    records: HealthRecord[];
    totalCalories: number;
  };
  exercise: {
    records: any[];
    totalCalories: number;
    totalDuration: number;
  };
  measurements: {
    record: HealthRecord | null;
    chest: number | null;
    waist: number | null;
    upperArm: number | null;
    hips: number | null;
    thigh: number | null;
    calf: number | null;
  };
  sleep: {
    record: HealthRecord | null;
    duration: number | null;
    quality: number | null;
  };
  bloodGlucose: {
    records: HealthRecord[];
    values: Array<{ time: string; value: number }>;
  };
  emotion: {
    records: EmotionRecord[];
    latest: EmotionRecord | null;
  };
}

/**
 * Get current authenticated user ID
 */
async function getUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('[DashboardDataService] Error getting user ID:', error);
    return null;
  }
}

/**
 * Generate hourly steps data from records
 */
function generateHourlyStepsData(stepsRecords: HealthRecord[]): number[] {
  const hourly = new Array(24).fill(0);

  stepsRecords.forEach(record => {
    const hour = new Date(record.recorded_at).getHours();
    hourly[hour] += record.value;
  });

  return hourly;
}

/**
 * Get empty day data structure (for new users or days with no records)
 */
function getEmptyDayData(date: Date): DayHealthData {
  return {
    date,
    weight: {
      records: [],
      latest: null,
      hasRecord: false,
    },
    water: {
      records: [],
      total: 0,
    },
    steps: {
      records: [],
      total: 0,
      hourlyData: new Array(24).fill(0),
    },
    food: {
      records: [],
      totalCalories: 0,
    },
    exercise: {
      records: [],
      totalCalories: 0,
      totalDuration: 0,
    },
    measurements: {
      record: null,
      chest: null,
      waist: null,
      upperArm: null,
      hips: null,
      thigh: null,
      calf: null,
    },
    sleep: {
      record: null,
      duration: null,
      quality: null,
    },
    bloodGlucose: {
      records: [],
      values: [],
    },
    emotion: {
      records: [],
      latest: null,
    },
  };
}

/**
 * Calculate nutrition totals from food records
 */
function calculateNutritionTotals(foodRecords: any[]): { carbs: number; protein: number; fat: number } {
  const totals = { carbs: 0, protein: 0, fat: 0 };

  foodRecords.forEach(record => {
    if (record.nutrition_data) {
      totals.carbs += record.nutrition_data.carbs || 0;
      totals.protein += record.nutrition_data.protein || 0;
      totals.fat += record.nutrition_data.fat || 0;
    }
  });

  return {
    carbs: Math.round(totals.carbs),
    protein: Math.round(totals.protein),
    fat: Math.round(totals.fat),
  };
}

/**
 * Convert health records to dashboard records format
 */
function convertHealthRecordsToDashboardRecords(healthData: DayHealthData): Array<any> {
  const records: Array<any> = [];

  // Add food records
  healthData.food.records.forEach(record => {
    if (record.nutrition_data) {
      records.push({
        id: record.id,
        type: 'food' as const,
        name: record.nutrition_data.name || 'Unknown Food',
        calories: record.value,
        time: new Date(record.recorded_at).toTimeString().slice(0, 5),
        nutrition_data: record.nutrition_data,
      });
    }
  });

  // Add exercise records（health_records 行或 ExerciseRecord 扁平结构）
  healthData.exercise.records.forEach((record: any) => {
    const ed =
      record.exercise_data && typeof record.exercise_data === 'object'
        ? record.exercise_data
        : {
            name: record.exercise_name,
            exercise_type: record.exercise_type,
            duration: record.duration,
            calories_burned: record.calories_burned,
            intensity: record.intensity,
            source: record.source,
          };
    const name = ed.name || record.exercise_name;
    if (!name && !record.exercise_name) return;
    const calories = Number(record.value ?? ed.calories_burned ?? record.calories_burned ?? 0);
    records.push({
      id: record.id,
      type: 'exercise' as const,
      name: (name as string) || '运动',
      calories,
      time: new Date(record.recorded_at).toTimeString().slice(0, 5),
      exercise_data: { ...ed, name: (name as string) || '运动' },
    });
  });

  // Add water records
  healthData.water.records.forEach(record => {
    records.push({
      id: record.id,
      type: 'water' as const,
      name: `${record.value}ml`,
      time: new Date(record.recorded_at).toTimeString().slice(0, 5),
    });
  });

  // Sort by time
  records.sort((a, b) => a.time.localeCompare(b.time));

  return records;
}

/**
 * Extract time from sleep data
 */
function extractTimeFromSleepData(sleepRecord: any, field: 'bedTime' | 'wakeTime'): string {
  if (!sleepRecord || !sleepRecord.notes) return '--:--';

  try {
    const sleepData = JSON.parse(sleepRecord.notes);
    return sleepData[field] || '--:--';
  } catch {
    return '--:--';
  }
}

/**
 * 与 Dashboard「饮食&运动」卡片一致：BMR 用档案公式；运动消耗含步数折算。
 */
function resolveBmrLikeDashboardCard(profile: UserProfile | null): number {
  if (!profile) return 1500;
  return calculateBMR(profile);
}

/**
 * Convert DayHealthData from database to DayData format for dashboard
 * @param resolvedFoodIntakeKcal 与 nutritionSyncService 当日合计一致（首页卡片同源）
 */
function convertHealthDataToDayData(
  healthData: DayHealthData,
  targetWeight: number,
  userProfile: UserProfile | null = null,
  resolvedFoodIntakeKcal: number,
): DayData {
  // Calculate nutrition totals from food records
  const nutritionTotals = calculateNutritionTotals(healthData.food.records);

  // Generate hourly data for steps
  const hourlySteps = healthData.steps.hourlyData.length > 0
    ? healthData.steps.hourlyData
    : new Array(24).fill(0);

  // Convert health records to dashboard records format
  const records = convertHealthRecordsToDashboardRecords(healthData);

  // 与营养详情一致：仅订单/定制食谱同步（nutrition_data.syncId）可点亮早/午/晚；手动与 AI 不占用这三档
  const mealTypeToKey: Record<string, 'breakfast' | 'lunch' | 'dinner'> = {
    早餐: 'breakfast',
    午餐: 'lunch',
    晚餐: 'dinner',
    breakfast: 'breakfast',
    lunch: 'lunch',
    dinner: 'dinner',
  };
  const mealIntakeStatus: DayData['mealIntakeStatus'] = {};
  healthData.food.records.forEach((r) => {
    const nd = r.nutrition_data;
    if (!isOrderSyncedFoodNutrition(nd)) return;
    const mt = nd?.mealType;
    const key = mt != null ? mealTypeToKey[String(mt)] : undefined;
    if (key && !mealIntakeStatus[key]) {
      mealIntakeStatus[key] = { intakeCompletedAt: r.recorded_at };
    }
  });

  const bmrBaseline = resolveBmrLikeDashboardCard(userProfile);
  const userWeightKg =
    typeof userProfile?.current_weight === 'number' &&
    Number.isFinite(userProfile.current_weight) &&
    userProfile.current_weight > 0
      ? userProfile.current_weight
      : 70;
  const stepsDataWithFloors = calculateStepsData(healthData.steps.total, 0, userWeightKg);
  const totalExerciseKcal =
    Math.round(healthData.exercise.totalCalories) + Math.round(stepsDataWithFloors.totalCalories);

  const foodIntakeKcal = Math.max(0, Math.round(resolvedFoodIntakeKcal));
  /** 与 Dashboard CaloriesCard 的 netCalories 同式：摄入 − 运动(含步数) − BMR */
  const netCalorieBalance = Math.round(foodIntakeKcal - totalExerciseKcal - bmrBaseline);
  /** 作进度条参考上限，与三环页「总摄入」目标 bmr*1.5 对齐 */
  const targetIntakeReference = Math.max(1, Math.round(bmrBaseline * 1.5));

  // Use profile water_intake if available, otherwise default to 2000ml
  const waterTarget = userProfile?.water_intake || 2000;

  const stepsTargetDefault = 8000;
  const rawStepsGoal = userProfile?.daily_steps_goal;
  const stepsTarget =
    typeof rawStepsGoal === 'number' &&
    Number.isFinite(rawStepsGoal) &&
    rawStepsGoal >= 1000 &&
    rawStepsGoal <= 100000
      ? Math.round(rawStepsGoal)
      : stepsTargetDefault;

  const sleepTargetHours = userProfile?.sleep_hours || 0;

  /** 仅有当日睡眠 health_record 时视为「有记录」，避免用问卷目标时长冒充已测睡眠 */
  const hasSleepRecord = healthData.sleep.record !== null;
  const fromNotes = healthData.sleep.duration != null && healthData.sleep.duration > 0
    ? healthData.sleep.duration
    : null;
  const fromValue =
    hasSleepRecord && healthData.sleep.record && Number(healthData.sleep.record.value) > 0
      ? Number(healthData.sleep.record.value)
      : null;
  const sleepDuration =
    fromNotes != null ? fromNotes : fromValue != null ? fromValue : hasSleepRecord ? sleepTargetHours : 0;

  return {
    calories: {
      remaining: netCalorieBalance,
      total: targetIntakeReference,
      foodIntake: foodIntakeKcal,
      exerciseBurned: totalExerciseKcal,
    },
    weight: {
      current: healthData.weight.latest,
      target: targetWeight,
      hasRecord: healthData.weight.hasRecord,
    },
    nutrition: {
      carbs: {
        current: nutritionTotals.carbs,
        target: 178,
      },
      protein: {
        current: nutritionTotals.protein,
        target: 120,
      },
      fat: {
        current: nutritionTotals.fat,
        target: 73,
      },
    },
    water: {
      current: healthData.water.total,
      target: waterTarget,
    },
    steps: {
      current: healthData.steps.total,
      target: stepsTarget,
      hourlyData: hourlySteps,
      // 爬楼层数：当前 health_records 步数未存该字段；设备同步前固定 0，避免伪造数据
      floors: 0,
    },
    exercise: {
      calories: healthData.exercise.totalCalories,
      minutes: healthData.exercise.totalDuration,
    },
    measurements: {
      chest: healthData.measurements.chest,
      waist: healthData.measurements.waist,
      upperArm: healthData.measurements.upperArm,
      hips: healthData.measurements.hips,
      thigh: healthData.measurements.thigh,
      calf: healthData.measurements.calf,
    },
    emotion: {
      current: healthData.emotion.records.length > 0
        ? (healthData.emotion.latest?.emotion || 'neutral')
        : 'neutral',
      intensity:
        healthData.emotion.records.length > 0 ? (healthData.emotion.latest?.intensity ?? 0.5) : 0,
      hasRecord: healthData.emotion.records.length > 0,
    },
    sleep: {
      duration: sleepDuration ?? 0,
      quality: healthData.sleep.quality || 0,
      bedTime: extractTimeFromSleepData(healthData.sleep.record, 'bedTime'),
      wakeTime: extractTimeFromSleepData(healthData.sleep.record, 'wakeTime'),
      hasRecord: hasSleepRecord,
    },
    bloodGlucose: {
      current: healthData.bloodGlucose.values.length > 0
        ? healthData.bloodGlucose.values[healthData.bloodGlucose.values.length - 1].value
        : null,
      target: { min: 70, max: 100 },
      hasRecord: healthData.bloodGlucose.records.length > 0,
      lastMeasurement: healthData.bloodGlucose.values.length > 0
        ? healthData.bloodGlucose.values[healthData.bloodGlucose.values.length - 1].time
        : '--:--',
    },
    records,
    mealIntakeStatus: Object.keys(mealIntakeStatus).length > 0 ? mealIntakeStatus : undefined,
  };
}

export const dashboardDataService = {
  /**
   * Get complete health data for a specific day
   * 聚合各个独立Service的数据，符合3层架构：组件 → Hook → dashboardDataService → 各Service → Supabase
   */
  async getDayHealthData(date: Date): Promise<DayHealthData> {
    const userId = await getUserId();
    if (!userId) {
      return getEmptyDayData(date);
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { start: foodBeijingStart, end: foodBeijingEnd } = getBeijingDayBoundsForInstant(date);

    try {
      // 并行调用各个独立的Service获取数据
      const [
        weightRecords,
        waterRecords,
        stepsRecords,
        foodRecords,
        measurementRecords,
        sleepRecords,
        bloodGlucoseRecords,
        exerciseRecords,
        emotionRecords,
      ] = await Promise.all([
        weightService.getRecords(userId, startOfDay, endOfDay),
        waterService.getRecords(userId, startOfDay, endOfDay),
        stepsService.getRecords(userId, startOfDay, endOfDay),
        foodService.getRecords(userId, foodBeijingStart, foodBeijingEnd),
        measurementsService.getRecords(userId, startOfDay, endOfDay),
        sleepService.getRecords(userId, startOfDay, endOfDay),
        bloodGlucoseService.getRecords(userId, startOfDay, endOfDay),
        exerciseService.getExercisesByDateRange(startOfDay.toISOString(), endOfDay.toISOString()),
        emotionService.getEmotionRecords(userId, startOfDay, endOfDay),
      ]);

      // Process weight data
      const latestWeight = weightRecords.length > 0
        ? weightRecords[weightRecords.length - 1].value
        : null;

      // Process water data
      const totalWater = waterRecords.reduce((sum, record) => {
        const value = Number(record.value) || 0;
        return sum + value;
      }, 0);

      // Process steps data
      const totalSteps = stepsRecords.reduce((sum, record) => sum + record.value, 0);
      const hourlySteps = generateHourlyStepsData(stepsRecords as HealthRecord[]);

      // Process food data
      const totalFoodCalories = foodRecords.reduce((sum, record) => {
        const calories = record.nutrition_data?.calories || record.value || 0;
        return sum + calories;
      }, 0);

      // Process exercise data
      const totalExerciseCalories = exerciseRecords.reduce(
        (sum, record) => sum + (record.calories_burned || 0),
        0
      );
      const totalExerciseDuration = exerciseRecords.reduce(
        (sum, record) => sum + (record.duration || 0),
        0
      );

      // Process measurement data
      const latestMeasurement = measurementRecords.length > 0
        ? measurementRecords[measurementRecords.length - 1]
        : null;
      const measurementData = latestMeasurement?.measurement_data || {};

      // Process sleep data
      const latestSleep = sleepRecords.length > 0
        ? sleepRecords[sleepRecords.length - 1]
        : null;
      let sleepData: { duration?: number; quality?: number } = {};
      if (latestSleep?.notes) {
        try {
          // Try to parse as JSON, if it fails, treat as plain text
          sleepData = JSON.parse(latestSleep.notes) as { duration?: number; quality?: number };
        } catch {
          // If notes is not valid JSON (e.g., plain text like "手动记录"), use empty object
          sleepData = {};
        }
      }

      // Process blood glucose data
      const glucoseValues = bloodGlucoseRecords.map(record => ({
        time: new Date(record.recorded_at).toTimeString().slice(0, 5),
        value: record.value,
      }));

      // Process emotion data
      const latestEmotion = emotionRecords.length > 0
        ? emotionRecords[emotionRecords.length - 1]
        : null;

      return {
        date,
        weight: {
          records: weightRecords as HealthRecord[],
          latest: latestWeight,
          hasRecord: weightRecords.length > 0,
        },
        water: {
          records: waterRecords as HealthRecord[],
          total: Math.round(totalWater),
        },
        steps: {
          records: stepsRecords as HealthRecord[],
          total: Math.round(totalSteps),
          hourlyData: hourlySteps,
        },
        food: {
          records: foodRecords as HealthRecord[],
          totalCalories: Math.round(totalFoodCalories),
        },
        exercise: {
          records: exerciseRecords,
          totalCalories: Math.round(totalExerciseCalories),
          totalDuration: Math.round(totalExerciseDuration),
        },
        measurements: {
          record: latestMeasurement as HealthRecord | null,
          chest: measurementData.chest || null,
          waist: measurementData.waist || null,
          upperArm: measurementData.upperArm || null,
          hips: measurementData.hips || null,
          thigh: measurementData.thigh || null,
          calf: measurementData.calf || null,
        },
        sleep: {
          record: latestSleep as HealthRecord | null,
          duration: sleepData.duration || null,
          quality: sleepData.quality || null,
        },
        bloodGlucose: {
          records: bloodGlucoseRecords as HealthRecord[],
          values: glucoseValues,
        },
        emotion: {
          records: emotionRecords,
          latest: latestEmotion,
        },
      };
    } catch (error) {
      console.error('[DashboardDataService] Error in getDayHealthData:', error);
      return getEmptyDayData(date);
    }
  },

  /**
   * Get dashboard data for a specific date
   * 统一使用 React Query 管理缓存，不再使用 localStorage
   * This intelligently decides whether to show real data, empty data, or tutorial data
   */
  async getDayData(date: Date, options: DashboardDataOptions = {}): Promise<DayData> {
    const { showTutorialData = false, targetWeight = 60.0, userProfile = null } = options;

    // If in tutorial mode, always return mock data
    if (showTutorialData) {
      return generateMockData(date);
    }

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Anonymous users see tutorial data
      return generateMockData(date);
    }

    // 直接从数据库获取数据，缓存由 React Query 管理
    const healthData = await dashboardDataService.getDayHealthData(date);
    let resolvedFoodKcal = healthData.food.totalCalories;
    try {
      const nut = await nutritionSyncService.getDailyNutritionTotals(date);
      resolvedFoodKcal = Math.round(nut.totalCalories);
    } catch (e) {
      console.warn('[DashboardDataService] getDailyNutritionTotals failed, using record sum', e);
    }
    const dayData = convertHealthDataToDayData(healthData, targetWeight, userProfile, resolvedFoodKcal);

    return dayData;
  },

  /**
   * Check if user has any health data
   * 直接使用 Supabase 查询，符合 3 层架构规范
   */
  async hasAnyHealthData(): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;

    try {
      // 检查是否有任意类型的健康记录（只查询一条即可）
      const { data, error } = await supabase
        .from('health_records')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is fine
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('[DashboardDataService] Error in hasAnyHealthData:', error);
      return false;
    }
  },

  /**
   * Check if user should see tutorial data
   * - New users who just registered
   * - Users who haven't completed onboarding
   */
  async shouldShowTutorialData(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return true; // Anonymous users see tutorial
    }

    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed, has_seen_onboarding')
      .eq('user_id', user.id)
      .maybeSingle();

    // Show tutorial if user hasn't seen onboarding yet
    if (!profile || !profile.has_seen_onboarding) {
      return true;
    }

    // Check if user has any health data
    const hasData = await dashboardDataService.hasAnyHealthData();

    // Don't show tutorial if user has data
    return !hasData;
  },
};
