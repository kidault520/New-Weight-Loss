/**
 * 队伍合并对话框 - 将源队伍合并到目标队伍
 */

import React, { useState, useMemo } from 'react';
import { X, Building2, AlertTriangle } from 'lucide-react';
import { Team } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { TeamManagementService } from '../services/teamService';

interface TeamMergeDialogProps {
  orgService: OrganizationService;
  sourceTeam?: Team; // 改为可选，如果未提供则让用户选择
  onConfirm: () => void;
  onCancel: () => void;
}

export const TeamMergeDialog: React.FC<TeamMergeDialogProps> = ({
  orgService,
  sourceTeam: initialSourceTeam,
  onConfirm,
  onCancel,
}) => {
  const [sourceTeamId, setSourceTeamId] = useState<string>(initialSourceTeam?.id || '');
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const teamService = new TeamManagementService(orgService);
  const allTeams = orgService.teams.getAllTeams();
  
  // 当前选中的源队伍
  const sourceTeam = sourceTeamId ? orgService.teams.getTeam(sourceTeamId) : null;
  
  // 排除源队伍的目标队伍列表
  const availableTeams = useMemo(() => {
    if (!sourceTeamId) return allTeams;
    return allTeams.filter(t => t.id !== sourceTeamId);
  }, [allTeams, sourceTeamId]);

  // 获取源队伍详情
  const sourceTeamDetails = useMemo(() => {
    if (!sourceTeam) return null;
    const members = teamService.getTeamMembers(sourceTeam.id);
    const leader = orgService.persons.getPerson(sourceTeam.leaderId);
    return { members, leader };
  }, [orgService, sourceTeam, teamService]);

  const handleConfirm = async () => {
    if (!sourceTeamId) {
      alert('请选择源队伍');
      return;
    }
    if (!targetTeamId) {
      alert('请选择目标队伍');
      return;
    }

    if (targetTeamId === sourceTeamId) {
      alert('不能合并到自身');
      return;
    }

    setIsProcessing(true);
    try {
      teamService.mergeTeams(sourceTeamId, targetTeamId);
      onConfirm();
    } catch (error: any) {
      alert(`合并失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const targetTeam = targetTeamId ? orgService.teams.getTeam(targetTeamId) : null;
  const targetTeamDetails = targetTeam ? {
    members: teamService.getTeamMembers(targetTeam.id),
    leader: orgService.persons.getPerson(targetTeam.leaderId),
  } : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">队伍合并</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 源队伍选择 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-rose-600" />
              源队伍（将被合并）
            </h4>
            <select
              value={sourceTeamId}
              onChange={(e) => setSourceTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">请选择源队伍</option>
              {allTeams.map(team => {
                const leader = orgService.persons.getPerson(team.leaderId);
                return (
                  <option key={team.id} value={team.id}>
                    ID{team.code} {team.name} - {leader?.name || '未知'} ({team.memberCount} 人)
                  </option>
                );
              })}
            </select>
            
            {/* 源队伍详情预览 */}
            {sourceTeamDetails && sourceTeam && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">队伍名称：</span>
                    <span className="font-medium text-slate-800 ml-2">队伍 {sourceTeam.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">区经：</span>
                    <span className="font-medium text-slate-800 ml-2">
                      {sourceTeamDetails.leader?.name || '未知'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">成员数：</span>
                    <span className="font-medium text-slate-800 ml-2">
                      {sourceTeam.memberCount} 人
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">总业绩：</span>
                    <span className="font-medium text-indigo-600 ml-2">
                      {(sourceTeam.totalPerformance / 10000).toFixed(1)}w
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 目标队伍选择 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              目标队伍（合并到）
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
          {targetTeamDetails && sourceTeam && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">合并后预览</h4>
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
                    <span className="text-slate-500">合并后成员数：</span>
                    <span className="font-medium text-slate-800 ml-2">
                      {targetTeam!.memberCount + sourceTeam.memberCount} 人
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">合并后总业绩：</span>
                    <span className="font-medium text-indigo-600 ml-2">
                      {((targetTeam!.totalPerformance + sourceTeam.totalPerformance) / 10000).toFixed(1)}w
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
                  合并说明
                </h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• 源队伍的所有成员将转移到目标队伍</li>
                  <li>• 源队伍将被删除</li>
                  <li>• 源队伍的区经将成为目标队伍的普通成员</li>
                  <li>• 此操作不可撤销，请谨慎操作</li>
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
            disabled={!sourceTeamId || !targetTeamId || isProcessing}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? '处理中...' : '确认合并'}
          </button>
        </div>
      </div>
    </div>
  );
};




