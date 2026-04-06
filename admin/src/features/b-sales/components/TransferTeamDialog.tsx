/**
 * 转换队伍对话框 - 将成员从一个队伍转到另一个队伍
 */

import React, { useState, useMemo } from 'react';
import { X, User, Building2, AlertTriangle } from 'lucide-react';
import { Person } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { TeamManagementService } from '../services/teamService';

interface TransferTeamDialogProps {
  orgService: OrganizationService;
  person: Person;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransferTeamDialog: React.FC<TransferTeamDialogProps> = ({
  orgService,
  person,
  onConfirm,
  onCancel,
}) => {
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const teamService = new TeamManagementService(orgService);
  const allTeams = orgService.teams.getAllTeams();
  
  // 获取当前成员所在队伍
  const currentTeam = person.teamId ? orgService.teams.getTeam(person.teamId) : null;
  
  // 排除当前队伍
  const availableTeams = useMemo(() => {
    return allTeams.filter(t => t.id !== person.teamId);
  }, [allTeams, person.teamId]);

  // 获取目标队伍详情
  const targetTeam = targetTeamId ? orgService.teams.getTeam(targetTeamId) : null;
  const targetTeamDetails = targetTeam ? {
    members: teamService.getTeamMembers(targetTeam.id),
    leader: orgService.persons.getPerson(targetTeam.leaderId),
  } : null;

  const handleConfirm = async () => {
    if (!targetTeamId) {
      alert('请选择目标队伍');
      return;
    }

    if (targetTeamId === person.teamId) {
      alert('不能转换到当前队伍');
      return;
    }

    setIsProcessing(true);
    try {
      teamService.transferMember(person.id, targetTeamId);
      onConfirm();
    } catch (error: any) {
      alert(`转换失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">转换队伍</h3>
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
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              成员信息
            </h4>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">姓名：</span>
                  <span className="font-medium text-slate-800 ml-2">{person.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">编号：</span>
                  <span className="font-medium text-slate-800 ml-2">{person.code}</span>
                </div>
                <div>
                  <span className="text-slate-500">职级：</span>
                  <span className="font-medium text-slate-800 ml-2">{person.level}</span>
                </div>
                <div>
                  <span className="text-slate-500">当前队伍：</span>
                  <span className="font-medium text-slate-800 ml-2">
                    {currentTeam ? `队伍 ${currentTeam.name}` : '未分配'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 目标队伍选择 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              目标队伍
            </h4>
            <select
              value={targetTeamId}
              onChange={(e) => setTargetTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">请选择目标队伍</option>
              {availableTeams.map(team => {
                const leader = orgService.persons.getPerson(team.leaderId);
                return (
                  <option key={team.id} value={team.id}>
                    队伍 {team.name} - {leader?.name || '未知'} ({team.memberCount} 人)
                  </option>
                );
              })}
            </select>
          </div>

          {/* 目标队伍预览 */}
          {targetTeamDetails && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">转换后预览</h4>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">队伍名称：</span>
                    <span className="font-medium text-slate-800 ml-2">队伍 {targetTeam?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">区经：</span>
                    <span className="font-medium text-slate-800 ml-2">
                      {targetTeamDetails.leader?.name || '未知'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">转换后成员数：</span>
                    <span className="font-medium text-slate-800 ml-2">
                      {targetTeam!.memberCount + 1} 人
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">队伍总业绩：</span>
                    <span className="font-medium text-indigo-600 ml-2">
                      {((targetTeam!.totalPerformance + person.performance) / 10000).toFixed(1)}w
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 警告信息 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-800 mb-1">
                  转换说明
                </h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• 成员将从当前队伍转移到目标队伍</li>
                  <li>• 成员的归属关系将更新</li>
                  <li>• 原队伍的统计信息将自动更新</li>
                  <li>• 此操作可以撤销（再次转换队伍）</li>
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
            disabled={!targetTeamId || isProcessing}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? '处理中...' : '确认转换'}
          </button>
        </div>
      </div>
    </div>
  );
};



