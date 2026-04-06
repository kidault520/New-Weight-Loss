const DELIVERY_MEAL_TIME_RANGES = {
  breakfast: { start: '08:00', end: '09:00' },
  lunch: { start: '11:30', end: '12:30' },
  dinner: { start: '17:30', end: '18:30' },
};

function getDeliveryMealTimeRange(mealType) {
  const key = String(mealType || '').toLowerCase();
  return DELIVERY_MEAL_TIME_RANGES[key] || DELIVERY_MEAL_TIME_RANGES.lunch;
}

module.exports = {
  DELIVERY_MEAL_TIME_RANGES,
  getDeliveryMealTimeRange,
};
