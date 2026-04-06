import React from 'react';
import { Check } from 'lucide-react';

interface MealPlanConfirmationModalProps {
  selectedDates: Date[];
  excludedDates: Date[];
  selectedMealTypes: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const MealPlanConfirmationModal: React.FC<MealPlanConfirmationModalProps> = ({
  selectedDates,
  excludedDates,
  selectedMealTypes,
  onConfirm,
  onCancel
}) => {
  const getMealTypeLabel = (mealType: string) => {
    const labels: Record<string, string> = {
      breakfast: '早餐',
      lunch: '午餐',
      dinner: '晚餐'
    };
    return labels[mealType] || mealType;
  };

  const actualDeliveryDays = selectedDates.length - excludedDates.length;
  const startDate = selectedDates.length > 0 ? selectedDates[0] : null;
  const endDate = selectedDates.length > 0 ? selectedDates[selectedDates.length - 1] : null;

  const formatExcludedDates = () => {
    if (excludedDates.length === 0) return null;
    // Sort dates in ascending order before formatting
    const sortedDates = [...excludedDates].sort((a, b) => a.getTime() - b.getTime());
    return sortedDates.map(date => `${date.getMonth() + 1}月${date.getDate()}日`).join('、');
  };

  return (
    <div className="fixed inset-0 z-[85] pointer-events-none">
      {/* Mask - 只在app默认容器宽度内显示 */}
      <div className="absolute inset-0 flex justify-center pointer-events-none">
        <div className="relative w-full max-w-sm h-full pointer-events-auto">
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center px-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-[340px] w-full overflow-hidden">
              <div className="px-5 py-4">
                <div className="text-center mb-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    确认配送周期
                  </h3>
                  <p className="text-xs text-gray-500">
                    请核实以下配送周期，确认后无法再支持修改
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">配送周期</span>
                    <span className="text-xs font-medium text-gray-900">
                      {startDate && endDate && (
                        <>
                          {startDate.getMonth() + 1}月{startDate.getDate()}日 - {endDate.getMonth() + 1}月{endDate.getDate()}日
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">配送天数</span>
                    <span className="text-xs font-medium text-gray-900">
                      {actualDeliveryDays} 天
                    </span>
                  </div>

                  {excludedDates.length > 0 && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-gray-600 whitespace-nowrap">已排除日期</span>
                      <span className="text-xs font-medium text-gray-900 text-right flex-1">
                        {formatExcludedDates()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-600">餐食类型</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {selectedMealTypes.map(mealType => (
                        <span
                          key={mealType}
                          className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded"
                        >
                          {getMealTypeLabel(mealType)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center mt-3">
                  确认后请继续选择配送地址
                </p>
              </div>

              <div className="flex border-t border-gray-200">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-200"
                >
                  返回修改
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-3 text-sm font-medium text-green-600 hover:bg-gray-50 transition-colors"
                >
                  确认并继续
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealPlanConfirmationModal;
