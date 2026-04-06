/**
 * AppModals - 应用模态框管理组件
 * 从App.tsx中提取的所有DetailScreen条件渲染逻辑
 * 符合架构规范：单一职责，减少App.tsx复杂度
 */
 

import React, { Suspense } from 'react';
import { DayData } from '../utils/mockData';
import { calculateStepsData } from '../services/calorieCalculations';
import WeightDetailScreen from './WeightDetailScreen';
import WaterDetailScreen from './WaterDetailScreen';
import StepsDetailScreen from './StepsDetailScreen';
import MeasurementsDetailScreen from './MeasurementsDetailScreen';
import BodyCompositionDetailScreen from './BodyCompositionDetailScreen';
import ExerciseDetailScreen from './ExerciseDetailScreen';
import HealthRingsDetailScreen from './HealthRingsDetailScreen';
import FoodDetailScreen from './FoodDetailScreen';
import NutritionDetailScreen from './NutritionDetailScreen';
import AISettingsScreen from './AISettingsScreen';
import EmotionJarScreen from './EmotionJarScreen';
import EditDashboardScreen from './EditDashboardScreen';
import ExclusivePlanHubScreen from './ExclusivePlanHubScreen';
// 导入 lazy 组件
import {
  LazyExerciseStatsDetailScreen,
  LazySleepDetailScreen,
  LazyBloodGlucoseDetailScreen,
  LazyMyHealthProfileScreen,
  LazyMyDevicesScreen,
  LazyCustomReportScreen,
} from './lazy/LazyComponents';
// 🔥 修复：导入错误边界组件，处理动态导入失败
import { LazyLoadErrorBoundary } from './common/LazyLoadErrorBoundary';
import MyOrdersScreen from './MyOrdersScreen';

// 加载占位符组件 - 使用透明背景，不遮挡首页
const LoadingPlaceholder = () => null;

interface AppModalsProps {
  // 导航状态
  navigation: {
    showWeightDetailScreen: boolean;
    showWaterDetailScreen: boolean;
    showStepsDetailScreen: boolean;
    showMeasurementsDetailScreen: boolean;
    showBodyCompositionDetailScreen: boolean;
    showExerciseDetailScreen: boolean;
    showExerciseStatsDetailScreen: boolean;
    showHealthRingsDetailScreen: boolean;
    showFoodDetailScreen: boolean;
    showAISettingsScreen: boolean;
    showEmotionJarScreen: boolean;
    showSleepDetailScreen: boolean;
    showBloodGlucoseDetailScreen: boolean;
    showEditDashboardScreen: boolean;
    showNutritionDetailScreen: boolean;
    showProfileSettingsScreen: boolean;
    showMyHealthProfileScreen: boolean;
    showReportsScreen: boolean;
    showHealthReportPage: boolean;
    showNutritionSolutionPage: boolean;
    showOrdersScreen: boolean;
    showDevicesScreen: boolean;
    showAddressManagementScreen: boolean;
    showCustomReportScreen: boolean;
    showExclusivePlanHubScreen: boolean;
    exclusivePlanHubInitialTab: 'meals' | 'supplements';
  };
  
  // 关闭处理函数
  onClose: {
    handleCloseWeightDetail: () => void;
    handleCloseWaterDetail: () => void;
    handleCloseStepsDetail: () => void;
    handleCloseMeasurementsDetail: () => void;
    handleCloseBodyCompositionDetail: () => void;
    handleCloseExerciseDetail: () => void;
    handleCloseExerciseStatsDetail: () => void;
    handleCloseHealthRingsDetail: () => void;
    handleCloseFoodDetail: () => void;
    handleCloseAISettings: () => void;
    handleCloseEmotionJar: () => void;
    handleCloseSleepDetail: () => void;
    handleCloseBloodGlucoseDetail: () => void;
    handleCloseEditDashboard: () => void;
    handleCloseNutritionDetail: () => void;
    handleCloseProfileSettings: () => void;
    handleCloseMyHealthProfile: () => void;
    handleCloseReports: () => void;
    handleCloseHealthReport: () => void;
    handleCloseNutritionSolution: () => void;
    handleCloseOrders: () => void;
    handleCloseDevices: () => void;
    handleCloseAddressManagement: () => void;
    handleCloseCustomReport: () => void;
    handleCloseExclusivePlanHub: () => void;
  };
  
  // 数据
  selectedDate: Date;
  foodDetailScreenDate: Date;
  currentDateData: DayData;
  /** 与 useDashboardData 查询键一致，供步数详情等复用缓存 */
  userId: string | null;
  /** 与首页 onboarding / 教程数据开关一致 */
  showTutorialData?: boolean;
  userWeight: number;
  nutritionRefreshKey: number;
  userDayDataOverrides: Record<string, Partial<DayData>>;
  dashboardCardOrder: string[];
  hiddenDashboardCards: string[];
  
  // 回调函数
  onSelectedDateChange: (date: Date) => void;
  onFoodDetailDateChange: (date: Date) => void;
  onUpdateDayData: (date: Date, updates: Partial<DayData>) => void;
  onUpdateCardOrder: (order: string[]) => void;
  onUpdateHiddenCards: (cards: string[]) => void;
  onOpenExerciseLibrary: () => void;
  onOpenFoodDetail: (date: Date) => void;
  onRefreshNutrition: () => void;
  onExerciseAdd: (exercises: any[], date: Date) => Promise<void>;
  onFoodAdd: (foods: any[], mealType: string, date: Date) => Promise<void>;
  onMealPlanSync: (selectedFoods: Array<{
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
  }>, date: Date, mealData?: any) => void;
  onMealIntakeComplete: (date: Date, mealType: string, mealInfo?: { calories: number; foodName: string }) => void;
  onOpenBloodGlucoseDetail: () => void;
  onRefreshDayData?: (date: Date) => void;
  onDeleteLocalExerciseRecord?: (recordId: string, date: Date) => void;
  
  // 其他
  deliveryPlanStartDate?: Date;
  deliveryPlanEndDate?: Date;
  deliveryPlanDates: Date[];
  packageDuration?: number;
  includedMeals?: string[];
  hasOrder?: boolean;
  /** 订单/执行计划查询中：无有效 hasOrder 时不要展示模拟餐食/补剂 */
  orderGateLoading?: boolean;
}

export const AppModals: React.FC<AppModalsProps> = ({
  navigation,
  onClose,
  selectedDate,
  foodDetailScreenDate,
  currentDateData,
  userId,
  showTutorialData = false,
  userWeight,
  nutritionRefreshKey,
  userDayDataOverrides,
  dashboardCardOrder,
  hiddenDashboardCards,
  onSelectedDateChange,
  onFoodDetailDateChange,
  onUpdateDayData,
  onUpdateCardOrder,
  onUpdateHiddenCards,
  onOpenExerciseLibrary,
  onOpenFoodDetail,
  onRefreshNutrition,
  onExerciseAdd,
  onFoodAdd,
  onMealPlanSync,
  onMealIntakeComplete,
  onOpenBloodGlucoseDetail,
  onRefreshDayData,
  onDeleteLocalExerciseRecord,
  deliveryPlanStartDate,
  deliveryPlanEndDate,
  deliveryPlanDates,
  packageDuration,
  includedMeals,
  hasOrder = false,
  orderGateLoading = false,
}) => {
  void onUpdateDayData;
  return (
    <>
      {/* Weight Detail Screen */}
      {navigation.showWeightDetailScreen && (
        <WeightDetailScreen 
          onClose={onClose.handleCloseWeightDetail}
          selectedDate={selectedDate}
        />
      )}

      {/* Water Detail Screen */}
      {navigation.showWaterDetailScreen && (
        <WaterDetailScreen 
          onClose={onClose.handleCloseWaterDetail}
          selectedDate={selectedDate}
        />
      )}

      {/* Steps Detail Screen */}
      {navigation.showStepsDetailScreen && (
        <StepsDetailScreen 
          onClose={onClose.handleCloseStepsDetail}
          selectedDate={selectedDate}
          userId={userId}
          showTutorialData={showTutorialData}
          userDayDataOverrides={userDayDataOverrides}
        />
      )}

      {/* Measurements Detail Screen */}
      {navigation.showMeasurementsDetailScreen && (
        <MeasurementsDetailScreen 
          onClose={onClose.handleCloseMeasurementsDetail}
          selectedDate={selectedDate}
        />
      )}

      {/* Body Composition Detail Screen */}
      {navigation.showBodyCompositionDetailScreen && (
        <BodyCompositionDetailScreen
          onClose={onClose.handleCloseBodyCompositionDetail}
          selectedDate={selectedDate}
          data={currentDateData}
        />
      )}

      {/* Exercise Detail Screen */}
      {navigation.showExerciseDetailScreen && (
        <ExerciseDetailScreen
          onClose={onClose.handleCloseExerciseDetail}
          selectedDate={selectedDate}
          onConfirmAddExercises={onExerciseAdd}
        />
      )}

      {/* Exercise Stats Detail Screen - 按需加载 */}
      {navigation.showExerciseStatsDetailScreen && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingPlaceholder />}>
            <LazyExerciseStatsDetailScreen
              onClose={onClose.handleCloseExerciseStatsDetail}
              selectedDate={selectedDate}
              exerciseData={currentDateData.exercise}
              stepsData={currentDateData.steps.current}
              exerciseRecords={currentDateData.records?.filter(r => r.type === 'exercise') || []}
              onOpenExerciseLibrary={onOpenExerciseLibrary}
              userDayDataOverrides={userDayDataOverrides}
              onDeleteLocalRecord={onDeleteLocalExerciseRecord}
            />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

      {/* Health Rings Detail Screen */}
      {navigation.showHealthRingsDetailScreen && (
        <HealthRingsDetailScreen
          onClose={onClose.handleCloseHealthRingsDetail}
          selectedDate={selectedDate}
          onOpenExerciseLibrary={onOpenExerciseLibrary}
          foodIntake={currentDateData.calories.foodIntake}
          exerciseCalories={(() => {
            const floors = currentDateData.steps.floors ?? 0;
            const stepsData = calculateStepsData(currentDateData.steps.current, floors, userWeight);
            const exerciseCalories = currentDateData.exercise?.calories || 0;
            return Math.round(exerciseCalories + stepsData.totalCalories);
          })()}
        />
      )}

      {/* Food Detail Screen */}
      {navigation.showFoodDetailScreen && (
        <FoodDetailScreen 
          onClose={onClose.handleCloseFoodDetail}
          selectedDate={foodDetailScreenDate}
          onSelectedDateChange={onFoodDetailDateChange}
          onConfirmAddFoods={onFoodAdd}
        />
      )}

      {/* AI Settings Screen */}
      {navigation.showAISettingsScreen && (
        <AISettingsScreen 
          onClose={onClose.handleCloseAISettings}
        />
      )}

      {/* Emotion Jar Screen */}
      {navigation.showEmotionJarScreen && (
        <EmotionJarScreen
          onClose={onClose.handleCloseEmotionJar}
        />
      )}

      {/* Sleep Detail Screen - 按需加载 */}
      {navigation.showSleepDetailScreen && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingPlaceholder />}>
            <LazySleepDetailScreen 
              onClose={onClose.handleCloseSleepDetail}
              selectedDate={selectedDate}
            />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

      {/* Blood Glucose Detail Screen - 按需加载 */}
      {navigation.showBloodGlucoseDetailScreen && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingPlaceholder />}>
            <LazyBloodGlucoseDetailScreen 
              onClose={onClose.handleCloseBloodGlucoseDetail}
              selectedDate={selectedDate}
            />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

      {/* Nutrition Detail Screen */}
      {navigation.showNutritionDetailScreen && (
        <NutritionDetailScreen
          onClose={onClose.handleCloseNutritionDetail}
          selectedDate={selectedDate}
          onOpenFoodDetail={onOpenFoodDetail}
          onRefresh={onRefreshNutrition}
          refreshKey={nutritionRefreshKey}
          addedFoods={currentDateData.records
            ?.filter((record) => record.type === 'food')
            .map((record) => {
              const nd = record.nutrition_data as
                | (typeof record.nutrition_data & { source?: string })
                | undefined;
              const src = nd?.source;
              const source: 'ai' | 'manual' = src === 'ai' || src === 'manual' ? src : 'manual';
              return {
                id: record.id || Math.random().toString(),
                name: nd?.name || 'Unknown Food',
                calories: nd?.calories || 0,
                quantity: nd?.quantity || 1,
                mealType: nd?.mealType || 'breakfast',
                image: nd?.image,
                icon: nd?.icon,
                protein: nd?.protein || 0,
                carbs: nd?.carbs || 0,
                fat: nd?.fat || 0,
                fiber: nd?.fiber || 0,
                source,
              };
            })}
        />
      )}

      {/* Edit Dashboard Screen */}
      <EditDashboardScreen 
        show={navigation.showEditDashboardScreen}
        onClose={onClose.handleCloseEditDashboard}
        dashboardCardOrder={dashboardCardOrder}
        hiddenDashboardCards={hiddenDashboardCards}
        onUpdateCardOrder={onUpdateCardOrder}
        onUpdateHiddenCards={onUpdateHiddenCards}
      />

      {navigation.showExclusivePlanHubScreen && (
        <ExclusivePlanHubScreen
          key={navigation.exclusivePlanHubInitialTab}
          show={navigation.showExclusivePlanHubScreen}
          onClose={onClose.handleCloseExclusivePlanHub}
          initialTab={navigation.exclusivePlanHubInitialTab}
          hasOrder={hasOrder}
          orderGateLoading={orderGateLoading}
          selectedDate={selectedDate}
          onSelectedDateChange={onSelectedDateChange}
          onMealPlanSync={onMealPlanSync}
          onOpenNutritionDetail={() => onOpenFoodDetail(selectedDate)}
          onMealIntakeComplete={onMealIntakeComplete}
          onOpenBloodGlucoseDetail={onOpenBloodGlucoseDetail}
          currentDateData={currentDateData}
          onRefreshDayData={onRefreshDayData}
          deliveryStartDate={deliveryPlanStartDate}
          deliveryEndDate={deliveryPlanEndDate}
          deliveryDates={deliveryPlanDates}
          packageDuration={packageDuration}
          includedMeals={includedMeals}
        />
      )}

      {/* Profile Settings / My Reports：由 App.tsx 单点渲染，避免与 AppModals 叠双层 */}

      {/* My Health Profile Screen - 按需加载 */}
      {navigation.showMyHealthProfileScreen && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingPlaceholder />}>
            <LazyMyHealthProfileScreen
              onClose={onClose.handleCloseMyHealthProfile}
            />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

      {/* My Orders Screen - 按需加载 */}
      {navigation.showOrdersScreen && (
        <LazyLoadErrorBoundary>
          <MyOrdersScreen onClose={onClose.handleCloseOrders} />
        </LazyLoadErrorBoundary>
      )}

      {/* My Devices Screen - 按需加载 */}
      {navigation.showDevicesScreen && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingPlaceholder />}>
            <LazyMyDevicesScreen
              onClose={onClose.handleCloseDevices}
            />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

      {/* Custom Report Screen - 按需加载 */}
      {navigation.showCustomReportScreen && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingPlaceholder />}>
            <LazyCustomReportScreen
              onClose={onClose.handleCloseCustomReport}
            />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

    </>
  );
};

