/**
 * 队伍拆分对话框 - 从现有队伍中拆分出新队伍
 */

import React, { useState, useMemo } from 'react';
import { X, Building2, Users, UserPlus, AlertTriangle } from 'lucide-react';
import { Team } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { TeamManagementService } from '../services/teamService';
import { PromotionService } from '../services/promotionService';
import { getDefaultRules } from '../utils/commissionRules';

interface TeamSplitDialogProps {
  orgService: OrganizationService;
  sourceTeam?: Team; // 改为可选，如果未提供则让用户选择
  onConfirm: () => void;
  onCancel: () => void;
}

export const TeamSplitDialog: React.FC<TeamSplitDialogProps> = ({
  orgService,
  sourceTeam: initialSourceTeam,
  onConfirm,
  onCancel,
}) => {
  const [sourceTeamId, setSourceTeamId] = useState<string>(initialSourceTeam?.id || '');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [newLeaderId, setNewLeaderId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const teamService = new TeamManagementService(orgService);
  const promotionService = useMemo(() => {
    return new PromotionService(orgService, getDefaultRules());
  }, [orgService]);
  
  const allTeams = orgService.teams.getAllTeams();
  const sourceTeam = sourceTeamId ? orgService.teams.getTeam(sourceTeamId) : null;

  // 获取源队伍成员（排除区经）
  const teamMembers = useMemo(() => {
    if (!sourceTeam) return [];
    const members = teamService.getTeamMembers(sourceTeam.id);
    return members.filter(m => m.id !== sourceTeam.leaderId && m.status === '活跃');
  }, [orgService, sourceTeam, teamService]);

  // 获取可担任新区经的成员（部经理）
  const eligibleLeaders = useMemo(() => {
    return teamMembers.filter(m => m.level === '部经理');
  }, [teamMembers]);

  const handleToggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMembers.size === teamMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(teamMembers.map(m => m.id)));
    }
  };

  const handleConfirm = async () => {
    if (!sourceTeamId) {
      alert('请选择源队伍');
      return;
    }
    if (selectedMembers.size === 0) {
      alert('请选择要拆分的成员');
      return;
    }

    if (!newLeaderId) {
      alert('请选择新队伍的区经');
      return;
    }

    const newLeader = orgService.persons.getPerson(newLeaderId);
    if (!newLeader) {
      alert('新区经不存在');
      return;
    }

    if (newLeader.level !== '区经理') {
      // 需要先晋升为区经
      try {
        const result = promotionService.promoteToAreaManager(newLeaderId);
        if (!result) {
          alert('晋升失败，无法创建新队伍');
          return;
        }
      } catch (error: any) {
        alert(`晋升失败：${error.message}`);
        return;
      }
    }

    setIsProcessing(true);
    try {
      // 获取新创建的队伍（晋升时自动创建）
      const updatedLeader = orgService.persons.getPerson(newLeaderId);
      if (!updatedLeader || !updatedLeader.teamId) {
        alert('新队伍创建失败');
        return;
      }

      const newTeam = orgService.teams.getTeam(updatedLeader.teamId);
      if (!newTeam) {
        alert('新队伍不存在');
        return;
      }

      // 转移选中的成员到新队伍
      selectedMembers.forEach(memberId => {
        teamService.transferMember(memberId, newTeam.id);
      });
      
      // 更新源队伍的统计
      if (sourceTeam) {
        teamService.updateTeamStats(sourceTeam.id);
      }

      onConfirm();
    } catch (error: any) {
      alert(`拆分失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const sourceTeamLeader = sourceTeam ? orgService.persons.getPerson(sourceTeam.leaderId) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">队伍拆分</h3>
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
              <Building2 className="w-4 h-4 text-slate-600" />
              源队伍
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
            {sourceTeam && sourceTeamLeader && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">队伍名称：</span>
                    <span className="font-medium text-slate-800 ml-2">队伍 {sourceTeam.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">区经：</span>
                    <span className="font-medium text-slate-800 ml-2">
                      {sourceTeamLeader?.name || '未知'}
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

          {/* 选择新队伍区经 */}
          {sourceTeam && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                新队伍区经
              </h4>
              <select
                value={newLeaderId}
                onChange={(e) => setNewLeaderId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!sourceTeam}
              >
                <option value="">请选择新队伍区经</option>
                {eligibleLeaders.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.level}) - {(member.performance / 10000).toFixed(1)}w
                  </option>
                ))}
              </select>
              {eligibleLeaders.length === 0 && sourceTeam && (
                <p className="text-sm text-amber-600 mt-2">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  当前队伍没有可担任区经的部经理
                </p>
              )}
            </div>
          )}

          {/* 选择要拆分的成员 */}
          {sourceTeam && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                选择要拆分的成员
              </h4>
              <button
                onClick={handleSelectAll}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                {selectedMembers.size === teamMembers.length ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
              {teamMembers.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  没有可拆分的成员
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {teamMembers.map(member => {
                    const isSelected = selectedMembers.has(member.id);
                    const subordinates = orgService.persons.getSubordinates(member.id);
                    
                    return (
                      <div
                        key={member.id}
                        className={`p-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                        }`}
                        onClick={() => handleToggleMember(member.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleMember(member.id)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800">{member.name}</div>
                            <div className="text-xs text-slate-500">
                              {member.level}
                              {subordinates.length > 0 && ` · ${subordinates.length} 名下属`}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-indigo-600">
                            {(member.performance / 10000).toFixed(1)}w
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              已选择 {selectedMembers.size} 名成员
            </div>
          </div>
          )}

          {/* 拆分预览 */}
          {sourceTeam && newLeaderId && selectedMembers.size > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">拆分预览</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">原队伍</div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>成员数: {sourceTeam.memberCount - selectedMembers.size}</div>
                    <div>区经: {sourceTeamLeader?.name}</div>
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="text-sm font-semibold text-indigo-700 mb-2">新队伍</div>
                  <div className="text-xs text-indigo-600 space-y-1">
                    <div>成员数: {selectedMembers.size + 1}</div>
                    <div>区经: {orgService.persons.getPerson(newLeaderId)?.name}</div>
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
                  拆分说明
                </h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• 选中的成员将转移到新队伍</li>
                  <li>• 新队伍区经将自动晋升为区经理（如果还不是）</li>
                  <li>• 新队伍将自动创建并分配编号</li>
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
            disabled={!sourceTeamId || selectedMembers.size === 0 || !newLeaderId || isProcessing}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? '处理中...' : '确认拆分'}
          </button>
        </div>
      </div>
    </div>
  );
};




