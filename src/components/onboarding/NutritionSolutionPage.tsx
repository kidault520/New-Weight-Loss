import React, { useCallback, useState, useEffect } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { getNutritionSolutionContent } from '../../services/contentService';
import { SecondaryPageHeader } from '../common/SecondaryPageHeader';
import { LoadingState } from '../common/LoadingState';
import { BottomActionBar } from '../common/BottomActionBar';
import { NutritionItemCard } from './NutritionItemCard';

interface NutritionSolutionPageProps {
  onComplete: () => void;
  onBack?: () => void; // 返回按钮的回调（用于引导流程中返回上一步）
  readOnly?: boolean;
}

const NutritionSolutionPage: React.FC<NutritionSolutionPageProps> = ({ onComplete, onBack, readOnly = false }) => {
  const { data } = useOnboarding();
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedLifestyle, setSelectedLifestyle] = useState<string[]>([]);
  const [supplementProducts, setSupplementProducts] = useState<any[]>([]);
  const [dietRecommendations, setDietRecommendations] = useState<any[]>([]);
  const [lifestyleRecommendations, setLifestyleRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isViewingMode = readOnly;

  /** 从 content_data 解析展示文案：支持纯字符串或 JSON（含 subtitle） */
  const parseDisplayDescription = (val: unknown): string => {
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed.subtitle === 'string') return parsed.subtitle;
        return val;
      } catch {
        return val;
      }
    }
    if (val && typeof val === 'object' && 'subtitle' in val && typeof (val as any).subtitle === 'string') {
      return (val as any).subtitle;
    }
    return typeof val === 'string' ? val : '';
  };

  const loadContent = useCallback(async () => {
    try {
      // 首屏已由 loading 初始 true 覆盖，避免多一次 setState 闪屏
      // 全部来自内容管理 nutrition_solution_content，不再使用 supplement_products
      const nutritionContent = await getNutritionSolutionContent();

      const supplementContent = nutritionContent.filter(c => c.section_type === 'supplement');
      if (supplementContent.length > 0) {
        setSupplementProducts(supplementContent.map(c => {
          const d = c.content_data || {};
          return {
            id: c.id,
            name: d.name || d.title || '',
            description: parseDisplayDescription(d.description ?? d.subtitle ?? ''),
            dosage: d.dosage || '',
            icon: d.icon || d.icon_path || '/buji.png',
            tags: d.tags || [],
          };
        }));
      } else {
        setSupplementProducts([{
          id: 'fallback-supplement',
          name: '限制30%热量吸收补剂配方',
          description: '绿茶提取物的儿茶素通过刺激产热和脂肪氧化提高代谢，而咖啡因和儿茶素的协同作用还能抑制食欲，帮助减脂。',
          dosage: '每天7颗',
          icon: '/buji.png',
          tags: ['海外进口', '跨境直邮', '免运费', '专业营养师咨询'],
        }]);
      }

      const dietContent = nutritionContent.filter(c => c.section_type === 'diet');
      if (dietContent.length > 0) {
        setDietRecommendations(dietContent.map(c => {
          const d = c.content_data || {};
          return {
            id: c.id,
            name: d.name || d.title || '',
            description: parseDisplayDescription(d.description ?? d.subtitle ?? ''),
            dosage: d.dosage || '',
            icon: d.icon || '/yinshi.png',
            color: 'from-yellow-50 to-white',
          };
        }));
      } else {
        setDietRecommendations([{
          id: 'fallback-diet',
          name: '植物基低碳快版健康餐',
          description: '蔬菜摄入不足易导致维生素C缺乏，易引起免疫力降低、易疲劳和倾颓等问题，建议适当补充。',
          dosage: '每天2餐',
          icon: '/yinshi.png',
          color: 'from-yellow-50 to-white',
        }]);
      }

      const lifestyleContent = nutritionContent.filter(c => c.section_type === 'lifestyle');
      if (lifestyleContent.length > 0) {
        setLifestyleRecommendations(lifestyleContent.map(c => {
          const d = c.content_data || {};
          return {
            id: c.id,
            name: d.name || d.title || '',
            description: parseDisplayDescription(d.description ?? d.subtitle ?? ''),
            dosage: d.dosage || '',
            icon: d.icon || '/liaoyu.png',
            color: 'from-purple-50 to-white',
          };
        }));
      } else {
        setLifestyleRecommendations([{
          id: 'fallback-lifestyle',
          name: '情绪运动疗愈站',
          description: '健康的生活方式有助于减轻个体情绪及心理的压力，能有效降低皮质醇，维持一个稳定的基础代谢，对减重有很大的帮助',
          dosage: '每周2-3次',
          icon: '/liaoyu.png',
          color: 'from-purple-50 to-white',
        }]);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      setSupplementProducts([{
        id: 'fallback-supplement',
        name: '限制30%热量吸收补剂配方',
        description: '绿茶提取物的儿茶素通过刺激产热和脂肪氧化提高代谢，而咖啡因和儿茶素的协同作用还能抑制食欲，帮助减脂。',
        dosage: '每天7颗',
        icon: '/buji.png',
        tags: ['海外进口', '跨境直邮', '免运费', '专业营养师咨询'],
      }]);
      setDietRecommendations([{
        id: 'fallback-diet',
        name: '植物基低碳快版健康餐',
        description: '蔬菜摄入不足易导致维生素C缺乏，易引起免疫力降低、易疲劳和倾颓等问题，建议适当补充。',
        dosage: '每天2餐',
        icon: '/yinshi.png',
        color: 'from-yellow-50 to-white',
      }]);
      setLifestyleRecommendations([{
        id: 'fallback-lifestyle',
        name: '情绪运动疗愈站',
        description: '健康的生活方式有助于减轻个体情绪及心理的压力，能有效降低皮质醇，维持一个稳定的基础代谢，对减重有很大的帮助',
        dosage: '每周2-3次',
        icon: '/liaoyu.png',
        color: 'from-purple-50 to-white',
      }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // 通用toggle函数，根据类型切换选中状态
  const toggleItem = (id: string, type: 'supplement' | 'diet' | 'lifestyle') => {
    if (type === 'supplement') {
      setSelectedSupplements(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    } else if (type === 'diet') {
      setSelectedDiets(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    } else {
      setSelectedLifestyle(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    }
  };

  // 检查项目是否被选中
  const isItemSelected = (id: string, type: 'supplement' | 'diet' | 'lifestyle') => {
    if (type === 'supplement') {
      return selectedSupplements.includes(id);
    } else if (type === 'diet') {
      return selectedDiets.includes(id);
    } else {
      return selectedLifestyle.includes(id);
    }
  };

  // Note: Data saving has been moved to HealthReportPage
  // This page now only displays nutrition solutions and completes the onboarding

  const handleComplete = () => {
    // Data was already saved in HealthReportPage (step 16)
    // This button click will trigger App.tsx's handleCloseOnboardingNutritionSolution
    // which will complete the onboarding and navigate to MealPlan screen
    // DO NOT call resetData() here - data cleanup will be handled in App.tsx
    onComplete();
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (isViewingMode) {
      onComplete();
    } else {
      onComplete();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      <div className="sticky top-0 z-20 flex-shrink-0">
        <SecondaryPageHeader title="营养方案" onClose={handleBack} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex min-h-[45vh] items-center justify-center py-8">
            <LoadingState />
          </div>
        ) : (
          <>
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 mx-4 mt-4 rounded-2xl">
        <div className="flex items-start space-x-3">
          <div className="w-20 h-24 rounded-lg shadow-md overflow-hidden">
            <img src="/dangan.png" alt="档案" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              为 <span className="underline decoration-2 underline-offset-4">{data.nickname || '你'}</span>
            </h2>
            <p className="text-2xl font-bold text-gray-800">量身定制的营养方案</p>
            <p className="text-sm text-gray-600 mt-2">瑞丹维为你定制的健康方案</p>
          </div>
        </div>
      </div>

      <div className="mt-6 px-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-1 h-6 bg-yellow-400 rounded-full"></div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">补剂方案</h3>
            <p className="text-xs text-gray-500">瑞丹维·专属补剂方案</p>
          </div>
        </div>

        <div className="space-y-3">
          {supplementProducts.map((product) => (
            <NutritionItemCard
              key={product.id}
              id={product.id}
              name={product.name}
              description={product.description}
              dosage={product.dosage}
              icon={product.icon}
              isSelected={isItemSelected(product.id, 'supplement')}
              onToggle={(id) => toggleItem(id, 'supplement')}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 px-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-1 h-6 bg-yellow-400 rounded-full"></div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">饮食方案</h3>
            <p className="text-xs text-gray-500">瑞迈麸营养餐方案</p>
          </div>
        </div>

        <div className="space-y-3">
          {dietRecommendations.map((diet) => (
            <NutritionItemCard
              key={diet.id}
              id={diet.id}
              name={diet.name}
              description={diet.description}
              dosage={diet.dosage}
              icon={diet.icon}
              isSelected={isItemSelected(diet.id, 'diet')}
              onToggle={(id) => toggleItem(id, 'diet')}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 px-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-1 h-6 bg-yellow-400 rounded-full"></div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">生活方案</h3>
            <p className="text-xs text-gray-500">瑞SPA健康轻体快乐方案</p>
          </div>
        </div>

        <div className="space-y-3">
          {lifestyleRecommendations.map((lifestyle) => (
            <NutritionItemCard
              key={lifestyle.id}
              id={lifestyle.id}
              name={lifestyle.name}
              description={lifestyle.description}
              dosage={lifestyle.dosage}
              icon={lifestyle.icon}
              isSelected={isItemSelected(lifestyle.id, 'lifestyle')}
              onToggle={(id) => toggleItem(id, 'lifestyle')}
            />
          ))}
        </div>
      </div>

      <div className="pb-6"></div>
          </>
        )}
      </div>

      {/* 查看模式：不显示按钮；加载中禁用主按钮，避免底部栏突然出现造成跳动 */}
      <BottomActionBar
        visible={!isViewingMode}
        primaryText="开始我的健康之旅"
        onPrimaryClick={handleComplete}
        disabled={loading}
        buttonClassName="w-full px-8 py-3 rounded-2xl bg-yellow-400 text-gray-900 text-base font-semibold hover:bg-yellow-500 active:bg-yellow-600 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:pointer-events-none"
        containerClassName="bg-white border-t border-gray-200 px-4 py-4"
      />
    </div>
  );
};

export default NutritionSolutionPage;
