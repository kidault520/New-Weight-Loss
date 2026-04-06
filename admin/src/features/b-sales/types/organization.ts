/**
 * 组织关系类型定义
 */

export type Rank = '收展员' | '组经理' | '部经理' | '区经理';

// 节点类型：地理节点或人员节点
export type NodeType = 'geographic' | 'person';

// 地理层级类型
export type GeographicLevel = '国内' | '地区' | '省' | '市';

// 人员状态类型（组织内状态）
export type PersonStatus = '活跃' | '脱落' | '晋升中';

// 账号状态类型（登录权限）
export type AccountStatus = '未激活' | '激活' | '禁用';

// 加入方式类型
export type JoinMethod = '推荐加入' | '自主加入' | '外部引进';

// 脱落类型
export type LeaveType = '主动离职' | '业绩不达标' | '违规清退';

export interface OrganizationNode {
  id: string;
  name: string;
  rank: Rank;
  performance: number; // 个人业绩
  directRecommender?: string; // 直接推荐人ID
  directManager?: string; // 直接管理者ID
  children: OrganizationNode[]; // 下级节点
  metadata?: {
    recommendationPath?: string[]; // 推荐路径
    jurisdictionPath?: string[]; // 管辖路径
    cultivationRelations?: CultivationRelation[]; // 培育关系
  };
}

export interface RecommendationRelation {
  type: 'direct' | 'indirect';
  recommenderId: string;
  recommendedId: string;
  path: string[]; // 推荐路径
}

export interface JurisdictionRelation {
  type: 'direct_group' | 'direct_department' | 'direct_area' | 'indirect';
  managerId: string;
  subordinateId: string;
  path: string[]; // 管辖路径
}

export interface CultivationRelation {
  type: 'direct' | 'indirect';
  cultivatorId: string;
  cultivatedId: string;
  cultivatedRank: Rank;
  path: string[]; // 培育路径
}

export interface OrganizationTree {
  root: OrganizationNode;
  nodes: Map<string, OrganizationNode>; // ID -> Node映射
  recommendationMap: Map<string, RecommendationRelation[]>; // 推荐人ID -> 推荐关系列表
  jurisdictionMap: Map<string, JurisdictionRelation[]>; // 管理者ID -> 管辖关系列表
  cultivationMap: Map<string, CultivationRelation[]>; // 培育者ID -> 培育关系列表
}

/**
 * 组织配置节点（用于UI配置，包含地理层级和人员层级）
 */
export interface OrgConfigNode {
  id: string;
  name: string;
  nodeType: NodeType;
  // 地理节点属性
  geographicLevel?: GeographicLevel;
  // 人员节点属性
  role?: string; // 职级：'区经理' | '部经理' | '组经理' | '收展员' | '直辖组员'
  sales?: string; // 业绩，如 '42w'
  avatar?: string; // 头像URL
  // 通用属性
  children: OrgConfigNode[];
}

/**
 * 人员实体（对应数据库 Person 表）
 */
export interface Person {
  id: string;
  code: string; // 人员编号（唯一）
  displayId?: string; // 独立展示ID，格式 S+8位数字，与 code 1:1
  name: string;
  phone?: string; // 手机号，销售默认登录账号
  isActivated?: boolean; // 是否已激活（首次登录后为 true）
  accountStatus?: AccountStatus; // 账号状态：未激活/激活/禁用（禁用后无法登录，管理员可设置）
  birthDate?: string; // 出生年月日 YYYY-MM-DD
  gender?: string; // 性别
  ethnicity?: string; // 民族
  education?: string; // 学历
  idNumber?: string; // 身份证号
  workHistory?: string; // 之前工作履历
  level: Rank; // 当前职级
  originalLevel: Rank; // 加入时职级
  performance: number; // 业绩（元）
  avatarUrl: string;
  status: PersonStatus; // 当前状态
  
  // 组织关系
  parentId?: string; // 直属上级ID（推荐人/直属领导）
  teamId?: string; // 所属队伍ID
  branchId?: string; // 所属分部ID（部经理ID）
  regionId?: string; // 所属大区ID
  provinceId?: string; // 所属省份ID
  cityId?: string; // 所属城市ID
  districtId?: string; // 所属行政区ID
  
  // 时间记录
  joinDate: string; // 加入时间 (YYYY-MM-DD)
  promoteDate?: string; // 最近晋升时间
  leaveDate?: string; // 脱落时间
  
  // 加入方式
  joinMethod?: JoinMethod;
  recommenderId?: string; // 推荐人ID（如果是推荐加入）
  
  // 种子人员标记
  isSeed?: boolean; // 是否为种子人员（第一个加入的人员）
}

/**
 * 队伍实体（对应数据库 Team 表）
 */
export interface Team {
  id: string;
  code: string; // 队伍编号（唯一）TXXXXXX
  displayId?: string; // 显示用ID：team-YYMMDD-regionCode001
  name: string; // 队伍名称 Y, Y1, Y2等（自动生成）
  customName?: string; // 自定义名称（可选）
  leaderId: string; // 区经ID
  originalLeaderId: string; // 创建者ID（第一个区经）
  
  // 归属信息
  regionId?: string;
  provinceId?: string;
  cityId?: string;
  districtId?: string; // 行政区ID
  
  // 统计信息
  memberCount: number; // 成员总数
  activeCount: number; // 活跃成员数
  createdDate: string; // 创建日期 (YYYY-MM-DD)
  
  // 业绩统计
  totalPerformance: number; // 队伍总业绩（元）
  
  // 临时队伍标记
  isTemporary?: boolean; // 是否为临时队伍（未分配人员组成的种子组织）
}

/**
 * 地区层级实体（对应数据库 Region 表）
 */
export interface Region {
  id: string;
  name: string;
  type: '大区' | '省份' | '城市' | '行政区';
  parentId?: string; // 父级地区ID
  path: string; // 层级路径 如：1/3/5/
}

/**
 * 晋升历史记录
 */
export interface PromotionHistory {
  id: string;
  personId: string;
  fromLevel: Rank;
  toLevel: Rank;
  promoteDate: string; // 晋升时间 (YYYY-MM-DD)
  teamId?: string; // 如果晋升为区经，创建的新队伍ID
  reason?: string; // 晋升原因
}

/**
 * 脱落历史记录
 */
export interface LeaveHistory {
  id: string;
  personId: string;
  leaveType: LeaveType;
  leaveDate: string; // 脱落时间 (YYYY-MM-DD)
  reason?: string; // 脱落原因
  reassignedTeamId?: string; // 重新分配的队伍ID（如果有）
}

/**
 * 降级历史记录
 */
export interface DemotionHistory {
  id: string;
  personId: string;
  fromLevel: Rank;
  toLevel: Rank;
  demoteDate: string; // 降级时间 (YYYY-MM-DD)
  reason?: string; // 降级原因
  evaluationRuleId?: string; // 触发的评估规则ID（如果是规则触发的）
}

/**
 * 组织数据集合（完整的数据结构）
 */
export interface OrganizationData {
  persons: Map<string, Person>;
  teams: Map<string, Team>;
  regions: Map<string, Region>;
  promotionHistory: PromotionHistory[];
  leaveHistory: LeaveHistory[];
  demotionHistory: DemotionHistory[];
}
