/**
 * 组织架构数据
 * 区经理 Y 队伍：直管人力≥28、直辖部≥2、区业绩≥400w、个人≥15w
 * 各部/组均满足对应考核标准
 */

import { OrgConfigNode } from '../types/organization';

// 旧的格式（向后兼容）
export const orgTreeData = {
  name: '区经理 Y',
  role: '区经理 (Me)',
  sales: '18w', // 个人≥15w/季度
  avatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=150&h=150&fit=crop',
  children: [
    // 部经理 X2：直管≥12、直辖组≥2、部业绩≥200w、个人≥12w
    {
      name: '部经理 X2',
      role: '部经理',
      sales: '14w',
      avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop',
      children: [
        {
          name: '组 X2-A',
          role: '组经理',
          sales: '12w',
          avatar: 'https://i.pravatar.cc/150?u=31',
          children: [
            { name: 'X2-A1', role: '收展员', sales: '18w', avatar: 'https://i.pravatar.cc/150?u=41', children: [] },
            { name: 'X2-A2', role: '收展员', sales: '15w', avatar: 'https://i.pravatar.cc/150?u=42', children: [] },
            { name: 'X2-A3', role: '收展员', sales: '14w', avatar: 'https://i.pravatar.cc/150?u=43', children: [] },
            { name: 'X2-A4', role: '收展员', sales: '13w', avatar: 'https://i.pravatar.cc/150?u=44', children: [] },
          ]
        },
        {
          name: '组 X2-B',
          role: '组经理',
          sales: '11w',
          avatar: 'https://i.pravatar.cc/150?u=32',
          children: [
            { name: 'X2-B1', role: '收展员', sales: '17w', avatar: 'https://i.pravatar.cc/150?u=46', children: [] },
            { name: 'X2-B2', role: '收展员', sales: '14w', avatar: 'https://i.pravatar.cc/150?u=47', children: [] },
            { name: 'X2-B3', role: '收展员', sales: '13w', avatar: 'https://i.pravatar.cc/150?u=48', children: [] },
            { name: 'X2-B4', role: '收展员', sales: '12w', avatar: 'https://i.pravatar.cc/150?u=49', children: [] },
          ]
        },
        { name: 'X2-C', role: '收展员', sales: '13w', avatar: 'https://i.pravatar.cc/150?u=33', children: [] },
        { name: 'X2-D', role: '收展员', sales: '12w', avatar: 'https://i.pravatar.cc/150?u=34', children: [] },
        { name: 'X2-E', role: '收展员', sales: '11w', avatar: 'https://i.pravatar.cc/150?u=35', children: [] },
        { name: 'X2-F', role: '收展员', sales: '11w', avatar: 'https://i.pravatar.cc/150?u=36', children: [] },
      ]
    },
    // 部经理 X1：直管≥12、直辖组≥2、部业绩≥200w、个人≥12w
    {
      name: '部经理 X1',
      role: '部经理',
      sales: '13w',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      children: [
        {
          name: '组 X1-a',
          role: '组经理',
          sales: '12w',
          avatar: 'https://i.pravatar.cc/150?u=21',
          children: [
            { name: 'X1-a1', role: '收展员', sales: '18w', avatar: 'https://i.pravatar.cc/150?u=51', children: [] },
            { name: 'X1-a2', role: '收展员', sales: '16w', avatar: 'https://i.pravatar.cc/150?u=52', children: [] },
            { name: 'X1-a3', role: '收展员', sales: '15w', avatar: 'https://i.pravatar.cc/150?u=53', children: [] },
            { name: 'X1-a4', role: '收展员', sales: '14w', avatar: 'https://i.pravatar.cc/150?u=54', children: [] },
          ]
        },
        {
          name: '组 X1-b',
          role: '组经理',
          sales: '11w',
          avatar: 'https://i.pravatar.cc/150?u=22',
          children: [
            { name: 'X1-b1', role: '收展员', sales: '17w', avatar: 'https://i.pravatar.cc/150?u=55', children: [] },
            { name: 'X1-b2', role: '收展员', sales: '15w', avatar: 'https://i.pravatar.cc/150?u=56', children: [] },
            { name: 'X1-b3', role: '收展员', sales: '14w', avatar: 'https://i.pravatar.cc/150?u=57', children: [] },
            { name: 'X1-b4', role: '收展员', sales: '13w', avatar: 'https://i.pravatar.cc/150?u=58', children: [] },
          ]
        },
        { name: '收展员 X1-c', role: '收展员', sales: '15w', avatar: 'https://i.pravatar.cc/150?u=23', children: [] },
        { name: '收展员 X1-d', role: '收展员', sales: '14w', avatar: 'https://i.pravatar.cc/150?u=24', children: [] },
        { name: '收展员 X1-e', role: '收展员', sales: '13w', avatar: 'https://i.pravatar.cc/150?u=25', children: [] },
      ]
    },
    // 直辖组 E-a：组业绩≥50w、个人≥10w、直管≥4
    {
      name: '组经理 E-a',
      role: '组经理 (直辖)',
      sales: '11w',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop',
      children: [
        { name: 'E-a1', role: '收展员', sales: '11w', avatar: 'https://i.pravatar.cc/150?u=11', children: [] },
        { name: 'E-a2', role: '收展员', sales: '10w', avatar: 'https://i.pravatar.cc/150?u=12', children: [] },
        { name: 'E-a3', role: '收展员', sales: '9w', avatar: 'https://i.pravatar.cc/150?u=13', children: [] },
        { name: 'E-a4', role: '收展员', sales: '9w', avatar: 'https://i.pravatar.cc/150?u=14', children: [] },
      ]
    },
    // 直辖组 E-b：组业绩≥50w、个人≥10w、直管≥4
    {
      name: '组经理 E-b',
      role: '组经理 (直辖)',
      sales: '10w',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
      children: [
        { name: 'E-b1', role: '收展员', sales: '10w', avatar: 'https://i.pravatar.cc/150?u=16', children: [] },
        { name: 'E-b2', role: '收展员', sales: '9w', avatar: 'https://i.pravatar.cc/150?u=17', children: [] },
        { name: 'E-b3', role: '收展员', sales: '8w', avatar: 'https://i.pravatar.cc/150?u=18', children: [] },
        { name: 'E-b4', role: '收展员', sales: '8w', avatar: 'https://i.pravatar.cc/150?u=20', children: [] },
      ]
    },
    // 直辖收展员
    { name: '收展员 F', role: '直辖组员', sales: '9w', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop', children: [] },
    { name: '收展员 G', role: '直辖组员', sales: '8w', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop', children: [] },
    { name: '收展员 H', role: '直辖组员', sales: '8w', avatar: 'https://i.pravatar.cc/150?u=19', children: [] },
  ]
};

/**
 * 将旧格式的组织数据转换为新的 OrgConfigNode 格式
 */
function convertToOrgConfigNode(oldNode: any, parentId: string = '', index: number = 0): OrgConfigNode {
  const id = parentId ? `${parentId}-${index}` : 'root';
  
  return {
    id,
    name: oldNode.name,
    nodeType: 'person',
    role: oldNode.role,
    sales: oldNode.sales,
    avatar: oldNode.avatar,
    children: oldNode.children.map((child: any, idx: number) => 
      convertToOrgConfigNode(child, id, idx)
    ),
  };
}

/**
 * 创建默认的组织架构（包含顶层地理层级）
 * 将现有的区经理 Y 放在 华东地区 -> 上海市 -> 上海市区 下
 */
export function getDefaultOrgConfig(): OrgConfigNode {
  // 检查是否有保存的配置（使用动态 require 避免循环依赖）
  try {
    const { OrganizationStorage } = require('../utils/organizationStorage');
    const saved = OrganizationStorage.loadOrgConfig();
    if (saved) {
      return saved;
    }
  } catch {
    // 忽略加载错误
  }

  // 转换现有的组织数据
  const areaManagerNode = convertToOrgConfigNode(orgTreeData, 'area-manager', 0);
  areaManagerNode.id = 'area-manager-y';

  // 创建默认的顶层架构
  const defaultConfig: OrgConfigNode = {
    id: 'root',
    name: '国内',
    nodeType: 'geographic',
    geographicLevel: '国内',
    children: [
      {
        id: 'region-east',
        name: '华东地区',
        nodeType: 'geographic',
        geographicLevel: '地区',
        children: [
          {
            id: 'province-shanghai',
            name: '上海市',
            nodeType: 'geographic',
            geographicLevel: '省',
            children: [
              {
                id: 'city-shanghai',
                name: '上海市区',
                nodeType: 'geographic',
                geographicLevel: '市',
                children: [areaManagerNode],
              },
            ],
          },
        ],
      },
    ],
  };

  return defaultConfig;
}
