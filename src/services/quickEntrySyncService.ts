import { supabase } from '../config/supabase';
import { QuickEntryData } from '../components/QuickEntryCard';
import { nutritionSyncService } from './nutritionSyncService';
import { handleAuthError } from './errorHandler';
import { resolveMealTypeForNonSystemFood } from '../utils/mealUtils';
import { invalidateHealthQueriesAfterQuickEntry } from '../utils/invalidateHealthQueriesAfterSync';
import {
  canUseHealthRecordsChatMessageId,
  insertHealthRecordWithChatMessageFallback,
  isHealthRecordsChatMessageIdUnsupportedError,
  markHealthRecordsChatMessageIdUnsupported,
} from '../utils/healthRecordsInsert';

/** 去重时间窗口（毫秒）：仅在此窗口内同值同类型才视为重复提交，避免吞掉合法重复记录 */
const DEDUP_WINDOW_MS = 2 * 60 * 1000;

type MeasurementData = {
  source: string;
  type?: string;
  value?: number;
  chest?: number;
  waist?: number;
  upperArm?: number;
  hips?: number;
  thigh?: number;
  calf?: number;
};

/**
 * health_records.chat_message_id 为 uuid 且引用 chat_messages.id。
 * 聊天侧在落库前 message.id 可能为 temp-quickEntry-…，写入会导致插入失败 → 同步被拒。
 */
export function sanitizeChatMessageIdForHealthRecord(raw?: string | null): string | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return undefined;
  }
  return s;
}

function getDedupTimeRange(recordDate: Date): { start: string; end: string } {
  const ts = recordDate.getTime();
  const start = new Date(ts - DEDUP_WINDOW_MS);
  const end = new Date(ts + DEDUP_WINDOW_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function hasDuplicateByChatMessageId(
  userId: string,
  recordType: string,
  chatMessageId?: string
): Promise<boolean> {
  if (!chatMessageId || !canUseHealthRecordsChatMessageId()) return false;

  const { data, error } = await supabase
    .from('health_records')
    .select('id')
    .eq('user_id', userId)
    .eq('record_type', recordType)
    .eq('chat_message_id', chatMessageId)
    .limit(1);

  if (error) {
    if (isHealthRecordsChatMessageIdUnsupportedError(error)) {
      markHealthRecordsChatMessageIdUnsupported();
      return false;
    }
    const err = error as { code?: string; message?: string; details?: string; hint?: string };
    console.warn(
      `[quickEntrySyncService] ${recordType} duplicate check by chat_message_id failed, continuing:`,
      err.message,
      import.meta.env.DEV ? { code: err.code, details: err.details, hint: err.hint } : ''
    );
    return false;
  }

  return Boolean(data?.length);
}

/**
 * QuickEntry同步服务
 * 将AI创建的快速录入卡片数据同步到对应的健康记录数据库表
 * 去重策略：仅「同时间窗口(2分钟)+同值+同类型」视为重复，不吞合法重复记录
 */
export const quickEntrySyncService = {
  /**
   * 同步快速录入卡片到健康记录
   * @param cardData QuickEntryData卡片数据
   * @returns Promise<boolean> 是否同步成功
   */
  async syncCardToHealthRecords(cardData: QuickEntryData): Promise<boolean> {
    try {
      // 如果已经同步过，直接返回成功，避免重复创建
      if (cardData.syncedToRecords) {
        console.log('⚠️ [quickEntrySyncService] Card already synced, skipping:', cardData.metricType);
        return true;
      }

      const rawChatId = cardData.chatMessageId;
      const chatMessageId = sanitizeChatMessageIdForHealthRecord(rawChatId);
      if (rawChatId && !chatMessageId) {
        console.warn(
          '[quickEntrySyncService] chat_message_id 非合法 UUID（多为临时消息 id），跳过外键字段，照常写入健康记录:',
          rawChatId
        );
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      let recordDate =
        cardData.date != null ? new Date(cardData.date as string | number | Date) : new Date();
      if (Number.isNaN(recordDate.getTime())) {
        recordDate = new Date();
      }
      const dataSource = cardData.dataSource || 'ai';

      let synced = false;
      switch (cardData.metricType) {
        case 'food':
          synced = await this.syncFoodRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'water':
          synced = await this.syncWaterRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'exercise':
          synced = await this.syncExerciseRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'blood_glucose':
          synced = await this.syncBloodGlucoseRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'steps':
          synced = await this.syncStepsRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'weight':
          synced = await this.syncWeightRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'sleep':
          synced = await this.syncSleepRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'measurements':
          synced = await this.syncMeasurementsRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'supplement':
          synced = await this.syncSupplementRecord(user.id, cardData, recordDate, dataSource, chatMessageId);
          break;

        case 'emotion':
          synced = await this.syncEmotionRecord(user.id, cardData, recordDate, dataSource);
          break;

        default:
          console.warn(`Unknown metric type: ${cardData.metricType}`);
          synced = false;
      }

      if (synced) {
        invalidateHealthQueriesAfterQuickEntry(user.id, cardData.metricType, recordDate);
      }
      return synced;
    } catch (error) {
      console.error('Error syncing card to health records:', error);
      return false;
    }
  },

  /**
   * 同步饮食记录
   */
  async syncFoodRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      if (chatMessageId && canUseHealthRecordsChatMessageId()) {
        try {
          const byChat = await hasDuplicateByChatMessageId(userId, 'food', chatMessageId);
          if (byChat) {
            console.log('⚠️ [quickEntrySyncService] Duplicate food (by chat_message_id), skipping');
            return true;
          }
        } catch (e) {
          console.warn('[quickEntrySyncService] food duplicate check exception, continuing:', e);
        }
      }
      const foodName = cardData.foodName || '食物';
      const calories = cardData.calories || 0;
      const quantity = cardData.quantity || 1;

      // AI创建的餐食：统一记为加餐，timeLabel 为 早上/中午/晚上
      const { mealType, timeLabel } = await resolveMealTypeForNonSystemFood(
        userId,
        recordDate,
        cardData.mealType || '加餐',
        dataSource === 'ai'
      );

      // 使用nutritionSyncService保存（包含来源与 chat_message_id）
      await nutritionSyncService.saveFoodEntry(
        foodName,
        calories,
        mealType,
        quantity,
        recordDate,
        (dataSource as 'ai' | 'manual'),
        timeLabel,
        chatMessageId
      );

      return true;
    } catch (error) {
      console.error('Error syncing food record:', error);
      return false;
    }
  },

  /**
   * 同步饮水记录
   */
  async syncWaterRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      // 优先：若已有 chat_message_id 关联记录，跳过（真正重复）
      if (await hasDuplicateByChatMessageId(userId, 'water', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate water (by chat_message_id), skipping');
        }
        return true;
      }
      // 去重：仅 2 分钟内同值 视为重复（不吞合法重复，如 9:00 与 15:00 各 500ml）
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: existingRecords, error: checkError } = await supabase
        .from('health_records')
        .select('id')
        .eq('user_id', userId)
        .eq('record_type', 'water')
        .eq('value', cardData.value)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking existing water record:', checkError);
      }
      
      // 如果已存在相同记录，直接返回成功
      if (existingRecords && existingRecords.length > 0) {
        console.log('⚠️ [quickEntrySyncService] Duplicate water record detected, skipping:', {
          value: cardData.value,
          date: recordDate.toISOString()
        });
        return true;
      }
      
      // Store source information in notes or a separate field
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI记录' : '手动记录';
      // 如果notes已经包含标记，不再重复添加
      const hasSourceNote = notes.includes('AI记录') || notes.includes('手动记录');
      const fullNotes = hasSourceNote ? notes : (notes ? `${notes} (${sourceNote})` : sourceNote);

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'water',
        value: cardData.value,
        unit: cardData.unit || 'ml',
        notes: fullNotes,
        recorded_at: recordDate,
        ...(chatMessageId && { chat_message_id: chatMessageId }),
      });

      if (error) {
        console.error('Error saving water record:', error);
        throw error;
      }

      console.log('Water record synced successfully:', { userId, value: cardData.value, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing water record:', error);
      return false;
    }
  },

  /**
   * 同步运动记录
   */
  async syncExerciseRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      const exerciseName = cardData.exerciseName || '运动';
      const duration = cardData.duration || cardData.value || 0;
      const caloriesBurned = cardData.calories || 0;

      if (await hasDuplicateByChatMessageId(userId, 'exercise', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate exercise (by chat_message_id), skipping');
        }
        return true;
      }
      // 去重：仅 2 分钟内同运动名+时长 视为重复
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: exerciseCandidates, error: checkError } = await supabase
        .from('health_records')
        .select('id, exercise_data')
        .eq('user_id', userId)
        .eq('record_type', 'exercise')
        .gte('recorded_at', start)
        .lte('recorded_at', end);

      if (checkError) {
        console.error('Error checking existing exercise record:', checkError);
      }

      const dup = exerciseCandidates?.some((row) => {
        const ed = row.exercise_data as { name?: string; duration?: number } | null;
        return ed?.name === exerciseName && Number(ed?.duration) === Number(duration);
      });
      if (dup) {
        console.log('⚠️ [quickEntrySyncService] Duplicate exercise record detected, skipping:', {
          exerciseName,
          duration,
          date: recordDate.toISOString(),
        });
        return true;
      }

      // Store source information in notes
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI创建' : '手动记录';
      const hasSourceNote = notes.includes('AI创建') || notes.includes('AI记录') || notes.includes('手动记录');
      const fullNotes = hasSourceNote ? notes : (notes ? `${notes} (${sourceNote})` : sourceNote);

      const exerciseData = {
        name: exerciseName,
        duration,
        calories_burned: caloriesBurned,
        exercise_type: cardData.exerciseType || 'other',
        intensity: 'moderate' as const,
        source: dataSource as 'ai' | 'manual',
      };

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'exercise',
        value: caloriesBurned,
        unit: 'kcal',
        exercise_data: exerciseData,
        notes: fullNotes,
        recorded_at: recordDate,
        ...(chatMessageId ? { chat_message_id: chatMessageId } : {}),
      });

      if (error) {
        console.error('Error saving exercise record:', error);
        return false;
      }

      console.log('Exercise record synced successfully:', { userId, exerciseName, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing exercise record:', error);
      return false;
    }
  },

  /**
   * 同步血糖记录
   */
  async syncBloodGlucoseRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      if (await hasDuplicateByChatMessageId(userId, 'blood_glucose', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate blood_glucose (by chat_message_id), skipping');
        }
        return true;
      }
      // 去重：仅 2 分钟内同值 视为重复
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: existingRecords, error: checkError } = await supabase
        .from('health_records')
        .select('id')
        .eq('user_id', userId)
        .eq('record_type', 'blood_glucose')
        .eq('value', cardData.value)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking existing blood glucose record:', checkError);
      }
      
      // 如果已存在相同记录，直接返回成功
      if (existingRecords && existingRecords.length > 0) {
        console.log('⚠️ [quickEntrySyncService] Duplicate blood glucose record detected, skipping:', {
          value: cardData.value,
          date: recordDate.toISOString()
        });
        return true;
      }
      
      // Store source information in notes
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI创建' : '手动记录';
      const hasSourceNote = notes.includes('AI创建') || notes.includes('AI记录') || notes.includes('手动记录');
      const fullNotes = hasSourceNote ? notes : (notes ? `${notes} (${sourceNote})` : sourceNote);

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'blood_glucose',
        value: cardData.value,
        unit: cardData.unit || 'mmol/L',
        notes: fullNotes,
        recorded_at: recordDate,
        ...(chatMessageId && { chat_message_id: chatMessageId }),
      });

      if (error) {
        console.error('Error saving blood glucose record:', error);
        return false;
      }

      console.log('Blood glucose record synced successfully:', { userId, value: cardData.value, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing blood glucose record:', error);
      return false;
    }
  },

  /**
   * 同步步数记录
   */
  async syncStepsRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      if (await hasDuplicateByChatMessageId(userId, 'steps', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate steps (by chat_message_id), skipping');
        }
        return true;
      }
      // 去重：仅 2 分钟内同值 视为重复
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: existingRecords, error: checkError } = await supabase
        .from('health_records')
        .select('id')
        .eq('user_id', userId)
        .eq('record_type', 'steps')
        .eq('value', cardData.value)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking existing steps record:', checkError);
      }
      
      // 如果已存在相同记录，直接返回成功
      if (existingRecords && existingRecords.length > 0) {
        console.log('⚠️ [quickEntrySyncService] Duplicate steps record detected, skipping:', {
          value: cardData.value,
          date: recordDate.toISOString()
        });
        return true;
      }
      
      // Store source information in notes
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI创建' : '手动记录';
      const hasSourceNote = notes.includes('AI创建') || notes.includes('AI记录') || notes.includes('手动记录');
      const fullNotes = hasSourceNote ? notes : (notes ? `${notes} (${sourceNote})` : sourceNote);

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'steps',
        value: cardData.value,
        unit: '步',
        notes: fullNotes,
        recorded_at: recordDate,
        ...(chatMessageId && { chat_message_id: chatMessageId }),
      });

      if (error) {
        console.error('Error saving steps record:', error);
        return false;
      }

      console.log('Steps record synced successfully:', { userId, value: cardData.value, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing steps record:', error);
      return false;
    }
  },

  /**
   * 同步体重记录
   */
  async syncWeightRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      if (await hasDuplicateByChatMessageId(userId, 'weight', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate weight (by chat_message_id), skipping');
        }
        return true;
      }
      // 去重：仅 2 分钟内同值 视为重复（早/晚各称一次同值也允许）
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: existingRecords, error: checkError } = await supabase
        .from('health_records')
        .select('id')
        .eq('user_id', userId)
        .eq('record_type', 'weight')
        .eq('value', cardData.value)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking existing weight record:', checkError);
      }
      
      // 如果已存在相同记录，直接返回成功
      if (existingRecords && existingRecords.length > 0) {
        console.log('⚠️ [quickEntrySyncService] Duplicate weight record detected, skipping:', {
          value: cardData.value,
          date: recordDate.toISOString()
        });
        return true;
      }
      
      // Store source information in notes or a separate field
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI创建' : '手动记录';
      // 如果notes已经包含标记，不再重复添加
      const hasSourceNote = notes.includes('AI创建') || notes.includes('AI记录') || notes.includes('手动记录');
      const fullNotes = hasSourceNote ? notes : (notes ? `${notes} (${sourceNote})` : sourceNote);

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'weight',
        value: cardData.value,
        unit: cardData.unit || 'kg',
        notes: fullNotes,
        recorded_at: recordDate,
        ...(chatMessageId && { chat_message_id: chatMessageId }),
      });

      if (error) {
        console.error('Error saving weight record:', error);
        return false;
      }

      console.log('Weight record synced successfully:', { userId, value: cardData.value, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing weight record:', error);
      return false;
    }
  },

  /**
   * 同步睡眠记录
   */
  async syncSleepRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      if (await hasDuplicateByChatMessageId(userId, 'sleep', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate sleep (by chat_message_id), skipping');
        }
        return true;
      }
      // 去重：仅 2 分钟内同值 视为重复
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: existingRecords, error: checkError } = await supabase
        .from('health_records')
        .select('id')
        .eq('user_id', userId)
        .eq('record_type', 'sleep')
        .eq('value', cardData.value)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking existing sleep record:', checkError);
      }
      
      // 如果已存在相同记录，直接返回成功
      if (existingRecords && existingRecords.length > 0) {
        console.log('⚠️ [quickEntrySyncService] Duplicate sleep record detected, skipping:', {
          value: cardData.value,
          date: recordDate.toISOString()
        });
        return true;
      }
      
      // Store source information in notes
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI创建' : '手动记录';
      const hasSourceNote = notes.includes('AI创建') || notes.includes('AI记录') || notes.includes('手动记录');
      const fullNotes = hasSourceNote ? notes : (notes ? `${notes} (${sourceNote})` : sourceNote);

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'sleep',
        value: cardData.value,
        unit: cardData.unit || '小时',
        notes: fullNotes,
        recorded_at: recordDate,
        ...(chatMessageId && { chat_message_id: chatMessageId }),
      });

      if (error) {
        console.error('Error saving sleep record:', error);
        return false;
      }

      console.log('Sleep record synced successfully:', { userId, value: cardData.value, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing sleep record:', error);
      return false;
    }
  },

  /**
   * 同步身体测量记录
   */
  async syncMeasurementsRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      if (await hasDuplicateByChatMessageId(userId, 'measurements', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate measurements (by chat_message_id), skipping');
        }
        return true;
      }
      // 如果有多组围度数据，使用measurements对象
      const measurementData: MeasurementData = {
        source: dataSource
      };

      if (cardData.measurements) {
        // 使用measurements对象中的所有围度值
        if (cardData.measurements.chest !== undefined) {
          measurementData.chest = cardData.measurements.chest;
        }
        if (cardData.measurements.waist !== undefined) {
          measurementData.waist = cardData.measurements.waist;
        }
        if (cardData.measurements.upperArm !== undefined) {
          measurementData.upperArm = cardData.measurements.upperArm;
        }
        if (cardData.measurements.hips !== undefined) {
          measurementData.hips = cardData.measurements.hips;
        }
        if (cardData.measurements.thigh !== undefined) {
          measurementData.thigh = cardData.measurements.thigh;
        }
        if (cardData.measurements.calf !== undefined) {
          measurementData.calf = cardData.measurements.calf;
        }
      } else {
        // 兼容旧格式：单个围度值
        measurementData.type = cardData.measurementType || 'other';
        measurementData.value = cardData.value;
      }

      // 计算主要值（用于value字段）
      const primaryValue = cardData.measurements
        ? (cardData.measurements.chest || 
           cardData.measurements.waist || 
           cardData.measurements.hips || 
           cardData.measurements.upperArm || 
           cardData.measurements.thigh || 
           cardData.measurements.calf || 
           cardData.value)
        : cardData.value;

      // 去重：仅 2 分钟内同围度数据 视为重复
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: existingRecords, error: checkError } = await supabase
        .from('health_records')
        .select('id, measurement_data')
        .eq('user_id', userId)
        .eq('record_type', 'measurements')
        .gte('recorded_at', start)
        .lte('recorded_at', end);
      
      if (checkError) {
        console.error('Error checking existing measurements record:', checkError);
      }
      
      // 如果已存在相同记录，直接返回成功
      // 通过比较 measurement_data JSONB 字段来判断是否重复
      if (existingRecords && existingRecords.length > 0) {
        const hasDuplicate = existingRecords.some(record => {
          const existingData = record.measurement_data as MeasurementData | null;
          if (!existingData) return false;
          // 比较关键字段（排除 source 字段，因为它可能不同）
          // 简单比较：如果主要围度值相同，认为是重复
          if (cardData.measurements) {
            return (
              (existingData.chest === measurementData.chest || (!existingData.chest && !measurementData.chest)) &&
              (existingData.waist === measurementData.waist || (!existingData.waist && !measurementData.waist)) &&
              (existingData.hips === measurementData.hips || (!existingData.hips && !measurementData.hips))
            );
          } else {
            return existingData.value === measurementData.value && existingData.type === measurementData.type;
          }
        });
        
        if (hasDuplicate) {
          console.log('⚠️ [quickEntrySyncService] Duplicate measurements record detected, skipping:', {
            measurementData,
            date: recordDate.toISOString()
          });
          return true;
        }
      }
      
      // Store source information in notes
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI创建' : '手动记录';
      const hasSourceNote = notes.includes('AI创建') || notes.includes('AI记录') || notes.includes('手动记录');
      const fullNotes = hasSourceNote ? notes : (notes ? `${notes} (${sourceNote})` : sourceNote);

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'measurements',
        value: primaryValue,
        unit: cardData.unit || 'cm',
        measurement_data: measurementData,
        notes: fullNotes,
        recorded_at: recordDate,
        ...(chatMessageId && { chat_message_id: chatMessageId }),
      });

      if (error) {
        console.error('Error saving measurements record:', error);
        return false;
      }

      console.log('Measurements record synced successfully:', { userId, measurementData, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing measurements record:', error);
      return false;
    }
  },

  /**
   * 同步补剂记录
   */
  async syncSupplementRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string,
    chatMessageId?: string
  ): Promise<boolean> {
    try {
      const supplementName = cardData.supplementName || '补剂';
      if (await hasDuplicateByChatMessageId(userId, 'supplement', chatMessageId)) {
        if (chatMessageId) {
          console.log('⚠️ [quickEntrySyncService] Duplicate supplement (by chat_message_id), skipping');
        }
        return true;
      }
      // 去重：仅 2 分钟内同补剂名+剂量 视为重复
      const { start, end } = getDedupTimeRange(recordDate);
      const { data: existingRecords, error: checkError } = await supabase
        .from('health_records')
        .select('id, notes')
        .eq('user_id', userId)
        .eq('record_type', 'supplement')
        .gte('recorded_at', start)
        .lte('recorded_at', end);
      
      if (checkError) {
        console.error('Error checking existing supplement record:', checkError);
      }
      
      // 检查是否有相同补剂名称和剂量的记录
      if (existingRecords && existingRecords.length > 0) {
        const hasDuplicate = existingRecords.some(record => {
          const notes = record.notes || '';
          return notes.includes(supplementName) && notes.includes(cardData.dosage || '');
        });
        
        if (hasDuplicate) {
          console.log('⚠️ [quickEntrySyncService] Duplicate supplement record detected, skipping:', {
            supplementName,
            dosage: cardData.dosage,
            date: recordDate.toISOString()
          });
          return true;
        }
      }
      
      // Store source information in notes
      const notes = cardData.notes || '';
      const sourceNote = dataSource === 'ai' ? 'AI创建' : '手动记录';
      const hasSourceNote = notes.includes('AI创建') || notes.includes('AI记录') || notes.includes('手动记录');
      const supplementNotes = notes
        ? `${supplementName} ${cardData.dosage || ''} - ${notes}${hasSourceNote ? '' : ` (${sourceNote})`}`
        : `${supplementName} ${cardData.dosage || ''} (${sourceNote})`;

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'supplement',
        value: cardData.value,
        unit: cardData.unit || '次',
        notes: supplementNotes,
        recorded_at: recordDate,
        ...(chatMessageId && { chat_message_id: chatMessageId }),
      });

      if (error) {
        console.error('Error saving supplement record:', error);
        return false;
      }

      console.log('Supplement record synced successfully:', { userId, supplementName, dataSource });
      return true;
    } catch (error) {
      console.error('Error syncing supplement record:', error);
      return false;
    }
  },

  /**
   * 同步心情记录
   */
  async syncEmotionRecord(
    userId: string,
    cardData: QuickEntryData,
    recordDate: Date,
    dataSource: string
  ): Promise<boolean> {
    try {
      const emotionType = cardData.emotionType || 'neutral';
      const intensity = cardData.intensity ?? 0.5;
      const message = dataSource === 'ai' ? 'AI识别' : '手动记录';

      const { error } = await insertHealthRecordWithChatMessageFallback({
        user_id: userId,
        record_type: 'emotion',
        value: intensity,
        emotion_data: { emotion: emotionType, intensity, message },
        notes: message,
        recorded_at: recordDate.toISOString(),
      });

      if (error) {
        console.error('Error saving emotion record:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error syncing emotion record:', error);
      return false;
    }
  }
};
