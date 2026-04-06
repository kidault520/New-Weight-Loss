import React from 'react';
import { AlertCircle } from 'lucide-react';
import { CenterModal } from './common/CenterModal';

interface BatchAddressUpdateModalProps {
  onClose: () => void;
  onConfirm: () => void;
  affectedDaysCount: number;
  affectedMealsCount: number;
  newAddressLabel: string;
}

const BatchAddressUpdateModal: React.FC<BatchAddressUpdateModalProps> = ({
  onClose,
  onConfirm,
  affectedDaysCount,
  affectedMealsCount,
  newAddressLabel
}) => {
  return (
    <CenterModal
      show={true}
      onClose={onClose}
      title="批量更新配送地址"
      zIndex={80}
      maxWidth="max-w-sm"
      showHeaderBorder={true}
      headerClassName="px-6 py-5"
    >
      <div className="px-6 py-5">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
          </div>
        </div>

        <p className="text-gray-700 text-base leading-relaxed mb-4">
          您即将把<span className="font-bold text-yellow-600">【{newAddressLabel}】</span>设为默认地址，
          这将更新未来所有配送计划的地址。
        </p>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">影响天数：</span>
            <span className="text-base font-bold text-gray-900">{affectedDaysCount} 天</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">影响餐次：</span>
            <span className="text-base font-bold text-gray-900">{affectedMealsCount} 餐</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          确认后，所有未来的配送计划将使用新的默认地址。
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex border-t border-gray-200">
        <button
          onClick={onClose}
          className="flex-1 py-4 text-base font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-200"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-4 text-base font-medium text-yellow-600 hover:bg-yellow-50 transition-colors"
        >
          确认更新
        </button>
      </div>
    </CenterModal>
  );
};

export default BatchAddressUpdateModal;
