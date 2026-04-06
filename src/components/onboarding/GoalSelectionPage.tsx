import React, { useState } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { supabase } from '../../config/supabase';
import { OnboardingPageLayout } from './OnboardingPageLayout';
import { OnboardingSelectButton } from './OnboardingSelectButton';
import { useAlert } from '../../hooks/useAlert';

interface GoalOption {
  id: 'weight_loss' | 'maintain_health' | 'tone' | 'confidence' | 'other';
  label: string;
}

const goalOptions: GoalOption[] = [
  { id: 'weight_loss', label: '减轻体重' },
  { id: 'maintain_health', label: '焕肤' },
  { id: 'tone', label: '保持健康' },
  { id: 'confidence', label: '保持自信' },
  { id: 'other', label: '其它' },
];

const GoalSelectionPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const { showError } = useAlert();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(data.fitnessGoal || null);
  const [isSaving, setIsSaving] = useState(false);

  const handleGoalSelect = async (goalId: 'weight_loss' | 'maintain_health' | 'tone' | 'confidence' | 'other') => {
    setSelectedGoal(goalId);
    updateData({ fitnessGoal: goalId });
    setIsSaving(true);

    // Navigate first to avoid blocking on network operations
    setTimeout(() => {
      goToNextStep();
    }, 200);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            fitness_goal: goalId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        
        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error('❌ [GoalSelectionPage] Error saving fitness_goal:', error);
      const errorMessage = error instanceof Error ? error.message : '保存目标失败，请重试';
      showError('保存失败', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingPageLayout currentSection={1} totalSections={3} contentClassName="flex flex-col px-6 pb-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-8 text-center">你的主要目标是什么？</h1>

      <div className="space-y-4 flex-1 flex flex-col justify-center">
        {goalOptions.map((option) => (
          <OnboardingSelectButton
            key={option.id}
            id={option.id}
            label={option.label}
            isSelected={selectedGoal === option.id}
            onClick={() => handleGoalSelect(option.id)}
            disabled={isSaving}
          />
        ))}
      </div>
    </OnboardingPageLayout>
  );
};

export default GoalSelectionPage;
