import React, { useState } from 'react';
import { BottomSheetModal } from './common/BottomSheetModal';
import { AlertDialog } from './common/AlertDialog';

interface CustomExerciseAddModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (exercise: {
    name: string;
    duration: number;
    calories: number;
    category: string;
    icon: string;
  }) => void;
}

// 根据运动名称生成图标
const generateExerciseIcon = (name: string): string => {
  const iconMap: { [key: string]: string } = {
    '跑步': '🏃', '跑': '🏃',
    '行走': '🚶', '走': '🚶', '步行': '🚶',
    '骑行': '🚴', '自行车': '🚴', '单车': '🚴',
    '游泳': '🏊', '游': '🏊',
    '跳绳': '🤸', '绳': '🤸',
    '瑜伽': '🧘', '瑜': '🧘',
    '健身': '💪', '力量': '💪', '举重': '💪',
    '篮球': '🏀', '球': '🏀',
    '足球': '⚽',
    '乒乓球': '🏓', '乒乓': '🏓',
    '羽毛球': '🏸', '羽毛': '🏸',
    '网球': '🎾',
    '爬山': '⛰️', '山': '⛰️',
    '跳舞': '💃', '舞': '💃',
    '拳击': '🥊', '拳': '🥊',
    '跆拳道': '🥋',
    '滑板': '🛹',
    '滑雪': '⛷️',
    '高尔夫': '⛳',
    '保龄球': '🎳',
    '台球': '🎱',
    '有氧': '🏃',
    '塑形': '💪',
    '户外': '🌲',
    '室内': '🏠',
  };

  // 尝试匹配关键词
  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.includes(key)) {
      return icon;
    }
  }

  // 默认返回运动图标
  return '🏃';
};

const CustomExerciseAddModal: React.FC<CustomExerciseAddModalProps> = ({
  show,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    duration: 0,
    calories: 0,
    category: '有氧',
  });
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const categories = ['自定义', '收藏', '常用', '有氧', '力量', '塑形', '球类', '户外', '室内', '基础', '竞技'];

  const handleSave = () => {
    if (!formData.name.trim()) {
      setAlertMessage('请输入项目名称');
      setShowAlert(true);
      return;
    }

    if (formData.duration <= 0) {
      setAlertMessage('请输入有效的时长');
      setShowAlert(true);
      return;
    }

    if (formData.calories <= 0) {
      setAlertMessage('请输入有效的卡路里');
      setShowAlert(true);
      return;
    }

    const icon = generateExerciseIcon(formData.name);

    onSave({
      name: formData.name.trim(),
      duration: formData.duration,
      calories: formData.calories,
      category: formData.category,
      icon: icon,
    });

    // 重置表单
    setFormData({
      name: '',
      duration: 0,
      calories: 0,
      category: '有氧',
    });

    onClose();
  };

  return (
    <>
      <BottomSheetModal
        show={show}
        onClose={onClose}
        title="添加自定义运动"
        zIndex={95}
        maxHeight="90vh"
      >
        {/* Form */}
        <div className="space-y-4">
          {/* Icon Preview */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">{generateExerciseIcon(formData.name)}</span>
            </div>
          </div>

          {/* Exercise Name */}
          <div>
            <label className="text-xs text-gray-700 font-medium mb-1 block">项目名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
              placeholder="输入运动项目名称"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs text-gray-700 font-medium mb-1 block">时长 (分钟)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
              placeholder="0"
              min="1"
            />
          </div>

          {/* Calories */}
          <div>
            <label className="text-xs text-gray-700 font-medium mb-1 block">卡路里 (kcal)</label>
            <input
              type="number"
              value={formData.calories || ''}
              onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
              placeholder="0"
              min="1"
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

export default CustomExerciseAddModal;




