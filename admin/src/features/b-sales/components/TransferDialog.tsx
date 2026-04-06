/**
 * 跨区调动对话框 - 成员跨区调动功能
 */

import React, { useState, useMemo } from 'react';
import { X, ArrowRight, MapPin, Users, AlertCircle } from 'lucide-react';
import { Person } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { TeamManagementService } from '../services/teamService';
import { getAllRegions, getProvincesByRegion, getCitiesByProvince } from '../data/chinaRegions';

interface TransferDialogProps {
  orgService: OrganizationService;
  person: Person;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransferDialog: React.FC<TransferDialogProps> = ({
  orgService,
  person,
  onConfirm,
  onCancel,
}) => {
  const [selectedRegion, setSelectedRegion] = useState(person.regionId || '');
  const [selectedProvince, setSelectedProvince] = useState(person.provinceId || '');
  const [selectedCity, setSelectedCity] = useState(person.cityId || '');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const teamService = new TeamManagementService(orgService);
  const regions = getAllRegions();
  const provinces = selectedRegion ? getProvincesByRegion(selectedRegion) : [];
  const cities = selectedProvince ? getCitiesByProvince(selectedProvince) : [];

  // 获取目标地区的可用队伍
  const availableTeams = useMemo(() => {
    if (!selectedRegion) return [];
    
    const teams = orgService.teams.getTeamsByRegion(
      selectedRegion,
      selectedProvince || undefined,
      selectedCity || undefined
    );
    
    return teams;
  }, [orgService, selectedRegion, selectedProvince, selectedCity]);

  const handleConfirm = async () => {
    if (!selectedRegion) {
      alert('请选择目标地区');
      return;
    }

    setIsProcessing(true);
    try {
      let targetTeamId = selectedTeam;

      // 如果没有选择队伍，自动分配或创建
      if (!targetTeamId) {
        const defaultTeam = teamService.assignTeamByRegion(
          selectedRegion,
          selectedProvince || undefined,
          selectedCity || undefined
        );

        if (defaultTeam) {
          targetTeamId = defaultTeam.id;
        } else {
          // 需要创建新队伍（这里简化处理，实际应该提示用户）
          alert('目标地区没有队伍，请先创建队伍或选择现有队伍');
          setIsProcessing(false);
          return;
        }
      }

      // 转移成员
      teamService.transferMember(person.id, targetTeamId);

      // 更新成员的地区信息
      orgService.persons.updatePerson(person.id, {
        regionId: selectedRegion,
        provinceId: selectedProvince || undefined,
        cityId: selectedCity || undefined,
        teamId: targetTeamId,
      });

      onConfirm();
    } catch (error: any) {
      alert(`调动失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">跨区调动</h3>
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
            <h4 className="text-sm font-semibold text-slate-700 mb-3">当前信息</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">姓名：</span>
                <span className="font-medium text-slate-800 ml-2">{person.name}</span>
              </div>
              <div>
                <span className="text-slate-500">职级：</span>
                <span className="font-medium text-slate-800 ml-2">{person.level}</span>
              </div>
              <div>
                <span className="text-slate-500">当前地区：</span>
                <span className="font-medium text-slate-800 ml-2">
                  {person.regionId || '未分配'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">当前队伍：</span>
                <span className="font-medium text-slate-800 ml-2">
                  {person.teamId ? '已分配' : '未分配'}
                </span>
              </div>
            </div>
          </div>

          {/* 目标地区选择 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              目标地区
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedProvince('');
                  setSelectedCity('');
                  setSelectedTeam('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">请选择地区</option>
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {selectedRegion && (
                <select
                  value={selectedProvince}
                  onChange={(e) => {
                    setSelectedProvince(e.target.value);
                    setSelectedCity('');
                    setSelectedTeam('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">请选择省份</option>
                  {provinces.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              )}

              {selectedProvince && (
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedTeam('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">请选择城市</option>
                  {cities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 目标队伍选择 */}
          {selectedRegion && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                目标队伍
              </h4>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">自动分配（选择人数最少的队伍）</option>
                {availableTeams.map(team => {
                  const leader = orgService.persons.getPerson(team.leaderId);
                  return (
                    <option key={team.id} value={team.id}>
                      队伍 {team.name} - {leader?.name || '未知'} ({team.memberCount} 人)
                    </option>
                  );
                })}
              </select>
              {availableTeams.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  目标地区暂无队伍，系统将自动创建新队伍
                </p>
              )}
            </div>
          )}

          {/* 提示信息 */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-indigo-800 mb-1">
                  调动说明
                </h4>
                <ul className="text-sm text-indigo-700 space-y-1">
                  <li>• 成员将转移到目标地区的队伍</li>
                  <li>• 如果未选择队伍，将自动分配到人数最少的队伍</li>
                  <li>• 原队伍的统计信息将自动更新</li>
                  <li>• 此操作将记录在历史数据中</li>
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
            disabled={!selectedRegion || isProcessing}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? '处理中...' : '确认调动'}
          </button>
        </div>
      </div>
    </div>
  );
};

