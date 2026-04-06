/**
 * 待办自动确认服务
 * 规则：当天 23:59 前用户未手动处理的待办，系统在 23:59 后自动确认并写入健康记录
 * 历史日期的未确认待办，在用户打开应用时自动确认
 */

import { supabase } from '../config/supabase';
import { handleAuthError } from './errorHandler';
import { chatMessagesService } from './chatMessagesService';
import { quickEntrySyncService, sanitizeChatMessageIdForHealthRecord } from './quickEntrySyncService';
import { QuickEntryData } from '../components/QuickEntryCard';

const AUTO_CONFIRM_HOUR = 23;
const AUTO_CONFIRM_MINUTE = 59;

/** 判断当前时间是否已过当天 23:59 */
function isPastAutoConfirmTime(now: Date): boolean {
  return now.getHours() > AUTO_CONFIRM_HOUR || (now.getHours() === AUTO_CONFIRM_HOUR && now.getMinutes() >= AUTO_CONFIRM_MINUTE);
}

/** 判断日期是否为今天（本地时区） */
function isToday(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}

export const pendingQuickEntryService = {
  /**
   * 自动确认过期的待办数据
   * - 今天创建的待办：若当前时间 >= 23:59，自动确认
   * - 昨天及更早的待办：直接自动确认
   * @returns 自动确认的数量
   */
  async autoConfirmStalePendingEntries(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 获取最近 7 天内的 quickEntry 消息
      const allMessages = await chatMessagesService.getMessagesByDateRange(
        user!.id,
        sevenDaysAgo,
        new Date(now.getTime() + 60000) // 包含当前时刻
      );

      const unconfirmedQuickEntries = allMessages.filter(
        (msg) => msg.message_type === 'quickEntry' && !msg.is_quick_entry_confirmed && msg.quick_entry_data
      );

      if (unconfirmedQuickEntries.length === 0) return 0;

      let confirmedCount = 0;
      for (const record of unconfirmedQuickEntries) {
        const createdAt = new Date(record.created_at);

        // 今天的待办：仅当已过 23:59 时自动确认
        if (isToday(createdAt) && !isPastAutoConfirmTime(now)) {
          continue;
        }

        try {
          const quickEntryData = { ...record.quick_entry_data } as QuickEntryData;
          if (quickEntryData.date && typeof quickEntryData.date === 'string') {
            quickEntryData.date = new Date(quickEntryData.date);
          }

          const syncSuccess = await quickEntrySyncService.syncCardToHealthRecords({
            ...quickEntryData,
            chatMessageId: sanitizeChatMessageIdForHealthRecord(record.id),
          });
          if (!syncSuccess) {
            console.warn(`⚠️ [pendingQuickEntryService] 自动确认跳过（同步失败）: ${record.id}`);
            continue;
          }
          const nextData = {
            ...quickEntryData,
            isSavedToDatabase: syncSuccess,
            syncedToRecords: syncSuccess,
            dataSource: quickEntryData.dataSource || 'ai',
          };

          await chatMessagesService.updateMessage(record.id, {
            is_quick_entry_confirmed: true,
            quick_entry_data: nextData,
          });

          confirmedCount++;
          console.log(`✅ [pendingQuickEntryService] 自动确认待办: ${record.id} (${quickEntryData.metricType})`);
        } catch (err) {
          console.error(`❌ [pendingQuickEntryService] 自动确认失败:`, record.id, err);
        }
      }

      return confirmedCount;
    } catch (error) {
      console.error('❌ [pendingQuickEntryService] autoConfirmStalePendingEntries error:', error);
      return 0;
    }
  },
};
