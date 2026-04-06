/**
 * 组织更新服务
 * 执行组织架构自动更新
 */

import { Rank } from '../types/organization';
import { EvaluationNotification } from '../types/commissionRules';
import { OrganizationService } from './organizationService';
import { PromotionService } from './promotionService';
import { DemotionService } from './demotionService';
import { LeaveService } from './leaveService';
import { TeamManagementService } from './teamService';

export interface UpdateResult {
  personId: string;
  personName: string;
  action: string;
  success: boolean;
  error?: string;
}

export class OrganizationUpdateService {
  private orgService: OrganizationService;
  private promotionService: PromotionService;
  private demotionService: DemotionService;
  private leaveService: LeaveService;
  private teamService: TeamManagementService;

  constructor(orgService: OrganizationService) {
    this.orgService = orgService;
    this.promotionService = new PromotionService(orgService);
    this.demotionService = new DemotionService(orgService);
    this.leaveService = new LeaveService(orgService);
    this.teamService = new TeamManagementService(orgService);
  }

  /**
   * 应用审批通过的考核结果
   * @param approvedNotifications 已审批通过的通知列表
   */
  applyEvaluationResults(
    approvedNotifications: EvaluationNotification[]
  ): UpdateResult[] {
    const results: UpdateResult[] = [];

    // 按操作类型分组处理，先处理晋升，再处理降级，最后处理脱落
    const promotions = approvedNotifications.filter(n => n.action === 'promote' && n.targetRank);
    const demotions = approvedNotifications.filter(n => n.action === 'demote' && n.targetRank);
    const leaves = approvedNotifications.filter(n => n.action === 'leave');
    const maintains = approvedNotifications.filter(n => n.action === 'maintain');

    // 1. 处理晋升
    for (const notification of promotions) {
      if (!notification.targetRank) {
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'promote',
          success: false,
          error: '缺少目标职级',
        });
        continue;
      }

      try {
        const result = this.handlePromotion(notification.personId, notification.targetRank);
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'promote',
          success: result.success,
          error: result.error,
        });
      } catch (error) {
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'promote',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. 处理降级
    for (const notification of demotions) {
      if (!notification.targetRank) {
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'demote',
          success: false,
          error: '缺少目标职级',
        });
        continue;
      }

      try {
        const result = this.handleDemotion(notification.personId, notification.targetRank, notification.reason);
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'demote',
          success: result.success,
          error: result.error,
        });
      } catch (error) {
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'demote',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 3. 处理脱落
    for (const notification of leaves) {
      try {
        const result = this.handleLeave(notification.personId, notification.reason);
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'leave',
          success: result.success,
          error: result.error,
        });
      } catch (error) {
        results.push({
          personId: notification.personId,
          personName: notification.personName,
          action: 'leave',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 4. 处理维持（通常不需要操作，但可以记录）
    for (const notification of maintains) {
      results.push({
        personId: notification.personId,
        personName: notification.personName,
        action: 'maintain',
        success: true,
      });
    }

    // 5. 更新组织层级关系
    this.updateOrganizationHierarchy();

    return results;
  }

  /**
   * 处理晋升
   */
  private handlePromotion(personId: string, targetRank: Rank): { success: boolean; error?: string } {
    try {
      const person = this.orgService.persons.getPerson(personId);
      if (!person) {
        return { success: false, error: '人员不存在' };
      }

      if (targetRank === '区经理') {
        const result = this.promotionService.promoteToAreaManager(personId);
        if (!result) {
          return { success: false, error: '晋升失败' };
        }
      } else if (targetRank === '部经理') {
        const result = this.promotionService.promoteToDepartmentManager(personId);
        if (!result) {
          return { success: false, error: '晋升失败' };
        }
      } else if (targetRank === '组经理') {
        const result = this.promotionService.promoteToGroupManager(personId);
        if (!result) {
          return { success: false, error: '晋升失败' };
        }
      } else {
        return { success: false, error: `不支持晋升到${targetRank}` };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 处理降级
   */
  private handleDemotion(
    personId: string,
    targetRank: Rank,
    reason?: string
  ): { success: boolean; error?: string } {
    try {
      const person = this.orgService.persons.getPerson(personId);
      if (!person) {
        return { success: false, error: '人员不存在' };
      }

      const result = this.demotionService.demote(personId, targetRank, reason);
      if (!result) {
        return { success: false, error: '降级失败' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 处理脱落
   */
  private handleLeave(personId: string, reason?: string): { success: boolean; error?: string } {
    try {
      const person = this.orgService.persons.getPerson(personId);
      if (!person) {
        return { success: false, error: '人员不存在' };
      }

      this.leaveService.handlePerformanceLeave(personId, reason);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 更新人员职级（通用方法）
   */
  updatePersonRank(personId: string, newRank: Rank): { success: boolean; error?: string } {
    try {
      const person = this.orgService.persons.getPerson(personId);
      if (!person) {
        return { success: false, error: '人员不存在' };
      }

      const currentRank = person.level;
      const rankOrder: Rank[] = ['收展员', '组经理', '部经理', '区经理'];
      const currentIndex = rankOrder.indexOf(currentRank);
      const newIndex = rankOrder.indexOf(newRank);

      if (currentIndex === -1 || newIndex === -1) {
        return { success: false, error: '无效的职级' };
      }

      if (newIndex > currentIndex) {
        return this.handlePromotion(personId, newRank);
      } else if (newIndex < currentIndex) {
        return this.handleDemotion(personId, newRank);
      } else {
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 更新组织层级关系
   */
  updateOrganizationHierarchy(): void {
    try {
      const allTeams = this.orgService.teams.getAllTeams();
      for (const team of allTeams) {
        this.teamService.updateTeamStats(team.id);
      }
    } catch (error) {
      console.error('更新组织层级关系失败:', error);
    }
  }

  /**
   * 批量更新人员职级
   */
  batchUpdatePersonRanks(
    updates: Array<{ personId: string; newRank: Rank }>
  ): UpdateResult[] {
    const results: UpdateResult[] = [];

    for (const update of updates) {
      const result = this.updatePersonRank(update.personId, update.newRank);
      const person = this.orgService.persons.getPerson(update.personId);
      
      results.push({
        personId: update.personId,
        personName: person?.name || '未知',
        action: 'update_rank',
        success: result.success,
        error: result.error,
      });
    }

    this.updateOrganizationHierarchy();

    return results;
  }
}
