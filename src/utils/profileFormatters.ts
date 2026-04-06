export const formatHealthGoal = (healthGoal?: string): string => {
  const goalMap: Record<string, string> = {
    weight_loss: '减轻体重',
    maintain_health: '焕肤',
    tone: '保持健康',
    confidence: '保持自信',
    muscle_gain: '增肌塑形',
    other: '其它',
  };
  return healthGoal ? goalMap[healthGoal] || '未设置' : '未设置';
};

export const formatActivityLevel = (activityLevel?: string): string => {
  const activityMap: Record<string, string> = {
    sedentary: '久坐不动',
    light: '轻度活动',
    moderate: '中度活动',
    active: '积极运动',
    very_active: '高强度运动',
  };
  return activityLevel ? activityMap[activityLevel] || '未设置' : '未设置';
};

export const formatDietaryPreferences = (preferences?: string[]): string => {
  if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
    return '未设置';
  }

  const prefMap: Record<string, string> = {
    balanced: '均衡饮食',
    low_carb: '低碳水',
    high_protein: '高蛋白',
    vegetarian: '素食',
    keto: '生酮饮食',
    mediterranean: '地中海饮食',
  };

  return preferences.map(pref => prefMap[pref] || pref).join('、');
};

export const formatExerciseHabits = (habits?: string[]): string => {
  if (!habits || habits.length === 0) return '未设置';

  const habitMap: Record<string, string> = {
    cardio: '有氧运动',
    strength: '力量训练',
    yoga: '瑜伽/普拉提',
    sports: '球类运动',
    walking: '步行/跑步',
    swimming: '游泳',
  };

  return habits.map(habit => habitMap[habit] || habit).join('、');
};

export const formatHealthConcerns = (concerns?: string[]): string => {
  if (!concerns || concerns.length === 0) return '未设置';

  const concernMap: Record<string, string> = {
    blood_sugar: '血糖管理',
    blood_pressure: '血压管理',
    cholesterol: '胆固醇',
    digestive: '消化问题',
    energy: '精力不足',
    stress: '压力管理',
    none: '没有特别关注',
  };

  return concerns.map(concern => concernMap[concern] || concern).join('、');
};

export const formatSleepHours = (hours?: number): string => {
  if (!hours) return '未设置';
  return `${hours} 小时`;
};

export const formatWaterIntake = (intake?: number): string => {
  if (!intake) return '未设置';
  return `${intake} 毫升`;
};

