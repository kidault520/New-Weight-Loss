/**
 * 佣金规则配置模块
 */

import { CommissionRule, RuleSet } from '../types/commissionRules';
import { Rank } from '../types/organization';

/**
 * 获取默认规则配置
 */
export function getDefaultRules(): RuleSet {
  return {
    id: 'default-rules-v2',
    name: '默认规则配置',
    version: 2,
    effectiveDate: '2025-01-01',
    description: '基本法默认费率规则（5个主要规则）',
    rules: [
      {
        id: 'sales-commission',
        name: '销售佣金',
        type: 'sales',
        formula: 'performance * discountRate * commissionRate',
        parameters: {
          discountRate: 0.6,
          commissionRate: 0.27,
        },
        productDiscountRates: [
          { category: '长寿管理', attribute: '尊享版', discountRate: 0.65 },
          { category: '长寿管理', attribute: '全案版', discountRate: 0.60 },
          { category: '抗衰产品', attribute: 'NMN', discountRate: 0.55 },
          { category: '抗衰产品', attribute: 'GLP-1', discountRate: 0.58 },
        ],
        applicableRanks: ['收展员', '组经理', '部经理', '区经理'],
      },
      {
        id: 'personal-allowance',
        name: '个人津贴',
        type: 'allowance',
        formula: 'directRecommendationPerformance * directRecommendationAllowanceRate + indirectRecommendationPerformance * indirectRecommendationAllowanceRate',
        parameters: {
          directRecommendationAllowanceRate: 0.05,
          indirectRecommendationAllowanceRate: 0,
        },
        applicableRanks: ['收展员', '组经理', '部经理', '区经理'],
      },
      {
        id: 'management-allowance',
        name: '管理津贴',
        type: 'management',
        formula: 'groupPerformance * groupRate | departmentPerformance * departmentRate | areaPerformance * areaRate',
        parameters: {
          groupRate: 0.02,
          departmentRate: 0.03,
          areaRate: 0.04,
        },
        applicableRanks: ['组经理', '部经理', '区经理'],
      },
      {
        id: 'direct-training-allowance',
        name: '直接培育津贴',
        type: 'training',
        formula: 'directCultivationPerformance * groupRate | directCultivationPerformance * departmentRate | directCultivationPerformance * areaRate',
        parameters: {
          groupRate: 0.02,
          departmentRate: 0.03,
          areaRate: 0.03,
        },
        applicableRanks: ['组经理', '部经理', '区经理'],
      },
      {
        id: 'indirect-training-allowance',
        name: '间接培育津贴',
        type: 'training',
        formula: 'indirectCultivationPerformance * groupRate | indirectCultivationPerformance * departmentRate | indirectCultivationPerformance * areaRate',
        parameters: {
          groupRate: 0.01,
          departmentRate: 0.01,
          areaRate: 0.02,
        },
        applicableRanks: ['组经理', '部经理', '区经理'],
      },
    ],
    promotionRules: [
      { level: 1, title: '正式收展员', requirements: '如期转正：通过新人班考核，不连续三个月挂0；每月3w-1/季度8w，不连续两个月挂0。', benefits: ['销售佣金', '新人津贴'] },
      { level: 2, title: '组经理', requirements: '最小直管人力≥4人（直接推荐≥3人）；小组业绩季度≥50w；个人≥10w/季度。', benefits: ['管理津贴 (直辖组)', '培育奖金'] },
      { level: 3, title: '部经理', requirements: '直管人力≥12人，直辖人力≥4人；直辖组≥2个（含直接或间接培育）；部业绩季度≥200w；个人≥12w/季度。', benefits: ['部管理津贴', '辅导津贴'] },
      { level: 4, title: '区经理', requirements: '直管人力≥28人，直辖人力≥4人；直辖部≥2个（含直接或间接培育）；区业绩季度≥400w；个人≥15w/季度。', benefits: ['区年终分红', '高级医疗福利', '期权池'] },
    ],
    evaluationRules: [
      {
        id: 'quarterly-evaluation-all',
        name: '收展员季度考核',
        evaluationPeriod: 'quarterly',
        evaluationDate: 'quarter-end',
        conditions: [
          { field: 'personalPerformance', operator: '>=', value: 80000, description: '个人业绩≥8w（季度）' },
        ],
        applicableRanks: ['收展员'],
        minTenureMonths: 0,
        minTenureMonthsForEvaluation: 0,
      },
      {
        id: 'quarterly-evaluation-group',
        name: '组经理季度考核',
        evaluationPeriod: 'quarterly',
        evaluationDate: 'quarter-end',
        conditions: [
          { field: 'directTeamSize', operator: '>=', value: 4, description: '最小直管人力≥4人' },
          { field: 'directRecommendationCount', operator: '>=', value: 3, description: '直接推荐≥3人' },
          { field: 'groupPerformance', operator: '>=', value: 500000, description: '小组业绩季度≥50w' },
          { field: 'personalPerformance', operator: '>=', value: 100000, description: '个人≥10w/季度' },
        ],
        promotionConditions: [
          { field: 'directTeamSize', operator: '>=', value: 4, description: '最小直管人力≥4人' },
          { field: 'directRecommendationCount', operator: '>=', value: 3, description: '直接推荐≥3人' },
          { field: 'groupPerformance', operator: '>=', value: 500000, description: '小组业绩季度≥50w' },
          { field: 'personalPerformance', operator: '>=', value: 100000, description: '个人≥10w/季度' },
        ],
        demotionConditions: [{ field: 'groupPerformance', operator: '<', value: 500000, description: '小组业绩<50w' }],
        maintainConditions: [
          { field: 'groupPerformance', operator: '>=', value: 500000, description: '小组业绩≥50w' },
          { field: 'personalPerformance', operator: '>=', value: 100000, description: '个人业绩≥10w' },
        ],
        applicableRanks: ['组经理'],
        minTenureMonths: 3,
        minTenureMonthsForEvaluation: 3,
      },
      {
        id: 'quarterly-evaluation-department',
        name: '部经理季度考核',
        evaluationPeriod: 'quarterly',
        evaluationDate: 'quarter-end',
        conditions: [
          { field: 'directTeamSize', operator: '>=', value: 12, description: '直管人力≥12人' },
          { field: 'directGroupCount', operator: '>=', value: 2, description: '直辖组≥2个（含直接或间接培育）' },
          { field: 'departmentPerformance', operator: '>=', value: 2000000, description: '部业绩季度≥200w' },
          { field: 'personalPerformance', operator: '>=', value: 120000, description: '个人≥12w/季度' },
        ],
        promotionConditions: [
          { field: 'directTeamSize', operator: '>=', value: 12, description: '直管人力≥12人' },
          { field: 'directGroupCount', operator: '>=', value: 2, description: '直辖组≥2个' },
          { field: 'departmentPerformance', operator: '>=', value: 2000000, description: '部业绩≥200w' },
          { field: 'personalPerformance', operator: '>=', value: 120000, description: '个人≥12w/季度' },
        ],
        demotionConditions: [{ field: 'departmentPerformance', operator: '<', value: 2000000, description: '部业绩<200w' }],
        maintainConditions: [
          { field: 'departmentPerformance', operator: '>=', value: 2000000, description: '部业绩≥200w' },
          { field: 'personalPerformance', operator: '>=', value: 120000, description: '个人≥12w/季度' },
        ],
        applicableRanks: ['部经理'],
        minTenureMonths: 6,
        minTenureMonthsForEvaluation: 6,
      },
      {
        id: 'quarterly-evaluation-area',
        name: '区经理季度考核',
        evaluationPeriod: 'quarterly',
        evaluationDate: 'quarter-end',
        conditions: [
          { field: 'directTeamSize', operator: '>=', value: 28, description: '直管人力≥28人' },
          { field: 'directDepartmentCount', operator: '>=', value: 2, description: '直辖部≥2个（含直接或间接培育）' },
          { field: 'areaPerformance', operator: '>=', value: 4000000, description: '区业绩季度≥400w' },
          { field: 'personalPerformance', operator: '>=', value: 150000, description: '个人≥15w/季度' },
        ],
        promotionConditions: [
          { field: 'directTeamSize', operator: '>=', value: 28, description: '直管人力≥28人' },
          { field: 'directDepartmentCount', operator: '>=', value: 2, description: '直辖部≥2个' },
          { field: 'areaPerformance', operator: '>=', value: 4000000, description: '区业绩≥400w' },
          { field: 'personalPerformance', operator: '>=', value: 150000, description: '个人≥15w/季度' },
        ],
        demotionConditions: [{ field: 'areaPerformance', operator: '<', value: 4000000, description: '区业绩<400w' }],
        maintainConditions: [
          { field: 'areaPerformance', operator: '>=', value: 4000000, description: '区业绩≥400w' },
          { field: 'personalPerformance', operator: '>=', value: 150000, description: '个人≥15w/季度' },
        ],
        applicableRanks: ['区经理'],
        minTenureMonths: 9,
        minTenureMonthsForEvaluation: 9,
      },
    ],
  };
}

export function getRulesByRank(rules: CommissionRule[], rank: Rank): CommissionRule[] {
  return rules.filter((rule) => {
    if (!rule.applicableRanks) return true;
    return rule.applicableRanks.includes(rank);
  });
}

export function getRulesByType(rules: CommissionRule[], type: CommissionRule['type']): CommissionRule[] {
  return rules.filter((rule) => rule.type === type);
}

export function getRuleById(rules: CommissionRule[], id: string): CommissionRule | undefined {
  return rules.find((rule) => rule.id === id);
}
