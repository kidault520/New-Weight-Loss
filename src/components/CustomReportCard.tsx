import React from 'react';
import { useUserProfile } from '../contexts/UserProfileContext';

interface HealthAssessment {
  id: string;
  assessment_date: string;
  overall_score: number;
  diet_score: number;
  fitness_score: number;
  rest_score: number;
  psychology_score: number;
  exercise_score: number;
  primary_improvement_area: string;
}

interface UserProfileData {
  current_weight?: number;
  target_weight?: number;
  nickname?: string;
  fitness_goal?: string;
}

interface CustomReportCardProps {
  onOpenReports: () => void;
  onOpenReassessment: (resetProgress?: boolean) => void;
}

const CustomReportCard: React.FC<CustomReportCardProps> = ({ onOpenReports, onOpenReassessment }) => {
  void onOpenReassessment;
  const { profile, healthAssessment, isLoadingAssessment } = useUserProfile();
  const latestAssessment = (healthAssessment as HealthAssessment | null) ?? null;
  const profileData: UserProfileData | null = profile
    ? {
        current_weight: profile.current_weight,
        target_weight: profile.target_weight,
        nickname: profile.nickname,
        fitness_goal: profile.fitness_goal,
      }
    : null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenReports();
  };

  const currentWeight = profileData?.current_weight || profile?.current_weight;
  const targetWeight = profileData?.target_weight || profile?.target_weight;
  const healthGoal = profileData?.fitness_goal || profile?.fitness_goal;

  const getGoalText = () => {
    const goals: Record<string, string> = {
      'weight_loss': '减轻体重',
      'maintain_health': '保持健康',
      'tone': '保持健康',
      'confidence': '保持自信',
      'muscle_gain': '增肌塑形',
      'other': '其它'
    };
    const goalText = goals[healthGoal || ''] || '未设置';
    return goalText;
  };

  return (
    <div className="w-full bg-white rounded-2xl p-5 text-gray-800 relative overflow-hidden mb-4 shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="text-sm text-gray-600 mb-2">健康综合分数：</div>
          {isLoadingAssessment ? (
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded animate-pulse w-24"></div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-gray-900">
              {latestAssessment?.overall_score !== undefined && latestAssessment?.overall_score !== null ? latestAssessment.overall_score : '--'}
              <span className="text-base text-gray-500">/100分</span>
            </div>
          )}
        </div>

        <div className="text-right">
          {isLoadingAssessment ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20 ml-auto"></div>
              <div className="h-6 bg-gray-200 rounded animate-pulse w-28 ml-auto"></div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-end gap-1 mb-2">
                <span className="text-sm text-gray-600">目标：</span>
                <span className="text-sm text-gray-600">{getGoalText()}</span>
              </div>
              {currentWeight && targetWeight ? (
                <div className="text-xl font-bold text-gray-900">
                  {currentWeight.toFixed(1)}kg→{targetWeight.toFixed(1)}kg
                </div>
              ) : (
                <div className="text-base text-gray-400">未设置</div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {isLoadingAssessment ? (
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-1"></div>
            <div className="h-4 bg-gray-100 rounded animate-pulse w-32"></div>
          </div>
        ) : (
          <div>
            <div className="text-sm text-gray-600 mb-1">评测日期：</div>
            {latestAssessment && (
              <p className="text-sm text-gray-500">
                {formatDate(latestAssessment.assessment_date)}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleViewClick}
          disabled={isLoadingAssessment}
          className="px-5 py-1.5 rounded-full border border-gray-900 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          查看
        </button>
      </div>
    </div>
  );
};

export default CustomReportCard;
