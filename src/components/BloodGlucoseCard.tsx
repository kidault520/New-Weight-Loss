import React from 'react';
import { Droplet } from 'lucide-react';
import DashboardCard from './common/DashboardCard';

interface BloodGlucoseCardProps {
  data: {
    current: number | null;
    target: { min: number; max: number };
    hasRecord: boolean;
    lastMeasurement: string;
  };
  onOpenBloodGlucoseDetail: () => void;
  onOpenBloodGlucoseAddModal?: () => void;
  isShrunk?: boolean;
}

const BloodGlucoseCard: React.FC<BloodGlucoseCardProps> = ({ data, onOpenBloodGlucoseDetail, onOpenBloodGlucoseAddModal, isShrunk }) => {
  const getStatusColor = (value: number | null) => {
    if (!value) return 'text-gray-400';
    if (value < data.target.min) return 'text-blue-600';
    if (value > data.target.max) return 'text-red-600';
    return 'text-green-600';
  };

  const getStatusText = (value: number | null) => {
    if (!value) return '暂无数据';
    if (value < data.target.min) return '偏低';
    if (value > data.target.max) return '偏高';
    return '正常';
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenBloodGlucoseAddModal) {
      onOpenBloodGlucoseAddModal();
    }
  };

  return (
    <DashboardCard
      title="血糖"
      showPlus={true}
      onCardClick={onOpenBloodGlucoseDetail}
      onPlusClick={handlePlusClick}
      isShrunk={isShrunk}
    >

      {data.hasRecord && data.current ? (
        <>
          {/* Current Value */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-2">
              <Droplet className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-2xl font-bold text-gray-800">
                {data.current}
              </span>
              <span className="text-sm text-gray-500 ml-1">mg/dL</span>
            </div>
            <div className={`text-sm font-medium ${getStatusColor(data.current)}`}>
              {getStatusText(data.current)}
            </div>
          </div>

          {/* Target Range */}
          <div className="bg-white/50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">目标范围</div>
            <div className="text-sm font-bold text-gray-800">
              {data.target.min}-{data.target.max} mg/dL
            </div>
          </div>

          {/* Last Measurement */}
          {data.lastMeasurement && (
            <div className="text-center text-xs text-gray-500 mt-2">
              上次测量: {data.lastMeasurement}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🩸</div>
          <div className="text-gray-400 text-sm">暂无血糖记录</div>
        </div>
      )}
    </DashboardCard>
  );
};

export default BloodGlucoseCard;