 
import { supabase } from '../config/supabase';
import { toBeijingDateString } from '../utils/dateUtils';

export interface DailyExecutionTask {
  id: string;
  program_id: string;
  task_date: string;
  task_type: 'meal' | 'exercise' | 'water' | 'sleep' | 'checkin' | 'notification';
  task_status: 'pending' | 'completed' | 'skipped';
  scheduled_time: string | null;
  completed_at: string | null;
  task_data: Record<string, any> & {
    // 通知类型相关字段
    notification_type?: 'delivery_received' | 'meal_consumed' | 'nutrition_synced' | 'blood_glucose_recorded' | 'time_since_last_meal';
    delivery_schedule_id?: string;
    meal_type?: string;
    hours_since_last_meal?: number;
  };
  created_at: string;
  updated_at: string;
}

/**
 * 每日任务服务
 * 基于配送计划自动生成任务流
 */
export const executionTaskService = {
  /**
   * 基于配送计划自动生成每日任务
   */
  async generateDailyTasks(
    programId: string,
    taskDate: string,
    mealDeliverySchedules?: Array<{
      id?: string;
      delivery_date: string;
      meal_type: string;
      delivery_time_start?: string;
    }>
  ): Promise<DailyExecutionTask[]> {
    try {
      const tasks: Omit<DailyExecutionTask, 'id' | 'created_at' | 'updated_at'>[] = [];

      // 1. 生成餐食相关通知任务（基于配送计划）
      if (mealDeliverySchedules && mealDeliverySchedules.length > 0) {
        const daySchedules = mealDeliverySchedules.filter(
          schedule => schedule.delivery_date === taskDate
        );

        for (const schedule of daySchedules) {
          const mealType = schedule.meal_type; // breakfast, lunch, dinner
          const deliveryTime = schedule.delivery_time_start || this.getDefaultMealTime(mealType);
          
          // 只处理中餐和晚餐（根据用户需求）
          if (mealType !== 'lunch' && mealType !== 'dinner') {
            continue;
          }

          // 计算各个通知的时间点
          // delivery_time_start 可能是 "HH:MM" 或 "HH:MM:SS" 格式
          const deliveryTimeParts = deliveryTime.split(':');
          const deliveryHour = parseInt(deliveryTimeParts[0]);
          const deliveryMinute = parseInt(deliveryTimeParts[1] || '0');

          // 1. 已收到配送 - 配送时间
          tasks.push({
            program_id: programId,
            task_date: taskDate,
            task_type: 'notification',
            task_status: 'pending',
            scheduled_time: `${String(deliveryHour).padStart(2, '0')}:${String(deliveryMinute).padStart(2, '0')}:00`,
            completed_at: null,
            task_data: {
              notification_type: 'delivery_received',
              meal_type: mealType,
              delivery_schedule_id: schedule.id || schedule.delivery_date,
            },
          });

          // 2. 已用完中餐/晚餐 - 配送时间后1小时
          const consumeHour = (deliveryHour + 1) % 24;
          const consumeTime = `${String(consumeHour).padStart(2, '0')}:${String(deliveryMinute).padStart(2, '0')}:00`;
          tasks.push({
            program_id: programId,
            task_date: taskDate,
            task_type: 'notification',
            task_status: 'pending',
            scheduled_time: consumeTime,
            completed_at: null,
            task_data: {
              notification_type: 'meal_consumed',
              meal_type: mealType,
              delivery_schedule_id: schedule.id || schedule.delivery_date,
            },
          });

          // 3. 已同步营养素及卡路里 - 用餐后立即（+10分钟）
          // 🔥 修复：基于消费时间（consumeHour）计算，而不是配送时间
          const nutritionMinute = deliveryMinute + 10;
          const nutritionHour = nutritionMinute >= 60 ? (consumeHour + Math.floor(nutritionMinute / 60)) % 24 : consumeHour;
          const nutritionTime = `${String(nutritionHour).padStart(2, '0')}:${String(nutritionMinute % 60).padStart(2, '0')}:00`;
          tasks.push({
            program_id: programId,
            task_date: taskDate,
            task_type: 'notification',
            task_status: 'pending',
            scheduled_time: nutritionTime,
            completed_at: null,
            task_data: {
              notification_type: 'nutrition_synced',
              meal_type: mealType,
              delivery_schedule_id: schedule.id || schedule.delivery_date,
            },
          });

          // 4. 已记录餐后2小时血糖 - 用餐后2小时
          const glucoseMinute = deliveryMinute + 120;
          const glucoseHour = glucoseMinute >= 60 ? (consumeHour + Math.floor(glucoseMinute / 60)) % 24 : consumeHour;
          const glucoseTime = `${String(glucoseHour).padStart(2, '0')}:${String(glucoseMinute % 60).padStart(2, '0')}:00`;
          tasks.push({
            program_id: programId,
            task_date: taskDate,
            task_type: 'notification',
            task_status: 'pending',
            scheduled_time: glucoseTime,
            completed_at: null,
            task_data: {
              notification_type: 'blood_glucose_recorded',
              meal_type: mealType,
              delivery_schedule_id: schedule.id || schedule.delivery_date,
            },
          });
        }

        // 5. 已多长时间没有进食 - 动态计算，放在午餐和晚餐的中间时间点
        // 如果有午餐，在午餐后3小时提醒；如果有晚餐，在晚餐后3小时提醒
        const lunchSchedule = daySchedules.find(s => s.meal_type === 'lunch');
        
        if (lunchSchedule) {
          const lunchTime = lunchSchedule.delivery_time_start || this.getDefaultMealTime('lunch');
          const lunchParts = lunchTime.split(':');
          const lunchHour = parseInt(lunchParts[0]);
          const lunchMinute = parseInt(lunchParts[1] || '0');
          // 午餐后3小时提醒
          const reminderHour = (lunchHour + 3) % 24;
          const reminderTime = `${String(reminderHour).padStart(2, '0')}:${String(lunchMinute).padStart(2, '0')}:00`;
          tasks.push({
            program_id: programId,
            task_date: taskDate,
            task_type: 'notification',
            task_status: 'pending',
            scheduled_time: reminderTime,
            completed_at: null,
            task_data: {
              notification_type: 'time_since_last_meal',
              meal_type: 'lunch',
              hours_since_last_meal: 3,
              delivery_schedule_id: lunchSchedule.id || lunchSchedule.delivery_date,
            },
          });
        }
      } else {
        // 如果没有配送计划，仅生成 3 条：餐食配送通知、数据同步通知、日反馈通知（由 baseTasks checkin 提供）
        const timeLunch = this.getDefaultMealTime('lunch');
        const [hourL, minL] = timeLunch.split(':').map((s, i) => (i === 0 ? parseInt(s, 10) : parseInt(s || '0', 10)));
        const timeDinner = this.getDefaultMealTime('dinner');
        const [hourD, minD] = timeDinner.split(':').map((s, i) => (i === 0 ? parseInt(s, 10) : parseInt(s || '0', 10)));

        // 1. 餐食配送通知（午餐配送时间）
        tasks.push({
          program_id: programId,
          task_date: taskDate,
          task_type: 'notification',
          task_status: 'pending',
          scheduled_time: `${String(hourL).padStart(2, '0')}:${String(minL).padStart(2, '0')}:00`,
          completed_at: null,
          task_data: { notification_type: 'delivery_received', meal_type: 'lunch' },
        });

        // 2. 数据同步通知（晚餐用餐后+10分钟）
        const consumeHourD = (hourD + 1) % 24;
        const nutritionMinD = minD + 10;
        const nutritionHourD = nutritionMinD >= 60 ? (consumeHourD + 1) % 24 : consumeHourD;
        tasks.push({
          program_id: programId,
          task_date: taskDate,
          task_type: 'notification',
          task_status: 'pending',
          scheduled_time: `${String(nutritionHourD).padStart(2, '0')}:${String(nutritionMinD % 60).padStart(2, '0')}:00`,
          completed_at: null,
          task_data: { notification_type: 'nutrition_synced', meal_type: 'dinner' },
        });
      }

      // 2. 生成其他任务（运动、喝水、睡眠、打卡）
      const baseTasks = [
        {
          program_id: programId,
          task_date: taskDate,
          task_type: 'water' as const,
          task_status: 'pending' as const,
          scheduled_time: '09:00:00',
          completed_at: null,
          task_data: {},
        },
        {
          program_id: programId,
          task_date: taskDate,
          task_type: 'exercise' as const,
          task_status: 'pending' as const,
          scheduled_time: '18:00:00',
          completed_at: null,
          task_data: {},
        },
        {
          program_id: programId,
          task_date: taskDate,
          task_type: 'sleep' as const,
          task_status: 'pending' as const,
          scheduled_time: '22:00:00',
          completed_at: null,
          task_data: {},
        },
        {
          program_id: programId,
          task_date: taskDate,
          task_type: 'checkin' as const,
          task_status: 'pending' as const,
          scheduled_time: '20:00:00',
          completed_at: null,
          task_data: { checkin_subtype: 'smile' },
        },
        {
          program_id: programId,
          task_date: taskDate,
          task_type: 'checkin' as const,
          task_status: 'pending' as const,
          // 避免命中 unique(program_id, task_date, task_type, scheduled_time)
          // 与另一条 checkin 区分时间，防止整批插入失败
          scheduled_time: '20:05:00',
          completed_at: null,
          task_data: { checkin_subtype: 'breathe' },
        },
      ];
      tasks.push(...baseTasks);

      // 3. 检查任务是否已存在，避免重复创建
      // 🔥 修复：统一时间格式，与显示逻辑保持一致（只取HH:MM，忽略秒）
      const normalizeTime = (time: string | null | undefined): string => {
        if (!time) return '';
        const match = time.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          return `${match[1].padStart(2, '0')}:${match[2]}`;
        }
        return '';
      };
      
      const existingTasks = await this.getTasksByDate(programId, taskDate);
      const existingTaskKeys = new Set(
        existingTasks.map(t => {
          // 🔥 确保 task_data 是对象
          let taskData = t.task_data;
          if (typeof taskData === 'string') {
            try {
              taskData = JSON.parse(taskData);
            } catch (e) {
              taskData = {};
            }
          }
          if (!taskData || typeof taskData !== 'object') {
            taskData = {};
          }
          
          const notificationType = taskData?.notification_type;
          const checkinSubtype = taskData?.checkin_subtype;
          const normalizedTime = normalizeTime(t.scheduled_time);
          if (notificationType) {
            return `${t.task_type}-${notificationType}-${taskData?.meal_type || ''}-${normalizedTime}`;
          }
          if (t.task_type === 'checkin' && checkinSubtype) {
            return `${t.task_type}-${checkinSubtype}-${normalizedTime}`;
          }
          return `${t.task_type}-${normalizedTime}`;
        })
      );

      const tasksToInsert = tasks.filter(task => {
        // 🔥 确保 task_data 是对象
        let taskData = task.task_data;
        if (typeof taskData === 'string') {
          try {
            taskData = JSON.parse(taskData);
          } catch (e) {
            taskData = {};
          }
        }
        if (!taskData || typeof taskData !== 'object') {
          taskData = {};
        }
        
        const notificationType = taskData?.notification_type;
        const checkinSubtype = taskData?.checkin_subtype;
        const normalizedTime = normalizeTime(task.scheduled_time);
        if (notificationType) {
          const key = `${task.task_type}-${notificationType}-${taskData?.meal_type || ''}-${normalizedTime}`;
          const exists = existingTaskKeys.has(key);
          return !exists;
        }
        const key = task.task_type === 'checkin' && checkinSubtype
          ? `${task.task_type}-${checkinSubtype}-${normalizedTime}`
          : `${task.task_type}-${normalizedTime}`;
        const exists = existingTaskKeys.has(key);
        return !exists;
      });

      if (tasksToInsert.length === 0) {
        return existingTasks;
      }
      
      // 4. 批量插入新任务
      const { data: insertedTasks, error } = await supabase
        .from('daily_execution_tasks')
        .insert(tasksToInsert)
        .select();

      if (error) {
        console.error('❌ [executionTaskService] Error inserting tasks:', error);
        // 兼容唯一键冲突：按数据库真实唯一键(task_type + time)重试一次
        if (error.code === '23505') {
          try {
            const latestExistingTasks = await this.getTasksByDate(programId, taskDate);
            const existingDbUniqueKeys = new Set(
              latestExistingTasks.map((t) => `${t.task_type}-${normalizeTime(t.scheduled_time)}`)
            );
            const seenRetryKeys = new Set<string>();
            const retryTasks = tasksToInsert.filter((t) => {
              const key = `${t.task_type}-${normalizeTime(t.scheduled_time)}`;
              if (existingDbUniqueKeys.has(key)) return false;
              if (seenRetryKeys.has(key)) return false;
              seenRetryKeys.add(key);
              return true;
            });
            if (retryTasks.length > 0) {
              const { data: retryInserted, error: retryError } = await supabase
                .from('daily_execution_tasks')
                .insert(retryTasks)
                .select();
              if (!retryError) {
                const retryResult = [...latestExistingTasks, ...(retryInserted || [])] as DailyExecutionTask[];
                return retryResult;
              }
              console.error('❌ [executionTaskService] Retry after unique conflict failed:', retryError);
            }
          } catch (retryCatchError) {
            console.error('❌ [executionTaskService] Retry logic crashed:', retryCatchError);
          }
        }

        // 兼容旧库：如果 notification 任务类型不受支持，降级为仅插入基础任务（water/exercise/sleep/checkin）
        if (error.code === '23514' || error.message?.includes('task_type')) {
          const fallbackTasks = tasksToInsert.filter((t) => t.task_type !== 'notification');
          if (fallbackTasks.length > 0) {
            console.warn('⚠️ [executionTaskService] notification task_type unsupported, fallback to base tasks only');
            const { data: fallbackInserted, error: fallbackError } = await supabase
              .from('daily_execution_tasks')
              .insert(fallbackTasks)
              .select();
            if (!fallbackError) {
              const fallbackResult = [...existingTasks, ...(fallbackInserted || [])] as DailyExecutionTask[];
              return fallbackResult;
            }
            console.error('❌ [executionTaskService] Fallback insert failed:', fallbackError);
          }

          const friendlyError = new Error('任务生成失败：当前数据库缺少 notification 任务类型支持，请联系管理员执行对应迁移。');
          (friendlyError as any).originalError = error;
          throw friendlyError;
        }
        throw error;
      }

      return [...existingTasks, ...(insertedTasks || [])] as DailyExecutionTask[];
    } catch (error) {
      console.error('Error generating daily tasks:', error);
      throw error;
    }
  },

  /**
   * 获取默认餐食时间
   */
  getDefaultMealTime(mealType: string): string {
    const times: Record<string, string> = {
      breakfast: '08:00:00',
      lunch: '12:00:00',
      dinner: '18:00:00',
    };
    return times[mealType] || '12:00:00';
  },

  /**
   * 获取指定日期的所有任务
   */
  async getTasksByDate(programId: string, taskDate: string): Promise<DailyExecutionTask[]> {
    try {
      const { data, error } = await supabase
        .from('daily_execution_tasks')
        .select('*')
        .eq('program_id', programId)
        .eq('task_date', taskDate)
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('❌ [executionTaskService] Error fetching tasks:', error);
        throw error;
      }
      
      return (data || []) as DailyExecutionTask[];
    } catch (error) {
      console.error('❌ [executionTaskService] Error getting tasks by date:', error);
      return [];
    }
  },

  /**
   * 获取下一个待执行任务
   */
  async getNextTask(programId: string, taskDate?: string): Promise<DailyExecutionTask | null> {
    try {
      const today = taskDate || toBeijingDateString(new Date());

      const { data, error } = await supabase
        .from('daily_execution_tasks')
        .select('*')
        .eq('program_id', programId)
        .eq('task_date', today)
        .eq('task_status', 'pending')
        .order('scheduled_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as DailyExecutionTask | null;
    } catch (error) {
      console.error('Error getting next task:', error);
      return null;
    }
  },

  /**
   * 标记任务完成（自动降级处理）
   * 合并 completionData 到现有 task_data，避免覆写 notification_type 等关键字段
   */
  async markTaskComplete(
    taskId: string,
    completionData?: Record<string, any>
  ): Promise<DailyExecutionTask | null> {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('daily_execution_tasks')
        .select('task_data')
        .eq('id', taskId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let taskData: Record<string, any> = {};
      if (existing?.task_data) {
        taskData = typeof existing.task_data === 'string'
          ? (() => { try { return JSON.parse(existing.task_data); } catch { return {}; } })()
          : { ...existing.task_data };
      }
      if (completionData && typeof completionData === 'object') {
        taskData = { ...taskData, ...completionData };
      }

      const { data, error } = await supabase
        .from('daily_execution_tasks')
        .update({
          task_status: 'completed',
          completed_at: new Date().toISOString(),
          task_data: taskData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data as DailyExecutionTask;
    } catch (error) {
      console.error('Error marking task complete:', error);
      return null;
    }
  },

  /**
   * 跳过任务（降级处理）
   */
  async skipTask(taskId: string): Promise<DailyExecutionTask | null> {
    try {
      const { data, error } = await supabase
        .from('daily_execution_tasks')
        .update({
          task_status: 'skipped',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data as DailyExecutionTask;
    } catch (error) {
      console.error('Error skipping task:', error);
      return null;
    }
  },

  /**
   * 获取今日所有任务
   */
  async getTodayTasks(programId: string): Promise<DailyExecutionTask[]> {
    const today = toBeijingDateString(new Date());
    return this.getTasksByDate(programId, today);
  },

  /**
   * 清理重复任务（保留第一个，删除其他重复的）
   */
  async cleanupDuplicateTasks(programId: string, taskDate: string): Promise<number> {
    try {
      const tasks = await this.getTasksByDate(programId, taskDate);
      const taskMap = new Map<string, DailyExecutionTask>();
      const duplicates: string[] = [];

      for (const task of tasks) {
        // 生成去重key（与显示逻辑一致）
        let taskData = task.task_data;
        if (typeof taskData === 'string') {
          try {
            taskData = JSON.parse(taskData);
          } catch (e) {
            taskData = {};
          }
        }
        if (!taskData || typeof taskData !== 'object') {
          taskData = {};
        }

        // 统一时间格式
        const normalizeTime = (time: string | null | undefined): string => {
          if (!time) return '';
          const match = time.match(/^(\d{1,2}):(\d{2})/);
          if (match) {
            return `${match[1].padStart(2, '0')}:${match[2]}`;
          }
          return '';
        };

        let key: string;
        if (task.task_type === 'notification' && taskData?.notification_type) {
          const normalizedTime = normalizeTime(task.scheduled_time);
          key = `${task.task_type}-${taskData.notification_type}-${taskData.meal_type || ''}-${normalizedTime}`;
        } else {
          const normalizedTime = normalizeTime(task.scheduled_time);
          key = `${task.task_type}-${normalizedTime}`;
        }

        if (taskMap.has(key)) {
          // 发现重复，保留第一个（或已完成的那个）
          const existing = taskMap.get(key)!;
          if (existing.task_status === 'completed' && task.task_status !== 'completed') {
            // 已存在的已完成，新的是未完成，删除新的
            duplicates.push(task.id);
          } else if (existing.task_status !== 'completed' && task.task_status === 'completed') {
            // 新的是已完成，已存在的是未完成，删除已存在的，保留新的
            duplicates.push(existing.id);
            taskMap.set(key, task);
          } else {
            // 状态相同，保留第一个（按创建时间，或ID较小的），删除新的
            // 比较创建时间，保留较早的
            const existingTime = new Date(existing.created_at || 0).getTime();
            const newTime = new Date(task.created_at || 0).getTime();
            if (newTime < existingTime) {
              // 新的更早，删除已存在的，保留新的
              duplicates.push(existing.id);
              taskMap.set(key, task);
            } else {
              // 已存在的更早，删除新的
              duplicates.push(task.id);
            }
          }
        } else {
          taskMap.set(key, task);
        }
      }

      if (duplicates.length > 0) {
        const { error } = await supabase
          .from('daily_execution_tasks')
          .delete()
          .in('id', duplicates);

        if (error) {
          console.error('❌ [executionTaskService] Error deleting duplicate tasks:', error);
          throw error;
        }
      }

      return duplicates.length;
    } catch (error) {
      console.error('❌ [executionTaskService] Error cleaning up duplicate tasks:', error);
      return 0;
    }
  },

  /**
   * 修复旧任务数据：为缺少 notification_type 的任务添加正确的值
   */
  async fixMissingNotificationTypes(programId: string, taskDate: string): Promise<number> {
    try {
      const tasks = await this.getTasksByDate(programId, taskDate);
      let fixedCount = 0;
      const updates: Array<{ id: string; task_data: any }> = [];

      for (const task of tasks) {
        if (task.task_type !== 'notification') continue;

        let taskData = task.task_data;
        if (typeof taskData === 'string') {
          try {
            taskData = JSON.parse(taskData);
          } catch (e) {
            taskData = {};
          }
        }
        if (!taskData || typeof taskData !== 'object') {
          taskData = {};
        }

        // 如果已经有 notification_type，跳过
        if (taskData.notification_type) continue;

        // 根据其他字段推断 notification_type
        let notificationType: string | null = null;

        // 1. 检查是否有 delivery_schedule_id -> delivery_received
        if (taskData.delivery_schedule_id) {
          notificationType = 'delivery_received';
        }
        // 2. 检查是否有 meal_type 但没有其他标识 -> meal_consumed
        else if (taskData.meal_type) {
          notificationType = 'meal_consumed';
        }
        // 3. 根据时间推断
        else if (task.scheduled_time) {
          // 根据时间推断，默认是 meal_consumed
          notificationType = 'meal_consumed';
        }

        if (notificationType) {
          const updatedTaskData = {
            ...taskData,
            notification_type: notificationType,
          };
          updates.push({
            id: task.id,
            task_data: updatedTaskData,
          });
          fixedCount++;
        }
      }

      // 批量更新
      if (updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase
            .from('daily_execution_tasks')
            .update({
              task_data: update.task_data,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id);

          if (error) {
            console.error(`❌ [executionTaskService] Error updating task ${update.id}:`, error);
          }
        }
      }

      return fixedCount;
    } catch (error) {
      console.error('❌ [executionTaskService] Error fixing missing notification types:', error);
      return 0;
    }
  },

  /**
   * 完成摄入后插入 3 条实时通知：已完成X餐摄入、已自动同步X餐热量及营养元素、再过2小时我会自动记录血糖值
   */
  async insertMealIntakeNotifications(
    programId: string,
    taskDate: string,
    mealType: string,
    mealLabel: string
  ): Promise<void> {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    const laterMin = nowMin + 120; // 2小时
    const laterHour = Math.floor(laterMin / 60) % 24;
    const laterMinute = laterMin % 60;
    const laterStr = `${String(laterHour).padStart(2, '0')}:${String(laterMinute).padStart(2, '0')}:00`;

    const tasksToInsert = [
      {
        program_id: programId,
        task_date: taskDate,
        task_type: 'notification' as const,
        task_status: 'completed' as const,
        scheduled_time: nowStr,
        completed_at: new Date().toISOString(),
        task_data: {
          notification_type: 'meal_consumed',
          meal_type: mealType,
          custom_label: `已完成${mealLabel}摄入`,
        },
      },
      {
        program_id: programId,
        task_date: taskDate,
        task_type: 'notification' as const,
        task_status: 'completed' as const,
        scheduled_time: nowStr,
        completed_at: new Date().toISOString(),
        task_data: {
          notification_type: 'nutrition_synced',
          meal_type: mealType,
          custom_label: `已自动同步${mealLabel}热量及营养元素`,
        },
      },
      {
        program_id: programId,
        task_date: taskDate,
        task_type: 'notification' as const,
        task_status: 'pending' as const,
        scheduled_time: laterStr,
        completed_at: null,
        task_data: {
          notification_type: 'blood_glucose_recorded',
          meal_type: mealType,
          custom_label: '再过2小时，我会自动记录血糖值',
        },
      },
    ];

    const { error } = await supabase
      .from('daily_execution_tasks')
      .insert(tasksToInsert);

    if (error) {
      console.error('❌ [executionTaskService] Error inserting meal intake notifications:', error);
      throw error;
    }
  },
};

