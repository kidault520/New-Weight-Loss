import React, { useState, useEffect, useRef } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { supabase } from '../../config/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import { OnboardingPageLayout } from './OnboardingPageLayout';
import { OnboardingMultiSelectButton } from './OnboardingMultiSelectButton';
import { BottomActionBar } from '../common/BottomActionBar';
import { setUserStorageItem } from '../../utils/userStorage';

export const DietaryPreferencesPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>(data.dietaryPreferences || []);

  const preferences = [
    { id: 'balanced', label: '均衡饮食' },
    { id: 'low_carb', label: '低碳水' },
    { id: 'high_protein', label: '高蛋白' },
    { id: 'vegetarian', label: '素食' },
    { id: 'keto', label: '生酮饮食' },
    { id: 'mediterranean', label: '地中海饮食' },
  ];

  const togglePreference = (id: string) => {
    setSelectedPreferences(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    // CRITICAL: 检查是否有选择，没有选择则不允许继续
    if (selectedPreferences.length === 0) {
      return;
    }
    updateData({ dietaryPreferences: selectedPreferences });
    goToNextStep();
  };

  const hasSelection = selectedPreferences.length > 0;

  return (
    <>
      <OnboardingPageLayout currentSection={3} totalSections={3} contentClassName="overflow-y-auto px-6 pb-24 scrollbar-hide" contentStyle={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">你的饮食偏好是？</h1>
        <p className="text-sm text-gray-600 mb-8 text-center">可多选</p>

        <div className="grid grid-cols-2 gap-3">
          {preferences.map((pref) => (
            <OnboardingMultiSelectButton
              key={pref.id}
              id={pref.id}
              label={pref.label}
              isSelected={selectedPreferences.includes(pref.id)}
              onClick={() => togglePreference(pref.id)}
            />
          ))}
        </div>
      </OnboardingPageLayout>

      <BottomActionBar
        visible={true}
        primaryText="下一步"
        onPrimaryClick={handleNext}
        disabled={!hasSelection}
        buttonClassName={`w-full py-4 rounded-2xl text-white text-lg font-medium transition-colors shadow-lg ${
          hasSelection 
            ? 'bg-emerald-400 hover:bg-emerald-500 cursor-pointer' 
            : 'bg-gray-300 cursor-not-allowed'
        }`}
        containerClassName="bg-transparent px-6 pb-8 pt-4"
      />
    </>
  );
};

export const ExerciseHabitsPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [selectedHabits, setSelectedHabits] = useState<string[]>(data.exerciseHabits || []);

  const habits = [
    { id: 'cardio', label: '有氧运动' },
    { id: 'strength', label: '力量训练' },
    { id: 'yoga', label: '瑜伽/普拉提' },
    { id: 'sports', label: '球类运动' },
    { id: 'walking', label: '步行/跑步' },
    { id: 'swimming', label: '游泳' },
  ];

  const toggleHabit = (id: string) => {
    setSelectedHabits(prev =>
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    // CRITICAL: 检查是否有选择，没有选择则不允许继续
    if (selectedHabits.length === 0) {
      return;
    }
    updateData({ exerciseHabits: selectedHabits });
    goToNextStep();
  };

  const hasSelection = selectedHabits.length > 0;

  return (
    <>
      <OnboardingPageLayout currentSection={3} totalSections={3} contentClassName="overflow-y-auto px-6 pb-24 scrollbar-hide" contentStyle={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">你喜欢的运动类型？</h1>
        <p className="text-sm text-gray-600 mb-8 text-center">可多选</p>

        <div className="grid grid-cols-2 gap-3">
          {habits.map((habit) => (
            <OnboardingMultiSelectButton
              key={habit.id}
              id={habit.id}
              label={habit.label}
              isSelected={selectedHabits.includes(habit.id)}
              onClick={() => toggleHabit(habit.id)}
            />
          ))}
        </div>
      </OnboardingPageLayout>

      <BottomActionBar
        visible={true}
        primaryText="下一步"
        onPrimaryClick={handleNext}
        disabled={!hasSelection}
        buttonClassName={`w-full py-4 rounded-2xl text-white text-lg font-medium transition-colors shadow-lg ${
          hasSelection 
            ? 'bg-emerald-400 hover:bg-emerald-500 cursor-pointer' 
            : 'bg-gray-300 cursor-not-allowed'
        }`}
        containerClassName="bg-transparent px-6 pb-8 pt-4"
      />
    </>
  );
};

export const SleepHabitsPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [sleepHours, setSleepHours] = useState<number>(data.sleepHours || 7);

  const handleNext = () => {
    updateData({ sleepHours });
    goToNextStep();
  };

  return (
    <>
      <OnboardingPageLayout currentSection={3} totalSections={3} contentClassName="flex flex-col items-center justify-center px-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mb-8">你通常睡几个小时？</h1>

        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <div className="text-6xl font-bold text-emerald-400 mb-2">{sleepHours}</div>
            <div className="text-lg text-gray-600">小时</div>
          </div>

          <input
            type="range"
            min="4"
            max="12"
            step="0.5"
            value={sleepHours}
            onChange={(e) => setSleepHours(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />

          <div className="flex justify-between text-sm text-gray-500">
            <span>4h</span>
            <span>12h</span>
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

export const WaterIntakePage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [waterIntake, setWaterIntake] = useState<number>(data.waterIntake || 2000);

  const handleNext = () => {
    updateData({ waterIntake });
    goToNextStep();
  };

  return (
    <>
      <OnboardingPageLayout currentSection={3} totalSections={3} contentClassName="flex flex-col items-center justify-center px-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mb-8">你每天喝多少水？</h1>

        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <div className="text-6xl font-bold text-blue-400 mb-2">{waterIntake}</div>
            <div className="text-lg text-gray-600">毫升</div>
          </div>

          <input
            type="range"
            min="500"
            max="4000"
            step="100"
            value={waterIntake}
            onChange={(e) => setWaterIntake(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-400"
          />

          <div className="flex justify-between text-sm text-gray-500">
            <span>500ml</span>
            <span>4000ml</span>
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

export const HealthConcernsPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>(data.healthConcerns || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const isHandlingNextRef = useRef(false); // 防止重复调用 handleNext

  // 同步 data.healthConcerns 到 selectedConcerns（仅在初始化时）
  useEffect(() => {
    if (data.healthConcerns && data.healthConcerns.length > 0 && selectedConcerns.length === 0) {
      setSelectedConcerns(data.healthConcerns);
    }
  }, [data.healthConcerns, selectedConcerns.length]);

  const concerns = [
    { id: 'blood_sugar', label: '血糖管理' },
    { id: 'blood_pressure', label: '血压管理' },
    { id: 'cholesterol', label: '胆固醇' },
    { id: 'digestive', label: '消化问题' },
    { id: 'energy', label: '精力不足' },
    { id: 'stress', label: '压力管理' },
    { id: 'none', label: '没有特别关注' },
  ];

  const toggleConcern = (id: string) => {
    if (id === 'none') {
      setSelectedConcerns(['none']);
    } else {
      setSelectedConcerns(prev => {
        const filtered = prev.filter(c => c !== 'none');
        return filtered.includes(id) ? filtered.filter(c => c !== id) : [...filtered, id];
      });
    }
  };

  const handleNext = async () => {
    // 防止重复调用（增强保护）
    if (isHandlingNextRef.current || isSaving) {
      console.log('⏸️ [HealthConcernsPage] handleNext 已在进行中，忽略重复调用', {
        isHandlingNext: isHandlingNextRef.current,
        isSaving
      });
      return;
    }

    console.log('🔘 [HealthConcernsPage] handleNext 被点击');
    console.log('📊 [HealthConcernsPage] selectedConcerns:', selectedConcerns);
    console.log('📋 [HealthConcernsPage] 当前 onboarding data:', data);

    // CRITICAL: 立即设置标志，防止重复调用
    isHandlingNextRef.current = true;
    setIsSaving(true);
    setSaveError(''); // 清除之前的错误

    try {
      console.log('💾 [HealthConcernsPage] 开始保存...');

      // CRITICAL: 只在数据真正变化时更新，避免不必要的 context 更新
      // 检查当前 data 中的 healthConcerns 是否与 selectedConcerns 相同
      const currentConcerns = data.healthConcerns || [];
      const concernsChanged = 
        currentConcerns.length !== selectedConcerns.length ||
        !currentConcerns.every((c, i) => c === selectedConcerns[i]);
      
      if (concernsChanged) {
        updateData({ healthConcerns: selectedConcerns });
      }

      // 保存到数据库
      console.log('🔐 [HealthConcernsPage] 检查用户认证状态...');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('👤 [HealthConcernsPage] 用户信息:', user ? `ID: ${user.id}` : '未登录');

      if (!user) {
        const errorMsg = '用户未登录，无法保存数据。请先登录后再继续。';
        console.error('❌ [HealthConcernsPage]', errorMsg);
        setSaveError(errorMsg);
        setIsSaving(false);
        return; // 阻止继续
      }

      // 验证必需字段
      const requiredFields = {
        nickname: data.nickname,
        gender: data.gender,
        age: data.age,
        height: data.height,
        currentWeight: data.currentWeight,
        targetWeight: data.targetWeight,
        activityLevel: data.activityLevel,
        fitnessGoal: data.fitnessGoal
      };

      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      const onboardingFieldLabel: Record<string, string> = {
        nickname: '昵称',
        gender: '性别',
        age: '年龄',
        height: '身高',
        currentWeight: '当前体重',
        targetWeight: '目标体重',
        activityLevel: '活动量',
        fitnessGoal: '健身目标',
      };

      if (missingFields.length > 0) {
        const errorMsg = `缺少必需的引导数据：${missingFields.map((k) => onboardingFieldLabel[k] || k).join('、')}。请返回前面的步骤完成填写。`;
        console.error('❌ [HealthConcernsPage]', errorMsg);
        console.error('❌ [HealthConcernsPage] 当前数据:', requiredFields);
        setSaveError(errorMsg);
        setIsSaving(false);
        return; // 阻止继续
      }

      // 合并所有引导页数据
      const completeData = {
        ...data,
        healthConcerns: selectedConcerns
      };

      console.log('📦 [HealthConcernsPage] 准备保存的完整数据:', completeData);

      // 更新用户档案 - 保存到专用字段和 onboarding_data JSONB
      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const profileData = {
        user_id: user.id,
        nickname: completeData.nickname,
        gender: completeData.gender,
        age: completeData.age,
        height: completeData.height,
        current_weight: completeData.currentWeight ? Math.round(completeData.currentWeight * 10) / 10 : null,
        target_weight: completeData.targetWeight ? Math.round(completeData.targetWeight * 10) / 10 : null,
        activity_level: completeData.activityLevel,
        fitness_goal: completeData.fitnessGoal,
        // 新增：保存到专用数组字段（确保是数组）
        dietary_preferences: Array.isArray(completeData.dietaryPreferences) ? completeData.dietaryPreferences : [],
        exercise_habits: Array.isArray(completeData.exerciseHabits) ? completeData.exerciseHabits : [],
        sleep_hours: completeData.sleepHours ? Number(completeData.sleepHours) : null,
        water_intake: completeData.waterIntake ? Number(completeData.waterIntake) : null,
        health_concerns: Array.isArray(selectedConcerns) ? selectedConcerns : [],
        // onboarding_data JSON 字段已移除，所有数据存储在规范化字段中
        // IMPORTANT: Do NOT set has_seen_onboarding to true yet
        // User still needs to see HealthReportPage (step 16) and NutritionSolutionPage
        // This will be set to true when user clicks "查看营养方案" button in HealthReportPage
        onboarding_completed: false,
        has_seen_onboarding: false,
        updated_at: new Date().toISOString()
      };

      console.log('📦 [HealthConcernsPage] Profile data to save:', JSON.stringify(profileData, null, 2));

      console.log('💾 [HealthConcernsPage] Saving to database...', existingProfile ? 'UPDATE' : 'INSERT');

      let error: PostgrestError | Error | null = null;
      let savedData: unknown;

      try {
        if (existingProfile) {
          // Update existing profile
          console.log('🔄 [HealthConcernsPage] Updating existing profile...');
          const result = await supabase
            .from('user_profiles')
            .update(profileData)
            .eq('user_id', user.id)
            .select()
            .single();

          error = result.error;
          savedData = result.data;
          console.log('📥 [HealthConcernsPage] Update result:', { error, data: savedData });
        } else {
          // Insert new profile
          console.log('➕ [HealthConcernsPage] Inserting new profile...');
          const result = await supabase
            .from('user_profiles')
            .insert(profileData)
            .select()
            .single();

          error = result.error;
          savedData = result.data;
          console.log('📥 [HealthConcernsPage] Insert result:', { error, data: savedData });
        }
      } catch (dbError) {
        console.error('❌ [HealthConcernsPage] Database operation exception:', dbError);
        error = dbError instanceof Error ? dbError : new Error(String(dbError));
      }

      if (error) {
        console.error('❌ [HealthConcernsPage] 保存引导页数据失败:', error);
        console.error('❌ [HealthConcernsPage] 错误详情:', JSON.stringify(error, null, 2));
        console.error('❌ [HealthConcernsPage] Error message:', error.message);
        console.error('❌ [HealthConcernsPage] Error code:', 'code' in error ? error.code : undefined);
        console.error('❌ [HealthConcernsPage] Error details:', 'details' in error ? error.details : undefined);
        console.error('❌ [HealthConcernsPage] Error hint:', 'hint' in error ? error.hint : undefined);

        // 构造用户友好的错误消息
        let userErrorMsg = '保存失败：';
        const errCode = 'code' in error ? error.code : undefined;
        const errMsg = error.message || '';
        if (errCode === 'PGRST301') {
          userErrorMsg += '数据库连接失败，请检查网络连接后重试。';
        } else if (errMsg.includes('permission')) {
          userErrorMsg += '没有数据写入权限，请联系客服。';
        } else if (errMsg.includes('constraint')) {
          userErrorMsg += '数据格式不正确，请检查输入。';
        } else {
          userErrorMsg += errMsg || '未知错误，请重试或联系客服。';
        }

        setSaveError(userErrorMsg);
        throw error;
      }

      console.log('✅ [HealthConcernsPage] 引导页数据已成功保存到数据库（包括专用字段）');

      // CRITICAL: Verify the data was actually saved before proceeding
      console.log('🔍 [HealthConcernsPage] 验证数据是否成功保存...');
      const { data: verifyProfile, error: verifyError } = await supabase
        .from('user_profiles')
        .select('nickname, gender, age, height, current_weight, health_concerns')
        .eq('user_id', user.id)
        .maybeSingle();

      if (verifyError || !verifyProfile) {
        const errorMsg = '保存验证失败：无法确认数据已保存。请重试。';
        console.error('❌ [HealthConcernsPage]', errorMsg, verifyError);
        setSaveError(errorMsg);
        throw new Error(errorMsg);
      }

      // Verify critical fields are present
      if (!verifyProfile.nickname || !verifyProfile.gender || !verifyProfile.age) {
        const errorMsg = '保存不完整：部分数据未成功保存。请重试。';
        console.error('❌ [HealthConcernsPage]', errorMsg);
        console.error('❌ [HealthConcernsPage] Saved data:', verifyProfile);
        setSaveError(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ [HealthConcernsPage] 数据验证通过，所有字段已正确保存');

      // CRITICAL: Set marker to indicate Step 14 save is complete
      // This ensures Step 15 auto-save only triggers after Step 14 is successfully saved
      await setUserStorageItem('step14_profile_saved', 'true');
      console.log('✅ [HealthConcernsPage] Step 14 save marker set in user-isolated storage');

      // CRITICAL: 在跳转前先重置状态，防止状态不一致
      console.log('✅ [HealthConcernsPage] 引导页数据保存完成，准备进入健康报告页');
      
      // 先重置保存状态，然后再跳转
      setIsSaving(false);
      isHandlingNextRef.current = false;
      
      // 使用 setTimeout 确保状态更新完成后再跳转，避免重复渲染
      setTimeout(() => {
        console.log('🚀 [HealthConcernsPage] 调用 goToNextStep()...');
        goToNextStep();
        console.log('✅ [HealthConcernsPage] goToNextStep() 调用完成');
      }, 100);
    } catch (error) {
      console.error('❌ [HealthConcernsPage] 保存数据时出错:', error);
      console.error('❌ [HealthConcernsPage] 错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');

      // CRITICAL FIX: 不再允许保存失败后继续
      // 保存失败意味着数据没有写入数据库，继续会导致后续步骤失败
      if (!saveError) {
        // 如果还没有设置错误消息，设置一个通用的
        const errorMsg = `保存失败：${error instanceof Error ? error.message : '未知错误'}。请重试或联系客服。`;
        setSaveError(errorMsg);
      }

      console.log('⚠️ [HealthConcernsPage] 保存失败，阻止跳转到下一步');
      console.log('📍 [HealthConcernsPage] 用户必须重试或修复问题才能继续');
      // 不调用 goToNextStep() - 停留在当前页面让用户重试
      
      // CRITICAL: 确保在错误情况下也重置状态
      setIsSaving(false);
      isHandlingNextRef.current = false;
    }
  };

  return (
    <>
      <OnboardingPageLayout currentSection={3} totalSections={3} contentClassName="overflow-y-auto px-6 pb-24 scrollbar-hide" contentStyle={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">你关注的健康问题？</h1>
        <p className="text-sm text-gray-600 mb-8 text-center">可多选</p>

        <div className="grid grid-cols-2 gap-3">
          {concerns.map((concern) => (
            <OnboardingMultiSelectButton
              key={concern.id}
              id={concern.id}
              label={concern.label}
              isSelected={selectedConcerns.includes(concern.id)}
              onClick={() => toggleConcern(concern.id)}
            />
          ))}
        </div>
      </OnboardingPageLayout>

      <BottomActionBar
        visible={true}
        primaryText={isSaving ? '保存中...' : (saveError ? '重试保存' : '保存生成健康报告')}
        onPrimaryClick={() => {
          // 增强保护：检查多个条件
          if (selectedConcerns.length === 0 || isSaving || isHandlingNextRef.current) {
            console.log('⏸️ [HealthConcernsPage] 按钮点击被阻止', {
              hasSelection: selectedConcerns.length > 0,
              isSaving,
              isHandlingNext: isHandlingNextRef.current
            });
            return;
          }
          console.log('🖱️ [HealthConcernsPage] 按钮被点击！');
          console.log('🔍 [HealthConcernsPage] 按钮状态 - disabled:', selectedConcerns.length === 0 || isSaving);
          console.log('📋 [HealthConcernsPage] selectedConcerns:', selectedConcerns);
          console.log('💾 [HealthConcernsPage] isSaving:', isSaving);
          handleNext();
        }}
        buttonClassName={`w-full py-4 rounded-2xl text-white text-lg font-medium transition-colors shadow-lg ${
          selectedConcerns.length === 0 || isSaving
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-emerald-400 hover:bg-emerald-500'
        }`}
        containerClassName="bg-transparent px-6 pb-8 pt-4"
        extra={
          <>
            {saveError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-red-700">{saveError}</p>
                  </div>
                </div>
              </div>
            )}
            {isSaving && (
              <div className="mb-4 flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </>
        }
      />
    </>
  );
};
