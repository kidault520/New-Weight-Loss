import { supabase } from '../config/supabase';
import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from '../utils/userStorage';
import { parseDateStringSafe, toBeijingDateString } from '../utils/dateUtils';
import { fetchContractMealSlotsEnForUser } from './orderMealPlanSlots';
import { intersectMealTypesEn } from '../utils/mealSlotMapping';


export interface MealPlanConfiguration {
  selectedDates: Date[];
  selectedMealTypes: string[];
  deliveryAddressId: string;
  startDate: Date;
  endDate: Date;
}

export interface MealPlanConfigData {
  selected_dates: string[];
  selected_meal_types: string[];
  delivery_address_id: string;
  start_date: string;
  end_date: string;
}

/**
 * Check if user has completed meal plan configuration
 */
export async function checkMealPlanConfigured(userId: string | null): Promise<boolean> {
  try {
    if (!userId) {
      const localConfig = await getUserStorageItem<string>('meal_plan_configured');
      return localConfig === 'true';
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('meal_plan_configured')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking meal plan configuration:', error);
      return false;
    }

    return data?.meal_plan_configured || false;
  } catch (error) {
    console.error('Error in checkMealPlanConfigured:', error);
    return false;
  }
}

/**
 * Get user's meal plan configuration
 */
export async function getMealPlanConfig(userId: string | null): Promise<MealPlanConfiguration | null> {
  try {
    if (!userId) {
      const localConfig = await getUserStorageItem<MealPlanConfigData>('meal_plan_config_data');
      if (!localConfig) return null;

      const configData: MealPlanConfigData = localConfig;
      return {
        selectedDates: configData.selected_dates.map(d => parseDateStringSafe(d)),
        selectedMealTypes: configData.selected_meal_types,
        deliveryAddressId: configData.delivery_address_id,
        startDate: parseDateStringSafe(configData.start_date),
        endDate: parseDateStringSafe(configData.end_date)
      };
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('meal_plan_config_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data?.meal_plan_config_data) {
      const configData = data.meal_plan_config_data as MealPlanConfigData;
      return {
        selectedDates: configData.selected_dates?.map(d => parseDateStringSafe(d)) || [],
        selectedMealTypes: configData.selected_meal_types || [],
        deliveryAddressId: configData.delivery_address_id,
        startDate: parseDateStringSafe(configData.start_date),
        endDate: parseDateStringSafe(configData.end_date)
      };
    }

    const localConfig = await getUserStorageItem<MealPlanConfigData>('meal_plan_config_data');
    if (localConfig) {
      return {
        selectedDates: localConfig.selected_dates?.map(d => parseDateStringSafe(d)) || [],
        selectedMealTypes: localConfig.selected_meal_types || [],
        deliveryAddressId: localConfig.delivery_address_id,
        startDate: parseDateStringSafe(localConfig.start_date),
        endDate: parseDateStringSafe(localConfig.end_date)
      };
    }

    return null;
  } catch (error) {
    console.error('Error in getMealPlanConfig:', error);
    return null;
  }
}

/**
 * Save user's meal plan configuration
 */
export async function saveMealPlanConfig(
  userId: string | null,
  config: MealPlanConfiguration
): Promise<boolean> {
  try {
    const configData: MealPlanConfigData = {
      selected_dates: config.selectedDates.map(d => toBeijingDateString(d)),
      selected_meal_types: config.selectedMealTypes,
      delivery_address_id: config.deliveryAddressId,
      start_date: toBeijingDateString(config.startDate),
      end_date: toBeijingDateString(config.endDate)
    };

    if (!userId) {
      await setUserStorageItem('meal_plan_configured', 'true');
      await setUserStorageItem('meal_plan_config_data', configData);
      return true;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        meal_plan_configured: true,
        meal_plan_config_data: configData
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error saving meal plan configuration:', error);
      return false;
    }

    await setUserStorageItem('meal_plan_configured', 'true');
    await setUserStorageItem('meal_plan_config_data', configData);
    return true;
  } catch (error) {
    console.error('Error in saveMealPlanConfig:', error);
    return false;
  }
}

/**
 * Clear/reset user's meal plan configuration
 */
export async function clearMealPlanConfig(userId: string | null): Promise<boolean> {
  try {
    if (!userId) {
      await removeUserStorageItem('meal_plan_configured');
      await removeUserStorageItem('meal_plan_config_data');
      return true;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        meal_plan_configured: false,
        meal_plan_config_data: null
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing meal plan configuration:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in clearMealPlanConfig:', error);
    return false;
  }
}

function mealTypesNormalizedKey(types: string[] | undefined): string {
  return [...(types || [])]
    .map((x) => String(x).toLowerCase())
    .sort()
    .join(',');
}

export function mealPlanSelectedMealTypesDiffer(
  a: string[] | undefined,
  b: string[] | undefined
): boolean {
  return mealTypesNormalizedKey(a) !== mealTypesNormalizedKey(b);
}

/** 有订单时按合约餐次裁剪 selectedMealTypes；无订单或未命中合约则原样返回 */
export async function clampMealPlanConfigToContractSlots(
  userId: string | null,
  cfg: MealPlanConfiguration
): Promise<MealPlanConfiguration> {
  if (!userId) return cfg;
  try {
    const slots = await fetchContractMealSlotsEnForUser(userId);
    if (!slots?.length) return cfg;
    return {
      ...cfg,
      selectedMealTypes: intersectMealTypesEn(cfg.selectedMealTypes, slots),
    };
  } catch {
    return cfg;
  }
}

/**
 * 裁剪后与入库前不一致时写回 user_profiles（及本地 meal_plan_config_data），修正历史脏数据。
 * @returns 是否已执行写库且成功
 */
export async function persistClampedMealPlanConfigIfNeeded(
  userId: string | null,
  before: MealPlanConfiguration,
  after: MealPlanConfiguration
): Promise<boolean> {
  if (!mealPlanSelectedMealTypesDiffer(before.selectedMealTypes, after.selectedMealTypes)) {
    return false;
  }
  const ok = await saveMealPlanConfig(userId, after);
  if (ok) {
    console.log('[mealPlanConfigService] 已按合约同步 selected_meal_types 至 profile/本地');
  } else {
    console.warn('[mealPlanConfigService] 合约餐次同步写库失败');
  }
  return ok;
}
