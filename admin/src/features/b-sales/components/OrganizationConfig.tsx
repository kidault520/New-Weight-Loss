import React, { useState, useMemo } from 'react';
import { 
  Network, 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Building2,
  X,
  TrendingUp,
  TrendingDown,
  Filter,
  ArrowRight,
  GitMerge,
  Upload,
  BarChart3,
  Scissors,
  MapPin
} from 'lucide-react';
import { apiClient } from '@/config/api';
import { RuleStorage } from '../utils/ruleStorage';
import { orgTreeData } from '../data/orgTreeData';
import { Rank, Person, PersonStatus, OrganizationData } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { OrganizationStorage } from '../utils/organizationStorage';
import { migrateFromOldFormat } from '../utils/dataMigration';
import { AddMemberDialog } from './AddMemberDialog';
import { PromotionDialog } from './PromotionDialog';
import { DemotionDialog } from './DemotionDialog';
import { LeaveDialog } from './LeaveDialog';
import { TransferTeamDialog } from './TransferTeamDialog';
import { TeamMergeDialog } from './TeamMergeDialog';
import { TeamSplitDialog } from './TeamSplitDialog';
import { BatchImportDialog } from './BatchImportDialog';
import { TeamDetailView } from './TeamDetailView';
import { OrganizationReports } from './OrganizationReports';
import { TransferDialog } from './TransferDialog';
import { PersonDetailModal } from './PersonDetailModal';

interface OrgNodeWithId {
  id: string;
  name: string;
  role: string;
  sales: string;
  avatar: string;
  region?: string;
  province?: string;
  city?: string;
  children: OrgNodeWithId[];
}

export const OrganizationConfig: React.FC = () => {
  // 初始化组织服务
  const [orgService] = useState<OrganizationService>(() => {
    const service = new OrganizationService();
    
    // 尝试加载已保存的数据
    let data = OrganizationStorage.loadOrganizationData();
    
    if (!data) {
      // 如果没有新格式数据，尝试迁移旧数据
      const oldData = OrganizationStorage.loadOrganization();
      if (oldData) {
        // 从旧格式迁移
        data = migrateFromOldFormat(orgTreeData as any, '华东地区', '上海市', '上海市');
        // 迁移后立即保存，避免下次加载时再次迁移
        OrganizationStorage.saveOrganizationData(data);
      } else {
        // 只有在完全没有数据时才使用默认数据
        // 检查是否真的没有任何数据（包括旧格式）
        const hasAnyData = OrganizationStorage.hasStoredData();
        if (!hasAnyData) {
          // 使用默认数据
          data = migrateFromOldFormat(orgTreeData as any, '华东地区', '上海市', '上海市');
          // 保存默认数据
          OrganizationStorage.saveOrganizationData(data);
        } else {
          // 如果有旧数据但加载失败，尝试重新加载
          console.warn('数据加载失败，尝试重新加载...');
          data = OrganizationStorage.loadOrganizationData();
          if (!data) {
            // 如果还是失败，使用默认数据
            data = migrateFromOldFormat(orgTreeData as any, '华东地区', '上海市', '上海市');
          }
        }
      }
    }
    
    service.setData(data);
    return service;
  });

  const [orgData, setOrgData] = useState<OrganizationData>(() => orgService.getData());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PersonStatus | '全部'>('全部');
  const [rankFilter, setRankFilter] = useState<Rank | '全部'>('全部');
  
  // 对话框状态
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [showDemotionDialog, setShowDemotionDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showTransferTeamDialog, setShowTransferTeamDialog] = useState(false);
  const [showTeamMergeDialog, setShowTeamMergeDialog] = useState(false);
  const [showTeamSplitDialog, setShowTeamSplitDialog] = useState(false);
  const [showBatchImportDialog, setShowBatchImportDialog] = useState(false);
  const [showTeamDetailView, setShowTeamDetailView] = useState(false);
  const [showOrganizationReports, setShowOrganizationReports] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [demotionTargetLevel, setDemotionTargetLevel] = useState<Rank | undefined>(undefined);
  const [demotionRuleId, setDemotionRuleId] = useState<string | undefined>(undefined);
  // 保存时自动同步到数据库（生成手机号、写入 sales_persons/teams/regions、规则）
  const syncToDatabase = async () => {
    try {
      const data = orgService.getData();
      const usedPhones = new Set<string>();
      const generatePhone = () => {
        let phone: string;
        do {
          const suffix = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
          phone = '191' + suffix;
        } while (usedPhones.has(phone));
        usedPhones.add(phone);
        return phone;
      };

      const personsWithPhones: [string, Person][] = Array.from(data.persons.entries()).map(([id, p]) => {
        const phone = p.phone && p.phone.startsWith('191') ? p.phone : generatePhone();
        return [id, { ...p, phone }];
      });
      const personsMap = new Map<string, Person>(personsWithPhones);
      data.persons = personsMap;
      orgService.setData(data);
      OrganizationStorage.saveOrganizationData(data);
      setOrgData(data);

      const productConfigRaw = localStorage.getItem('b_sales_product_config');
      const productConfig = productConfigRaw ? JSON.parse(productConfigRaw) : null;

      const payload = {
        persons: Array.from(data.persons.entries()),
        teams: Array.from(data.teams.entries()),
        regions: Array.from(data.regions.entries()),
        promotionHistory: data.promotionHistory || [],
        leaveHistory: data.leaveHistory || [],
        demotionHistory: data.demotionHistory || [],
        ruleSet: RuleStorage.getCurrentRuleSet() || undefined,
        productConfig: productConfig || undefined,
        generatePhones: false,
      };

      const res = await apiClient.post<{ success: boolean; message: string; stats: Record<string, number> }>(
        '/api/admin/sync-organization',
        payload
      );
      if (res.success) {
        await OrganizationStorage.initAsync();
        const newData = OrganizationStorage.loadOrganizationData();
        if (newData) {
          orgService.setData(newData);
          setOrgData(newData);
        }
        return true;
      }
      throw new Error(res.message || '同步失败');
    } catch (e: any) {
      console.warn('保存时同步到数据库失败:', e.message);
      return false;
    }
  };

  // 保存数据到存储，并自动同步到数据库（公司添加成员后即写入数据库）
  const saveData = () => {
    const data = orgService.getData();
    OrganizationStorage.saveOrganizationData(data);
    setOrgData(data);
    // 添加/编辑成员后自动同步到数据库，用户激活后即可使用
    syncToDatabase().catch(() => {});
  };

  // 获取所有人员 - 依赖orgData以确保数据更新
  const allPersons = useMemo(() => {
    // 从orgService重新获取最新数据
    const currentData = orgService.getData();
    return Array.from(currentData.persons.values());
  }, [orgData, orgService]);

  // 将 Person 数据转换为树形结构用于显示（构建完整的层级关系）
  const buildTreeFromPersons = useMemo(() => {
    // 使用所有人员构建树形结构，不受过滤影响，确保显示完整组织架构
    // 从orgService重新获取最新数据，确保包含新添加的成员
    const currentData = orgService.getData();
    const persons = Array.from(currentData.persons.values()) as Person[];
    
    // 为未分配人员创建临时队伍（种子组织）
    const tempTeams = orgService.teams.createTemporaryTeamsForUnassigned();
    if (tempTeams.length > 0) {
      // 保存数据（临时队伍已创建）
      OrganizationStorage.saveOrganizationData(orgService.getData());
      // 重新获取最新数据
      const updatedData = orgService.getData();
      const updatedPersons = Array.from(updatedData.persons.values()) as Person[];
      // 使用更新后的人员列表
      persons.splice(0, persons.length, ...updatedPersons);
    }
    
    const root: OrgNodeWithId = {
      id: 'root',
      name: '组织架构',
      role: '根节点',
      sales: '0w',
      avatar: 'https://i.pravatar.cc/150',
      children: [],
    };

    // 按队伍分组，构建层级关系（包括临时队伍）
    const teams = orgService.teams.getAllTeams();
    teams.forEach(team => {
      // 严格过滤：只包含 teamId 明确等于 team.id 且状态为活跃的人员（排除脱落人员）
      const teamMembers = persons.filter(p => {
        return p.teamId && p.teamId === team.id && p.status === '活跃';
      });
      if (teamMembers.length === 0) return;

      // 获取队伍leader，如果没有leaderId，尝试从teamMembers中找区经理
      let leader = team.leaderId ? orgService.persons.getPerson(team.leaderId) : null;
      
      // 如果没有leader，尝试从队伍成员中找区经理
      if (!leader) {
        leader = teamMembers
          .map(p => orgService.persons.getPerson(p.id))
          .find(p => p && p.level === '区经理') || null;
      }
      
      // 如果还是没有leader，使用第一个成员作为leader（临时处理）
      if (!leader && teamMembers.length > 0) {
        leader = orgService.persons.getPerson(teamMembers[0].id) || null;
      }
      
      if (!leader) {
        console.warn(`队伍 ${team.name} (${team.id}) 没有找到leader`);
        return;
      }

      // 区经理节点（只在区经理显示区域信息）
      // 临时队伍使用自定义名称，正式队伍使用leader名称
      const teamNode: OrgNodeWithId = {
        id: team.id,
        name: team.isTemporary ? (team.customName || team.name) : leader.name,
        role: leader.level,
        sales: `${(leader.performance / 10000).toFixed(1)}w`,
        avatar: leader.avatarUrl || 'https://i.pravatar.cc/150', // 添加默认头像
        // 临时队伍显示区域信息，正式队伍只在区经理级别显示
        region: team.isTemporary ? leader.regionId : (leader.level === '区经理' ? leader.regionId : undefined),
        province: team.isTemporary ? leader.provinceId : (leader.level === '区经理' ? leader.provinceId : undefined),
        city: team.isTemporary ? leader.cityId : (leader.level === '区经理' ? leader.cityId : undefined),
        children: [],
      };

      // 构建层级：区经理 -> 部经理 -> 组经理 -> 收展员
      const buildHierarchy = (parentId: string, level: Rank): OrgNodeWithId[] => {
        const subordinates = teamMembers.filter(p => {
          const person = orgService.persons.getPerson(p.id);
          if (!person) return false;
          
          // 关键修复：严格检查 - 人员必须属于当前队伍，且 teamId 不能为 null/undefined
          if (!person.teamId || person.teamId !== team.id) {
            return false; // 不属于当前队伍或未分配，不添加
          }
          
          // 根据层级关系查找下属
          if (level === '区经理') {
            // 区经理的下属可以是：部经理、组经理（直辖组）、收展员（直辖组员）
            return (person.level === '部经理' || person.level === '组经理' || person.level === '收展员') 
              && person.parentId === parentId;
          } else if (level === '部经理') {
            // 部经理的下属是组经理和直属收展员
            return (person.level === '组经理' || person.level === '收展员') && person.parentId === parentId;
          } else if (level === '组经理') {
            // 组经理的下属是收展员
            return person.level === '收展员' && person.parentId === parentId;
          }
          return false;
        });

        return subordinates.map(p => {
          const person = orgService.persons.getPerson(p.id);
          if (!person) return null;
          
          return {
            id: person.id,
            name: person.name,
            role: person.level,
            sales: `${(person.performance / 10000).toFixed(1)}w`,
            avatar: person.avatarUrl || 'https://i.pravatar.cc/150', // 添加默认头像
            // 非区经理不显示区域信息
            children: buildHierarchy(person.id, person.level),
          };
        }).filter(Boolean) as OrgNodeWithId[];
      };

      // 构建区经理的下属层级
      teamNode.children = buildHierarchy(leader.id, leader.level);
      
      // 检查是否有遗漏的成员（通过parentId关系找不到的）
      const includedIds = new Set<string>([leader.id]);
      const collectIds = (nodes: OrgNodeWithId[]) => {
        nodes.forEach(node => {
          includedIds.add(node.id);
          collectIds(node.children);
        });
      };
      collectIds(teamNode.children);
      
      // 找出所有未包含的成员
      const missingMembers = teamMembers.filter(p => !includedIds.has(p.id));
      
      // 如果有遗漏的成员，按职级和parentId关系智能分配
      if (missingMembers.length > 0) {
          missingMembers.forEach(p => {
            const person = orgService.persons.getPerson(p.id);
            if (!person) return;
            
            // 关键修复：严格检查 - 人员必须属于当前队伍，且 teamId 不能为 null/undefined
            if (!person.teamId || person.teamId !== team.id) {
              return; // 不属于当前队伍或未分配，跳过
            }
            
            // 尝试找到合适的父节点
            let targetParent: OrgNodeWithId | null = null;
            
            if (person.parentId) {
              // 如果有parentId，尝试在已有层级中找到父节点
              // 但是，只有当父节点也在当前队伍中时，才添加到队伍树中
              const findParent = (nodes: OrgNodeWithId[]): OrgNodeWithId | null => {
                for (const node of nodes) {
                  if (node.id === person.parentId) {
                    // 检查父节点是否也在当前队伍中
                    const parentPerson = orgService.persons.getPerson(person.parentId);
                    if (parentPerson && parentPerson.teamId === team.id) {
                      return node;
                    }
                    return null; // 父节点不在当前队伍中，不添加
                  }
                  const found = findParent(node.children);
                  if (found) return found;
                }
                return null;
              };
              targetParent = findParent(teamNode.children);
            }
          
          // 如果没有找到父节点，根据职级智能分配
          if (!targetParent) {
            if (person.level === '部经理') {
              // 部经理直接作为区经理的下属
              targetParent = teamNode;
            } else if (person.level === '组经理') {
              // 组经理尝试找到同队伍的部经理
              const deptManager = teamNode.children.find(child => {
                const childPerson = orgService.persons.getPerson(child.id);
                return childPerson && childPerson.level === '部经理';
              });
              targetParent = deptManager || teamNode;
            } else if (person.level === '收展员') {
              // 收展员尝试找到组经理或部经理
              const findManager = (nodes: OrgNodeWithId[]): OrgNodeWithId | null => {
                for (const node of nodes) {
                  const nodePerson = orgService.persons.getPerson(node.id);
                  if (nodePerson && (nodePerson.level === '组经理' || nodePerson.level === '部经理')) {
                    return node;
                  }
                  const found = findManager(node.children);
                  if (found) return found;
                }
                return null;
              };
              targetParent = findManager(teamNode.children) || teamNode;
            }
          }
          
          // 检查是否已经添加过，避免重复
          if (includedIds.has(person.id)) {
            return; // 已经添加过，跳过
          }
          
          // 添加到目标父节点
          const newNode: OrgNodeWithId = {
            id: person.id,
            name: person.name,
            role: person.level,
            sales: `${(person.performance / 10000).toFixed(1)}w`,
            avatar: person.avatarUrl || 'https://i.pravatar.cc/150', // 添加默认头像
            children: [],
          };
          
          if (targetParent) {
            // 再次检查目标父节点下是否已有相同ID的子节点
            const hasDuplicate = targetParent.children.some(child => child.id === person.id);
            if (!hasDuplicate) {
              targetParent.children.push(newNode);
              includedIds.add(person.id);
            }
          }
        });
      }
      
      // 如果还是没有层级关系，使用简单分组（按职级）
      // 重新收集已包含的ID，确保不重复添加
      const finalIncludedIds = new Set<string>([leader.id]);
      const collectFinalIds = (nodes: OrgNodeWithId[]) => {
        nodes.forEach(node => {
          finalIncludedIds.add(node.id);
          collectFinalIds(node.children);
        });
      };
      collectFinalIds(teamNode.children);
      
      if (teamNode.children.length === 0) {
        const otherMembers = teamMembers.filter(p => p.id !== leader.id && !finalIncludedIds.has(p.id));
        const byLevel: Record<Rank, Person[]> = {
          '区经理': [],
          '部经理': [],
          '组经理': [],
          '收展员': [],
        };
        
        otherMembers.forEach(p => {
          const person = orgService.persons.getPerson(p.id);
          if (person && byLevel[person.level]) {
            byLevel[person.level].push(person);
          }
        });

        // 按职级顺序添加
        (['部经理', '组经理', '收展员'] as Rank[]).forEach(level => {
          byLevel[level].forEach(person => {
            if (!finalIncludedIds.has(person.id)) {
              teamNode.children.push({
                id: person.id,
                name: person.name,
                role: person.level,
                sales: `${(person.performance / 10000).toFixed(1)}w`,
                avatar: person.avatarUrl || 'https://i.pravatar.cc/150', // 添加默认头像
                children: [],
              });
              finalIncludedIds.add(person.id);
            }
          });
        });
      }

      root.children.push(teamNode);
    });

    // 未分配队伍的人员（只包含活跃人员）
    const unassigned = persons.filter(p => !p.teamId && p.status === '活跃');
    unassigned.forEach(p => {
      root.children.push({
        id: p.id,
        name: p.name,
        role: p.level,
        sales: `${(p.performance / 10000).toFixed(1)}w`,
        avatar: p.avatarUrl || 'https://i.pravatar.cc/150', // 添加默认头像
        children: [],
      });
    });

    return root;
  }, [orgService, orgData]);

  // 扁平化组织树用于搜索（兼容旧代码）
  const flattenTree = (node: OrgNodeWithId): OrgNodeWithId[] => {
    return [node, ...node.children.flatMap(child => flattenTree(child))];
  };

  /**
   * 构建未分配人员的推荐关系树
   * 按照 parentId 构建树形结构，展示推荐关系
   */
  const buildUnassignedTree = (persons: Person[]): OrgNodeWithId[] => {
    if (persons.length === 0) {
      return [];
    }

    // 职级排序权重
    const rankOrder: Record<Rank, number> = {
      '区经理': 4,
      '部经理': 3,
      '组经理': 2,
      '收展员': 1,
    };

    // 创建人员映射
    const personMap = new Map<string, Person>();
    persons.forEach(p => personMap.set(p.id, p));

    // 构建节点映射
    const nodeMap = new Map<string, OrgNodeWithId>();
    const rootNodes: OrgNodeWithId[] = [];

    // 第一遍：创建所有节点
    persons.forEach(person => {
      const node: OrgNodeWithId = {
        id: person.id,
        name: person.name,
        role: person.level,
        sales: `${(person.performance / 10000).toFixed(1)}w`,
        avatar: person.avatarUrl || 'https://i.pravatar.cc/150', // 添加默认头像
        region: person.regionId,
        province: person.provinceId,
        city: person.cityId,
        children: [],
      };
      nodeMap.set(person.id, node);
    });

    // 第二遍：建立父子关系
    persons.forEach(person => {
      const node = nodeMap.get(person.id)!;
      
      if (person.parentId && personMap.has(person.parentId)) {
        // 有推荐人，添加到推荐人的子节点
        const parentNode = nodeMap.get(person.parentId);
        if (parentNode) {
          parentNode.children.push(node);
        }
      } else {
        // 没有推荐人，是根节点
        rootNodes.push(node);
      }
    });

    // 递归排序：按职级降序，同职级按业绩降序
    const sortTree = (nodes: OrgNodeWithId[]): void => {
      nodes.sort((a, b) => {
        const rankDiff = (rankOrder[b.role as Rank] || 0) - (rankOrder[a.role as Rank] || 0);
        if (rankDiff !== 0) return rankDiff;
        
        const salesA = parseFloat(a.sales.replace('w', '')) || 0;
        const salesB = parseFloat(b.sales.replace('w', '')) || 0;
        return salesB - salesA;
      });
      
      // 递归排序子节点
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortTree(node.children);
        }
      });
    };

    // 排序根节点
    sortTree(rootNodes);

    return rootNodes;
  };

  const allNodes = useMemo(() => flattenTree(buildTreeFromPersons), [buildTreeFromPersons]);

  // 搜索过滤（兼容旧代码）
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return allNodes;
    const query = searchQuery.toLowerCase();
    return allNodes.filter(node => 
      node.name.toLowerCase().includes(query) || 
      node.role.toLowerCase().includes(query)
    );
  }, [allNodes, searchQuery]);

  // 获取下一级职级
  const getNextRank = (currentRank: Rank): Rank => {
    const ranks: Rank[] = ['收展员', '组经理', '部经理', '区经理'];
    const currentIndex = ranks.indexOf(currentRank);
    return currentIndex < ranks.length - 1 ? ranks[currentIndex + 1] : currentRank;
  };

  // 获取上一级职级（用于降级）
  const getPreviousRank = (currentRank: Rank): Rank | null => {
    const ranks: Rank[] = ['收展员', '组经理', '部经理', '区经理'];
    const currentIndex = ranks.indexOf(currentRank);
    return currentIndex > 0 ? ranks[currentIndex - 1] : null;
  };

  // 切换节点展开/折叠
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // 查找节点
  const findNode = (nodes: OrgNodeWithId[], id: string): OrgNodeWithId | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNode(node.children, id);
      if (found) return found;
    }
    return null;
  };


  // 渲染组织树节点（垂直层级列表，类似通讯录）
  const renderTreeNode = (
    node: OrgNodeWithId, 
    level: number = 0,
    _isLast: boolean = false,
    parentIsLast: boolean[] = []
  ): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isFiltered = searchQuery.trim() && !filteredNodes.some(n => n.id === node.id);
    
    // 修复：对于队伍节点（node.id 是队伍ID），需要先找到队伍，然后获取 leader
    let person = orgService.persons.getPerson(node.id);
    
    // 如果 node.id 是队伍ID而不是人员ID，尝试通过队伍找到 leader
    if (!person && node.id !== 'root') {
      const team = orgService.teams.getAllTeams().find(t => t.id === node.id);
      if (team) {
        // 如果有 leaderId，使用 leaderId 获取 person
        if (team.leaderId) {
          person = orgService.persons.getPerson(team.leaderId);
        } else {
          // 如果没有 leaderId（临时队伍），尝试从队伍成员中找第一个成员
          const allPersonsList = orgService.persons.getAllPersons();
          const teamMembers = allPersonsList.filter(p => p.teamId === team.id);
          if (teamMembers.length > 0) {
            person = orgService.persons.getPerson(teamMembers[0].id);
          }
        }
      }
    }
    
    const isAreaManager = person?.level === '区经理';
    // 检查是否是队伍的leader（区经理或临时队伍的leader）
    const team = node.id !== 'root' && person?.teamId ? orgService.teams.getTeam(person.teamId) : null;
    const isTeamLeader = team && (team.leaderId === node.id || team.originalLeaderId === node.id);
    const isTemporaryTeam = team?.isTemporary === true;

    if (isFiltered) return null;

    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleNode(node.id);
    };

    // 计算连接线位置
    const connectorLeft = level > 0 ? (level - 1) * 24 + 12 + 12 : 0;

    return (
      <div key={node.id} className="select-none relative">
        <div
          className="group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {/* 层级连接线 - 修复：不伸到上面，只从当前节点开始 */}
          {level > 0 && (
            <>
              {/* 垂直线 - 只在有后续兄弟节点时显示，从当前节点开始向下 */}
              {parentIsLast.slice(0, -1).map((isLastInPath, idx) => {
                if (isLastInPath) return null; // 如果是最后节点，不画垂直线
                return (
                  <div
                    key={idx}
                    className="absolute w-px bg-slate-300"
                    style={{
                      left: `${idx * 24 + 12 + 12}px`,
                      top: '50%', // 从当前节点中间开始
                      bottom: 0,
                    }}
                  />
                );
              })}
              {/* 水平连接线 */}
              <div
                className="absolute w-3 h-px bg-slate-300"
                style={{
                  left: `${connectorLeft}px`,
                  top: '50%',
                }}
              />
            </>
          )}

          {/* 展开/折叠按钮 */}
          {hasChildren ? (
            <button
              onClick={handleToggle}
              className="p-1 hover:bg-slate-200 rounded transition-colors flex-shrink-0 z-10 relative"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </button>
          ) : (
            <div className="w-6 flex-shrink-0" />
          )}

          {/* 头像+信息+业绩：点击打开个人详情 */}
          <div
            className={`flex items-center gap-3 flex-1 min-w-0 ${person ? 'cursor-pointer hover:bg-slate-50 rounded-lg -m-1 p-1' : ''}`}
            onClick={person ? () => { setEditingPerson(person); setDetailEditMode(false); } : undefined}
          >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
            <img 
              src={node.avatar || 'https://i.pravatar.cc/150'} 
              alt={node.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://i.pravatar.cc/150';
              }}
            />
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            {(isAreaManager || isTemporaryTeam) && team && isTeamLeader ? (
              <>
                <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  {/* 显示队伍 ID */}
                  <span className="text-xs text-slate-500 font-mono">
                    ID: {team.displayId || team.id}
                  </span>
                  {/* 显示编号 */}
                  <span className="text-xs text-slate-600 font-medium">
                    编号: {team.code}
                  </span>
                  {/* 名称输入框 */}
                  <div onClick={(e) => e.stopPropagation()} style={{ pointerEvents: 'auto' }} className="flex-1 min-w-[120px]">
                    <input
                      type="text"
                      defaultValue={team.isTemporary ? (team.customName || team.name) : team.name}
                      onChange={(e) => {
                        e.stopPropagation();
                        // 不在这里保存，避免重新渲染导致失去焦点
                      }}
                      onBlur={(e) => {
                        e.stopPropagation();
                        const newValue = e.target.value.trim();
                        if (newValue) {
                          // 失去焦点时保存
                          // 临时队伍保存到 customName，正式队伍保存到 name
                          if (team.isTemporary) {
                            orgService.teams.updateTeam(team.id, { customName: newValue });
                          } else {
                            orgService.teams.updateTeam(team.id, { name: newValue });
                          }
                          saveData();
                          // 更新显示
                          const newData = orgService.getData();
                          setOrgData({ ...newData });
                        } else {
                          // 如果名称为空，恢复原值
                          e.target.value = team.isTemporary ? (team.customName || team.name) : team.name;
                        }
                      }}
                      onFocus={(e) => {
                        e.stopPropagation();
                        e.target.select(); // 选中所有文本，方便编辑
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.currentTarget.blur(); // 按 Enter 保存
                        }
                        // 允许所有按键操作，包括删除键
                      }}
                      readOnly={false}
                      disabled={false}
                      placeholder="点击编辑名称"
                      className="font-medium text-slate-800 bg-transparent border-b border-slate-300 focus:outline-none focus:border-indigo-500 px-1 min-w-[120px] cursor-text select-text"
                      style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', userSelect: 'text' }}
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-1">
                  <span>
                    {node.role}
                    {/* 显示区域信息 - 去掉region-前缀 */}
                    {node.region && ` · ${node.region.replace(/^region-大区-/, '')}`}
                    {node.province && ` · ${node.province.replace(/^region-省份-/, '')}`}
                    {node.city && ` · ${node.city.replace(/^region-城市-/, '')}`}
                  </span>
                  {/* 临时队伍标识 */}
                  {isTemporaryTeam && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200">
                      种子组织
                    </span>
                  )}
                  {/* 标签显示 */}
                  {person && (() => {
                    const joinDate = new Date(person.joinDate);
                    const now = new Date();
                    const monthsDiff = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
                    const isNewMember = monthsDiff < 3;
                    const formattedDate = person.joinDate.replace(/-/g, '/');
                    
                    // 根据职级显示标签
                    let tagLabel = '';
                    let showTag = false;
                    
                    if (person.name === '彭') {
                      // 只有"彭"显示"新人"标签（3个月内）
                      tagLabel = '新人';
                      showTag = isNewMember;
                    } else if (person.level === '收展员' && isNewMember) {
                      // 收展员在3个月内显示"新人"标签
                      tagLabel = '新人';
                      showTag = true;
                    } else {
                      // 其他成员根据职级显示标签（不需要3个月限制）
                      if (person.level === '组经理') {
                        tagLabel = '组长';
                        showTag = true;
                      } else if (person.level === '部经理') {
                        tagLabel = '部长';
                        showTag = true;
                      } else if (person.level === '区经理') {
                        tagLabel = '区长';
                        showTag = true;
                      }
                    }
                    
                    return (
                      <>
                        {showTag && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded border border-emerald-200">
                            {tagLabel}
                          </span>
                        )}
                        <span>加入时间：{formattedDate}</span>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{node.name}</span>
                  {/* 标签显示 */}
                  {person && (() => {
                    const joinDate = new Date(person.joinDate);
                    const now = new Date();
                    const monthsDiff = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
                    const isNewMember = monthsDiff < 3;
                    
                    // 根据职级显示标签
                    let tagLabel = '';
                    let showTag = false;
                    
                    if (person.name === '彭') {
                      // 只有"彭"显示"新人"标签（3个月内）
                      tagLabel = '新人';
                      showTag = isNewMember;
                    } else if (person.level === '收展员' && isNewMember) {
                      // 收展员在3个月内显示"新人"标签
                      tagLabel = '新人';
                      showTag = true;
                    } else {
                      // 其他成员根据职级显示标签（不需要3个月限制）
                      if (person.level === '组经理') {
                        tagLabel = '组长';
                        showTag = true;
                      } else if (person.level === '部经理') {
                        tagLabel = '部长';
                        showTag = true;
                      } else if (person.level === '区经理') {
                        tagLabel = '区长';
                        showTag = true;
                      }
                    }
                    
                    if (showTag) {
                      return (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded border border-emerald-200">
                          {tagLabel}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>{node.role}</span>
                  {person && (
                    <span>加入时间：{person.joinDate.replace(/-/g, '/')}</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 业绩 */}
          <div className="text-sm font-semibold text-indigo-600">{node.sales}</div>
          </div>

          {/* 操作按钮 */}
          {person && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingPerson(person);
                  setDetailEditMode(true);
                }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="编辑"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {getNextRank(person.level) !== person.level && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPerson(person);
                    setShowPromotionDialog(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                  title="晋升"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
              )}
              {getPreviousRank(person.level) !== null && person.status === '活跃' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPerson(person);
                    setDemotionTargetLevel(undefined);
                    setDemotionRuleId(undefined);
                    setShowDemotionDialog(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                  title="降级"
                >
                  <TrendingDown className="w-4 h-4" />
                </button>
              )}
              {person.status === '活跃' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPerson(person);
                      setShowTransferTeamDialog(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="转换队伍"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPerson(person);
                      setShowLeaveDialog(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="脱落"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child, idx) => 
              renderTreeNode(
                child, 
                level + 1, 
                idx === node.children.length - 1,
                [...parentIsLast, idx === node.children.length - 1]
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* 头部 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">组织配置</h1>
              <p className="text-sm text-slate-500">管理组织架构和人员职级</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加成员
            </button>
            <button
              onClick={() => setShowBatchImportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              批量导入
            </button>
            <button
              onClick={() => setShowOrganizationReports(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              统计报表
            </button>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="space-y-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索成员姓名或职级..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* 过滤器 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">筛选：</span>
            </div>
            {/* 状态过滤 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PersonStatus | '全部')}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="全部">全部状态</option>
              <option value="活跃">活跃</option>
              <option value="脱落">脱落</option>
            </select>
            {/* 职级过滤 */}
            <select
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value as Rank | '全部')}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="全部">全部职级</option>
              <option value="收展员">收展员</option>
              <option value="组经理">组经理</option>
              <option value="部经理">部经理</option>
              <option value="区经理">区经理</option>
            </select>
          </div>
        </div>
      </div>

      {/* 组织树 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">组织架构</h2>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              共 {allPersons.length} 人（活跃: {allPersons.filter(p => p.status === '活跃').length}）
            </div>
            {/* 队伍操作按钮 */}
            <div className="flex items-center gap-2">
              {orgService.teams.getAllTeams().length > 1 && (
                <>
                  <button
                    onClick={() => {
                      // 直接打开对话框，让用户在对话框中选择源队伍
                      setShowTeamMergeDialog(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                    title="合并队伍"
                  >
                    <GitMerge className="w-4 h-4" />
                    合并队伍
                  </button>
                  <button
                    onClick={() => {
                      // 直接打开对话框，让用户在对话框中选择源队伍
                      setShowTeamSplitDialog(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    title="拆分队伍"
                  >
                    <Scissors className="w-4 h-4" />
                    拆分队伍
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6 relative">
          {/* 每个区经理作为独立的组织架构骨架 */}
          {buildTreeFromPersons.children.map((teamNode, idx) => {
            const team = orgService.teams.getAllTeams().find(t => t.id === teamNode.id);
            const leader = orgService.persons.getPerson(team?.leaderId || '');
            const isAreaManager = leader?.level === '区经理';
            const isTemporaryTeam = team?.isTemporary === true;
            
            // 区经理和临时队伍都显示为独立的组织架构骨架
            if (!isAreaManager && !isTemporaryTeam) {
              // 非区经理且非临时队伍，直接显示在根节点下
              return (
                <div key={teamNode.id}>
                  {renderTreeNode(teamNode, 0, idx === buildTreeFromPersons.children.length - 1, [])}
                </div>
              );
            }
            
            // 获取队伍成员数量 - 使用allPersons统计所有人员
            const teamMembersCount = allPersons.filter(p => p.teamId === team?.id).length;
            
            // 区经理和临时队伍显示为独立的组织架构骨架（类似根节点）
            // 临时队伍使用不同的背景色
            const bgColor = isTemporaryTeam ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100';
            const textColor = isTemporaryTeam ? 'text-amber-800' : 'text-indigo-800';
            const iconBgColor = isTemporaryTeam ? 'bg-amber-200' : 'bg-indigo-200';
            const iconTextColor = isTemporaryTeam ? 'text-amber-600' : 'text-indigo-600';
            
            return (
              <div key={teamNode.id} className="space-y-1">
                {/* 队伍的组织架构骨架头部 */}
                <div 
                  className={`flex items-center gap-2 py-2 px-3 rounded-lg ${bgColor} border group cursor-pointer transition-colors`}
                  onDoubleClick={(e) => {
                    // 双击显示队伍详情（避免与输入框编辑冲突）
                    if ((e.target as HTMLElement).tagName !== 'INPUT' && team) {
                      setSelectedTeam(team.id);
                      setShowTeamDetailView(true);
                    }
                  }}
                  onClick={(e) => {
                    // 如果点击的是输入框，不阻止事件
                    if ((e.target as HTMLElement).tagName === 'INPUT') {
                      e.stopPropagation();
                    }
                  }}
                >
                  <div className={`w-10 h-10 rounded-full overflow-hidden ${iconBgColor} flex-shrink-0`}>
                    <Building2 className={`w-10 h-10 ${iconTextColor} p-1`} />
                  </div>
                  <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 显示队伍 ID */}
                      <span className={`text-xs ${isTemporaryTeam ? 'text-amber-500' : 'text-indigo-500'} font-mono`}>
                        ID: {team?.displayId || team?.id || ''}
                      </span>
                      {/* 显示编号 */}
                      <span className={`text-xs ${isTemporaryTeam ? 'text-amber-600' : 'text-indigo-600'} font-medium`}>
                        编号: {team?.code || ''}
                      </span>
                      {/* 名称输入框 */}
                      <div onClick={(e) => e.stopPropagation()} style={{ pointerEvents: 'auto' }} className="flex-1 min-w-[120px]">
                        <input
                          type="text"
                          defaultValue={team?.isTemporary ? (team?.customName || team?.name) : (team?.name || leader?.name || '')}
                          onChange={(e) => {
                            e.stopPropagation();
                            // 不在这里保存，避免重新渲染导致失去焦点
                          }}
                          onBlur={(e) => {
                            e.stopPropagation();
                            const newValue = e.target.value.trim();
                            if (team && newValue) {
                              // 失去焦点时保存
                              // 临时队伍保存到 customName，正式队伍保存到 name
                              if (team.isTemporary) {
                                orgService.teams.updateTeam(team.id, { customName: newValue });
                              } else {
                                orgService.teams.updateTeam(team.id, { name: newValue });
                              }
                              saveData();
                              // 更新显示
                              const newData = orgService.getData();
                              setOrgData({ ...newData });
                            } else if (team && !newValue) {
                              // 如果名称为空，恢复原值
                              e.target.value = team.isTemporary ? (team.customName || team.name) : (team.name || leader?.name || '');
                            }
                          }}
                          onFocus={(e) => {
                            e.stopPropagation();
                            e.target.select(); // 选中所有文本，方便编辑
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.currentTarget.blur(); // 按 Enter 保存
                            }
                            // 允许所有按键操作，包括删除键
                          }}
                          readOnly={false}
                          disabled={false}
                          placeholder="点击编辑名称"
                          className={`font-medium ${textColor} bg-transparent border-b ${isTemporaryTeam ? 'border-amber-300 focus:border-amber-500' : 'border-indigo-300 focus:border-indigo-500'} px-1 min-w-[120px] cursor-text select-text`}
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', userSelect: 'text' }}
                        />
                      </div>
                    </div>
                    <div className={`text-xs ${isTemporaryTeam ? 'text-amber-600' : 'text-indigo-600'} flex items-center gap-2 mt-1`}>
                      <span>
                        {isTemporaryTeam ? '种子组织' : '组织架构'}
                        {/* 显示区域信息 */}
                        {teamNode.region && ` · ${teamNode.region.replace(/^region-大区-/, '')}`}
                        {teamNode.province && ` · ${teamNode.province.replace(/^region-省份-/, '')}`}
                        {teamNode.city && ` · ${teamNode.city.replace(/^region-城市-/, '')}`}
                      </span>
                      {/* 临时队伍标识 */}
                      {team?.isTemporary && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200">
                          种子组织
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${isTemporaryTeam ? 'text-amber-700' : 'text-indigo-700'}`}>
                    {teamMembersCount} 人
                  </div>
                </div>
                {/* 区经理及其下属 */}
                {renderTreeNode(teamNode, 0, true, [])}
              </div>
            );
          })}
          
          {/* 未分配队伍的人员 */}
          {(() => {
            // 收集所有已经在队伍树中显示的人员ID（包括所有子节点）
            const displayedPersonIds = new Set<string>();
            const collectPersonIds = (nodes: OrgNodeWithId[]) => {
              nodes.forEach(node => {
                // 排除队伍节点（teamNode.id 是队伍ID，不是人员ID）
                const person = orgService.persons.getPerson(node.id);
                if (person) {
                  // 关键修复：只有当人员有 teamId 时，才标记为已显示
                  // 如果 teamId 为空/null/undefined，说明是未分配的人员，不应该被标记为已显示
                  if (person.teamId) {
                    displayedPersonIds.add(node.id);
                  }
                }
                // 递归收集子节点
                if (node.children && node.children.length > 0) {
                  collectPersonIds(node.children);
                }
              });
            };
            
            // 收集所有队伍树中的人员ID
            buildTreeFromPersons.children.forEach(teamNode => {
              // 检查是否是队伍节点（通过检查是否有对应的Team对象）
              const team = orgService.teams.getAllTeams().find(t => t.id === teamNode.id);
              if (team) {
                // 这是队伍节点，收集其所有子节点的人员ID（包括leader）
                const leader = orgService.persons.getPerson(team.leaderId || '');
                if (leader) {
                  displayedPersonIds.add(leader.id);
                }
                collectPersonIds(teamNode.children);
              } else {
                // 这不是队伍节点，可能是未分配的人员节点
                const person = orgService.persons.getPerson(teamNode.id);
                if (person) {
                  // 只有当这个人员有teamId时，才认为他已经在队伍树中显示
                  // 如果teamId为空/null/undefined，说明他是未分配的人员，不应该被标记为已显示
                  if (person.teamId) {
                    displayedPersonIds.add(teamNode.id);
                    collectPersonIds(teamNode.children);
                  }
                  // 如果teamId为空，不添加到displayedPersonIds，这样他会在未分配列表中显示
                }
              }
            });
            
            // 直接从所有人员中过滤出真正未分配且未在树中显示的人员（只包含活跃人员）
            // 使用更严格的判断：teamId 必须为空、undefined 或空字符串，且状态为活跃
            const allUnassignedPersons = allPersons.filter(p => {
              const hasNoTeam = !p.teamId || p.teamId === '' || p.teamId === undefined || p.teamId === null;
              return hasNoTeam && p.status === '活跃';
            });
            
            // 过滤掉已经在树中显示的人员
            const unassignedPersons = allUnassignedPersons.filter(person => {
              const isDisplayed = displayedPersonIds.has(person.id);
              return !isDisplayed;
            });
            
            if (unassignedPersons.length > 0) {
              // 按地区分组
              const regionMap = new Map<string, Person[]>();
              unassignedPersons.forEach(person => {
                const region = person.regionId || '未分配地区';
                if (!regionMap.has(region)) {
                  regionMap.set(region, []);
                }
                regionMap.get(region)!.push(person);
              });
              
              return (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-slate-700">
                      未分配队伍的人员 ({unassignedPersons.length}人)
                    </h3>
                    <span className="text-xs text-slate-500 ml-2">
                      (按推荐关系树展示)
                    </span>
                  </div>
                  
                  {/* 按地区分组展示，每个地区内按推荐关系树展示 */}
                  {Array.from(regionMap.entries()).map(([region, persons]) => {
                    const treeNodes = buildUnassignedTree(persons);
                    
                    return (
                      <div key={region} className="mb-4">
                        <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-slate-50 rounded">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="text-xs font-medium text-slate-600">
                            {region}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({persons.length}人)
                          </span>
                        </div>
                        <div className="pl-4">
                          {treeNodes.map((node, idx, arr) => 
                            renderTreeNode(node, 0, idx === arr.length - 1, [])
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* 成员详情弹窗（Tab：个人信息、职级、学习、团队、订单、业绩、考核；铅笔为编辑） */}
      {editingPerson && (
        <PersonDetailModal
          person={editingPerson}
          orgService={orgService}
          onClose={() => setEditingPerson(null)}
          onUpdate={(updatedPerson) => {
            setEditingPerson(updatedPerson);
            saveData();
          }}
          isEditMode={detailEditMode}
        />
      )}

      {/* 添加成员对话框 */}
      {showAddDialog && (
        <AddMemberDialog
          orgService={orgService}
          onSave={(_person) => {
            // 保存并自动同步到数据库
            saveData();
            setShowAddDialog(false);
          }}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {/* 晋升对话框 */}
      {showPromotionDialog && selectedPerson && (
        <PromotionDialog
          orgService={orgService}
          person={selectedPerson}
          targetLevel={getNextRank(selectedPerson.level)}
          onConfirm={(_result) => {
            saveData();
            setShowPromotionDialog(false);
            setSelectedPerson(null);
          }}
          onCancel={() => {
            setShowPromotionDialog(false);
            setSelectedPerson(null);
          }}
        />
      )}

      {/* 降级对话框 */}
      {showDemotionDialog && selectedPerson && (
        <DemotionDialog
          orgService={orgService}
          person={selectedPerson}
          targetLevel={demotionTargetLevel}
          evaluationRuleId={demotionRuleId}
          onConfirm={(_result) => {
            saveData();
            setShowDemotionDialog(false);
            setSelectedPerson(null);
            setDemotionTargetLevel(undefined);
            setDemotionRuleId(undefined);
          }}
          onCancel={() => {
            setShowDemotionDialog(false);
            setSelectedPerson(null);
            setDemotionTargetLevel(undefined);
            setDemotionRuleId(undefined);
          }}
        />
      )}

      {/* 脱落对话框 */}
      {showLeaveDialog && selectedPerson && (
        <LeaveDialog
          orgService={orgService}
          person={selectedPerson}
          onConfirm={() => {
            saveData();
            setShowLeaveDialog(false);
            setSelectedPerson(null);
          }}
          onCancel={() => {
            setShowLeaveDialog(false);
            setSelectedPerson(null);
          }}
        />
      )}

      {/* 转换队伍对话框 */}
      {showTransferTeamDialog && selectedPerson && (
        <TransferTeamDialog
          orgService={orgService}
          person={selectedPerson}
          onConfirm={() => {
            saveData();
            setShowTransferTeamDialog(false);
            setSelectedPerson(null);
          }}
          onCancel={() => {
            setShowTransferTeamDialog(false);
            setSelectedPerson(null);
          }}
        />
      )}

      {/* 队伍合并对话框 */}
      {showTeamMergeDialog && (
        <TeamMergeDialog
          orgService={orgService}
          // 不传递 sourceTeam，让用户在对话框中选择
          onConfirm={() => {
            saveData();
            setShowTeamMergeDialog(false);
            const newData = orgService.getData();
            setOrgData({ ...newData });
          }}
          onCancel={() => {
            setShowTeamMergeDialog(false);
          }}
        />
      )}

      {/* 队伍拆分对话框 */}
      {showTeamSplitDialog && (
        <TeamSplitDialog
          orgService={orgService}
          // 不传递 sourceTeam，让用户在对话框中选择
          onConfirm={() => {
            saveData();
            setShowTeamSplitDialog(false);
            const newData = orgService.getData();
            setOrgData({ ...newData });
          }}
          onCancel={() => {
            setShowTeamSplitDialog(false);
          }}
        />
      )}

      {/* 批量导入对话框 */}
      {showBatchImportDialog && (
        <BatchImportDialog
          orgService={orgService}
          onImport={(_persons) => {
            saveData();
            setShowBatchImportDialog(false);
            const newData = orgService.getData();
            setOrgData({ ...newData });
          }}
          onCancel={() => setShowBatchImportDialog(false)}
        />
      )}

      {/* 队伍详情视图 */}
      {showTeamDetailView && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">队伍详情</h3>
              <button
                onClick={() => {
                  setShowTeamDetailView(false);
                  setSelectedTeam(null);
                }}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <TeamDetailView
                orgService={orgService}
                team={orgService.teams.getTeam(selectedTeam) || null}
                onClose={() => {
                  setShowTeamDetailView(false);
                  setSelectedTeam(null);
                }}
                onUpdate={() => {
                  saveData();
                  const newData = orgService.getData();
                  setOrgData({ ...newData });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 组织统计报表 */}
      {showOrganizationReports && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">组织统计报表</h3>
              <button
                onClick={() => setShowOrganizationReports(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <OrganizationReports orgService={orgService} />
            </div>
          </div>
        </div>
      )}

      {/* 跨区调动对话框 */}
      {showTransferDialog && selectedPerson && (
        <TransferDialog
          orgService={orgService}
          person={selectedPerson}
          onConfirm={() => {
            saveData();
            setShowTransferDialog(false);
            setSelectedPerson(null);
            const newData = orgService.getData();
            setOrgData({ ...newData });
          }}
          onCancel={() => {
            setShowTransferDialog(false);
            setSelectedPerson(null);
          }}
        />
      )}

    </div>
  );
};
