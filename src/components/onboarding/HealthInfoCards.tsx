/**
 * HealthInfoCards - 健康信息卡片组件
 * 从HealthReportPage.tsx中提取的5个信息卡片
 * 符合架构规范：单一职责，减少HealthReportPage.tsx复杂度
 * 性能优化：使用React.memo避免不必要的重渲染
 */
 

import React from 'react';

interface HealthInfoCardsProps {
  totalCards: number;
  currentCardIndex: number;
  onCardScroll: (index: number) => void;
}

const HealthInfoCardsComponent: React.FC<HealthInfoCardsProps> = ({
  totalCards,
  currentCardIndex,
  onCardScroll,
}) => {
  void totalCards;
  void currentCardIndex;
  void onCardScroll;
  return (
    <>
      {/* Card 1: 营养补剂 */}
      <div className="flex-shrink-0 snap-center" style={{ width: 'calc(100% - 24px)' }}>
        <div className="relative bg-white rounded-3xl overflow-hidden mr-4" style={{ height: '470px' }}>
          <div className="bg-gradient-to-br from-blue-300 to-blue-400 pt-8 px-6 pb-6 relative">
            <div className="absolute top-6 right-6">
              <div className="w-24 h-32 bg-white rounded-full shadow-lg transform rotate-12"></div>
            </div>

            <div className="relative z-10">
              <p className="text-sm text-gray-800 mb-3">生活医学</p>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">营养补剂</h3>

              <div className="space-y-2 text-gray-800">
                <p className="text-sm leading-relaxed">
                  促进脂质代谢<sup className="text-xs text-gray-600">[1]</sup>；减轻炎症反应<sup className="text-xs text-gray-600">[2]</sup>；增强运动耐力，提升运动表现<sup className="text-xs text-gray-600">[3]</sup>
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-200 mx-6"></div>

          <div className="px-6 pt-6 pb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">针对BMI过重问题</h4>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              配合运动控制体重。左旋肉碱能增加脂肪酸的氧化利用率，减少糖原的消耗，从而有助于控制体重。
            </p>
            <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center">
              了解补剂详情和参考文献
              <span className="ml-1">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: 食物处方 */}
      <div className="flex-shrink-0 snap-center" style={{ width: 'calc(100% - 24px)' }}>
        <div className="relative bg-white rounded-3xl overflow-hidden mr-4" style={{ height: '470px' }}>
          <div className="bg-gradient-to-br from-purple-300 to-purple-400 pt-8 px-6 pb-6 relative">
            <div className="absolute top-6 right-6">
              <div className="w-24 h-32 bg-white rounded-full shadow-lg transform rotate-12"></div>
            </div>

            <div className="relative z-10">
              <p className="text-sm text-gray-800 mb-3">生活医学</p>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">食物处方</h3>

              <div className="space-y-2 text-gray-800">
                <p className="text-sm leading-relaxed">
                  支持心血管健康<sup className="text-xs text-gray-600">[1]</sup>；改善大脑认知功能<sup className="text-xs text-gray-600">[2]</sup>；抗炎作用，减少慢性炎症<sup className="text-xs text-gray-600">[3]</sup>
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-200 mx-6"></div>

          <div className="px-6 pt-6 pb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">优化营养结构</h4>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              补充不足的Omega-3脂肪酸。它能支持心血管健康，改善大脑认知功能，并具有抗炎作用。
            </p>
            <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center">
              了解补剂详情和参考文献
              <span className="ml-1">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: 情绪疗愈 */}
      <div className="flex-shrink-0 snap-center" style={{ width: 'calc(100% - 24px)' }}>
        <div className="relative bg-white rounded-3xl overflow-hidden mr-4" style={{ height: '470px' }}>
          <div className="bg-gradient-to-br from-amber-300 to-orange-400 pt-8 px-6 pb-6 relative">
            <div className="absolute top-6 right-6">
              <div className="w-24 h-32 bg-white rounded-full shadow-lg transform rotate-12"></div>
            </div>

            <div className="relative z-10">
              <p className="text-sm text-gray-800 mb-3">生活医学</p>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">情绪疗愈</h3>

              <div className="space-y-2 text-gray-800">
                <p className="text-sm leading-relaxed">
                  提升能量代谢效率<sup className="text-xs text-gray-600">[1]</sup>；支持神经系统健康<sup className="text-xs text-gray-600">[2]</sup>；改善疲劳和压力状态<sup className="text-xs text-gray-600">[3]</sup>
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-200 mx-6"></div>

          <div className="px-6 pt-6 pb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">针对作息评分偏低</h4>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              改善熬夜导致的疲劳。B族维生素能提升能量代谢效率，支持神经系统健康，改善疲劳和压力状态。
            </p>
            <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center">
              了解补剂详情和参考文献
              <span className="ml-1">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 4: 运动疗愈 */}
      <div className="flex-shrink-0 snap-center" style={{ width: 'calc(100% - 24px)' }}>
        <div className="relative bg-white rounded-3xl overflow-hidden mr-4" style={{ height: '470px' }}>
          <div className="bg-gradient-to-br from-pink-300 to-rose-400 pt-8 px-6 pb-6 relative">
            <div className="absolute top-6 right-6">
              <div className="w-24 h-32 bg-white rounded-full shadow-lg transform rotate-12"></div>
            </div>

            <div className="relative z-10">
              <p className="text-sm text-gray-800 mb-3">生活医学</p>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">运动疗愈</h3>

              <div className="space-y-2 text-gray-800">
                <p className="text-sm leading-relaxed">
                  缓解焦虑和压力情绪<sup className="text-xs text-gray-600">[1]</sup>；改善睡眠质量<sup className="text-xs text-gray-600">[2]</sup>；支持肌肉放松和恢复<sup className="text-xs text-gray-600">[3]</sup>
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-200 mx-6"></div>

          <div className="px-6 pt-6 pb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">关注心理健康</h4>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              配合运动提升身心状态。镁元素能缓解焦虑和压力情绪，改善睡眠质量，支持肌肉放松和恢复。
            </p>
            <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center">
              了解补剂详情和参考文献
              <span className="ml-1">›</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const HealthInfoCards = React.memo(HealthInfoCardsComponent);


