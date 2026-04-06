import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { kgToLbs, cmToFeetInches, calculateBMI, getBMICategory } from '../utils/bmrCalculations';
import {
  formatHealthGoal,
  formatActivityLevel,
  formatDietaryPreferences,
  formatExerciseHabits,
  formatHealthConcerns,
  formatSleepHours,
  formatWaterIntake
} from '../utils/profileFormatters';
import { DragPanel } from './common/DragPanel';
import { DetailHeader } from './common/DetailHeader';

interface MyHealthProfileScreenProps {
  onClose: () => void;
  title?: string;
}

interface ProfileField {
  label: string;
  value: string;
  id: string;
  hasInfo?: boolean;
}

interface ProfileSection {
  title: string;
  fields: ProfileField[];
}

/** 与体重详情等子页一致：统一 DragPanel + DetailHeader，避免与其它入口叠双层弹窗 */
const MyHealthProfileScreen: React.FC<MyHealthProfileScreenProps> = ({ onClose, title = '我的档案' }) => {
  const primarySectionTitle = title === '报告档案' ? '报告档案' : '健康档案';
  const { profile } = useUserProfile();
  const [showBMRInfo, setShowBMRInfo] = useState(false);

  const formatWeight = (weight?: number) => {
    if (!weight) return '未设置';
    return profile?.unit_preference === 'imperial'
      ? `${kgToLbs(weight).toFixed(1)} lbs`
      : `${weight.toFixed(1)} kg`;
  };

  const formatWeightRange = () => {
    const currentWeight = profile?.current_weight;
    const targetWeight = profile?.target_weight;

    if (!currentWeight || !targetWeight) return '未设置';

    if (profile?.unit_preference === 'imperial') {
      return `${kgToLbs(currentWeight).toFixed(1)}lbs→${kgToLbs(targetWeight).toFixed(1)}lbs`;
    }
    return `${currentWeight.toFixed(1)}kg→${targetWeight.toFixed(1)}kg`;
  };

  const formatHeight = (height?: number) => {
    if (!height) return '未设置';
    if (profile?.unit_preference === 'imperial') {
      const { feet, inches } = cmToFeetInches(height);
      return `${feet}'${inches}"`;
    }
    return `${Math.round(height)} cm`;
  };

  const getBMI = (): string => {
    if (profile?.current_weight && profile?.height) {
      const bmi = calculateBMI(profile.current_weight, profile.height);
      const category = getBMICategory(bmi);
      return `${bmi} (${category})`;
    }
    return '未设置';
  };

  const getBMR = (): string => {
    if (profile?.bmr) {
      return `${Math.round(profile.bmr)} kcal/天`;
    }
    return '未设置';
  };

  const formatCreatedAt = (date?: Date | string) => {
    if (!date) return '未设置';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const healthProfileFields: ProfileField[] = [
    {
      label: '健康目标',
      value: formatHealthGoal(profile?.fitness_goal),
      id: 'fitness_goal'
    },
    {
      label: '体重目标',
      value: formatWeightRange(),
      id: 'weight_range'
    },
    {
      label: '活动水平',
      value: formatActivityLevel(profile?.activity_level),
      id: 'activity_level'
    },
    {
      label: '创建时间',
      value: formatCreatedAt(profile?.profile_created_at),
      id: 'profile_created_at'
    }
  ];

  const lifestyleFields: ProfileField[] = [
    {
      label: '饮食偏好',
      value: formatDietaryPreferences(profile?.dietary_preferences),
      id: 'dietary_preferences'
    },
    {
      label: '运动习惯',
      value: formatExerciseHabits(profile?.exercise_habits),
      id: 'exercise_habits'
    },
    {
      label: '睡眠时长',
      value: formatSleepHours(profile?.sleep_hours),
      id: 'sleep_hours'
    },
    {
      label: '饮水量',
      value: formatWaterIntake(profile?.water_intake),
      id: 'water_intake'
    },
    {
      label: '步数目标',
      value:
        profile?.daily_steps_goal != null &&
        Number.isFinite(profile.daily_steps_goal) &&
        profile.daily_steps_goal >= 1000
          ? `${Math.round(profile.daily_steps_goal)} 步/天`
          : '默认 8000 步/天',
      id: 'daily_steps_goal'
    },
    {
      label: '健康关注点',
      value: formatHealthConcerns(profile?.health_concerns),
      id: 'health_concerns'
    }
  ];

  const otherInfoFields: ProfileField[] = [
    {
      label: '基础代谢率 (BMR)',
      value: getBMR(),
      id: 'bmr',
      hasInfo: true
    },
    {
      label: 'BMI 指数',
      value: getBMI(),
      id: 'bmi'
    },
    {
      label: '身高',
      value: formatHeight(profile?.height),
      id: 'height'
    },
    {
      label: '当前体重',
      value: formatWeight(profile?.current_weight),
      id: 'current_weight'
    },
    {
      label: '食物过敏',
      value: profile?.food_allergies || '无',
      id: 'food_allergies'
    },
    {
      label: '特殊情况',
      value: profile?.special_conditions || '无',
      id: 'special_conditions'
    }
  ];

  const sections: ProfileSection[] = [
    {
      title: primarySectionTitle,
      fields: healthProfileFields
    },
    {
      title: '生活习惯',
      fields: lifestyleFields
    },
    {
      title: '其它信息',
      fields: otherInfoFields
    }
  ];

  return (
    <DragPanel
      show={true}
      onClose={onClose}
      zIndex={60}
      mask={{ visible: false }}
      header={
        <DetailHeader
          title={title}
          leftAction={{ label: '返回', onClick: onClose }}
        />
      }
    >
      <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide bg-gray-50 min-h-0">
        <div className="px-4 space-y-3 pt-2">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <div className="px-2 py-1.5 mb-1.5">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {section.title}
                </h2>
              </div>

              <div className="bg-white rounded-2xl overflow-hidden">
                {section.fields.map((field, fieldIndex) => (
                  <React.Fragment key={field.id}>
                    <div
                      className={`w-full flex items-center justify-between px-4 py-3 ${
                        !field.hasInfo || !showBMRInfo ? (fieldIndex !== section.fields.length - 1 ? 'border-b border-gray-100' : '') : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-800">{field.label}</span>
                        {field.hasInfo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowBMRInfo(!showBMRInfo);
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <Info className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">{field.value}</span>
                    </div>

                    {field.hasInfo && (
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          showBMRInfo ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-4 pb-3 pt-1.5 bg-gray-50 border-b border-gray-100">
                          <div className="space-y-2.5">
                            <p className="text-xs text-gray-600 leading-relaxed">
                              基础代谢率是指在静息状态下,身体维持基本生理功能(如呼吸、心跳、体温调节等)所需要的最低热量消耗。您的实际每日消耗会根据步数和运动数据动态计算。
                            </p>

                            <div className="bg-blue-50 rounded-xl p-2.5 space-y-2">
                              <p className="text-xs text-blue-900 font-medium">
                                本应用使用 Mifflin-St Jeor 方程计算 BMR
                              </p>

                              <div className="space-y-1.5">
                                <div>
                                  <p className="text-xs text-blue-800 font-medium mb-1">男性公式:</p>
                                  <div className="bg-white rounded-lg p-2">
                                    <p className="text-xs text-gray-700 font-mono leading-relaxed">
                                      BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄 + 5
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs text-blue-800 font-medium mb-1">女性公式:</p>
                                  <div className="bg-white rounded-lg p-2">
                                    <p className="text-xs text-gray-700 font-mono leading-relaxed">
                                      BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄 - 161
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DragPanel>
  );
};

export default MyHealthProfileScreen;
