import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import CustomReportCard from './CustomReportCard';
import ExclusivePlanCard from './ExclusivePlanCard';
import { useUserProfile } from '../contexts/UserProfileContext';
import { useExecutionProgram } from '../hooks/useExecutionProgram';
import { ConfirmModal } from './common/ConfirmModal';
import { AlertDialog } from './common/AlertDialog';
import { StatusBadge } from './common/StatusBadge';

interface MealPlanProps {
  selectedDate: Date; // 暂时未使用，保留用于未来功能
  onOpenReports: () => void;
  onOpenReassessment: (resetProgress?: boolean) => void;
  onOpenCustomReports: () => void; // 暂时未使用，保留用于未来功能
  onOpenRecipeIntro: () => void;
  onOpenDeliveryPlan: () => void;
  onOpenExclusivePlanHub: () => void;
}

const MealPlan: React.FC<MealPlanProps> = ({
  selectedDate: _selectedDate, // 预留参数，暂时未使用
  onOpenReports,
  onOpenReassessment,
  onOpenCustomReports: _onOpenCustomReports, // 预留参数，暂时未使用
  onOpenRecipeIntro: _onOpenRecipeIntro, // 预留参数，暂时未使用
  onOpenDeliveryPlan,
  onOpenExclusivePlanHub,
}) => {
  const { mealPlanConfig, mealPlanConfigured, resetMealPlanConfig, userPackage, intakePlanActive } =
    useUserProfile();
  const { hasOrder, program } = useExecutionProgram();
  const effectiveHasOrder = useMemo(
    () =>
      Boolean(
        hasOrder ||
        program ||
        (mealPlanConfigured && mealPlanConfig?.selectedDates && mealPlanConfig.selectedDates.length > 0) ||
        (userPackage != null && 'id' in userPackage)
      ),
    [hasOrder, program, mealPlanConfigured, mealPlanConfig?.selectedDates, userPackage]
  );
  const [deliveryPlanStatus, setDeliveryPlanStatus] = useState<'active' | 'pending' | 'expired'>('pending');
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [alertState, setAlertState] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });

  useEffect(() => {
    // 与 intakePlanActive 一致：未形成有效起止日期（配送计划未真正开启）→ 待开启
    if (!effectiveHasOrder || !intakePlanActive) {
      setDeliveryPlanStatus('pending');
      return;
    }

    if (!mealPlanConfig?.endDate) {
      setDeliveryPlanStatus('pending');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(mealPlanConfig.endDate);
    endDate.setHours(0, 0, 0, 0);
    setDeliveryPlanStatus(today <= endDate ? 'active' : 'expired');
  }, [effectiveHasOrder, intakePlanActive, mealPlanConfig]);

  const handleResetClick = () => {
    setShowResetConfirmation(true);
  };

  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      await resetMealPlanConfig();

      // Show success message
      setTimeout(() => {
        setShowResetConfirmation(false);
        setIsResetting(false);
        setAlertState({
          show: true,
          type: 'success',
          title: '重置成功',
          message: '配置已重置成功！\n\n请再次点击"我的配送计划"重新设置'
        });
      }, 300);
    } catch (error) {
      console.error('Failed to reset meal plan configuration:', error);
      setIsResetting(false);
      setAlertState({
        show: true,
        type: 'error',
        title: '重置失败',
        message: '重置配置失败，请重试'
      });
    }
  };

  const handleCancelReset = () => {
    setShowResetConfirmation(false);
  };

  return (
    <div className="bg-white flex flex-col relative">
      {/* Header - 已由App.tsx统一导航栏处理 */}
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-4 bg-white">
        {/* My Custom Sections */}
        <div className="px-2 py-3">
          {/* 客户报告卡片 - 所有用户均展示 */}
          <CustomReportCard
            onOpenReports={onOpenReports}
            onOpenReassessment={onOpenReassessment}
          />

          {/* My Delivery Plan Card */}
          <button
            type="button"
            className="w-full min-h-[5.75rem] bg-white rounded-2xl p-3 text-gray-800 relative overflow-hidden mb-4 text-left shadow-sm border border-gray-300"
            onClick={onOpenDeliveryPlan}
          >
            {/* 状态标签和重置按钮 */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <StatusBadge status={deliveryPlanStatus} />
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetClick();
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                title="重新配置"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleResetClick();
                  }
                }}
              >
                <RotateCcw className="w-4 h-4 text-gray-600" />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl text-purple-600">🚚</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">我的配送计划</h3>
                <p className="text-sm text-gray-600 mb-2">查看和管理您的配送安排</p>
                <div className="text-xs text-gray-500">每日新鲜配送</div>
              </div>
            </div>
          </button>

          <ExclusivePlanCard onOpen={onOpenExclusivePlanHub} />
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        show={showResetConfirmation}
        title="重新配置配送计划"
        message={
          <div>
            <p className="text-sm text-gray-600 mb-4">
              确定要重新配置配送计划吗？这将清除当前的所有配送设置，包括：
            </p>
            <ul className="text-sm text-gray-600 mb-4 space-y-2 list-disc list-inside">
              <li>已选择的配送日期</li>
              <li>已选择的餐食类型</li>
              <li>已锁定的配送计划</li>
              <li>配送地址配置</li>
            </ul>
            <p className="text-sm text-amber-600">
              重置后，您将重新开始配置流程（选择日期 → 填写地址 → 配送计划）
            </p>
          </div>
        }
        onCancel={handleCancelReset}
        onConfirm={handleConfirmReset}
        cancelText="取消"
        confirmText={isResetting ? '重置中...' : '确定重置'}
        confirmColor="red"
        zIndex={70}
      />

      {/* Alert Dialog */}
      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState(prev => ({ ...prev, show: false }))}
        zIndex={70}
      />
    </div>
  );
};

export default MealPlan;