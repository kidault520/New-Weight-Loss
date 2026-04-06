import React, { useState } from 'react';
import { Trash2, Edit2, Utensils, Droplet, Footprints, Moon, Scale, Ruler, Smile, Activity, Gauge, Pill, Wind } from 'lucide-react';

export interface QuickEntryData {
  metricType: 'food' | 'water' | 'exercise' | 'steps' | 'weight' | 'sleep' | 'measurements' | 'emotion' | 'blood_glucose' | 'supplement' | 'breathing';
  value: number;
  unit?: string;
  date?: Date;
  notes?: string;
  // Food specific
  foodName?: string;
  calories?: number;
  mealType?: string;
  quantity?: number;
  // Exercise specific
  exerciseName?: string;
  duration?: number;
  exerciseType?: string;
  // Measurements specific
  measurementType?: string;
  // Multiple measurements support
  measurements?: {
    chest?: number;
    waist?: number;
    upperArm?: number;
    hips?: number;
    thigh?: number;
    calf?: number;
  };
  // Emotion specific
  emotionType?: string;
  intensity?: number;
  // Supplement specific
  supplementName?: string;
  dosage?: string;
  // Breathing practice
  breathingModeId?: string;
  breathingModeLabel?: string;
  breathingCycles?: number;
  breathingCompleted?: boolean;
  // Daily counter
  dailyCount?: number;
  // Status management
  isManuallyEdited?: boolean;      // 是否手动编辑过
  isSavedToDatabase?: boolean;     // 是否已保存到数据库
  dataSource?: 'ai' | 'manual';    // 数据来源
  syncedToRecords?: boolean;       // 是否已同步到健康记录
  /** 来源聊天消息 ID，用于跨表稳定关联与精确去重 */
  chatMessageId?: string;
}

interface QuickEntryCardProps {
  data: QuickEntryData;
  onConfirm: (updatedData: QuickEntryData) => void;
  onDelete: () => void;
  isConfirmed?: boolean;
}

const QuickEntryCard: React.FC<QuickEntryCardProps> = ({
  data,
  onConfirm,
  onDelete,
  isConfirmed = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<QuickEntryData>(data);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getMetricIcon = () => {
    const iconProps = { className: "w-4 h-4 text-orange-500" };
    switch (data.metricType) {
      case 'food':
        return <Utensils {...iconProps} />;
      case 'water':
        return <Droplet className="w-4 h-4 text-blue-500" />;
      case 'exercise':
        return <Activity className="w-4 h-4 text-green-500" />;
      case 'steps':
        return <Footprints className="w-4 h-4 text-purple-500" />;
      case 'weight':
        return <Scale className="w-4 h-4 text-indigo-500" />;
      case 'sleep':
        return <Moon className="w-4 h-4 text-blue-600" />;
      case 'measurements':
        return <Ruler className="w-4 h-4 text-pink-500" />;
      case 'emotion':
        return <Smile className="w-4 h-4 text-yellow-500" />;
      case 'blood_glucose':
        return <Gauge className="w-4 h-4 text-red-500" />;
      case 'supplement':
        return <Pill className="w-4 h-4 text-green-600" />;
      case 'breathing':
        return <Wind className="w-4 h-4 text-violet-500" />;
      default:
        return <Utensils {...iconProps} />;
    }
  };

  const getMetricLabel = () => {
    switch (data.metricType) {
      case 'food':
        return '饮食';
      case 'water':
        return '喝水';
      case 'exercise':
        return '运动';
      case 'steps':
        return '步数';
      case 'weight':
        return '体重';
      case 'sleep':
        return '睡眠';
      case 'measurements':
        return '围度';
      case 'emotion':
        return '心情';
      case 'blood_glucose':
        return '血糖';
      case 'supplement':
        return '补剂';
      case 'breathing':
        return '呼吸练习';
      default:
        return '记录';
    }
  };

  const getDisplayValue = () => {
    if (!isEditing) {
      switch (data.metricType) {
        case 'food': {
          const quantity = data.quantity || 1;
          const foodDisplay = data.foodName || '食物';
          const unit = data.unit || '份';

          // For weight units, display as "食物名 数量单位" (e.g., "牛肉 3斤")
          if (unit === '斤' || unit === '两' || unit === '克' || unit === 'g' || unit === 'kg' || unit === '千克' || unit === '公斤') {
            return `${foodDisplay} ${quantity}${unit}`;
          }

          // For measure word units (碗、盘、杯等), display as "数量+单位+食物名" (e.g., "2碗米饭")
          if (unit === '碗' || unit === '盘' || unit === '杯' || unit === '份' || unit === '条' || unit === '根' || unit === '片' || unit === '只' || unit === '袋' || unit === '包') {
            return quantity > 1 ? `${quantity}${unit}${foodDisplay}` : `${foodDisplay}`;
          }

          // For count units (个、块), display as "食物名×数量" (e.g., "包子×3")
          return `${foodDisplay}${quantity > 1 ? `×${quantity}` : ''}`;
        }
        case 'water':
          return `${data.value}ml`;
        case 'exercise':
          return `${data.exerciseName || '运动'} ${data.duration || 0}分钟`;
        case 'steps':
          return `${data.value}步`;
        case 'weight':
          return `${data.value}kg`;
        case 'sleep':
          return `${data.value}小时`;
        case 'measurements':
          if (data.measurements) {
            const parts: string[] = [];
            if (data.measurements.chest) parts.push(`胸围${data.measurements.chest}`);
            if (data.measurements.waist) parts.push(`腰围${data.measurements.waist}`);
            if (data.measurements.hips) parts.push(`臀围${data.measurements.hips}`);
            if (data.measurements.upperArm) parts.push(`上臂围${data.measurements.upperArm}`);
            if (data.measurements.thigh) parts.push(`大腿围${data.measurements.thigh}`);
            if (data.measurements.calf) parts.push(`小腿围${data.measurements.calf}`);
            return parts.length > 0 ? parts.join(' ') : `${data.value}cm`;
          }
          return `${data.measurementType || ''} ${data.value}cm`;
        case 'emotion': {
          const emotionNames: { [key: string]: string } = {
            'happy': '开心',
            'sad': '难过',
            'neutral': '平静',
            'excited': '兴奋',
            'tired': '疲惫',
            'worried': '担心',
            'angry': '生气'
          };
          return emotionNames[data.emotionType || ''] || '心情';
        }
        case 'blood_glucose':
          return `${data.value}mmol/L`;
        case 'supplement':
          return `${data.supplementName || '补剂'} ${data.dosage || ''}`;
        case 'breathing': {
          const sec = Math.round(Number(data.value) || 0);
          const c = data.breathingCycles ?? 0;
          const name = data.breathingModeLabel || '呼吸练习';
          return `${name} ${sec}秒 · ${c}周期`;
        }
        default:
          return `${data.value}${data.unit || ''}`;
      }
    }
    return null;
  };

  const getCalorieDisplay = () => {
    if (data.metricType === 'food' && data.calories) {
      // Calories are already calculated with quantity in the detection service
      return `+${data.calories.toFixed(0)}kcal`;
    }
    if (data.metricType === 'exercise' && data.calories) {
      return `-${data.calories.toFixed(0)}kcal`;
    }
    return null;
  };

  const getPrimaryValueDisplay = () => {
    switch (data.metricType) {
      case 'water':
        return `${data.value}ml`;
      case 'sleep':
        return `${data.value}h`;
      case 'blood_glucose':
        return `${data.value}mmol/L`;
      default:
        return null;
    }
  };

  const handleEdit = () => {
    // Initialize editedData with current measurements if available
    if (data.metricType === 'measurements' && data.measurements) {
      setEditedData({
        ...data,
        measurements: { ...data.measurements }
      });
    } else {
      setEditedData(data);
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    // Mark as manually edited and ready to save
    const updatedData = {
      ...editedData,
      isManuallyEdited: true,
      dataSource: data.dataSource || 'ai' as 'ai' | 'manual'
    };

    // For measurements, update the primary value based on the first available measurement
    if (updatedData.metricType === 'measurements' && updatedData.measurements) {
      const firstValue = updatedData.measurements.chest || 
                            updatedData.measurements.waist || 
                            updatedData.measurements.hips || 
                            updatedData.measurements.upperArm || 
                            updatedData.measurements.thigh || 
                            updatedData.measurements.calf || 
                            0;
      updatedData.value = firstValue;
    }

    onConfirm(updatedData);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  // Determine border color based on status
  const getBorderColor = () => {
    if (isConfirmed) {
      return 'border-green-300';
    }
    return 'border-purple-200';
  };

  // Determine status label
  const getStatusLabel = () => {
    if (isConfirmed) {
      return { text: '已记录', color: 'text-green-600' };
    }
    return { text: '待确认', color: 'text-gray-500' };
  };

  return (
    <>
      <div className={`w-full max-w-[400px] bg-gray-50/90 rounded-2xl shadow-sm border ${getBorderColor()} overflow-hidden`}>
        {/* Content */}
        <div className="px-4 py-2">
          {isEditing ? (
            <div className="space-y-2">
              {/* Edit Form based on metric type */}
              {data.metricType === 'food' && (
                <>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">食物名称</label>
                    <input
                      type="text"
                      value={editedData.foodName || ''}
                      onChange={(e) => setEditedData({ ...editedData, foodName: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入食物名称"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">热量 (千卡)</label>
                    <input
                      type="number"
                      value={editedData.calories || 0}
                      onChange={(e) => setEditedData({ ...editedData, calories: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">餐次</label>
                    <select
                      value={editedData.mealType || '早餐'}
                      onChange={(e) => setEditedData({ ...editedData, mealType: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                    >
                      <option value="早餐">早餐</option>
                      <option value="午餐">午餐</option>
                      <option value="晚餐">晚餐</option>
                      <option value="加餐">加餐</option>
                    </select>
                  </div>
                </>
              )}

              {data.metricType === 'water' && (
                <div>
                  <label className="text-xs text-gray-700 font-medium">饮水量 (ml)</label>
                  <input
                    type="number"
                    value={editedData.value}
                    onChange={(e) => setEditedData({ ...editedData, value: parseFloat(e.target.value) })}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                    placeholder="0"
                  />
                </div>
              )}

              {data.metricType === 'exercise' && (
                <>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">运动名称</label>
                    <input
                      type="text"
                      value={editedData.exerciseName || ''}
                      onChange={(e) => setEditedData({ ...editedData, exerciseName: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入运动名称"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">时长 (分钟)</label>
                    <input
                      type="number"
                      value={editedData.duration || 0}
                      onChange={(e) => setEditedData({ ...editedData, duration: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">消耗热量 (千卡)</label>
                    <input
                      type="number"
                      value={editedData.calories || 0}
                      onChange={(e) => setEditedData({ ...editedData, calories: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="0"
                    />
                  </div>
                </>
              )}

              {data.metricType === 'measurements' && (
                <>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">胸围 (cm)</label>
                    <input
                      type="number"
                      value={editedData.measurements?.chest || ''}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        measurements: {
                          ...editedData.measurements,
                          chest: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入胸围"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">腰围 (cm)</label>
                    <input
                      type="number"
                      value={editedData.measurements?.waist || ''}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        measurements: {
                          ...editedData.measurements,
                          waist: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入腰围"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">臀围 (cm)</label>
                    <input
                      type="number"
                      value={editedData.measurements?.hips || ''}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        measurements: {
                          ...editedData.measurements,
                          hips: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入臀围"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">上臂围 (cm)</label>
                    <input
                      type="number"
                      value={editedData.measurements?.upperArm || ''}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        measurements: {
                          ...editedData.measurements,
                          upperArm: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入上臂围"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">大腿围 (cm)</label>
                    <input
                      type="number"
                      value={editedData.measurements?.thigh || ''}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        measurements: {
                          ...editedData.measurements,
                          thigh: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入大腿围"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-medium">小腿围 (cm)</label>
                    <input
                      type="number"
                      value={editedData.measurements?.calf || ''}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        measurements: {
                          ...editedData.measurements,
                          calf: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                      placeholder="输入小腿围"
                      step="0.1"
                    />
                  </div>
                </>
              )}

              {(data.metricType === 'steps' || data.metricType === 'weight' || data.metricType === 'sleep' || data.metricType === 'blood_glucose') && (
                <div>
                  <label className="text-xs text-gray-700 font-medium">
                    {data.metricType === 'steps' && '步数'}
                    {data.metricType === 'weight' && '体重 (kg)'}
                    {data.metricType === 'sleep' && '睡眠时长 (小时)'}
                    {data.metricType === 'blood_glucose' && '血糖 (mmol/L)'}
                  </label>
                  <input
                    type="number"
                    value={editedData.value}
                    onChange={(e) => setEditedData({ ...editedData, value: parseFloat(e.target.value) })}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none"
                    placeholder="0"
                    step={data.metricType === 'weight' || data.metricType === 'blood_glucose' ? '0.1' : '1'}
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-700 font-medium">备注</label>
                <textarea
                  value={editedData.notes || ''}
                  onChange={(e) => setEditedData({ ...editedData, notes: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm bg-white rounded-lg border border-purple-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none resize-none"
                  rows={2}
                  placeholder="添加备注..."
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          ) : isConfirmed ? (
            <div>
              {/* Header with Icon, Title and Value */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start space-x-2.5">
                  <div className="bg-white rounded-xl p-1.5 shadow-sm flex-shrink-0">
                    {getMetricIcon()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 mb-0.5">
                      {getMetricLabel()}
                      {data.dailyCount && data.dailyCount >= 1 && (
                        <span className="ml-1.5 text-xs font-bold text-purple-400">+{data.dailyCount}</span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-600">{getDisplayValue()}</p>
                  </div>
                </div>
                {(getCalorieDisplay() || getPrimaryValueDisplay()) && (
                  <div className="text-right flex-shrink-0">
                    {getCalorieDisplay() && (
                      <span className="text-xl font-bold text-orange-400">
                        {getCalorieDisplay()}
                      </span>
                    )}
                    {getPrimaryValueDisplay() && (
                      <span className={`text-xl font-bold ${
                        data.metricType === 'water' ? 'text-blue-400' :
                        data.metricType === 'sleep' ? 'text-sky-500' :
                        data.metricType === 'blood_glucose' ? 'text-red-400' :
                        'text-gray-700'
                      }`}>
                        {getPrimaryValueDisplay()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with Date and Status */}
              <div className="flex items-center justify-between pt-1.5 border-t border-yellow-200/50">
                <div className="text-xs text-gray-500">
                  {formatDate(data.date || new Date())}
                </div>
                <div className={`text-xs ${getStatusLabel().color} font-medium`}>
                  {isConfirmed && '✓ '}{getStatusLabel().text}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Display Mode */}
              <div>
                {/* Header with Icon, Title, Description and Value */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start space-x-2.5">
                    <div className="bg-white rounded-xl p-1.5 shadow-sm flex-shrink-0">
                      {getMetricIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 mb-0.5">
                      {getMetricLabel()}
                      {data.dailyCount && data.dailyCount >= 1 && (
                        <span className="ml-1.5 text-xs font-bold text-purple-400">+{data.dailyCount}</span>
                      )}
                    </h3>
                      <p className="text-xs text-gray-600">{getDisplayValue()}</p>
                    </div>
                  </div>
                  {(getCalorieDisplay() || getPrimaryValueDisplay()) && (
                    <div className="text-right flex-shrink-0 ml-2">
                      {getCalorieDisplay() && (
                        <span className="text-xl font-bold text-orange-400">
                          {getCalorieDisplay()}
                        </span>
                      )}
                      {getPrimaryValueDisplay() && (
                        <span className={`text-xl font-bold ${
                          data.metricType === 'water' ? 'text-blue-400' :
                          data.metricType === 'sleep' ? 'text-sky-500' :
                          data.metricType === 'blood_glucose' ? 'text-red-400' :
                          'text-gray-700'
                        }`}>
                          {getPrimaryValueDisplay()}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {data.notes && (
                  <div className="mb-2 p-1.5 bg-white/50 rounded-lg">
                    <p className="text-xs text-gray-700">{data.notes}</p>
                  </div>
                )}

                {/* Footer with Date, Status and Actions */}
                <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-xs text-gray-500">
                        {formatDate(data.date || new Date())}
                      </div>
                      <div className={`text-xs ${getStatusLabel().color} font-medium`}>
                        {isConfirmed && '✓ '}{getStatusLabel().text}
                      </div>
                    </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleDeleteClick}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleEdit}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="编辑"
                      type="button"
                    >
                      <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation - Inline */}
      {showDeleteConfirm && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
          <p className="text-xs text-gray-700 mb-2">确定要删除这条记录吗？</p>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-2 py-1 text-xs bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirmDelete}
              className="flex-1 px-2 py-1 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      )}

    </>
  );
};

export default QuickEntryCard;
