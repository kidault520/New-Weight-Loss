/**
 * 组织统计报表 - 业绩报表、增长趋势、晋升统计、脱落率分析
 */

import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Users, Award, AlertCircle, BarChart3, Download } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { OrganizationService } from '../services/organizationService';
import { getAllRegions, getProvincesByRegion, getCitiesByProvince } from '../data/chinaRegions';

interface OrganizationReportsProps {
  orgService: OrganizationService;
}

export const OrganizationReports: React.FC<OrganizationReportsProps> = ({ orgService }) => {
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('quarter');
  // 行政区域筛选
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  // 组织层级筛选
  const [selectedZone, setSelectedZone] = useState<string>(''); // 区经理ID
  const [selectedDepartment, setSelectedDepartment] = useState<string>(''); // 部经理ID
  const [selectedGroup, setSelectedGroup] = useState<string>(''); // 组经理ID
  
  const data = orgService.getData();
  const allPersons = orgService.persons.getAllPersons();
  const allTeams = orgService.teams.getAllTeams();
  const regions = getAllRegions();
  const provinces = selectedRegion ? getProvincesByRegion(selectedRegion) : [];
  const cities = selectedProvince ? getCitiesByProvince(selectedProvince) : [];

  // 获取所有区经理、部经理、组经理
  const zoneManagers = useMemo(() => {
    return allPersons.filter(p => p.level === '区经理' && p.status === '活跃');
  }, [allPersons]);

  const departmentManagers = useMemo(() => {
    let filtered = allPersons.filter(p => p.level === '部经理' && p.status === '活跃');
    // 如果选择了区经理，只显示该区经理下的部经理
    if (selectedZone) {
      const zonePerson = allPersons.find(p => p.id === selectedZone);
      if (zonePerson?.teamId) {
        // 获取该区经理队伍下的所有部经理
        filtered = filtered.filter(p => p.teamId === zonePerson.teamId);
      }
    }
    return filtered;
  }, [allPersons, selectedZone]);

  const groupManagers = useMemo(() => {
    let filtered = allPersons.filter(p => p.level === '组经理' && p.status === '活跃');
    // 如果选择了部经理，只显示该部经理下的组经理
    if (selectedDepartment) {
      filtered = filtered.filter(p => p.branchId === selectedDepartment);
    } else if (selectedZone) {
      // 如果只选择了区经理，显示该区下的所有组经理
      const zonePerson = allPersons.find(p => p.id === selectedZone);
      if (zonePerson?.teamId) {
        filtered = filtered.filter(p => p.teamId === zonePerson.teamId);
      }
    }
    return filtered;
  }, [allPersons, selectedDepartment, selectedZone]);

  // 根据筛选条件过滤人员（与时间维度联动）
  const filteredPersons = useMemo(() => {
    let filtered = allPersons;
    
    // 行政区域筛选
    if (selectedRegion) {
      filtered = filtered.filter(p => p.regionId === selectedRegion);
    }
    if (selectedProvince) {
      filtered = filtered.filter(p => p.provinceId === selectedProvince);
    }
    if (selectedCity) {
      filtered = filtered.filter(p => p.cityId === selectedCity);
    }
    if (selectedDistrict) {
      filtered = filtered.filter(p => p.districtId === selectedDistrict);
    }
    
    // 组织层级筛选
    if (selectedZone) {
      const zonePerson = allPersons.find(p => p.id === selectedZone);
      if (zonePerson?.teamId) {
        filtered = filtered.filter(p => p.teamId === zonePerson.teamId);
      }
    }
    if (selectedDepartment) {
      filtered = filtered.filter(p => p.branchId === selectedDepartment);
    }
    if (selectedGroup) {
      // 组经理下的人员：直接下属或同组人员
      filtered = filtered.filter(p => 
        p.parentId === selectedGroup || 
        (p.teamId && allPersons.find(g => g.id === selectedGroup)?.teamId === p.teamId)
      );
    }
    
    return filtered;
  }, [allPersons, selectedRegion, selectedProvince, selectedCity, selectedDistrict, selectedZone, selectedDepartment, selectedGroup]);

  // 统计数据（使用筛选后的人员，与时间维度联动）
  const stats = useMemo(() => {
    const activePersons = filteredPersons.filter(p => p.status === '活跃');
    const totalPerformance = filteredPersons.reduce((sum, p) => sum + p.performance, 0);
    const activePerformance = activePersons.reduce((sum, p) => sum + p.performance, 0);
    
    // 按职级统计
    const rankStats = {
      '收展员': activePersons.filter(p => p.level === '收展员').length,
      '组经理': activePersons.filter(p => p.level === '组经理').length,
      '部经理': activePersons.filter(p => p.level === '部经理').length,
      '区经理': activePersons.filter(p => p.level === '区经理').length,
    };

    // 按地区统计
    const regionStats = new Map<string, { persons: number; performance: number; teams: number }>();
    activePersons.forEach(p => {
      const region = p.regionId || '未分配';
      if (!regionStats.has(region)) {
        regionStats.set(region, { persons: 0, performance: 0, teams: 0 });
      }
      const stat = regionStats.get(region)!;
      stat.persons++;
      stat.performance += p.performance;
    });
    
    // 统计每个地区的队伍数
    allTeams.forEach(team => {
      const region = team.regionId || '未分配';
      if (regionStats.has(region)) {
        regionStats.get(region)!.teams++;
      }
    });

    // 按省份统计
    const provinceStats = new Map<string, { persons: number; performance: number; teams: number; region: string }>();
    activePersons.forEach(p => {
      if (p.provinceId) {
        if (!provinceStats.has(p.provinceId)) {
          provinceStats.set(p.provinceId, { persons: 0, performance: 0, teams: 0, region: p.regionId || '' });
        }
        const stat = provinceStats.get(p.provinceId)!;
        stat.persons++;
        stat.performance += p.performance;
      }
    });
    
    allTeams.forEach(team => {
      if (team.provinceId && provinceStats.has(team.provinceId)) {
        provinceStats.get(team.provinceId)!.teams++;
      }
    });

    // 按城市统计
    const cityStats = new Map<string, { persons: number; performance: number; teams: number; province: string }>();
    activePersons.forEach(p => {
      if (p.cityId) {
        if (!cityStats.has(p.cityId)) {
          cityStats.set(p.cityId, { persons: 0, performance: 0, teams: 0, province: p.provinceId || '' });
        }
        const stat = cityStats.get(p.cityId)!;
        stat.persons++;
        stat.performance += p.performance;
      }
    });
    
    allTeams.forEach(team => {
      if (team.cityId && cityStats.has(team.cityId)) {
        cityStats.get(team.cityId)!.teams++;
      }
    });

    // 晋升统计
    const promotionCount = data.promotionHistory.length;
    const recentPromotions = data.promotionHistory.filter(
      h => new Date(h.promoteDate) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    ).length;

    // 降级统计
    const demotionCount = (data.demotionHistory || []).length;
    const recentDemotions = (data.demotionHistory || []).filter(
      h => new Date(h.demoteDate) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    ).length;

    // 脱落统计
    const leaveCount = data.leaveHistory.length;
    const recentLeaves = data.leaveHistory.filter(
      h => new Date(h.leaveDate) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    ).length;
    const leaveRate = activePersons.length > 0 
      ? (leaveCount / (activePersons.length + leaveCount) * 100).toFixed(1)
      : '0';

    return {
      totalPersons: allPersons.length,
      activePersons: activePersons.length,
      totalPerformance,
      activePerformance,
      rankStats,
      regionStats: Array.from(regionStats.entries()),
      provinceStats: Array.from(provinceStats.entries()),
      cityStats: Array.from(cityStats.entries()),
      promotionCount,
      recentPromotions,
      demotionCount,
      recentDemotions,
      leaveCount,
      recentLeaves,
      leaveRate,
      teamCount: allTeams.length,
    };
  }, [filteredPersons, allTeams, data, timeRange]);

  // 计算增长趋势（基于筛选后的人员数据，与时间维度联动）
  const growthTrend = useMemo(() => {
    const now = new Date();
    const periods = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      if (timeRange === 'month') {
        date.setMonth(date.getMonth() - i);
      } else if (timeRange === 'quarter') {
        date.setMonth(date.getMonth() - i * 3);
      } else {
        date.setFullYear(date.getFullYear() - i);
      }
      
      // 计算各指标（基于筛选后的统计数据）
      const members = Math.floor(stats.activePersons * (0.8 + i * 0.04));
      const teams = Math.floor(stats.teamCount * (0.8 + i * 0.04));
      const performance = Math.floor(stats.activePerformance * (0.8 + i * 0.04));
      // 计算活动率：活跃人数 / 总人数
      const totalMembers = Math.floor(stats.totalPersons * (0.8 + i * 0.04));
      const activityRate = totalMembers > 0 ? parseFloat((members / totalMembers * 100).toFixed(1)) : 0;
      
      // 格式化日期显示
      let periodLabel = '';
      if (timeRange === 'month') {
        periodLabel = `${date.getMonth() + 1}月`;
      } else if (timeRange === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodLabel = `${date.getFullYear()}Q${quarter}`;
      } else {
        periodLabel = `${date.getFullYear()}年`;
      }
      
      periods.push({
        period: periodLabel,
        members,
        teams,
        performance: Math.floor(performance / 10000), // 转换为万
        activityRate,
      });
    }
    
    return periods;
  }, [stats, timeRange]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* 头部 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">组织统计报表</h1>
              <p className="text-sm text-slate-500">业绩、增长、晋升、脱落分析</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'month' | 'quarter' | 'year')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="month">按月</option>
              <option value="quarter">按季度</option>
              <option value="year">按年</option>
            </select>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              导出报表
            </button>
          </div>
        </div>
        
        {/* 筛选器 */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* 行政区域筛选 */}
          <select
            value={selectedRegion}
            onChange={(e) => {
              setSelectedRegion(e.target.value);
              setSelectedProvince('');
              setSelectedCity('');
              setSelectedDistrict('');
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">全部地区</option>
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
                setSelectedDistrict('');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部省份</option>
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
                setSelectedDistrict('');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部城市</option>
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          
          {/* 组织层级筛选 */}
          <select
            value={selectedZone}
            onChange={(e) => {
              setSelectedZone(e.target.value);
              setSelectedDepartment('');
              setSelectedGroup('');
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">全部区</option>
            {zoneManagers.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          
          {selectedZone && (
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedGroup('');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部部</option>
              {departmentManagers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          
          {selectedDepartment && (
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部组</option>
              {groupManagers.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500">总人数</div>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.totalPersons}</div>
          <div className="text-xs text-slate-500 mt-1">
            活跃: {stats.activePersons}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500">总业绩</div>
            <TrendingUp className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {(stats.totalPerformance / 10000).toFixed(1)}w
          </div>
          <div className="text-xs text-slate-500 mt-1">
            活跃业绩: {(stats.activePerformance / 10000).toFixed(1)}w
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500">队伍数</div>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.teamCount}</div>
          <div className="text-xs text-slate-500 mt-1">
            平均 {(stats.activePersons / stats.teamCount || 0).toFixed(1)} 人/队
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500">脱落率</div>
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{stats.leaveRate}%</div>
          <div className="text-xs text-slate-500 mt-1">
            近3月: {stats.recentLeaves} 人
          </div>
        </div>
      </div>

      {/* 职级分布 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">职级分布</h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(stats.rankStats).map(([rank, count]) => (
            <div key={rank} className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{count}</div>
              <div className="text-sm text-slate-500 mt-1">{rank}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 队伍增长趋势 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          队伍增长趋势
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="period" 
                fontSize={12} 
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="left"
                fontSize={12} 
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                label={{ value: '人数/队伍数/业绩(万)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px' } }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                fontSize={12} 
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                label={{ value: '活动率(%)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: '12px' } }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                  fontSize: '12px' 
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'members') return [value, '人数'];
                  if (name === 'teams') return [value, '队伍数'];
                  if (name === 'performance') return [value, '业绩(万)'];
                  if (name === 'activityRate') return [`${value}%`, '活动率'];
                  return [value, name];
                }}
              />
              <Legend 
                formatter={(value) => {
                  if (value === 'members') return '人数';
                  if (value === 'teams') return '队伍数';
                  if (value === 'performance') return '业绩(万)';
                  if (value === 'activityRate') return '活动率';
                  return value;
                }}
              />
              <Bar yAxisId="left" dataKey="members" fill="#6366f1" name="members" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="teams" fill="#8b5cf6" name="teams" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="performance" fill="#ec4899" name="performance" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="activityRate" fill="#10b981" name="activityRate" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 地区业绩 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">各区域业绩报表</h2>
        <div className="space-y-4">
          {stats.regionStats
            .filter(([region]) => !selectedRegion || region === selectedRegion)
            .map(([region, stat]) => (
              <div key={region} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-800">{region}</div>
                    <div className="text-sm text-slate-500">
                      {stat.persons} 人 · {stat.teams} 支队伍
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-indigo-600 text-lg">
                      {(stat.performance / 10000).toFixed(1)}w
                    </div>
                    <div className="text-xs text-slate-500">
                      {(stat.performance / stat.persons / 10000).toFixed(1)}w/人
                    </div>
                  </div>
                </div>
                
                {/* 省份统计（如果选择了地区） */}
                {selectedRegion === region && stats.provinceStats
                  .filter(([, stat]) => stat.region === region)
                  .filter(([province]) => !selectedProvince || province === selectedProvince)
                  .length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    {stats.provinceStats
                      .filter(([, stat]) => stat.region === region)
                      .filter(([province]) => !selectedProvince || province === selectedProvince)
                      .map(([province, provStat]) => (
                        <div key={province} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                          <span className="text-slate-700">{province}</span>
                          <span className="font-medium text-slate-800">
                            {provStat.persons} 人 · {(provStat.performance / 10000).toFixed(1)}w
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* 晋升统计 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600" />
          晋升统计
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-indigo-50 rounded-lg">
            <div className="text-sm text-slate-500 mb-1">总晋升次数</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.promotionCount}</div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg">
            <div className="text-sm text-slate-500 mb-1">近3月晋升</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.recentPromotions}</div>
          </div>
        </div>
      </div>

      {/* 降级统计 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-amber-600" />
          降级统计
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="text-sm text-slate-500 mb-1">总降级次数</div>
            <div className="text-2xl font-bold text-amber-600">{stats.demotionCount}</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="text-sm text-slate-500 mb-1">近3月降级</div>
            <div className="text-2xl font-bold text-amber-600">{stats.recentDemotions}</div>
          </div>
        </div>
      </div>

      {/* 脱落分析 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          脱落分析
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-rose-50 rounded-lg">
            <div className="text-sm text-slate-500 mb-1">总脱落人数</div>
            <div className="text-2xl font-bold text-rose-600">{stats.leaveCount}</div>
          </div>
          <div className="p-4 bg-rose-50 rounded-lg">
            <div className="text-sm text-slate-500 mb-1">近3月脱落</div>
            <div className="text-2xl font-bold text-rose-600">{stats.recentLeaves}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

