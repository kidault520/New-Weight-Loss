import { supabase } from '../config/supabase';
import { handleAuthError } from './errorHandler';
import { getBeijingDayBoundsForInstant } from '../utils/dateUtils';
import { insertHealthRecordWithChatMessageFallback } from '../utils/healthRecordsInsert';

interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface DailyNutritionTotals {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  snackCalories: number;
  snackProtein: number;
  snackCarbs: number;
  snackFat: number;
}

export const nutritionSyncService = {
  /**
   * Calculate mock macronutrients based on calories
   * Uses standard ratios: 40% carbs, 30% protein, 30% fat
   */
  calculateMockMacros(calories: number): NutritionData {
    // Standard calorie-to-gram conversions:
    // 1g carbs = 4 calories
    // 1g protein = 4 calories
    // 1g fat = 9 calories

    const carbCalories = calories * 0.4;
    const proteinCalories = calories * 0.3;
    const fatCalories = calories * 0.3;

    return {
      calories,
      protein: Math.round(proteinCalories / 4),
      carbs: Math.round(carbCalories / 4),
      fat: Math.round(fatCalories / 9),
      fiber: Math.round(calories * 0.01) // Rough estimate: 1g fiber per 100 kcal
    };
  },

  /**
   * Get daily nutrition totals from health records
   */
  async getDailyNutritionTotals(date?: Date): Promise<DailyNutritionTotals> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      const targetDate = date || new Date();
      const { start: dayStart, end: dayEnd } = getBeijingDayBoundsForInstant(targetDate);

      // Fetch all food records for the day（按北京日历日与 dashboard / 日反馈一致）
      const { data: records, error } = await supabase
        .from('health_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('record_type', 'food')
        .gte('recorded_at', dayStart.toISOString())
        .lte('recorded_at', dayEnd.toISOString());

      if (error) {
        console.error('Error fetching nutrition data:', error);
        return this.getEmptyTotals();
      }

      if (!records || records.length === 0) {
        return this.getEmptyTotals();
      }

      // Calculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      let totalFiber = 0;
      let snackCalories = 0;
      let snackProtein = 0;
      let snackCarbs = 0;
      let snackFat = 0;

      for (const record of records) {
        const nutritionData = record.nutrition_data;

        if (nutritionData) {
          const calories = nutritionData.calories || 0;
          const mealType = nutritionData.mealType || '加餐';
          const isSnackSlot =
            mealType === '加餐' ||
            mealType === 'snack' ||
            String(mealType).toLowerCase() === 'snack';

          // Calculate macros (use stored values or calculate from calories)
          const macros = nutritionData.protein !== undefined
            ? {
                protein: nutritionData.protein,
                carbs: nutritionData.carbs,
                fat: nutritionData.fat,
                fiber: nutritionData.fiber || 0
              }
            : this.calculateMockMacros(calories);

          // Add to totals
          totalCalories += calories;
          totalProtein += macros.protein;
          totalCarbs += macros.carbs;
          totalFat += macros.fat;
          totalFiber += macros.fiber;

          // If it's a snack (加餐 / AI 统一写入的加餐)，加进加餐汇总
          if (isSnackSlot) {
            snackCalories += calories;
            snackProtein += macros.protein;
            snackCarbs += macros.carbs;
            snackFat += macros.fat;
          }
        }
      }

      const result = {
        totalCalories: Math.round(totalCalories),
        totalProtein: Math.round(totalProtein),
        totalCarbs: Math.round(totalCarbs),
        totalFat: Math.round(totalFat),
        totalFiber: Math.round(totalFiber),
        snackCalories: Math.round(snackCalories),
        snackProtein: Math.round(snackProtein),
        snackCarbs: Math.round(snackCarbs),
        snackFat: Math.round(snackFat)
      };

      return result;
    } catch (error) {
      console.error('Error calculating daily nutrition totals:', error);
      return this.getEmptyTotals();
    }
  },

  /**
   * Save food entry with calculated macros
   * @param timeLabel 加餐场景展示标签（中午/晚上），用于替代「午餐」「晚餐」的展示
   * @param chatMessageId 可选，用于跨表稳定关联
   * @param opts.syncId 订单/排期「完成摄入」等与定制食谱同步同属官方餐食，写入后与营养详情、日反馈早午晚行一致；手动+、AI 勿传
   */
  async saveFoodEntry(
    foodName: string,
    calories: number,
    mealType: string,
    quantity: number = 1,
    date?: Date,
    source?: 'ai' | 'manual',
    timeLabel?: string,
    chatMessageId?: string,
    opts?: { syncId?: string }
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      // calories is already the total calories (calculated as baseCalorie * quantity in healthMetricDetectionService)
      // So we don't need to multiply by quantity again
      const totalCalories = calories;

      // Calculate macros
      const macros = this.calculateMockMacros(totalCalories);

      const nutritionData: Record<string, any> = {
        name: foodName,
        calories: totalCalories,
        mealType: mealType,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        quantity: quantity,
        source: source || 'manual'
      };
      if (timeLabel) nutritionData.timeLabel = timeLabel;
      if (opts?.syncId) nutritionData.syncId = opts.syncId;

      const insertRow: Record<string, unknown> = {
        user_id: user.id,
        record_type: 'food',
        value: quantity,
        unit: '份',
        nutrition_data: nutritionData,
        recorded_at: date || new Date(),
      };
      if (chatMessageId) insertRow.chat_message_id = chatMessageId;

      const { error } = await insertHealthRecordWithChatMessageFallback(insertRow);
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving food entry:', error);
      throw error;
    }
  },

  /**
   * Get empty totals object
   */
  getEmptyTotals(): DailyNutritionTotals {
    return {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      snackCalories: 0,
      snackProtein: 0,
      snackCarbs: 0,
      snackFat: 0
    };
  },

  /**
   * Get nutrition goals based on user profile
   */
  async getNutritionGoals(): Promise<{ protein: number; carbs: number; fat: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('weight, height, gender, age, fitness_goal, tdee')
        .eq('user_id', user.id)
        .single();

      if (error || !profile) {
        // Return default goals
        return {
          protein: 120,
          carbs: 178,
          fat: 109
        };
      }

      // Calculate goals based on TDEE or use defaults
      const tdee = profile.tdee || 2000;

      // Standard distribution: 40% carbs, 30% protein, 30% fat
      return {
        protein: Math.round((tdee * 0.3) / 4), // 1g protein = 4 kcal
        carbs: Math.round((tdee * 0.4) / 4),   // 1g carbs = 4 kcal
        fat: Math.round((tdee * 0.3) / 9)      // 1g fat = 9 kcal
      };
    } catch (error) {
      console.error('Error getting nutrition goals:', error);
      return {
        protein: 120,
        carbs: 178,
        fat: 109
      };
    }
  }
};
