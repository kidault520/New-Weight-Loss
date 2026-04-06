/**
 * 队伍服务 - 队伍管理和编号生成
 */

import { Team, Person } from '../types/organization';
import { OrganizationService } from './organizationService';
import { generateTeamCode, generateTeamDisplayId, getRegionNameForTeamDisplay } from '../utils/teamIdUtils';
import { getTodayBeijing } from '../../../utils/timezone';

export class TeamManagementService {
  private orgService: OrganizationService;
  private teams: Map<string, Team>;
  private persons: Map<string, Person>;

  constructor(orgService: OrganizationService) {
    this.orgService = orgService;
    const data = orgService.getData();
    this.teams = data.teams;
    this.persons = data.persons;
  }

  /**
   * 创建新队伍
   */
  createTeam(
    leaderId: string,
    leaderName: string,
    regionId?: string,
    provinceId?: string,
    cityId?: string,
    districtId?: string
  ): Team {
    const allTeams = this.orgService.teams.getAllTeams();
    const data = this.orgService.getData();

    const teamName = this.orgService.teams.generateTeamName(leaderName, allTeams);
    const existingCodes = new Set(allTeams.map((t) => t.code));
    const teamCode = generateTeamCode(existingCodes);
    const regionName = getRegionNameForTeamDisplay(regionId, data.regions);
    const createdDate = getTodayBeijing();
    const sameRegionDateCount = allTeams.filter(
      (t) => t.regionId === regionId && t.createdDate === createdDate
    ).length;
    const displayId = generateTeamDisplayId(regionName, createdDate, sameRegionDateCount + 1);

    const newTeam = this.orgService.teams.createTeam({
      code: teamCode,
      displayId,
      name: teamName,
      leaderId,
      originalLeaderId: leaderId,
      regionId,
      provinceId,
      cityId,
      districtId,
      createdDate,
    });

    const leader = this.persons.get(leaderId);
    if (leader) {
      this.orgService.persons.updatePerson(leaderId, {
        teamId: newTeam.id,
      });
    }

    return newTeam;
  }

  /**
   * 按地区匹配或创建队伍
   */
  assignTeamByRegion(
    regionId?: string,
    provinceId?: string,
    cityId?: string,
    districtId?: string
  ): Team | null {
    const teams = this.orgService.teams.getTeamsByRegion(regionId, provinceId, cityId, districtId);

    if (teams.length > 0) {
      return teams.sort((a, b) => a.memberCount - b.memberCount)[0];
    }

    return null;
  }

  /**
   * 更新队伍统计
   */
  updateTeamStats(teamId: string): void {
    this.orgService.teams.updateTeamStats(teamId);
  }

  /**
   * 根据地区查找队伍
   */
  getTeamByRegion(
    regionId?: string,
    provinceId?: string,
    cityId?: string,
    districtId?: string
  ): Team | null {
    const teams = this.orgService.teams.getTeamsByRegion(regionId, provinceId, cityId, districtId);
    return teams.length > 0 ? teams[0] : null;
  }

  /**
   * 获取队伍的所有成员
   */
  getTeamMembers(teamId: string): Person[] {
    return this.orgService.persons.getPersonsByTeam(teamId);
  }

  /**
   * 获取队伍的活跃成员
   */
  getActiveTeamMembers(teamId: string): Person[] {
    const members = this.getTeamMembers(teamId);
    return members.filter((p) => p.status === '活跃');
  }

  /**
   * 获取队伍的区经
   */
  getTeamLeader(teamId: string): Person | null {
    const team = this.teams.get(teamId);
    if (!team) return null;

    return this.persons.get(team.leaderId) || null;
  }

  /**
   * 转移成员到其他队伍
   */
  transferMember(personId: string, newTeamId: string): boolean {
    const person = this.persons.get(personId);
    if (!person) return false;

    const oldTeamId = person.teamId;

    this.orgService.persons.updatePerson(personId, {
      teamId: newTeamId,
    });

    if (oldTeamId) {
      this.updateTeamStats(oldTeamId);
    }
    this.updateTeamStats(newTeamId);

    return true;
  }

  /**
   * 合并队伍（将源队伍的所有成员转移到目标队伍）
   */
  mergeTeams(sourceTeamId: string, targetTeamId: string): boolean {
    const sourceTeam = this.teams.get(sourceTeamId);
    const targetTeam = this.teams.get(targetTeamId);

    if (!sourceTeam || !targetTeam) return false;

    const members = this.getTeamMembers(sourceTeamId);

    members.forEach((member) => {
      this.transferMember(member.id, targetTeamId);
    });

    this.orgService.teams.deleteTeam(sourceTeamId);

    return true;
  }
}
