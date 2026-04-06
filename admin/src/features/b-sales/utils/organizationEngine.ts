/**
 * 组织关系引擎
 * 自动识别推荐关系、管辖关系、培育关系
 */

import {
  OrganizationNode,
  OrganizationTree,
  RecommendationRelation,
  JurisdictionRelation,
  CultivationRelation,
  Rank,
} from '../types/organization';

export class OrganizationEngine {
  private tree: OrganizationTree;

  constructor(rootNode: OrganizationNode) {
    this.tree = this.buildTree(rootNode);
    this.analyzeRelations();
  }

  /**
   * 构建组织树结构
   */
  private buildTree(rootNode: OrganizationNode): OrganizationTree {
    const nodes = new Map<string, OrganizationNode>();
    const recommendationMap = new Map<string, RecommendationRelation[]>();
    const jurisdictionMap = new Map<string, JurisdictionRelation[]>();
    const cultivationMap = new Map<string, CultivationRelation[]>();

    // 递归遍历所有节点
    const traverse = (node: OrganizationNode, parentId?: string) => {
      nodes.set(node.id, node);

      if (parentId) {
        node.directRecommender = parentId;
        node.directManager = parentId;
      }

      node.children.forEach((child) => {
        traverse(child, node.id);
      });
    };

    traverse(rootNode);

    return {
      root: rootNode,
      nodes,
      recommendationMap,
      jurisdictionMap,
      cultivationMap,
    };
  }

  /**
   * 分析所有关系
   */
  private analyzeRelations(): void {
    this.analyzeRecommendationRelations();
    this.analyzeJurisdictionRelations();
    this.analyzeCultivationRelations();
  }

  /**
   * 分析推荐关系
   */
  private analyzeRecommendationRelations(): void {
    const { nodes } = this.tree;

    nodes.forEach((node) => {
      const relations: RecommendationRelation[] = [];

      // 直接推荐关系
      if (node.directRecommender) {
        relations.push({
          type: 'direct',
          recommenderId: node.directRecommender,
          recommendedId: node.id,
          path: [node.directRecommender, node.id],
        });
      }

      // 间接推荐关系（向上查找推荐路径）
      const indirectRelations = this.findIndirectRecommendations(node.id);
      relations.push(...indirectRelations);

      if (relations.length > 0) {
        this.tree.recommendationMap.set(node.id, relations);
      }
    });
  }

  /**
   * 查找间接推荐关系
   */
  private findIndirectRecommendations(nodeId: string): RecommendationRelation[] {
    const relations: RecommendationRelation[] = [];
    const node = this.tree.nodes.get(nodeId);
    if (!node || !node.directRecommender) return relations;

    let currentId = node.directRecommender;
    const path = [nodeId];

    // 向上遍历推荐链
    while (currentId) {
      path.unshift(currentId);
      const current = this.tree.nodes.get(currentId);
      if (!current || !current.directRecommender) break;

      // 添加间接推荐关系
      relations.push({
        type: 'indirect',
        recommenderId: current.directRecommender,
        recommendedId: nodeId,
        path: [...path],
      });

      currentId = current.directRecommender;
    }

    return relations;
  }

  /**
   * 分析管辖关系
   */
  private analyzeJurisdictionRelations(): void {
    const { nodes } = this.tree;

    nodes.forEach((node) => {
      const relations: JurisdictionRelation[] = [];

      // 直接管辖关系
      if (node.directManager) {
        const manager = this.tree.nodes.get(node.directManager);
        if (manager) {
          const type = this.getJurisdictionType(manager.rank, node.rank);
          relations.push({
            type,
            managerId: node.directManager,
            subordinateId: node.id,
            path: [node.directManager, node.id],
          });
        }
      }

      // 间接管辖关系
      const indirectRelations = this.findIndirectJurisdictions(node.id);
      relations.push(...indirectRelations);

      if (relations.length > 0) {
        this.tree.jurisdictionMap.set(node.id, relations);
      }
    });
  }

  /**
   * 获取管辖类型
   */
  private getJurisdictionType(managerRank: Rank, subordinateRank: Rank): JurisdictionRelation['type'] {
    if (managerRank === '区经理' && subordinateRank === '部经理') {
      return 'direct_department';
    }
    if (managerRank === '部经理' && subordinateRank === '组经理') {
      return 'direct_group';
    }
    if (managerRank === '区经理' && subordinateRank === '组经理') {
      return 'direct_group';
    }
    return 'indirect';
  }

  /**
   * 查找间接管辖关系
   */
  private findIndirectJurisdictions(nodeId: string): JurisdictionRelation[] {
    const relations: JurisdictionRelation[] = [];
    const node = this.tree.nodes.get(nodeId);
    if (!node || !node.directManager) return relations;

    let currentId = node.directManager;
    const path = [nodeId];

    while (currentId) {
      path.unshift(currentId);
      const current = this.tree.nodes.get(currentId);
      if (!current || !current.directManager) break;

      relations.push({
        type: 'indirect',
        managerId: current.directManager,
        subordinateId: nodeId,
        path: [...path],
      });

      currentId = current.directManager;
    }

    return relations;
  }

  /**
   * 分析培育关系
   */
  private analyzeCultivationRelations(): void {
    const { nodes } = this.tree;

    nodes.forEach((node) => {
      const relations: CultivationRelation[] = [];

      // 查找直接培育关系（同级管理者）
      const directCultivations = this.findDirectCultivations(node.id);
      relations.push(...directCultivations);

      // 查找间接培育关系
      const indirectCultivations = this.findIndirectCultivations(node.id);
      relations.push(...indirectCultivations);

      if (relations.length > 0) {
        this.tree.cultivationMap.set(node.id, relations);
      }
    });
  }

  /**
   * 查找直接培育关系
   */
  private findDirectCultivations(nodeId: string): CultivationRelation[] {
    const relations: CultivationRelation[] = [];
    const node = this.tree.nodes.get(nodeId);
    if (!node || !node.directManager) return relations;

    const manager = this.tree.nodes.get(node.directManager);
    if (!manager) return relations;

    const isManager = (rank: Rank): boolean => {
      return rank === '组经理' || rank === '部经理' || rank === '区经理';
    };

    if (isManager(node.rank)) {
      const isCultivationRelation =
        (node.rank === manager.rank) ||
        (manager.rank === '区经理' && node.rank === '部经理') ||
        (manager.rank === '部经理' && node.rank === '组经理');

      if (isCultivationRelation) {
        relations.push({
          type: 'direct',
          cultivatorId: manager.id,
          cultivatedId: nodeId,
          cultivatedRank: node.rank,
          path: [manager.id, nodeId],
        });
      }
    }

    return relations;
  }

  /**
   * 查找间接培育关系
   */
  private findIndirectCultivations(nodeId: string): CultivationRelation[] {
    const relations: CultivationRelation[] = [];
    const node = this.tree.nodes.get(nodeId);
    if (!node || !node.directManager) return relations;

    const isManager = (rank: Rank): boolean => {
      return rank === '组经理' || rank === '部经理' || rank === '区经理';
    };

    if (!isManager(node.rank)) return relations;

    let currentId = node.directManager;
    const path = [nodeId];

    while (currentId) {
      path.unshift(currentId);
      const current = this.tree.nodes.get(currentId);
      if (!current || !current.directManager) break;

      const grandManager = this.tree.nodes.get(current.directManager);
      if (!grandManager) break;

      const isSameRankIndirect = node.rank === current.rank && current.rank === grandManager.rank;

      const isCrossLevelCultivation =
        (grandManager.rank === '区经理' && current.rank === '部经理' && node.rank === '组经理') ||
        (grandManager.rank === '部经理' && current.rank === '组经理' && node.rank === '组经理');

      if (isSameRankIndirect || isCrossLevelCultivation) {
        relations.push({
          type: 'indirect',
          cultivatorId: grandManager.id,
          cultivatedId: nodeId,
          cultivatedRank: node.rank,
          path: [...path],
        });
      }

      currentId = current.directManager;
    }

    return relations;
  }

  /**
   * 获取直接推荐人员列表
   */
  getDirectRecommendations(userId: string): OrganizationNode[] {
    const node = this.tree.nodes.get(userId);
    if (!node) return [];

    return node.children.filter((child) => child.directRecommender === userId);
  }

  /**
   * 获取间接推荐人员列表
   */
  getIndirectRecommendations(userId: string): OrganizationNode[] {
    const allIndirect: OrganizationNode[] = [];

    this.tree.recommendationMap.forEach((relations, nodeId) => {
      const indirectRelation = relations.find(
        (r) => r.type === 'indirect' && r.recommenderId === userId
      );
      if (indirectRelation) {
        const node = this.tree.nodes.get(nodeId);
        if (node) allIndirect.push(node);
      }
    });

    return allIndirect;
  }

  /**
   * 获取直辖组/部/区
   */
  getDirectJurisdictions(userId: string): {
    groups: OrganizationNode[];
    departments: OrganizationNode[];
    areas: OrganizationNode[];
  } {
    const groups: OrganizationNode[] = [];
    const departments: OrganizationNode[] = [];
    const areas: OrganizationNode[] = [];

    this.tree.jurisdictionMap.forEach((relations, nodeId) => {
      const directRelation = relations.find(
        (r) => r.type !== 'indirect' && r.managerId === userId
      );

      if (directRelation) {
        const node = this.tree.nodes.get(nodeId);
        if (!node) return;

        if (directRelation.type === 'direct_group') {
          groups.push(node);
        } else if (directRelation.type === 'direct_department') {
          departments.push(node);
        } else if (directRelation.type === 'direct_area') {
          areas.push(node);
        }
      }
    });

    return { groups, departments, areas };
  }

  /**
   * 获取直接培育的团队
   */
  getDirectCultivations(userId: string): OrganizationNode[] {
    const cultivated: OrganizationNode[] = [];

    this.tree.cultivationMap.forEach((relations, nodeId) => {
      const directRelation = relations.find(
        (r) => r.type === 'direct' && r.cultivatorId === userId
      );
      if (directRelation) {
        const node = this.tree.nodes.get(nodeId);
        if (node) cultivated.push(node);
      }
    });

    return cultivated;
  }

  /**
   * 获取间接培育的团队
   */
  getIndirectCultivations(userId: string): OrganizationNode[] {
    const cultivated: OrganizationNode[] = [];

    this.tree.cultivationMap.forEach((relations, nodeId) => {
      const indirectRelation = relations.find(
        (r) => r.type === 'indirect' && r.cultivatorId === userId
      );
      if (indirectRelation) {
        const node = this.tree.nodes.get(nodeId);
        if (node) cultivated.push(node);
      }
    });

    return cultivated;
  }

  /**
   * 获取组织树
   */
  getTree(): OrganizationTree {
    return this.tree;
  }

  /**
   * 获取节点
   */
  getNode(userId: string): OrganizationNode | undefined {
    return this.tree.nodes.get(userId);
  }
}
