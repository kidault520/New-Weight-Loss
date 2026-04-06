import React, { useState, useCallback } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import CustomExerciseAddModal from './CustomExerciseAddModal'

interface ExerciseDetailScreenProps {
  onClose: () => void;
  selectedDate: Date;
  onConfirmAddExercises?: (exercises: Array<{
    id: string;
    name: string;
    icon: string;
    calories: number;
    duration: number;
  }>, date: Date) => void;
}

interface SelectedExercise {
  id: string;
  name: string;
  icon: string;
  calories: number;
  duration: number;
}

const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({ onClose, selectedDate: initialDate, onConfirmAddExercises }) => {
  const [selectedDate] = useState(initialDate);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(2);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [showCustomAddModal, setShowCustomAddModal] = useState(false);
  // 改为异步加载，因为需要获取用户ID
  const [customExercises, setCustomExercises] = useState<Array<SelectedExercise & { category: string }>>([]);
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // 异步加载用户相关的自定义运动
  React.useEffect(() => {
    const loadCustomExercises = async () => {
      try {
        const { getUserStorageItem } = await import('../utils/userStorage');
        const saved = await getUserStorageItem<typeof customExercises>('customExercises');
        if (saved) {
          setCustomExercises(saved);
        }
      } catch (error) {
        console.warn('Failed to load customExercises from localStorage:', error);
      }
    };
    loadCustomExercises();
  }, []);

  // 同步 customExercises 到 localStorage (用户隔离)
  React.useEffect(() => {
    if (customExercises.length > 0) {
      import('../utils/userStorage').then(({ setUserStorageItem }) => {
        setUserStorageItem('customExercises', customExercises).catch(error => {
          console.error('Failed to save customExercises to localStorage:', error);
        });
      });
    }
  }, [customExercises]);

  // 运动数据
  const exerciseCategories = [
    { name: '自定义', exercises: [] },
    { name: '收藏', exercises: [] },
    { name: '常用', exercises: [] },
    { name: '有氧', exercises: [] },
    { name: '力量', exercises: [] },
    { name: '塑形', exercises: [] },
    { name: '球类', exercises: [] },
    { name: '户外', exercises: [] },
    { name: '室内', exercises: [] },
    { name: '基础', exercises: [] },
    { name: '竞技', exercises: [] },
  ];

  const exercises = [
    {
      id: 'ex1',
      name: '户外跑步',
      icon: '🏃',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-100',
      calories: 720,
      duration: 45,
      category: '有氧'
    },
    {
      id: 'ex2',
      name: '跑步机跑步',
      icon: '🏃',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      calories: 661,
      duration: 45,
      category: '有氧'
    },
    {
      id: 'ex3',
      name: '户外行走',
      icon: '🚶',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      calories: 480,
      duration: 60,
      category: '有氧'
    },
    {
      id: 'ex4',
      name: '跑步机行走',
      icon: '🚶',
      color: 'text-red-500',
      bgColor: 'bg-red-100',
      calories: 580,
      duration: 60,
      category: '有氧'
    },
    {
      id: 'ex5',
      name: '户外骑行',
      icon: '🚴',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      calories: 511,
      duration: 45,
      category: '有氧'
    },
    {
      id: 'ex6',
      name: '动感单车',
      icon: '🚴',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      calories: 611,
      duration: 45,
      category: '有氧'
    },
    {
      id: 'ex7',
      name: '跳绳',
      icon: '🤸',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      calories: 450,
      duration: 30,
      category: '有氧'
    }
  ];

  const categoryName = exerciseCategories[selectedCategoryIndex]?.name;
  
  // 根据分类筛选运动
  let allExercises = [];
  if (categoryName === '自定义') {
    // 自定义分类：显示所有自定义运动
    allExercises = customExercises;
  } else if (categoryName === '常用') {
    // 常用分类：显示所有运动（包括自定义运动）
    allExercises = [...exercises, ...customExercises];
  } else {
    // 其他分类：显示该分类的运动 + 该分类的自定义运动
    const categoryExercises = exercises.filter(ex => ex.category === categoryName);
    const categoryCustomExercises = customExercises.filter(ex => ex.category === categoryName);
    allExercises = [...categoryExercises, ...categoryCustomExercises];
  }
  
  const displayExercises = allExercises.filter(ex => {
    const matchesSearch = searchTerm.trim() === '' || ex.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchesSearch;
  });

  const handleAddExercise = (exercise: SelectedExercise | typeof exercises[0]) => {
    const isAlreadySelected = selectedExercises.some(e => e.id === exercise.id);
    if (isAlreadySelected) {
      setSelectedExercises(selectedExercises.filter(e => e.id !== exercise.id));
    } else {
      setSelectedExercises([...selectedExercises, {
        id: exercise.id,
        name: exercise.name,
        icon: exercise.icon,
        calories: exercise.calories,
        duration: exercise.duration
      }]);
    }
  };

  const handleConfirmAdd = () => {
    if (onConfirmAddExercises && selectedExercises.length > 0) {
      onConfirmAddExercises(selectedExercises, selectedDate);
    }
    handleClose();
  };

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some(e => e.id === exerciseId);
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleCustomExerciseSave = (exercise: {
    name: string;
    duration: number;
    calories: number;
    category: string;
    icon: string;
  }) => {
    const newExercise: SelectedExercise & { category: string } = {
      id: `custom-${Date.now()}`,
      name: exercise.name,
      icon: exercise.icon,
      calories: exercise.calories,
      duration: exercise.duration,
      category: exercise.category
    };
    // 保存到自定义运动库（包含分类信息）
    setCustomExercises([...customExercises, newExercise]);
    // 自动选中新添加的自定义运动
    setSelectedExercises([...selectedExercises, {
      id: newExercise.id,
      name: newExercise.name,
      icon: newExercise.icon,
      calories: newExercise.calories,
      duration: newExercise.duration
    }]);
    setShowCustomAddModal(false);
  };

  return (
    <DragPanel show={true} onClose={handleClose} zIndex={70} mask={{ visible: false }}
      header={<DetailHeader title={"运动库"} leftAction={{ label: '返回', onClick: handleClose }} rightAction={undefined} />}
    >
        {/* Date and Count Display */}
        <div className="px-4 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-800 font-medium">{formatDate(selectedDate)}</span>
            <span className="text-sm text-gray-600 font-medium">已添加{selectedExercises.length}项运动</span>
          </div>
        </div>

        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索运动"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-2xl text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-20 bg-gray-50 flex flex-col py-4">
            {exerciseCategories.map((category, index) => (
              <button
                key={index}
                onClick={() => setSelectedCategoryIndex(index)}
                className={`py-3 px-2 text-sm text-gray-600 ${
                  index === selectedCategoryIndex ? 'bg-white border-r-2 border-blue-500 text-blue-600 font-medium' : ''
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className={`flex-1 overflow-y-auto scrollbar-hide ${selectedExercises.length > 0 ? 'pb-40' : 'pb-4'}`}>
            <div className="px-4 space-y-2">
              {categoryName === '自定义' && (
                <div className="py-4">
                  <button
                    onClick={() => setShowCustomAddModal(true)}
                    className="w-full bg-black text-white py-2 rounded-2xl font-medium text-base hover:bg-gray-800 transition-colors"
                  >
                    添加自定义运动
                  </button>
                </div>
              )}
              {displayExercises.length === 0 && (
                <div className="py-8 text-center text-gray-500">暂无匹配的运动</div>
              )}
              {displayExercises.map((exercise, index) => {
                const isSelected = isExerciseSelected(exercise.id);
                return (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl">{exercise.icon}</span>
                      <div>
                        <div className="font-medium text-gray-800">{exercise.name}</div>
                        <div className="text-sm text-orange-500">
                          {exercise.calories}kcal/{exercise.duration}分钟
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddExercise(exercise)}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                        isSelected ? 'bg-orange-500' : ''
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <Plus className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Exercises Bottom Panel */}
        {selectedExercises.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
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

        {/* Custom Exercise Add Modal */}
        <CustomExerciseAddModal
          show={showCustomAddModal}
          onClose={() => setShowCustomAddModal(false)}
          onSave={handleCustomExerciseSave}
        />
    </DragPanel>
  );
};


export default ExerciseDetailScreen
