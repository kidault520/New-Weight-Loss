import type { AbilityCardType } from '../contexts/ChatContext';

/**
 * 便签：用户消息 content 与 abilityCardType 必须一致（入库后靠 content 恢复类型）。
 * 改文案请只改此表，并由 ABILITY_LABEL_TO_CARD_TYPE 自动同步映射。
 */
export const ABILITY_CARD_TRIGGER_LABEL: Record<AbilityCardType, string> = {
  delivery: '今日配送',
  meals: '今日餐',
  supplements: '今日补剂',
  report: '日反馈',
  breathing: '练习呼吸',
};

/** 从 DB 恢复的 user 消息 content → 卡片类型（与 ABILITY_CARD_TRIGGER_LABEL 互逆） */
export const ABILITY_LABEL_TO_CARD_TYPE: Record<string, AbilityCardType> = (
  Object.entries(ABILITY_CARD_TRIGGER_LABEL) as [AbilityCardType, string][]
).reduce(
  (acc, [cardType, label]) => {
    acc[label] = cardType;
    return acc;
  },
  {} as Record<string, AbilityCardType>
);
