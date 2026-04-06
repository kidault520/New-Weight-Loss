/**
 * 组织数据转换器
 * 将UI组件中的数据格式转换为计算引擎所需格式
 */

import { OrganizationNode, Rank } from '../types/organization';

interface OrgTreeNode {
  name: string;
  role: string;
  sales: string;
  avatar: string;
  children: OrgTreeNode[];
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
  // 移除'w'后缀，转换为元
  const numStr = sales.replace('w', '').trim();
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num * 10000;
}

/**
 * 生成唯一ID
 */
function generateId(name: string, parentPath: string = ''): string {
  // 特殊处理：区经理Y -> 区经理-y
  if (name === '区经理 Y') {
    return '区经理-y';
  }

  // 其他情况：使用名称生成ID
  let id = name.replace(/\s+/g, '-');

  // 如果有父路径，组合生成唯一ID
  if (parentPath) {
    id = `${parentPath}-${id}`;
  }

  return id;
}

/**
 * 转换组织树数据
 */
export function convertOrgTreeData(
  treeData: OrgTreeNode,
  parentId?: string,
  path: string = ''
): OrganizationNode {
  const id = generateId(treeData.name, path);
  const rank = extractRank(treeData.role);
  const performance = extractPerformance(treeData.sales);
  const currentPath = path ? `${path}-${treeData.name}` : treeData.name;

  const node: OrganizationNode = {
    id,
    name: treeData.name,
    rank,
    performance,
    directRecommender: parentId,
    directManager: parentId,
    children: [],
    metadata: {
      recommendationPath: parentId ? [parentId, id] : [],
      jurisdictionPath: parentId ? [parentId, id] : [],
      cultivationRelations: [],
    },
  };

  // 递归转换子节点
  treeData.children.forEach((child) => {
    const childNode = convertOrgTreeData(child, id, currentPath);
    node.children.push(childNode);
  });

  return node;
}
