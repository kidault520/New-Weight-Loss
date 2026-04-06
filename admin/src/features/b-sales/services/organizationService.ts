/**
 * 组织服务 - 核心数据管理
 */

import { Person, Team, Region, OrganizationData, PersonStatus, Rank } from '../types/organization';
import { generateTeamCode, generateTeamDisplayId, getRegionNameForTeamDisplay } from '../utils/teamIdUtils';

export class PersonService {
  private persons: Map<string, Person>;

  constructor(data: OrganizationData) {
    this.persons = data.persons;
  }

  /**
   * 创建人员
   */
  createPerson(person: Omit<Person, 'id'> & { code: string }): Person {
    const id = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const existingPersons = Array.from(this.persons.values());
    if (existingPersons.some((p) => p.code === person.code)) {
      throw new Error(`编号 ${person.code} 已存在`);
    }

    const newPerson: Person = {
      ...person,
      id,
      avatarUrl: person.avatarUrl || 'https://i.pravatar.cc/150',
    };
    this.persons.set(id, newPerson);
    return newPerson;
  }

  /**
   * 获取人员
   */
  getPerson(id: string): Person | undefined {
    return this.persons.get(id);
  }

  /**
   * 更新人员
   */
  updatePerson(id: string, updates: Partial<Person>): Person | null {
    const person = this.persons.get(id);
    if (!person) return null;

    const updated = { ...person, ...updates };
    this.persons.set(id, updated);
    return updated;
  }

  /**
   * 删除人员
   */
  deletePerson(id: string): boolean {
    return this.persons.delete(id);
  }

  /**
   * 获取所有人员
   */
  getAllPersons(): Person[] {
    return Array.from(this.persons.values());
  }

  /**
   * 根据状态筛选人员
   */
  getPersonsByStatus(status: PersonStatus): Person[] {
    return Array.from(this.persons.values()).filter((p) => p.status === status);
  }

  /**
   * 根据职级筛选人员
   */
  getPersonsByRank(rank: Rank): Person[] {
    return Array.from(this.persons.values()).filter((p) => p.level === rank);
  }

  /**
   * 根据队伍ID获取人员
   */
  getPersonsByTeam(teamId: string): Person[] {
    return Array.from(this.persons.values()).filter((p) => p.teamId === teamId);
  }

  /**
   * 获取下属人员
   */
  getSubordinates(parentId: string): Person[] {
    return Array.from(this.persons.values()).filter((p) => p.parentId === parentId);
  }

  /**
   * 更新人员状态
   */
  updateStatus(id: string, status: PersonStatus, leaveDate?: string): Person | null {
    return this.updatePerson(id, { status, leaveDate });
  }

  /**
   * 获取推荐的人员列表
   */
  getRecommendedPersons(recommenderId: string): Person[] {
    return Array.from(this.persons.values()).filter((p) => p.recommenderId === recommenderId);
  }

  /**
   * 批量更新人员
   */
  batchUpdatePersons(updates: Array<{ id: string; updates: Partial<Person> }>): void {
    updates.forEach(({ id, updates: personUpdates }) => {
      this.updatePerson(id, personUpdates);
    });
  }
}

export class TeamService {
  private teams: Map<string, Team>;
  private persons: Map<string, Person>;
  private regions: Map<string, Region>;

  constructor(data: OrganizationData) {
    this.teams = data.teams;
    this.persons = data.persons;
    this.regions = data.regions;
  }

  /**
   * 创建队伍
   * 支持 displayId（team-YYMMDD-regionCode001）与 code（TXXXXXX）统一格式
   */
  createTeam(team: Omit<Team, 'id' | 'memberCount' | 'activeCount' | 'totalPerformance'> & { code: string; displayId?: string }): Team {
    const id = team.displayId || `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const existingTeams = Array.from(this.teams.values());
    if (existingTeams.some((t) => t.code === team.code)) {
      throw new Error(`队伍编号 ${team.code} 已存在`);
    }

    const newTeam: Team = {
      ...team,
      id,
      displayId: team.displayId || id,
      memberCount: 0,
      activeCount: 0,
      totalPerformance: 0,
    };
    this.teams.set(id, newTeam);
    return newTeam;
  }

  /**
   * 获取队伍
   */
  getTeam(id: string): Team | undefined {
    return this.teams.get(id);
  }

  /**
   * 更新队伍
   */
  updateTeam(id: string, updates: Partial<Team>): Team | null {
    const team = this.teams.get(id);
    if (!team) return null;

    const updated = { ...team, ...updates };
    this.teams.set(id, updated);
    return updated;
  }

  /**
   * 删除队伍
   */
  deleteTeam(id: string): boolean {
    return this.teams.delete(id);
  }

  /**
   * 获取所有队伍
   */
  getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  /**
   * 根据地区查找队伍
   */
  getTeamsByRegion(regionId?: string, provinceId?: string, cityId?: string, districtId?: string): Team[] {
    return Array.from(this.teams.values()).filter((team) => {
      if (districtId && team.districtId !== districtId) return false;
      if (cityId && team.cityId !== cityId) return false;
      if (provinceId && team.provinceId !== provinceId) return false;
      if (regionId && team.regionId !== regionId) return false;
      return true;
    });
  }

  /**
   * 生成队伍编号（Y, Y1, Y2等）
   */
  generateTeamName(leaderName: string, existingTeams: Team[]): string {
    const baseName = leaderName.charAt(0).toUpperCase();
    const existingNames = existingTeams
      .filter((t) => t.originalLeaderId === existingTeams.find((et) => et.leaderId === t.leaderId)?.originalLeaderId)
      .map((t) => t.name);

    if (!existingNames.includes(baseName)) {
      return baseName;
    }

    let maxNum = 0;
    existingNames.forEach((name) => {
      const match = name.match(/^(.+?)(\d+)$/);
      if (match && match[1] === baseName) {
        const num = parseInt(match[2], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    return `${baseName}${maxNum + 1}`;
  }

  /**
   * 更新队伍统计
   */
  updateTeamStats(teamId: string): void {
    const team = this.teams.get(teamId);
    if (!team) return;

    const members = Array.from(this.persons.values()).filter((p) => p.teamId === teamId);
    const activeMembers = members.filter((p) => p.status === '活跃');
    const totalPerformance = members.reduce((sum, p) => sum + p.performance, 0);

    this.updateTeam(teamId, {
      memberCount: members.length,
      activeCount: activeMembers.length,
      totalPerformance,
    });
  }

  /**
   * 重新计算队伍层级
   */
  recalculateTeamHierarchy(teamId: string): void {
    const team = this.teams.get(teamId);
    if (!team) return;

    this.updateTeamStats(teamId);
  }

  /**
   * 为未分配队伍的人员创建临时队伍（按地区分组）
   */
  createTemporaryTeamsForUnassigned(): Team[] {
    const allPersons = Array.from(this.persons.values());
    const unassignedPersons = allPersons.filter((p) => !p.teamId && p.status === '活跃');

    if (unassignedPersons.length === 0) {
      return [];
    }

    const unassignedByRegion = new Map<string, Person[]>();

    unassignedPersons.forEach((person) => {
      const regionKey =
        [person.cityId, person.provinceId, person.regionId].filter(Boolean).join('-') || '未指定地区';

      if (!unassignedByRegion.has(regionKey)) {
        unassignedByRegion.set(regionKey, []);
      }
      unassignedByRegion.get(regionKey)!.push(person);
    });

    const createdTeams: Team[] = [];

    unassignedByRegion.forEach((regionPersons, _regionKey) => {
      const seedPerson = regionPersons.sort(
        (a, b) => new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()
      )[0];

      const existingTeam = Array.from(this.teams.values()).find(
        (t) =>
          t.isTemporary &&
          t.regionId === seedPerson.regionId &&
          t.provinceId === seedPerson.provinceId &&
          t.cityId === seedPerson.cityId
      );

      if (existingTeam) {
        regionPersons.forEach((person) => {
          if (!person.teamId) {
            const p = this.persons.get(person.id);
            if (p) {
              this.persons.set(person.id, { ...p, teamId: existingTeam.id });
            }
          }
        });
        this.updateTeamStats(existingTeam.id);
        return;
      }

      const regionName = getRegionNameForTeamDisplay(seedPerson.regionId, this.regions);
      const regionDisplayName = seedPerson.cityId || seedPerson.provinceId || seedPerson.regionId || '未知';
      const teamName = `${regionDisplayName}种子组`;

      const existingCodes = new Set(Array.from(this.teams.values()).map((t) => t.code));
      const teamCode = generateTeamCode(existingCodes);
      const sameRegionDateCount = Array.from(this.teams.values()).filter(
        (t) => t.regionId === seedPerson.regionId && t.createdDate === seedPerson.joinDate
      ).length;
      const displayId = generateTeamDisplayId(regionName, seedPerson.joinDate, sameRegionDateCount + 1);

      const tempTeam = this.createTeam({
        code: teamCode,
        displayId,
        name: teamName,
        customName: `${regionName}种子组织`,
        leaderId: seedPerson.id,
        originalLeaderId: seedPerson.id,
        regionId: seedPerson.regionId,
        provinceId: seedPerson.provinceId,
        cityId: seedPerson.cityId,
        districtId: seedPerson.districtId,
        createdDate: seedPerson.joinDate,
        isTemporary: true,
      });

      regionPersons.forEach((person) => {
        const p = this.persons.get(person.id);
        if (p) {
          this.persons.set(person.id, { ...p, teamId: tempTeam.id });
        }
      });

      this.updateTeamStats(tempTeam.id);

      createdTeams.push(tempTeam);
    });

    return createdTeams;
  }

  /**
   * 将临时队伍转化为正式队伍（当有人晋升为区经理时）
   */
  convertTemporaryTeamToFormal(teamId: string, newLeaderId: string): Team | null {
    const team = this.teams.get(teamId);
    if (!team || !team.isTemporary) {
      return null;
    }

    const newLeader = this.persons.get(newLeaderId);
    if (!newLeader || newLeader.level !== '区经理') {
      throw new Error('只有区经理才能将临时队伍转化为正式队伍');
    }

    const allTeams = Array.from(this.teams.values()).filter((t) => !t.isTemporary);
    const formalTeamName = this.generateTeamName(newLeader.name, allTeams);

    const updatedTeam = this.updateTeam(teamId, {
      name: formalTeamName,
      customName: undefined,
      leaderId: newLeaderId,
      originalLeaderId: newLeaderId,
      isTemporary: false,
    });

    const leader = this.persons.get(newLeaderId);
    if (leader) {
      this.persons.set(newLeaderId, { ...leader, teamId: teamId });
    }

    return updatedTeam;
  }
}

export class RegionService {
  private regions: Map<string, Region>;

  constructor(data: OrganizationData) {
    this.regions = data.regions;
  }

  /**
   * 创建地区
   */
  createRegion(region: Omit<Region, 'id' | 'path'>): Region {
    const id = `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const path = this.calculatePath(id, region.parentId);
    const newRegion: Region = {
      ...region,
      id,
      path,
    };
    this.regions.set(id, newRegion);
    return newRegion;
  }

  /**
   * 获取地区
   */
  getRegion(id: string): Region | undefined {
    return this.regions.get(id);
  }

  /**
   * 更新地区
   */
  updateRegion(id: string, updates: Partial<Region>): Region | null {
    const region = this.regions.get(id);
    if (!region) return null;

    const updated = { ...region, ...updates };
    if (updates.parentId !== undefined) {
      updated.path = this.calculatePath(id, updates.parentId);
    }
    this.regions.set(id, updated);
    return updated;
  }

  /**
   * 删除地区
   */
  deleteRegion(id: string): boolean {
    return this.regions.delete(id);
  }

  /**
   * 获取所有地区
   */
  getAllRegions(): Region[] {
    return Array.from(this.regions.values());
  }

  /**
   * 根据类型获取地区
   */
  getRegionsByType(type: Region['type']): Region[] {
    return Array.from(this.regions.values()).filter((r) => r.type === type);
  }

  /**
   * 获取子地区
   */
  getChildRegions(parentId: string): Region[] {
    return Array.from(this.regions.values()).filter((r) => r.parentId === parentId);
  }

  /**
   * 计算层级路径
   */
  private calculatePath(id: string, parentId?: string): string {
    if (!parentId) {
      return `${id}/`;
    }

    const parent = this.regions.get(parentId);
    if (!parent) {
      return `${id}/`;
    }

    return `${parent.path}${id}/`;
  }
}

/**
 * 组织服务主类
 */
export class OrganizationService {
  public persons: PersonService;
  public teams: TeamService;
  public regions: RegionService;
  private data: OrganizationData;

  constructor(data?: OrganizationData) {
    this.data = data || {
      persons: new Map(),
      teams: new Map(),
      regions: new Map(),
      promotionHistory: [],
      leaveHistory: [],
      demotionHistory: [],
    };

    this.persons = new PersonService(this.data);
    this.teams = new TeamService(this.data);
    this.regions = new RegionService(this.data);
  }

  /**
   * 获取完整数据
   */
  getData(): OrganizationData {
    return this.data;
  }

  /**
   * 更新数据
   */
  setData(data: OrganizationData): void {
    this.data = data;
    this.persons = new PersonService(this.data);
    this.teams = new TeamService(this.data);
    this.regions = new RegionService(this.data);
  }
}
