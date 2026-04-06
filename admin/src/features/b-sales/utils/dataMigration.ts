/**
 * 数据迁移工具 - 将现有树形数据迁移到新格式
 */

import {
  Person,
  Team,
  Region,
  OrganizationData,
  Rank,
  OrgConfigNode,
} from '../types/organization';
import { getTodayBeijing } from '../../../utils/timezone';

interface OldOrgNode {
  name: string;
  role: string;
  sales: string;
  avatar: string;
  region?: string;
  province?: string;
  city?: string;
  children: OldOrgNode[];
}

/**
 * 从角色字符串提取职级
 */
function extractRank(role: string): Rank {
  if (role.includes('区经理')) return '区经理';
  if (role.includes('部经理')) return '部经理';
  if (role.includes('组经理')) return '组经理';
  return '收展员';
}

/**
 * 从销售字符串提取业绩（万元转元）
 */
function extractPerformance(sales: string): number {
  const numStr = sales.replace('w', '').trim();
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num * 10000;
}

/**
 * 生成唯一ID
 */
function generatePersonId(name: string, parentPath: string = ''): string {
  let id = name.replace(/\s+/g, '-').toLowerCase();
  if (parentPath) {
    id = `${parentPath}-${id}`;
  }
  return `person-${id}`;
}

/**
 * 生成队伍ID
 */
function generateTeamId(leaderName: string): string {
  return `team-${leaderName.replace(/\s+/g, '-').toLowerCase()}`;
}

/**
 * 生成地区ID
 */
function generateRegionId(name: string, type: Region['type']): string {
  return `region-${type}-${name.replace(/\s+/g, '-').toLowerCase()}`;
}

/**
 * 转换为Person实体
 */
function convertToPersonEntity(
  node: OldOrgNode,
  parentId: string | undefined,
  teamId: string | undefined,
  regionId: string | undefined,
  provinceId: string | undefined,
  cityId: string | undefined,
  path: string = ''
): Person {
  const id = generatePersonId(node.name, path);
  const rank = extractRank(node.role);
  const performance = extractPerformance(node.sales);

  const timestamp = Date.now().toString().slice(-6);
  const nameInitial = node.name.trim() ? node.name.trim().charAt(0).toUpperCase() : 'U';
  const code = `${nameInitial}${timestamp}${Math.random().toString(36).substr(2, 3)}`;

  return {
    id,
    code,
    name: node.name,
    level: rank,
    originalLevel: rank,
    performance,
    avatarUrl: node.avatar,
    status: '活跃',
    parentId,
    teamId,
    regionId: node.region || regionId,
    provinceId: node.province || provinceId,
    cityId: node.city || cityId,
    joinDate: getTodayBeijing(),
    joinMethod: parentId ? '推荐加入' : '自主加入',
    recommenderId: parentId,
  };
}

/**
 * 创建地区层级
 */
function createRegionHierarchy(persons: Map<string, Person>): Map<string, Region> {
  const regions = new Map<string, Region>();
  const regionMap = new Map<string, string>();

  const regionNames = new Set<string>();
  const provinceNames = new Map<string, string>();
  const cityNames = new Map<string, string>();

  persons.forEach((person) => {
    if (person.regionId) regionNames.add(person.regionId);
    if (person.provinceId && person.regionId) {
      provinceNames.set(person.provinceId, person.regionId);
    }
    if (person.cityId && person.provinceId) {
      cityNames.set(person.cityId, person.provinceId);
    }
  });

  regionNames.forEach((name) => {
    const id = generateRegionId(name, '大区');
    const region: Region = {
      id,
      name,
      type: '大区',
      path: `${id}/`,
    };
    regions.set(id, region);
    regionMap.set(name, id);
  });

  provinceNames.forEach((provinceName, regionName) => {
    const regionId = regionMap.get(regionName);
    if (regionId) {
      const id = generateRegionId(provinceName, '省份');
      const region: Region = {
        id,
        name: provinceName,
        type: '省份',
        parentId: regionId,
        path: `${regionId}/${id}/`,
      };
      regions.set(id, region);
      regionMap.set(provinceName, id);
    }
  });

  cityNames.forEach((cityName, provinceName) => {
    const provinceId = regionMap.get(provinceName);
    if (provinceId) {
      const id = generateRegionId(cityName, '城市');
      const region: Region = {
        id,
        name: cityName,
        type: '城市',
        parentId: provinceId,
        path: regions.get(provinceId)?.path + `${id}/`,
      };
      regions.set(id, region);
    }
  });

  return regions;
}

/**
 * 将旧格式的组织数据迁移到新格式
 */
export function migrateFromOldFormat(
  oldData: OldOrgNode,
  defaultRegion?: string,
  defaultProvince?: string,
  defaultCity?: string
): OrganizationData {
  const persons = new Map<string, Person>();
  const teams = new Map<string, Team>();
  const regions = new Map<string, Region>();

  const convertNode = (
    node: OldOrgNode,
    parentId: string | undefined,
    teamId: string | undefined,
    regionId: string | undefined,
    provinceId: string | undefined,
    cityId: string | undefined,
    path: string = ''
  ): Person => {
    const person = convertToPersonEntity(
      node,
      parentId,
      teamId,
      regionId,
      provinceId,
      cityId,
      path
    );

    persons.set(person.id, person);

    let currentTeamId = teamId;
    if (person.level === '区经理') {
      const teamId_new = generateTeamId(person.name);
      const timestamp = Date.now().toString().slice(-6);
      const teamCode = `T${timestamp}${Math.random().toString(36).substr(2, 3)}`;

      const team: Team = {
        id: teamId_new,
        code: teamCode,
        name: person.name.charAt(0).toUpperCase(),
        leaderId: person.id,
        originalLeaderId: person.id,
        regionId: person.regionId,
        provinceId: person.provinceId,
        cityId: person.cityId,
        memberCount: 1,
        activeCount: 1,
        totalPerformance: person.performance,
        createdDate: person.joinDate,
      };
      teams.set(teamId_new, team);
      person.teamId = teamId_new;
      currentTeamId = teamId_new;
    }

    const currentPath = path ? `${path}-${node.name}` : node.name;
    node.children.forEach((child) => {
      convertNode(
        child,
        person.id,
        currentTeamId,
        person.regionId,
        person.provinceId,
        person.cityId,
        currentPath
      );
    });

    return person;
  };

  let defaultRegionId: string | undefined;
  let defaultProvinceId: string | undefined;
  let defaultCityId: string | undefined;

  if (defaultRegion) {
    defaultRegionId = generateRegionId(defaultRegion, '大区');
    regions.set(defaultRegionId, {
      id: defaultRegionId,
      name: defaultRegion,
      type: '大区',
      path: `${defaultRegionId}/`,
    });
  }

  if (defaultProvince && defaultRegionId) {
    defaultProvinceId = generateRegionId(defaultProvince, '省份');
    regions.set(defaultProvinceId, {
      id: defaultProvinceId,
      name: defaultProvince,
      type: '省份',
      parentId: defaultRegionId,
      path: `${defaultRegionId}/${defaultProvinceId}/`,
    });
  }

  if (defaultCity && defaultProvinceId) {
    defaultCityId = generateRegionId(defaultCity, '城市');
    regions.set(defaultCityId, {
      id: defaultCityId,
      name: defaultCity,
      type: '城市',
      parentId: defaultProvinceId,
      path: regions.get(defaultProvinceId)!.path + `${defaultCityId}/`,
    });
  }

  convertNode(
    oldData,
    undefined,
    undefined,
    defaultRegionId,
    defaultProvinceId,
    defaultCityId
  );

  persons.forEach((person) => {
    if (!person.teamId && person.level !== '区经理') {
      let currentId = person.parentId;
      while (currentId) {
        const parent = persons.get(currentId);
        if (!parent) break;

        if (parent.level === '区经理' && parent.teamId) {
          person.teamId = parent.teamId;
          break;
        }

        currentId = parent.parentId;
      }
    }
  });

  teams.forEach((team) => {
    const members = Array.from(persons.values()).filter((p) => p.teamId === team.id);
    team.memberCount = members.length;
    team.activeCount = members.filter((p) => p.status === '活跃').length;
    team.totalPerformance = members.reduce((sum, p) => sum + p.performance, 0);
  });

  const extractedRegions = createRegionHierarchy(persons);
  extractedRegions.forEach((region, id) => {
    if (!regions.has(id)) {
      regions.set(id, region);
    }
  });

  return {
    persons,
    teams,
    regions,
    promotionHistory: [],
    leaveHistory: [],
    demotionHistory: [],
  };
}

/**
 * 从 OrgConfigNode 格式迁移
 */
export function migrateFromOrgConfigNode(configNode: OrgConfigNode): OrganizationData {
  const convertToOldFormat = (node: OrgConfigNode): OldOrgNode => {
    return {
      name: node.name,
      role: node.role || '收展员',
      sales: node.sales || '0w',
      avatar: node.avatar || '',
      region: undefined,
      province: undefined,
      city: undefined,
      children: node.children.map(convertToOldFormat),
    };
  };

  const oldFormat = convertToOldFormat(configNode);
  return migrateFromOldFormat(oldFormat);
}
