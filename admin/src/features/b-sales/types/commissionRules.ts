/**
 * 佣金规则类型定义
 */

import { Rank } from './organization';

export type CommissionType = 'sales' | 'allowance' | 'training' | 'management' | 'other';

export interface RuleCondition {
  field: string; // 业绩、人力等字段名
  operator: '>=' | '<=' | '==' | '!=';
  value: number;
}

export interface ProductDiscountRate {
  category: string;      // 商品品类
  attribute?: string;   // 商品属性（可选）
  discountRate: number; // 折算率
}

export interface CommissionRule {
  id: string;
  name: string;
  type: CommissionType;
  formula: string; // 公式表达式，如 "performance * discountRate * commissionRate"
  parameters: Record<string, number>; // 费率参数，如 { discountRate: 0.6, commissionRate: 0.27 }
  productDiscountRates?: ProductDiscountRate[]; // 商品品类和属性的折算率配置
  conditions?: RuleCondition[]; // 计算条件
  applicableRanks?: Rank[]; // 适用职级
  effectiveDate?: string; // 生效日期
  expiryDate?: string; // 失效日期
  version?: number; // 规则版本
}

export interface PromotionRule {
  level: number;
  title: string;
  requirements: string; // 考核标准描述（保留用于向后兼容和显示）
  requirementsConditions?: EvaluationCondition[]; // 结构化的考核条件
  benefits: string[]; // 权益列表
  // 可选的进度跟踪字段（用于当前职级）
  progress?: {
    team: number;
    teamTarget: number;
    sales: number;
    salesTarget: number;
  };
}

export interface EvaluationCondition {
  field: string; // 字段名：personalPerformance, teamPerformance, directTeamSize等
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<';
  value: number;
  description?: string; // 中文描述
}

export interface EvaluationRule {
  id: string;
  name: string;
  evaluationPeriod: 'monthly' | 'quarterly' | 'yearly'; // 考核周期
  evaluationDate: string; // 评估时间点（如：每季度末）
  conditions: EvaluationCondition[]; // 达标判断条件
  promotionConditions?: EvaluationCondition[]; // 晋升条件（可选，默认使用conditions）
  demotionConditions?: EvaluationCondition[]; // 降级条件（可选）
  maintainConditions?: EvaluationCondition[]; // 维持条件（可选，默认使用conditions）
  applicableRanks?: Rank[]; // 适用职级
  minTenureMonths?: number; // 晋升到该职级所需的最短任职时间（月）
  minTenureMonthsForEvaluation?: number; // 参与考核所需的最短任职时间（月）
}

export interface RuleSet {
  id: string;
  name: string;
  version: number;
  effectiveDate: string;
  rules: CommissionRule[];
  description?: string;
  promotionRules?: PromotionRule[];
  evaluationRules?: EvaluationRule[];
}

export interface RuleUpdate {
  ruleId: string;
  parameters: Record<string, number>;
  effectiveDate?: string;
  reason?: string;
}

/**
 * 考核通知相关类型
 */
export type EvaluationAction = 'promote' | 'maintain' | 'demote' | 'leave';
export type NotificationStatus = 'pending' | 'approved' | 'rejected';

export interface EvaluationNotification {
  id: string;
  personId: string;
  personName: string;
  currentRank: Rank;
  evaluationPeriod: string; // 如 '2025-Q4'
  evaluationDate: string; // 考核日期 (YYYY-MM-DD)
  action: EvaluationAction; // 建议操作：晋升/维持/降级/脱落
  targetRank?: Rank; // 目标职级（如果是晋升或降级）
  reason: string; // 原因说明
  conditionDetails: Array<{
    condition: EvaluationCondition;
    actualValue: number;
    passed: boolean;
  }>; // 条件详情
  status: NotificationStatus; // 审批状态
  createdAt: string; // 创建时间
  approvedAt?: string; // 审批时间
  approvedBy?: string; // 审批人
  rejectReason?: string; // 驳回原因
}
