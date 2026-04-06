import React from 'react';
import DashboardCard from '../common/DashboardCard';
import { useBreathingDayQuery } from '../../hooks/useBreathingDayQuery';

const BreathingCardForDashboard: React.FC = () => {
  const { data: rows = [] } = useBreathingDayQuery();
  const count = rows.length;
  const last = rows[0];
  const lastLabel = last?.breathing_data?.mode_label;

  const open = () => {
    window.dispatchEvent(
      new CustomEvent('openBreathingPractice', { detail: { source: 'dashboard' as const } }),
    );
  };

  return (
    <DashboardCard title="练习呼吸" showPlus={false} onCardClick={open}>
      {count > 0 ? (
        <div className="text-center py-2">
          <div className="text-3xl mb-2" aria-hidden>
            🌬️
          </div>
          <div className="text-lg font-semibold text-gray-800">今日 {count} 次</div>
          {lastLabel ? (
            <div className="text-xs text-gray-500 mt-1 truncate px-1">最近：{lastLabel}</div>
          ) : null}
          <div className="text-xs text-gray-400 mt-2">点击进入全屏练习</div>
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🌬️</div>
          <div className="text-gray-400 text-sm">今日尚未练习</div>
          <div className="text-xs text-gray-400 mt-2">点击开始舒缓呼吸</div>
        </div>
      )}
    </DashboardCard>
  );
};

export default BreathingCardForDashboard;
