import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DrawerScreen } from './common/DrawerScreen';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';
import { RecipeInfoHeader } from './meal/RecipeInfoHeader';
import RecipeIntroScreen from './RecipeIntroScreen';
import CustomMealPlanScreen from './CustomMealPlanScreen';
import CustomSupplementScreen from './CustomSupplementScreen';
import { DayData } from '../utils/mockData';
import { useUserProfile } from '../contexts/UserProfileContext';

type TabKey = 'meals' | 'supplements';

export interface ExclusivePlanHubScreenProps {
  show: boolean;
  onClose: () => void;
  /** 打开时默认选中的 Tab（如从「定制补剂」类入口映射为 supplements） */
  initialTab?: 'meals' | 'supplements';
  hasOrder: boolean;
  /** 订单状态加载中：勿展示无订单模拟餐食 */
  orderGateLoading?: boolean;
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  onMealPlanSync: (
    selectedFoods: Array<{
      id: string;
      name: string;
      calories: number;
      quantity: number;
      mealType: string;
      icon: string;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      originalId: string;
    }>,
    date: Date,
    mealData?: unknown
  ) => void;
  onOpenNutritionDetail: () => void;
  onMealIntakeComplete: (date: Date, mealType: string, mealInfo?: { calories: number; foodName: string }) => void;
  onOpenBloodGlucoseDetail: () => void;
  currentDateData: DayData;
  onRefreshDayData?: (date: Date) => void;
  deliveryStartDate?: Date;
  deliveryEndDate?: Date;
  deliveryDates?: Date[];
  packageDuration?: number;
  includedMeals?: string[];
}

/**
 * 我的专属方案：唯一入口的完整页（Drawer + Tab），内嵌餐食排期与补剂列表；不再提供单独的「定制食谱/定制补剂」全屏页。
 */
const ExclusivePlanHubScreen: React.FC<ExclusivePlanHubScreenProps> = ({
  show,
  onClose,
  initialTab = 'meals',
  hasOrder,
  orderGateLoading = false,
  selectedDate,
  onSelectedDateChange,
  onMealPlanSync,
  onOpenNutritionDetail,
  onMealIntakeComplete,
  onOpenBloodGlucoseDetail,
  currentDateData,
  onRefreshDayData,
  deliveryStartDate,
  deliveryEndDate,
  deliveryDates,
  packageDuration,
  includedMeals,
}) => {
  const { intakePlanActive, mealPlanConfig } = useUserProfile();
  const simulatePreActivation = hasOrder && !intakePlanActive;
  /** 未开启托管时顶栏「起止日」与套餐天数仅作示意，与下方 7 日模拟排期一致 */
  const [demoPlanAnchor] = useState(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    return s;
  });
  const demoPlanDuration = Math.max(1, packageDuration || 7);
  const demoEndAnchor = useMemo(() => {
    const e = new Date(demoPlanAnchor);
    e.setDate(e.getDate() + demoPlanDuration - 1);
    return e;
  }, [demoPlanAnchor, demoPlanDuration]);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [showRecipeIntro, setShowRecipeIntro] = useState(false);
  const [showSupplementIntro, setShowSupplementIntro] = useState(false);
  const mealsScrollRef = useRef<HTMLDivElement>(null);
  /** 点选日历前记录的纵向 scrollTop；不在 layout 里清空，交给 effect 延迟写回后释放 */
  const mealsHubScrollLockYRef = useRef<number | null>(null);

  useEffect(() => {
    if (show) setTab(initialTab);
  }, [show, initialTab]);

  const captureMealsScrollY = useCallback(() => {
    const root = mealsScrollRef.current;
    mealsHubScrollLockYRef.current = root != null ? root.scrollTop : null;
  }, []);

  const handleMealsDateChange = useCallback(
    (date: Date) => {
      captureMealsScrollY();
      onSelectedDateChange(date);
    },
    [captureMealsScrollY, onSelectedDateChange],
  );

  /** 日历格用 div 后仍有个别 WebView 会晚一拍改 scrollTop，layout + 多段延迟一起压回去 */
  useLayoutEffect(() => {
    if (tab !== 'meals') return;
    const y = mealsHubScrollLockYRef.current;
    if (y == null || y < 0) return;
    const restore = () => {
      const root = mealsScrollRef.current;
      if (root != null) root.scrollTop = y;
    };
    restore();
    requestAnimationFrame(restore);
    requestAnimationFrame(() => requestAnimationFrame(restore));
  }, [selectedDate, tab]);

  useEffect(() => {
    if (tab !== 'meals') return;
    const y = mealsHubScrollLockYRef.current;
    if (y == null || y < 0) return;
    const restore = () => {
      const root = mealsScrollRef.current;
      if (root != null) root.scrollTop = y;
    };
    const delays = [0, 24, 80, 160, 320, 560];
    const ids = delays.map((d) => setTimeout(restore, d));
    const release = setTimeout(() => {
      mealsHubScrollLockYRef.current = null;
    }, 720);
    return () => {
      ids.forEach(clearTimeout);
      clearTimeout(release);
    };
  }, [selectedDate, tab]);

  const durationDays = useMemo(() => {
    if (simulatePreActivation) return demoPlanDuration;
    if (!intakePlanActive) return 0;
    if (deliveryDates && deliveryDates.length > 0) return deliveryDates.length;
    if (deliveryStartDate && deliveryEndDate) {
      const a = new Date(deliveryStartDate);
      const b = new Date(deliveryEndDate);
      a.setHours(0, 0, 0, 0);
      b.setHours(0, 0, 0, 0);
      return Math.max(1, Math.round((b.getTime() - a.getTime()) / (86400000)) + 1);
    }
    return packageDuration || 0;
  }, [
    simulatePreActivation,
    demoPlanDuration,
    intakePlanActive,
    deliveryDates,
    deliveryStartDate,
    deliveryEndDate,
    packageDuration,
  ]);

  /** 开启后：档案起止日优先；未开启但有订单：示意起止日（今日起 demoPlanDuration 天） */
  const startForHeader = simulatePreActivation
    ? demoPlanAnchor
    : intakePlanActive
      ? mealPlanConfig?.startDate ?? deliveryStartDate
      : undefined;
  const endForHeader = simulatePreActivation
    ? demoEndAnchor
    : intakePlanActive
      ? mealPlanConfig?.endDate ?? deliveryEndDate
      : undefined;

  const headerHideDuration = !hasOrder;
  const headerHideServicePackageSummary = false;

  if (!show) return null;

  return (
    <DrawerScreen show={show} onClose={onClose} showDragHandle={false}>
      <div className="relative flex flex-col h-full bg-white overflow-hidden">
        <SecondaryPageHeader
          onClose={onClose}
          centerSlot={
            <div
              className="mx-auto w-[min(100%,240px)] shrink-0 rounded-lg border border-gray-200 bg-gray-50/90 p-0.5 shadow-inner"
              role="tablist"
              aria-label="方案类型"
            >
              <div className="flex gap-0.5">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'meals'}
                  className={`min-w-0 flex-1 rounded-md py-2.5 text-center text-xs font-medium leading-tight transition-all ${
                    tab === 'meals'
                      ? 'bg-white text-violet-700 shadow-sm ring-1 ring-gray-200/80'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  onClick={() => setTab('meals')}
                >
                  定制餐食
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'supplements'}
                  className={`min-w-0 flex-1 rounded-md py-2.5 text-center text-xs font-medium leading-tight transition-all ${
                    tab === 'supplements'
                      ? 'bg-white text-violet-700 shadow-sm ring-1 ring-gray-200/80'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  onClick={() => setTab('supplements')}
                >
                  定制补剂
                </button>
              </div>
            </div>
          }
        />

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
          {tab === 'meals' ? (
            /* 定制餐食：方案摘要与餐区同一滚动轴，向上滑可推走摘要；日期条 sticky 吸附在 Tab 栏下方 */
            <div
              ref={mealsScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide pb-4 [overflow-anchor:none] overscroll-y-contain"
              onPointerDownCapture={(e) => {
                const t = e.target as HTMLElement | null;
                if (t?.closest?.('[data-meal-plan-date-cell]')) {
                  captureMealsScrollY();
                }
              }}
            >
              <RecipeInfoHeader
                title="瑞丹维·摄入托管方案"
                duration={durationDays}
                startDate={startForHeader}
                endDate={endForHeader}
                hideDuration={headerHideDuration}
                hideServicePackageSummary={headerHideServicePackageSummary}
                onRecipeIntroClick={() => setShowRecipeIntro(true)}
                introLinkLabel="食谱介绍"
                className="!mt-0 !pt-3 !mb-0 [&_h2]:!mb-3 border-b border-gray-100/80 bg-white"
              />
              <CustomMealPlanScreen
                show
                selectedDate={selectedDate}
                onSelectedDateChange={handleMealsDateChange}
                onMealPlanSync={onMealPlanSync}
                onOpenNutritionDetail={onOpenNutritionDetail}
                onMealIntakeComplete={onMealIntakeComplete}
                onOpenBloodGlucoseDetail={onOpenBloodGlucoseDetail}
                currentDateData={currentDateData}
                onRefreshDayData={onRefreshDayData}
                deliveryStartDate={deliveryStartDate}
                deliveryEndDate={deliveryEndDate}
                deliveryDates={deliveryDates}
                packageDuration={packageDuration}
                includedMeals={includedMeals}
                hasOrder={hasOrder}
                orderGateLoading={orderGateLoading}
              />
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-gray-100/80 bg-white">
                <RecipeInfoHeader
                  title="瑞丹维·摄入托管方案"
                  duration={durationDays}
                  startDate={startForHeader}
                  endDate={endForHeader}
                  hideDuration={headerHideDuration}
                  hideServicePackageSummary={headerHideServicePackageSummary}
                  onRecipeIntroClick={() => setShowSupplementIntro(true)}
                  introLinkLabel="补剂说明"
                  className="!mt-0 !pt-3 !mb-0 [&_h2]:!mb-3"
                />
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <CustomSupplementScreen
                  hasOrder={hasOrder}
                  orderGateLoading={orderGateLoading}
                />
              </div>
            </>
          )}
        </div>

        {showRecipeIntro && (
          <RecipeIntroScreen
            onClose={() => setShowRecipeIntro(false)}
            zIndex={90}
          />
        )}
        {showSupplementIntro && (
          <RecipeIntroScreen
            title="瑞丹维·补剂说明"
            onClose={() => setShowSupplementIntro(false)}
            zIndex={90}
          >
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4">方案说明：</h2>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed text-sm">
                    补剂阶段、剂量与周期与您的服务方案同步；正文与条目后续由后台配置下发。
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed text-sm">
                    服用时请遵循顾问建议；如有不适请暂停并联系服务人员。
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">注意事项：</h2>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed text-sm">
                    孕妇、哺乳期及慢性疾病用药者，请在使用前咨询医生。
                  </p>
                </div>
              </div>
            </div>
          </RecipeIntroScreen>
        )}
      </div>
    </DrawerScreen>
  );
};

export default ExclusivePlanHubScreen;
