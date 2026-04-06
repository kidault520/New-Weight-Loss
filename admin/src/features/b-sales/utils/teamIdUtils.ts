/**
 * 战队组织 ID 与编号格式统一
 * - ID: team-YYMMDD-regionCode001（如 team-260315-hd001）
 * - 编号: TXXXXXX（6位数字）
 */

/** 大区名称 → 拼音首字母编码 */
const REGION_CODE_MAP: Record<string, string> = {
  '华东地区': 'hd',
  '华南地区': 'hn',
  '华北地区': 'hb',
  '华中地区': 'hz',
  '东北地区': 'db',
  '西北地区': 'xb',
  '西南地区': 'xn',
};

/**
 * 从大区名称获取地区编码（如 华东地区 → hd）
 */
export function getRegionCodeFromRegionName(regionName: string): string {
  const normalized = (regionName || '').replace(/^region-[^\-]+-/, '');
  return REGION_CODE_MAP[normalized] || REGION_CODE_MAP[regionName] || 'xx';
}

/**
 * 生成战队编号：T + 6位数字（如 T123456）
 */
export function generateTeamCode(existingCodes?: Set<string>): string {
  let code: string;
  do {
    const num = Math.floor(100000 + Math.random() * 900000);
    code = `T${num}`;
  } while (existingCodes?.has(code));
  return code;
}

/**
 * 生成战队显示 ID：team-YYMMDD-regionCode001
 * @param regionName 大区名称（如 华东地区）
 * @param createdDate 创建日期 YYYY-MM-DD 或 Date
 * @param sequence 同地区同日的序号，默认 001
 */
export function generateTeamDisplayId(
  regionName: string,
  createdDate?: string | Date,
  sequence = 1
): string {
  const date = createdDate
    ? (typeof createdDate === 'string' ? new Date(createdDate) : createdDate)
    : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const regionCode = getRegionCodeFromRegionName(regionName);
  const seq = String(sequence).padStart(3, '0');
  return `team-${yy}${mm}${dd}-${regionCode}${seq}`;
}

/**
 * 判断编号是否符合新格式 TXXXXXX（T+6位数字）
 */
export function isStandardTeamCode(code: string): boolean {
  return /^T\d{6}$/.test(code || '');
}

/**
 * 判断 ID 是否符合新格式 team-YYMMDD-xxx
 */
export function isStandardTeamDisplayId(id: string): boolean {
  return /^team-\d{6}-[a-z]{2}\d{3}$/.test(id || '');
}

/** 地区实体（用于解析大区名） */
export interface RegionForDisplay {
  id: string;
  name: string;
  type: string;
  parentId?: string;
}

/**
 * 从 regionId 解析出大区名称（用于生成 display_id）
 */
export function getRegionNameForTeamDisplay(
  regionId: string | undefined,
  regions: Map<string, RegionForDisplay>
): string {
  if (!regionId || !regions) return '未知';
  let r = regions.get(regionId);
  while (r) {
    if (r.type === '大区') return r.name;
    r = r.parentId ? regions.get(r.parentId) : undefined;
  }
  return '未知';
}
