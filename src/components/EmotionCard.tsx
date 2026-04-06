import React from 'react';
import DashboardCard from './common/DashboardCard';

interface EmotionCardProps {
  data: {
    current: string;
    intensity: number;
    hasRecord: boolean;
  };
  onOpenEmotionJar: () => void;
}

const EmotionCard: React.FC<EmotionCardProps> = ({ data, onOpenEmotionJar }) => {
  const emotionEmojis = {
    happy: '😊',
    sad: '😢',
    neutral: '😐',
    excited: '🤩',
    tired: '😴',
    worried: '😰',
    calm: '😌',
    focused: '🧘',
  };

  const emotionNames = {
    happy: '开心',
    sad: '难过',
    neutral: '平静',
    excited: '兴奋',
    tired: '疲惫',
    worried: '担心',
    calm: '平静',
    focused: '专注',
  };

  return (
    <DashboardCard
      title="心情"
      showPlus={true}
      onCardClick={onOpenEmotionJar}
    >
      {data.hasRecord ? (
        <>
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">
              {emotionEmojis[data.current as keyof typeof emotionEmojis] || '😐'}
            </div>
            <div className="text-xl font-bold text-gray-800">
              {emotionNames[data.current as keyof typeof emotionNames] || '平静'}
            </div>
            <div className="text-sm text-gray-500">强度 {Math.round(data.intensity * 10)}/10</div>
          </div>
          <div className="text-center text-gray-400 text-sm">今日已记录</div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🙂</div>
          <div className="text-gray-400 text-sm">暂无心情记录</div>
          <div className="text-xs text-gray-400 mt-2">点击卡片或 + 记录今日心情</div>
        </div>
      )}
    </DashboardCard>
  );
};

export default EmotionCard;