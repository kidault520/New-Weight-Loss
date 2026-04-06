/**
 * 脱落服务 - 处理成员脱落
 */

import { Person, Team, LeaveType, LeaveHistory } from '../types/organization';
import { OrganizationService } from './organizationService';
import { TeamManagementService } from './teamService';
import { getTodayBeijing } from '../../../utils/timezone';

export class LeaveService {
  private orgService: OrganizationService;
  private teamService: TeamManagementService;
  private persons: Map<string, Person>;
  private teams: Map<string, Team>;
  private leaveHistory: LeaveHistory[];

  constructor(orgService: OrganizationService) {
    this.orgService = orgService;
    this.teamService = new TeamManagementService(orgService);
    const data = orgService.getData();
    this.persons = data.persons;
    this.teams = data.teams;
    this.leaveHistory = data.leaveHistory;
  }

  /**
   * 处理主动离职
   */
  handleVoluntaryLeave(personId: string, reason?: string): void {
    this.handleLeave(personId, '主动离职', reason);
  }

  /**
   * 处理业绩不达标脱落
   */
  handlePerformanceLeave(personId: string, reason?: string): void {
    this.handleLeave(personId, '业绩不达标', reason);
  }

  /**
   * 处理违规清退
   */
  handleForcedLeave(personId: string, reason?: string): void {
    this.handleLeave(personId, '违规清退', reason);
  }

  /**
   * 通用脱落处理
   */
  private handleLeave(personId: string, leaveType: LeaveType, reason?: string): void {
    const person = this.persons.get(personId);
    if (!person) {
      throw new Error('人员不存在');
    }

    if (person.status === '脱落') {
      throw new Error('人员已经脱落');
    }

    const leaveDate = getTodayBeijing();

    this.orgService.persons.updateStatus(personId, '脱落', leaveDate);

    const reassignedTeamId = this.reassignSubordinates(personId);

    if (person.level === '区经理' && person.teamId) {
      this.appointNewAreaManager(person.teamId);
    }

    if (person.teamId) {
      this.teamService.updateTeamStats(person.teamId);
    }

    this.recordLeaveHistory(personId, leaveType, leaveDate, reason, reassignedTeamId);
  }

  /**
   * 处理下属归属
   */
  reassignSubordinates(personId: string): string | null {
    const person = this.persons.get(personId);
    if (!person) return null;

    const subordinates = this.orgService.persons.getSubordinates(personId);
    if (subordinates.length === 0) return null;

    let newParentId: string | undefined;
    if (person.parentId) {
      const parent = this.persons.get(person.parentId);
      if (parent && parent.status === '活跃') {
        newParentId = parent.id;
      }
    }

    let targetTeamId = person.teamId || undefined;

    if (!targetTeamId) {
      const team = this.teamService.assignTeamByRegion(
        person.regionId,
        person.provinceId,
        person.cityId,
        person.districtId
      );
      targetTeamId = team?.id;
    }

    subordinates.forEach((subordinate) => {
      if (subordinate.status === '活跃') {
        const updates: Partial<Person> = {};

        if (newParentId) {
          updates.parentId = newParentId;
        }

        if (targetTeamId) {
          updates.teamId = targetTeamId;
        }

        if (Object.keys(updates).length > 0) {
          this.orgService.persons.updatePerson(subordinate.id, updates);
        }
      }
    });

    if (person.teamId && targetTeamId && person.teamId !== targetTeamId) {
      this.teamService.updateTeamStats(person.teamId);
    }
    if (targetTeamId) {
      this.teamService.updateTeamStats(targetTeamId);
    }

    return targetTeamId || null;
  }

  /**
   * 区经脱落时重新任命
   */
  appointNewAreaManager(teamId: string): void {
    const team = this.teams.get(teamId);
    if (!team) return;

    const teamMembers = this.teamService.getTeamMembers(teamId);
    const departmentManagers = teamMembers.filter(
      (p) => p.level === '部经理' && p.status === '活跃'
    );

    if (departmentManagers.length === 0) {
      console.warn(`队伍 ${teamId} 没有可用的部经理来接任区经`);
      return;
    }

    const newLeader = departmentManagers.sort((a, b) => b.performance - a.performance)[0];

    this.orgService.persons.updatePerson(newLeader.id, {
      level: '区经理',
      teamId: teamId,
      promoteDate: getTodayBeijing(),
    });

    this.orgService.teams.updateTeam(teamId, {
      leaderId: newLeader.id,
    });

    this.teamService.updateTeamStats(teamId);
  }

  /**
   * 记录脱落历史
   */
  recordLeaveHistory(
    personId: string,
    leaveType: LeaveType,
    leaveDate: string,
    reason?: string,
    reassignedTeamId?: string | null
  ): LeaveHistory {
    const history: LeaveHistory = {
      id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      personId,
      leaveType,
      leaveDate,
      reason,
      reassignedTeamId: reassignedTeamId || undefined,
    };

    this.leaveHistory.push(history);
    return history;
  }

  /**
   * 获取脱落历史
   */
  getLeaveHistory(personId?: string): LeaveHistory[] {
    if (personId) {
      return this.leaveHistory.filter((h) => h.personId === personId);
    }
    return [...this.leaveHistory];
  }
}
