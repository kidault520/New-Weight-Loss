 
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { RecordSourceTag } from './common/RecordSourceTag'
import { mealPlanData } from '../utils/mockData';
import { nutritionSyncService } from '../services/nutritionSyncService';
import { SectionCard } from './common/SectionCard'
import { DateNavigator } from './common/DateNavigator'
import { useDragToClose } from '../hooks/useDragToClose'
import { useFoodRecordsQuery } from '../hooks/useFoodRecordsQuery'
import { getMealDisplayLabelForSnack } from '../utils/mealUtils'
import { getBeijingDayBoundsForInstant } from '../utils/dateUtils'

interface AddedFood {
  id: string;
  name: string;
  calories: number;
  quantity: number;
  mealType: string;
  timeLabel?: string; // 加餐展示标签：中午/晚上
  image?: string;
  icon?: string;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source?: 'ai' | 'manual'; // Add source field
  /** 仅订单/定制食谱同步写入时存在 nutrition_data.syncId，与手动「+」、AI 识别无关 */
  fromOrderMealSync?: boolean;
}

interface NutritionDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
  onOpenFoodDetail: (date: Date) => void;
  addedFoods?: AddedFood[];
  onRefresh?: () => void;
  refreshKey?: number; // External refresh key to trigger data reload
}

const NutritionDetailScreen: React.FC<NutritionDetailScreenProps> = ({
  onClose,
  selectedDate: initialDate,
  onOpenFoodDetail,
  addedFoods = [],
  onRefresh,
  refreshKey: externalRefreshKey = 0,
}) => {
  void addedFoods;
  void onRefresh;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [realTimeFoodIntake, setRealTimeFoodIntake] = useState(0);
  const [nutritionTotals, setNutritionTotals] = useState({
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0
  });
  // Use drag to close hook
  const { handleClose } = useDragToClose({ onClose, closeDelay: 500 });

  const refreshKey = externalRefreshKey;

  // 与全站一致：按北京日历日拉取 food 记录（与 nutritionSyncService / 日反馈同源）
  const dateRange = useMemo(() => {
    const { start, end } = getBeijingDayBoundsForInstant(selectedDate);
    return { start, end };
  }, [selectedDate]);

  // 使用 React Query Hook 加载数据
  const { records, refresh } = useFoodRecordsQuery(
    dateRange?.start,
    dateRange?.end
  );

  // 将数据库记录转换为 AddedFood 格式
  const foodRecordsFromDB = useMemo(() => {
    return records.map((record: any) => {
      const nutritionData = record.nutrition_data || {};
      // 🔥 修复：如果 nutrition_data 中有 syncId，说明这是套餐食物，使用 syncId 作为标识
      const isSyncFood = !!nutritionData.syncId;
      return {
        id: isSyncFood ? nutritionData.syncId : record.id, // 套餐食物使用 syncId，其他使用数据库ID
        name: nutritionData.name || '未知食物',
        calories: nutritionData.calories || 0,
        quantity: nutritionData.quantity || 1,
        mealType: nutritionData.mealType || '加餐',
        timeLabel: nutritionData.timeLabel, // 加餐展示标签：中午/晚上
        protein: nutritionData.protein || 0,
        carbs: nutritionData.carbs || 0,
        fat: nutritionData.fat || 0,
        fiber: nutritionData.fiber || 0,
        source: nutritionData.source || 'manual',
        image: nutritionData.image,
        icon: nutritionData.icon,
        fromOrderMealSync: isSyncFood,
      };
    });
  }, [records]);

  // Load real-time nutrition data
  const loadNutritionData = useCallback(async () => {
    try {
      const totals = await nutritionSyncService.getDailyNutritionTotals(selectedDate);
      const foodIntakeValue = Math.round(totals.totalCalories);

      setRealTimeFoodIntake(foodIntakeValue);
      setNutritionTotals({
        totalProtein: totals.totalProtein,
        totalCarbs: totals.totalCarbs,
        totalFat: totals.totalFat,
        totalFiber: totals.totalFiber
      });
    } catch (error) {
      console.error('❌ [NutritionDetail] Failed to load nutrition data:', error);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadNutritionData();

    // 降低刷新频率，并在页面不可见时暂停刷新，减少无效请求
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadNutritionData();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedDate, refreshKey, loadNutritionData]);

  // 🔥 修复：当 refreshKey 变化时，刷新食物记录
  useEffect(() => {
    if (refreshKey > 0) {
      refresh();
    }
  }, [refreshKey, refresh]);


  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    
    // 🔥 修复：不允许选择未来日期
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (direction === 'next' && newDate > today) {
      // 如果选择的是未来日期，不更新
      return;
    }
    
    setSelectedDate(newDate);
  };

  // 检查是否可以前进到下一日（不能选择未来日期）
  const canGoNext = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate <= today;
  }, [selectedDate]);

  const currentMealPlan = mealPlanData[1];
  // Use only database records (already filtered by selectedDate) and separate into snacks and meal plan foods
  const allFoods = [...foodRecordsFromDB];

  // Deduplicate by id (prioritize database records)
  const uniqueFoods = Array.from(
    new Map(allFoods.map(food => [food.id, food])).values()
  );

  // 两个板块：套餐（仅订单/定制食谱同步）、加餐（手动「+」、AI 识别等）
  // 套餐唯一依据：写入时带 nutrition_data.syncId（见 App handleMealPlanSync），不能用 mealType 午餐/晚餐判断（手动添加也会选午晚餐）
  const mealPlanFoods = uniqueFoods.filter(f => f.fromOrderMealSync);
  const snackFoods = uniqueFoods.filter(f => !f.fromOrderMealSync);

  const mealsByType = {
    breakfast: mealPlanFoods.filter(f => ['早餐', 'breakfast'].includes(f.mealType)),
    lunch: mealPlanFoods.filter(f => ['午餐', 'lunch'].includes(f.mealType)),
    dinner: mealPlanFoods.filter(f => ['晚餐', 'dinner'].includes(f.mealType)),
  };

  // Calculate nutrition data from real-time data
  // Use nutritionTotals from nutritionSyncService for accurate totals (already includes all foods)
  const nutritionData = {
    foodIntake: {
      current: realTimeFoodIntake,
      target: 2810 
    },
    carbs: { 
      current: nutritionTotals.totalCarbs, 
      target: 178, 
      unit: 'g' 
    },
    protein: { 
      current: nutritionTotals.totalProtein, 
      target: 120, 
      unit: 'g' 
    },
    fat: { 
      current: nutritionTotals.totalFat, 
      target: 109, 
      unit: 'g' 
    },
    fiber: { 
      current: nutritionTotals.totalFiber, 
      target: 21, 
      unit: 'g' 
    }
  };

  return (
    <DragPanel show={true} onClose={handleClose} zIndex={70} mask={{ visible: false }}
      header={<DetailHeader title={"饮食摄入"} leftAction={{ label: '返回', onClick: handleClose }} rightAction={{ label: '添加', onClick: () => onOpenFoodDetail(selectedDate) }} />}
    >
        <div className="px-4 space-y-1 flex-1 overflow-y-auto pb-4 scrollbar-hide">
          {/* Date Section */}
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium text-gray-800">今日饮食</h2>
            <DateNavigator
              label={formatDate(selectedDate)}
              onPrev={() => navigateDate('prev')}
              onNext={() => navigateDate('next')}
              disableNext={!canGoNext}
            />
          </div>

          {/* Food Intake Progress */}
          <SectionCard className="my-1">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-600">食物摄入</span>
              <span className="text-lg font-bold text-gray-800">
                {nutritionData.foodIntake.current}
                <span className="text-sm text-gray-400">/{nutritionData.foodIntake.target}</span>
                <span className="text-sm font-bold text-gray-800">kcal</span>
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full relative"
                style={{ width: `${Math.min(100, (nutritionData.foodIntake.current / nutritionData.foodIntake.target) * 100)}%` }}
              >
                <div className="absolute right-0 top-0 w-1 h-2 bg-blue-700 rounded-r-full"></div>
              </div>
            </div>
          </SectionCard>

          {/* Macronutrients Grid */}
          <SectionCard className="grid grid-cols-2 gap-4 my-1">
            {/* Carbs */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">碳水</span>
                <span className="text-lg font-bold text-gray-800">
                  {nutritionData.carbs.current}
                  <span className="text-sm text-gray-400">/{nutritionData.carbs.target}{nutritionData.carbs.unit}</span>
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-400 h-2 rounded-full relative"
                  style={{ width: `${Math.min(100, (nutritionData.carbs.current / nutritionData.carbs.target) * 100)}%` }}
                >
                  <div className="absolute right-0 top-0 w-1 h-2 bg-orange-600 rounded-r-full"></div>
                </div>
              </div>
            </div>

            {/* Protein */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">蛋白质</span>
                <span className="text-lg font-bold text-gray-800">
                  {nutritionData.protein.current}
                  <span className="text-sm text-gray-400">/{nutritionData.protein.target}{nutritionData.protein.unit}</span>
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-400 h-2 rounded-full relative"
                  style={{ width: `${Math.min(100, (nutritionData.protein.current / nutritionData.protein.target) * 100)}%` }}
                >
                  <div className="absolute right-0 top-0 w-1 h-2 bg-red-600 rounded-r-full"></div>
                </div>
              </div>
            </div>

            {/* Fat */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">脂肪</span>
                <span className="text-lg font-bold text-gray-800">
                  {nutritionData.fat.current}
                  <span className="text-sm text-gray-400">/{nutritionData.fat.target}{nutritionData.fat.unit}</span>
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-cyan-400 h-2 rounded-full relative"
                  style={{ width: `${Math.min(100, (nutritionData.fat.current / nutritionData.fat.target) * 100)}%` }}
                >
                  <div className="absolute right-0 top-0 w-1 h-2 bg-cyan-600 rounded-r-full"></div>
                </div>
              </div>
            </div>

            {/* Fiber */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">膳食纤维</span>
                <span className="text-lg font-bold text-gray-800">
                  {nutritionData.fiber.current}
                  <span className="text-sm text-gray-400">/{nutritionData.fiber.target}{nutritionData.fiber.unit}</span>
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-400 h-2 rounded-full relative"
                  style={{ width: `${Math.min(100, (nutritionData.fiber.current / nutritionData.fiber.target) * 100)}%` }}
                >
                  <div className="absolute right-0 top-0 w-1 h-2 bg-green-600 rounded-r-full"></div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* 加餐：所有非套餐记录（手动/AI 录入） */}
          <SectionCard className="my-1">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">加餐</h3>
              <span className="text-lg font-bold text-gray-800">
                {Math.round(snackFoods.reduce((sum, food) => sum + food.calories * food.quantity, 0))}kcal
              </span>
            </div>
            {snackFoods.length > 0 ? (
              <div className="space-y-3">
                {snackFoods.map((food) => (
                  <div key={food.id} className="flex items-center space-x-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      {food.image ? (
                        <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-lg">{food.icon}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span className="font-medium text-gray-800">{food.name}</span>
                        {food.quantity > 1 && (
                          <span className="text-xs text-gray-500">x{food.quantity}</span>
                        )}
                        {food.source === 'ai' && (<RecordSourceTag source={'ai'} className="relative" />)}
                        {food.source === 'manual' && (<RecordSourceTag source={'manual'} className="relative" />)}
                      </div>
                      <span className="text-sm text-gray-500">{getMealDisplayLabelForSnack(food.mealType, food.timeLabel)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-gray-800 rounded-full"></div>
                      <span className="font-bold text-gray-800">{Math.round(food.calories * food.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm">
                暂无食物记录，点击右上角 + 添加
              </div>
            )}
          </SectionCard>

          {/* 套餐：仅订单侧同步的餐次（有 syncId）；无订单或未同步则为空 */}
          <div className="space-y-4">
            <SectionCard className="my-1">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-gray-800">套餐</h3>
                <span className="text-lg font-bold text-gray-800">
                  {Math.round(mealPlanFoods.reduce((sum, food) => sum + (food.calories * food.quantity), 0))}kcal
                </span>
              </div>
              {mealPlanFoods.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(mealsByType).map(([mealType, foods]) => {
                    if (foods.length === 0) return null;
                    const mealInfo = currentMealPlan[mealType as keyof typeof currentMealPlan];
                    const totalCalories = foods.reduce((sum, food) => sum + (food.calories * food.quantity), 0);
                    
                    return (
                      <div key={mealType} className="bg-white rounded-xl p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className={`${mealInfo?.tagColor || 'bg-gray-500'} text-white px-2 py-1 rounded-lg text-xs font-medium`}>
                            {mealInfo?.tag || mealType}
                          </div>
                          <span className="text-sm text-gray-600">{Math.round(totalCalories)}kcal</span>
                        </div>
                        <div className="space-y-1">
                          {foods.flatMap((food) => {
                            const totalCal = Math.round(food.calories * food.quantity);
                            const raw = (food.name || '').replace(/^(午餐|晚餐)[:：]\s*/g, '');
                            const names = raw.split(/[、，]/).map((s: string) => s.trim()).filter(Boolean);
                            const items = names.length > 1
                              ? names.map((name: string) => ({ name, cal: Math.round(totalCal / names.length) }))
                              : [{ name: raw || food.name, cal: totalCal }];
                            return items.map((item: { name: string; cal: number }, idx: number) => (
                              <div key={`${food.id}-${idx}`} className="flex items-center justify-between py-1">
                                <span className="text-sm text-gray-800">{item.name}</span>
                                <span className="text-sm font-medium text-gray-800">{item.cal} kcal</span>
                              </div>
                            ));
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  暂无套餐记录，请前往定制食谱同步
                </div>
              )}
            </SectionCard>
          </div>

          {/* Bottom spacing */}
          <div className="h-4"></div>
        </div>
    </DragPanel>
  );
};

export default NutritionDetailScreen;
