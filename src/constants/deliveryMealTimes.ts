export type DeliveryMealType = 'breakfast' | 'lunch' | 'dinner';

export const DELIVERY_MEAL_TIME_RANGES: Record<DeliveryMealType, { start: string; end: string }> = {
  breakfast: { start: '08:00', end: '09:00' },
  lunch: { start: '11:30', end: '12:30' },
  dinner: { start: '17:30', end: '18:30' },
};

export const normalizeDeliveryMealType = (mealType: string): DeliveryMealType | null => {
  const key = String(mealType || '').trim().toLowerCase();
  if (!key) return null;
  if (key === 'breakfast' || key === '早餐') return 'breakfast';
  if (key === 'lunch' || key === '午餐') return 'lunch';
  if (key === 'dinner' || key === '晚餐') return 'dinner';
  return null;
};

export const getDeliveryMealTimeRange = (mealType: string): { start: string; end: string } => {
  const key = normalizeDeliveryMealType(mealType);
  return key ? DELIVERY_MEAL_TIME_RANGES[key] : DELIVERY_MEAL_TIME_RANGES.lunch;
};

export const getDeliveryMealStartTime = (mealType: string): string => {
  return getDeliveryMealTimeRange(mealType).start;
};
