export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  current_weight: number;
  height: number;
  target_weight?: number;
  unit_preference?: 'metric' | 'imperial';
  bmr?: number;
  nickname?: string;
  display_user_id?: string;
  birthday?: Date | string;
  initial_weight?: number;
  target_completion_date?: Date | string;
  dietary_preferences?: string[]; // 统一使用数组格式，与数据库一致
  food_allergies?: string;
  special_conditions?: string;
  avatar_url?: string;
  fitness_goal?: 'weight_loss' | 'maintain_health' | 'confidence' | 'muscle_gain' | 'other';
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  phone?: string;
  profile_created_at?: Date | string;
  exercise_habits?: string[];
  sleep_hours?: number;
  water_intake?: number;
  /** 每日步数目标（步）；未设置时应用内默认 8000 */
  daily_steps_goal?: number;
  health_concerns?: string[];
  meal_plan_configured?: boolean;
  meal_plan_config_data?: any;
  // Onboarding flags (used by App routing logic)
  has_seen_onboarding?: boolean;
  onboarding_completed?: boolean;
  user_id?: string;
}

export const calculateBMR = (profile: UserProfile): number => {
  const { gender, age, current_weight, height } = profile;

  // Validate inputs
  if (!gender || !age || !current_weight || !height) {
    console.warn('⚠️ calculateBMR: Missing required fields', { gender, age, current_weight, height });
    return 1500; // Return default BMR
  }

  let bmr: number;

  if (gender === 'male') {
    bmr = (10 * current_weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmr = (10 * current_weight) + (6.25 * height) - (5 * age) - 161;
  }

  return Math.round(bmr);
};


export const calculateWalkingCalories = (
  weightKg: number,
  distanceKm: number
): number => {
  return Math.round(weightKg * distanceKm);
};

export const calculateStepsCalories = (
  weightKg: number,
  steps: number,
  averageStrideMeters: number = 0.78
): number => {
  const distanceKm = (steps * averageStrideMeters) / 1000;
  return calculateWalkingCalories(weightKg, distanceKm);
};

export const calculateStairsCalories = (
  weightKg: number,
  floors: number
): number => {
  return Math.round((weightKg / 70) * floors * 10);
};

export const stepsToDistance = (
  steps: number,
  averageStrideMeters: number = 0.78
): number => {
  return Number(((steps * averageStrideMeters) / 1000).toFixed(2));
};

export const kgToLbs = (kg: number): number => {
  return Number((kg * 2.20462).toFixed(1));
};

export const lbsToKg = (lbs: number): number => {
  return Number((lbs / 2.20462).toFixed(1));
};

export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

export const feetInchesToCm = (feet: number, inches: number): number => {
  return Number(((feet * 12 + inches) * 2.54).toFixed(1));
};

export const calculateAge = (birthday: Date | string): number => {
  const birthDate = typeof birthday === 'string' ? new Date(birthday) : birthday;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

export const calculateBMI = (weightKg: number, heightCm: number): number => {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Number(bmi.toFixed(1));
};

export const getBMICategory = (bmi: number): string => {
  if (bmi < 18.5) return '偏瘦';
  if (bmi < 24) return '正常';
  if (bmi < 28) return '偏胖';
  return '肥胖';
};
