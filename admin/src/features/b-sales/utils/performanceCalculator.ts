/**
 * 业绩统计模块
 * 计算个人、直辖、培育团队业绩
 */

import { OrganizationNode } from '../types/organization';
import { PerformanceSummary } from '../types/calculation';
import { OrganizationEngine } from './organizationEngine';

export class PerformanceCalculator {
  private engine: OrganizationEngine;

  constructor(engine: OrganizationEngine) {
    this.engine = engine;
  }

  /**
   * 计算个人业绩
   */
  calculatePersonalPerformance(userId: string): number {
    const node = this.engine.getNode(userId);
    return node?.performance || 0;
  }

  /**
   * 计算直辖组业绩（组经理的直辖组业绩）
   */
  calculateDirectGroupPerformance(userId: string): number {
    const { groups } = this.engine.getDirectJurisdictions(userId);
    let total = 0;

    groups.forEach((group) => {
      total += this.calculateGroupTotalPerformance(group);
    });

    return total;
  }

  /**
   * 计算组总业绩（组经理个人 + 所有组员）
   */
  private calculateGroupTotalPerformance(groupNode: OrganizationNode): number {
    let total = groupNode.performance;

    const calculateRecursive = (node: OrganizationNode) => {
      node.children.forEach((child) => {
        total += child.performance;
        if (child.children.length > 0) {
          calculateRecursive(child);
        }
      });
    };

    calculateRecursive(groupNode);
    return total;
  }

  /**
   * 计算部总业绩（部经理个人 + 所有直辖组和直辖组员）
   */
  calculateDepartmentPerformance(userId: string): number {
    const node = this.engine.getNode(userId);
    if (!node || node.rank !== '部经理') return 0;

    let total = node.performance;

    const { groups } = this.engine.getDirectJurisdictions(userId);
    groups.forEach((group) => {
      total += this.calculateGroupTotalPerformance(group);
    });

    node.children.forEach((child) => {
      if (child.rank === '收展员') {
        total += child.performance;
      }
    });

    return total;
  }

  /**
   * 计算区总业绩（区经理个人 + 所有直辖部和直辖组）
   */
  calculateAreaPerformance(userId: string): number {
    const node = this.engine.getNode(userId);
    if (!node || node.rank !== '区经理') return 0;

    let total = node.performance;

    const { departments } = this.engine.getDirectJurisdictions(userId);
    departments.forEach((dept) => {
      total += this.calculateDepartmentPerformance(dept.id);
    });

    const { groups } = this.engine.getDirectJurisdictions(userId);
    groups.forEach((group) => {
      total += this.calculateGroupTotalPerformance(group);
    });

    node.children.forEach((child) => {
      if (child.rank === '收展员') {
        total += child.performance;
      }
    });

    return total;
  }

  /**
   * 计算个人直接推荐人员业绩总和
   */
  calculateDirectRecommendationPerformance(userId: string): number {
    const directRecommendations = this.engine.getDirectRecommendations(userId);
    let total = 0;

    directRecommendations.forEach((person) => {
      total += person.performance;
    });

    return total;
  }

  /**
   * 计算个人间接推荐人员业绩总和
   */
  calculateIndirectRecommendationPerformance(userId: string): number {
    const indirectRecommendations = this.engine.getIndirectRecommendations(userId);
    let total = 0;

    indirectRecommendations.forEach((person) => {
      total += person.performance;
    });

    return total;
  }

  /**
   * 计算直接培育团队业绩
   */
  calculateDirectCultivationPerformance(userId: string): number {
    const directCultivations = this.engine.getDirectCultivations(userId);
    let total = 0;

    directCultivations.forEach((team) => {
      if (team.rank === '部经理') {
        total += this.calculateDepartmentPerformance(team.id);
      } else if (team.rank === '组经理') {
        total += this.calculateGroupTotalPerformance(team);
      } else if (team.rank === '区经理') {
        total += this.calculateAreaPerformance(team.id);
      }
    });

    return total;
  }

  /**
   * 计算间接培育团队业绩
   */
  calculateIndirectCultivationPerformance(userId: string): number {
    const indirectCultivations = this.engine.getIndirectCultivations(userId);
    let total = 0;

    indirectCultivations.forEach((team) => {
      if (team.rank === '部经理') {
        total += this.calculateDepartmentPerformance(team.id);
      } else if (team.rank === '组经理') {
        total += this.calculateGroupTotalPerformance(team);
      }
    });

    return total;
  }

  /**
   * 计算完整的业绩汇总
   */
  calculatePerformanceSummary(userId: string): PerformanceSummary {
    const node = this.engine.getNode(userId);
    if (!node) {
      return {
        personalPerformance: 0,
      };
    }

    const summary: PerformanceSummary = {
      personalPerformance: this.calculatePersonalPerformance(userId),
    };

    if (node.rank === '组经理') {
      summary.directGroupPerformance = this.calculateDirectGroupPerformance(userId);
    } else if (node.rank === '部经理') {
      summary.departmentPerformance = this.calculateDepartmentPerformance(userId);
      summary.directGroupPerformance = this.calculateDirectGroupPerformance(userId);
    } else if (node.rank === '区经理') {
      summary.areaPerformance = this.calculateAreaPerformance(userId);
      summary.departmentPerformance = this.calculateDepartmentPerformance(userId);
      summary.directGroupPerformance = this.calculateDirectGroupPerformance(userId);
    }

    summary.directRecommendationPerformance = this.calculateDirectRecommendationPerformance(userId);
    summary.indirectRecommendationPerformance = this.calculateIndirectRecommendationPerformance(userId);
    summary.directCultivationPerformance = this.calculateDirectCultivationPerformance(userId);
    summary.indirectCultivationPerformance = this.calculateIndirectCultivationPerformance(userId);

    return summary;
  }
}
