// DistanceCalculator工具类 - 处理地址距离计算和配送费用计算

// 位置坐标接口
export interface Location {
  name: string;
  lat: number;
  lng: number;
}

// 配送范围信息接口
export interface DeliveryRangeInfo {
  inRange: boolean;
  fee: number;
  tier: string;
  message: string;
}

// 配送范围层级配置
interface DeliveryTier {
  maxDistance: number;
  fee: number;
  tierName: string;
  message: string;
}

export class DistanceCalculator {
  // 默认配送中心位置 - 双井
  public static DEFAULT_CENTER_LOCATION: Location = {
    name: "双井",
    lat: 39.9081,
    lng: 116.4528
  };

  // 配送范围层级配置
  private static DELIVERY_TIERS: DeliveryTier[] = [
    { maxDistance: 5, fee: 0, tierName: "核心区域", message: "免配送费" },
    { maxDistance: 10, fee: 5, tierName: "标准区域", message: "配送费¥5" },
    { maxDistance: 20, fee: 15, tierName: "扩展区域", message: "配送费¥15" }
  ];

  // 最大配送距离（公里）
  public static MAX_DELIVERY_DISTANCE = 20;

  /**
   * 计算地址与中心位置的距离（公里）
   * 使用简化的距离计算模型，基于地址文本中的区域信息进行估算
   * 注意：实际项目中可替换为真实的地图API计算
   */
  public static calculateDistance(address: string, centerLocation: Location = this.DEFAULT_CENTER_LOCATION): number {
    void centerLocation;
    // 模拟距离计算逻辑
    // 实际项目中应使用地图API进行真实距离计算
    const areaKeywords: Record<string, number> = {
      "朝阳区": 3,
      "海淀区": 8,
      "东城区": 5,
      "西城区": 6,
      "丰台区": 7,
      "通州区": 12,
      "昌平区": 15,
      "大兴区": 18,
      "顺义区": 16,
      "房山区": 22,
      "北京": 10 // 默认北京区域距离
    };

    // 查找地址中的区域关键词
    for (const [keyword, distance] of Object.entries(areaKeywords)) {
      if (address.includes(keyword)) {
        return distance;
      }
    }

    // 对于非北京地区，返回超出范围的距离
    if (!address.includes("北京")) {
      return this.MAX_DELIVERY_DISTANCE + 1;
    }

    // 默认距离
    return 10;
  }

  /**
   * 计算配送费用
   * @param distance 距离（公里）
   * @returns 配送费用
   */
  public static calculateDeliveryFee(distance: number): number {
    // 超出最大配送距离，返回高额配送费或提示不可配送
    if (distance > this.MAX_DELIVERY_DISTANCE) {
      return 999; // 表示超出范围
    }

    // 查找对应的配送层级
    for (const tier of this.DELIVERY_TIERS) {
      if (distance <= tier.maxDistance) {
        return tier.fee;
      }
    }

    // 默认返回最高配送费
    return this.DELIVERY_TIERS[this.DELIVERY_TIERS.length - 1].fee;
  }

  /**
   * 检查是否在配送范围内
   * @param distance 距离（公里）
   * @returns 是否在配送范围内
   */
  public static isInDeliveryRange(distance: number): boolean {
    return distance <= this.MAX_DELIVERY_DISTANCE;
  }

  /**
   * 获取配送范围信息
   * @param distance 距离（公里）
   * @returns 配送范围详细信息
   */
  public static getDeliveryRangeInfo(distance: number): DeliveryRangeInfo {
    // 超出配送范围
    if (distance > this.MAX_DELIVERY_DISTANCE) {
      return {
        inRange: false,
        fee: 999,
        tier: "超出范围",
        message: "超出配送范围，暂不支持配送"
      };
    }

    // 查找对应的配送层级
    for (const tier of this.DELIVERY_TIERS) {
      if (distance <= tier.maxDistance) {
        return {
          inRange: true,
          fee: tier.fee,
          tier: tier.tierName,
          message: tier.message
        };
      }
    }

    // 默认返回最高层级信息
    const lastTier = this.DELIVERY_TIERS[this.DELIVERY_TIERS.length - 1];
    return {
      inRange: true,
      fee: lastTier.fee,
      tier: lastTier.tierName,
      message: lastTier.message
    };
  }

  /**
   * 验证地址区域是否在支持范围内
   * @param address 地址字符串
   * @param allowedRegions 允许的区域列表
   * @returns 是否在支持区域内
   */
  public static validateAddressRegion(address: string, allowedRegions: string[] = ['北京市']): boolean {
    // 转换为小写进行比较
    const lowerAddress = address.toLowerCase();
    
    // 检查是否包含任一允许的区域
    return allowedRegions.some(region => 
      lowerAddress.includes(region.toLowerCase())
    );
  }

  /**
   * 获取地址是否可配送的详细信息
   * @param address 地址字符串
   * @param centerLocation 配送中心位置
   * @param allowedRegions 允许的区域列表
   * @returns 配送可行性信息
   */
  public static getAddressDeliveryInfo(
    address: string,
    centerLocation: Location = this.DEFAULT_CENTER_LOCATION,
    allowedRegions: string[] = ['北京市']
  ): {
    canDeliver: boolean;
    regionValid: boolean;
    distanceValid: boolean;
    distance?: number;
    fee?: number;
    message: string;
  } {
    // 首先检查区域是否有效
    const regionValid = this.validateAddressRegion(address, allowedRegions);
    
    if (!regionValid) {
      return {
        canDeliver: false,
        regionValid: false,
        distanceValid: false,
        message: `不支持${allowedRegions.join('/')}以外区域的配送`
      };
    }
    
    // 计算距离
    const distance = this.calculateDistance(address, centerLocation);
    const rangeInfo = this.getDeliveryRangeInfo(distance);
    
    return {
      canDeliver: rangeInfo.inRange,
      regionValid: true,
      distanceValid: rangeInfo.inRange,
      distance,
      fee: rangeInfo.fee,
      message: rangeInfo.message
    };
  }
}

export default DistanceCalculator;