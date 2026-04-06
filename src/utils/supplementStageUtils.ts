import type { SupplementStageResponse } from '../services/supplementStageService';

export interface StageSupplementDisplayItem {
  id: string;
  name: string;
  dosage: string;
}

/**
 * 将当前补剂阶段转换为前端统一展示项。
 * 约定：id 规则必须稳定，供“已摄入”状态跨卡片复用。
 */
export function buildCurrentStageSupplementItems(
  resp?: SupplementStageResponse | null
): StageSupplementDisplayItem[] {
  if (!resp?.has_plan || !resp.current_stage) return [];

  const stage = resp.current_stage;
  const list = stage.supplements && stage.supplements.length > 0
    ? stage.supplements
    : (stage.supplement
      ? [{
          supplement: stage.supplement,
          per_day_qty: stage.per_day_qty ?? 1,
        }]
      : []);

  return list.map((item, idx) => ({
    id: `stage-${stage.stage_id || 'x'}-${item.supplement?.id || idx}`,
    name: item.supplement?.name || `补剂${idx + 1}`,
    dosage: `×${item.per_day_qty ?? 1}颗`,
  }));
}
