import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface NutritionItem {
  name: string;
  value: string;
  color: string;
}

interface FoodItem {
  name: string;
  amount: string;
  calories: number;
  icon: string;
}

interface MealSectionCardProps {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  mealName: string;
  meal: {
    image: string;
    calories: number;
    nutrition: NutritionItem[];
    foods: FoodItem[];
  };
  status?: string;
  isExpanded?: boolean;
  onExpand?: () => void;
  onIntakeComplete?: () => void;
  isIntakeCompleted?: boolean;
  canCompleteIntake?: boolean;
  isPastDate?: boolean;
  isToday?: boolean;
  className?: string;
}

const getStatusBadgeType = (
  status: string,
  isPast: boolean = false,
  isToday: boolean = false
): 'completed' | 'in-progress' | 'not-started' | 'preparing' | 'making' | 'delivering' | 'delivered' => {
  if (isPast && status === '已完成') {
    return 'completed';
  }

  if (isToday) {
    if (status === '制作中') return 'making';
    if (status === '配送中') return 'delivering';
    if (status === '已配送完成') return 'delivered';
  }

  switch (status) {
    case '已完成':
      return 'completed';
    case '进行中':
      return 'in-progress';
    case '未开始':
      return 'not-started';
    case '准备中':
      return 'preparing';
    case '制作中':
      return 'making';
    case '配送中':
      return 'delivering';
    case '已配送完成':
      return 'delivered';
    default:
      return 'not-started';
  }
};

export const MealSectionCard: React.FC<MealSectionCardProps> = ({
  mealType: _mealType,
  mealName,
  meal,
  status = '准备中',
  isExpanded = false,
  onExpand,
  onIntakeComplete,
  isIntakeCompleted = false,
  canCompleteIntake = true,
  isPastDate = false,
  isToday = false,
  className = ''
}) => {
  const DEFAULT_VISIBLE_COUNT = 2;
  const visibleFoods = isExpanded ? meal.foods : meal.foods.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreFoods = meal.foods.length > DEFAULT_VISIBLE_COUNT;
  const isFutureDate = !isPastDate && !isToday;
  const intakeDone = !!isIntakeCompleted;
  const intakeDisabled = intakeDone || isFutureDate || !canCompleteIntake || isPastDate;

  return (
    <div className={`rounded-2xl overflow-hidden shadow-lg border-2 mb-6 bg-white border-gray-100 ${className}`}>
      <div className="px-6 py-4 border-b-2 bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-lg font-medium text-gray-700">{mealName}</div>
          </div>
          <StatusBadge
            status={getStatusBadgeType(status, isPastDate, isToday)}
            className="font-bold text-sm px-3 py-1.5 rounded-lg"
          />
        </div>
      </div>

      <div className="relative">
        <img
          src={meal.image}
          alt={mealName}
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-4 right-4 bg-black/70 rounded-xl p-3 text-white text-xs backdrop-blur-sm">
          {meal.nutrition.map((item, index) => (
            <div key={index} className="flex items-center justify-between mb-1 last:mb-0">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <span>{item.name}</span>
              </div>
              <span className="ml-4 font-medium">{item.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <span>热量</span>
            </div>
            <span className="ml-4 font-medium">{meal.calories} kcal</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {visibleFoods.length > 0 && (
          <div className="space-y-2 mb-3">
            {visibleFoods.map((food, index) => (
              <div key={index} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-xl shadow-sm">
                    {food.icon}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-800">{food.name}</div>
                    <div className="text-xs text-gray-500">{food.amount}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-800"></div>
                  <span className="font-bold text-gray-800">{food.calories}</span>
                  <span className="text-xs text-gray-500">kcal</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMoreFoods && onExpand && (
          <div className="flex justify-center">
            <button
              onClick={onExpand}
              className="flex items-center space-x-2 px-4 py-2 rounded-full transition-colors bg-gray-100 hover:bg-gray-200"
            >
              <span className="text-sm text-gray-600 font-medium">
                {isExpanded ? '收起' : `展开更多 (${meal.foods.length - DEFAULT_VISIBLE_COUNT}道菜)`}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="flex justify-between space-x-3 px-0">
            {!isFutureDate && (
              <>
                {onIntakeComplete && (
                  <button
                    onClick={onIntakeComplete}
                    disabled={intakeDisabled}
                    className={`flex-1 py-2 px-2 rounded-xl text-sm font-medium transition-colors ${
                      intakeDone
                        ? 'bg-green-50 text-green-600 cursor-default'
                        : intakeDisabled
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-200 text-blue-700 hover:bg-blue-300'
                    }`}
                  >
                    {intakeDone
                      ? '✓已摄入'
                      : intakeDisabled
                        ? '暂不可操作'
                        : '完成摄入'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
