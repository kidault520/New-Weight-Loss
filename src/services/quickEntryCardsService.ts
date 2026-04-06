import { supabase } from '../config/supabase';
import { handleAuthError } from './errorHandler';
import { chatMessagesService } from './chatMessagesService';
import { QuickEntryData } from '../components/QuickEntryCard';
import {
  canUseHealthRecordsChatMessageId,
  isHealthRecordsChatMessageIdUnsupportedError,
  markHealthRecordsChatMessageIdUnsupported,
} from '../utils/healthRecordsInsert';
import { mergeQuickEntryCardsFromRpcPayload, type MergedQuickEntryCard } from '../lib/mergeQuickEntryAggregate';
import { getBeijingDayBoundsFromDateKey, toBeijingDateString } from '../utils/dateUtils';
import type { GetTodayQuickEntryMergeInputsArgs } from '../types/database.types';

function mapMergedToAggregate(c: MergedQuickEntryCard): QuickEntryAggregateCard {
  const data = { ...c.data } as unknown as QuickEntryData;
  if (typeof data.date === 'string') {
    data.date = new Date(data.date);
  }
  return {
    id: c.id,
    metricType: c.metricType as QuickEntryData['metricType'],
    data,
    isConfirmed: c.isConfirmed,
    createdAt: c.createdAt,
    timestamp: c.timestamp,
    sourceType: c.sourceType,
    sourceId: c.sourceId,
  };
}

/** 今日 chat quickEntry + health_records 合并去重后的一条展示项（日反馈卡片 / Hook 统计用） */
export interface QuickEntryAggregateCard {
  id: string;
  metricType: QuickEntryData['metricType'];
  data: QuickEntryData;
  isConfirmed: boolean;
  createdAt: Date | string;
  timestamp: string;
  sourceType?: 'chat' | 'health' | 'exercise' | 'emotion';
  sourceId?: string;
}

export const quickEntryCardsService = {
  /**
   * 今日快捷录入合并列表：RPC get_today_quick_entry_merge_inputs + 与 Edge 共用的 mergeQuickEntryCardsFromRpcPayload
   */
  async getTodayQuickEntryCards(): Promise<QuickEntryAggregateCard[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      const ymd = toBeijingDateString(new Date());
      const { start, end } = getBeijingDayBoundsFromDateKey(ymd);

      const rpcArgs: GetTodayQuickEntryMergeInputsArgs = {
        p_user_id: user.id,
        p_day_start: start.toISOString(),
        p_day_end: end.toISOString(),
      };
      const { data: raw, error } = await supabase.rpc('get_today_quick_entry_merge_inputs', rpcArgs);

      if (error) {
        console.error('get_today_quick_entry_merge_inputs:', error);
        return [];
      }

      const merged = mergeQuickEntryCardsFromRpcPayload(raw ?? null);
      return merged.map(mapMergedToAggregate);
    } catch (error) {
      console.error('Error in getTodayQuickEntryCards:', error);
      return [];
    }
  },

  getMetricTypeLabel(metricType: QuickEntryData['metricType']): string {
    const labels: Record<QuickEntryData['metricType'], string> = {
      food: '饮食',
      water: '喝水',
      exercise: '运动',
      steps: '步数',
      weight: '体重',
      sleep: '睡眠',
      measurements: '围度',
      emotion: '心情',
      blood_glucose: '血糖',
      supplement: '补剂',
      breathing: '呼吸练习',
    };

    return labels[metricType] || '记录';
  },

  async updateQuickEntryCard(cardId: string, updatedData: QuickEntryData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      await chatMessagesService.updateMessage(cardId, {
        is_quick_entry_confirmed: true,
        quick_entry_data: updatedData,
      });

      if (updatedData.isSavedToDatabase && canUseHealthRecordsChatMessageId()) {
        const { data: records, error } = await supabase
          .from('health_records')
          .select('*')
          .eq('user_id', user.id)
          .eq('record_type', updatedData.metricType)
          .eq('chat_message_id', cardId);

        if (error) {
          if (isHealthRecordsChatMessageIdUnsupportedError(error)) {
            markHealthRecordsChatMessageIdUnsupported();
            return;
          }
          console.error('Error fetching health records:', error);
          return;
        }

        if (records && records.length > 0) {
          const recordId = records[0].id;

          const updateData: any = {
            recorded_at: updatedData.date ? new Date(updatedData.date).toISOString() : new Date().toISOString(),
            notes: updatedData.notes || null
          };

          switch (updatedData.metricType) {
            case 'food': {
              const existingRecord = records[0];
              if (existingRecord.nutrition_data) {
                updateData.nutrition_data = existingRecord.nutrition_data;
              } else {
                updateData.nutrition_data = {
                  name: updatedData.foodName || '食物',
                  calories: updatedData.calories || 0,
                  mealType: updatedData.mealType || '加餐',
                  quantity: updatedData.quantity || 1,
                };
              }
              break;
            }
            case 'water':
              updateData.value = updatedData.value;
              break;
            case 'exercise':
              updateData.exercise_name = updatedData.exerciseName;
              updateData.duration = updatedData.duration;
              updateData.calories_burned = updatedData.calories;
              updateData.exercise_type = updatedData.exerciseType;
              break;
            case 'weight':
              updateData.value = updatedData.value;
              break;
            case 'sleep':
              updateData.duration = updatedData.value;
              break;
            case 'blood_glucose':
              updateData.value = updatedData.value;
              if (records[0].measurement_time) {
                updateData.measurement_time = records[0].measurement_time;
              }
              break;
            case 'emotion': {
              const inten = updatedData.intensity ?? updatedData.value ?? 0.5;
              updateData.value = inten;
              updateData.emotion_data = {
                emotion: updatedData.emotionType || 'neutral',
                intensity: inten,
                message: updatedData.notes ?? null,
              };
              updateData.notes = updatedData.notes ?? null;
              break;
            }
            case 'supplement':
              updateData.supplement_name = updatedData.supplementName;
              updateData.dosage = updatedData.dosage;
              updateData.unit = updatedData.unit;
              break;
          }

          try {
            const { error: updateError } = await supabase
              .from('health_records')
              .update(updateData)
              .eq('id', recordId);

            if (updateError) {
              console.error('Error updating health record:', updateError);
            }
          } catch (error) {
            console.error('Error updating health record:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in updateQuickEntryCard:', error);
      throw error;
    }
  },

  /**
   * 删除合并列表中的一项：chat 来源先删关联 health_records 再删消息；health 来源删 health_records。
   */
  async removeAggregatedEntry(card: QuickEntryAggregateCard): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      handleAuthError(new Error('User not authenticated'));
    }

    if (card.sourceType === 'health') {
      const { error } = await supabase.from('health_records').delete().eq('id', card.id).eq('user_id', user.id);
      if (error) throw error;
      return;
    }

    const messageId = card.id;
    const metricTypes = [
      'food',
      'water',
      'exercise',
      'steps',
      'weight',
      'sleep',
      'measurements',
      'blood_glucose',
      'supplement',
    ] as const;

    if (!canUseHealthRecordsChatMessageId()) {
      await chatMessagesService.deleteMessage(messageId);
      return;
    }

    for (const type of metricTypes) {
      const { data: records, error: queryError } = await supabase
        .from('health_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('record_type', type)
        .eq('chat_message_id', messageId);

      if (queryError) {
        if (isHealthRecordsChatMessageIdUnsupportedError(queryError)) {
          markHealthRecordsChatMessageIdUnsupported();
          break;
        }
        console.error(`Error querying health records for ${type}:`, queryError);
        continue;
      }
      if (records?.length) {
        const recordIds = records.map((r) => r.id);
        const { error: deleteError } = await supabase.from('health_records').delete().in('id', recordIds);
        if (deleteError) {
          console.error(`Error deleting health records for ${type}:`, deleteError);
        }
      }
    }

    await chatMessagesService.deleteMessage(messageId);
  },
};
