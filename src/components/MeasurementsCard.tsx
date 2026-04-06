import React from 'react';
import DashboardCard from './common/DashboardCard';

interface MeasurementsData {
  chest?: number;
  waist?: number;
  upperArm?: number;
  hips?: number;
  thigh?: number;
  calf?: number;
}

interface MeasurementsCardProps {
  data: MeasurementsData;
  onCardClick?: () => void;
  isShrunk?: boolean;
}

const MeasurementsCard: React.FC<MeasurementsCardProps> = ({
  data,
  onCardClick,
  isShrunk,
}) => {
  const measurements = [
    { name: '胸围', value: data.chest ? `${data.chest}` : '--' },
    { name: '腰围', value: data.waist ? `${data.waist}` : '--' },
    { name: '上臂', value: data.upperArm ? `${data.upperArm}` : '--' },
    { name: '臀围', value: data.hips ? `${data.hips}` : '--' },
    { name: '大腿', value: data.thigh ? `${data.thigh}` : '--' },
    { name: '小腿', value: data.calf ? `${data.calf}` : '--' },
  ];

  return (
    <DashboardCard
      title="围度（cm）"
      onCardClick={onCardClick}
      isShrunk={isShrunk}
    >
      <div className="grid grid-cols-3 gap-4">
        {measurements.map((item, index) => (
          <div key={index} className="text-center">
            <div className="text-sm text-gray-600 mb-1">{item.name}</div>
            <div className={`text-lg font-bold ${item.value === '--' ? 'text-gray-400' : 'text-gray-800'}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
};

export default MeasurementsCard;
















