 
import React, { useState, useEffect } from 'react';
import { Search, Plus, X, ChevronDown } from 'lucide-react';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import CustomFoodAddModal from './CustomFoodAddModal'
import { useDragToClose } from '../hooks/useDragToClose'

interface FoodDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
  onSelectedDateChange?: (date: Date) => void;
  initialMealType?: string;
  onConfirmAddFoods?: (foods: Array<{
    id: string;
    name: string;
    calories: number;
    unit: string;
    icon: string;
    quantity: number;
    mealType: string;
    image?: string;
  }>, mealType: string, date: Date) => void;
}

interface SelectedFood {
  id: string;
  name: string;
  calories: number;
  unit: string;
  icon: string;
  quantity: number;
  image?: string;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

const FoodDetailScreen: React.FC<FoodDetailScreenProps> = ({ onClose, selectedDate, onSelectedDateChange, initialMealType, onConfirmAddFoods }) => {
  void onSelectedDateChange;
  // 根据当前时间获取默认餐次类型
  const getMealTypeByCurrentTime = (): string => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 6 && hour < 11.5) { // 6:00 - 11:29
      return '早餐';
    } else if (hour >= 11.5 && hour < 18) { // 11:30 - 17:59
      return '午餐';
    } else if (hour >= 18 && hour <= 22) { // 18:00 - 22:00
      return '晚餐';
    } else {
      return '加餐'; // 其他时间段
    }
  };

  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(2); // Default to "常用"
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([]);
  const [currentMealType, setCurrentMealType] = useState(initialMealType || getMealTypeByCurrentTime());
  const [showCustomAddModal, setShowCustomAddModal] = useState(false);
  // 改为异步加载，因为需要获取用户ID
  const [customFoods, setCustomFoods] = useState<Array<{
    id: string;
    name: string;
    icon: string;
    calories: number;
    unit: string;
    category: string;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }>>([]);
  
  // Use drag to close hook
  const { handleClose } = useDragToClose({ onClose, closeDelay: 500 });

  // 异步加载用户相关的自定义食物
  useEffect(() => {
    const loadCustomFoods = async () => {
      try {
        const { getUserStorageItem } = await import('../utils/userStorage');
        const saved = await getUserStorageItem<typeof customFoods>('customFoods');
        if (saved) {
          setCustomFoods(saved);
        }
      } catch (error) {
        console.warn('Failed to load customFoods from localStorage:', error);
      }
    };
    loadCustomFoods();
  }, []);

  // 同步 customFoods 到 localStorage (用户隔离)
  useEffect(() => {
    if (customFoods.length > 0) {
      import('../utils/userStorage').then(({ setUserStorageItem }) => {
        setUserStorageItem('customFoods', customFoods).catch(error => {
          console.error('Failed to save customFoods to localStorage:', error);
        });
      });
    }
  }, [customFoods]);


  // Handle food selection
  const handleFoodSelect = (food: typeof foods[0] | typeof customFoods[0]) => {
    const existingIndex = selectedFoods.findIndex(f => f.id === food.id);
    
    if (existingIndex >= 0) {
      // If food already selected, increase quantity
      const updatedFoods = [...selectedFoods];
      updatedFoods[existingIndex].quantity += 1;
      setSelectedFoods(updatedFoods);
    } else {
      // Add new food with quantity 1
      const newFood: SelectedFood = {
        id: food.id,
        name: food.name,
        calories: food.calories,
        unit: food.unit || '份',
        icon: food.icon,
        quantity: 1,
        image: (food as any).image,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        fiber: food.fiber || 0
      };
      setSelectedFoods([...selectedFoods, newFood]);
    }
  };

  // Handle complete removal of a food item
  const handleFoodCompleteRemove = (foodId: string) => {
    setSelectedFoods(selectedFoods.filter(f => f.id !== foodId));
  };

  // Handle confirm add foods
  const handleConfirmAdd = () => {
    if (onConfirmAddFoods && selectedFoods.length > 0) {
      onConfirmAddFoods(
        selectedFoods.map((f) => ({
          id: f.id,
          name: f.name,
          calories: f.calories,
          unit: f.unit,
          icon: f.icon,
          quantity: f.quantity,
          mealType: currentMealType,
          image: f.image,
        })),
        currentMealType,
        selectedDate
      );
    }
    handleClose();
  };

  // Handle custom food add
  const handleCustomFoodSave = (food: {
    name: string;
    calories: number;
    unit: string;
    category: string;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    icon: string;
  }) => {
    const newFood = {
      id: `custom-${Date.now()}`,
      name: food.name,
      calories: food.calories,
      unit: food.unit,
      icon: food.icon,
      category: food.category,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber
    };
    // 保存到自定义食物库
    setCustomFoods([...customFoods, newFood]);
    // 自动选中新添加的自定义食物
    const selectedFood: SelectedFood = {
      ...newFood,
      quantity: 1
    };
    setSelectedFoods([...selectedFoods, selectedFood]);
  };

  // Calculate total calories
  const totalCalories = selectedFoods.reduce((sum, food) => sum + (food.calories * food.quantity), 0);

  // Format date
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };


  // 食物分类数据
  const foodCategories = [
    { name: '自定义', foods: [] },
    { name: '收藏', foods: [] },
    { name: '常用', foods: [] },
    { name: '库迪', foods: [] },
    { name: '瑞幸', foods: [] },
    { name: '主食杂粮', foods: [] },
    { name: '肉蛋奶', foods: [] },
    { name: '蔬果', foods: [] },
    { name: '海鲜水产', foods: [] },
    { name: '豆类坚果', foods: [] },
    { name: '中西菜肴', foods: [] },
    { name: '零食饮料', foods: [] },
  ];

  const foods = [
    {
      id: '1',
      name: '水煮蛋',
      icon: '🥚',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      calories: 71,
      unit: '千卡/个',
      image: 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=100',
      protein: 6.3,
      carbs: 0.6,
      fat: 5.0,
      fiber: 0
    },
    {
      id: '2',
      name: '蔬菜沙拉',
      icon: '🥗',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      calories: 76,
      unit: '千卡/份',
      image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=100',
      protein: 2.5,
      carbs: 8.0,
      fat: 4.2,
      fiber: 3.5
    },
    {
      id: '3',
      name: '玉米',
      icon: '🌽',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      calories: 119,
      unit: '千卡/根',
      image: 'https://images.pexels.com/photos/1268101/pexels-photo-1268101.jpeg?auto=compress&cs=tinysrgb&w=100',
      protein: 4.2,
      carbs: 25.0,
      fat: 1.2,
      fiber: 2.8
    },
    {
      id: '4',
      name: '火龙果',
      icon: '🐲',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      calories: 153.7,
      unit: '千卡/个',
      image: 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=100',
      protein: 1.8,
      carbs: 36.0,
      fat: 0.6,
      fiber: 3.0
    },
    {
      id: '5',
      name: '清蒸山药段',
      icon: '🍠',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      calories: 297.5,
      unit: '千卡/份',
      image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=100',
      protein: 4.5,
      carbs: 68.0,
      fat: 0.8,
      fiber: 4.2
    },
    {
      id: '6',
      name: '苹果',
      icon: '🍎',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      calories: 70.8,
      unit: '千卡/个',
      image: 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=100',
      protein: 0.4,
      carbs: 18.8,
      fat: 0.2,
      fiber: 2.4
    },
    {
      id: '7',
      name: '紫薯',
      icon: '🍠',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      calories: 82,
      unit: '千卡/个',
      image: 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=100',
      protein: 1.6,
      carbs: 20.0,
      fat: 0.2,
      fiber: 3.0
    }
  ];

  const mealTypes = ['早餐', '午餐', '晚餐', '加餐'];

  return (
    <div className="fixed inset-0 z-[90] flex justify-center items-start pt-2.5">
      <DragPanel show={true} onClose={handleClose} zIndex={90} mask={{ visible: false }}
        header={<DetailHeader title={"食物库"} leftAction={{ onClick: handleClose }} />}
      >
        {/* Meal Type Selector */}
        <div className="px-4 mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-800 font-medium">{formatDate(selectedDate)}</span>
              <div className="relative">
                <div className="flex items-center space-x-1 px-3 py-1 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <span className="text-sm text-gray-600 font-medium">{currentMealType}</span>
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </div>
                <select 
                  value={currentMealType}
                  onChange={(e) => setCurrentMealType(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-transparent border-none outline-none"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  {mealTypes.map((mealType) => (
                    <option key={mealType} value={mealType}>{mealType}</option>
                  ))}
                </select>
              </div>
            </div>
            <span className="text-sm text-gray-600 font-medium">已添加{selectedFoods.length}项食物</span>
          </div>
        </div>
        {/* Search Bar */}
        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索食物"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-2xl text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-20 bg-gray-50 flex flex-col py-4">
            {foodCategories.map((category, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedCategoryIndex(index);
                }}
                className={`py-3 px-2 text-sm text-gray-600 ${
                  index === selectedCategoryIndex ? 'bg-white border-r-2 border-blue-500 text-blue-600 font-medium' : ''
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className={`flex-1 overflow-y-auto scrollbar-hide ${selectedFoods.length > 0 ? 'pb-40' : 'pb-4'}`}>
            <div className="px-4 space-y-2">
              {foodCategories[selectedCategoryIndex]?.name === '自定义' && (
                <div className="py-4">
                  <button
                    onClick={() => setShowCustomAddModal(true)}
                    className="w-full bg-black text-white py-2 rounded-2xl font-medium text-base hover:bg-gray-800 transition-colors"
                  >
                    添加自定义食物
                  </button>
                </div>
              )}
              {(() => {
                const categoryName = foodCategories[selectedCategoryIndex]?.name;
                let displayFoods = [];
                
                if (categoryName === '自定义') {
                  // 自定义分类：显示所有自定义食物
                  displayFoods = customFoods;
                } else if (categoryName === '常用') {
                  // 常用分类：显示所有食物（包括自定义食物）
                  displayFoods = [...foods, ...customFoods];
                } else {
                  // 其他分类：显示该分类的食物 + 该分类的自定义食物
                  const categoryFoods = foods.filter(f => (f as any).category === categoryName);
                  const categoryCustomFoods = customFoods.filter(f => f.category === categoryName);
                  displayFoods = [...categoryFoods, ...categoryCustomFoods];
                }
                
                return displayFoods.map((food, index) => (
                  <div key={food.id || index} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <span className="text-2xl">{food.icon}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{food.name}</div>
                        <div className="text-sm text-orange-500">
                          {food.calories}{food.unit}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleFoodSelect(food as typeof foods[0])}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Plus className="w-6 h-6 text-green-500" />
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Selected Foods Bottom Panel */}
        {selectedFoods.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
            {/* Selected Foods Thumbnails */}
            <div className="px-4 py-1.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
                {selectedFoods.map((food) => (
                  <div key={food.id} className="relative flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden relative">
                      {food.image ? (
                        <img 
                          src={food.image} 
                          alt={food.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-lg">{food.icon}</span>
                        </div>
                      )}
                      {/* Remove button */}
                      <button
                        onClick={() => handleFoodCompleteRemove(food.id)}
                        className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-gray-600 rounded-full flex items-center justify-center"
                      >
                        <X className="w-2 h-2 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
                </div>
                <span className="text-sm font-bold text-orange-500 ml-2">{Math.round(totalCalories)}kcal</span>
              </div>
            </div>

            {/* Confirm Button */}
            <div className="px-2 pb-2">
              <button 
                onClick={handleConfirmAdd}
                className="w-full bg-blue-500 text-white py-2 rounded-2xl font-medium text-base hover:bg-blue-600 transition-colors"
              >
                确定添加
              </button>
            </div>
          </div>
        )}

      </DragPanel>

      {/* Custom Food Add Modal */}
      <CustomFoodAddModal
        show={showCustomAddModal}
        onClose={() => setShowCustomAddModal(false)}
        onSave={handleCustomFoodSave}
        mealType={currentMealType}
      />
    </div>
  );
};

export default FoodDetailScreen;
