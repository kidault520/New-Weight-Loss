// Mock data generator based on date
export interface DayData {
  calories: {
    remaining: number;
    total: number;
    foodIntake: number;
    exerciseBurned: number;
  };
  weight: {
    current: number | null;
    target: number;
    hasRecord: boolean;
  };
  nutrition: {
    carbs: { current: number; target: number };
    protein: { current: number; target: number };
    fat: { current: number; target: number };
  };
  water: {
    current: number;
    target: number;
  };
  steps: {
    current: number;
    target: number;
    hourlyData: number[];
    floors: number;
  };
  exercise: {
    calories: number;
    minutes: number;
  };
  measurements: {
    chest: number | null;
    waist: number | null;
    upperArm: number | null;
    hips: number | null;
    thigh: number | null;
    calf: number | null;
  };
  emotion: {
    current: string;
    intensity: number;
    hasRecord: boolean;
  };
  sleep: {
    duration: number;
    quality: number;
    bedTime: string;
    wakeTime: string;
    hasRecord: boolean;
  };
  bloodGlucose: {
    current: number | null;
    target: { min: number; max: number };
    hasRecord: boolean;
    lastMeasurement: string;
  };
  records: Array<{
    id: string;
    type: 'food' | 'exercise' | 'water';
    name: string;
    calories?: number;
    time: string;
    nutrition_data?: {
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      quantity: number;
      mealType: string;
      image?: string;
      icon?: string;
      originalId?: string;
    };
    exercise_data?: {
      name: string;
      icon: string;
      calories: number;
      duration: number;
      originalId: string;
    };
  }>;
  mealIntakeStatus?: {
    breakfast?: { intakeCompletedAt: string };
    lunch?: { intakeCompletedAt: string };
    dinner?: { intakeCompletedAt: string };
  };
  syncedMealPlan?: {
    breakfast: {
      image: string;
      calories: number;
      tag: string;
      tagColor: string;
      foods: Array<{
        id: string;
        name: string;
        amount: string;
        calories: number;
        icon: string;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }>;
    };
    lunch: {
      image: string;
      calories: number;
      tag: string;
      tagColor: string;
      foods: Array<{
        id: string;
        name: string;
        amount: string;
        calories: number;
        icon: string;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }>;
    };
    dinner: {
      image: string;
      calories: number;
      tag: string;
      tagColor: string;
      foods: Array<{
        id: string;
        name: string;
        amount: string;
        calories: number;
        icon: string;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }>;
    };
  };
}

/**
 * Generate empty data structure for users with no records
 * Used for authenticated users who haven't added any data yet
 */
export function generateEmptyDayData(_date: Date, targetWeight: number = 60.0): DayData {
  return {
    calories: {
      remaining: 2196,
      total: 2196,
      foodIntake: 0,
      exerciseBurned: 0,
    },
    weight: {
      current: null,
      target: targetWeight,
      hasRecord: false,
    },
    nutrition: {
      carbs: { current: 0, target: 178 },
      protein: { current: 0, target: 120 },
      fat: { current: 0, target: 73 },
    },
    water: {
      current: 0,
      target: 2000,
    },
    steps: {
      current: 0,
      target: 8000,
      hourlyData: new Array(24).fill(0),
      floors: 0,
    },
    exercise: {
      calories: 0,
      minutes: 0,
    },
    measurements: {
      chest: null,
      waist: null,
      upperArm: null,
      hips: null,
      thigh: null,
      calf: null,
    },
    emotion: {
      current: 'neutral',
      intensity: 0.5,
      hasRecord: false,
    },
    sleep: {
      duration: 0,
      quality: 0,
      bedTime: '--:--',
      wakeTime: '--:--',
      hasRecord: false,
    },
    bloodGlucose: {
      current: null,
      target: { min: 70, max: 100 },
      hasRecord: false,
      lastMeasurement: '--:--',
    },
    records: [],
  };
}

/**
 * Generate mock tutorial data for onboarding and demo purposes
 * This data is shown to new users during tutorial/onboarding phase
 */
export function generateMockData(date: Date): DayData {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Use date as seed for consistent data
  const seed = date.getDate() + date.getMonth() * 31 + date.getFullYear() * 365;
  const random = (min: number, max: number) => {
    const x = Math.sin(seed * 9999) * 10000;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
  };

  // Generate different data patterns based on date
  const baseCalories = 2196;
  const foodIntake = isToday ? 0 : random(800, 1800);
  const exerciseBurned = isToday ? 0 : random(0, 400);
  
  // Emotion data
  const emotions = ['happy', 'sad', 'neutral', 'excited', 'tired', 'worried'];
  const currentEmotion = emotions[random(0, emotions.length - 1)];
  
  // Sleep data
  const sleepDuration = isToday ? 0 : random(6, 9) + random(0, 59) / 60;
  const bedHour = random(21, 23);
  const wakeHour = bedHour + Math.floor(sleepDuration);
  
  // Blood glucose data
  const bloodGlucoseValue = isToday ? null : random(80, 140);
  
  return {
    calories: {
      remaining: baseCalories - foodIntake + exerciseBurned,
      total: baseCalories,
      foodIntake,
      exerciseBurned,
    },
    weight: {
      current: daysDiff <= 0 ? (daysDiff === 0 ? null : 58.5 + random(-20, 20) / 10) : null,
      target: 60.0,
      hasRecord: daysDiff < 0,
    },
    nutrition: {
      carbs: { 
        current: Math.floor(foodIntake * 0.5 / 4), 
        target: 178 
      },
      protein: { 
        current: Math.floor(foodIntake * 0.25 / 4), 
        target: 120 
      },
      fat: { 
        current: Math.floor(foodIntake * 0.25 / 9), 
        target: 109 
      },
    },
    water: {
      current: isToday ? 0 : random(1000, 2800),
      target: 2500,
    },
    steps: {
      current: isToday ? 8542 : random(2000, 8000),
      target: 6500,
      hourlyData: Array.from({ length: 24 }, () => random(0, 500)),
      floors: isToday ? 12 : random(5, 20),
    },
    exercise: {
      calories: exerciseBurned,
      minutes: exerciseBurned > 0 ? Math.floor(exerciseBurned / 8) : 0,
    },
    measurements: {
      chest: daysDiff < -7 ? 85 + random(-5, 5) : null,
      waist: daysDiff < -7 ? 68 + random(-3, 3) : null,
      upperArm: daysDiff < -7 ? 28 + random(-2, 2) : null,
      hips: daysDiff < -7 ? 92 + random(-4, 4) : null,
      thigh: daysDiff < -7 ? 52 + random(-3, 3) : null,
      calf: daysDiff < -7 ? 34 + random(-2, 2) : null,
    },
    emotion: {
      current: currentEmotion,
      intensity: random(3, 10) / 10,
      hasRecord: daysDiff < 0,
    },
    sleep: {
      duration: sleepDuration,
      quality: random(6, 10) / 10,
      bedTime: `${bedHour}:${random(0, 59).toString().padStart(2, '0')}`,
      wakeTime: `${wakeHour > 24 ? wakeHour - 24 : wakeHour}:${random(0, 59).toString().padStart(2, '0')}`,
      hasRecord: daysDiff < 0,
    },
    bloodGlucose: {
      current: bloodGlucoseValue,
      target: { min: 70, max: 140 },
      hasRecord: daysDiff < 0,
      lastMeasurement: daysDiff < 0 ? `${random(7, 22)}:${random(0, 59).toString().padStart(2, '0')}` : '',
    },
    records: foodIntake > 0 ? [
      {
        id: '1',
        type: 'food',
        name: ['早餐', '午餐', '晚餐', '加餐'][random(0, 3)],
        calories: random(200, 600),
        time: `${random(7, 20)}:${random(0, 59).toString().padStart(2, '0')}`,
      },
      ...(random(0, 2) > 0 ? [{
        id: '2',
        type: 'food' as const,
        name: ['水果', '坚果', '酸奶'][random(0, 2)],
        calories: random(50, 200),
        time: `${random(14, 18)}:${random(0, 59).toString().padStart(2, '0')}`,
      }] : []),
    ] : [],
  };
}

// Meal plan data structure
export const mealPlanData = {
  1: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 298,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "27g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "2.9g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-1-1", name: "红烧排骨", amount: "1份/150克", calories: 180, icon: "🍖", protein: 15, carbs: 8, fat: 12, fiber: 0.5 },
        { id: "breakfast-1-2", name: "糖醋里脊", amount: "1份/120克", calories: 165, icon: "🥩", protein: 12, carbs: 10, fat: 8, fiber: 0.3 },
        { id: "breakfast-1-3", name: "清炒时蔬", amount: "1盘/100克", calories: 45, icon: "🥬", protein: 2, carbs: 6, fat: 1, fiber: 2.0 },
        { id: "breakfast-1-4", name: "冰镇酸梅汤", amount: "1杯/200ml", calories: 73, icon: "🥤", protein: 0, carbs: 18, fat: 0, fiber: 0.1 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 353,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "39g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "30g", color: "bg-red-400" },
        { name: "脂肪", value: "12g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "7.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-1-1", name: "黑椒牛柳", amount: "1份/120克", calories: 165, icon: "🥩", protein: 20, carbs: 5, fat: 8, fiber: 0.5 },
        { id: "lunch-1-2", name: "蜜汁叉烧", amount: "1份/100克", calories: 135, icon: "🍖", protein: 18, carbs: 8, fat: 6, fiber: 0.2 },
        { id: "lunch-1-3", name: "清炒芦笋", amount: "1盘/100克", calories: 53, icon: "🌿", protein: 3, carbs: 4, fat: 2, fiber: 2.1 },
        { id: "lunch-1-4", name: "杨枝甘露", amount: "1杯/200ml", calories: 85, icon: "🥤", protein: 1, carbs: 20, fat: 0, fiber: 1.0 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 301,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "12g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "23g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "2.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-1-1", name: "香煎鸡排", amount: "1份/150克", calories: 185, icon: "🍗", protein: 25, carbs: 2, fat: 8, fiber: 0.1 },
        { id: "dinner-1-2", name: "油焖大虾", amount: "3只/80克", calories: 95, icon: "🦐", protein: 18, carbs: 1, fat: 2, fiber: 0 },
        { id: "dinner-1-3", name: "蒜蓉西兰花", amount: "1份/100克", calories: 21, icon: "🥦", protein: 3, carbs: 4, fat: 0.5, fiber: 2.6 },
        { id: "dinner-1-4", name: "青柠气泡水", amount: "1杯/250ml", calories: 15, icon: "🥤", protein: 0, carbs: 4, fat: 0, fiber: 0.1 }
      ]
    }
  },
  2: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 285,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "25g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-2-1", name: "蒸蛋羹", amount: "1份/150克", calories: 120, icon: "🥚", protein: 12, carbs: 5, fat: 8, fiber: 0.2 },
        { id: "breakfast-2-2", name: "煎饺", amount: "6个/120克", calories: 180, icon: "🥟", protein: 8, carbs: 20, fat: 9, fiber: 1.5 },
        { id: "breakfast-2-3", name: "凉拌黄瓜", amount: "1盘/100克", calories: 35, icon: "🥒", protein: 1, carbs: 4, fat: 1, fiber: 1.2 },
        { id: "breakfast-2-4", name: "豆浆", amount: "1杯/250ml", calories: 85, icon: "🥛", protein: 4, carbs: 8, fat: 3, fiber: 0.8 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 368,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "42g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-2-1", name: "红烧鱼块", amount: "1份/150克", calories: 185, icon: "🐟", protein: 22, carbs: 3, fat: 9, fiber: 0.1 },
        { id: "lunch-2-2", name: "宫保鸡丁", amount: "1份/120克", calories: 155, icon: "🍗", protein: 18, carbs: 8, fat: 7, fiber: 1.2 },
        { id: "lunch-2-3", name: "蒜蓉菠菜", amount: "1盘/100克", calories: 28, icon: "🥬", protein: 3, carbs: 2, fat: 1, fiber: 2.5 },
        { id: "lunch-2-4", name: "柠檬蜂蜜茶", amount: "1杯/200ml", calories: 65, icon: "🍵", protein: 0, carbs: 17, fat: 0, fiber: 0.3 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 295,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "15g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "22g", color: "bg-red-400" },
        { name: "脂肪", value: "20g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-2-1", name: "清蒸鲈鱼", amount: "1份/120克", calories: 145, icon: "🐟", protein: 20, carbs: 1, fat: 6, fiber: 0 },
        { id: "dinner-2-2", name: "蒜蓉扇贝", amount: "4个/100克", calories: 115, icon: "🦪", protein: 15, carbs: 3, fat: 4, fiber: 0.2 },
        { id: "dinner-2-3", name: "清炒豆苗", amount: "1份/80克", calories: 35, icon: "🌱", protein: 4, carbs: 3, fat: 1, fiber: 2.8 },
        { id: "dinner-2-4", name: "薄荷茶", amount: "1杯/200ml", calories: 5, icon: "🍃", protein: 0, carbs: 1, fat: 0, fiber: 0.1 }
      ]
    }
  },
  3: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 312,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "28g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "20g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-3-1", name: "小笼包", amount: "6个/120克", calories: 195, icon: "🥟", protein: 10, carbs: 22, fat: 8, fiber: 1.2 },
        { id: "breakfast-3-2", name: "咸菜丝", amount: "1份/80克", calories: 25, icon: "🥬", protein: 2, carbs: 3, fat: 0.5, fiber: 2.1 },
        { id: "breakfast-3-3", name: "紫菜蛋花汤", amount: "1碗/200ml", calories: 92, icon: "🍲", protein: 8, carbs: 3, fat: 6, fiber: 0.8 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 345,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "35g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "32g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-3-1", name: "糖醋排骨", amount: "1份/150克", calories: 205, icon: "🍖", protein: 20, carbs: 15, fat: 8, fiber: 0.3 },
        { id: "lunch-3-2", name: "麻婆豆腐", amount: "1份/120克", calories: 140, icon: "🧈", protein: 12, carbs: 8, fat: 7, fiber: 2.5 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 288,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "18g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "25g", color: "bg-red-400" },
        { name: "脂肪", value: "18g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-3-1", name: "白切鸡", amount: "1份/120克", calories: 165, icon: "🍗", protein: 22, carbs: 0, fat: 8, fiber: 0 },
        { id: "dinner-3-2", name: "蒜蓉生菜", amount: "1份/100克", calories: 45, icon: "🥬", protein: 3, carbs: 5, fat: 2, fiber: 2.8 },
        { id: "dinner-3-3", name: "冬瓜汤", amount: "1碗/200ml", calories: 78, icon: "🍲", protein: 2, carbs: 8, fat: 3, fiber: 1.4 }
      ]
    }
  },
  4: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 295,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "30g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "17g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-4-1", name: "煎蛋", amount: "2个/100克", calories: 155, icon: "🍳", protein: 12, carbs: 1, fat: 11, fiber: 0 },
        { id: "breakfast-4-2", name: "全麦吐司", amount: "2片/60克", calories: 140, icon: "🍞", protein: 5, carbs: 29, fat: 3, fiber: 3.8 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 360,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "38g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "29g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-4-1", name: "红烧肉", amount: "1份/100克", calories: 225, icon: "🥩", protein: 18, carbs: 8, fat: 15, fiber: 0.2 },
        { id: "lunch-4-2", name: "炒青菜", amount: "1份/120克", calories: 135, icon: "🥬", protein: 11, carbs: 30, fat: 0, fiber: 6.3 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 275,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "20g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "24g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-4-1", name: "蒸蛋", amount: "1份/150克", calories: 145, icon: "🥚", protein: 15, carbs: 2, fat: 9, fiber: 0 },
        { id: "dinner-4-2", name: "凉拌豆腐", amount: "1份/100克", calories: 130, icon: "🧈", protein: 9, carbs: 18, fat: 7, fiber: 3.8 }
      ]
    }
  },
  5: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 305,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "32g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-5-1", name: "燕麦粥", amount: "1碗/200ml", calories: 125, icon: "🥣", protein: 5, carbs: 25, fat: 2, fiber: 4.0 },
        { id: "breakfast-5-2", name: "煮鸡蛋", amount: "2个/100克", calories: 155, icon: "🥚", protein: 13, carbs: 1, fat: 11, fiber: 0 },
        { id: "breakfast-5-3", name: "拌菠菜", amount: "1份/80克", calories: 25, icon: "🥬", protein: 1, carbs: 6, fat: 3, fiber: 0.5 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 340,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "36g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "31g", color: "bg-red-400" },
        { name: "脂肪", value: "11g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "7.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-5-1", name: "清蒸鸡胸肉", amount: "1份/150克", calories: 185, icon: "🍗", protein: 25, carbs: 0, fat: 8, fiber: 0 },
        { id: "lunch-5-2", name: "蒸蛋羹", amount: "1份/120克", calories: 95, icon: "🥚", protein: 8, carbs: 2, fat: 6, fiber: 0 },
        { id: "lunch-5-3", name: "凉拌萝卜丝", amount: "1份/100克", calories: 60, icon: "🥕", protein: 2, carbs: 12, fat: 1, fiber: 3.2 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 265,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "22g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "20g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-5-1", name: "蒸蛋", amount: "1份/120克", calories: 125, icon: "🥚", protein: 12, carbs: 2, fat: 8, fiber: 0 },
        { id: "dinner-5-2", name: "凉拌海带丝", amount: "1份/100克", calories: 85, icon: "🌿", protein: 3, carbs: 15, fat: 2, fiber: 4.2 },
        { id: "dinner-5-3", name: "冬瓜汤", amount: "1碗/150ml", calories: 55, icon: "🍲", protein: 5, carbs: 5, fat: 4, fiber: 0.9 }
      ]
    }
  },
  6: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 290,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "26g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "21g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-6-1", name: "蒸饺", amount: "8个/160克", calories: 185, icon: "🥟", protein: 12, carbs: 20, fat: 8, fiber: 1.8 },
        { id: "breakfast-6-2", name: "拌黄瓜", amount: "1份/100克", calories: 35, icon: "🥒", protein: 2, carbs: 4, fat: 1, fiber: 1.2 },
        { id: "breakfast-6-3", name: "小米粥", amount: "1碗/200ml", calories: 70, icon: "🥣", protein: 7, carbs: 2, fat: 6, fiber: 0.6 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 375,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "40g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "33g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-6-1", name: "红烧鸡翅", amount: "3个/150克", calories: 195, icon: "🍗", protein: 22, carbs: 5, fat: 10, fiber: 0.2 },
        { id: "lunch-6-2", name: "蒜蓉茄子", amount: "1份/120克", calories: 180, icon: "🍆", protein: 11, carbs: 35, fat: 6, fiber: 6.6 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 280,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "16g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "23g", color: "bg-red-400" },
        { name: "脂肪", value: "19g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-6-1", name: "清蒸带鱼", amount: "1份/120克", calories: 155, icon: "🐟", protein: 18, carbs: 1, fat: 8, fiber: 0 },
        { id: "dinner-6-2", name: "凉拌木耳", amount: "1份/80克", calories: 125, icon: "🍄", protein: 5, carbs: 15, fat: 11, fiber: 3.2 }
      ]
    }
  },
  7: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 285,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "29g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-7-1", name: "蒸蛋羹", amount: "1份/150克", calories: 125, icon: "🥚", protein: 10, carbs: 3, fat: 8, fiber: 0 },
        { id: "breakfast-7-2", name: "紫薯", amount: "1个/100克", calories: 160, icon: "🍠", protein: 8, carbs: 26, fat: 5, fiber: 4.2 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 355,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "37g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "30g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-7-1", name: "白切鸡", amount: "1份/150克", calories: 185, icon: "🍗", protein: 25, carbs: 0, fat: 8, fiber: 0 },
        { id: "lunch-7-2", name: "蒜蓉西兰花", amount: "1份/120克", calories: 170, icon: "🥦", protein: 5, carbs: 37, fat: 6, fiber: 5.8 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 270,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "14g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "26g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "2.9g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-7-1", name: "清蒸鲈鱼", amount: "1份/150克", calories: 165, icon: "🐟", protein: 22, carbs: 1, fat: 8, fiber: 0 },
        { id: "dinner-7-2", name: "蒜蓉菠菜", amount: "1份/100克", calories: 105, icon: "🥬", protein: 4, carbs: 13, fat: 9, fiber: 2.9 }
      ]
    }
  },
  8: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 310,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "31g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "20g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.0g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-8-1", name: "蒸蛋羹", amount: "1份/150克", calories: 130, icon: "🥚", protein: 12, carbs: 3, fat: 8, fiber: 0.1 },
        { id: "breakfast-8-2", name: "全麦面包", amount: "2片/80克", calories: 180, icon: "🍞", protein: 8, carbs: 28, fat: 8, fiber: 3.9 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 365,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "41g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-8-1", name: "红烧鱼块", amount: "1份/140克", calories: 175, icon: "🐟", protein: 20, carbs: 5, fat: 9, fiber: 0.2 },
        { id: "lunch-8-2", name: "蒜蓉菠菜", amount: "1份/120克", calories: 190, icon: "🥬", protein: 8, carbs: 36, fat: 6, fiber: 6.0 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 290,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "18g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "24g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-8-1", name: "清蒸鸡胸肉", amount: "1份/130克", calories: 160, icon: "🍗", protein: 22, carbs: 1, fat: 7, fiber: 0 },
        { id: "dinner-8-2", name: "凉拌黄瓜", amount: "1份/100克", calories: 130, icon: "🥒", protein: 2, carbs: 17, fat: 10, fiber: 3.5 }
      ]
    }
  },
  9: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 300,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "28g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-9-1", name: "煎蛋", amount: "2个/120克", calories: 170, icon: "🍳", protein: 14, carbs: 2, fat: 12, fiber: 0 },
        { id: "breakfast-9-2", name: "燕麦粥", amount: "1碗/180ml", calories: 130, icon: "🥣", protein: 5, carbs: 26, fat: 3, fiber: 3.8 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 350,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "38g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "29g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.9g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-9-1", name: "糖醋排骨", amount: "1份/140克", calories: 190, icon: "🍖", protein: 18, carbs: 12, fat: 9, fiber: 0.3 },
        { id: "lunch-9-2", name: "清炒芦笋", amount: "1份/110克", calories: 160, icon: "🌿", protein: 11, carbs: 26, fat: 4, fiber: 5.6 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 285,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "16g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "25g", color: "bg-red-400" },
        { name: "脂肪", value: "18g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-9-1", name: "白切鸡", amount: "1份/140克", calories: 175, icon: "🍗", protein: 23, carbs: 1, fat: 8, fiber: 0 },
        { id: "dinner-9-2", name: "蒜蓉生菜", amount: "1份/90克", calories: 110, icon: "🥬", protein: 2, carbs: 15, fat: 10, fiber: 3.1 }
      ]
    }
  },
  10: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 295,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "27g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-10-1", name: "小笼包", amount: "6个/130克", calories: 195, icon: "🥟", protein: 11, carbs: 22, fat: 8, fiber: 1.8 },
        { id: "breakfast-10-2", name: "豆浆", amount: "1杯/200ml", calories: 100, icon: "🥛", protein: 7, carbs: 5, fat: 6, fiber: 1.8 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 370,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "40g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "31g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-10-1", name: "红烧肉", amount: "1份/120克", calories: 210, icon: "🥩", protein: 19, carbs: 8, fat: 14, fiber: 0.2 },
        { id: "lunch-10-2", name: "炒青菜", amount: "1份/130克", calories: 160, icon: "🥬", protein: 12, carbs: 32, fat: 2, fiber: 6.3 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 275,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "19g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "23g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-10-1", name: "蒸蛋", amount: "1份/140克", calories: 140, icon: "🥚", protein: 14, carbs: 2, fat: 9, fiber: 0 },
        { id: "dinner-10-2", name: "凉拌豆腐", amount: "1份/110克", calories: 135, icon: "🧈", protein: 9, carbs: 17, fat: 7, fiber: 3.2 }
      ]
    }
  },
  11: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 305,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "29g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "20g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-11-1", name: "煮鸡蛋", amount: "2个/110克", calories: 165, icon: "🥚", protein: 14, carbs: 1, fat: 11, fiber: 0 },
        { id: "breakfast-11-2", name: "紫薯", amount: "1个/120克", calories: 140, icon: "🍠", protein: 6, carbs: 28, fat: 5, fiber: 4.1 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 355,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "37g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "30g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-11-1", name: "黑椒牛柳", amount: "1份/130克", calories: 180, icon: "🥩", protein: 22, carbs: 6, fat: 8, fiber: 0.4 },
        { id: "lunch-11-2", name: "蒜蓉西兰花", amount: "1份/125克", calories: 175, icon: "🥦", protein: 8, carbs: 31, fat: 6, fiber: 5.4 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 280,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "17g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "24g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.0g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-11-1", name: "清蒸鲈鱼", amount: "1份/140克", calories: 155, icon: "🐟", protein: 20, carbs: 1, fat: 7, fiber: 0 },
        { id: "dinner-11-2", name: "凉拌海带丝", amount: "1份/110克", calories: 125, icon: "🌿", protein: 4, carbs: 16, fat: 10, fiber: 3.0 }
      ]
    }
  },
  12: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 290,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "26g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.7g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-12-1", name: "蒸饺", amount: "8个/150克", calories: 185, icon: "🥟", protein: 12, carbs: 20, fat: 8, fiber: 1.8 },
        { id: "breakfast-12-2", name: "小米粥", amount: "1碗/180ml", calories: 105, icon: "🥣", protein: 7, carbs: 6, fat: 7, fiber: 1.9 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 345,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "36g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "29g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-12-1", name: "红烧鸡翅", amount: "3个/140克", calories: 185, icon: "🍗", protein: 20, carbs: 5, fat: 9, fiber: 0.2 },
        { id: "lunch-12-2", name: "蒜蓉茄子", amount: "1份/130克", calories: 160, icon: "🍆", protein: 9, carbs: 31, fat: 4, fiber: 5.3 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 270,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "15g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "22g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "2.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-12-1", name: "白切鸡", amount: "1份/130克", calories: 155, icon: "🍗", protein: 20, carbs: 0, fat: 8, fiber: 0 },
        { id: "dinner-12-2", name: "凉拌木耳", amount: "1份/90克", calories: 115, icon: "🍄", protein: 2, carbs: 15, fat: 8, fiber: 2.8 }
      ]
    }
  },
  13: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 315,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "32g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "21g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-13-1", name: "蒸蛋羹", amount: "1份/160克", calories: 140, icon: "🥚", protein: 13, carbs: 3, fat: 9, fiber: 0.1 },
        { id: "breakfast-13-2", name: "全麦吐司", amount: "2片/70克", calories: 175, icon: "🍞", protein: 8, carbs: 29, fat: 8, fiber: 4.2 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 360,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "39g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "30g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-13-1", name: "蜜汁叉烧", amount: "1份/130克", calories: 175, icon: "🍖", protein: 20, carbs: 10, fat: 8, fiber: 0.3 },
        { id: "lunch-13-2", name: "清炒时蔬", amount: "1份/135克", calories: 185, icon: "🥬", protein: 10, carbs: 29, fat: 7, fiber: 5.8 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 295,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "20g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "26g", color: "bg-red-400" },
        { name: "脂肪", value: "19g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.4g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-13-1", name: "清蒸带鱼", amount: "1份/135克", calories: 170, icon: "🐟", protein: 21, carbs: 2, fat: 9, fiber: 0.1 },
        { id: "dinner-13-2", name: "蒜蓉菠菜", amount: "1份/105克", calories: 125, icon: "🥬", protein: 5, carbs: 18, fat: 10, fiber: 3.3 }
      ]
    }
  },
  14: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 285,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "25g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-14-1", name: "煎蛋", amount: "2个/115克", calories: 160, icon: "🍳", protein: 13, carbs: 1, fat: 11, fiber: 0 },
        { id: "breakfast-14-2", name: "燕麦粥", amount: "1碗/170ml", calories: 125, icon: "🥣", protein: 5, carbs: 24, fat: 3, fiber: 3.5 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 340,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "35g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "12g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-14-1", name: "清蒸鸡胸肉", amount: "1份/145克", calories: 180, icon: "🍗", protein: 24, carbs: 0, fat: 8, fiber: 0 },
        { id: "lunch-14-2", name: "凉拌萝卜丝", amount: "1份/115克", calories: 160, icon: "🥕", protein: 4, carbs: 35, fat: 4, fiber: 5.2 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 265,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "14g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "21g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "2.9g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-14-1", name: "蒸蛋", amount: "1份/125克", calories: 130, icon: "🥚", protein: 13, carbs: 2, fat: 8, fiber: 0 },
        { id: "dinner-14-2", name: "冬瓜汤", amount: "1碗/180ml", calories: 135, icon: "🍲", protein: 8, carbs: 12, fat: 7, fiber: 2.9 }
      ]
    }
  },
  15: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 305,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "29g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-15-1", name: "菜肉包", amount: "2个/120克", calories: 195, icon: "🥟", protein: 10, carbs: 24, fat: 8, fiber: 2.1 },
        { id: "breakfast-15-2", name: "豆浆", amount: "1杯/250ml", calories: 110, icon: "🥛", protein: 9, carbs: 5, fat: 8, fiber: 1.5 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 355,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "37g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "29g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-15-1", name: "水煮鱼", amount: "1份/140克", calories: 185, icon: "🐟", protein: 22, carbs: 3, fat: 9, fiber: 0.5 },
        { id: "lunch-15-2", name: "蒜蓉油麦菜", amount: "1份/120克", calories: 170, icon: "🥬", protein: 7, carbs: 34, fat: 4, fiber: 5.6 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 278,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "16g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "23g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-15-1", name: "煎鸡胸肉", amount: "1份/130克", calories: 170, icon: "🍗", protein: 21, carbs: 2, fat: 8, fiber: 0 },
        { id: "dinner-15-2", name: "凉拌海带丝", amount: "1份/100克", calories: 108, icon: "🥗", protein: 2, carbs: 14, fat: 9, fiber: 3.2 }
      ]
    }
  },
  16: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 292,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "27g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-16-1", name: "鸡蛋灌饼", amount: "1个/150克", calories: 292, icon: "🥞", protein: 18, carbs: 27, fat: 15, fiber: 3.3 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 368,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "40g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "27g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-16-1", name: "梅菜扣肉", amount: "1份/130克", calories: 210, icon: "🥩", protein: 16, carbs: 12, fat: 12, fiber: 1.8 },
        { id: "lunch-16-2", name: "清炒菜心", amount: "1份/125克", calories: 158, icon: "🥬", protein: 11, carbs: 28, fat: 2, fiber: 4.7 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 285,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "18g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "24g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-16-1", name: "清蒸鲈鱼", amount: "1份/140克", calories: 175, icon: "🐟", protein: 22, carbs: 1, fat: 9, fiber: 0 },
        { id: "dinner-16-2", name: "蒜蓉西兰花", amount: "1份/110克", calories: 110, icon: "🥦", protein: 2, carbs: 17, fat: 7, fiber: 3.5 }
      ]
    }
  },
  17: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 298,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "28g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.4g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-17-1", name: "馄饨", amount: "1碗/200克", calories: 298, icon: "🥟", protein: 19, carbs: 28, fat: 16, fiber: 3.4 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 342,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "36g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-17-1", name: "酸菜鱼", amount: "1份/145克", calories: 190, icon: "🐟", protein: 23, carbs: 4, fat: 10, fiber: 1.2 },
        { id: "lunch-17-2", name: "炒莴笋", amount: "1份/115克", calories: 152, icon: "🥬", protein: 5, carbs: 32, fat: 3, fiber: 4.6 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 295,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "19g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "25g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-17-1", name: "煎牛排", amount: "1份/135克", calories: 195, icon: "🥩", protein: 24, carbs: 2, fat: 10, fiber: 0 },
        { id: "dinner-17-2", name: "烤蔬菜", amount: "1份/105克", calories: 100, icon: "🥕", protein: 1, carbs: 17, fat: 7, fiber: 3.6 }
      ]
    }
  },
  18: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 310,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "30g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "17g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.7g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-18-1", name: "豆沙包", amount: "2个/110克", calories: 185, icon: "🥟", protein: 8, carbs: 28, fat: 6, fiber: 2.8 },
        { id: "breakfast-18-2", name: "咸豆浆", amount: "1碗/220ml", calories: 125, icon: "🥛", protein: 9, carbs: 2, fat: 11, fiber: 0.9 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 358,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "38g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "29g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-18-1", name: "东坡肉", amount: "1份/125克", calories: 205, icon: "🥩", protein: 17, carbs: 8, fat: 13, fiber: 0.3 },
        { id: "lunch-18-2", name: "蒜泥空心菜", amount: "1份/120克", calories: 153, icon: "🥬", protein: 12, carbs: 30, fat: 1, fiber: 6.0 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 272,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "15g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "22g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-18-1", name: "清蒸多宝鱼", amount: "1份/125克", calories: 155, icon: "🐟", protein: 20, carbs: 1, fat: 8, fiber: 0 },
        { id: "dinner-18-2", name: "凉拌黄瓜", amount: "1份/110克", calories: 117, icon: "🥒", protein: 2, carbs: 14, fat: 8, fiber: 3.1 }
      ]
    }
  },
  19: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 288,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "26g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-19-1", name: "水煎包", amount: "3个/130克", calories: 288, icon: "🥟", protein: 18, carbs: 26, fat: 15, fiber: 3.2 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 365,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "39g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-19-1", name: "咖喱牛肉", amount: "1份/140克", calories: 210, icon: "🥩", protein: 19, carbs: 9, fat: 12, fiber: 1.5 },
        { id: "lunch-19-2", name: "炒豌豆", amount: "1份/118克", calories: 155, icon: "🫛", protein: 9, carbs: 30, fat: 3, fiber: 5.1 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 282,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "17g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "23g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-19-1", name: "煎三文鱼", amount: "1份/125克", calories: 180, icon: "🐟", protein: 21, carbs: 2, fat: 10, fiber: 0 },
        { id: "dinner-19-2", name: "蔬菜沙拉", amount: "1份/115克", calories: 102, icon: "🥗", protein: 2, carbs: 15, fat: 7, fiber: 3.3 }
      ]
    }
  },
  20: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 302,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "29g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-20-1", name: "肉丝面", amount: "1碗/250克", calories: 302, icon: "🍜", protein: 18, carbs: 29, fat: 16, fiber: 3.5 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 348,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "37g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "27g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.9g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-20-1", name: "麻辣香锅", amount: "1份/135克", calories: 195, icon: "🍲", protein: 18, carbs: 10, fat: 10, fiber: 2.1 },
        { id: "lunch-20-2", name: "炒油菜", amount: "1份/120克", calories: 153, icon: "🥬", protein: 9, carbs: 27, fat: 3, fiber: 3.8 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 290,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "18g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "24g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.4g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-20-1", name: "烤鸡腿", amount: "1个/135克", calories: 185, icon: "🍗", protein: 22, carbs: 2, fat: 10, fiber: 0 },
        { id: "dinner-20-2", name: "凉拌木耳", amount: "1份/105克", calories: 105, icon: "🍄", protein: 2, carbs: 16, fat: 7, fiber: 3.4 }
      ]
    }
  },
  21: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 295,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "28g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "17g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-21-1", name: "生煎包", amount: "4个/120克", calories: 295, icon: "🥟", protein: 17, carbs: 28, fat: 16, fiber: 3.3 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 352,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "38g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "26g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.0g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-21-1", name: "红烧肉", amount: "1份/120克", calories: 200, icon: "🥩", protein: 15, carbs: 8, fat: 13, fiber: 0.2 },
        { id: "lunch-21-2", name: "炒芥蓝", amount: "1份/122克", calories: 152, icon: "🥬", protein: 11, carbs: 30, fat: 1, fiber: 5.8 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 268,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "14g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "21g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "2.9g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-21-1", name: "清蒸鳕鱼", amount: "1份/130克", calories: 165, icon: "🐟", protein: 20, carbs: 1, fat: 9, fiber: 0 },
        { id: "dinner-21-2", name: "蒜蓉娃娃菜", amount: "1份/100克", calories: 103, icon: "🥬", protein: 1, carbs: 13, fat: 7, fiber: 2.9 }
      ]
    }
  },
  22: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 308,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "30g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-22-1", name: "韭菜盒子", amount: "2个/140克", calories: 308, icon: "🥟", protein: 18, carbs: 30, fat: 17, fiber: 3.6 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 360,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "39g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.4g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-22-1", name: "照烧鸡排", amount: "1份/145克", calories: 205, icon: "🍗", protein: 24, carbs: 8, fat: 9, fiber: 0.5 },
        { id: "lunch-22-2", name: "清炒豆角", amount: "1份/120克", calories: 155, icon: "🫛", protein: 4, carbs: 31, fat: 5, fiber: 5.9 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 275,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "16g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "22g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.0g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-22-1", name: "水煮虾", amount: "8只/120克", calories: 145, icon: "🦐", protein: 20, carbs: 1, fat: 7, fiber: 0 },
        { id: "dinner-22-2", name: "蒜蓉生菜", amount: "1份/108克", calories: 130, icon: "🥬", protein: 2, carbs: 15, fat: 9, fiber: 3.0 }
      ]
    }
  },
  23: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 290,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "27g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "17g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-23-1", name: "鸡蛋煎饼", amount: "1份/140克", calories: 290, icon: "🥞", protein: 17, carbs: 27, fat: 15, fiber: 3.2 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 345,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "36g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "27g", color: "bg-red-400" },
        { name: "脂肪", value: "13g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "5.7g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-23-1", name: "蒜香排骨", amount: "1份/135克", calories: 192, icon: "🍖", protein: 18, carbs: 6, fat: 11, fiber: 0.4 },
        { id: "lunch-23-2", name: "炒芹菜", amount: "1份/118克", calories: 153, icon: "🥬", protein: 9, carbs: 30, fat: 2, fiber: 5.3 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 280,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "17g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "23g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.1g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-23-1", name: "香煎鳕鱼", amount: "1份/128克", calories: 170, icon: "🐟", protein: 21, carbs: 2, fat: 9, fiber: 0 },
        { id: "dinner-23-2", name: "凉拌菠菜", amount: "1份/105克", calories: 110, icon: "🥬", protein: 2, carbs: 15, fat: 7, fiber: 3.1 }
      ]
    }
  },
  24: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 305,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "29g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-24-1", name: "烧卖", amount: "6个/125克", calories: 305, icon: "🥟", protein: 18, carbs: 29, fat: 16, fiber: 3.5 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 355,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "38g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-24-1", name: "糖醋里脊", amount: "1份/140克", calories: 200, icon: "🥩", protein: 19, carbs: 12, fat: 10, fiber: 0.5 },
        { id: "lunch-24-2", name: "炒生菜", amount: "1份/120克", calories: 155, icon: "🥬", protein: 9, carbs: 26, fat: 4, fiber: 5.7 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 285,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "18g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "24g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-24-1", name: "清蒸黄花鱼", amount: "1条/132克", calories: 175, icon: "🐟", protein: 22, carbs: 2, fat: 9, fiber: 0 },
        { id: "dinner-24-2", name: "蒜蓉油菜", amount: "1份/108克", calories: 110, icon: "🥬", protein: 2, carbs: 16, fat: 8, fiber: 3.3 }
      ]
    }
  },
  25: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 298,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "28g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.4g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-25-1", name: "肉夹馍", amount: "1个/145克", calories: 298, icon: "🌮", protein: 18, carbs: 28, fat: 16, fiber: 3.4 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 362,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "39g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "27g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-25-1", name: "回锅肉", amount: "1份/130克", calories: 208, icon: "🥩", protein: 16, carbs: 10, fat: 13, fiber: 0.8 },
        { id: "lunch-25-2", name: "炒卷心菜", amount: "1份/120克", calories: 154, icon: "🥬", protein: 11, carbs: 29, fat: 2, fiber: 5.7 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 278,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "16g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "23g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-25-1", name: "煎带鱼", amount: "1份/125克", calories: 168, icon: "🐟", protein: 21, carbs: 2, fat: 9, fiber: 0 },
        { id: "dinner-25-2", name: "凉拌豆芽", amount: "1份/108克", calories: 110, icon: "🥬", protein: 2, carbs: 14, fat: 8, fiber: 3.2 }
      ]
    }
  },
  26: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 292,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "27g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "17g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-26-1", name: "手抓饼", amount: "1份/140克", calories: 292, icon: "🥞", protein: 17, carbs: 27, fat: 15, fiber: 3.3 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 350,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "37g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "27g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.0g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-26-1", name: "小炒肉", amount: "1份/135克", calories: 198, icon: "🥩", protein: 17, carbs: 8, fat: 12, fiber: 0.6 },
        { id: "lunch-26-2", name: "炒茼蒿", amount: "1份/118克", calories: 152, icon: "🥬", protein: 10, carbs: 29, fat: 2, fiber: 5.4 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 270,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "15g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "22g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.0g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-26-1", name: "蒸鲈鱼", amount: "1份/125克", calories: 160, icon: "🐟", protein: 20, carbs: 1, fat: 8, fiber: 0 },
        { id: "dinner-26-2", name: "凉拌藕片", amount: "1份/105克", calories: 110, icon: "🥔", protein: 2, carbs: 14, fat: 8, fiber: 3.0 }
      ]
    }
  },
  27: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 300,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "28g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "18g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.4g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-27-1", name: "虾仁馄饨", amount: "1碗/210克", calories: 300, icon: "🥟", protein: 18, carbs: 28, fat: 16, fiber: 3.4 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 358,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "38g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "28g", color: "bg-red-400" },
        { name: "脂肪", value: "14g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.3g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-27-1", name: "孜然羊肉", amount: "1份/138克", calories: 203, icon: "🥩", protein: 19, carbs: 7, fat: 12, fiber: 0.7 },
        { id: "lunch-27-2", name: "炒上海青", amount: "1份/120克", calories: 155, icon: "🥬", protein: 9, carbs: 31, fat: 2, fiber: 5.6 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 288,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "18g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "24g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.4g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-27-1", name: "清蒸桂鱼", amount: "1份/130克", calories: 178, icon: "🐟", protein: 22, carbs: 2, fat: 9, fiber: 0 },
        { id: "dinner-27-2", name: "蒜蓉茼蒿", amount: "1份/108克", calories: 110, icon: "🥬", protein: 2, carbs: 16, fat: 8, fiber: 3.4 }
      ]
    }
  },
  28: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 320,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "35g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "22g", color: "bg-red-400" },
        { name: "脂肪", value: "18g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-28-1", name: "蒸蛋羹", amount: "1份/160克", calories: 145, icon: "🥚", protein: 14, carbs: 3, fat: 9, fiber: 0.1 },
        { id: "breakfast-28-2", name: "全麦面包", amount: "2片/80克", calories: 175, icon: "🍞", protein: 8, carbs: 32, fat: 9, fiber: 4.7 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 385,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "42g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "32g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "7.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-28-1", name: "红烧狮子头", amount: "2个/150克", calories: 210, icon: "🍖", protein: 22, carbs: 8, fat: 12, fiber: 0.5 },
        { id: "lunch-28-2", name: "清炒菠菜", amount: "1份/140克", calories: 175, icon: "🥬", protein: 10, carbs: 34, fat: 5, fiber: 6.7 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 310,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "22g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "27g", color: "bg-red-400" },
        { name: "脂肪", value: "20g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-28-1", name: "清蒸鲳鱼", amount: "1份/150克", calories: 180, icon: "🐟", protein: 23, carbs: 2, fat: 9, fiber: 0.1 },
        { id: "dinner-28-2", name: "蒜蓉豆苗", amount: "1份/100克", calories: 130, icon: "🌱", protein: 4, carbs: 20, fat: 11, fiber: 3.7 }
      ]
    }
  },
  29: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 295,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "28g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "19g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.2g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-29-1", name: "煎饺", amount: "8个/160克", calories: 195, icon: "🥟", protein: 12, carbs: 22, fat: 9, fiber: 2.0 },
        { id: "breakfast-29-2", name: "紫菜蛋花汤", amount: "1碗/200ml", calories: 100, icon: "🍲", protein: 7, carbs: 6, fat: 7, fiber: 2.2 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 375,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "41g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "31g", color: "bg-red-400" },
        { name: "脂肪", value: "16g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-29-1", name: "宫保鸡丁", amount: "1份/140克", calories: 195, icon: "🍗", protein: 21, carbs: 10, fat: 10, fiber: 1.5 },
        { id: "lunch-29-2", name: "麻婆豆腐", amount: "1份/130克", calories: 180, icon: "🧈", protein: 10, carbs: 31, fat: 6, fiber: 5.3 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 285,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "18g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "25g", color: "bg-red-400" },
        { name: "脂肪", value: "18g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.6g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-29-1", name: "白切鸡", amount: "1份/135克", calories: 165, icon: "🍗", protein: 22, carbs: 1, fat: 8, fiber: 0 },
        { id: "dinner-29-2", name: "凉拌黄瓜", amount: "1份/100克", calories: 120, icon: "🥒", protein: 3, carbs: 17, fat: 10, fiber: 3.6 }
      ]
    }
  },
  30: {
    breakfast: {
      image: "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 310,
      tag: "早餐",
      tagColor: "bg-green-500",
      nutrition: [
        { name: "碳水", value: "31g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "20g", color: "bg-red-400" },
        { name: "脂肪", value: "17g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "4.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "breakfast-30-1", name: "小笼包", amount: "8个/140克", calories: 205, icon: "🥟", protein: 13, carbs: 24, fat: 9, fiber: 2.1 },
        { id: "breakfast-30-2", name: "豆浆", amount: "1杯/220ml", calories: 105, icon: "🥛", protein: 7, carbs: 7, fat: 8, fiber: 2.4 }
      ]
    },
    lunch: {
      image: "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 365,
      tag: "午餐",
      tagColor: "bg-orange-500",
      nutrition: [
        { name: "碳水", value: "39g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "30g", color: "bg-red-400" },
        { name: "脂肪", value: "15g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "6.5g", color: "bg-green-400" }
      ],
      foods: [
        { id: "lunch-30-1", name: "糖醋排骨", amount: "1份/145克", calories: 200, icon: "🍖", protein: 20, carbs: 15, fat: 9, fiber: 0.4 },
        { id: "lunch-30-2", name: "蒜蓉西兰花", amount: "1份/135克", calories: 165, icon: "🥦", protein: 10, carbs: 24, fat: 6, fiber: 6.1 }
      ]
    },
    dinner: {
      image: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800",
      calories: 290,
      tag: "晚餐",
      tagColor: "bg-purple-500",
      nutrition: [
        { name: "碳水", value: "19g", color: "bg-yellow-400" },
        { name: "蛋白质", value: "26g", color: "bg-red-400" },
        { name: "脂肪", value: "19g", color: "bg-blue-400" },
        { name: "膳食纤维", value: "3.8g", color: "bg-green-400" }
      ],
      foods: [
        { id: "dinner-30-1", name: "清蒸鲈鱼", amount: "1份/145克", calories: 170, icon: "🐟", protein: 22, carbs: 2, fat: 8, fiber: 0.1 },
        { id: "dinner-30-2", name: "凉拌海带丝", amount: "1份/105克", calories: 120, icon: "🌿", protein: 4, carbs: 17, fat: 11, fiber: 3.7 }
      ]
    }
  }
};

export default generateMockData;