/**
 * ExerciseRecordList - 运动记录列表组件
 * 从ExerciseStatsDetailScreen.tsx中提取的记录列表展示
 * 符合架构规范：单一职责，代码复用
 */

import React from 'react';
import { Dumbbell, Flame, Trash2, Edit2 } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { RecordSourceTag } from './RecordSourceTag';

interface ExerciseRecord {
  id: string;
  type: 'food' | 'exercise' | 'water';
  name: string;
  calories?: number;
  time: string;
  exercise_data?: {
    name: string;
    icon: string;
    calories: number;
    duration: number;
    originalId: string;
    source?: string;
  };
}

interface ExerciseRecordListProps {
  records: ExerciseRecord[];
  deletingRecordId: string | null;
  onDelete: (record: ExerciseRecord) => void;
  /** 若提供则展示编辑按钮（由调用方决定是否允许编辑该条） */
  onEdit?: (record: ExerciseRecord) => void;
  onAddExercise?: () => void;
}

export const ExerciseRecordList: React.FC<ExerciseRecordListProps> = ({
  records,
  deletingRecordId,
  onDelete,
  onEdit,
  onAddExercise,
}) => {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <Dumbbell className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm mb-4">暂无运动记录</p>
        {onAddExercise && (
          <button
            onClick={onAddExercise}
            className="px-6 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            添加运动
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {records.map((record) => {
        const exerciseData = record.exercise_data;
        if (!exerciseData) return null;

        return (
          <SectionCard
            key={record.id}
            className={`my-1 p-4 flex items-start space-x-4 transition-opacity ${
              deletingRecordId === record.id ? 'opacity-50' : ''
            }`}
          >
            {/* 左侧：哑铃图标 */}
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-7 h-7 text-gray-700" />
            </div>

            {/* 中间：项目名和卡路里分为两行；时长/时间单行不换行，避免与「今天」条目视觉不一致 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-base font-medium text-gray-800 truncate min-w-0">
                  {exerciseData.name}
                </h3>
                <div className="flex items-center space-x-1 shrink-0">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                    {exerciseData.calories} kcal
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 min-h-[1.25rem]">
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {exerciseData.duration}分钟
                </span>
                <div className="flex items-center gap-2 shrink-0 min-w-0 justify-end">
                  <span className="text-xs text-gray-400 whitespace-nowrap text-right">
                    {record.time}
                  </span>
                  {exerciseData.source === 'ai' && (<RecordSourceTag source={'ai'} className="relative shrink-0" />)}
                  {exerciseData.source === 'manual' && (<RecordSourceTag source={'manual'} className="relative shrink-0" />)}
                </div>
              </div>
            </div>
            
            {/* 右侧：编辑 / 删除 */}
            <div className="flex items-center flex-shrink-0 gap-0.5">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(record)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={deletingRecordId === record.id}
                  aria-label="编辑"
                >
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(record)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                disabled={deletingRecordId === record.id}
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
};




















