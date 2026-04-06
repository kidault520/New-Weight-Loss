import { supabase } from '../config/supabase';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { getDeliveryMealTimeRange } from '../constants/deliveryMealTimes';
import { toLocalDateString } from '../utils/dateUtils';

export interface MealDeliveryItem {
  id: string;
  delivery_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  meal_name: string;
  is_demo_data?: boolean;
  delivery_time_start: string;
  delivery_time_end: string;
  delivery_address: string;
  delivery_address_label?: string;
  status: string;
}

export interface DeliveryDayGroup {
  date: Date;
  dayLabel: string;
  dateLabel: string;
  meals: MealDeliveryItem[];
}

export function getNext3Days(startDate?: Date): Date[] {
  const start = startDate || new Date();
  start.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push(date);
  }

  return days;
}

/**
 * Calculate the dynamic 3-day window for delivery plan
 * Rules:
 * 1. Default: Show first 3 days from plan start date
 * 2. If first 3 days include today: Update every 3 days (today, today+1, today+2) until end date
 * 3. If first 3 days don't include today: Keep showing first 3 days until first day equals today, then start rule 2
 *
 * @param planStartDate - The start date of the meal plan
 * @param planEndDate - The end date of the meal plan
 * @returns Array of 3 dates to display
 */
export function getDynamic3DayWindow(planStartDate: Date, planEndDate: Date): Date[] {
  // Normalize all dates to midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(planStartDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(planEndDate);
  endDate.setHours(0, 0, 0, 0);

  console.log('🔄 [Dynamic Window] ==================');
  console.log('🔄 [Dynamic Window] Today:', toLocalDateString(today));
  console.log('🔄 [Dynamic Window] Plan Start:', toLocalDateString(startDate));
  console.log('🔄 [Dynamic Window] Plan End:', toLocalDateString(endDate));

  // Get the first 3 days of the plan
  const firstThreeDays: Date[] = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    if (date <= endDate) {
      firstThreeDays.push(date);
    }
  }

  // Check if today is within the first 3 days
  const todayInFirstThree = firstThreeDays.some(date =>
    date.getTime() === today.getTime()
  );

  console.log('🔄 [Dynamic Window] First 3 days:', firstThreeDays.map(d => toLocalDateString(d)));
  console.log('🔄 [Dynamic Window] Today in first 3?', todayInFirstThree);

  // Rule 3: If today is before the plan start, show first 3 days
  if (today < startDate) {
    console.log('🔄 [Dynamic Window] Result: Today is before plan start, showing first 3 days');
    console.log('🔄 [Dynamic Window] ==================\n');
    return firstThreeDays;
  }

  // Rule 2: If today is within the first 3 days OR today is past the first day
  // Calculate the dynamic 3-day window from today
  if (todayInFirstThree || today >= startDate) {
    // Calculate how many days to show from today
    const daysToShow: Date[] = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Don't exceed the plan end date
      if (date <= endDate) {
        daysToShow.push(date);
      }
    }

    console.log('🔄 [Dynamic Window] Result: Dynamic window from today');
    console.log('🔄 [Dynamic Window] Days:', daysToShow.map(d => toLocalDateString(d)));
    console.log('🔄 [Dynamic Window] ==================\n');
    return daysToShow;
  }

  // Rule 1: Default - show first 3 days
  console.log('🔄 [Dynamic Window] Result: Default first 3 days');
  console.log('🔄 [Dynamic Window] ==================\n');
  return firstThreeDays;
}

export function formatDayLabel(date: Date, index: number, planStartDate?: Date): string {
  let dayNumber = index + 1; // Default to index-based numbering

  // If planStartDate is provided, calculate the actual day number from plan start
  if (planStartDate) {
    const normalizedStartDate = new Date(planStartDate);
    normalizedStartDate.setHours(0, 0, 0, 0);

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((normalizedDate.getTime() - normalizedStartDate.getTime()) / (1000 * 60 * 60 * 24));
    dayNumber = daysDiff + 1;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `第${dayNumber}天 ${month}.${day}`;
}

export function getMealTimeRange(mealType: string): { start: string; end: string } {
  return getDeliveryMealTimeRange(mealType);
}

export function getMealTypeName(mealType: string): string {
  const mealTypeNames: Record<string, string> = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐'
  };

  return mealTypeNames[mealType] || mealType;
}

/**
 * 检查是否可以修改配送地址
 * 规则：
 * 1. 过去的日期 → 不能修改（返回 true = 锁定）
 * 2. 今天的餐次 → 如果当前时间在配送时间的1小时内 → 不能修改（返回 true = 锁定）
 * 3. 未来的餐次 → 可以修改（返回 false = 允许修改）
 *
 * @param deliveryDate - 配送日期 (YYYY-MM-DD 格式)
 * @param deliveryTimeStart - 配送时间 (HH:MM 格式)
 * @returns true = 锁定修改，false = 允许修改
 */
export function isWithinOneHourOfDelivery(deliveryDate: string, deliveryTimeStart: string): boolean {
  // 获取当前时间（本地时间）
  const now = new Date();

  // 规范化配送日期格式
  const normalizedDeliveryDate = deliveryDate.includes('T')
    ? deliveryDate.split('T')[0]
    : deliveryDate;

  // 获取今天的日期字符串 (YYYY-MM-DD) - 使用本地时间而不是 UTC
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  console.log('🔍 [修改权限检查] ==================');
  console.log('🔍 当前时间:', now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('🔍 当前时间（小时）:', now.getHours(), ':', now.getMinutes());
  console.log('🔍 配送日期:', normalizedDeliveryDate);
  console.log('🔍 今天日期:', todayStr);
  console.log('🔍 配送时间:', deliveryTimeStart);

  // 规则1: 过去的日期 → 锁定
  if (normalizedDeliveryDate < todayStr) {
    console.log('❌ 规则1: 过去的日期 → 锁定修改');
    console.log('🔍 ==================\n');
    return true;
  }

  // 规则3: 未来的日期 → 允许修改
  if (normalizedDeliveryDate > todayStr) {
    console.log('✅ 规则3: 未来的日期 → 允许修改');
    console.log('🔍 ==================\n');
    return false;
  }

  // 规则2: 今天的餐次 → 检查是否在配送时间的1小时内
  console.log('⏰ 规则2: 今天的餐次 → 检查时间差...');

  // 解析配送时间
  const [hours, minutes] = deliveryTimeStart.split(':').map(Number);

  // 创建今天的配送时间点
  const deliveryDateTime = new Date(now);
  deliveryDateTime.setHours(hours, minutes, 0, 0);

  // 计算时间差（毫秒）
  const timeDiff = deliveryDateTime.getTime() - now.getTime();
  const oneHourInMs = 60 * 60 * 1000; // 1小时 = 3600000 毫秒
  const timeDiffMinutes = Math.floor(timeDiff / (1000 * 60));

  console.log('⏰ 配送时间点:', deliveryDateTime.toLocaleTimeString('zh-CN'));
  console.log('⏰ 时间差:', timeDiffMinutes, '分钟');
  console.log('⏰ 是否在1小时内:', timeDiff <= oneHourInMs);

  // 如果距离配送时间 <= 1小时（或已过期），则锁定
  if (timeDiff <= oneHourInMs) {
    console.log('❌ 规则2结果: 距离配送时间不足1小时 → 锁定修改');
    console.log('🔍 ==================\n');
    return true;
  } else {
    console.log('✅ 规则2结果: 距离配送时间超过1小时 → 允许修改');
    console.log('🔍 ==================\n');
    return false;
  }
}

/**
 * Check if a meal can be modified based on time restrictions
 */
export function canModifyMealAddress(meal: MealDeliveryItem): boolean {
  return !isWithinOneHourOfDelivery(meal.delivery_date, meal.delivery_time_start);
}

export async function fetchDeliveryPlan(
  userId: string | null,
  startDate: Date,
  deliveryAddressId?: string,
  endDate?: Date
): Promise<DeliveryDayGroup[]> {
  void userId;
  try {
    // Use dynamic 3-day window if endDate is provided, otherwise use the original logic
    const threeDays = endDate
      ? getDynamic3DayWindow(startDate, endDate)
      : getNext3Days(startDate);

    let addressText = '时代国际嘉园3号楼1单元303';
    let addressLabel = '家';

    if (deliveryAddressId) {
      // Fetch from database
      const { data: addressData } = await supabase
        .from('delivery_addresses')
        .select('address, door_number, label')
        .eq('id', deliveryAddressId)
        .eq('is_deleted', false)
        .maybeSingle();

      if (addressData) {
        // Only concatenate if door_number is not already in address
        const fullAddress = addressData.address.includes(addressData.door_number)
          ? addressData.address
          : `${addressData.address} ${addressData.door_number}`;
        addressText = fullAddress;
        addressLabel = addressData.label || '家';
      }
    }

    const mockMeals: MealDeliveryItem[] = [];

    threeDays.forEach((date) => {
      const dateStr = toLocalDateString(date);

      ['lunch', 'dinner'].forEach((mealType) => {
        const timeRange = getMealTimeRange(mealType);

        mockMeals.push({
          id: `${dateStr}-${mealType}`,
          delivery_date: dateStr,
          meal_type: mealType as 'lunch' | 'dinner',
          meal_name: '演示数据·瑞迈获健康餐',
          is_demo_data: true,
          delivery_time_start: timeRange.start,
          delivery_time_end: timeRange.end,
          delivery_address: addressText,
          delivery_address_label: addressLabel,
          status: 'pending'
        });
      });
    });

    const groupedData: DeliveryDayGroup[] = threeDays.map((date, index) => {
      const dateStr = toLocalDateString(date);
      const dayMeals = mockMeals.filter(meal => meal.delivery_date === dateStr);

      return {
        date,
        dayLabel: formatDayLabel(date, index, startDate),
        dateLabel: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        meals: dayMeals
      };
    });

    return groupedData;
  } catch (error) {
    console.error('Error fetching delivery plan:', error);
    return [];
  }
}

/**
 * Batch update meal addresses for the first N days
 * Updates localStorage mealAddresses (用户隔离)
 */
export async function batchUpdateMealAddresses(addressId: string, days: number = 3): Promise<{ success: boolean; count: number }> {
  try {
    const mealAddresses = await getUserStorageItem<Record<string, string>>('mealAddresses') || {};

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let updatedCount = 0;

    // Generate the next N days
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = toLocalDateString(date);

      // Update all meal types for this date
      ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
        const mealKey = `${dateStr}-${mealType}`;
        mealAddresses[mealKey] = addressId;
        updatedCount++;
      });
    }

    // Save back to localStorage (用户隔离)
    await setUserStorageItem('mealAddresses', mealAddresses);

    console.log(`Batch updated ${updatedCount} meal addresses to addressId: ${addressId}`);

    return { success: true, count: updatedCount };
  } catch (error) {
    console.error('Error in batchUpdateMealAddresses:', error);
    return { success: false, count: 0 };
  }
}
