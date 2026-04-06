/**
 * AppModals 组件测试
 */
 

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppModals } from '../AppModals';
import { DayData, generateEmptyDayData } from '../../utils/mockData';

// Mock all DetailScreen components
vi.mock('../WeightDetailScreen', () => ({
  default: () => <div data-testid="weight-detail">WeightDetailScreen</div>,
}));

vi.mock('../WaterDetailScreen', () => ({
  default: () => <div data-testid="water-detail">WaterDetailScreen</div>,
}));

vi.mock('../NutritionDetailScreen', () => ({
  default: () => <div data-testid="nutrition-detail">NutritionDetailScreen</div>,
}));

vi.mock('../ExclusivePlanHubScreen', () => ({
  default: () => <div data-testid="exclusive-plan-hub">ExclusivePlanHubScreen</div>,
}));

describe('AppModals', () => {
  const mockDayData: DayData = {
    ...generateEmptyDayData(new Date(), 65),
    weight: { current: 70, target: 65, hasRecord: true },
    water: { current: 1500, target: 2000 },
    steps: {
      current: 5000,
      target: 10000,
      hourlyData: new Array(24).fill(0),
      floors: 0,
    },
    calories: { total: 2000, foodIntake: 1500, exerciseBurned: 300, remaining: 800 },
    nutrition: {
      carbs: { current: 150, target: 200 },
      protein: { current: 100, target: 120 },
      fat: { current: 50, target: 60 },
    },
    exercise: { minutes: 30, calories: 200 },
    records: [],
  };

  const mockProps = {
    navigation: {
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
      exclusivePlanHubInitialTab: 'meals' as const,
      showDateSelectionPage: false,
      showAddDeliveryAddressPage: false,
      showMealPlanConfirmationModal: false,
      showDeliveryPlanPage: false,
    },
    onClose: {
      handleCloseWeightDetail: vi.fn(),
      handleCloseWaterDetail: vi.fn(),
      handleCloseStepsDetail: vi.fn(),
      handleCloseMeasurementsDetail: vi.fn(),
      handleCloseBodyCompositionDetail: vi.fn(),
      handleCloseExerciseDetail: vi.fn(),
      handleCloseExerciseStatsDetail: vi.fn(),
      handleCloseHealthRingsDetail: vi.fn(),
      handleCloseFoodDetail: vi.fn(),
      handleCloseAISettings: vi.fn(),
      handleCloseEmotionJar: vi.fn(),
      handleCloseSleepDetail: vi.fn(),
      handleCloseBloodGlucoseDetail: vi.fn(),
      handleCloseEditDashboard: vi.fn(),
      handleCloseNutritionDetail: vi.fn(),
      handleCloseProfileSettings: vi.fn(),
      handleCloseMyHealthProfile: vi.fn(),
      handleCloseReports: vi.fn(),
      handleCloseHealthReport: vi.fn(),
      handleCloseNutritionSolution: vi.fn(),
      handleCloseOrders: vi.fn(),
      handleCloseDevices: vi.fn(),
      handleCloseAddressManagement: vi.fn(),
      handleCloseCustomReport: vi.fn(),
      handleCloseExclusivePlanHub: vi.fn(),
      handleCloseDateSelection: vi.fn(),
      handleCloseAddDeliveryAddress: vi.fn(),
      handleCloseMealPlanConfirmation: vi.fn(),
      handleCloseDeliveryPlan: vi.fn(),
    },
    selectedDate: new Date(),
    foodDetailScreenDate: new Date(),
    currentDateData: mockDayData,
    userId: null,
    showTutorialData: false,
    userWeight: 70,
    nutritionRefreshKey: 0,
    userDayDataOverrides: {},
    dashboardCardOrder: [],
    hiddenDashboardCards: [],
    onSelectedDateChange: vi.fn(),
    onFoodDetailDateChange: vi.fn(),
    onUpdateDayData: vi.fn(),
    onUpdateCardOrder: vi.fn(),
    onUpdateHiddenCards: vi.fn(),
    onOpenExerciseLibrary: vi.fn(),
    onOpenFoodDetail: vi.fn(),
    onRefreshNutrition: vi.fn(),
    onExerciseAdd: vi.fn(),
    onFoodAdd: vi.fn(),
    onMealPlanSync: vi.fn(),
    onMealIntakeComplete: vi.fn(),
    onOpenBloodGlucoseDetail: vi.fn(),
    deliveryPlanStartDate: undefined,
    deliveryPlanEndDate: undefined,
    deliveryPlanDates: [],
    packageDuration: undefined,
    includedMeals: undefined,
    hasOrder: false,
  };

  it('should render nothing when no modals are shown', () => {
    const { container } = render(<AppModals {...mockProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render WeightDetailScreen when showWeightDetailScreen is true', () => {
    render(
      <AppModals
        {...mockProps}
        navigation={{ ...mockProps.navigation, showWeightDetailScreen: true }}
      />
    );
    expect(screen.getByTestId('weight-detail')).toBeInTheDocument();
  });

  it('should render WaterDetailScreen when showWaterDetailScreen is true', () => {
    render(
      <AppModals
        {...mockProps}
        navigation={{ ...mockProps.navigation, showWaterDetailScreen: true }}
      />
    );
    expect(screen.getByTestId('water-detail')).toBeInTheDocument();
  });

  it('should render NutritionDetailScreen when showNutritionDetailScreen is true', () => {
    render(
      <AppModals
        {...mockProps}
        navigation={{ ...mockProps.navigation, showNutritionDetailScreen: true }}
      />
    );
    expect(screen.getByTestId('nutrition-detail')).toBeInTheDocument();
  });
});




