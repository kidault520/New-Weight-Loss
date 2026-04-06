import React from 'react';
import { Moon } from 'lucide-react';
import DashboardCard from './common/DashboardCard';

interface SleepCardProps {
  data: {
    duration: number;
    quality: number;
    bedTime: string;
    wakeTime: string;
    hasRecord: boolean;
  };
  onOpenSleepDetail: () => void;
  onOpenSleepAddModal?: () => void;
  isShrunk?: boolean;
}

const SleepCard: React.FC<SleepCardProps> = ({ data, onOpenSleepDetail, onOpenSleepAddModal, isShrunk }) => {
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return { hours: h, minutes: m };
  };

  const getQualityText = (quality: number) => {
    if (quality >= 0.8) return '优秀';
    if (quality >= 0.6) return '良好';
    if (quality >= 0.4) return '一般';
    return '较差';
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 0.8) return 'text-green-600';
    if (quality >= 0.6) return 'text-blue-600';
    if (quality >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenSleepAddModal) {
      onOpenSleepAddModal();
    }
  };

  return (
    <DashboardCard
      title="睡眠"
      showPlus={true}
      onCardClick={onOpenSleepDetail}
      onPlusClick={handlePlusClick}
      isShrunk={isShrunk}
    >

      {data.hasRecord ? (
        <>
          {/* Sleep Duration */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-2">
              <Moon className="w-6 h-6 text-indigo-500 mr-2" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-gray-800">
                  {formatDuration(data.duration).hours}小时
                </span>
                <span className="text-2xl font-bold text-gray-800">
                  {formatDuration(data.duration).minutes}分钟
                </span>
              </div>
            </div>
            {data.quality > 0 ? (
              <div className={`text-sm font-medium ${getQualityColor(data.quality)}`}>
                睡眠质量: {getQualityText(data.quality)}
              </div>
            ) : (
              <div className="text-sm font-medium text-blue-600">
                目标睡眠时长
              </div>
            )}
          </div>

          {/* Sleep Times */}
          {data.bedTime !== '--:--' && data.wakeTime !== '--:--' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/50 rounded-xl p-3 flex flex-col items-center justify-center">
                <div className="text-xs text-gray-500 mb-1">入睡</div>
                <div className="text-lg font-bold text-gray-800">{data.bedTime}</div>
              </div>
              <div className="bg-white/50 rounded-xl p-3 flex flex-col items-center justify-center">
                <div className="text-xs text-gray-500 mb-1">起床</div>
                <div className="text-lg font-bold text-gray-800">{data.wakeTime}</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm">
              点击记录今日睡眠
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">😴</div>
          <div className="text-gray-400 text-sm">暂无睡眠记录</div>
        </div>
      )}
    </DashboardCard>
  );
};

export default SleepCard;