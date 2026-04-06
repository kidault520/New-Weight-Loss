/**
 * 脱落对话框 - 处理成员脱落
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertTriangle, User, Users, Sparkles } from 'lucide-react';
import { Person, LeaveType } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { LeaveService } from '../services/leaveService';
import { TeamManagementService } from '../services/teamService';
import { PromotionEvaluator } from '../utils/promotionEvaluator';
import { OrganizationEngine } from '../utils/organizationEngine';
import { convertOrgTreeData } from '../utils/orgDataConverter';
import { orgTreeData } from '../data/orgTreeData';
import { RuleStorage } from '../utils/ruleStorage';

interface LeaveDialogProps {
  orgService: OrganizationService;
  person: Person;
  suggestedLeaveType?: LeaveType; // 规则建议的脱落类型
  onConfirm: () => void;
  onCancel: () => void;
}

const LEAVE_TYPES: { type: LeaveType; label: string; description: string }[] = [
  {
    type: '主动离职',
    label: '主动离职',
    description: '成员主动申请离职',
  },
  {
    type: '业绩不达标',
    label: '业绩不达标',
    description: '因业绩考核不达标而脱落',
  },
  {
    type: '违规清退',
    label: '违规清退',
    description: '因违反规定被强制清退',
  },
];

export const LeaveDialog: React.FC<LeaveDialogProps> = ({
  orgService,
  person,
  suggestedLeaveType,
  onConfirm,
  onCancel,
}) => {
  const [leaveType, setLeaveType] = useState<LeaveType>(suggestedLeaveType || '主动离职');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ruleSuggestion, setRuleSuggestion] = useState<{
    shouldLeave: boolean;
    reason?: string;
    evaluationRuleId?: string;
  } | null>(null);

  const leaveService = useMemo(() => {
    return new LeaveService(orgService);
  }, [orgService]);

  // 检查规则是否建议脱落
  useEffect(() => {
    if (person.status !== '活跃') {
      setRuleSuggestion(null);
      return;
    }

    try {
      const ruleSet = RuleStorage.getCurrentRuleSet();
      const orgNode = convertOrgTreeData(orgTreeData);
      const orgEngine = new OrganizationEngine(orgNode);
      const evaluator = new PromotionEvaluator(orgEngine);
      
      // 获取当前周期
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      const period = `${now.getFullYear()}-Q${quarter}`;
      
      const evaluationResult = evaluator.evaluate(person.id, period, ruleSet);
      
      if (evaluationResult) {
        // 如果评估结果显示不达标，且没有降级条件（或降级条件也不满足），可能建议脱落
        // 这里简化处理：如果评估不通过，且没有降级规则，则建议考虑脱落
        if (!evaluationResult.passed && evaluationResult.action !== 'demote') {
          setRuleSuggestion({
            shouldLeave: true,
            reason: `未满足${evaluationResult.evaluationRule.name}的维持条件，且不符合降级条件`,
            evaluationRuleId: evaluationResult.evaluationRule.id,
          });
        } else {
          setRuleSuggestion({
            shouldLeave: false,
          });
        }
      } else {
        setRuleSuggestion(null);
      }
    } catch (error) {
      // 规则检查失败，不影响手动脱落
      setRuleSuggestion(null);
    }
  }, [orgService, person.id, person.status]);

  // 如果规则建议脱落，且建议类型是"业绩不达标"，自动选择
  useEffect(() => {
    if (ruleSuggestion?.shouldLeave && suggestedLeaveType === '业绩不达标') {
      setLeaveType('业绩不达标');
    }
  }, [ruleSuggestion, suggestedLeaveType]);

  const teamService = useMemo(() => {
    return new TeamManagementService(orgService);
  }, [orgService]);

  // 获取下属列表
  const subordinates = useMemo(() => {
    return orgService.persons.getSubordinates(person.id).filter(p => p.status === '活跃');
  }, [orgService, person.id]);

  // 获取队伍信息（如果是区经）
  const team = useMemo(() => {
    if (person.level === '区经理' && person.teamId) {
      return orgService.teams.getTeam(person.teamId);
    }
    return null;
  }, [orgService, person]);

  // 获取可接任的部经理（如果是区经）
  const availableSuccessors = useMemo(() => {
    if (person.level === '区经理' && team) {
      const teamMembers = teamService.getTeamMembers(team.id);
      return teamMembers.filter(
        p => p.level === '部经理' && p.status === '活跃' && p.id !== person.id
      );
    }
    return [];
  }, [person, team, teamService]);

  const handleConfirm = async () => {
    if (!leaveType) {
      alert('请选择脱落类型');
      return;
    }

    setIsProcessing(true);
    try {
      switch (leaveType) {
        case '主动离职':
          leaveService.handleVoluntaryLeave(person.id, reason);
          break;
        case '业绩不达标':
          leaveService.handlePerformanceLeave(person.id, reason);
          break;
        case '违规清退':
          leaveService.handleForcedLeave(person.id, reason);
          break;
      }
      onConfirm();
    } catch (error: any) {
      alert(`处理失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isAreaManager = person.level === '区经理';
  const hasSubordinates = subordinates.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">
            成员脱落 - {person.name}
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
          {/* 成员信息 */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">姓名：</span>
                <span className="font-semibold text-slate-800 ml-2">{person.name}</span>
              </div>
              <div>
                <span className="text-slate-500">职级：</span>
                <span className="font-semibold text-slate-800 ml-2">{person.level}</span>
              </div>
              <div>
                <span className="text-slate-500">业绩：</span>
                <span className="font-semibold text-slate-800 ml-2">
                  {(person.performance / 10000).toFixed(1)}w
                </span>
              </div>
              <div>
                <span className="text-slate-500">状态：</span>
                <span className="font-semibold text-slate-800 ml-2">{person.status}</span>
              </div>
            </div>
          </div>

          {/* 规则建议提示 */}
          {ruleSuggestion && ruleSuggestion.shouldLeave && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-rose-800 mb-1">规则建议脱落</h4>
                  <p className="text-sm text-rose-700">
                    {ruleSuggestion.reason}
                  </p>
                  <p className="text-xs text-rose-600 mt-2">
                    系统建议选择"业绩不达标"作为脱落类型
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 脱落类型选择 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              脱落类型 <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {LEAVE_TYPES.map((type) => (
                <button
                  key={type.type}
                  onClick={() => setLeaveType(type.type)}
                  className={`p-4 rounded-lg border-2 transition-colors text-left ${
                    leaveType === type.type
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-slate-800 mb-1">{type.label}</div>
                  <div className="text-xs text-slate-500">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 脱落原因 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              脱落原因（可选）
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="请输入脱落原因..."
            />
          </div>

          {/* 下属归属处理 */}
          {hasSubordinates && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <Users className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-800 mb-1">
                    下属归属处理
                  </h4>
                  <p className="text-sm text-amber-700">
                    该成员有 {subordinates.length} 名活跃下属，将自动重新分配归属。
                  </p>
                </div>
              </div>
              <div className="text-xs text-amber-700 space-y-1">
                {subordinates.slice(0, 5).map(sub => (
                  <div key={sub.id}>• {sub.name} ({sub.level})</div>
                ))}
                {subordinates.length > 5 && (
                  <div>... 还有 {subordinates.length - 5} 名下属</div>
                )}
              </div>
            </div>
          )}

          {/* 区经重新任命 */}
          {isAreaManager && team && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <User className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-indigo-800 mb-1">
                    区经重新任命
                  </h4>
                  <p className="text-sm text-indigo-700">
                    队伍 {team.name} 需要重新任命区经。
                  </p>
                </div>
              </div>
              {availableSuccessors.length > 0 ? (
                <div className="text-sm text-indigo-700">
                  <div className="mb-2">可接任的部经理：</div>
                  <div className="space-y-1">
                    {availableSuccessors.map(successor => (
                      <div key={successor.id} className="flex items-center justify-between">
                        <span>• {successor.name}</span>
                        <span className="text-xs text-slate-500">
                          业绩: {(successor.performance / 10000).toFixed(1)}w
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-indigo-600">
                    系统将自动选择业绩最好的部经理接任
                  </div>
                </div>
              ) : (
                <div className="text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  没有可用的部经理接任，队伍将暂时空缺
                </div>
              )}
            </div>
          )}

          {/* 警告信息 */}
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-rose-800 mb-1">
                  确认操作
                </h4>
                <p className="text-sm text-rose-700">
                  此操作将把成员状态设置为"脱落"，并处理相关归属关系。此操作不可撤销。
                </p>
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
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? '处理中...' : '确认脱落'}
          </button>
        </div>
      </div>
    </div>
  );
};






