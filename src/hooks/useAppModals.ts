/**
 * useAppModals - 应用Modal状态管理Hook
 * 统一管理所有DetailScreen和Modal的显示状态
 * 符合架构规范：提取状态管理逻辑，减少App.tsx复杂度
 */

import { useState, useCallback } from 'react';

export interface AppModalsState {
  // Detail Screens
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
}

export interface AppModalsActions {
  // Open handlers
  openWeightDetail: () => void;
  openWaterDetail: () => void;
  openStepsDetail: () => void;
  openMeasurementsDetail: () => void;
  openBodyCompositionDetail: () => void;
  openExerciseDetail: () => void;
  openExerciseStatsDetail: () => void;
  openHealthRingsDetail: () => void;
  openFoodDetail: () => void;
  openAISettings: () => void;
  openEmotionJar: () => void;
  openSleepDetail: () => void;
  openBloodGlucoseDetail: () => void;
  openEditDashboard: () => void;
  openNutritionDetail: () => void;
  openProfileSettings: () => void;
  openMyHealthProfile: () => void;
  openReports: () => void;
  openHealthReport: () => void;
  openNutritionSolution: () => void;
  openOrders: () => void;
  openDevices: () => void;
  openAddressManagement: () => void;
  openCustomReport: () => void;
  /** 打开专属方案；可指定默认 Tab（定制补剂原独立入口已并入此处） */
  openExclusivePlanHub: (initialTab?: 'meals' | 'supplements') => void;
  
  // Close handlers
  closeWeightDetail: () => void;
  closeWaterDetail: () => void;
  closeStepsDetail: () => void;
  closeMeasurementsDetail: () => void;
  closeBodyCompositionDetail: () => void;
  closeExerciseDetail: () => void;
  closeExerciseStatsDetail: () => void;
  closeHealthRingsDetail: () => void;
  closeFoodDetail: () => void;
  closeAISettings: () => void;
  closeEmotionJar: () => void;
  closeSleepDetail: () => void;
  closeBloodGlucoseDetail: () => void;
  closeEditDashboard: () => void;
  closeNutritionDetail: () => void;
  closeProfileSettings: () => void;
  closeMyHealthProfile: () => void;
  closeReports: () => void;
  closeHealthReport: () => void;
  closeNutritionSolution: () => void;
  closeOrders: () => void;
  closeDevices: () => void;
  closeAddressManagement: () => void;
  closeCustomReport: () => void;
  closeExclusivePlanHub: () => void;
  
  // Close all modals
  closeAllModals: () => void;
}

export function useAppModals() {
  const [modals, setModals] = useState<AppModalsState>({
    showWeightDetailScreen: false,
    showWaterDetailScreen: false,
    showStepsDetailScreen: false,
    showMeasurementsDetailScreen: false,
    showBodyCompositionDetailScreen: false,
    showExerciseDetailScreen: false,
    showExerciseStatsDetailScreen: false,
    showHealthRingsDetailScreen: false,
    showFoodDetailScreen: false,
    showAISettingsScreen: false,
    showEmotionJarScreen: false,
    showSleepDetailScreen: false,
    showBloodGlucoseDetailScreen: false,
    showEditDashboardScreen: false,
    showNutritionDetailScreen: false,
    showProfileSettingsScreen: false,
    showMyHealthProfileScreen: false,
    showReportsScreen: false,
    showHealthReportPage: false,
    showNutritionSolutionPage: false,
    showOrdersScreen: false,
    showDevicesScreen: false,
    showAddressManagementScreen: false,
    showCustomReportScreen: false,
    showExclusivePlanHubScreen: false,
    exclusivePlanHubInitialTab: 'meals',
  });

  const actions: AppModalsActions = {
    // Open handlers
    openWeightDetail: useCallback(() => setModals(prev => ({ ...prev, showWeightDetailScreen: true })), []),
    openWaterDetail: useCallback(() => setModals(prev => ({ ...prev, showWaterDetailScreen: true })), []),
    openStepsDetail: useCallback(() => setModals(prev => ({ ...prev, showStepsDetailScreen: true })), []),
    openMeasurementsDetail: useCallback(() => setModals(prev => ({ ...prev, showMeasurementsDetailScreen: true })), []),
    openBodyCompositionDetail: useCallback(() => setModals(prev => ({ ...prev, showBodyCompositionDetailScreen: true })), []),
    openExerciseDetail: useCallback(() => setModals(prev => ({ ...prev, showExerciseDetailScreen: true })), []),
    openExerciseStatsDetail: useCallback(() => setModals(prev => ({ ...prev, showExerciseStatsDetailScreen: true })), []),
    openHealthRingsDetail: useCallback(() => setModals(prev => ({ ...prev, showHealthRingsDetailScreen: true })), []),
    openFoodDetail: useCallback(() => setModals(prev => ({ ...prev, showFoodDetailScreen: true })), []),
    openAISettings: useCallback(() => setModals(prev => ({ ...prev, showAISettingsScreen: true })), []),
    openEmotionJar: useCallback(() => setModals(prev => ({ ...prev, showEmotionJarScreen: true })), []),
    openSleepDetail: useCallback(() => setModals(prev => ({ ...prev, showSleepDetailScreen: true })), []),
    openBloodGlucoseDetail: useCallback(() => setModals(prev => ({ ...prev, showBloodGlucoseDetailScreen: true })), []),
    openEditDashboard: useCallback(() => setModals(prev => ({ ...prev, showEditDashboardScreen: true })), []),
    openNutritionDetail: useCallback(() => setModals(prev => ({ ...prev, showNutritionDetailScreen: true })), []),
    openProfileSettings: useCallback(() => setModals(prev => ({ ...prev, showProfileSettingsScreen: true })), []),
    openMyHealthProfile: useCallback(() => setModals(prev => ({ ...prev, showMyHealthProfileScreen: true })), []),
    openReports: useCallback(() => setModals(prev => ({ ...prev, showReportsScreen: true })), []),
    openHealthReport: useCallback(() => setModals(prev => ({ ...prev, showHealthReportPage: true })), []),
    openNutritionSolution: useCallback(() => setModals(prev => ({ ...prev, showNutritionSolutionPage: true })), []),
    openOrders: useCallback(() => setModals(prev => ({ ...prev, showOrdersScreen: true })), []),
    openDevices: useCallback(() => setModals(prev => ({ ...prev, showDevicesScreen: true })), []),
    openAddressManagement: useCallback(() => setModals(prev => ({ ...prev, showAddressManagementScreen: true })), []),
    openCustomReport: useCallback(() => setModals(prev => ({ ...prev, showCustomReportScreen: true })), []),
    openExclusivePlanHub: useCallback((initialTab?: 'meals' | 'supplements') =>
      setModals((prev) => ({
        ...prev,
        showExclusivePlanHubScreen: true,
        exclusivePlanHubInitialTab: initialTab ?? 'meals',
      })), []),
    
    // Close handlers
    closeWeightDetail: useCallback(() => setModals(prev => ({ ...prev, showWeightDetailScreen: false })), []),
    closeWaterDetail: useCallback(() => setModals(prev => ({ ...prev, showWaterDetailScreen: false })), []),
    closeStepsDetail: useCallback(() => setModals(prev => ({ ...prev, showStepsDetailScreen: false })), []),
    closeMeasurementsDetail: useCallback(() => setModals(prev => ({ ...prev, showMeasurementsDetailScreen: false })), []),
    closeBodyCompositionDetail: useCallback(() => setModals(prev => ({ ...prev, showBodyCompositionDetailScreen: false })), []),
    closeExerciseDetail: useCallback(() => setModals(prev => ({ ...prev, showExerciseDetailScreen: false })), []),
    closeExerciseStatsDetail: useCallback(() => setModals(prev => ({ ...prev, showExerciseStatsDetailScreen: false })), []),
    closeHealthRingsDetail: useCallback(() => setModals(prev => ({ ...prev, showHealthRingsDetailScreen: false })), []),
    closeFoodDetail: useCallback(() => setModals(prev => ({ ...prev, showFoodDetailScreen: false })), []),
    closeAISettings: useCallback(() => setModals(prev => ({ ...prev, showAISettingsScreen: false })), []),
    closeEmotionJar: useCallback(() => setModals(prev => ({ ...prev, showEmotionJarScreen: false })), []),
    closeSleepDetail: useCallback(() => setModals(prev => ({ ...prev, showSleepDetailScreen: false })), []),
    closeBloodGlucoseDetail: useCallback(() => setModals(prev => ({ ...prev, showBloodGlucoseDetailScreen: false })), []),
    closeEditDashboard: useCallback(() => setModals(prev => ({ ...prev, showEditDashboardScreen: false })), []),
    closeNutritionDetail: useCallback(() => setModals(prev => ({ ...prev, showNutritionDetailScreen: false })), []),
    closeProfileSettings: useCallback(() => setModals(prev => ({ ...prev, showProfileSettingsScreen: false })), []),
    closeMyHealthProfile: useCallback(() => setModals(prev => ({ ...prev, showMyHealthProfileScreen: false })), []),
    closeReports: useCallback(() => setModals(prev => ({ ...prev, showReportsScreen: false })), []),
    closeHealthReport: useCallback(() => setModals(prev => ({ ...prev, showHealthReportPage: false })), []),
    closeNutritionSolution: useCallback(() => setModals(prev => ({ ...prev, showNutritionSolutionPage: false })), []),
    closeOrders: useCallback(() => setModals(prev => ({ ...prev, showOrdersScreen: false })), []),
    closeDevices: useCallback(() => setModals(prev => ({ ...prev, showDevicesScreen: false })), []),
    closeAddressManagement: useCallback(() => setModals(prev => ({ ...prev, showAddressManagementScreen: false })), []),
    closeCustomReport: useCallback(() => setModals(prev => ({ ...prev, showCustomReportScreen: false })), []),
    closeExclusivePlanHub: useCallback(() => setModals(prev => ({ ...prev, showExclusivePlanHubScreen: false })), []),
    
    // Close all modals
    closeAllModals: useCallback(() => {
      setModals({
        showWeightDetailScreen: false,
        showWaterDetailScreen: false,
        showStepsDetailScreen: false,
        showMeasurementsDetailScreen: false,
        showBodyCompositionDetailScreen: false,
        showExerciseDetailScreen: false,
        showExerciseStatsDetailScreen: false,
        showHealthRingsDetailScreen: false,
        showFoodDetailScreen: false,
        showAISettingsScreen: false,
        showEmotionJarScreen: false,
        showSleepDetailScreen: false,
        showBloodGlucoseDetailScreen: false,
        showEditDashboardScreen: false,
        showNutritionDetailScreen: false,
        showProfileSettingsScreen: false,
        showMyHealthProfileScreen: false,
        showReportsScreen: false,
        showHealthReportPage: false,
        showNutritionSolutionPage: false,
        showOrdersScreen: false,
        showDevicesScreen: false,
        showAddressManagementScreen: false,
        showCustomReportScreen: false,
        showExclusivePlanHubScreen: false,
        exclusivePlanHubInitialTab: 'meals',
      });
    }, []),
  };

  return {
    modals,
    ...actions,
  };
}

