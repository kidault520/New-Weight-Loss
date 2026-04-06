import React from 'react';

interface EmotionAnimationProps {
  show: boolean;
  emoji: string;
}

const EmotionAnimation: React.FC<EmotionAnimationProps> = ({ show, emoji }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] flex items-center justify-center">
      <div className="animate-bounce">
        <div 
          className="text-6xl animate-pulse"
          style={{
            animation: 'flyToJar 2s ease-in-out forwards'
          }}
        >
          {emoji}
        </div>
      </div>
    </div>
  );
};

export default EmotionAnimation;
