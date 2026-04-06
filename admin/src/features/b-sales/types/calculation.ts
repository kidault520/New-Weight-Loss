/**
 * 计算结果类型定义
 */

import { Rank } from './organization';
import { CommissionType } from './commissionRules';

export interface CommissionItem {
  type: CommissionType;
  name: string;
  amount: number;
  description: string;
  calculation: {
    base: number; // 计算基础
    rate?: number; // 费率
    formula: string; // 计算公式
  };
  status: 'settled' | 'pending' | 'cancelled';
  date: string;
}

export interface PerformanceSummary {
  personalPerformance: number; // 个人业绩
  directGroupPerformance?: number; // 直辖组业绩
  departmentPerformance?: number; // 部业绩
  areaPerformance?: number; // 区业绩
  directRecommendationPerformance?: number; // 直接推荐人员业绩
  indirectRecommendationPerformance?: number; // 间接推荐人员业绩
  directCultivationPerformance?: number; // 直接培育团队业绩
  indirectCultivationPerformance?: number; // 间接培育团队业绩
}

export interface CommissionResult {
  userId: string;
  userName: string;
  rank: Rank;
  period: string; // 计算周期，如 '2025-Q4'
  performance: PerformanceSummary;
  commissions: CommissionItem[];
  totalAmount: number;
  calculatedAt: string;
}

export interface BatchCommissionResult {
  period: string;
  results: CommissionResult[];
  summary: {
    totalAmount: number;
    totalUsers: number;
    byType: Record<CommissionType, number>;
  };
}
