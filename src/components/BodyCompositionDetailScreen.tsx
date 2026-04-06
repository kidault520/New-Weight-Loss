import React, { useMemo, useState } from 'react';
import { DetailHeader } from './common/DetailHeader';
import { DragPanel } from './common/DragPanel';
import { SectionCard } from './common/SectionCard';
import { PeriodSelector } from './common/PeriodSelector';
import { DateNavigator } from './common/DateNavigator';
import { useUserProfile } from '../contexts/UserProfileContext';
import { calculateBMR } from '../utils/bmrCalculations';
import { formatWeekLabel } from '../utils/dateUtils';
import type { DayData } from '../utils/mockData';

interface BodyCompositionDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
  data: DayData;
}

const BodyCompositionDetailScreen: React.FC<BodyCompositionDetailScreenProps> = ({
  onClose,
  selectedDate,
  data,
}) => {
  const [activeDate, setActiveDate] = useState(selectedDate);
  const [selectedPeriod, setSelectedPeriod] = useState<'天' | '周' | '月' | '年'>('天');
  const { profile } = useUserProfile();
  const weight = data.weight.current || profile?.current_weight || null;
  const height = profile?.height || null;

  const bmi = useMemo(() => {
    if (!weight || !height) return null;
    return +(weight / ((height / 100) * (height / 100))).toFixed(1);
  }, [weight, height]);

  const bodyFatPercent = useMemo(() => {
    if (!bmi) return null;
    const age = profile?.age || 30;
    const sexValue = profile?.gender === 'male' ? 1 : 0;
    const value = 1.2 * bmi + 0.23 * age - 10.8 * sexValue - 5.4;
    return +Math.max(8, Math.min(45, value)).toFixed(1);
  }, [bmi, profile?.age, profile?.gender]);

  const bodyScore = useMemo(() => {
    const bmiScore = bmi ? Math.max(0, 100 - Math.min(20, Math.abs(bmi - 22) * 5)) : 70;
    const waterScore = Math.min(100, Math.round((data.water.current / Math.max(1, data.water.target)) * 100));
    const stepsScore = Math.min(100, Math.round((data.steps.current / Math.max(1, data.steps.target)) * 100));
    return Math.round(bmiScore * 0.5 + waterScore * 0.2 + stepsScore * 0.3);
  }, [bmi, data.water, data.steps]);

  const fatMassKg = useMemo(() => {
    if (!weight || !bodyFatPercent) return null;
    return +(weight * (bodyFatPercent / 100)).toFixed(1);
  }, [weight, bodyFatPercent]);

  const muscleMassKg = useMemo(() => {
    if (!weight) return null;
    const ratio = profile?.gender === 'male' ? 0.45 : 0.4;
    return +(weight * ratio).toFixed(1);
  }, [weight, profile?.gender]);

  const bmr = useMemo(() => {
    if (!profile) return 1500;
    return calculateBMR(profile);
  }, [profile]);

  const indicators = [
    { label: 'BMI', value: bmi ? bmi.toFixed(1) : '--', unit: '' },
    { label: '体脂率', value: bodyFatPercent ? bodyFatPercent.toFixed(1) : '--', unit: '%' },
    { label: '体脂肪', value: fatMassKg ? fatMassKg.toFixed(1) : '--', unit: 'kg' },
    { label: '肌肉量', value: muscleMassKg ? muscleMassKg.toFixed(1) : '--', unit: 'kg' },
    { label: '基础代谢', value: `${Math.round(bmr)}`, unit: 'kcal' },
  ];

  const chartValues = useMemo(() => {
    const pointCount = selectedPeriod === '周' ? 7 : selectedPeriod === '月' ? 6 : 12;
    const base = bodyScore || 60;
    return Array.from({ length: pointCount }).map((_, idx) => {
      const wave = Math.sin((idx / Math.max(1, pointCount - 1)) * Math.PI * 1.5) * 6;
      const drift = idx * 0.3;
      return Math.max(35, Math.min(98, Math.round(base - 6 + wave + drift)));
    });
  }, [selectedPeriod, bodyScore]);

  const chartPath = useMemo(() => {
    if (chartValues.length === 0) return '';
    const width = 320;
    const height = 150;
    const stepX = width / Math.max(1, chartValues.length - 1);
    const points = chartValues.map((value, idx) => {
      const x = idx * stepX;
      const y = height - ((value - 30) / 70) * height;
      return `${x},${y}`;
    });
    return points.join(' ');
  }, [chartValues]);

  const xLabels = useMemo(() => {
    if (selectedPeriod === '周') return ['一', '二', '三', '四', '五', '六', '日'];
    if (selectedPeriod === '月') return ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周'];
    return ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  }, [selectedPeriod]);

  const dateLabel = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = String(activeDate.getMonth() + 1).padStart(2, '0');
    const day = String(activeDate.getDate()).padStart(2, '0');

    switch (selectedPeriod) {
      case '天':
        return `${year}-${month}-${day}`;
      case '周':
        return formatWeekLabel(activeDate);
      case '月':
        return `${year}年${month}月`;
      case '年':
        return `${year}年`;
      default:
        return `${year}-${month}-${day}`;
    }
  }, [activeDate, selectedPeriod]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const nextDate = new Date(activeDate);
    const delta = direction === 'next' ? 1 : -1;

    if (selectedPeriod === '天') nextDate.setDate(nextDate.getDate() + delta);
    if (selectedPeriod === '周') nextDate.setDate(nextDate.getDate() + delta * 7);
    if (selectedPeriod === '月') nextDate.setMonth(nextDate.getMonth() + delta);
    if (selectedPeriod === '年') nextDate.setFullYear(nextDate.getFullYear() + delta);

    setActiveDate(nextDate);
  };

  return (
    <DragPanel
      show={true}
      onClose={onClose}
      zIndex={60}
      mask={{ visible: false }}
      header={
        <>
          <DetailHeader title="人体成分组成" leftAction={{ label: '返回', onClick: onClose }} />
          <div className="bg-gray-50 px-4 pt-2 pb-1">
            <PeriodSelector
              options={['天', '周', '月', '年'].map((label) => ({ label, value: label }))}
              value={selectedPeriod}
              onChange={(value) => setSelectedPeriod(value as '天' | '周' | '月' | '年')}
            />
          </div>
        </>
      }
    >
      <div className="px-4 space-y-2 flex-1 overflow-y-auto pb-4 scrollbar-hide">
        <SectionCard className="my-1">
          <div className="flex items-center justify-center pb-2">
            <DateNavigator label={dateLabel} onPrev={() => navigateDate('prev')} onNext={() => navigateDate('next')} />
          </div>
          {selectedPeriod === '天' ? (
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <div className="rounded-xl bg-[#F2F2F7] flex items-end justify-center min-h-[260px]">
                <svg
                  viewBox="0 0 120 240"
                  className="h-[200px] w-auto"
                  aria-label="人体成分模型"
                  role="img"
                >
                  <defs>
                    <linearGradient id="detailBodyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93C4F6" />
                      <stop offset="100%" stopColor="#5EA5EA" />
                    </linearGradient>
                  </defs>
                  <g fill="url(#detailBodyGrad)" stroke="#6EAEE5" strokeWidth="1.1">
                    <circle cx="60" cy="28" r="14" />
                    <rect x="46" y="42" width="28" height="62" rx="14" />
                    <rect x="34" y="62" width="14" height="44" rx="7" transform="rotate(10 34 62)" />
                    <rect x="72" y="62" width="14" height="44" rx="7" transform="rotate(-10 72 62)" />
                    <rect x="46" y="102" width="12" height="76" rx="6" />
                    <rect x="62" y="102" width="12" height="76" rx="6" />
                    <ellipse cx="52" cy="183" rx="10" ry="6" />
                    <ellipse cx="68" cy="183" rx="10" ry="6" />
                  </g>
                </svg>
              </div>
              <div className="space-y-2 flex flex-col justify-center">
                {indicators.map((item) => (
                  <div key={item.label}>
                    <div className="text-4xl leading-8 font-medium text-[#101828]">
                      {item.value}
                      {item.unit ? <span className="text-xl ml-1">{item.unit}</span> : null}
                    </div>
                    <div className="text-base text-gray-500 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <div className="text-base font-medium text-gray-700 mb-3">趋势图</div>
              <div className="h-44 relative">
                <div className="absolute left-0 top-0 flex flex-col justify-between h-full text-xs text-gray-400">
                  <span>100</span>
                  <span>70</span>
                  <span>40</span>
                </div>
                <div className="ml-8 h-full relative">
                  <div className="absolute inset-x-0 top-[12%] border-t border-dashed border-gray-200"></div>
                  <div className="absolute inset-x-0 top-[48%] border-t border-dashed border-gray-200"></div>
                  <div className="absolute inset-x-0 top-[84%] border-t border-dashed border-gray-200"></div>
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 150" preserveAspectRatio="none">
                    <polyline fill="none" stroke="#4F93DA" strokeWidth="2.5" points={chartPath} />
                    {chartValues.map((value, idx) => {
                      const x = (320 / Math.max(1, chartValues.length - 1)) * idx;
                      const y = 150 - ((value - 30) / 70) * 150;
                      return <circle key={`${value}-${idx}`} cx={x} cy={y} r="3" fill="#4F93DA" />;
                    })}
                  </svg>
                </div>
              </div>
              <div className="ml-8 mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${xLabels.length}, minmax(0, 1fr))` }}>
                {xLabels.map((label) => (
                  <div key={label} className="text-[11px] text-gray-400 text-center truncate">{label}</div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </DragPanel>
  );
};

export default BodyCompositionDetailScreen;

