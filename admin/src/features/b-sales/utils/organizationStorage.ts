/**
 * 组织架构存储服务
 * 使用 localStorage 持久化组织架构数据（包含地理层级和人员层级）
 * 当配置 Supabase 时，自动使用 Supabase 作为后端
 */

import {
  OrgConfigNode,
  OrganizationData,
  Person,
  Team,
  Region,
  PromotionHistory,
  LeaveHistory,
  DemotionHistory,
} from '../types/organization';
import { isSupabaseConfigured } from '@/config/supabase';
import { salesRegionService } from '../services/sales/salesRegionService';
import { salesTeamService } from '../services/sales/salesTeamService';
import { salesPersonService } from '../services/sales/salesPersonService';
import { salesHistoryService } from '../services/sales/salesHistoryService';

const STORAGE_KEY_OLD = 'organization-structure';
const STORAGE_KEY = 'organization-data-v2';
const STORAGE_KEY_PERSONS = 'organization-persons';
const STORAGE_KEY_TEAMS = 'organization-teams';
const STORAGE_KEY_REGIONS = 'organization-regions';
const STORAGE_KEY_PROMOTION_HISTORY = 'organization-promotion-history';
const STORAGE_KEY_LEAVE_HISTORY = 'organization-leave-history';
const STORAGE_KEY_DEMOTION_HISTORY = 'organization-demotion-history';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let _supabaseCache: OrganizationData | null = null;

export class OrganizationStorage {
  /**
   * 初始化（Supabase 模式下异步加载数据到缓存）
   */
  static async initAsync(): Promise<void> {
    if (!isSupabaseConfigured) return;
    _supabaseCache = await loadFromSupabase();
  }

  /**
   * 保存组织架构数据（旧格式，向后兼容）
   */
  static saveOrganization(orgData: OrgConfigNode): void {
    try {
      localStorage.setItem(STORAGE_KEY_OLD, JSON.stringify(orgData));
    } catch (error) {
      console.error('Failed to save organization data:', error);
    }
  }

  /**
   * 加载组织架构数据（旧格式，向后兼容）
   */
  static loadOrganization(): OrgConfigNode | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_OLD);
      if (stored) {
        return JSON.parse(stored) as OrgConfigNode;
      }
    } catch (error) {
      console.error('Failed to load organization data:', error);
    }
    return null;
  }

  /**
   * 保存完整组织数据（新格式）
   * 始终缓存到 localStorage，供订单表单等组件回退使用；Supabase 配置时同时写入云端
   */
  static saveOrganizationData(data: OrganizationData): void {
    try {
      const personsArray = Array.from(data.persons.entries());
      const teamsArray = Array.from(data.teams.entries());
      const regionsArray = Array.from(data.regions.entries());
      localStorage.setItem(STORAGE_KEY_PERSONS, JSON.stringify(personsArray));
      localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(teamsArray));
      localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(regionsArray));
      localStorage.setItem(STORAGE_KEY_PROMOTION_HISTORY, JSON.stringify(data.promotionHistory));
      localStorage.setItem(STORAGE_KEY_LEAVE_HISTORY, JSON.stringify(data.leaveHistory));
      localStorage.setItem(STORAGE_KEY_DEMOTION_HISTORY, JSON.stringify(data.demotionHistory || []));
      localStorage.setItem(STORAGE_KEY, 'v2');
    } catch (error) {
      console.error('Failed to save organization data to cache:', error);
    }
    if (isSupabaseConfigured) {
      saveToSupabase(data).then((d) => { _supabaseCache = d; }).catch((e) => console.error('Failed to save to Supabase:', e));
    }
  }

  /**
   * 加载完整组织数据（新格式）
   * Supabase 有缓存时优先返回；否则从 localStorage 回退
   */
  static loadOrganizationData(): OrganizationData | null {
    if (isSupabaseConfigured && _supabaseCache) {
      return _supabaseCache;
    }
    try {
      const version = localStorage.getItem(STORAGE_KEY);
      if (version !== 'v2') return null;
      const personsArray = localStorage.getItem(STORAGE_KEY_PERSONS);
      const teamsArray = localStorage.getItem(STORAGE_KEY_TEAMS);
      const regionsArray = localStorage.getItem(STORAGE_KEY_REGIONS);
      const promotionHistoryStr = localStorage.getItem(STORAGE_KEY_PROMOTION_HISTORY);
      const leaveHistoryStr = localStorage.getItem(STORAGE_KEY_LEAVE_HISTORY);
      const demotionHistoryStr = localStorage.getItem(STORAGE_KEY_DEMOTION_HISTORY);
      if (!personsArray || !teamsArray || !regionsArray) return null;
      const persons = new Map<string, Person>(JSON.parse(personsArray));
      const teams = new Map<string, Team>(JSON.parse(teamsArray));
      const regions = new Map<string, Region>(JSON.parse(regionsArray));
      const promotionHistory: PromotionHistory[] = promotionHistoryStr ? JSON.parse(promotionHistoryStr) : [];
      const leaveHistory: LeaveHistory[] = leaveHistoryStr ? JSON.parse(leaveHistoryStr) : [];
      const demotionHistory: DemotionHistory[] = demotionHistoryStr ? JSON.parse(demotionHistoryStr) : [];
      return { persons, teams, regions, promotionHistory, leaveHistory, demotionHistory };
    } catch (error) {
      console.error('Failed to load organization data:', error);
      return null;
    }
  }

  /**
   * 保存人员数据
   */
  static savePerson(person: Person): void {
    const data = this.loadOrganizationData();
    if (!data) return;

    data.persons.set(person.id, person);
    this.saveOrganizationData(data);
  }

  /**
   * 保存队伍数据
   */
  static saveTeam(team: Team): void {
    const data = this.loadOrganizationData();
    if (!data) return;

    data.teams.set(team.id, team);
    this.saveOrganizationData(data);
  }

  /**
   * 保存地区数据
   */
  static saveRegion(region: Region): void {
    const data = this.loadOrganizationData();
    if (!data) return;

    data.regions.set(region.id, region);
    this.saveOrganizationData(data);
  }

  /**
   * 添加晋升历史
   */
  static addPromotionHistory(history: PromotionHistory): void {
    const data = this.loadOrganizationData();
    if (!data) return;

    data.promotionHistory.push(history);
    this.saveOrganizationData(data);
  }

  /**
   * 添加脱落历史
   */
  static addLeaveHistory(history: LeaveHistory): void {
    const data = this.loadOrganizationData();
    if (!data) return;

    data.leaveHistory.push(history);
    this.saveOrganizationData(data);
  }

  /**
   * 添加降级历史
   */
  static addDemotionHistory(history: DemotionHistory): void {
    const data = this.loadOrganizationData();
    if (!data) return;

    if (!data.demotionHistory) {
      data.demotionHistory = [];
    }
    data.demotionHistory.push(history);
    this.saveOrganizationData(data);
  }

  /**
   * 清除组织架构数据
   */
  static clearOrganization(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY_PERSONS);
      localStorage.removeItem(STORAGE_KEY_TEAMS);
      localStorage.removeItem(STORAGE_KEY_REGIONS);
      localStorage.removeItem(STORAGE_KEY_PROMOTION_HISTORY);
      localStorage.removeItem(STORAGE_KEY_LEAVE_HISTORY);
      localStorage.removeItem(STORAGE_KEY_OLD);
    } catch (error) {
      console.error('Failed to clear organization data:', error);
    }
  }

  /**
   * 检查是否有保存的组织架构数据
   */
  static hasStoredData(): boolean {
    if (isSupabaseConfigured) {
      return _supabaseCache !== null && (
        _supabaseCache.persons.size > 0 ||
        _supabaseCache.teams.size > 0 ||
        _supabaseCache.regions.size > 0
      );
    }
    return localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem(STORAGE_KEY_OLD) !== null;
  }

  /**
   * 检查是否使用新格式
   */
  static isUsingNewFormat(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'v2';
  }

  /**
   * 加载组织配置（兼容旧格式）
   */
  static loadOrgConfig(): OrgConfigNode | null {
    return this.loadOrganization();
  }
}

async function loadFromSupabase(): Promise<OrganizationData | null> {
  try {
    const [regions, teams, persons, promotionHistory, leaveHistory, demotionHistory] = await Promise.all([
      salesRegionService.getAll(),
      salesTeamService.getAll(),
      salesPersonService.getAll(),
      salesHistoryService.getPromotionHistory(),
      salesHistoryService.getLeaveHistory(),
      salesHistoryService.getDemotionHistory(),
    ]);
    if (regions.length === 0 && teams.length === 0 && persons.length === 0) return null;
    const personsMap = new Map<string, Person>();
    persons.forEach((p) => {
      personsMap.set(p.id, {
        id: p.id,
        code: p.code,
        displayId: p.displayId,
        phone: p.phone,
        isActivated: p.isActivated,
        accountStatus: p.accountStatus,
        birthDate: p.birthDate,
        gender: p.gender,
        ethnicity: p.ethnicity,
        education: p.education,
        idNumber: p.idNumber,
        workHistory: p.workHistory,
        name: p.name,
        level: p.level,
        originalLevel: p.originalLevel,
        performance: p.performance,
        avatarUrl: p.avatarUrl,
        status: p.status,
        parentId: p.parentId,
        teamId: p.teamId,
        branchId: p.branchId,
        regionId: p.regionId,
        provinceId: p.provinceId,
        cityId: p.cityId,
        districtId: p.districtId,
        joinDate: p.joinDate,
        promoteDate: p.promoteDate,
        leaveDate: p.leaveDate,
        joinMethod: p.joinMethod,
        recommenderId: p.recommenderId,
        isSeed: p.isSeed,
      });
    });
    const teamsMap = new Map<string, Team>();
    teams.forEach((t) => {
      teamsMap.set(t.id, {
        id: t.id,
        code: t.code,
        displayId: t.displayId ?? undefined,
        name: t.name,
        customName: t.customName,
        leaderId: t.leaderId || '',
        originalLeaderId: t.originalLeaderId || '',
        regionId: t.regionId,
        provinceId: t.provinceId,
        cityId: t.cityId,
        districtId: t.districtId,
        memberCount: t.memberCount,
        activeCount: t.activeCount,
        totalPerformance: t.totalPerformance,
        createdDate: t.createdDate,
        isTemporary: t.isTemporary,
      });
    });
    const regionsMap = new Map<string, Region>();
    regions.forEach((r) => {
      regionsMap.set(r.id, {
        id: r.id,
        name: r.name,
        type: r.type,
        parentId: r.parentId,
        path: r.path,
      });
    });
    const promoHist: PromotionHistory[] = promotionHistory.map((h) => ({
      id: h.id,
      personId: h.personId,
      fromLevel: h.fromLevel as Person['level'],
      toLevel: h.toLevel as Person['level'],
      promoteDate: h.promoteDate,
      teamId: h.teamId,
      reason: h.reason,
    }));
    const leaveHist: LeaveHistory[] = leaveHistory.map((h) => ({
      id: h.id,
      personId: h.personId,
      leaveType: (h.leaveType as LeaveHistory['leaveType']) || '主动离职',
      leaveDate: h.leaveDate,
      reason: h.reason,
      reassignedTeamId: h.reassignedTeamId,
    }));
    const demoteHist: DemotionHistory[] = demotionHistory.map((h) => ({
      id: h.id,
      personId: h.personId,
      fromLevel: h.fromLevel as Person['level'],
      toLevel: h.toLevel as Person['level'],
      demoteDate: h.demoteDate,
      reason: h.reason,
      evaluationRuleId: h.evaluationRuleId,
    }));
    return {
      persons: personsMap,
      teams: teamsMap,
      regions: regionsMap,
      promotionHistory: promoHist,
      leaveHistory: leaveHist,
      demotionHistory: demoteHist,
    };
  } catch (e) {
    console.error('loadFromSupabase failed:', e);
    return null;
  }
}

async function saveToSupabase(data: OrganizationData): Promise<OrganizationData> {
  const idMap = new Map<string, string>();
  const toUuid = (id: string): string => {
    if (UUID_REGEX.test(id)) return id;
    let u = idMap.get(id);
    if (!u) {
      u = crypto.randomUUID();
      idMap.set(id, u);
    }
    return u;
  };

  for (const [, r] of data.regions) {
    const id = toUuid(r.id);
    await salesRegionService.upsert({ ...r, id });
    if (r.id !== id) idMap.set(r.id, id);
  }
  for (const [, p] of data.persons) {
    const id = toUuid(p.id);
    const parentId = p.parentId ? (idMap.get(p.parentId) ?? (UUID_REGEX.test(p.parentId) ? p.parentId : toUuid(p.parentId))) : undefined;
    const teamId = p.teamId ? (idMap.get(p.teamId) ?? (UUID_REGEX.test(p.teamId) ? p.teamId : toUuid(p.teamId))) : undefined;
    const recommenderId = p.recommenderId ? (idMap.get(p.recommenderId) ?? (UUID_REGEX.test(p.recommenderId) ? p.recommenderId : toUuid(p.recommenderId))) : undefined;
    await salesPersonService.upsert({
      ...p,
      id,
      parentId: parentId ?? p.parentId,
      teamId: teamId ?? p.teamId,
      recommenderId: recommenderId ?? p.recommenderId,
      legacyId: UUID_REGEX.test(p.id) ? undefined : p.id,
    });
    if (p.id !== id) idMap.set(p.id, id);
  }
  for (const [, t] of data.teams) {
    const id = toUuid(t.id);
    const leaderId = t.leaderId ? (idMap.get(t.leaderId) ?? (UUID_REGEX.test(t.leaderId) ? t.leaderId : toUuid(t.leaderId))) : undefined;
    const originalLeaderId = t.originalLeaderId ? (idMap.get(t.originalLeaderId) ?? (UUID_REGEX.test(t.originalLeaderId) ? t.originalLeaderId : toUuid(t.originalLeaderId))) : undefined;
    await salesTeamService.upsert({
      ...t,
      id,
      leaderId: leaderId ?? t.leaderId,
      originalLeaderId: originalLeaderId ?? t.originalLeaderId,
    });
    if (t.id !== id) idMap.set(t.id, id);
  }

  const existingPromo = await salesHistoryService.getPromotionHistory();
  const existingLeave = await salesHistoryService.getLeaveHistory();
  const existingDemote = await salesHistoryService.getDemotionHistory();
  const promoKeys = new Set(existingPromo.map((h) => `${h.personId}|${h.promoteDate}|${h.fromLevel}|${h.toLevel}`));
  const leaveKeys = new Set(existingLeave.map((h) => `${h.personId}|${h.leaveDate}`));
  const demoteKeys = new Set(existingDemote.map((h) => `${h.personId}|${h.demoteDate}|${h.fromLevel}|${h.toLevel}`));

  for (const h of data.promotionHistory) {
    const pid = idMap.get(h.personId) ?? h.personId;
    const key = `${pid}|${h.promoteDate}|${h.fromLevel}|${h.toLevel}`;
    if (!promoKeys.has(key)) {
      await salesHistoryService.addPromotionHistory({ ...h, personId: pid });
      promoKeys.add(key);
    }
  }
  for (const h of data.leaveHistory) {
    const pid = idMap.get(h.personId) ?? h.personId;
    const key = `${pid}|${h.leaveDate}`;
    if (!leaveKeys.has(key)) {
      await salesHistoryService.addLeaveHistory({ ...h, personId: pid });
      leaveKeys.add(key);
    }
  }
  for (const h of data.demotionHistory) {
    const pid = idMap.get(h.personId) ?? h.personId;
    const key = `${pid}|${h.demoteDate}|${h.fromLevel}|${h.toLevel}`;
    if (!demoteKeys.has(key)) {
      await salesHistoryService.addDemotionHistory({ ...h, personId: pid });
      demoteKeys.add(key);
    }
  }

  return (await loadFromSupabase()) ?? data;
}
