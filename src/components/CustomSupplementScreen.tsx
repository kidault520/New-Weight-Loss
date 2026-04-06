import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Pill, Calendar, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../config/supabase';
import { LoadingState } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';
import { formatDate } from '../utils/dateFormatters';
import { StatusBadge } from './common/StatusBadge';
import { useSupplementUtils } from '../hooks/useSupplementUtils';
import { useUserProfile } from '../contexts/UserProfileContext';
import { supplementStageService, type SupplementStageResponse } from '../services/supplementStageService';
import { toLocalDateString } from '../utils/dateUtils';

interface CustomSupplement {
  id: string;
  supplement_name: string;
  supplement_type: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  status: string;
  instructions: string;
  icon_path: string;
}

interface InfoCard {
  id: string;
  badge: string;
  title: string;
  benefits: string;
  bgColor: string;
  pillImageUrl: string;
  reasons: Array<{
    title: string;
    description: string;
  }>;
}

interface CustomSupplementScreenProps {
  hasOrder?: boolean;
  /** 订单状态加载中：勿展示无订单演示卡片 */
  orderGateLoading?: boolean;
}

const INFORMATIONAL_CARDS: InfoCard[] = [
  {
    id: 'vitamin-c',
    badge: '每日一颗',
    title: '维生素 C',
    benefits: '提升免疫力[1]；参与胶原蛋白合成[2]；加速组织愈合；调节血压血脂[3,4]',
    bgColor: 'from-amber-100 to-amber-200',
    pillImageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="120" viewBox="0 0 80 120"%3E%3Cellipse cx="40" cy="60" rx="30" ry="50" fill="%23FFA500" stroke="%23FF8C00" stroke-width="2"/%3E%3Cellipse cx="40" cy="60" rx="28" ry="48" fill="url(%23grad1)"/%3E%3Cdefs%3E%3ClinearGradient id="grad1" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%23FFD700;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%23FFA500;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E',
    reasons: [
      {
        title: '你经常生病感冒',
        description: '维生素C可以促进免疫防御，适当增加维生素C的摄入可以提高对疾病的抵抗力。'
      },
      {
        title: '你有轻度烟瘾',
        description: '吸烟会降低你体内的维生素C水平。建议适当补充。'
      }
    ]
  },
  {
    id: 'green-tea-1',
    badge: '每日一颗',
    title: '绿茶提取物',
    benefits: '减脂减重[1,2]；促进脂质代谢[3,4]，清除自由基，打破氧化循环[5,6]',
    bgColor: 'from-green-100 to-green-200',
    pillImageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="120" viewBox="0 0 80 120"%3E%3Cellipse cx="40" cy="60" rx="30" ry="50" fill="%2354C854" stroke="%2340A040" stroke-width="2"/%3E%3Cellipse cx="40" cy="60" rx="28" ry="48" fill="url(%23grad2)"/%3E%3Cdefs%3E%3ClinearGradient id="grad2" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%2380E080;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%2354C854;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E',
    reasons: [
      {
        title: '你有晚睡的习惯',
        description: '绿茶提取物作为强抗氧化剂，可以有效修复长期熬夜导致的肝脏损伤。'
      },
      {
        title: '你有血脂偏高的问题',
        description: '绿茶提取物中的儿茶素可抑制胆固醇在肠道的吸收，增加胆固醇排泄，从而降低血脂水平。'
      }
    ]
  },
  {
    id: 'green-tea-2',
    badge: '每日一颗',
    title: '绿茶提取物',
    benefits: '减脂减重[1,2]；促进脂质代谢[3,4]，清除自由基，打破氧化循环[5,6]',
    bgColor: 'from-green-100 to-green-200',
    pillImageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="120" viewBox="0 0 80 120"%3E%3Cellipse cx="40" cy="60" rx="30" ry="50" fill="%2354C854" stroke="%2340A040" stroke-width="2"/%3E%3Cellipse cx="40" cy="60" rx="28" ry="48" fill="url(%23grad2)"/%3E%3Cdefs%3E%3ClinearGradient id="grad2" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%2380E080;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%2354C854;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E',
    reasons: [
      {
        title: '你有晚睡的习惯',
        description: '绿茶提取物作为强抗氧化剂，可以有效修复长期熬夜导致的肝脏损伤。'
      },
      {
        title: '你有血脂偏高的问题',
        description: '绿茶提取物中的儿茶素可抑制胆固醇在肠道的吸收，增加胆固醇排泄，从而降低血脂水平。'
      }
    ]
  },
  {
    id: 'l-carnitine',
    badge: '每日一颗',
    title: '左旋肉碱',
    benefits: '促进脂质代谢[1]；减轻炎症反应[2]；增强运动耐力，提升运动表现[3]',
    bgColor: 'from-green-100 to-green-200',
    pillImageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="120" viewBox="0 0 80 120"%3E%3Cellipse cx="40" cy="60" rx="30" ry="50" fill="%23F0F0F0" stroke="%23D0D0D0" stroke-width="2"/%3E%3Cellipse cx="40" cy="60" rx="28" ry="48" fill="url(%23grad3)"/%3E%3Cdefs%3E%3ClinearGradient id="grad3" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%23FFFFFF;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%23E8E8E8;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E',
    reasons: [
      {
        title: '你的BMI处于过重范围',
        description: '保持规律运动的好习惯，建议同时补充左旋肉碱，它能增加脂肪酸的氧化利用率，减少糖原的消耗，从而有助于控制体重。'
      }
    ]
  }
];

const CustomSupplementScreen: React.FC<CustomSupplementScreenProps> = ({
  hasOrder = false,
  orderGateLoading = false,
}) => {
  const [supplements, setSupplements] = useState<CustomSupplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const cardSectionRef = useRef<HTMLDivElement>(null);
  const supplementUtils = useSupplementUtils();
  const { refreshMealPlanConfig, intakePlanActive } = useUserProfile();
  const [stageSummary, setStageSummary] = useState<SupplementStageResponse | null>(null);
  const [stageLoading, setStageLoading] = useState(false);
  useEffect(() => {
    loadSupplements();
  }, []);

  useEffect(() => {
    if (!hasOrder || !intakePlanActive) {
      setStageSummary(null);
      setStageLoading(false);
      return;
    }
    setStageLoading(true);
    supplementStageService
      .getActiveSupplementStage()
      .then(setStageSummary)
      .catch(() => setStageSummary(null))
      .finally(() => setStageLoading(false));
  }, [hasOrder, intakePlanActive]);

  // 打开时刷新餐食配置（与其它配送/计划入口对齐）
  useEffect(() => {
    refreshMealPlanConfig();
  }, [refreshMealPlanConfig]);

  const loadSupplements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('custom_supplements')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) throw error;

      setSupplements(data || []);
    } catch (error) {
      console.error('Failed to load supplements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const mainContainer = mainContainerRef.current;
    const cardSection = cardSectionRef.current;
    if (!mainContainer || !cardSection) return;

    const handleVerticalScroll = () => {
      const rect = cardSection.getBoundingClientRect();
      const shouldBeSticky = rect.top <= 10;
      setIsSticky(shouldBeSticky);
    };

    handleVerticalScroll();
    mainContainer.addEventListener('scroll', handleVerticalScroll, { passive: true });
    return () => {
      mainContainer.removeEventListener('scroll', handleVerticalScroll);
    };
  }, [supplements]);

  useEffect(() => {
    if (loading) return;

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleHorizontalScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      const cards = container.children;
      let closestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i] as HTMLElement;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - containerCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      setCurrentCardIndex(closestIndex);
    };

    handleHorizontalScroll();
    container.addEventListener('scroll', handleHorizontalScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleHorizontalScroll);
    };
  }, [supplements, loading]);

  const orderStatusPending = orderGateLoading && !hasOrder;
  /** 未开启摄入托管：与无订单一致展示说明卡模拟内容，不拉后台补剂阶段 */
  const isDemoMode = (!hasOrder || (hasOrder && !intakePlanActive)) && !orderGateLoading;

  const scrollToCard = useCallback((index: number) => {
    const container = scrollContainerRef.current;
    if (!container || index < 0 || index >= container.children.length) return;

    const targetCard = container.children[index] as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();

    const scrollLeft = container.scrollLeft + (cardRect.left - containerRect.left);

    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });

    setCurrentCardIndex(index);
  }, []);



  const activeSupplements = supplements.filter(s => s.status === 'active');
  const otherSupplements = supplements.filter(s => s.status !== 'active');
  const stageDerivedSupplements = useMemo<CustomSupplement[]>(() => {
    if (!hasOrder || !intakePlanActive || !stageSummary?.has_plan || !stageSummary?.stages?.length) return [];
    const startDateRaw = stageSummary.start_date || toLocalDateString(new Date());
    const startDate = new Date(`${startDateRaw}T00:00:00+08:00`);
    const typeCycle = ['vitamin', 'mineral', 'herbal', 'protein'];

    const toDate = (offsetDay: number) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + Math.max(0, offsetDay));
      return toLocalDateString(d);
    };

    const rows: CustomSupplement[] = [];
    stageSummary.stages.forEach((stage) => {
      const stageItems = (stage.supplements && stage.supplements.length > 0)
        ? stage.supplements
        : (stage.supplement
          ? [{ supplement_id: stage.supplement.id, per_day_qty: stage.per_day_qty, supplement: stage.supplement }]
          : []);

      stageItems.forEach((item, idx) => {
        const stageStatus = stage.is_current
          ? 'active'
          : ((stageSummary.current_day || 1) > (stage.end_day || 0) ? 'completed' : 'pending');
        rows.push({
          id: `stage-${stage.index}-${item.supplement?.id || item.supplement_id || idx}`,
          supplement_name: item.supplement?.name || `补剂${stage.index}-${idx + 1}`,
          supplement_type: typeCycle[(stage.index - 1) % typeCycle.length],
          dosage: `${item.per_day_qty ?? stage.per_day_qty ?? 1}颗`,
          frequency: '每日一次',
          start_date: toDate((stage.start_day || 1) - 1),
          end_date: toDate((stage.end_day || stage.start_day || 1) - 1),
          status: stageStatus,
          instructions: `第${stage.index}阶段 · ${stage.stage_name}`,
          icon_path: '',
        });
      });
    });

    return rows;
  }, [hasOrder, intakePlanActive, stageSummary]);

  const allDisplaySupplements = useMemo(() => {
    if (hasOrder && intakePlanActive && stageDerivedSupplements.length > 0) return stageDerivedSupplements;
    if (hasOrder && !intakePlanActive) return [];
    return supplements.length > 0 ? [...activeSupplements, ...otherSupplements] : [];
  }, [hasOrder, intakePlanActive, stageDerivedSupplements, supplements.length, activeSupplements, otherSupplements]);

  // 散客 / 有订单未开启托管 / 已开启但暂无条目：展示说明卡模拟内容
  const displayCards =
    isDemoMode || (hasOrder && intakePlanActive && !stageLoading && allDisplaySupplements.length === 0)
      ? INFORMATIONAL_CARDS
      : [];

  const initialSupplementCardIndex = useMemo(() => {
    if (!hasOrder || allDisplaySupplements.length === 0) return 0;

    const currentStageIndex = stageSummary?.current_stage?.index;
    if (currentStageIndex && currentStageIndex > 0) {
      const stagePrefix = `stage-${currentStageIndex}-`;
      const stageIdx = allDisplaySupplements.findIndex((s) => s.id.startsWith(stagePrefix));
      if (stageIdx >= 0) return stageIdx;
    }

    const today = toLocalDateString(new Date());
    const dateRangeIdx = allDisplaySupplements.findIndex((s) => {
      const start = s.start_date || '';
      const end = s.end_date || '9999-12-31';
      return start <= today && today <= end;
    });
    if (dateRangeIdx >= 0) return dateRangeIdx;

    const activeIdx = allDisplaySupplements.findIndex((s) => s.status === 'active');
    if (activeIdx >= 0) return activeIdx;

    return 0;
  }, [hasOrder, allDisplaySupplements, stageSummary?.current_stage?.index]);

  useEffect(() => {
    if (loading) return;

    const timer = window.setTimeout(() => {
      if (hasOrder && allDisplaySupplements.length > 0) {
        scrollToCard(initialSupplementCardIndex);
        return;
      }
      if (isDemoMode && displayCards.length > 0) {
        setCurrentCardIndex(0);
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [loading, hasOrder, isDemoMode, allDisplaySupplements.length, displayCards.length, initialSupplementCardIndex, scrollToCard]);

  const innerScroll = (
      <div ref={mainContainerRef} className="flex-1 overflow-y-auto scrollbar-hide pb-6 bg-gray-100 min-h-0 h-full">
        {loading ? (
          <LoadingState spinnerColor="text-purple-400" />
        ) : orderStatusPending ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-600">正在确认您的服务与订单状态…</p>
            <p className="text-xs text-gray-400 mt-2">请稍候，避免误显示演示补剂卡片</p>
          </div>
        ) : (
        <>
        {isDemoMode && (
          <div className="px-4 mt-2">
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800 font-medium">以下为模拟补剂示意，仅供参考</p>
              <p className="text-xs text-amber-700 mt-1">
                {hasOrder
                  ? '完成「我的配送计划」并开启摄入托管后，将展示后台真实补剂阶段与用法。'
                  : '完成订单后即可查看您的专属补剂方案。'}
              </p>
            </div>
          </div>
        )}

        {displayCards.length > 0 ? (
          <>
            {/* Informational Cards */}
            <div ref={cardSectionRef} className={`transition-all duration-200 ${isSticky ? 'sticky top-[10px] z-20 bg-gray-100 -mx-4 px-4 pb-4 shadow-sm' : ''}`}>
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-gray-200/50 to-transparent pointer-events-none z-10"></div>
                <div
                  ref={scrollContainerRef}
                  className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide pl-4 pr-0 my-4"
                  style={{ scrollSnapType: 'x mandatory' }}
                >
                  {displayCards.map((card) => (
                    <div key={card.id} className="flex-shrink-0 snap-center pr-4" style={{ width: 'calc(100% - 32px)' }}>
                    <div className="bg-white rounded-3xl overflow-hidden shadow-lg" style={{ minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
                      {/* 1px spacing at top */}
                      <div className="h-px bg-gray-100"></div>
                      {/* Card Header with Gradient Background */}
                      <div className={`bg-gradient-to-br ${card.bgColor} pt-6 px-6 pb-8 relative`}>
                        {/* Badge */}
                        <div className="mb-4">
                          <span className="text-sm text-gray-700 font-medium">{card.badge}</span>
                        </div>

                        {/* Title */}
                        <h3 className="text-3xl font-bold text-gray-900 mb-3">{card.title}</h3>

                        {/* Benefits */}
                        <p className="text-sm text-gray-700 leading-relaxed mb-4">
                          {card.benefits}
                        </p>

                        {/* Pill Image */}
                        <div className="absolute top-6 right-6">
                          <img
                            src={card.pillImageUrl}
                            alt={card.title}
                            className="w-20 h-28 object-contain"
                          />
                        </div>
                      </div>

                      {/* Card Content - Reasons */}
                      <div className="px-6 py-6 space-y-6 flex-1">
                        {card.reasons.map((reason, idx) => (
                          <div key={idx}>
                            <h4 className="text-base font-semibold text-gray-900 mb-2">
                              {reason.title}
                            </h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {reason.description}
                            </p>
                          </div>
                        ))}

                        {/* Footer Link */}
                        <button className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors mt-8">
                          <span>了解补剂详情和参考文献</span>
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>

              {/* Pagination Dots */}
              {displayCards.length > 1 && (
                <div className="flex justify-center items-center gap-2 py-4">
                  {displayCards.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToCard(index)}
                      className={`h-2 rounded-full transition-all ${
                        currentCardIndex === index
                          ? 'w-6 bg-gray-900'
                          : 'w-2 bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (hasOrder && allDisplaySupplements.length > 0) ? (
          <>
            {/* Scrollable Supplement Cards */}
            <div ref={cardSectionRef} className={`transition-all duration-200 ${isSticky ? 'sticky top-[10px] z-20 bg-gray-100 -mx-4 px-4 pb-4 shadow-sm' : ''}`}>
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-gray-200/50 to-transparent pointer-events-none z-10"></div>
                <div
                  ref={scrollContainerRef}
                  className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide pl-4 pr-0 my-4"
                  style={{ scrollSnapType: 'x mandatory' }}
                >
                  {allDisplaySupplements.map((supplement) => {
                    const isActive = supplement.status === 'active';
                    const isStageBackfill = supplement.id.startsWith('stage-');
                    return (
                      <div key={supplement.id} className="flex-shrink-0 snap-center pr-4" style={{ width: 'calc(100% - 32px)' }}>
                      <div className="relative bg-white rounded-3xl overflow-hidden pb-6 shadow-lg border-2 border-gray-100">
                        {/* 1px spacing at top */}
                        <div className="h-px bg-gray-100"></div>
                        {/* Gradient Header */}
                        <div
                          className={`bg-gradient-to-br ${
                            isActive
                              ? supplementUtils.getSupplementGradient(supplement.supplement_type)
                              : (isStageBackfill ? 'from-slate-200 to-slate-300' : 'from-gray-200 to-gray-300')
                          } pt-8 px-6 pb-6 relative`}
                          style={{ minHeight: '280px' }}
                        >
                          {/* Decorative Circle */}
                          <div className="absolute top-6 right-6">
                            <div className="w-24 h-32 bg-white/30 rounded-full shadow-lg transform rotate-12"></div>
                          </div>

                          {/* Icon Display */}
                          <div className="absolute top-8 right-8">
                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-md">
                              <img
                                src={supplement.icon_path}
                                alt={supplement.supplement_name}
                                className={`w-14 h-16 object-contain ${!isActive ? 'opacity-50' : ''}`}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<div class="w-10 h-10 ${isActive ? 'text-gray-600' : 'text-gray-400'}"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg></div>`;
                                  }
                                }}
                              />
                            </div>
                          </div>

                          {/* Supplement Info in Gradient Area */}
                          <div className="relative z-10">
                            <p className="text-sm text-gray-800 mb-3">{supplement.frequency}</p>
                            <h3 className="text-3xl font-bold text-gray-900 mb-4">{supplement.supplement_name}</h3>

                            <div className="flex items-center space-x-2 mb-4">
                              <span className={`text-xs px-2 py-1 rounded-full ${supplementUtils.getSupplementTypeColor(supplement.supplement_type)}`}>
                                {supplementUtils.getSupplementTypeLabel(supplement.supplement_type)}
                              </span>
                              <StatusBadge status={supplementUtils.getStatusBadgeType(supplement.status)} className="px-3 py-1.5 rounded-lg" />
                            </div>

                            <div className="space-y-2 text-gray-800">
                              <div className="flex items-center space-x-2 text-sm">
                                <Pill className="w-4 h-4" />
                                <span className="font-medium">用量：{supplement.dosage}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm">
                                <Clock className="w-4 h-4" />
                                <span className="font-medium">频率：{supplement.frequency}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-200 mx-6"></div>

                        {/* Details Section */}
                        <div className="px-6 pt-6 pb-4">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">补剂详情</h4>

                          {supplement.instructions && !isStageBackfill && (
                            <div className="bg-blue-50 rounded-xl p-3 mb-4">
                              <div className="flex items-start space-x-2">
                                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-700 leading-relaxed">{supplement.instructions}</p>
                              </div>
                            </div>
                          )}

                          <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>开始时间</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{formatDate(supplement.start_date)}</span>
                            </div>
                            {supplement.end_date && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Calendar className="w-4 h-4" />
                                  <span>结束时间</span>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{formatDate(supplement.end_date)}</span>
                              </div>
                            )}
                          </div>

                          {isActive && !isStageBackfill && (
                            <div className="flex space-x-3 mt-4">
                              <button className="flex-1 py-2.5 rounded-xl border-2 border-gray-900 text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors">
                                暂停使用
                              </button>
                              <button className="flex-1 py-2.5 rounded-xl bg-purple-300 text-purple-800 text-sm font-semibold hover:bg-purple-400 transition-colors">
                                续订
                              </button>
                            </div>
                          )}

                          <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center mt-4">
                            了解补剂详情和参考文献
                            <span className="ml-1">›</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              {/* Scroll Indicators */}
              {allDisplaySupplements.length > 1 && (
                <div className="flex justify-center items-center gap-2 py-4">
                  {allDisplaySupplements.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToCard(index)}
                      className={`h-2 rounded-full transition-all ${
                        currentCardIndex === index
                          ? 'w-6 bg-gray-900'
                          : 'w-2 bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

          </>
        ) : hasOrder && stageLoading ? (
          <div className="px-4">
            <EmptyState
              icon={<span className="text-4xl">⏳</span>}
              title="正在同步补剂方案"
              description="请稍候，正在加载当前阶段补剂内容"
            />
          </div>
        ) : (
          <div className="px-4">
            <EmptyState 
              icon={<Pill className="w-10 h-10 text-gray-400" />}
              title={hasOrder ? '当前暂无可展示补剂' : '暂无定制补剂方案'}
              description={hasOrder ? '补剂方案正在初始化，请稍后重试' : '完成健康评估后将获得专属补剂推荐'}
            />
          </div>
        )}

        {/* Bottom spacing */}
        <div className="h-4"></div>
        </>
        )}
      </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-gray-100 overflow-hidden">
      {innerScroll}
    </div>
  );
};

export default CustomSupplementScreen;
