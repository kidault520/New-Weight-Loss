import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Check, Utensils } from 'lucide-react';
import { DayData } from '../utils/mockData';

interface SyncMealFoodsModalProps {
  onClose: () => void;
  onConfirm: (selectedFoods: Array<{
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
  }>) => void;
  mealData: {
    breakfast: {
      tag: string;
      foods: Array<{
        id: string;
        name: string;
        amount: string;
        calories: number;
        icon: string;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }>;
    };
    lunch: {
      tag: string;
      foods: Array<{
        id: string;
        name: string;
        amount: string;
        calories: number;
        icon: string;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }>;
    };
    dinner: {
      tag: string;
      foods: Array<{
        id: string;
        name: string;
        amount: string;
        calories: number;
        icon: string;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }>;
    };
  } | null;
  currentDateRecords: DayData['records'];
  preselectMealType?: string | null;
}

type MealDataShape = NonNullable<SyncMealFoodsModalProps['mealData']>;
type MealSlot = keyof MealDataShape;

const SyncMealFoodsModal: React.FC<SyncMealFoodsModalProps> = ({
  onClose,
  onConfirm,
  mealData,
  currentDateRecords,
  preselectMealType
}) => {
  const [selectedFoods, setSelectedFoods] = useState<Set<string>>(new Set());
  const [selectAllStates, setSelectAllStates] = useState({
    breakfast: true,
    lunch: true,
    dinner: true
  });
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive already synced food IDs from current date records
  const alreadySyncedFoodIds = useMemo(() => {
    if (!currentDateRecords) return [];
    return currentDateRecords
      .filter(record => record.type === 'food' && record.nutrition_data?.originalId)
      .map(record => record.nutrition_data!.originalId!);
  }, [currentDateRecords]);

  // Initialize with all unsynced foods selected
  React.useEffect(() => {
    if (!mealData) return;
    
    const unsyncedFoodIds = new Set<string>();
    const mealSelectStates = { breakfast: false, lunch: false, dinner: false };
    
    Object.entries(mealData).forEach(([mealType, meal]) => {
      const unsyncedFoodsInMeal = meal.foods.filter(food => !alreadySyncedFoodIds.includes(food.id));
      
      // If this meal type should be preselected, select all its unsynced foods
      if (preselectMealType === mealType) {
        unsyncedFoodsInMeal.forEach(food => unsyncedFoodIds.add(food.id));
        mealSelectStates[mealType as keyof typeof mealSelectStates] = unsyncedFoodsInMeal.length > 0;
      } else {
        mealSelectStates[mealType as keyof typeof mealSelectStates] = false;
      }
    });
    
    setSelectedFoods(unsyncedFoodIds);
    setSelectAllStates(mealSelectStates);
  }, [mealData, alreadySyncedFoodIds, preselectMealType]);

  // Component mount animation
  React.useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // Handle drag start
  const handleStart = useCallback((clientY: number) => {
    setIsDragging(true);
    setStartY(clientY);
    if (containerRef.current) {
      containerRef.current.style.transition = 'none';
    }
  }, []);

  // Handle drag move
  const handleMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    
    const deltaY = clientY - startY;
    const newTranslateY = Math.max(0, deltaY);
    setTranslateY(newTranslateY);
  }, [isDragging, startY]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 500);
  }, [onClose]);

  // Handle drag end
  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.3s ease-out';
    }

    if (translateY > 100) {
      handleClose();
    } else {
      setTranslateY(0);
    }
  }, [isDragging, translateY, handleClose]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientY);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientY);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientY);
    }
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Add/remove event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const toggleFoodSelection = (foodId: string) => {
    if (!mealData) return;
    // Don't allow selection of already synced foods
    if (alreadySyncedFoodIds.includes(foodId)) {
      return;
    }
    
    const newSelected = new Set(selectedFoods);
    if (newSelected.has(foodId)) {
      newSelected.delete(foodId);
    } else {
      newSelected.add(foodId);
    }
    setSelectedFoods(newSelected);

    // Update select all states
    const prefix = foodId.split('-')[0];
    if (prefix !== 'breakfast' && prefix !== 'lunch' && prefix !== 'dinner') return;
    const mealType = prefix as MealSlot;
    const unsyncedMealFoodIds = mealData[mealType].foods
      .filter((food: MealDataShape[MealSlot]['foods'][number]) => !alreadySyncedFoodIds.includes(food.id))
      .map((food: MealDataShape[MealSlot]['foods'][number]) => food.id);
    const allUnsyncedMealFoodsSelected = unsyncedMealFoodIds.length > 0 && unsyncedMealFoodIds.every((id: string) => newSelected.has(id));
    
    setSelectAllStates(prev => ({
      ...prev,
      [mealType]: allUnsyncedMealFoodsSelected
    }));
  };

  const toggleSelectAll = (mealType: MealSlot) => {
    if (!mealData) return;
    
    const meal = mealData[mealType];
    const unsyncedFoodsInMeal = meal.foods.filter((food: MealDataShape[MealSlot]['foods'][number]) => !alreadySyncedFoodIds.includes(food.id));
    
    // Don't allow toggling if all foods in this meal are already synced
    if (unsyncedFoodsInMeal.length === 0) {
      return;
    }
    
    const newSelected = new Set(selectedFoods);
    const unsyncedMealFoodIds = unsyncedFoodsInMeal.map((food: MealDataShape[MealSlot]['foods'][number]) => food.id);
    
    if (selectAllStates[mealType]) {
      // Deselect all unsynced foods in this meal
      unsyncedMealFoodIds.forEach((id: string) => newSelected.delete(id));
    } else {
      // Select all unsynced foods in this meal
      unsyncedMealFoodIds.forEach((id: string) => newSelected.add(id));
    }
    
    setSelectedFoods(newSelected);
    setSelectAllStates(prev => ({
      ...prev,
      [mealType]: !prev[mealType]
    }));
  };

  const handleConfirm = () => {
    if (!mealData) return;
    
    const safeSyncedIds = Array.isArray(alreadySyncedFoodIds) ? alreadySyncedFoodIds : [];
    
    const selectedFoodsList: Array<{
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
    }> = [];

    Object.entries(mealData).forEach(([_mealType, meal]) => {
      meal.foods.forEach((food) => {
        if (selectedFoods.has(food.id) && !safeSyncedIds.includes(food.id)) {
          selectedFoodsList.push({
            id: `sync-${Date.now()}-${food.id}`,
            name: food.name,
            calories: food.calories,
            quantity: 1,
            mealType: meal.tag,
            icon: food.icon,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: food.fiber,
            originalId: food.id
          });
        }
      });
    });

    onConfirm(selectedFoodsList);
  };

  const mealTypeMap = {
    breakfast: { name: '早餐', color: 'bg-green-500', timeRange: '7:00-9:00' },
    lunch: { name: '午餐', color: 'bg-orange-500', timeRange: '11:00-13:00' },
    dinner: { name: '晚餐', color: 'bg-purple-500', timeRange: '17:00-19:00' }
  };

  const calculateMealCalories = (mealType: MealSlot) => {
    if (!mealData) return 0;
    return mealData[mealType].foods.reduce(
      (sum: number, food: MealDataShape[MealSlot]['foods'][number]) => sum + food.calories,
      0
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-center items-start pt-2.5">
      <div
        ref={containerRef}
        className={`w-full max-w-sm bg-gray-100 rounded-t-3xl flex flex-col h-full transition-transform duration-500 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={isDragging ? {
          transform: `translateY(${translateY}px)`,
          transitionProperty: 'none'
        } : {}}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-4 py-3 text-center bg-gray-100">
          <h1 className="text-lg font-bold text-gray-800 mb-1">
            {selectedFoods.size > 0 ? `已选择 ${selectedFoods.size} 项食物` : '选择想要同步的食物'}
          </h1>
          <p className="text-sm text-gray-500">每个食物当天仅可以记录一次</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-24">
          {!mealData ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">暂无餐食数据</p>
            </div>
          ) : (
          <>
            {Object.entries(mealData).map(([mealType, meal]) => {
            const mealInfo = mealTypeMap[mealType as keyof typeof mealTypeMap];
            const mealCalories = calculateMealCalories(mealType as MealSlot);
            
            return (
              <div key={mealType} className="mb-6">
                {/* Meal Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 ${mealInfo.color} rounded-2xl flex items-center justify-center`}>
                      <Utensils className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold text-gray-800">{mealInfo.name}</span>
                        <span className="text-sm text-gray-500">{mealInfo.timeRange}</span>
                      </div>
                      <div className="text-sm text-gray-600">{mealCalories} 千卡</div>
                    </div>
                  </div>
                  
                  {/* Select All Toggle */}
                  {(() => {
                    const safeSyncedIds = Array.isArray(alreadySyncedFoodIds) ? alreadySyncedFoodIds : [];
                    const unsyncedFoodsInMeal = meal.foods.filter(food => !safeSyncedIds.includes(food.id));
                    const isAllMealSynced = unsyncedFoodsInMeal.length === 0;
                    
                    return (
                      <button
                        onClick={() => toggleSelectAll(mealType as MealSlot)}
                        disabled={isAllMealSynced}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isAllMealSynced
                            ? 'bg-gray-300 border-gray-300 cursor-not-allowed'
                            : selectAllStates[mealType as keyof typeof selectAllStates]
                              ? 'bg-teal-500 border-teal-500'
                              : 'border-gray-300 bg-white'
                        }`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      >
                        {(selectAllStates[mealType as keyof typeof selectAllStates] || isAllMealSynced) && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                    );
                  })()}
                </div>

                {/* Food Items */}
                <div className="space-y-3">
                  {meal.foods.map((food) => {
                    const isAlreadySynced = alreadySyncedFoodIds.includes(food.id);
                    const isSelected = selectedFoods.has(food.id);
                    
                    return (
                      <div key={food.id} className={`flex items-center justify-between py-3 rounded-2xl px-4 shadow-sm ${
                        isAlreadySynced ? 'bg-gray-100' : 'bg-white'
                      }`}>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => toggleFoodSelection(food.id)}
                            disabled={isAlreadySynced}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isAlreadySynced
                                ? 'bg-gray-300 border-gray-300 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-teal-500 border-teal-500'
                                  : 'border-gray-300 bg-white'
                            }`}
                          >
                            {(isSelected || isAlreadySynced) && <Check className="w-4 h-4 text-white" />}
                          </button>
                          
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            isAlreadySynced ? 'bg-gray-200' : 'bg-gray-100'
                          }`}>
                            <span className="text-xl">{food.icon}</span>
                          </div>
                          
                          <div>
                            <div className={`font-medium ${isAlreadySynced ? 'text-gray-500' : 'text-gray-800'}`}>
                              {food.name}
                            </div>
                            <div className={`text-sm ${isAlreadySynced ? 'text-gray-400' : 'text-gray-500'}`}>
                              {food.amount}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`font-bold ${isAlreadySynced ? 'text-gray-500' : 'text-gray-800'}`}>
                            {food.calories}千卡
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </>
          )}
        </div>

        {/* Bottom Button */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-100 p-4">
          <button
            onClick={handleConfirm}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="w-full bg-teal-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-teal-600 transition-colors"
          >
            确认
          </button>
          
          {/* iPhone Home Indicator */}
          <div className="flex justify-center pt-2">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncMealFoodsModal;