/**
 * 降级对话框 - 处理成员降级
 */

import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, TrendingDown } from 'lucide-react';
import { Person, Rank } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { DemotionService } from '../services/demotionService';

interface DemotionDialogProps {
  orgService: OrganizationService;
  person: Person;
  targetLevel?: Rank; // 如果提供，表示是根据规则自动判断的降级
  evaluationRuleId?: string; // 触发的评估规则ID
  onConfirm: (result: Person) => void;
  onCancel: () => void;
}

const RANK_ORDER: Rank[] = ['收展员', '组经理', '部经理', '区经理'];

export const DemotionDialog: React.FC<DemotionDialogProps> = ({
  orgService,
  person,
  targetLevel,
  evaluationRuleId,
  onConfirm,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<Rank>(() => {
    // 如果提供了目标职级，使用它；否则降一级
    if (targetLevel) {
      return targetLevel;
    }
    const currentIndex = RANK_ORDER.indexOf(person.level);
    return currentIndex > 0 ? RANK_ORDER[currentIndex - 1] : person.level;
  });
  const [reason, setReason] = useState('');

  const demotionService = useMemo(() => {
    return new DemotionService(orgService);
  }, [orgService]);

  // 获取可降级的职级选项（只能降一级）
  const availableLevels = useMemo(() => {
    const currentIndex = RANK_ORDER.indexOf(person.level);
    if (currentIndex <= 0) {
      return []; // 已经是最低职级
    }
    return [RANK_ORDER[currentIndex - 1]]; // 只能降一级
  }, [person.level]);

  const handleConfirm = async () => {
    if (selectedLevel === person.level) {
      alert('请选择不同的职级');
      return;
    }

    setIsProcessing(true);
    try {
      const result = demotionService.demote(
        person.id,
        selectedLevel,
        reason || undefined,
        evaluationRuleId
      );
      
      if (result) {
        onConfirm(result);
      } else {
        alert('降级失败');
      }
    } catch (error: any) {
      alert(`降级失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isRuleTriggered = !!targetLevel && !!evaluationRuleId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                成员降级 - {person.name}
              </h3>
              {isRuleTriggered && (
                <p className="text-xs text-slate-500 mt-1">
                  根据评估规则自动判断需要降级
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 当前信息 */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">当前职级：</span>
                <span className="font-semibold text-slate-800 ml-2">{person.level}</span>
              </div>
              <div>
                <span className="text-slate-500">当前业绩：</span>
                <span className="font-semibold text-slate-800 ml-2">
                  {(person.performance / 10000).toFixed(1)}w
                </span>
              </div>
              <div>
                <span className="text-slate-500">状态：</span>
                <span className="font-semibold text-slate-800 ml-2">{person.status}</span>
              </div>
              <div>
                <span className="text-slate-500">所属队伍：</span>
                <span className="font-semibold text-slate-800 ml-2">
                  {person.teamId ? '已分配' : '未分配'}
                </span>
              </div>
            </div>
          </div>

          {/* 规则触发提示 */}
          {isRuleTriggered && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-800 mb-1">规则触发降级</h4>
                  <p className="text-sm text-amber-700">
                    该成员未满足评估规则的维持条件，系统建议降级到 <strong>{targetLevel}</strong>。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 降级目标选择 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              降级到职级 <span className="text-rose-500">*</span>
            </label>
            {isRuleTriggered ? (
              <div className="px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{selectedLevel}</span>
                  <span className="text-xs text-slate-500">(系统建议)</span>
                </div>
              </div>
            ) : (
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as Rank)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                disabled={isProcessing || availableLevels.length === 0}
              >
                {availableLevels.length === 0 ? (
                  <option value={person.level}>已是最低职级，无法降级</option>
                ) : (
                  availableLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))
                )}
              </select>
            )}
            {availableLevels.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">
                收展员是最低职级，无法再降级
              </p>
            )}
          </div>

          {/* 降级原因 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              降级原因（可选）
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入降级原因..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              disabled={isProcessing}
            />
          </div>

          {/* 警告提示 */}
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-rose-800 mb-1">降级影响</h4>
                <ul className="text-sm text-rose-700 space-y-1 list-disc list-inside">
                  <li>成员职级将从 <strong>{person.level}</strong> 降为 <strong>{selectedLevel}</strong></li>
                  <li>成员状态保持为"活跃"，仍在组织体系内</li>
                  <li>降级操作将记录到历史记录中</li>
                  {person.level === '区经理' && (
                    <li className="font-semibold">注意：区经理降级后，其队伍将需要重新任命区经理</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            disabled={isProcessing}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={isProcessing || selectedLevel === person.level || availableLevels.length === 0}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4" />
                确认降级
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};















