/**
 * 摄入后2小时自动反馈：检测到期的血糖记录任务，自动完成并添加聊天反馈
 */
import { useEffect, useRef } from 'react';
import { useChatContext } from '../../contexts/ChatContext';
import { useExecutionProgram } from '../../hooks/useExecutionProgram';
import { useDailyTasks } from '../../hooks/useDailyTasks';
import { toLocalDateString } from '../../utils/dateUtils';
import { DEFAULT_AI_COMPANION_NAME } from '../../services/aiSettingsService';

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};
const CARD_FEEDBACK_DELAY_MS = 2000;
const FEEDBACK_DONE_PREFIX = 'meal_glucose_feedback_done_';

const parseTaskData = (taskData: unknown): Record<string, any> => {
  if (!taskData) return {};
  if (typeof taskData === 'string') {
    try {
      return JSON.parse(taskData);
    } catch {
      return {};
    }
  }
  if (typeof taskData === 'object') return taskData as Record<string, any>;
  return {};
};

const hasFeedbackDone = (taskId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(`${FEEDBACK_DONE_PREFIX}${taskId}`) === '1';
  } catch {
    return false;
  }
};

const markFeedbackDone = (taskId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${FEEDBACK_DONE_PREFIX}${taskId}`, '1');
  } catch {
    // ignore storage errors
  }
};

export function MealGlucoseAutoFeedback() {
  const { addFeedbackMessage, ownerName, aiName } = useChatContext();
  const { program } = useExecutionProgram();
  const { tasks, completeTask } = useDailyTasks(program?.id || null);
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!program?.id || !tasks.length) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = toLocalDateString(now);

    const completedMealTypes = new Set(
      tasks
        .filter((t) => {
          if (t.task_status !== 'completed') return false;
          const data = parseTaskData(t.task_data);
          const mealType = data.meal_type;
          if (!mealType) return false;
          if (t.task_type === 'meal') return true;
          if (t.task_type === 'notification') {
            return data.notification_type === 'meal_consumed' || data.notification_type === 'nutrition_synced';
          }
          return false;
        })
        .map((t) => parseTaskData(t.task_data).meal_type)
    );

    const pastDueGlucoseTasks = tasks.filter((t) => {
      if (t.task_type !== 'notification' || t.task_status === 'completed') return false;
      const data = parseTaskData(t.task_data);
      if (data.notification_type !== 'blood_glucose_recorded') return false;
      if (processedIdsRef.current.has(t.id)) return false;
      if (hasFeedbackDone(t.id)) return false;
      if (!completedMealTypes.has(data.meal_type)) return false;
      const taskDate = (t as any).task_date;
      if (taskDate !== today) return false;
      const scheduled = t.scheduled_time;
      if (!scheduled) return false;
      const [h, m] = scheduled.split(':').map(Number);
      const taskMin = h * 60 + m;
      return taskMin <= nowMin;
    });

    let cancelled = false;
    const run = async () => {
      for (const task of pastDueGlucoseTasks) {
        if (cancelled) return;
        processedIdsRef.current.add(task.id);
        const data = parseTaskData(task.task_data);
        const mealType = data.meal_type;
        const mealLabel = mealType ? MEAL_LABELS[mealType] || mealType : '餐';
        try {
          await completeTask({ taskId: task.id });
          await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
          if (cancelled) return;
          await addFeedbackMessage(`${aiName || DEFAULT_AI_COMPANION_NAME}已完成[${mealLabel}后2小时血糖]记录，${ownerName || '主人'}加油！`);
          markFeedbackDone(task.id);
        } catch (e) {
          processedIdsRef.current.delete(task.id);
          console.warn('[MealGlucoseAutoFeedback] 完成任务失败:', e);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tasks, program?.id, completeTask, addFeedbackMessage, aiName, ownerName]);

  return null;
}
