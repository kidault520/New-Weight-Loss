/**
 * 底部能力条：今日配送、今日餐、今日补剂、日反馈
 */

import React from 'react';
import { ClipboardList, UtensilsCrossed, Pill, FileText } from 'lucide-react';

export interface AbilityBarProps {
  onViewDeliveryPlan: () => void;
  onViewMeals: () => void;
  onViewSupplements: () => void;
  onViewDailyReport: () => void;
  /** 打开完整配送计划页（用于添加地址等） */
  onOpenDeliveryPlanPage?: () => void;
  /** 打开地址管理页（添加/编辑地址） */
  onOpenAddressManagement?: () => void;
}

const AbilityBar: React.FC<AbilityBarProps> = ({
  onViewDeliveryPlan,
  onViewMeals,
  onViewSupplements,
  onViewDailyReport,
}) => {
  const items = [
    { icon: ClipboardList, label: '今日配送', onClick: onViewDeliveryPlan },
    { icon: UtensilsCrossed, label: '今日餐', onClick: onViewMeals },
    { icon: Pill, label: '今日补剂', onClick: onViewSupplements },
    { icon: FileText, label: '日反馈', onClick: onViewDailyReport },
  ];

  return (
    <div className="w-full max-w-sm mx-auto bg-white/95 backdrop-blur-sm border-t border-gray-200/50">
      <div className="flex justify-around items-center py-2 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className="flex flex-row items-center justify-center gap-1.5 py-1.5 px-2 min-w-0 text-gray-700 hover:text-purple-600 transition-colors"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AbilityBar;
