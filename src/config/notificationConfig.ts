/**
 * 实时通知文案配置（默认值）
 * 仅保留：餐食配送通知、数据同步通知、日反馈类通知
 * 任务由 executionTaskService 基于配送计划生成，展示时由 taskLabelUtils 读取此配置
 */
export const NOTIFICATION_CONFIG = {
  /** 餐食配送通知 */
  delivery_received: '餐食配送通知',
  /** 数据同步通知 */
  nutrition_synced: '数据同步通知',
  /** 日反馈类通知 */
  daily_feedback_checkin: '日反馈类通知',
  daily_feedback_view: '已查看日总结',
} as const;
