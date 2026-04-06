/**
 * 晋升对话框 - 显示晋升条件检查和队伍创建预览
 */

import React, { useState, useMemo } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Building2 } from 'lucide-react';
import { Person, Rank, Team } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { PromotionService } from '../services/promotionService';
import { getDefaultRules } from '../utils/commissionRules';

interface PromotionDialogProps {
  orgService: OrganizationService;
  person: Person;
  targetLevel: Rank;
  onConfirm: (result: Person | { person: Person; team: Team }) => void;
  onCancel: () => void;
}

export const PromotionDialog: React.FC<PromotionDialogProps> = ({
  orgService,
  person,
  targetLevel,
  onConfirm,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const promotionService = useMemo(() => {
    return new PromotionService(orgService, getDefaultRules());
  }, [orgService]);

  // 检查晋升条件
  const checkResult = useMemo(() => {
    return promotionService.checkPromotionConditions(person.id, targetLevel);
  }, [promotionService, person.id, targetLevel]);

  const handleConfirm = async () => {
    if (!checkResult.canPromote) {
      alert('不满足晋升条件，无法晋升');
      return;
    }

    setIsProcessing(true);
    try {
      const result = promotionService.promote(person.id, targetLevel);
      if (result) {
        onConfirm(result);
      }
    } catch (error: any) {
      alert(`晋升失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const willCreateTeam = targetLevel === '区经理';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">
            晋升确认 - {person.name}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 晋升信息 */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">当前职级：</span>
                <span className="font-semibold text-slate-800 ml-2">{person.level}</span>
              </div>
              <div>
                <span className="text-slate-500">目标职级：</span>
                <span className="font-semibold text-indigo-600 ml-2">{targetLevel}</span>
              </div>
              <div>
                <span className="text-slate-500">当前业绩：</span>
                <span className="font-semibold text-slate-800 ml-2">
                  {(person.performance / 10000).toFixed(1)}w
                </span>
              </div>
              <div>
                <span className="text-slate-500">所属队伍：</span>
                <span className="font-semibold text-slate-800 ml-2">
                  {person.teamId ? '已分配' : '未分配'}
                </span>
              </div>
            </div>
          </div>

          {/* 晋升条件检查 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              {checkResult.canPromote ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-500" />
              )}
              晋升条件检查
            </h4>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              {checkResult.canPromote ? (
                <div className="text-sm text-emerald-600">
                  ✓ {checkResult.reasons[0]}
                </div>
              ) : (
                <div className="space-y-2">
                  {checkResult.missingConditions?.map((condition, index) => (
                    <div key={index} className="text-sm text-rose-600 flex items-start gap-2">
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{condition}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 队伍创建预览（仅晋升为区经时） */}
          {willCreateTeam && checkResult.canPromote && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-indigo-800 mb-2">
                    将创建新队伍
                  </h4>
                  <div className="text-sm text-indigo-700 space-y-1">
                    <div>• 队伍名称：{person.name.charAt(0).toUpperCase()}</div>
                    <div>• 队伍区经：{person.name}</div>
                    {person.regionId && (
                      <div>• 所属地区：{person.regionId}</div>
                    )}
                    {person.cityId && (
                      <div>• 所属城市：{person.cityId}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 警告信息 */}
          {!checkResult.canPromote && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-800 mb-1">
                    不满足晋升条件
                  </h4>
                  <p className="text-sm text-amber-700">
                    请确保满足所有晋升条件后再进行晋升操作。
                  </p>
                </div>
              </div>
            </div>
          )}
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
            disabled={!checkResult.canPromote || isProcessing}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? '处理中...' : '确认晋升'}
          </button>
        </div>
      </div>
    </div>
  );
};




















