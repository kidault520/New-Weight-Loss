import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BottomSheetModal } from './common/BottomSheetModal';
import { AlertDialog } from './common/AlertDialog';

interface CustomFoodAddModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (food: {
    name: string;
    calories: number;
    unit: string;
    category: string;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    icon: string;
  }) => void;
  mealType: string;
}

// 根据食物名称生成图标
const generateFoodIcon = (name: string): string => {
  const iconMap: { [key: string]: string } = {
    '米饭': '🍚', '米': '🍚',
    '面条': '🍜', '面': '🍜',
    '包子': '🥟', '包': '🥟',
    '饺子': '🥟',
    '鸡蛋': '🥚', '蛋': '🥚',
    '鸡肉': '🍗', '鸡': '🍗',
    '牛肉': '🥩', '牛': '🥩',
    '猪肉': '🥩', '猪': '🥩',
    '鱼': '🐟',
    '虾': '🦐',
    '苹果': '🍎', '果': '🍎',
    '香蕉': '🍌', '蕉': '🍌',
    '橙子': '🍊', '橙': '🍊',
    '蔬菜': '🥬', '菜': '🥬',
    '沙拉': '🥗',
    '牛奶': '🥛', '奶': '🥛',
    '咖啡': '☕', '啡': '☕',
    '茶': '🍵',
    '面包': '🍞',
    '蛋糕': '🎂', '糕': '🎂',
    '巧克力': '🍫', '巧': '🍫',
  };

  // 尝试匹配关键词
  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.includes(key)) {
      return icon;
    }
  }

  // 默认返回食物图标
  return '🍽️';
};

const CustomFoodAddModal: React.FC<CustomFoodAddModalProps> = ({
  show,
  onClose,
  onSave,
  mealType,
}) => {
  void mealType;
  const [formData, setFormData] = useState({
    name: '',
    calories: 0,
    unit: '份',
    category: '中西菜肴',
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [showNutrition, setShowNutrition] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const units = ['个', '份', '碗', '盘', '杯', '条', '根', '片', '只', '袋', '包', '克', 'g', 'kg', '千克', '公斤', '斤', '两'];
  const categories = ['主食杂粮', '肉蛋奶', '蔬果', '海鲜水产', '豆类坚果', '中西菜肴', '零食饮料'];

  const handleSave = () => {
    if (!formData.name.trim()) {
      setAlertMessage('请输入食物名称');
      setShowAlert(true);
      return;
    }

    const icon = generateFoodIcon(formData.name);

    onSave({
      name: formData.name.trim(),
      calories: formData.calories,
      unit: formData.unit,
      category: formData.category,
      protein: formData.protein,
      carbs: formData.carbs,
      fat: formData.fat,
      fiber: formData.fiber,
      icon: icon,
    });

    // 重置表单
    setFormData({
      name: '',
      calories: 0,
      unit: '份',
      category: '中西菜肴',
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });

    onClose();
  };

  return (
    <>
      <BottomSheetModal
        show={show}
        onClose={onClose}
        title="自定义添加食物"
        zIndex={95}
        maxHeight="90vh"
      >
        {/* Form */}
        <div className="space-y-4">
          {/* Icon Preview */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">{generateFoodIcon(formData.name)}</span>
            </div>
          </div>

          {/* Food Name */}
          <div>
            <label className="text-xs text-gray-700 font-medium mb-1 block">食物名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
              placeholder="输入食物名称"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="text-xs text-gray-700 font-medium mb-1 block">单位</label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
            >
              {units.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {/* Calories */}
          <div>
            <label className="text-xs text-gray-700 font-medium mb-1 block">热量 (千卡)</label>
            <input
              type="number"
              value={formData.calories || ''}
              onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
              placeholder="0"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-gray-700 font-medium mb-1 block">分类</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Nutrition Elements */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowNutrition(!showNutrition)}
              className="flex items-center justify-between w-full text-xs text-gray-700 font-medium"
            >
              <span>其它营养元素 (克)</span>
              {showNutrition ? (
                <ChevronUp className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>
            
            {showNutrition && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">蛋白质</label>
                  <input
                    type="number"
                    value={formData.protein === 0 ? '' : String(formData.protein)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '' || inputValue === '-') {
                        setFormData({ ...formData, protein: 0 });
                      } else {
                        const numValue = parseFloat(inputValue);
                        setFormData({ ...formData, protein: isNaN(numValue) ? 0 : numValue });
                      }
                    }}
                    onBlur={(e) => {
                      // 失去焦点时，如果为空则设置为0
                      if (e.target.value === '') {
                        setFormData({ ...formData, protein: 0 });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600 mb-1 block">碳水化合物</label>
                  <input
                    type="number"
                    value={formData.carbs === 0 ? '' : String(formData.carbs)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '' || inputValue === '-') {
                        setFormData({ ...formData, carbs: 0 });
                      } else {
                        const numValue = parseFloat(inputValue);
                        setFormData({ ...formData, carbs: isNaN(numValue) ? 0 : numValue });
                      }
                    }}
                    onBlur={(e) => {
                      // 失去焦点时，如果为空则设置为0
                      if (e.target.value === '') {
                        setFormData({ ...formData, carbs: 0 });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600 mb-1 block">脂肪</label>
                  <input
                    type="number"
                    value={formData.fat === 0 ? '' : String(formData.fat)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '' || inputValue === '-') {
                        setFormData({ ...formData, fat: 0 });
                      } else {
                        const numValue = parseFloat(inputValue);
                        setFormData({ ...formData, fat: isNaN(numValue) ? 0 : numValue });
                      }
                    }}
                    onBlur={(e) => {
                      // 失去焦点时，如果为空则设置为0
                      if (e.target.value === '') {
                        setFormData({ ...formData, fat: 0 });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600 mb-1 block">纤维</label>
                  <input
                    type="number"
                    value={formData.fiber === 0 ? '' : String(formData.fiber)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '' || inputValue === '-') {
                        setFormData({ ...formData, fiber: 0 });
                      } else {
                        const numValue = parseFloat(inputValue);
                        setFormData({ ...formData, fiber: isNaN(numValue) ? 0 : numValue });
                      }
                    }}
                    onBlur={(e) => {
                      // 失去焦点时，如果为空则设置为0
                      if (e.target.value === '') {
                        setFormData({ ...formData, fiber: 0 });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-purple-500 text-white py-2 rounded-xl font-medium text-sm hover:bg-purple-600 transition-colors"
          >
            保存
          </button>
        </div>
      </BottomSheetModal>

      {/* Alert Dialog */}
      <AlertDialog
        show={showAlert}
        type="warning"
        title="提示"
        message={alertMessage}
        onClose={() => setShowAlert(false)}
        confirmText="确定"
        zIndex={101}
      />
    </>
  );
};

export default CustomFoodAddModal;

