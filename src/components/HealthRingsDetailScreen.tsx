 
import React, { useState, useCallback, useEffect } from 'react';
import { HelpCircle, Utensils, Flame, Activity, Calculator } from 'lucide-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { calculateBMR } from '../utils/bmrCalculations';
import { nutritionSyncService } from '../services/nutritionSyncService';
import { calculateStepsData } from '../services/calorieCalculations';
import { getBeijingDayBoundsForInstant } from '../utils/dateUtils';
import { supabase } from '../config/supabase';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import { DateNavigator } from './common/DateNavigator'
import { useDragToClose } from '../hooks/useDragToClose'

interface HealthRingsDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
  onOpenExerciseLibrary: () => void;
  foodIntake?: number;
  exerciseCalories?: number;
}

const HealthRingsDetailScreen: React.FC<HealthRingsDetailScreenProps> = ({
  onClose,
  selectedDate: initialDate,
  onOpenExerciseLibrary,
  foodIntake = 0,
  exerciseCalories = 0
}) => {
  void onOpenExerciseLibrary;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const { profile } = useUserProfile();
  const [showBMRDetail, setShowBMRDetail] = useState(false);
  const [showFoodIntakeDetail, setShowFoodIntakeDetail] = useState(false);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [realFoodIntake, setRealFoodIntake] = useState(foodIntake);
  const [realExerciseCalories, setRealExerciseCalories] = useState(exerciseCalories);
  
  // Use drag to close hook
  const { handleClose } = useDragToClose({ onClose, closeDelay: 500 });

  const loadNutritionData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const nutritionTotals = await nutritionSyncService.getDailyNutritionTotals(selectedDate);
      setRealFoodIntake(Math.round(nutritionTotals.totalCalories));

      const { start: dayStart, end: dayEnd } = getBeijingDayBoundsForInstant(selectedDate);

      const { data: exerciseRows } = await supabase
        .from('health_records')
        .select('value, exercise_data')
        .eq('user_id', user.id)
        .eq('record_type', 'exercise')
        .gte('recorded_at', dayStart.toISOString())
        .lte('recorded_at', dayEnd.toISOString());

      const exerciseKcal =
        exerciseRows?.reduce((sum, row) => {
          const ed = row.exercise_data as { calories_burned?: number } | null;
          const kcal = Number(ed?.calories_burned ?? row.value ?? 0) || 0;
          return sum + kcal;
        }, 0) || 0;

      const { data: stepRows } = await supabase
        .from('health_records')
        .select('value')
        .eq('user_id', user.id)
        .eq('record_type', 'steps')
        .gte('recorded_at', dayStart.toISOString())
        .lte('recorded_at', dayEnd.toISOString());

      const stepSum =
        stepRows?.reduce((sum, row) => sum + (Number(row.value) || 0), 0) || 0;
      const w =
        profile?.current_weight && profile.current_weight > 0 ? profile.current_weight : 60;
      const stepKcal = Math.round(calculateStepsData(stepSum, 0, w).totalCalories);

      setRealExerciseCalories(Math.round(exerciseKcal + stepKcal));
    } catch (error) {
      console.error('❌ [HealthRingsDetail] Failed to load nutrition data:', error);
    }
  }, [selectedDate, profile?.current_weight]);

  // Load real-time nutrition data
  useEffect(() => {
    loadNutritionData();
  }, [loadNutritionData]);


  const bmr = profile ? calculateBMR(profile) : 1500;

  const currentFoodIntake = realFoodIntake;
  const targetFoodIntake = Math.round(bmr * 1.5);
  const foodIntakeProgress = Math.min(100, (currentFoodIntake / targetFoodIntake) * 100);

  const currentExerciseCalories = realExerciseCalories;
  const targetExerciseCalories = 400;
  const exerciseProgress = Math.min(100, (currentExerciseCalories / targetExerciseCalories) * 100);

  const currentBMR = bmr;
  const bmrProgress = 100;


  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  return (
    <DragPanel show={true} onClose={handleClose} zIndex={60} mask={{ visible: false }}
      header={<DetailHeader title={"饮食与运动"} leftAction={{ label: '返回', onClick: handleClose }} />}
    >

        <div className="px-4 space-y-1 flex-1 overflow-y-auto pb-4 scrollbar-hide">

          <div className="py-6">
            <div className="relative flex items-center justify-center" style={{ height: '340px' }}>
              <svg width="360" height="340" viewBox="0 0 360 340" className="max-w-full">
                <defs>
                  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1"/>
                  </filter>
                </defs>

                {/* 绿色圆环 - 饮食 (顶部) */}
                <g transform="translate(180, 80)">
                  <circle
                    r="70"
                    stroke="#10B981"
                    strokeWidth="18"
                    fill="#10B981"
                  />
                  <circle
                    r="70"
                    stroke="#10B981"
                    strokeWidth="18"
                    fill="none"
                    strokeDasharray={`${(foodIntakeProgress / 100) * (2 * Math.PI * 70)} ${2 * Math.PI * 70}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                  <circle r="70" stroke="white" strokeWidth="4" fill="none" />

                  <text x="0" y="-15" textAnchor="middle" className="text-base font-bold" fill="white">
                    总摄入
                  </text>
                  <text x="0" y="5" textAnchor="middle" className="text-base font-bold" fill="white">
                    饮食
                  </text>
                  <text x="0" y="25" textAnchor="middle" className="text-sm font-bold" fill="#FFFFFF">
                    {currentFoodIntake}kcal
                  </text>
                </g>

                {/* 黄色圆环 - 活动消耗 (左下) */}
                <g transform="translate(95, 205)">
                  <circle
                    r="70"
                    stroke="#F59E0B"
                    strokeWidth="18"
                    fill="#F59E0B"
                  />
                  <circle
                    r="70"
                    stroke="#F59E0B"
                    strokeWidth="18"
                    fill="none"
                    strokeDasharray={`${(exerciseProgress / 100) * (2 * Math.PI * 70)} ${2 * Math.PI * 70}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                  <circle r="70" stroke="white" strokeWidth="4" fill="none" />

                  <text x="0" y="-15" textAnchor="middle" className="text-base font-bold" fill="white">
                    活动
                  </text>
                  <text x="0" y="5" textAnchor="middle" className="text-base font-bold" fill="white">
                    消耗
                  </text>
                  <text x="0" y="25" textAnchor="middle" className="text-sm font-bold" fill="#FFFFFF">
                    {currentExerciseCalories}kcal
                  </text>
                </g>

                {/* 蓝色圆环 - 静息代谢 (右下) */}
                <g transform="translate(265, 205)">
                  <circle
                    r="70"
                    stroke="#3B82F6"
                    strokeWidth="18"
                    fill="#3B82F6"
                  />
                  <circle
                    r="70"
                    stroke="#3B82F6"
                    strokeWidth="18"
                    fill="none"
                    strokeDasharray={`${(bmrProgress / 100) * (2 * Math.PI * 70)} ${2 * Math.PI * 70}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                  <circle r="70" stroke="white" strokeWidth="4" fill="none" />

                  <text x="0" y="-15" textAnchor="middle" className="text-base font-bold" fill="white">
                    静息
                  </text>
                  <text x="0" y="5" textAnchor="middle" className="text-base font-bold" fill="white">
                    代谢
                  </text>
                  <text x="0" y="25" textAnchor="middle" className="text-sm font-bold" fill="#FFFFFF">
                    {currentBMR}kcal
                  </text>
                </g>

                {/* 中心白色圆环和文字 */}
                <g transform="translate(180, 180)">
                  <circle r="55" fill="white" filter="url(#shadow)" />

                  <text x="0" y="-10" textAnchor="middle" className="text-lg font-bold" fill="#EF4444">
                    减重
                  </text>
                  <text x="0" y="15" textAnchor="middle" className="text-2xl font-bold" fill="#F59E0B">
                    {Math.abs(currentFoodIntake - currentExerciseCalories - currentBMR)}
                  </text>
                  <text x="0" y="30" textAnchor="middle" className="text-xs" fill="#9CA3AF">
                    热量缺口
                  </text>
                </g>
              </svg>
            </div>

            {/* Date Navigator */}
            <div className="mt-4 flex items-center justify-center">
              <DateNavigator
                label={formatDate(selectedDate)}
                onPrev={() => navigateDate('prev')}
                onNext={() => navigateDate('next')}
              />
            </div>
          </div>

          {/* 热量缺口公式说明 */}
            <SectionCard className="my-1">
              <div className="flex items-center space-x-2 mb-4">
                <Calculator className="w-5 h-5 text-red-500" />
                <h3 className="text-base text-gray-600">热量缺口公式</h3>
              </div>
              <div className="text-sm text-gray-600">
                热量缺口 = 饮食摄入热量 - 运动消耗热量 - 基础代谢热量
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <div>缺口△&gt;0时，有助于减重；△&lt;0时，可能导致增重。</div>
              </div>
            </SectionCard>

            <SectionCard className="my-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Utensils className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-medium text-gray-800">饮食摄入热量</h3>
                </div>
                <button 
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => setShowFoodIntakeDetail(!showFoodIntakeDetail)}
                >
                  <HelpCircle className="w-5 h-5 text-gray-600" />
                </button>
              </div>

            <div className="mb-4">
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-bold text-green-500">{currentFoodIntake}</span>
                <span className="text-sm font-bold text-gray-800">kcal</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">今日饮食摄入（所选日期）</div>
            </div>

            {showFoodIntakeDetail && (
              <div className="mt-4 p-3 bg-green-50 rounded-xl">
                <div className="text-sm text-gray-700 font-medium mb-2">🍽️ 饮食摄入热量</div>
                <div className="text-sm text-gray-600">
                  合理控制饮食摄入热量是维持健康体重的关键。建议根据个人基础代谢和活动量调整每日摄入。
                </div>
              </div>
            )}
            </SectionCard>

            <SectionCard className="my-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-medium text-gray-800">运动消耗热量</h3>
                </div>
                <button 
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => setShowExerciseDetail(!showExerciseDetail)}
                >
                  <HelpCircle className="w-5 h-5 text-gray-600" />
                </button>
              </div>

            <div className="mb-4">
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-bold text-orange-500">{currentExerciseCalories}</span>
                <span className="text-sm font-bold text-gray-800">kcal</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">今日运动消耗（所选日期）</div>
            </div>

            {showExerciseDetail && (
              <div className="mt-4 p-3 bg-orange-50 rounded-xl">
                <div className="text-sm text-gray-700 font-medium mb-2">💪 运动消耗热量</div>
                <div className="text-sm text-gray-600">
                  运动消耗热量=运动热量+行走步数热量
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  通过运动消耗热量有助于保持健康体重。建议每天至少消耗300-500kcal通过运动。
                </div>
              </div>
            )}
            </SectionCard>

            <SectionCard className="my-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-medium text-gray-800">基础代谢热量</h3>
                </div>
                <button 
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => setShowBMRDetail(!showBMRDetail)}
                >
                  <HelpCircle className="w-5 h-5 text-gray-600" />
                </button>
              </div>

            <div className="mb-4">
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-bold text-purple-500">{currentBMR}</span>
                <span className="text-sm font-bold text-gray-800">kcal/天</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">您的基础代谢率 (BMR)</div>
            </div>

            {showBMRDetail && (
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="text-sm text-gray-700 font-medium mb-2">⚡ 什么是基础代谢率？</div>
                <div className="text-sm text-gray-600 leading-relaxed mb-3">
                  基础代谢率是指在静息状态下,身体维持基本生理功能(如呼吸、心跳、体温调节等)所需要的最低热量消耗。您的实际每日消耗会根据步数和运动数据动态计算。
                </div>
                <div className="text-xs text-gray-500 bg-white p-3 rounded-lg">
                  <div className="font-medium mb-2">本应用使用 Mifflin-St Jeor 方程计算 BMR</div>
                  <div className="mb-2">
                    <div className="font-medium mb-1">男性公式:</div>
                    <div className="font-mono text-xs">
                      BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄 + 5
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-1">女性公式:</div>
                    <div className="font-mono text-xs">
                      BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄 - 161
                    </div>
                  </div>
                </div>
              </div>
            )}
            </SectionCard>
        </div>
    </DragPanel>
  );
};

export default HealthRingsDetailScreen;
