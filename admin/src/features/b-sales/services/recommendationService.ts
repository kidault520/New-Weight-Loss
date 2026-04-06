/**
 * 推荐人服务 - 处理推荐加入和自主加入逻辑
 */

import { Person, Team, JoinMethod } from '../types/organization';
import { OrganizationService } from './organizationService';
import { generateTeamCode, generateTeamDisplayId, getRegionNameForTeamDisplay } from '../utils/teamIdUtils';
import { getTodayBeijing } from '../../../utils/timezone';

export class RecommendationService {
  private orgService: OrganizationService;
  private persons: Map<string, Person>;

  constructor(orgService: OrganizationService) {
    this.orgService = orgService;
    const data = orgService.getData();
    this.persons = data.persons;
  }

  /**
   * 处理推荐加入
   */
  handleRecommendationJoin(
    personData: Omit<Person, 'id' | 'joinDate' | 'status' | 'level' | 'originalLevel' | 'code'> & { code?: string },
    recommenderId: string
  ): Person {
    const recommender = this.persons.get(recommenderId);
    if (!recommender) {
      throw new Error('推荐人不存在');
    }

    if (recommender.status !== '活跃') {
      return this.handleSelfJoin(personData);
    }

    const teamId = recommender.teamId;
    if (!teamId) {
      throw new Error('推荐人没有所属队伍');
    }

    const code = personData.code || this.generatePersonCode(personData.name);
    const displayId = personData.displayId || this.generateDisplayId();

    const newPerson = this.orgService.persons.createPerson({
      ...personData,
      code,
      displayId,
      joinMethod: '推荐加入',
      recommenderId,
      parentId: recommenderId,
      teamId,
      level: '收展员',
      originalLevel: '收展员',
      status: '活跃',
      joinDate: getTodayBeijing(),
    });

    this.orgService.teams.updateTeamStats(teamId);

    return newPerson;
  }

  /**
   * 处理自主加入
   */
  handleSelfJoin(
    personData: Omit<Person, 'id' | 'joinDate' | 'status' | 'level' | 'originalLevel' | 'teamId' | 'code'> & { code?: string }
  ): Person {
    const teamId = this.assignTeamByRegion(
      personData.regionId,
      personData.provinceId,
      personData.cityId,
      personData.districtId
    );

    const parentId = teamId ? this.findLeaderForNewMember(teamId, personData.regionId) : undefined;

    const code = personData.code || this.generatePersonCode(personData.name);
    const displayId = personData.displayId || this.generateDisplayId();

    const newPerson = this.orgService.persons.createPerson({
      ...personData,
      code,
      displayId,
      joinMethod: '自主加入',
      teamId: teamId || undefined,
      parentId,
      level: '收展员',
      originalLevel: '收展员',
      status: '活跃',
      joinDate: getTodayBeijing(),
    });

    if (teamId) {
      this.orgService.teams.updateTeamStats(teamId);
    }

    return newPerson;
  }

  /**
   * 为新加入的成员找到合适的直属上级
   */
  findLeaderForNewMember(teamId: string | null, _regionId?: string): string | undefined {
    if (!teamId) {
      return undefined;
    }

    const allPersons = Array.from(this.persons.values());

    const areaManagers = allPersons.filter(
      (p) => p.level === '区经理' && p.teamId === teamId && p.status === '活跃'
    );
    if (areaManagers.length > 0) {
      const sorted = areaManagers.sort((a, b) => {
        const aSubs = allPersons.filter((p) => p.parentId === a.id).length;
        const bSubs = allPersons.filter((p) => p.parentId === b.id).length;
        return aSubs - bSubs;
      });
      return sorted[0].id;
    }

    const deptManagers = allPersons.filter(
      (p) => p.level === '部经理' && p.teamId === teamId && p.status === '活跃'
    );
    if (deptManagers.length > 0) {
      const sorted = deptManagers.sort((a, b) => {
        const aSubs = allPersons.filter((p) => p.parentId === a.id).length;
        const bSubs = allPersons.filter((p) => p.parentId === b.id).length;
        return aSubs - bSubs;
      });
      return sorted[0].id;
    }

    const groupManagers = allPersons.filter(
      (p) => p.level === '组经理' && p.teamId === teamId && p.status === '活跃'
    );
    if (groupManagers.length > 0) {
      const sorted = groupManagers.sort((a, b) => {
        const aSubs = allPersons.filter((p) => p.parentId === a.id).length;
        const bSubs = allPersons.filter((p) => p.parentId === b.id).length;
        return aSubs - bSubs;
      });
      return sorted[0].id;
    }

    return undefined;
  }

  /**
   * 获取默认分配队伍（均衡分配逻辑）
   */
  getDefaultTeam(regionId?: string, provinceId?: string, cityId?: string, districtId?: string): Team | null {
    if (!regionId) {
      return null;
    }

    if (!provinceId && !cityId && !districtId) {
      return null;
    }

    const allTeams = this.orgService.teams.getTeamsByRegion(regionId, provinceId, cityId, districtId);
    const teams = allTeams.filter((t) => !t.isTemporary);

    if (teams.length === 0) {
      return null;
    }

    let matchedTeams = teams;

    if (districtId) {
      const districtTeams = teams.filter((t) => t.districtId === districtId);
      if (districtTeams.length > 0) {
        matchedTeams = districtTeams;
      }
    }

    if (cityId && matchedTeams.length > 1) {
      const cityTeams = matchedTeams.filter((t) => t.cityId === cityId);
      if (cityTeams.length > 0) {
        matchedTeams = cityTeams;
      }
    }

    if (provinceId && matchedTeams.length > 1) {
      const provinceTeams = matchedTeams.filter((t) => t.provinceId === provinceId);
      if (provinceTeams.length > 0) {
        matchedTeams = provinceTeams;
      }
    }

    const sortedTeams = matchedTeams.sort((a, b) => a.memberCount - b.memberCount);
    return sortedTeams[0];
  }

  /**
   * 按地区匹配或创建队伍
   */
  assignTeamByRegion(
    regionId?: string,
    provinceId?: string,
    cityId?: string,
    districtId?: string
  ): string | null {
    const defaultTeam = this.getDefaultTeam(regionId, provinceId, cityId, districtId);
    if (defaultTeam) {
      return defaultTeam.id;
    }

    return null;
  }

  /**
   * 推荐人脱落时重新分配
   */
  reassignOnRecommenderLeave(recommenderId: string): void {
    const recommended = this.orgService.persons.getRecommendedPersons(recommenderId);

    recommended.forEach((person) => {
      if (person.status === '活跃') {
        const newTeamId = this.assignTeamByRegion(
          person.regionId,
          person.provinceId,
          person.cityId,
          person.districtId
        );

        if (newTeamId) {
          this.orgService.persons.updatePerson(person.id, {
            teamId: newTeamId,
            parentId: undefined,
            recommenderId: undefined,
          });

          if (person.teamId) {
            this.orgService.teams.updateTeamStats(person.teamId);
          }
          this.orgService.teams.updateTeamStats(newTeamId);
        }
      }
    });
  }

  /**
   * 验证推荐人状态
   */
  validateRecommender(recommenderId: string): { valid: boolean; reason?: string } {
    const recommender = this.persons.get(recommenderId);
    if (!recommender) {
      return { valid: false, reason: '推荐人不存在' };
    }

    if (recommender.status !== '活跃') {
      return { valid: false, reason: '推荐人状态不是活跃' };
    }

    return { valid: true };
  }

  /**
   * 处理外部引进
   */
  handleExternalJoin(
    personData: Omit<Person, 'id' | 'joinDate' | 'status' | 'code'> & { code?: string },
    approvedLevel: '组经理' | '部经理' | '区经理',
    recommenderId?: string
  ): Person {
    if (approvedLevel !== '组经理' && approvedLevel !== '部经理' && approvedLevel !== '区经理') {
      throw new Error('外部引进只能特批为组经理、部经理或区经理');
    }

    let teamId: string | null = null;
    let parentId: string | undefined = undefined;

    const code = personData.code || this.generatePersonCode(personData.name);
    const displayId = personData.displayId || this.generateDisplayId();

    const allTeams = this.orgService.teams.getAllTeams();
    const teamName = this.orgService.teams.generateTeamName(personData.name, allTeams);

    const data = this.orgService.getData();
    const existingCodes = new Set(allTeams.map((t) => t.code));
    const teamCode = generateTeamCode(existingCodes);
    const regionName = getRegionNameForTeamDisplay(personData.regionId, data.regions);
    const createdDate = getTodayBeijing();
    const sameRegionDateCount = allTeams.filter(
      (t) => t.regionId === personData.regionId && t.createdDate === createdDate
    ).length;
    const teamDisplayId = generateTeamDisplayId(regionName, createdDate, sameRegionDateCount + 1);

    const newTeam = this.orgService.teams.createTeam({
      code: teamCode,
      displayId: teamDisplayId,
      name: teamName,
      leaderId: '',
      originalLeaderId: '',
      regionId: personData.regionId,
      provinceId: personData.provinceId,
      cityId: personData.cityId,
      districtId: personData.districtId,
      createdDate,
      isTemporary: true,
      customName: `${personData.cityId || personData.provinceId || personData.regionId || ''}种子`,
    });

    teamId = newTeam.id;

    if (recommenderId) {
      const recommender = this.persons.get(recommenderId);
      if (recommender && recommender.status === '活跃') {
        parentId = recommenderId;
      } else {
        parentId = undefined;
      }
    } else {
      parentId = undefined;
    }

    const newPerson = this.orgService.persons.createPerson({
      ...personData,
      code,
      displayId,
      joinMethod: '外部引进' as JoinMethod,
      level: approvedLevel,
      originalLevel: approvedLevel,
      teamId: teamId || undefined,
      parentId,
      status: '活跃',
      joinDate: getTodayBeijing(),
      avatarUrl: personData.avatarUrl || 'https://i.pravatar.cc/150',
    });

    if (approvedLevel === '区经理' && teamId) {
      this.orgService.teams.updateTeam(teamId, {
        leaderId: newPerson.id,
        originalLeaderId: newPerson.id,
      });
      this.orgService.persons.updatePerson(newPerson.id, {
        teamId: teamId,
      });
    }

    if (teamId) {
      this.orgService.teams.updateTeamStats(teamId);
    }

    return newPerson;
  }

  /**
   * 生成独立的展示ID（格式 S+8位数字，与 code 1:1 对应）
   */
  private generateDisplayId(): string {
    const allPersons = Array.from(this.persons.values());
    let id: string;
    do {
      const num = 10000000 + Math.floor(Math.random() * 89999999);
      id = `S${num}`;
    } while (allPersons.some((p) => p.displayId === id));
    return id;
  }

  /**
   * 生成唯一的人员编号
   */
  private generatePersonCode(name: string): string {
    const timestamp = Date.now().toString().slice(-6);
    const nameInitial = name.trim() ? name.trim().charAt(0).toUpperCase() : 'U';
    let code = `${nameInitial}${timestamp}`;

    let counter = 1;
    const allPersons = Array.from(this.persons.values());
    while (allPersons.some((p) => p.code === code)) {
      code = `${nameInitial}${timestamp}${counter}`;
      counter++;
    }

    return code;
  }

}
