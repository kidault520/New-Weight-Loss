/**
 * 任务标签工具 - 将 DailyExecutionTask 转为可读文本
 * 文案来自 config/notificationConfig，便于统一修改
 */

import { NOTIFICATION_CONFIG } from '../config/notificationConfig';

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  exercise: '运动',
  water: '喝水',
  sleep: '睡眠',
  checkin: NOTIFICATION_CONFIG.daily_feedback_checkin,
};

const NOTIFICATION_LABELS: Record<string, string> = {
  delivery_received: NOTIFICATION_CONFIG.delivery_received,
  nutrition_synced: NOTIFICATION_CONFIG.nutrition_synced,
  daily_feedback_checkin: NOTIFICATION_CONFIG.daily_feedback_checkin,
};

export function getTaskLabel(task: {
  task_type: string;
  task_data?: Record<string, unknown> | string;
  scheduled_time?: string | null;
}): string {
  let taskData: Record<string, unknown> = {};
  if (task.task_data) {
    if (typeof task.task_data === 'string') {
      try {
        taskData = JSON.parse(task.task_data);
      } catch {
        taskData = {};
      }
    } else if (typeof task.task_data === 'object') {
      taskData = task.task_data;
    }
  }

  const mealTypeRaw = taskData?.meal_type;
  const mealKey = typeof mealTypeRaw === 'string' ? mealTypeRaw : '';
  const mealLabel = mealKey ? MEAL_LABELS[mealKey] || mealKey : '';

  if (task.task_type === 'meal') {
    return mealLabel || '用餐';
  }

  if (task.task_type === 'notification') {
    if (taskData?.custom_label != null && String(taskData.custom_label).trim() !== '') {
      return String(taskData.custom_label);
    }
    const notificationType = taskData?.notification_type;
    if (notificationType === 'delivery_received') {
      return mealLabel ? `${NOTIFICATION_CONFIG.delivery_received}（${mealLabel}）` : NOTIFICATION_CONFIG.delivery_received;
    }
    if (notificationType === 'nutrition_synced') {
      return NOTIFICATION_CONFIG.nutrition_synced;
    }
    if (notificationType === 'daily_feedback_checkin') {
      return NOTIFICATION_CONFIG.daily_feedback_checkin;
    }
    if (typeof notificationType === 'string' && notificationType) {
      return NOTIFICATION_LABELS[notificationType] || '待办';
    }
    if (task.scheduled_time) {
      const hour = parseInt(task.scheduled_time.substring(0, 2), 10);
      if (hour >= 6 && hour < 10) return '早餐已摄入';
      if (hour >= 12 && hour < 14) return '中餐已摄入';
      if (hour >= 18 && hour < 20) return '晚餐已摄入';
    }
    return '待办';
  }

  return TASK_TYPE_LABELS[task.task_type] || '待办';
}
