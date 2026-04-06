/**
 * AppRouter - 应用主路由组件
 * 从App.tsx中提取的主路由页面渲染逻辑
 * 符合架构规范：单一职责，减少App.tsx复杂度
 */

import React from 'react';
import Dashboard from './Dashboard';
import AIChatScreen from './AIChatScreen';
import MealPlan from './MealPlan';
import ProfileScreen from './ProfileScreen';
import { DayData } from '../utils/mockData';
import type { RealtimeMetricKind } from './singlepage/TopSummaryRowContext';

type ScreenType = 'dashboard' | 'ai' | 'mealplan' | 'profile';

interface AppRouterProps {
  currentScreen: ScreenType;
  selectedDate: Date;
  displayedWeekStart: Date;
  chatSelectedDate: Date | null;
  setChatSelectedDate: (date: Date | null) => void;
  currentDateData: DayData;
  dashboardCardOrder: string[];
  hiddenDashboardCards: string[];
  onSelectedDateChange: (date: Date) => void;
  onDisplayedWeekStartChange: (date: Date) => void;
  onUpdateDayData: (date: Date, updates: Partial<DayData>) => void;
  onOpenWeightDetail: () => void;
  onOpenWaterDetail: () => void;
  onOpenStepsDetail: () => void;
  onOpenMeasurementsDetail: () => void;
  onOpenExerciseDetail: () => void;
  onOpenCalorieDetail: () => void;
  onOpenBodyCompositionDetail: () => void;
  onOpenEmotionJar: () => void;
  onOpenSleepDetail: () => void;
  onOpenBloodGlucoseDetail: () => void;
  onOpenAIChat: () => void;
  onOpenAISettings: () => void;
  onOpenEditDashboard: () => void;
  onOpenNutritionDetail: () => void;
  onOpenHealthReport: () => void;
  onOpenOnboarding: () => void;
  onOpenCustomReports: () => void;
  onOpenRecipeIntro: () => void;
  onOpenDeliveryPlan: () => void;
  onOpenExclusivePlanHub: () => void;
  onOpenProfileSettings: () => void;
  onOpenMyHealthProfile: () => void;
  onOpenAddressManagement: () => void;
  onOpenOrders: () => void;
  onOpenDeliveryPlanFromProfile?: () => void;
  onOpenReports: () => void;
  onOpenDevices: () => void;
  onBackToDashboard: () => void;
  onTakePhoto?: () => void;
  /** 聊天「实时数据」四宫格：先回健康档案再延迟打开详情 */
  onRealtimeCardClick?: (kind: RealtimeMetricKind) => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({
  currentScreen,
  selectedDate,
  displayedWeekStart,
  chatSelectedDate,
  setChatSelectedDate,
  currentDateData,
  dashboardCardOrder,
  hiddenDashboardCards,
  onSelectedDateChange,
  onDisplayedWeekStartChange,
  onUpdateDayData,
  onOpenWeightDetail,
  onOpenWaterDetail,
  onOpenStepsDetail,
  onOpenMeasurementsDetail,
  onOpenExerciseDetail,
  onOpenCalorieDetail,
  onOpenBodyCompositionDetail,
  onOpenEmotionJar,
  onOpenSleepDetail,
  onOpenBloodGlucoseDetail,
  onOpenAIChat,
  onOpenAISettings,
  onOpenEditDashboard,
  onOpenNutritionDetail,
  onOpenHealthReport,
  onOpenOnboarding,
  onOpenCustomReports,
  onOpenRecipeIntro,
  onOpenDeliveryPlan,
  onOpenExclusivePlanHub,
  onOpenProfileSettings,
  onOpenMyHealthProfile,
  onOpenAddressManagement,
  onOpenOrders,
  onOpenDeliveryPlanFromProfile,
  onOpenReports,
  onOpenDevices,
  onBackToDashboard,
  onTakePhoto,
  onRealtimeCardClick,
}) => {
  const abilityBarProps = currentScreen === 'ai' ? {
    onViewDeliveryPlan: () => { /* 由 AIChatScreenContent 覆盖 */ },
    onViewMeals: () => { /* 由 AIChatScreenContent 覆盖 */ },
    onViewSupplements: () => { /* 由 AIChatScreenContent 覆盖 */ },
    onViewDailyReport: () => { /* 由 AIChatScreenContent 覆盖 */ },
    onOpenDeliveryPlanPage: () => onOpenDeliveryPlan(),
    onOpenAddressManagement,
  } : undefined;

  /** 健康档案常驻挂载（hidden 隐藏），勿使用已删除的 screenWrap 等旧 HMR 残留命名 */
  const healthArchivePane = (
    <div
      className={currentScreen === 'dashboard' ? 'min-h-0 flex-1 flex flex-col' : 'hidden'}
      aria-hidden={currentScreen !== 'dashboard'}
    >
      <Dashboard
        selectedDate={selectedDate}
        displayedWeekStart={displayedWeekStart}
        data={currentDateData}
        dashboardCardOrder={dashboardCardOrder}
        hiddenDashboardCards={hiddenDashboardCards}
        onSelectedDateChange={onSelectedDateChange}
        onDisplayedWeekStartChange={onDisplayedWeekStartChange}
        onUpdateDayData={onUpdateDayData}
        onOpenWeightDetail={onOpenWeightDetail}
        onOpenWaterDetail={onOpenWaterDetail}
        onOpenStepsDetail={onOpenStepsDetail}
        onOpenMeasurementsDetail={onOpenMeasurementsDetail}
        onOpenExerciseDetail={onOpenExerciseDetail}
        onOpenCalorieDetail={onOpenCalorieDetail}
        onOpenBodyCompositionDetail={onOpenBodyCompositionDetail}
        onOpenEmotionJar={onOpenEmotionJar}
        onOpenSleepDetail={onOpenSleepDetail}
        onOpenBloodGlucoseDetail={onOpenBloodGlucoseDetail}
        onOpenAIChat={onOpenAIChat}
        onOpenEditDashboard={onOpenEditDashboard}
        onOpenNutritionDetail={onOpenNutritionDetail}
      />
    </div>
  );

  return (
    <>
      {healthArchivePane}
      {currentScreen === 'ai' && (
        <AIChatScreen
          onOpenSettings={onOpenAISettings}
          abilityBarProps={abilityBarProps}
          showTopCards={true}
          chatSelectedDate={chatSelectedDate}
          onClearChatDate={() => setChatSelectedDate(null)}
          onTakePhoto={onTakePhoto}
          onRealtimeCardClick={onRealtimeCardClick}
        />
      )}
      {currentScreen === 'mealplan' && (
        <MealPlan
          selectedDate={selectedDate}
          onOpenReports={onOpenHealthReport}
          onOpenReassessment={onOpenOnboarding}
          onOpenCustomReports={onOpenCustomReports}
          onOpenRecipeIntro={onOpenRecipeIntro}
          onOpenDeliveryPlan={onOpenDeliveryPlan}
          onOpenExclusivePlanHub={onOpenExclusivePlanHub}
        />
      )}
      {currentScreen === 'profile' && (
        <ProfileScreen
          onClose={onBackToDashboard}
          onOpenPersonalInfo={onOpenProfileSettings}
          onOpenSettings={onOpenProfileSettings}
          onOpenMyProfile={onOpenMyHealthProfile}
          onOpenAddress={onOpenAddressManagement}
          onOpenOrders={onOpenOrders}
          onOpenDeliveryPlan={onOpenDeliveryPlanFromProfile || onOpenDeliveryPlan}
          onOpenReports={onOpenReports}
          onOpenDevices={onOpenDevices}
        />
      )}
    </>
  );
};




