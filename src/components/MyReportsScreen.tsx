import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import HealthReportPage from './onboarding/HealthReportPage';
import NutritionSolutionPage from './onboarding/NutritionSolutionPage';
import MyHealthProfileScreen from './MyHealthProfileScreen';
import { DrawerScreen } from './common/DrawerScreen';
import { LoadingState } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';
import { ConfirmModal } from './common/ConfirmModal';
import { AlertDialog } from './common/AlertDialog';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';
import { formatDateTime } from '../utils/dateFormatters';
import { useAllHealthAssessmentsQuery } from '../hooks/useHealthAssessmentQuery';
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
  questionnaire_data?: {
    currentWeight?: number;
    targetWeight?: number;
    fitnessGoal?: string;
    [key: string]: any;
  };
}

interface UserProfileData {
  current_weight?: number;
  target_weight?: number;
  fitness_goal?: string;
}

interface MyReportsScreenProps {
  onClose: () => void;
  onOpenReassessment: (resetProgress?: boolean) => void;
  onOpenHealthProfile: () => void;
  onGoToMealPlan?: () => void;
}

const MyReportsScreen: React.FC<MyReportsScreenProps> = ({ onClose, onOpenReassessment, onOpenHealthProfile, onGoToMealPlan }) => {
  // ✅ user 不再需要，profile数据从UserProfileContext获取
  // ✅ 使用 UserProfileContext 获取用户档案数据，而不是直接查询数据库
  const { profile } = useUserProfile();
  void onOpenHealthProfile;
  void onGoToMealPlan;
  // 使用 React Query hook 管理健康评估列表
  const { assessments: assessmentsData, isLoading: assessmentsLoading, refresh: refreshAssessments } = useAllHealthAssessmentsQuery();
  const assessments = (assessmentsData || []) as HealthAssessment[];
  // ✅ profileData 现在从 UserProfileContext 的 profile 获取，无需本地状态
  const profileData: UserProfileData | null = profile ? {
    current_weight: profile.current_weight,
    target_weight: profile.target_weight,
    fitness_goal: profile.fitness_goal,
  } : null;
  const [showHealthReport, setShowHealthReport] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [showNutritionSolution, setShowNutritionSolution] = useState(false);
  const [showReportArchive, setShowReportArchive] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [swipedAssessmentId, setSwipedAssessmentId] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const touchStartX = useRef<{ [key: string]: number }>({});
  const touchStartY = useRef<{ [key: string]: number }>({});

  useEffect(() => {
    // ✅ profile数据现在由UserProfileContext自动管理，无需手动加载
    
    // 用户状态变化已通过 React Query 和 Context 自动处理，无需监听事件
    
    // Listen for page visibility changes to refresh when user returns
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // React Query 会自动处理缓存刷新
        refreshAssessments();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshAssessments]);

  // ✅ loadProfileData 已被 useUserProfile Hook 替代
  // 从 UserProfileContext 获取数据，无需直接查询数据库


  const isLatestAssessment = (assessmentId: string) => {
    return assessments.length > 0 && assessments[0].id === assessmentId;
  };

  const getGoalText = () => {
    const goal = profileData?.fitness_goal;
    const goals: Record<string, string> = {
      'weight_loss': '减轻体重',
      'maintain_health': '焕肤',
      'tone': '保持健康',
      'confidence': '保持自信',
      'other': '其它'
    };
    return goals[goal || ''] || '未设置';
  };

  const getGoalTextFromGoal = (goal: string) => {
    const goals: Record<string, string> = {
      'weight_loss': '减轻体重',
      'maintain_health': '焕肤',
      'tone': '保持健康',
      'confidence': '保持自信',
      'other': '其它'
    };
    return goals[goal || ''] || '未设置';
  };

  const handleCardClick = (assessmentId: string) => {
    // 如果卡片处于滑动状态,点击后恢复原位
    if (swipedAssessmentId === assessmentId) {
      const cardElement = document.getElementById(`assessment-card-${assessmentId}`);
      if (cardElement) {
        cardElement.style.transform = 'translateX(0)';
        cardElement.style.transition = 'transform 0.3s ease';
      }
      setSwipedAssessmentId(null);
    } else {
      // 在「我的报告」内部打开二级弹窗，底层保持报告列表
      setShowReportArchive(true);
    }
  };

  const handleViewClick = (e: React.MouseEvent, assessmentId: string) => {
    e.stopPropagation();
    setSelectedAssessmentId(assessmentId);
    setShowHealthReport(true);
  };

  const handleTouchStart = (assessmentId: string, e: React.TouchEvent) => {
    // 最新评测记录不允许滑动删除
    if (isLatestAssessment(assessmentId)) return;

    touchStartX.current[assessmentId] = e.touches[0].clientX;
    touchStartY.current[assessmentId] = e.touches[0].clientY;
  };

  const handleTouchMove = (assessmentId: string, e: React.TouchEvent) => {
    if (!touchStartX.current[assessmentId]) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = touchStartX.current[assessmentId] - currentX;
    const diffY = Math.abs(touchStartY.current[assessmentId] - currentY);

    if (Math.abs(diffX) > diffY) {
      e.preventDefault();
      const cardElement = document.getElementById(`assessment-card-${assessmentId}`);
      if (cardElement) {
        if (diffX > 0) {
          const newOffset = Math.min(80, Math.max(0, diffX));
          cardElement.style.transform = `translateX(-${newOffset}px)`;
        } else {
          const currentTransform = cardElement.style.transform;
          const match = currentTransform.match(/translateX\((-?\d+)px\)/);
          const currentOffset = match ? Math.abs(parseInt(match[1])) : 0;
          if (currentOffset > 0) {
            const newOffset = Math.max(0, currentOffset + diffX);
            cardElement.style.transform = `translateX(-${newOffset}px)`;
          }
        }
        cardElement.style.transition = 'none';
      }
    }
  };

  const handleTouchEnd = (assessmentId: string) => {
    if (!touchStartX.current[assessmentId]) return;

    const cardElement = document.getElementById(`assessment-card-${assessmentId}`);
    if (cardElement) {
      const transform = cardElement.style.transform;
      const match = transform.match(/translateX\((-?\d+)px\)/);
      const offset = match ? parseInt(match[1]) : 0;

      if (offset < -40) {
        cardElement.style.transform = 'translateX(-80px)';
        cardElement.style.transition = 'transform 0.3s ease';
        setSwipedAssessmentId(assessmentId);
      } else {
        cardElement.style.transform = 'translateX(0)';
        cardElement.style.transition = 'transform 0.3s ease';
        if (swipedAssessmentId === assessmentId) {
          setSwipedAssessmentId(null);
        }
      }
    }

    delete touchStartX.current[assessmentId];
    delete touchStartY.current[assessmentId];
  };

  const handleDeleteClick = (assessmentId: string) => {
    if (isLatestAssessment(assessmentId)) {
      setAlertMessage('当前评测报告正在使用中，无法删除');
      setShowAlert(true);
      const cardElement = document.getElementById(`assessment-card-${assessmentId}`);
      if (cardElement) {
        cardElement.style.transform = 'translateX(0)';
        cardElement.style.transition = 'transform 0.3s ease';
      }
      setSwipedAssessmentId(null);
      return;
    }
    setDeleteConfirmId(assessmentId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from('health_assessments')
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;

      // 恢复卡片到原位后再删除
      if (swipedAssessmentId) {
        const cardElement = document.getElementById(`assessment-card-${swipedAssessmentId}`);
        if (cardElement) {
          cardElement.style.transform = 'translateX(0)';
          cardElement.style.transition = 'transform 0.3s ease';
        }
      }

      setSwipedAssessmentId(null);
      setDeleteConfirmId(null);
      
      // 🔥 修复：刷新 React Query 缓存，确保删除后数据同步
      refreshAssessments();
    } catch (error) {
      console.error('Failed to delete assessment:', error);
      if (swipedAssessmentId) {
        const cardElement = document.getElementById(`assessment-card-${swipedAssessmentId}`);
        if (cardElement) {
          cardElement.style.transform = 'translateX(0)';
          cardElement.style.transition = 'transform 0.3s ease';
        }
        setSwipedAssessmentId(null);
      }
      setDeleteConfirmId(null);
    }
  };

  const handleCancelDelete = () => {
    if (swipedAssessmentId) {
      const cardElement = document.getElementById(`assessment-card-${swipedAssessmentId}`);
      if (cardElement) {
        cardElement.style.transform = 'translateX(0)';
        cardElement.style.transition = 'transform 0.3s ease';
      }
      setSwipedAssessmentId(null);
    }
    setDeleteConfirmId(null);
  };

  /**
   * 报告/营养方案必须叠在 DrawerScreen **内部**，保持与列表相同的 fixed z-[80] 白底宿主；
   * 若 early return 卸掉 Drawer，在部分 WebView 堆叠下会露出底下 AppRouter（多为「我的」），误像「跳回个人中心」。
   */
  const stackOverlayClass = 'absolute inset-0 z-[35] flex flex-col bg-white min-h-0';

  return (
    <DrawerScreen show={true} onClose={onClose} showDragHandle={false} showMask={false}>
      <div className="flex flex-col h-full min-h-0 bg-gray-50 relative">
        {showNutritionSolution ? (
          <div className={stackOverlayClass}>
            <OnboardingProvider>
              <NutritionSolutionPage
                onComplete={() => {
                  setShowNutritionSolution(false);
                }}
                readOnly={true}
              />
            </OnboardingProvider>
          </div>
        ) : showHealthReport && selectedAssessmentId ? (
          <div className={stackOverlayClass}>
            <HealthReportPage
              onComplete={() => {
                setShowHealthReport(false);
                setSelectedAssessmentId(null);
              }}
              onOpenNutritionSolution={() => {
                setShowHealthReport(false);
                setShowNutritionSolution(true);
              }}
              assessmentId={selectedAssessmentId}
            />
          </div>
        ) : (
          <>
        <SecondaryPageHeader title="我的报告" onClose={onClose} />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {assessmentsLoading ? (
          <LoadingState />
        ) : (
        <>
        <div className="bg-white rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">💡</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-600 leading-relaxed">
                  由于个人的身体状况、生活习惯可能会发生变化，建议每3个月重新进行一次评估。重新评测将生成一条新的健康报告，历史报告将被保留
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenReassessment(true)}
              className="ml-3 px-4 py-2 bg-yellow-400 text-gray-900 text-xs font-semibold rounded-full hover:bg-yellow-500 transition-colors whitespace-nowrap"
            >
              重新评测
            </button>
          </div>
        </div>

        {assessments.length === 0 ? (
          <EmptyState 
            icon={<span className="text-4xl">📊</span>}
            title="暂无健康评估报告"
          />
        ) : (
          <div className="space-y-3 pb-24">
            {assessments.map((assessment) => {
              // CRITICAL: 从assessment的questionnaire_data中获取体重数据，而不是从user_profiles获取
              // 这样每个报告显示的是创建时的快照数据，不会受到后续user_profiles更新的影响
              const currentWeight = assessment.questionnaire_data?.currentWeight || profileData?.current_weight;
              const targetWeight = assessment.questionnaire_data?.targetWeight || profileData?.target_weight;
              const assessmentFitnessGoal = assessment.questionnaire_data?.fitnessGoal || profileData?.fitness_goal;

              return (
                <div key={assessment.id} className="relative overflow-hidden rounded-2xl">
                  {/* Delete background (不显示给最新记录) */}
                  {!isLatestAssessment(assessment.id) && (
                    <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6">
                      <span className="text-white font-medium">删除</span>
                    </div>
                  )}

                  {/* Assessment card */}
                  <div
                    id={`assessment-card-${assessment.id}`}
                    onClick={() => handleCardClick(assessment.id)}
                    onTouchStart={(e) => handleTouchStart(assessment.id, e)}
                    onTouchMove={(e) => handleTouchMove(assessment.id, e)}
                    onTouchEnd={() => handleTouchEnd(assessment.id)}
                    className="w-full bg-white rounded-2xl p-5 text-gray-800 relative shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                    style={{ transition: 'transform 0.3s ease' }}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-sm text-gray-600 whitespace-nowrap">健康综合分数：</span>
                          {isLatestAssessment(assessment.id) && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-0.5 rounded-full whitespace-nowrap">
                              使用中
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {assessment.overall_score}
                          <span className="text-base text-gray-500">/100分</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1 mb-2">
                          <span className="text-sm text-gray-600">目标：</span>
                          <span className="text-sm text-gray-600">{assessmentFitnessGoal ? getGoalTextFromGoal(assessmentFitnessGoal) : getGoalText()}</span>
                        </div>
                        {currentWeight && targetWeight ? (
                          <div className="text-xl font-bold text-gray-900 whitespace-nowrap">
                            {currentWeight.toFixed(1)}kg→{targetWeight.toFixed(1)}kg
                          </div>
                        ) : (
                          <div className="text-base text-gray-400">未设置</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">评测日期：</div>
                        <p className="text-sm text-gray-500">
                          {formatDateTime(assessment.assessment_date)}
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleViewClick(e, assessment.id)}
                        className="px-5 py-1.5 rounded-full border border-gray-900 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-medium transition-colors"
                      >
                        查看
                      </button>
                    </div>
                  </div>

                  {/* Delete button when swiped */}
                  {swipedAssessmentId === assessment.id && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(assessment.id);
                      }}
                      className="absolute top-0 right-0 bottom-0 bg-red-500 flex items-center justify-center cursor-pointer rounded-r-2xl"
                      style={{ width: '80px', zIndex: 5 }}
                    >
                      <span className="text-white font-medium text-sm">删除</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          show={!!deleteConfirmId}
          title="确认删除"
          message="确定要删除这份健康评测报告吗？删除后将无法恢复。"
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          confirmText="确认删除"
          zIndex={100}
        />

        {/* Alert Dialog */}
        <AlertDialog
          show={showAlert}
          type="warning"
          title="提示"
          message={alertMessage}
          onClose={() => setShowAlert(false)}
          confirmText="确定"
        />
        {showReportArchive && (
          <MyHealthProfileScreen
            title="报告档案"
            onClose={() => setShowReportArchive(false)}
          />
        )}
          </>
        )}
      </div>
    </DrawerScreen>
  );
};

export default MyReportsScreen;
