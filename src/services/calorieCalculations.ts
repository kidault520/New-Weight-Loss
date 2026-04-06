import { calculateStepsCalories, calculateStairsCalories, stepsToDistance } from '../utils/bmrCalculations';
import { ActivityLevel, getActivityMultiplier } from '../utils/activityLevelCalculations';

export interface StepsCalorieData {
  steps: number;
  distance: number;
  calories: number;
  floors: number;
  floorsCalories: number;
  totalCalories: number;
}

export const calculateStepsData = (
  steps: number,
  floors: number,
  userWeightKg: number,
  averageStrideMeters: number = 0.78
): StepsCalorieData => {
  const distance = stepsToDistance(steps, averageStrideMeters);
  const calories = calculateStepsCalories(userWeightKg, steps, averageStrideMeters);
  const floorsCalories = calculateStairsCalories(userWeightKg, floors);
  const totalCalories = calories + floorsCalories;

  return {
    steps,
    distance,
    calories,
    floors,
    floorsCalories,
    totalCalories,
  };
};

export const calculateExerciseCalories = (
  activityType: string,
  durationMinutes: number,
  userWeightKg: number
): number => {
  const metValues: Record<string, number> = {
    walking: 3.5,
    running: 9.8,
    cycling: 7.5,
    swimming: 8.0,
    yoga: 2.5,
    weightlifting: 6.0,
    basketball: 8.0,
    soccer: 10.0,
    tennis: 7.3,
    dancing: 4.5,
  };

  const met = metValues[activityType.toLowerCase()] || 5.0;
  const caloriesPerMinute = (met * 3.5 * userWeightKg) / 200;
  return Math.round(caloriesPerMinute * durationMinutes);
};

export const calculateDailyCalorieTarget = (
  bmr: number,
  activityLevel: ActivityLevel,
  weightGoal: 'maintain' | 'lose' | 'gain' = 'maintain'
): number => {
  const multiplier = getActivityMultiplier(activityLevel);
  let targetCalories = bmr * multiplier;

  switch (weightGoal) {
    case 'lose':
      targetCalories -= 500;
      break;
    case 'gain':
      targetCalories += 500;
      break;
  }

  return Math.round(targetCalories);
};

export const calculateProteinTarget = (userWeightKg: number, activityLevel: ActivityLevel): number => {
  const proteinPerKg: Record<ActivityLevel, number> = {
    sedentary: 0.8,
    light: 1.2,
    moderate: 1.6,
    active: 2.0,
    very_active: 2.2,
  };

  const multiplier = proteinPerKg[activityLevel] || 1.2;
  return Math.round(userWeightKg * multiplier);
};

export const calculateCarbsTarget = (totalCalories: number): number => {
  return Math.round((totalCalories * 0.5) / 4);
};

export const calculateFatTarget = (totalCalories: number): number => {
  return Math.round((totalCalories * 0.25) / 9);
};
