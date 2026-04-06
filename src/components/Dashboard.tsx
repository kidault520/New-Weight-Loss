import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { DayData } from '../utils/mockData';
// WeightRulerSlider已由QuickEntryModals组件使用，不再需要直接导入
import EmotionCard from './EmotionCard';
import SleepCard from './SleepCard';
import BloodGlucoseCard from './BloodGlucoseCard';
import BreathingCardForDashboard from './breathing/BreathingCardForDashboard';
import StepsCard from './StepsCard';
import ExerciseCard from './ExerciseCard';
import MeasurementsCard from './MeasurementsCard';
import CaloriesCard from './CaloriesCard';
import WeightCardForDashboard from './WeightCardForDashboard';
import NutritionCardForDashboard from './NutritionCardForDashboard';
import WaterCardForDashboard from './WaterCardForDashboard';
import { calculateStepsData } from '../services/calorieCalculations';
import { useUserProfile } from '../contexts/UserProfileContext';
import { calculateBMR } from '../utils/bmrCalculations';
import { useWeightRecords } from '../hooks/useWeightRecords';
import { useWeightRecordsQuery } from '../hooks/useWeightRecordsQuery';
import { useWaterRecordsQuery } from '../hooks/useWaterRecordsQuery';
import { nutritionSyncService } from '../services/nutritionSyncService';
// DragPanel已由QuickEntryModals组件使用，不再需要直接导入
import { AlertDialog } from './common/AlertDialog';
import { supabase } from '../config/supabase';
import { useAlert } from '../hooks/useAlert';
import { useStepsRecordsQuery } from '../hooks/useStepsRecordsQuery';
import { useSleepRecordsQuery } from '../hooks/useSleepRecordsQuery';
import { useBloodGlucoseRecordsQuery } from '../hooks/useBloodGlucoseRecordsQuery';
import { QuickEntryModals } from './dashboard/QuickEntryModals';
import { DashboardCardGrid } from './dashboard/DashboardCardGrid';
import { useCalendarLogic } from '../hooks/useCalendarLogic';

interface DashboardProps {
  selectedDate: Date;
  displayedWeekStart: Date;
  data: DayData;
  dashboardCardOrder: string[];
  hiddenDashboardCards: string[];
  onSelectedDateChange: (date: Date) => void;
  onDisplayedWeekStartChange: (date: Date) => void;
  onUpdateDayData: (date: Date, updates: Partial<DayData>) => void;
  onOpenWeightDetail: () => void;
  onOpenWaterDetail: () => void;
  onOpenStepsDetail: () => void;
  onOpenMeasurementsDetail: () => void;
  onOpenExerciseDetail: () => void;
  onOpenCalorieDetail: () => void;
  onOpenBodyCompositionDetail: () => void;
  onOpenEmotionJar: () => void;
  onOpenSleepDetail: () => void;
  onOpenBloodGlucoseDetail: () => void;
  onOpenAIChat: () => void;
  onOpenEditDashboard: () => void;
  onOpenNutritionDetail: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  selectedDate,
  displayedWeekStart,
  data,
  dashboardCardOrder,
  hiddenDashboardCards,
  onSelectedDateChange,
  onDisplayedWeekStartChange,
  onUpdateDayData,
  onOpenWeightDetail,
  onOpenWaterDetail,
  onOpenStepsDetail,
  onOpenMeasurementsDetail,
  onOpenExerciseDetail,
  onOpenCalorieDetail,
  onOpenBodyCompositionDetail,
  onOpenEmotionJar,
  onOpenSleepDetail,
  onOpenBloodGlucoseDetail,
  onOpenAIChat,
  onOpenEditDashboard,
  onOpenNutritionDetail
}) => {
  const { profile } = useUserProfile();
  const userWeight = profile?.current_weight || 70;
  /** 日聚合数据里的 target 可能滞后于档案；展示以 UserProfile 为准 */
  const weightCardData = useMemo(
    () => ({
      ...data.weight,
      target:
        typeof profile?.target_weight === 'number' &&
        Number.isFinite(profile.target_weight) &&
        profile.target_weight > 0
          ? profile.target_weight
          : data.weight.target,
    }),
    [data.weight, profile?.target_weight],
  );
  const bodyWeight = data.weight.current || profile?.current_weight || null;
  const bodyHeight = profile?.height || null;
  const stepsCurrent = data.steps.current;
  const stepsFloors = data.steps.floors ?? 0;
  const stepsTarget = data.steps.target;
  const waterCurrent = data.water.current;
  const waterTarget = data.water.target;
  const { getLatestRecord } = useWeightRecords();
  const latestWeightRecord = getLatestRecord();
  
  // 使用 React Query Hooks 进行数据获取和状态管理
  const { addRecord: addStepsRecord } = useStepsRecordsQuery();
  const { addRecord: addSleepRecord } = useSleepRecordsQuery();
  const { addRecord: addBloodGlucoseRecord } = useBloodGlucoseRecordsQuery();
  const { addRecord: addWeightRecord } = useWeightRecordsQuery();
  const { addRecord: addWaterRecord } = useWaterRecordsQuery();
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [calendarDate, setCalendarDate] = React.useState(new Date());
  const [showWeightModal, setShowWeightModal] = React.useState(false);
  const [weightInput, setWeightInput] = React.useState('');
  const [showWaterModal, setShowWaterModal] = React.useState(false);
  const [waterAmount, setWaterAmount] = React.useState(250);
  const [showStepsModal, setShowStepsModal] = React.useState(false);
  const [stepsAmount, setStepsAmount] = React.useState(1000);
  const [showSleepModal, setShowSleepModal] = React.useState(false);
  const [sleepHours, setSleepHours] = React.useState(7);
  const [sleepMinutes, setSleepMinutes] = React.useState(30);
  const [showBloodGlucoseModal, setShowBloodGlucoseModal] = React.useState(false);
  const [glucoseValue, setGlucoseValue] = React.useState(5.5);
  
  // Use alert hook
  const { alertState, showError, showWarning, hideAlert } = useAlert();
  // Animation states for cards (managed by DashboardCard internally, but kept for compatibility)
  const [isShrunk, setIsShrunk] = React.useState(false);
  const [waterShrunk, setWaterShrunk] = React.useState(false);
  const [stepsShrunk, setStepsShrunk] = React.useState(false);
  const [measurementsShrunk, setMeasurementsShrunk] = React.useState(false);
  const [exerciseShrunk, setExerciseShrunk] = React.useState(false);
  const [calorieShrunk, setCalorieShrunk] = React.useState(false);
  const [nutritionShrunk, setNutritionShrunk] = React.useState(false);
  const [sleepShrunk, setSleepShrunk] = React.useState(false);
  const [bloodGlucoseShrunk, setBloodGlucoseShrunk] = React.useState(false);

  // Real-time food intake：与 nutrition 接口对齐；并随日聚合 data 更新（避免首屏卡在 0）
  const [realTimeFoodIntake, setRealTimeFoodIntake] = useState(data.calories.foodIntake);

  useEffect(() => {
    setRealTimeFoodIntake(data.calories.foodIntake);
  }, [data.calories.foodIntake]);

  // Use ref to prevent duplicate weight submissions
  const isSubmittingWeightRef = useRef<boolean>(false);

  // 移除事件监听器，改用props传递

  // 按选中日期拉取营养合计（含首次进入；此前用 dateChanged 误跳过首屏）
  useEffect(() => {
    const loadNutritionData = async () => {
      try {
        const nutritionTotals = await nutritionSyncService.getDailyNutritionTotals(selectedDate);
        setRealTimeFoodIntake(Math.round(nutritionTotals.totalCalories));
      } catch (error) {
        console.error('❌ [Dashboard] Failed to load nutrition data:', error);
        // 失败时由「跟 data.calories.foodIntake 同步」的 effect 兜底
      }
    };

    void loadNutritionData();

    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();
    if (!isTodaySelected) {
      return undefined;
    }
    const interval = setInterval(loadNutritionData, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Generate week dates around current date
  const generateWeekDates = () => {
    const dates: Date[] = [];
    const startOfWeek = new Date(displayedWeekStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };
  
  const dates = generateWeekDates();
  
  // Calculate today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if current displayed week contains today
  const weekContainsToday = dates.some(date => {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    return dateOnly.getTime() === today.getTime();
  });
  
  // Can navigate to next week (future) only if current week doesn't contain today
  const canNavigateToNextWeek = !weekContainsToday;

  // 使用useCalendarLogic Hook替代日历相关函数
  const { generateCalendarDays, isToday, isSameMonth } = useCalendarLogic(calendarDate);

  const handleOpenWeightModal = () => {
    const initialValue = latestWeightRecord?.value || profile?.current_weight || 60;
    setWeightInput(initialValue.toFixed(1));
    setShowWeightModal(true);
  };

  const handleWeightSubmit = async () => {
    // 防止重复提交
    if (isSubmittingWeightRef.current) {
      console.warn('⚠️ [Dashboard] Weight submission already in progress, skipping duplicate call');
      return;
    }
    
    if (weightInput && parseFloat(weightInput) > 0) {
      const newWeight = parseFloat(weightInput);
      // 立即关闭modal，提供即时反馈
      setShowWeightModal(false);
      const savedWeightInput = weightInput;
      setWeightInput('');
      
      // 设置提交状态
      isSubmittingWeightRef.current = true;
      
      try {
        await addWeightRecord({
          weight: newWeight,
          date: new Date(),
        });
        onUpdateDayData(selectedDate, {
          weight: {
            current: newWeight,
            target: weightCardData.target,
            hasRecord: true,
          }
        });
        // React Query 会自动处理数据更新，无需派发事件
      } catch (error) {
        console.error('Failed to save weight:', error);
        // 保存失败时恢复输入值并重新打开modal
        setWeightInput(savedWeightInput);
        setShowWeightModal(true);
        showError('保存失败', '保存失败，请重试');
      } finally {
        // 重置提交状态
        isSubmittingWeightRef.current = false;
      }
    }
  };

  const handleWaterAdd = async () => {
    // 立即关闭modal，提供即时反馈
    const savedWaterAmount = waterAmount;
    setShowWaterModal(false);
    setWaterAmount(250); // 重置为默认值
    
    try {
      // 使用当前时间，但日期部分使用selectedDate
      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      // 使用 React Query Hook 保存记录
      await addWaterRecord({
        amount: savedWaterAmount,
        date: recordDate,
      });
      
      // 等待数据库写入完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newWaterAmount = data.water.current + savedWaterAmount;
      onUpdateDayData(selectedDate, {
        water: {
          current: newWaterAmount,
          target: data.water.target,
        }
      });

      // React Query 会自动处理数据更新，无需派发事件
    } catch (error) {
      console.error('Failed to save water record:', error);
      // 保存失败时恢复输入值并重新打开modal
      setWaterAmount(savedWaterAmount);
      setShowWaterModal(true);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  const handleStepsAdd = async () => {
    // 立即关闭modal，提供即时反馈
    const savedStepsAmount = stepsAmount;
    setShowStepsModal(false);
    setStepsAmount(1000);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // 保存失败时恢复并重新打开modal
        setStepsAmount(savedStepsAmount);
        setShowStepsModal(true);
        showWarning('未登录', '用户未登录，请重新登录');
        return;
      }

      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      // 使用 React Query Hook 添加数据
      await addStepsRecord({
        steps: savedStepsAmount,
        date: recordDate,
        notes: '手动记录'
      });
      
      const newSteps = data.steps.current + savedStepsAmount;
      onUpdateDayData(selectedDate, {
        steps: {
          current: newSteps,
          target: data.steps.target,
          floors: data.steps.floors,
          hourlyData: data.steps.hourlyData,
        }
      });

      // React Query 会自动处理数据更新，无需派发事件
    } catch (error: any) {
      console.error('Failed to save steps record:', error);
      // 保存失败时恢复输入值并重新打开modal
      setStepsAmount(savedStepsAmount);
      setShowStepsModal(true);
      let errorMessage = '未知错误';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `错误代码: ${error.code}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  const handleSleepAdd = async () => {
    // 立即关闭modal，提供即时反馈
    const savedSleepHours = sleepHours;
    const savedSleepMinutes = sleepMinutes;
    setShowSleepModal(false);
    setSleepHours(7);
    setSleepMinutes(30);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // 保存失败时恢复并重新打开modal
        setSleepHours(savedSleepHours);
        setSleepMinutes(savedSleepMinutes);
        setShowSleepModal(true);
        showWarning('未登录', '用户未登录，请重新登录');
        return;
      }

      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      const sleepValue = savedSleepHours + savedSleepMinutes / 60;
      
      // 使用 React Query Hook 添加数据
      await addSleepRecord({
        hours: sleepValue,
        date: recordDate,
        notes: '手动记录'
      });
      
      // React Query 会自动处理数据更新，无需派发事件
    } catch (error: any) {
      console.error('Failed to save sleep record:', error);
      // 保存失败时恢复输入值并重新打开modal
      setSleepHours(savedSleepHours);
      setSleepMinutes(savedSleepMinutes);
      setShowSleepModal(true);
      let errorMessage = '未知错误';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `错误代码: ${error.code}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  const handleBloodGlucoseAdd = async () => {
    // 立即关闭modal，提供即时反馈
    const savedGlucoseValue = glucoseValue;
    setShowBloodGlucoseModal(false);
    setGlucoseValue(5.5);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // 保存失败时恢复并重新打开modal
        setGlucoseValue(savedGlucoseValue);
        setShowBloodGlucoseModal(true);
        showWarning('未登录', '用户未登录，请重新登录');
        return;
      }

      const recordDate = new Date(selectedDate);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      // 使用 React Query Hook 添加数据
      await addBloodGlucoseRecord({
        value: savedGlucoseValue,
        date: recordDate,
        notes: '手动记录'
      });
      
      // React Query 会自动处理数据更新，无需派发事件
    } catch (error: any) {
      console.error('Failed to save blood glucose record:', error);
      // 保存失败时恢复输入值并重新打开modal
      setGlucoseValue(savedGlucoseValue);
      setShowBloodGlucoseModal(true);
      let errorMessage = '未知错误';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `错误代码: ${error.code}`;
      } else if (error?.hint) {
        errorMessage = `${error.message} (${error.hint})`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      showError('保存失败', `保存失败：${errorMessage}\n请检查网络连接或稍后重试`);
    }
  };

  // Card click handlers with animation
  const handleWeightCardClick = () => {
    setIsShrunk(true);
    setTimeout(() => {
      onOpenWeightDetail();
      setIsShrunk(false);
    }, 100);
  };

  const handleWaterCardClick = () => {
    setWaterShrunk(true);
    setTimeout(() => {
      onOpenWaterDetail();
      setWaterShrunk(false);
    }, 100);
  };

  const handleStepsCardClick = () => {
    setStepsShrunk(true);
    setTimeout(() => {
      onOpenStepsDetail();
      setStepsShrunk(false);
    }, 100);
  };

  const handleMeasurementsCardClick = () => {
    setMeasurementsShrunk(true);
    setTimeout(() => {
      onOpenMeasurementsDetail();
      setMeasurementsShrunk(false);
    }, 100);
  };

  const handleExerciseCardClick = () => {
    setExerciseShrunk(true);
    setTimeout(() => {
      onOpenExerciseDetail(); // 点击运动卡片应该进入运动详情页面
      setExerciseShrunk(false);
    }, 100);
  };

  const handleCalorieCardClick = () => {
    setCalorieShrunk(true);
    setTimeout(() => {
      onOpenCalorieDetail();
      setCalorieShrunk(false);
    }, 100);
  };

  const handleNutritionCardClick = () => {
    setNutritionShrunk(true);
    setTimeout(() => {
      onOpenNutritionDetail(); // 点击营养素卡片应该进入营养素详情页面
      setNutritionShrunk(false);
    }, 100);
  };

  const handleSleepCardClick = () => {
    setSleepShrunk(true);
    setTimeout(() => {
      onOpenSleepDetail();
      setSleepShrunk(false);
    }, 100);
  };

  const handleBloodGlucoseCardClick = () => {
    setBloodGlucoseShrunk(true);
    setTimeout(() => {
      onOpenBloodGlucoseDetail();
      setBloodGlucoseShrunk(false);
    }, 100);
  };

  // Calculate progress percentages
  // Calculate BMR for net calorie calculation (memoized)
  const bmr = useMemo(() => {
    return profile ? calculateBMR(profile) : 1500;
  }, [profile]);

  // Calculate exercise calories including steps (memoized)
  const { totalExerciseCalories, netCalories } = useMemo(() => {
    const steps = calculateStepsData(stepsCurrent, stepsFloors, userWeight);
    const exerciseCalories = data.exercise?.calories || 0;
    const totalExercise = Math.round(exerciseCalories + steps.totalCalories);
    const net = Math.round(realTimeFoodIntake - totalExercise - bmr);

    return {
      totalExerciseCalories: totalExercise,
      netCalories: net,
    };
  }, [stepsCurrent, stepsFloors, data.exercise?.calories, userWeight, realTimeFoodIntake, bmr]);

  /** 与顶栏/日聚合 remaining（摄入−运动含步数−BMR）同源；圆环进度按「摄入 / bmr×1.5」与三环饮食目标一致 */
  const foodTargetForRing = Math.max(1, Math.round(bmr * 1.5));
  const calorieProgress = Math.min(100, Math.max(0, (realTimeFoodIntake / foodTargetForRing) * 100));
  const waterProgress = (data.water.current / data.water.target) * 100;
  const bodyBMI = useMemo(() => {
    if (!bodyWeight || !bodyHeight) return null;
    return +(bodyWeight / ((bodyHeight / 100) * (bodyHeight / 100))).toFixed(1);
  }, [bodyWeight, bodyHeight]);
  const bodyScore = useMemo(() => {
    const bmiScore = bodyBMI ? Math.max(0, 100 - Math.min(20, Math.abs(bodyBMI - 22) * 5)) : 70;
    const waterScore = Math.min(100, Math.round((waterCurrent / Math.max(1, waterTarget)) * 100));
    const stepsScore = Math.min(100, Math.round((stepsCurrent / Math.max(1, stepsTarget)) * 100));
    return Math.round(bmiScore * 0.5 + waterScore * 0.2 + stepsScore * 0.3);
  }, [bodyBMI, waterCurrent, waterTarget, stepsCurrent, stepsTarget]);

  const bodyFatPercent = useMemo(() => {
    if (!bodyBMI) return null;
    const age = profile?.age || 30;
    const sexValue = profile?.gender === 'male' ? 1 : 0;
    const value = 1.2 * bodyBMI + 0.23 * age - 10.8 * sexValue - 5.4;
    return +Math.max(8, Math.min(45, value)).toFixed(1);
  }, [bodyBMI, profile?.age, profile?.gender]);
  const scoreAdvice = useMemo(() => {
    if (bodyScore >= 85) return '身体状态很不错，继续保持当前饮食与运动节奏。';
    if (bodyScore >= 70) return '建议保持规律饮食，并继续稳定增加日常活动量。';
    if (bodyScore >= 60) return '建议控制高油高糖摄入，同时循序渐进提升运动量。';
    return '建议优先规律作息与饮食，先从轻量运动开始逐步提升。';
  }, [bodyScore]);

  // Card components mapping
  const cardComponents = {
    calories: (
      <CaloriesCard
        key="calories"
        realTimeFoodIntake={realTimeFoodIntake}
        totalExerciseCalories={totalExerciseCalories}
        netCalories={netCalories}
        calorieProgress={calorieProgress}
        onCardClick={handleCalorieCardClick}
        onAIChatClick={onOpenAIChat}
        isShrunk={calorieShrunk}
      />
    ),
    weight: (
      <WeightCardForDashboard
        key="weight"
        data={weightCardData}
        onCardClick={handleWeightCardClick}
        onPlusClick={handleOpenWeightModal}
        isShrunk={isShrunk}
      />
    ),
    nutrition: (
      <NutritionCardForDashboard
        key="nutrition"
        data={data.nutrition}
        onCardClick={handleNutritionCardClick}
        isShrunk={nutritionShrunk}
      />
    ),
    water: (
      <WaterCardForDashboard
        key="water"
        data={data.water}
        waterProgress={waterProgress}
        onCardClick={handleWaterCardClick}
        onPlusClick={() => setShowWaterModal(true)}
        isShrunk={waterShrunk}
      />
    ),
    steps: (
      <StepsCard
        key="steps"
        data={data.steps}
        userWeight={userWeight}
        onCardClick={handleStepsCardClick}
        onPlusClick={() => setShowStepsModal(true)}
        isShrunk={stepsShrunk}
      />
    ),
    exercise: (
      <ExerciseCard
        key="exercise"
        data={data.exercise || {}}
        onCardClick={handleExerciseCardClick}
        isShrunk={exerciseShrunk}
      />
    ),
    measurements: (
      <MeasurementsCard
        key="measurements"
        data={{
          chest: data.measurements.chest ?? undefined,
          waist: data.measurements.waist ?? undefined,
          upperArm: data.measurements.upperArm ?? undefined,
          hips: data.measurements.hips ?? undefined,
          thigh: data.measurements.thigh ?? undefined,
          calf: data.measurements.calf ?? undefined,
        }}
        onCardClick={handleMeasurementsCardClick}
        isShrunk={measurementsShrunk}
      />
    ),
    emotion: (
      <EmotionCard 
        key="emotion"
        data={data.emotion} 
        onOpenEmotionJar={onOpenEmotionJar} 
      />
    ),
    sleep: (
      <SleepCard 
        key="sleep"
        data={data.sleep} 
        onOpenSleepDetail={handleSleepCardClick}
        onOpenSleepAddModal={() => setShowSleepModal(true)}
        isShrunk={sleepShrunk}
      />
    ),
    bloodGlucose: (
      <BloodGlucoseCard 
        key="bloodGlucose"
        data={data.bloodGlucose} 
        onOpenBloodGlucoseDetail={handleBloodGlucoseCardClick}
        onOpenBloodGlucoseAddModal={() => setShowBloodGlucoseModal(true)}
        isShrunk={bloodGlucoseShrunk}
      />
    ),
    breathing: (
      <BreathingCardForDashboard key="breathing" />
    ),
  };

  // 卡片网格布局已由DashboardCardGrid组件处理

  return (
    <div className="px-4 space-y-3 relative pt-3 pb-2 bg-[#F5F7FA]">
      {/* Calendar Week */}
      <div hidden className="rounded-xl py-0.5 px-1 border border-[#E6EBF2] bg-white">
        <div className="grid grid-cols-7 gap-2">
          {dates.map((dateObj, index) => {
            // 判断日期状态
            const dateOnly = new Date(dateObj);
            dateOnly.setHours(0, 0, 0, 0);
            const isToday = dateOnly.getTime() === today.getTime();
            const isPast = dateOnly.getTime() < today.getTime();
            const isSelected = selectedDate.toDateString() === dateObj.toDateString();
            
            return (
              <button
                key={dateObj.getTime()}
                onClick={() => {
                  if (index === 0) {
                    // First date - go to previous week (past)
                    const newWeekStart = new Date(displayedWeekStart);
                    newWeekStart.setDate(displayedWeekStart.getDate() - 7);
                    onDisplayedWeekStartChange(newWeekStart);
                    // Select the last date of the new week
                    const newSelectedDate = new Date(newWeekStart);
                    newSelectedDate.setDate(newWeekStart.getDate() + 6);
                    onSelectedDateChange(newSelectedDate);
                  } else if (index === dates.length - 1) {
                    // Last date - go to next week (future) only if allowed
                    if (canNavigateToNextWeek) {
                      const newWeekStart = new Date(displayedWeekStart);
                      newWeekStart.setDate(displayedWeekStart.getDate() + 7);
                      onDisplayedWeekStartChange(newWeekStart);
                      // Select the last date of the new week
                      const newSelectedDate = new Date(newWeekStart);
                      newSelectedDate.setDate(newWeekStart.getDate() + 6);
                      onSelectedDateChange(newSelectedDate);
                    } else {
                      // If can't navigate to next week, just select the date
                      onSelectedDateChange(dateObj);
                    }
                  } else {
                    // Middle dates - select the date only
                    onSelectedDateChange(dateObj);
                  }
                }}
                className={`
                  aspect-square rounded-xl flex items-center justify-center text-lg font-medium transition-all
                  ${isSelected
                    ? 'bg-white/80 text-gray-800 shadow-sm border-2 border-white'
                    : isPast
                      ? 'bg-transparent text-gray-400'
                      : isToday
                        ? 'bg-transparent text-gray-700 hover:bg-white/40'
                        : 'bg-transparent text-gray-700 hover:bg-white/40'
                  }
                `}
              >
                {dateObj.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* 第一板块：身体得分 */}
      <div className="rounded-2xl border border-[#E6EBF2] bg-white px-4 py-3.5">
        <p className="text-[15px] text-gray-700 mb-3">身体得分</p>
        <div className="flex items-start gap-4 mb-4">
          <button
            type="button"
            className="shrink-0 leading-none text-left"
            onClick={onOpenBodyCompositionDetail}
          >
            <span className="text-[44px] font-semibold text-[#101828]">{bodyScore}</span>
            <span className="text-base text-[#101828] ml-1">分</span>
          </button>
          <p className="text-sm text-gray-700 leading-6 pt-1">{scoreAdvice}</p>
        </div>
        <div className="grid grid-cols-2 border-t border-[#EEF2F7] pt-3">
          <div className="pr-3">
            <button
              type="button"
              className="w-full flex items-end justify-between text-left"
              onClick={onOpenBodyCompositionDetail}
            >
              <div>
                <div className="text-[40px] leading-10 font-medium text-[#101828]">{bodyBMI ? bodyBMI.toFixed(1) : '—'}</div>
                <div className="text-base text-gray-500 mt-1">BMI</div>
              </div>
              <span className="text-gray-300 text-3xl">›</span>
            </button>
          </div>
          <div className="pl-3 border-l border-[#EEF2F7]">
            <button
              type="button"
              className="w-full flex items-end justify-between text-left"
              onClick={onOpenBodyCompositionDetail}
            >
              <div>
                <div className="text-[40px] leading-10 font-medium text-[#101828]">
                  {bodyFatPercent ? `${bodyFatPercent.toFixed(1)}` : '—'}
                  <span className="text-xl">%</span>
                </div>
                <div className="text-base text-gray-500 mt-1">体脂率</div>
              </div>
              <span className="text-gray-300 text-3xl">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="fixed inset-0 z-[55]" onClick={() => setShowCalendar(false)}>
          <div 
            className="absolute top-16 right-4 bg-white rounded-xl p-4 shadow-lg w-72 animate-in slide-in-from-top-2 duration-200 z-[60]" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transformOrigin: 'top right'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Calendar Header */}
            <div className="flex justify-between items-center mb-3">
              <button 
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
                className="p-1 hover:bg-gray-100 rounded-md"
              >
                ←
              </button>
              <h3 className="text-base font-semibold">
                {calendarDate.getFullYear()}年{calendarDate.getMonth() + 1}月
              </h3>
              <button 
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
                className="p-1 hover:bg-gray-100 rounded-md"
              >
                →
              </button>
            </div>

            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                <div key={day} className="text-center text-xs text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {generateCalendarDays().map((date, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCalendarDate(date);
                    setShowCalendar(false);
                  }}
                  className={`
                    aspect-square rounded-md flex items-center justify-center text-xs transition-all
                    ${isToday(date) 
                      ? 'bg-purple-500 text-white font-semibold' 
                      : isSameMonth(date)
                        ? 'text-gray-800 hover:bg-purple-100'
                        : 'text-gray-300 hover:bg-gray-100'
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              ))}
            </div>

            {/* Today Button */}
            <div className="mt-3 flex justify-center">
              <button 
                onClick={() => {
                  setCalendarDate(new Date());
                  setShowCalendar(false);
                }}
                className="px-3 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors text-sm"
              >
                回到今天
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 使用QuickEntryModals组件替代所有快速录入模态框 */}
      <QuickEntryModals
        showWeightModal={showWeightModal}
        showWaterModal={showWaterModal}
        showStepsModal={showStepsModal}
        showSleepModal={showSleepModal}
        showBloodGlucoseModal={showBloodGlucoseModal}
        onCloseWeightModal={() => setShowWeightModal(false)}
        onCloseWaterModal={() => setShowWaterModal(false)}
        onCloseStepsModal={() => setShowStepsModal(false)}
        onCloseSleepModal={() => setShowSleepModal(false)}
        onCloseBloodGlucoseModal={() => setShowBloodGlucoseModal(false)}
        weightInput={weightInput}
        waterAmount={waterAmount}
        stepsAmount={stepsAmount}
        sleepHours={sleepHours}
        sleepMinutes={sleepMinutes}
        glucoseValue={glucoseValue}
        onWeightInputChange={setWeightInput}
        onWaterAmountChange={setWaterAmount}
        onStepsAmountChange={setStepsAmount}
        onSleepHoursChange={setSleepHours}
        onSleepMinutesChange={setSleepMinutes}
        onGlucoseValueChange={setGlucoseValue}
        onWeightSubmit={handleWeightSubmit}
        onWaterAdd={handleWaterAdd}
        onStepsAdd={handleStepsAdd}
        onSleepAdd={handleSleepAdd}
        onBloodGlucoseAdd={handleBloodGlucoseAdd}
        data={data}
        latestWeightValue={latestWeightRecord?.value}
        defaultWeight={profile?.current_weight || 60}
      />

      {/* Main Dashboard Cards */}
      <DashboardCardGrid
        cardComponents={cardComponents}
        dashboardCardOrder={dashboardCardOrder}
        hiddenDashboardCards={hiddenDashboardCards}
      />

      {/* Edit Dashboard Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={onOpenEditDashboard}
          className="bg-gray-100 border border-gray-300 shadow-sm rounded-full px-4 py-2 flex items-center justify-center space-x-2 hover:bg-gray-200 transition-colors duration-300"
        >
          <LayoutGrid className="w-4 h-4 text-gray-500" />
          <span className="text-gray-500 font-medium text-sm">编辑仪表板</span>
        </button>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
        zIndex={80}
      />
    </div>
  );
};

// 使用 React.memo 优化，避免不必要的重新渲染
export default React.memo(Dashboard, (prevProps, nextProps) => {
  // 自定义比较函数：返回 true 表示 props 相等（不重新渲染），返回 false 表示需要重新渲染
  const datesEqual = 
    prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime() &&
    prevProps.displayedWeekStart.getTime() === nextProps.displayedWeekStart.getTime();
  
  const cardsEqual = 
    JSON.stringify(prevProps.dashboardCardOrder) === JSON.stringify(nextProps.dashboardCardOrder) &&
    JSON.stringify(prevProps.hiddenDashboardCards) === JSON.stringify(nextProps.hiddenDashboardCards);
  
  // 比较 data 对象的关键字段，而不是整个对象引用
  const dataEqual = 
    prevProps.data.calories.foodIntake === nextProps.data.calories.foodIntake &&
    prevProps.data.calories.total === nextProps.data.calories.total &&
    prevProps.data.calories.remaining === nextProps.data.calories.remaining &&
    prevProps.data.water.current === nextProps.data.water.current &&
    prevProps.data.water.target === nextProps.data.water.target &&
    prevProps.data.steps.current === nextProps.data.steps.current &&
    prevProps.data.exercise?.calories === nextProps.data.exercise?.calories &&
    prevProps.data.sleep?.duration === nextProps.data.sleep?.duration &&
    prevProps.data.sleep?.quality === nextProps.data.sleep?.quality &&
    prevProps.data.sleep?.hasRecord === nextProps.data.sleep?.hasRecord &&
    prevProps.data.bloodGlucose?.current === nextProps.data.bloodGlucose?.current &&
    prevProps.data.bloodGlucose?.hasRecord === nextProps.data.bloodGlucose?.hasRecord;
  
  return datesEqual && cardsEqual && dataEqual;
});