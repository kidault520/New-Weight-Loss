/**
 * DashboardCardGrid - Dashboard卡片网格布局组件
 * 从Dashboard.tsx中提取的卡片网格布局逻辑
 * 符合架构规范：单一职责，减少Dashboard.tsx复杂度
 */

import React from 'react';

interface DashboardCardGridProps {
  cardComponents: Record<string, React.ReactNode>;
  dashboardCardOrder: string[];
  hiddenDashboardCards: string[];
}

export const DashboardCardGrid: React.FC<DashboardCardGridProps> = ({
  cardComponents,
  dashboardCardOrder,
  hiddenDashboardCards,
}) => {
  // Render cards based on order and visibility
  const renderCards = () => {
    // 获取所有可用的卡片ID
    const allCardIds = Object.keys(cardComponents);
    
    // 去重：确保每个卡片只渲染一次
    const uniqueCardOrder = Array.from(new Set(dashboardCardOrder));
    
    // 显示所有不在hiddenDashboardCards中的卡片
    // 优先使用dashboardCardOrder的顺序，对于不在order中的卡片，按默认顺序添加到最后
    const visibleCards = allCardIds
      .filter(cardId => !hiddenDashboardCards.includes(cardId))
      .sort((a, b) => {
        const indexA = uniqueCardOrder.indexOf(a);
        const indexB = uniqueCardOrder.indexOf(b);
        // 如果两个卡片都在order中，按order排序
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        // 如果只有A在order中，A排在前面
        if (indexA !== -1) return -1;
        // 如果只有B在order中，B排在前面
        if (indexB !== -1) return 1;
        // 如果都不在order中，保持默认顺序（calories和weight优先）
        const defaultOrder = ['calories', 'weight', 'nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose', 'breathing'];
        const defaultIndexA = defaultOrder.indexOf(a);
        const defaultIndexB = defaultOrder.indexOf(b);
        if (defaultIndexA !== -1 && defaultIndexB !== -1) {
          return defaultIndexA - defaultIndexB;
        }
        return 0;
      });
    
    const elements: React.ReactElement[] = [];
    
    // 所有卡片统一按 2 列布局，保持视觉一致
    const remainingCards = visibleCards;
    const cardPairs = [];
    
    for (let i = 0; i < remainingCards.length; i += 2) {
      const pair = remainingCards.slice(i, i + 2);
      cardPairs.push(pair);
    }
    
    cardPairs.forEach((pair, index) => {
      // ✅ 过滤掉不存在的卡片组件，避免渲染 undefined
      const validPair = pair.filter(cardId => {
        const component = cardComponents[cardId as keyof typeof cardComponents];
        return component !== undefined;
      });
      
      if (validPair.length > 0) {
        elements.push(
          <div key={`pair-${index}`} className="grid grid-cols-2 gap-3">
            {validPair.map(cardId => cardComponents[cardId as keyof typeof cardComponents])}
          </div>
        );
      }
    });
    
    return <div className="space-y-3">{elements}</div>;
  };

  return renderCards();
};




