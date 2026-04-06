import React from 'react';

interface SyncSuccessModalProps {
  onClose: () => void;
  onViewNutrition: () => void;
}

const SyncSuccessModal: React.FC<SyncSuccessModalProps> = ({
  onClose,
  onViewNutrition
}) => {
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-4 mx-4 w-full max-w-xs animate-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gray-800 mb-2">同步成功!</div>
          <div className="text-sm text-gray-600">已经将食物记录在饮食列表</div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onViewNutrition}
            className="w-full bg-teal-500 text-white py-3 rounded-2xl font-medium text-base hover:bg-teal-600 transition-colors"
          >
            查看
          </button>
          
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-medium text-base hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncSuccessModal;