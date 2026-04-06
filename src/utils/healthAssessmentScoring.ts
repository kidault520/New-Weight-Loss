import { OnboardingData } from '../contexts/OnboardingContext';

export interface HealthScores {
  diet: number;
  fitness: number;
  rest: number;
  psychology: number;
  exercise: number;
  overall: number;
  primaryImprovementArea: string;
}

export interface ScoreBreakdownItem {
  rule: string;
  delta: number;
}

export interface HealthScoreBreakdown {
  diet: ScoreBreakdownItem[];
  fitness: ScoreBreakdownItem[];
  rest: ScoreBreakdownItem[];
  psychology: ScoreBreakdownItem[];
  exercise: ScoreBreakdownItem[];
}

export const calculateHealthScores = (data: OnboardingData): HealthScores => {
  const dietScore = calculateDietScore(data);
  const fitnessScore = calculateFitnessScore(data);
  const restScore = calculateRestScore(data);
  const psychologyScore = calculatePsychologyScore(data);
  const exerciseScore = calculateExerciseScore(data);

  const overall = Math.round(
    (dietScore + fitnessScore + restScore + psychologyScore + exerciseScore) / 5
  );

  const scores = {
    diet: dietScore,
    fitness: fitnessScore,
    rest: restScore,
    psychology: psychologyScore,
    exercise: exerciseScore,
  };

  const lowestDimension = Object.entries(scores).reduce((min, [key, value]) =>
    value < min.value ? { key, value } : min
  , { key: 'diet', value: 100 });

  const improvementAreaMap: Record<string, string> = {
    diet: '饮食',
    fitness: '体质',
    rest: '作息',
    psychology: '心理',
    exercise: '运动',
  };

  return {
    diet: dietScore,
    fitness: fitnessScore,
    rest: restScore,
    psychology: psychologyScore,
    exercise: exerciseScore,
    overall,
    primaryImprovementArea: improvementAreaMap[lowestDimension.key] || '饮食',
  };
};

export const calculateHealthScoreBreakdown = (data: OnboardingData): HealthScoreBreakdown => {
  const diet: ScoreBreakdownItem[] = [{ rule: '饮食基准分', delta: 50 }];
  if (data.dietaryPreferences && data.dietaryPreferences.length > 0) {
    diet.push({ rule: '填写饮食偏好', delta: 15 });
    const healthyPreferences = ['balanced', 'high_protein', 'mediterranean', 'vegetarian'];
    const hasHealthyPref = data.dietaryPreferences.some(pref => healthyPreferences.includes(pref));
    if (hasHealthyPref) diet.push({ rule: '含健康饮食偏好', delta: 15 });
  }
  if (data.waterIntake) {
    if (data.waterIntake >= 8) diet.push({ rule: '日饮水 >= 8 杯', delta: 20 });
    else if (data.waterIntake >= 6) diet.push({ rule: '日饮水 6-7 杯', delta: 10 });
    else if (data.waterIntake >= 4) diet.push({ rule: '日饮水 4-5 杯', delta: 5 });
  }

  const fitness: ScoreBreakdownItem[] = [{ rule: '体质基准分', delta: 50 }];
  if (data.currentWeight && data.height && data.age) {
    const heightInMeters = data.height / 100;
    const bmi = data.currentWeight / (heightInMeters * heightInMeters);
    if (bmi >= 18.5 && bmi <= 24.9) fitness.push({ rule: 'BMI 正常区间', delta: 30 });
    else if ((bmi >= 17 && bmi < 18.5) || (bmi >= 25 && bmi <= 27)) fitness.push({ rule: 'BMI 轻度偏离', delta: 15 });
    else fitness.push({ rule: 'BMI 明显偏离', delta: 5 });
  }
  if (data.healthConcerns) {
    const seriousConcerns = ['diabetes', 'heart_disease', 'high_blood_pressure'];
    const hasSeriousConcern = data.healthConcerns.some(concern => seriousConcerns.includes(concern));
    if (hasSeriousConcern) fitness.push({ rule: '存在重大健康风险', delta: -20 });
    else if (data.healthConcerns.length > 0) fitness.push({ rule: '存在一般健康关注', delta: -10 });
    else fitness.push({ rule: '无健康关注项', delta: 20 });
  }

  const rest: ScoreBreakdownItem[] = [{ rule: '作息基准分', delta: 50 }];
  if (data.sleepHours) {
    if (data.sleepHours >= 7 && data.sleepHours <= 9) rest.push({ rule: '睡眠 7-9 小时', delta: 40 });
    else if (data.sleepHours >= 6 && data.sleepHours < 7) rest.push({ rule: '睡眠 6-7 小时', delta: 25 });
    else if (data.sleepHours >= 5 && data.sleepHours < 6) rest.push({ rule: '睡眠 5-6 小时', delta: 10 });
  }
  if (data.activityLevel) {
    if (data.activityLevel === 'sedentary') rest.push({ rule: '日常活动偏低', delta: 10 });
    else if (data.activityLevel === 'light' || data.activityLevel === 'moderate') rest.push({ rule: '日常活动适中', delta: 5 });
  }

  const psychology: ScoreBreakdownItem[] = [{ rule: '心理基准分', delta: 60 }];
  if (data.fitnessGoal) psychology.push({ rule: '设定明确健康目标', delta: 20 });
  if (data.healthConcerns) {
    const stressRelated = ['stress', 'anxiety', 'depression', 'insomnia'];
    const hasStress = data.healthConcerns.some(concern => stressRelated.includes(concern));
    if (hasStress) psychology.push({ rule: '存在压力/睡眠相关关注', delta: -20 });
    else psychology.push({ rule: '无压力相关关注', delta: 20 });
  }

  const exercise: ScoreBreakdownItem[] = [{ rule: '运动基准分', delta: 40 }];
  if (data.exerciseHabits && data.exerciseHabits.length > 0) {
    exercise.push({ rule: '运动习惯条目加分', delta: data.exerciseHabits.length * 8 });
  }
  if (data.activityLevel) {
    const activityLevelScores: Record<string, number> = {
      sedentary: 0,
      light: 10,
      moderate: 20,
      active: 30,
      very_active: 40,
    };
    exercise.push({ rule: '活动水平加分', delta: activityLevelScores[data.activityLevel] || 0 });
  }

  return { diet, fitness, rest, psychology, exercise };
};

const calculateDietScore = (data: OnboardingData): number => {
  let score = 50;

  if (data.dietaryPreferences && data.dietaryPreferences.length > 0) {
    score += 15;

    const healthyPreferences = ['balanced', 'high_protein', 'mediterranean', 'vegetarian'];
    const hasHealthyPref = data.dietaryPreferences.some(pref => healthyPreferences.includes(pref));
    if (hasHealthyPref) {
      score += 15;
    }
  }

  if (data.waterIntake) {
    if (data.waterIntake >= 8) {
      score += 20;
    } else if (data.waterIntake >= 6) {
      score += 10;
    } else if (data.waterIntake >= 4) {
      score += 5;
    }
  }

  return Math.min(100, Math.max(0, score));
};

const calculateFitnessScore = (data: OnboardingData): number => {
  let score = 50;

  if (data.currentWeight && data.height && data.age) {
    const heightInMeters = data.height / 100;
    const bmi = data.currentWeight / (heightInMeters * heightInMeters);

    if (bmi >= 18.5 && bmi <= 24.9) {
      score += 30;
    } else if ((bmi >= 17 && bmi < 18.5) || (bmi >= 25 && bmi <= 27)) {
      score += 15;
    } else {
      score += 5;
    }
  }

  if (data.healthConcerns) {
    const seriousConcerns = ['diabetes', 'heart_disease', 'high_blood_pressure'];
    const hasSeriousConcern = data.healthConcerns.some(concern =>
      seriousConcerns.includes(concern)
    );
    if (hasSeriousConcern) {
      score -= 20;
    } else if (data.healthConcerns.length > 0) {
      score -= 10;
    } else {
      score += 20;
    }
  }

  return Math.min(100, Math.max(0, score));
};

const calculateRestScore = (data: OnboardingData): number => {
  let score = 50;

  if (data.sleepHours) {
    if (data.sleepHours >= 7 && data.sleepHours <= 9) {
      score += 40;
    } else if (data.sleepHours >= 6 && data.sleepHours < 7) {
      score += 25;
    } else if (data.sleepHours >= 5 && data.sleepHours < 6) {
      score += 10;
    } else {
      score += 0;
    }
  }

  if (data.activityLevel) {
    if (data.activityLevel === 'sedentary') {
      score += 10;
    } else if (data.activityLevel === 'light' || data.activityLevel === 'moderate') {
      score += 5;
    }
  }

  return Math.min(100, Math.max(0, score));
};

const calculatePsychologyScore = (data: OnboardingData): number => {
  let score = 60;

  if (data.fitnessGoal) {
    score += 20;
  }

  if (data.healthConcerns) {
    const stressRelated = ['stress', 'anxiety', 'depression', 'insomnia'];
    const hasStress = data.healthConcerns.some(concern =>
      stressRelated.includes(concern)
    );
    if (hasStress) {
      score -= 20;
    } else {
      score += 20;
    }
  }

  return Math.min(100, Math.max(0, score));
};

const calculateExerciseScore = (data: OnboardingData): number => {
  let score = 40;

  if (data.exerciseHabits && data.exerciseHabits.length > 0) {
    score += data.exerciseHabits.length * 8;
  }

  if (data.activityLevel) {
    const activityLevelScores: Record<string, number> = {
      sedentary: 0,
      light: 10,
      moderate: 20,
      active: 30,
      very_active: 40,
    };
    score += activityLevelScores[data.activityLevel] || 0;
  }

  return Math.min(100, Math.max(0, score));
};

export const getDimensionLabel = (dimension: string): string => {
  const labels: Record<string, string> = {
    diet: '饮食',
    fitness: '体质',
    rest: '作息',
    psychology: '心理',
    exercise: '运动',
  };
  return labels[dimension] || dimension;
};

export const getImprovementGoal = (primaryArea: string): string => {
  const goals: Record<string, string> = {
    饮食: '免疫力',
    体质: '体质改善',
    作息: '睡眠质量',
    心理: '心理健康',
    运动: '运动能力',
  };
  return goals[primaryArea] || '免疫力';
};
