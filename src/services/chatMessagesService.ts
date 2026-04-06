/**
 * chatMessagesService - 聊天消息服务（直接使用 Supabase）
 * 符合架构规范：Hook → Service → Supabase (3层)
 */
 

import { supabase } from '../config/supabase';
import { QuickEntryData } from '../components/QuickEntryCard';
import { toLocalDateString } from '../utils/dateUtils';
import emotionService from './emotionService';

export interface ChatMessageRecord {
  id: string;
  user_id: string;
  message_type: 'user' | 'ai' | 'quickEntry' | 'feedback';
  content: string;
  created_at: string;
  quick_entry_data?: any;
  is_quick_entry_confirmed?: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'quickEntry' | 'feedback';
  content: string;
  timestamp: string;
  createdAt?: string; // 数据库的 created_at，用于精确排序
  quickEntryData?: QuickEntryData;
  isQuickEntryConfirmed?: boolean;
}

/**
 * 将数据库记录转换为前端格式
 */
function convertRecordToMessage(record: ChatMessageRecord): ChatMessage {
  const message: ChatMessage = {
    id: record.id,
    type: record.message_type,
    content: record.content,
    timestamp: new Date(record.created_at).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '-'),
    createdAt: record.created_at // 保留原始 created_at 用于精确排序
  };

  if (record.message_type === 'quickEntry' && record.quick_entry_data) {
    const quickEntryData = { ...record.quick_entry_data } as QuickEntryData;
    if (quickEntryData.date && typeof quickEntryData.date === 'string') {
      quickEntryData.date = new Date(quickEntryData.date);
    }
    message.quickEntryData = quickEntryData;
    message.isQuickEntryConfirmed = record.is_quick_entry_confirmed || false;
  }

  return message;
}

export const chatMessagesService = {
  /**
   * 获取聊天消息（支持分页）
   */
  async getMessages(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ messages: ChatMessageRecord[]; hasMore: boolean }> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const messages = (data || []) as ChatMessageRecord[];
    const hasMore = messages.length >= pageSize;

    return { messages, hasMore };
  },

  /**
   * 获取指定日期的聊天消息（当天 00:00 ~ 次日 00:00，本地时区）
   */
  async getMessagesByDay(userId: string, date: Date): Promise<ChatMessageRecord[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return this.getMessagesByDateRange(userId, start, end);
  },

  /**
   * 获取有对话的日期列表（含首条摘要、情绪 emoji）
   * @param limitDays 向前查找的天数，默认 60
   */
  async getDaysWithMessages(
    userId: string,
    limitDays: number = 60
  ): Promise<{ date: Date; preview: string; emotionEmoji?: string; timeLabel: string }[]> {
    const emotionEmojiMap: Record<string, string> = {
      happy: '😊', sad: '😢', neutral: '😐', excited: '🤩', tired: '😴',
      worried: '😰', angry: '😤',
    };
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - limitDays);
    const records = await this.getMessagesByDateRange(userId, start, end);
    // 按日期分组，优先从当日任意消息中提取情绪 emoji（替换默认 💬）
    const byDate = new Map<string, { date: Date; preview: string; emotionEmoji: string; timeLabel: string }>();
    for (const r of records) {
      const d = new Date(r.created_at);
      const key = toLocalDateString(d);
      const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const raw = r as any;
      let emotionEmoji = '💬';
      if (raw?.emotion_emoji) emotionEmoji = raw.emotion_emoji;
      else if (raw?.quick_entry_data?.emotionType) {
        emotionEmoji = emotionEmojiMap[raw.quick_entry_data.emotionType] || '💬';
      }
      if (!byDate.has(key)) {
        const text = r.message_type === 'user' ? r.content : '';
        const preview = text ? (text.length > 20 ? text.slice(0, 20) + '…' : text) : '对话记录';
        byDate.set(key, { date: d, preview, emotionEmoji, timeLabel });
      } else {
        // 若当日已有记录，但当前消息有情绪且之前是默认 💬，则用情绪 emoji 替换
        const existing = byDate.get(key)!;
        if (emotionEmoji !== '💬' && existing.emotionEmoji === '💬') {
          existing.emotionEmoji = emotionEmoji;
        }
      }
    }
    // 兜底：从 health_records（心情）查询当日情绪，若聊天无情绪 emoji 则补充
    const emotionEmojiByKey: Record<string, string> = {
      happy: '😊', sad: '😢', neutral: '😐', excited: '🤩', tired: '😴',
      worried: '😰', angry: '😤',
    };
    for (const item of byDate.values()) {
      if (item.emotionEmoji === '💬') {
        const dayStart = new Date(item.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(item.date);
        dayEnd.setHours(23, 59, 59, 999);
        const emotionRecords = await emotionService.getEmotionRecords(userId, dayStart, dayEnd);
        const first = emotionRecords[0]; // 最新的一条
        if (first?.emotion) {
          item.emotionEmoji = emotionEmojiByKey[first.emotion] || '💬';
        }
      }
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  },

  /**
   * 获取指定日期范围内的聊天消息
   */
  async getMessagesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ChatMessageRecord[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []) as ChatMessageRecord[];
  },

  /**
   * 添加聊天消息
   */
  async addMessage(
    userId: string,
    messageType: 'user' | 'ai' | 'quickEntry' | 'feedback',
    content: string,
    quickEntryData?: QuickEntryData,
    isQuickEntryConfirmed?: boolean
  ): Promise<ChatMessageRecord> {
    const record: any = {
      user_id: userId,
      message_type: messageType,
      content,
    };

    if (quickEntryData) {
      record.quick_entry_data = quickEntryData;
    }
    if (isQuickEntryConfirmed !== undefined) {
      record.is_quick_entry_confirmed = isQuickEntryConfirmed;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    return data as ChatMessageRecord;
  },

  /**
   * 更新聊天消息（主要用于快速录入卡片的确认状态）
   */
  async updateMessage(
    messageId: string,
    updates: {
      is_quick_entry_confirmed?: boolean;
      quick_entry_data?: QuickEntryData;
    }
  ): Promise<ChatMessageRecord> {
    const { data, error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;

    return data as ChatMessageRecord;
  },

  /**
   * 删除聊天消息
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  },

  /**
   * 批量删除聊天消息
   */
  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .in('id', messageIds);

    if (error) throw error;
  },

  /**
   * 删除指定日期范围内的聊天消息
   */
  async deleteMessagesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    if (error) throw error;
  },

  /**
   * 转换工具函数
   */
  convertRecordToMessage,
};

