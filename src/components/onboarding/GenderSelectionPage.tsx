import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingPageLayout } from './OnboardingPageLayout';
import { OnboardingSelectButton } from './OnboardingSelectButton';

const GenderSelectionPage: React.FC = () => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(data.gender || null);

  // 异步合并档案后 data.gender 可能晚到，避免界面仍显示未选而上下文已有值
  useEffect(() => {
    if (data.gender) setSelectedGender(data.gender);
  }, [data.gender]);

  const handleGenderSelect = (gender: 'male' | 'female') => {
    setSelectedGender(gender);
    updateData({ gender });

    setTimeout(() => {
      goToNextStep();
    }, 300);
  };

  return (
    <OnboardingPageLayout currentSection={1} totalSections={3} contentClassName="flex flex-col items-center px-6 pb-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">您的性别是</h1>

      <div className="bg-white/70 rounded-2xl p-4 mb-8 flex items-start space-x-3">
        <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700 leading-relaxed">
          生物性别决定身体的机能，如新陈代谢、肌肉量、激素水平，我们在定制方案时候需要它
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <OnboardingSelectButton
          id="male"
          label="男性"
          image="/nanmote.png"
          isSelected={selectedGender === 'male'}
          onClick={() => handleGenderSelect('male')}
        />
        <OnboardingSelectButton
          id="female"
          label="女性"
          image="/nvmote.png"
          isSelected={selectedGender === 'female'}
          onClick={() => handleGenderSelect('female')}
        />
      </div>
    </OnboardingPageLayout>
  );
};

export default GenderSelectionPage;
