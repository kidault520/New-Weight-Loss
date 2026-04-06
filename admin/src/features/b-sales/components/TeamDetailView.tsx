/**
 * 队伍详情视图 - 显示队伍完整结构和成员详情
 */

import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  ArrowUp, ArrowDown, X 
} from 'lucide-react';
import { Team, Person, Rank } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { PromotionDialog } from './PromotionDialog';
import { LeaveDialog } from './LeaveDialog';

interface TeamDetailViewProps {
  orgService: OrganizationService;
  team: Team | null;
  onClose?: () => void;
  onUpdate?: () => void;
}

const RANK_ORDER: Rank[] = ['区经理', '部经理', '组经理', '收展员'];

export const TeamDetailView: React.FC<TeamDetailViewProps> = ({
  orgService,
  team,
  onClose,
  onUpdate,
}) => {
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  if (!team) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="text-center py-12 text-slate-500">
          请选择一个队伍查看详情
        </div>
      </div>
    );
  }

  // 获取队伍成员
  const teamMembers = useMemo(() => {
    return orgService.persons.getPersonsByTeam(team.id);
  }, [orgService, team.id]);

  // 获取区经
  const leader = orgService.persons.getPerson(team.leaderId);

  // 按职级分组成员
  const membersByRank = useMemo(() => {
    const grouped = new Map<Rank, Person[]>();
    RANK_ORDER.forEach(rank => {
      grouped.set(rank, []);
    });
    
    teamMembers.forEach(member => {
      const rankMembers = grouped.get(member.level) || [];
      rankMembers.push(member);
      grouped.set(member.level, rankMembers);
    });

    return grouped;
  }, [teamMembers]);

  // 构建层级结构
  const buildHierarchy = () => {
    if (!leader) return [];

    const hierarchy: Array<{ person: Person; subordinates: Person[] }> = [];
    
    // 区经
    const areaManager = leader;
    const departmentManagers = membersByRank.get('部经理') || [];
    const groupManagers = membersByRank.get('组经理') || [];
    const agents = membersByRank.get('收展员') || [];

    // 区经的下属（部经理）
    hierarchy.push({
      person: areaManager,
      subordinates: departmentManagers,
    });

    // 每个部经理的下属（组经理）
    departmentManagers.forEach(deptManager => {
      const deptSubordinates = orgService.persons.getSubordinates(deptManager.id);
      const deptGroupManagers = deptSubordinates.filter(p => p.level === '组经理');
      
      hierarchy.push({
        person: deptManager,
        subordinates: deptGroupManagers,
      });

      // 每个组经理的下属（收展员）
      deptGroupManagers.forEach(groupManager => {
        const groupSubordinates = orgService.persons.getSubordinates(groupManager.id);
        const groupAgents = groupSubordinates.filter(p => p.level === '收展员');
        
        hierarchy.push({
          person: groupManager,
          subordinates: groupAgents,
        });
      });
    });

    // 直辖的组经理
    const directGroupManagers = groupManagers.filter(
      gm => !departmentManagers.some(dm => {
        const subs = orgService.persons.getSubordinates(dm.id);
        return subs.some(s => s.id === gm.id);
      })
    );

    directGroupManagers.forEach(groupManager => {
      const groupSubordinates = orgService.persons.getSubordinates(groupManager.id);
      const groupAgents = groupSubordinates.filter(p => p.level === '收展员');
      
      hierarchy.push({
        person: groupManager,
        subordinates: groupAgents,
      });
    });

    // 直辖的收展员
    const directAgents = agents.filter(
      agent => !groupManagers.some(gm => {
        const subs = orgService.persons.getSubordinates(gm.id);
        return subs.some(s => s.id === agent.id);
      })
    );

    directAgents.forEach(agent => {
      hierarchy.push({
        person: agent,
        subordinates: [],
      });
    });

    return hierarchy;
  };

  const hierarchy = buildHierarchy();

  const getNextRank = (currentRank: Rank): Rank => {
    const currentIndex = RANK_ORDER.indexOf(currentRank);
    return currentIndex < RANK_ORDER.length - 1 ? RANK_ORDER[currentIndex + 1] : currentRank;
  };

  const handlePromote = (person: Person) => {
    setSelectedPerson(person);
    setShowPromotionDialog(true);
  };

  const handleLeave = (person: Person) => {
    setSelectedPerson(person);
    setShowLeaveDialog(true);
  };

  const handlePromotionConfirm = () => {
    setShowPromotionDialog(false);
    setSelectedPerson(null);
    if (onUpdate) onUpdate();
  };

  const handleLeaveConfirm = () => {
    setShowLeaveDialog(false);
    setSelectedPerson(null);
    if (onUpdate) onUpdate();
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">队伍 {team.name}</h2>
              <div className="text-sm text-slate-500">
                区经：{leader?.name || '未知'} · 
                成员：{team.memberCount} 人 · 
                业绩：{(team.totalPerformance / 10000).toFixed(1)}w
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 队伍统计 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-sm text-slate-500 mb-1">总成员</div>
            <div className="text-2xl font-bold text-slate-800">{team.memberCount}</div>
            <div className="text-xs text-slate-500 mt-1">
              活跃: {teamMembers.filter(p => p.status === '活跃').length}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-sm text-slate-500 mb-1">总业绩</div>
            <div className="text-2xl font-bold text-indigo-600">
              {(team.totalPerformance / 10000).toFixed(1)}w
            </div>
            <div className="text-xs text-slate-500 mt-1">
              人均: {(team.totalPerformance / team.memberCount / 10000).toFixed(1)}w
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-sm text-slate-500 mb-1">创建时间</div>
            <div className="text-lg font-semibold text-slate-800">{team.createdDate}</div>
            <div className="text-xs text-slate-500 mt-1">
              地区: {team.regionId || '未分配'}
            </div>
          </div>
        </div>

        {/* 组织架构 */}
        <div>
          <h3 className="text-md font-semibold text-slate-800 mb-4">组织架构</h3>
          <div className="space-y-2">
            {hierarchy.map((item) => {
              const hasSubordinates = item.subordinates.length > 0;
              const indentLevel = item.person.level === '区经理' ? 0 :
                                 item.person.level === '部经理' ? 1 :
                                 item.person.level === '组经理' ? 2 : 3;

              return (
                <div key={item.person.id}>
                  <div
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors ${
                      item.person.level === '区经理' ? 'bg-indigo-50 border border-indigo-200' : ''
                    }`}
                    style={{ paddingLeft: `${indentLevel * 24 + 12}px` }}
                  >
                    {/* 头像 */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                      <img 
                        src={item.person.avatarUrl} 
                        alt={item.person.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800">{item.person.name}</div>
                      <div className="text-xs text-slate-500">
                        {item.person.level}
                        {item.person.regionId && ` · ${item.person.regionId}`}
                        {item.person.cityId && ` · ${item.person.cityId}`}
                      </div>
                    </div>

                    {/* 业绩 */}
                    <div className="text-sm font-semibold text-indigo-600">
                      {(item.person.performance / 10000).toFixed(1)}w
                    </div>

                    {/* 状态 */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      item.person.status === '活跃' 
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.person.status === '晋升中'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.person.status}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1">
                      {getNextRank(item.person.level) !== item.person.level && (
                        <button
                          onClick={() => handlePromote(item.person)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="晋升"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleLeave(item.person)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="脱落"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 连接线（如果有下属） */}
                  {hasSubordinates && (
                    <div 
                      className="border-l-2 border-slate-200 ml-6"
                      style={{ marginLeft: `${indentLevel * 24 + 28}px` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 晋升对话框 */}
      {showPromotionDialog && selectedPerson && (
        <PromotionDialog
          orgService={orgService}
          person={selectedPerson}
          targetLevel={getNextRank(selectedPerson.level)}
          onConfirm={handlePromotionConfirm}
          onCancel={() => {
            setShowPromotionDialog(false);
            setSelectedPerson(null);
          }}
        />
      )}

      {/* 脱落对话框 */}
      {showLeaveDialog && selectedPerson && (
        <LeaveDialog
          orgService={orgService}
          person={selectedPerson}
          onConfirm={handleLeaveConfirm}
          onCancel={() => {
            setShowLeaveDialog(false);
            setSelectedPerson(null);
          }}
        />
      )}
    </>
  );
};




















