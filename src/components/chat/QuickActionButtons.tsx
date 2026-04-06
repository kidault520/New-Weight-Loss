import React from 'react';
import { useChatContext } from '../../contexts/ChatContext';

const QuickActionButtons: React.FC = () => {
  const { handleQuickAction, isLoadingAnalysis } = useChatContext();

  const quickActions = [
    '健康报告生成',
    '血糖分析',
    '个性方案',
    '配送时间',
  ];

  return (
    <div className="px-4 pt-2 pb-2">
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={() => handleQuickAction(action)}
            disabled={isLoadingAnalysis}
            className="bg-gray-200 px-3 py-1.5 rounded-xl text-xs text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionButtons;
