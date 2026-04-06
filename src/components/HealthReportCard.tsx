import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import type { HealthAssessmentData } from '../services/healthAssessmentService';

interface UserProfileData {
  fitness_goal?: string;
  current_weight?: number;
  target_weight?: number;
}

interface HealthReportCardProps {
  onOpenReports: () => void;
  onOpenReassessment: (resetProgress?: boolean) => void;
}

const HealthReportCard: React.FC<HealthReportCardProps> = ({ onOpenReports, onOpenReassessment }) => {
  const { profile, healthAssessment: contextHealthAssessment, isLoadingAssessment } = useUserProfile();
  const [latestAssessment, setLatestAssessment] = useState<HealthAssessmentData | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Use context health assessment as primary source
  const displayAssessment = latestAssessment || contextHealthAssessment;

  // 统一数据流向：完全使用 UserProfileContext，不再直接查询 Supabase
  // UserProfileContext 已经从 Supabase 加载数据，确保数据一致性
  useEffect(() => {
    // 使用 Context 中的 healthAssessment（来自 React Query）
    if (contextHealthAssessment) {
      setLatestAssessment(contextHealthAssessment);
    }
    
    // 使用 Context 中的 profile（来自 Supabase）
    if (profile) {
      setProfileData({
        fitness_goal: profile.fitness_goal,
        current_weight: profile.current_weight,
        target_weight: profile.target_weight,
      });
    }
    
    setLoading(false);
  }, [contextHealthAssessment, profile]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const getPillImages = () => {
    return [
      { src: '/buji copy.png', alt: '补剂' },
      { src: '/dangan copy.png', alt: '档案' },
      { src: '/liaoyu copy.png', alt: '疗愈' },
      { src: '/yinshi copy.png', alt: '饮食' },
    ];
  };

  if (loading && isLoadingAssessment) {
    console.log('⏳ [HealthReportCard] Still loading data...');
    return null;
  }

  const getGoalText = () => {
    const goal = profileData?.fitness_goal;
    const goals: Record<string, string> = {
      'weight_loss': '减轻体重',
      'maintain_health': '焕肤',
      'tone': '保持健康',
      'confidence': '保持自信',
      'other': '其它'
    };
    console.log('🎯 [HealthReportCard] getGoalText - fitness_goal:', profileData?.fitness_goal, '-> selected:', goal, '-> text:', goals[goal || ''] || '未设置');
    return goals[goal || ''] || '未设置';
  };

  if (!displayAssessment) {
    console.log('🔴 [HealthReportCard] No assessment data found, showing evaluation prompt');
    return (
      <div className="bg-white rounded-3xl p-5 mb-4 shadow-sm">
        <div className="flex items-start space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">健康评估报告</h3>
            <p className="text-xs text-gray-500">了解你的健康状况</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          完成健康评估问卷，获取专属的营养方案和补剂推荐
        </p>

        <button
          onClick={() => onOpenReassessment(true)}
          className="w-full py-3.5 bg-yellow-400 text-gray-900 rounded-2xl font-semibold hover:bg-yellow-500 transition-colors flex items-center justify-center space-x-2"
        >
          <span>开始评估</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  console.log('✅ [HealthReportCard] Rendering card with assessment:', displayAssessment);
  console.log('📊 [HealthReportCard] Overall score:', displayAssessment.overall_score);
  console.log('🎯 [HealthReportCard] Profile data:', profileData);
  console.log('👤 [HealthReportCard] Fitness goal:', profileData?.fitness_goal);

  return (
    <div className="bg-white rounded-3xl p-6 mb-4 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-2">健康综合分数：</p>
          <div className="flex items-baseline mb-4">
            <span className="text-5xl font-bold text-gray-900">{displayAssessment.overall_score ?? '--'}</span>
            <span className="text-lg text-gray-400 ml-1">/100分</span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">目标：</span>
              <span className="font-medium text-gray-900">{getGoalText()}</span>
            </div>
            {profileData?.current_weight && profileData?.target_weight && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">体重：</span>
                <span className="font-medium text-gray-900">
                  {profileData.current_weight}kg → {profileData.target_weight}kg
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          {getPillImages().map((pill, idx) => (
            <div
              key={idx}
              className="w-14 h-20 bg-gradient-to-br from-gray-50 to-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100"
            >
              <img
                src={pill.src}
                alt={pill.alt}
                className="w-10 h-14 object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5 mt-5">
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          评测日期：
        </h3>
        <p className="text-sm text-gray-400">{formatDate(displayAssessment.assessment_date)}</p>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={() => onOpenReassessment(true)}
          className="flex-1 py-3 rounded-full bg-white border-2 border-black text-black text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          重新评测
        </button>
        <button
          onClick={onOpenReports}
          className="flex-1 py-3 rounded-full bg-yellow-400 border-2 border-gray-300 text-gray-900 text-sm font-semibold hover:bg-yellow-500 transition-colors"
        >
          查看
        </button>
      </div>
    </div>
  );
};

export default HealthReportCard;
