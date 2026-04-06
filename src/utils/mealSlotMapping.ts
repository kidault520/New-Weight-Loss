/**
 * 餐次：疗程/商品使用中文（早餐、午餐、晚餐），C 端配置与地址使用英文 key。
 */

export type MealSlotEn = 'breakfast' | 'lunch' | 'dinner';

const ZH_TO_EN: Record<string, MealSlotEn> = {
  早餐: 'breakfast',
  午餐: 'lunch',
  晚餐: 'dinner',
};

const EN_TO_ZH: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

const DEFAULT_EN: MealSlotEn[] = ['lunch', 'dinner'];

/** 将疗程 included_meal_types（中文）转为 C 端 included_meals（英文） */
export function includedMealTypesZhToEn(
  zh: string[] | null | undefined
): MealSlotEn[] {
  if (!zh || !Array.isArray(zh) || zh.length === 0) {
    return [...DEFAULT_EN];
  }
  const out: MealSlotEn[] = [];
  for (const x of zh) {
    const key = String(x).trim();
    const en = ZH_TO_EN[key];
    if (en && !out.includes(en)) out.push(en);
  }
  return out.length > 0 ? out : [...DEFAULT_EN];
}

/** 英文 key 列表转为中文展示，如「午餐、晚餐」 */
export function includedMealsEnToZhLabels(en: string[] | null | undefined): string {
  if (!en || !Array.isArray(en) || en.length === 0) {
    return DEFAULT_EN.map((k) => EN_TO_ZH[k]).join('、');
  }
  return en
    .map((k) => EN_TO_ZH[String(k).toLowerCase()] || k)
    .filter(Boolean)
    .join('、');
}

/** 用户已选餐次与订单允许餐次求交；若为空则退回允许列表 */
export function intersectMealTypesEn(
  selected: string[] | null | undefined,
  allowed: string[] | null | undefined
): string[] {
  const allow = (allowed && allowed.length > 0 ? allowed : DEFAULT_EN).map((x) =>
    String(x).toLowerCase()
  );
  const allowSet = new Set(allow);
  if (!selected || selected.length === 0) {
    return [...allow];
  }
  const hit = selected
    .map((x) => String(x).toLowerCase())
    .filter((x) => allowSet.has(x));
  return hit.length > 0 ? hit : [...allow];
}
