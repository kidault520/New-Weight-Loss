 
import { supabase } from '../config/supabase';
import { QuickEntryData } from '../components/QuickEntryCard';
import { chatMessagesService } from './chatMessagesService';
import { handleAuthError } from './errorHandler';

export const dailyCounterService = {
  /**
   * Get the count of entries for a specific metric type today
   * This includes both confirmed records in health_records and unconfirmed quickEntry cards in chat_messages
   * 直接使用 Supabase 查询，符合 3 层架构规范
   */
  async getDailyCount(metricType: QuickEntryData['metricType']): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleAuthError(new Error('User not authenticated'));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 直接使用 Supabase 查询健康记录
      const { data: healthRecords, error } = await supabase
        .from('health_records')
        .select('id, recorded_at')
        .eq('user_id', user.id)
        .eq('record_type', metricType)
        .gte('recorded_at', today.toISOString())
        .lt('recorded_at', tomorrow.toISOString());

      if (error) {
        console.error('Error fetching health records:', error);
        return 1; // 返回默认值
      }

      const healthRecordCount = healthRecords?.length || 0;

      // 使用新的 chatMessagesService 获取今天的聊天消息
      const allChatMessages = await chatMessagesService.getMessagesByDateRange(user.id, today, tomorrow);
      
      // 过滤出今天的 quickEntry 消息
      const chatMessages = allChatMessages.filter((msg: any) => 
        msg.message_type === 'quickEntry'
      );

      // Count quickEntry cards that match the metric type (both confirmed and unconfirmed)
      const quickEntryCount = chatMessages?.filter((msg: any) => {
        const data = msg.quick_entry_data as QuickEntryData | null;
        return data && data.metricType === metricType;
      }).length || 0;

      // Total count is health records + quickEntry cards + 1 (for the new card being created)
      return healthRecordCount + quickEntryCount + 1;
    } catch (error) {
      console.error('Error in getDailyCount:', error);
      return 1;
    }
  },

  /**
   * Get daily counts for multiple metric types
   */
  async getDailyCounts(metricTypes: QuickEntryData['metricType'][]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    for (const type of metricTypes) {
      const count = await this.getDailyCount(type);
      counts.set(type, count);
    }

    return counts;
  }
};
