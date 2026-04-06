import React, { useState } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { supabase } from '../../config/supabase';
import { calculateBMR } from '../../utils/bmrCalculations';
import { OnboardingPageLayout } from './OnboardingPageLayout';
import { OnboardingSelectButton } from './OnboardingSelectButton';
import { BottomActionBar } from '../common/BottomActionBar';
import WeightRulerSlider from '../WeightRulerSlider';
import ScrollPicker from '../ScrollPicker';
import HeightRulerPicker from '../HeightRulerPicker';
import { getUserStorageItem, setUserStorageItem } from '../../utils/userStorage';

export const AgeInputPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [age, setAge] = useState<number>(data.age || 35);

  const handleNext = () => {
    updateData({ age });
    goToNextStep();
  };

  return (
    <>
      <OnboardingPageLayout currentSection={2} totalSections={3} contentClassName="flex flex-col items-center justify-center px-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mb-12">你的年龄是</h1>

        <div className="w-full max-w-sm">
          <ScrollPicker
            value={age}
            onChange={setAge}
            min={18}
            max={100}
            unit="岁"
          />
        </div>
      </OnboardingPageLayout>

      <BottomActionBar
        visible={true}
        primaryText="下一步"
        onPrimaryClick={handleNext}
        buttonClassName="w-full py-4 rounded-2xl bg-emerald-400 text-white text-lg font-medium hover:bg-emerald-500 transition-colors shadow-lg"
        containerClassName="bg-transparent px-6 pb-8 pt-4"
      />
    </>
  );
};

export const HeightInputPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [height, setHeight] = useState<number>(data.height || 170);

  const handleNext = () => {
    updateData({ height });
    goToNextStep();
  };

  return (
    <>
      <OnboardingPageLayout currentSection={2} totalSections={3} contentClassName="flex flex-col items-center px-6 overflow-hidden pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mb-8 mt-4">您的身高</h1>

        <div className="flex-1 w-full max-w-sm overflow-hidden">
          <HeightRulerPicker
            value={height}
            onChange={setHeight}
            min={100}
            max={250}
          />
        </div>
      </OnboardingPageLayout>

      <BottomActionBar
        visible={true}
        primaryText="下一步"
        onPrimaryClick={handleNext}
        buttonClassName="w-full py-4 rounded-2xl bg-emerald-400 text-white text-lg font-medium hover:bg-emerald-500 transition-colors shadow-lg"
        containerClassName="bg-transparent px-6 pb-8 pt-4"
      />
    </>
  );
};

export const CurrentWeightPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [weight, setWeight] = useState<number>(data.currentWeight || 70);

  const handleNext = () => {
    updateData({ currentWeight: weight });
    goToNextStep();
  };

  // 计算BMI
  const height = data.height || 170;
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);

  // 获取BMI状态
  const getBMIStatus = (bmi: number) => {
    if (bmi < 18.5) return { text: '过瘦', color: 'text-blue-500' };
    if (bmi < 24) return { text: '标准', color: 'text-green-500' };
    if (bmi < 28) return { text: '超重', color: 'text-orange-500' };
    return { text: '肥胖', color: 'text-red-500' };
  };

  // 获取BMI进度条位置 (0-100%)
  const getBMIPosition = (bmi: number) => {
    if (bmi < 18.5) return (bmi / 18.5) * 25;
    if (bmi < 24) return 25 + ((bmi - 18.5) / (24 - 18.5)) * 25;
    if (bmi < 28) return 50 + ((bmi - 24) / (28 - 24)) * 25;
    return Math.min(75 + ((bmi - 28) / 12) * 25, 100);
  };

  const bmiStatus = getBMIStatus(bmi);
  const bmiPosition = getBMIPosition(bmi);

  return (
    <>
      <OnboardingPageLayout currentSection={2} totalSections={3} contentClassName="flex flex-col items-center px-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mb-8 mt-4">您的体重</h1>

        <div className="w-full max-w-sm space-y-6">
          <WeightRulerSlider
            value={weight}
            onChange={setWeight}
            min={30}
            max={150}
          />

          {/* BMI 卡片 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base text-gray-800">当前BMI</span>
              <span className={`text-base ${bmiStatus.color}`}>{bmiStatus.text}</span>
            </div>

            <div className="flex items-center justify-end mb-2">
              <span className="text-xl text-orange-500">{bmi.toFixed(1)}</span>
            </div>

            {/* BMI 进度条 */}
            <div className="relative mb-2">
              <div className="h-2 rounded-full bg-gradient-to-r from-blue-400 via-green-400 via-orange-400 to-red-400"></div>
              <div
                className="absolute top-0 w-0.5 h-2 bg-gray-800 transition-all duration-300"
                style={{ left: `${bmiPosition}%` }}
              ></div>
            </div>

            {/* BMI 标签 */}
            <div className="flex justify-between text-xs text-gray-500 mb-3">
              <span>过瘦</span>
              <span>标准</span>
              <span>超重</span>
              <span>肥胖</span>
            </div>

            <p className="text-sm text-gray-600">慢慢来也是一种方式，加油！</p>
          </div>
        </div>
      </OnboardingPageLayout>

      <BottomActionBar
        visible={true}
        primaryText="下一步"
        onPrimaryClick={handleNext}
        buttonClassName="w-full py-4 rounded-2xl bg-emerald-400 text-white text-lg font-medium hover:bg-emerald-500 transition-colors shadow-lg"
        containerClassName="bg-transparent px-6 pb-8 pt-4"
      />
    </>
  );
};

export const TargetWeightPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [targetWeight, setTargetWeight] = useState<number>(data.targetWeight || 65);

  const handleNext = () => {
    const roundedWeight = Math.round(targetWeight * 10) / 10;
    updateData({ targetWeight: roundedWeight });
    goToNextStep();
  };

  return (
    <>
      <OnboardingPageLayout currentSection={2} totalSections={3} contentClassName="flex flex-col items-center justify-center px-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mb-8">你的目标体重是？</h1>

        <div className="w-full max-w-sm">
          <WeightRulerSlider
            value={targetWeight}
            onChange={setTargetWeight}
            min={30}
            max={150}
          />
        </div>
      </OnboardingPageLayout>

      <BottomActionBar
        visible={true}
        primaryText="下一步"
        onPrimaryClick={handleNext}
        buttonClassName="w-full py-4 rounded-2xl bg-emerald-400 text-white text-lg font-medium hover:bg-emerald-500 transition-colors shadow-lg"
        containerClassName="bg-transparent px-6 pb-8 pt-4"
      />
    </>
  );
};

export const ActivityLevelPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const { updateProfile } = useUserProfile();
  const [activityLevel, setActivityLevel] = useState<string | null>(data.activityLevel || null);
  const [isSaving, setIsSaving] = useState(false);

  const activityOptions = [
    { id: 'sedentary', label: '久坐不动', description: '几乎不运动，办公室工作' },
    { id: 'light', label: '轻度活动', description: '每周运动1-3天' },
    { id: 'moderate', label: '中度活动', description: '每周运动3-5天' },
    { id: 'active', label: '高度活动', description: '每周运动6-7天' },
    { id: 'very_active', label: '非常活跃', description: '每天高强度运动或体力劳动' },
  ];

  const handleSelect = async (level: string) => {
    setActivityLevel(level);
    updateData({ activityLevel: level as any });
    setIsSaving(true);

    try {
      const updatedData = { ...data, activityLevel: level };

      // CRITICAL: 检查步骤14是否已经保存
      // 在重新评测模式下，只有在步骤14点击"保存生成健康报告"按钮后才应该更新user_profiles
      // 如果step14_profile_saved不存在，说明还没有点击步骤14的保存按钮，不应该更新数据库
      const step14SavedValue = await getUserStorageItem<string>('step14_profile_saved');
      const step14Saved = step14SavedValue === 'true';
      
      if (!step14Saved) {
        console.log('⏸️ [ActivityLevelPage] Step 14 not saved yet - skipping database update');
        console.log('📝 [ActivityLevelPage] Data will be saved only when user clicks "保存生成健康报告" in Step 14');
        console.log('💾 [ActivityLevelPage] Only updating OnboardingContext data, not database');
        // 只更新OnboardingContext的data，不更新数据库
        setTimeout(() => {
          goToNextStep();
          setIsSaving(false);
        }, 300);
        return;
      }

      const bmr = updatedData.gender && updatedData.age && updatedData.currentWeight && updatedData.height
        ? calculateBMR({
            gender: updatedData.gender,
            age: updatedData.age,
            current_weight: updatedData.currentWeight,
            height: updatedData.height
          })
        : null;

      await updateProfile({
        gender: updatedData.gender,
        age: updatedData.age,
        current_weight: updatedData.currentWeight,
        height: updatedData.height,
        target_weight: updatedData.targetWeight,
        unit_preference: 'metric',
        bmr: bmr || undefined,
      });

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('user_profiles')
          .update({
            nickname: updatedData.nickname,
            fitness_goal: updatedData.fitnessGoal,
            current_weight: updatedData.currentWeight,
            target_weight: updatedData.targetWeight,
            activity_level: level,
            // 新增：保存"关于你"部分的专用字段
            dietary_preferences: updatedData.dietaryPreferences || [],
            exercise_habits: updatedData.exerciseHabits || [],
            sleep_hours: updatedData.sleepHours || null,
            water_intake: updatedData.waterIntake || null,
            health_concerns: updatedData.healthConcerns || [],
            onboarding_completed: true,
            has_seen_onboarding: true,
            // onboarding_data JSON 字段已移除，所有数据存储在规范化字段中
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        // IMPORTANT: Initial weight record and health assessment creation
        // have been moved to HealthReportPage to prevent premature record creation
        // when user hasn't completed the entire assessment flow

        // Weight record will be created in HealthReportPage after user confirms
        // Health assessment will only be created when user reaches HealthReportPage
      } else {
        await setUserStorageItem('onboarding_completed', 'true');
      }

      setTimeout(() => {
        goToNextStep();
        setIsSaving(false);
      }, 300);
    } catch (err) {
      console.error('Failed to save onboarding data:', err);
      setIsSaving(false);
    }
  };

  return (
    <OnboardingPageLayout currentSection={2} totalSections={3} contentClassName="overflow-y-auto px-6 pb-8 scrollbar-hide" contentStyle={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <h1 className="text-2xl font-bold text-gray-800 mb-8 text-center">你的活动水平是？</h1>

      <div className="space-y-3">
        {activityOptions.map((option) => (
          <OnboardingSelectButton
            key={option.id}
            id={option.id}
            label={option.label}
            description={option.description}
            isSelected={activityLevel === option.id}
            onClick={() => handleSelect(option.id)}
            disabled={isSaving}
          />
        ))}
      </div>
    </OnboardingPageLayout>
  );
};
