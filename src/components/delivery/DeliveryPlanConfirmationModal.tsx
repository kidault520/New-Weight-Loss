/**
 * 配送计划确认弹窗 - 在 App 层级渲染，与 DeliveryPlanPage 完全分离
 * 避免与 DeliveryPlanPage 同时卸载导致 removeChild 错误
 */

import { useState, useEffect } from 'react';

const formatDateDisplay = (date: Date) => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}月${d}日`;
};

export interface DeliveryPlanConfirmationData {
  mealAddresses: Record<string, string>;
  startDate: Date;
  endDate: Date;
  excludedDates: Date[];
  lockedDaysCount: number;
  unlockedDaysCount: number;
}

interface DeliveryPlanConfirmationModalProps {
  show: boolean;
  data: DeliveryPlanConfirmationData | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeliveryPlanConfirmationModal({
  show,
  data,
  onConfirm,
  onClose,
}: DeliveryPlanConfirmationModalProps) {
  void onClose;
  const [countdown, setCountdown] = useState(3);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (show && data) {
      setCountdown(3);
      setIsButtonEnabled(false);
      setIsSubmitting(false);
    }
  }, [show, data]);

  useEffect(() => {
    if (show && data && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (show && data && countdown === 0) {
      setIsButtonEnabled(true);
    }
  }, [show, data, countdown]);

  const handleConfirm = () => {
    if (!isButtonEnabled || isSubmitting) return;
    setIsSubmitting(true);
    onConfirm();
  };

  if (!show || !data) return null;

  const { startDate, endDate, excludedDates, lockedDaysCount, unlockedDaysCount } = data;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-6" translate="no">
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-[340px] w-full overflow-hidden transition-all ${
          isSubmitting ? 'scale-95 opacity-80' : 'scale-100 opacity-100'
        }`}
      >
        <div className="px-5 py-5">
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-3">配送计划已生成</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-900 mb-2">
              <span className="font-bold">配送周期：</span>
              {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
            </p>
            {excludedDates.length > 0 && (
              <p className="text-sm text-gray-900 mb-2">
                <span className="font-bold">排除日期：</span>
                {excludedDates.map((d) => formatDateDisplay(d)).join('、')}
              </p>
            )}
            <p className="text-sm text-gray-900 mb-2">
              <span className="font-bold">已锁定：</span>
              {lockedDaysCount}天
            </p>
            <p className="text-sm text-gray-900">
              <span className="font-bold">待锁定：</span>
              {unlockedDaysCount}天
            </p>
          </div>

          <p className="text-xs text-gray-600 mb-3 leading-relaxed">
            确认后将保存配送计划并同步排期；系统将尝试把订单置为服务中（若未自动成功，可稍后在「我的订单」处理）。生成完成后将以底部提示条反馈结果。
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex items-start">
              <span className="text-gray-700 mr-2">•</span>
              <p className="text-sm text-gray-700 flex-1">健康餐将按照配送计划每日新鲜配送</p>
            </div>
            <div className="flex items-start">
              <span className="text-gray-700 mr-2">•</span>
              <p className="text-sm text-gray-700 flex-1">午餐 11:30-12:30 晚餐 17:30-18:30</p>
            </div>
            <div className="flex items-start">
              <span className="text-gray-700 mr-2">•</span>
              <p className="text-sm text-gray-700 flex-1">在当天配送前1小时，将自动锁定</p>
            </div>
            <div className="flex items-start">
              <span className="text-gray-700 mr-2">•</span>
              <p className="text-sm text-gray-700 flex-1">如需修改配送地址，请在配送前1小时完成</p>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!isButtonEnabled || isSubmitting}
            className={`w-full py-3 text-base font-medium rounded-xl transition-all duration-300 shadow-md ${
              isButtonEnabled && !isSubmitting
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-600 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2 animate-pulse">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                正在生成餐食方案...
              </span>
            ) : (
              <>我已知晓 {countdown > 0 && `(${countdown}s)`}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
