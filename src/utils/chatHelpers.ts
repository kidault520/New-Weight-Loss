/**
 * 聊天相关辅助函数
 */

import { formatChatTimestamp } from './chatUtils';
import { chatMessagesService } from '../services/chatMessagesService';
import { supabase } from '../config/supabase';
import type { ChatMessage } from '../contexts/ChatContext';
import { ABILITY_LABEL_TO_CARD_TYPE } from '../constants/abilityCard';

/** 从数据库加载的消息中识别便签消息，补充 abilityCardType 和 abilityCardVisible */
/** @param closedMessageIds 用户已关闭的便签消息 ID 集合，关闭后不再展示 */
export function enrichAbilityCardMessages(
  messages: ChatMessage[],
  closedMessageIds: Set<string> = new Set()
): ChatMessage[] {
  return messages.map((msg) => {
    const cardType = msg.type === 'user' && msg.content ? ABILITY_LABEL_TO_CARD_TYPE[msg.content] : undefined;
    if (cardType) {
      const visible = !closedMessageIds.has(msg.id);
      return {
        ...msg,
        abilityCardType: cardType,
        abilityCardVisible: visible,
      };
    }
    return msg;
  });
}

/**
 * 按时间戳排序消息
 */
export const sortMessagesByTimestamp = (messages: ChatMessage[]): ChatMessage[] => {
  const typePriority = (msg: ChatMessage): number => {
    if (msg.type === 'user') return 1;
    if (msg.type === 'quickEntry') return 2;
    if (msg.type === 'feedback') return 3;
    if (msg.type === 'ai') return 4;
    return 9;
  };

  return [...messages].sort((a, b) => {
    // 欢迎消息（welcome-temp）始终排在最前面
    if (a.id === 'welcome-temp' || a.id.startsWith('welcome-')) {
      return -1;
    }
    if (b.id === 'welcome-temp' || b.id.startsWith('welcome-')) {
      return 1;
    }
    
    // 优先使用 createdAt（数据库的 created_at），这是最准确的
    if (a.createdAt && b.createdAt) {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      const p = typePriority(a) - typePriority(b);
      if (p !== 0) return p;
      // 同为 user 且毫秒级时间相同：真实发言在上，便签占位（ability- / abilityCardType）在下，避免 id 字典序把卡片排到用户句子上方
      const abilityPlaceholderRank = (msg: ChatMessage): number =>
        Boolean(msg.abilityCardType) || msg.id.startsWith('ability-') ? 1 : 0;
      const ap = abilityPlaceholderRank(a) - abilityPlaceholderRank(b);
      if (ap !== 0) return ap;
      return a.id.localeCompare(b.id);
    } else if (a.createdAt) {
      return -1; // a 有 createdAt，排在前面
    } else if (b.createdAt) {
      return 1; // b 有 createdAt，排在前面
    }
    
    // 如果没有 createdAt，尝试从消息ID中提取时间戳
    const getIdTimestamp = (id: string): number => {
      // 尝试从ID中提取时间戳
      // 格式可能是：纯数字、temp-数字、temp-ai-数字等
      const match = id.match(/\d+/);
      if (match) {
        const timestamp = parseInt(match[0]);
        // 如果是合理的时间戳（2000年之后），使用它
        if (timestamp > 946684800000) { // 2000-01-01 00:00:00 UTC
          return timestamp;
        }
      }
      return 0;
    };
    
    // 解析时间戳字符串 "MM-DD HH:mm" 并转换为可比较的值
    const parseTimestamp = (ts: string, msgId: string): number => {
      try {
        // 尝试解析 "MM-DD HH:mm" 格式
        const [datePart, timePart] = ts.split(' ');
        if (datePart && timePart) {
          const [month, day] = datePart.split('-').map(Number);
          const [hour, minute] = timePart.split(':').map(Number);
          const now = new Date();
          const messageDate = new Date(now.getFullYear(), month - 1, day, hour, minute);
          return messageDate.getTime();
        }
      } catch (e) {
        // 解析失败，使用ID中的时间戳
        return getIdTimestamp(msgId);
      }
      // 如果时间戳解析失败，使用ID中的时间戳
      return getIdTimestamp(msgId);
    };
    
    // 优先使用ID中的时间戳
    const idTimeA = getIdTimestamp(a.id);
    const idTimeB = getIdTimestamp(b.id);
    
    if (idTimeA > 0 && idTimeB > 0) {
      // 如果两个ID都有有效的时间戳，直接比较
      if (idTimeA !== idTimeB) {
        return idTimeA - idTimeB;
      }
    }
    
    // 否则使用时间戳字符串解析
    const timeA = parseTimestamp(a.timestamp, a.id);
    const timeB = parseTimestamp(b.timestamp, b.id);
    
    // 如果时间戳相同，使用ID作为次要排序
    if (timeA === timeB) {
      const p = typePriority(a) - typePriority(b);
      if (p !== 0) return p;
      return a.id.localeCompare(b.id);
    }
    
    return timeA - timeB;
  });
};

/**
 * 创建欢迎消息
 */
export const createWelcomeMessage = (aiName: string, ownerName: string): ChatMessage => {
  // 使用一个很早的时间戳，确保欢迎消息始终排在最前面
  const earlyDate = new Date('2000-01-01T00:00:00Z');
  return {
    id: 'welcome-temp',
    type: 'ai' as const,
    content: `我是${aiName}～${ownerName}想我了吗？我可以陪${ownerName}聊天聊好久好久呢！\n\n${aiName}最会听${ownerName}说话啦，不开心的事情都可以告诉我哦～\n\n我知道好多健康小知识，可以告诉${ownerName}怎么吃好睡好呢！\n\n${ownerName}想聊什么都可以，${aiName}都会认真听的！\n\n你可以自由定义你喜欢的搭子风格哦，点击[我的图像]即可开始定制！`,
    timestamp: formatChatTimestamp(earlyDate),
    createdAt: earlyDate.toISOString() // 使用很早的时间，确保始终排在最前面
  };
};

/**
 * 检查消息列表中是否已有欢迎消息
 */
export const hasWelcomeMessage = (messages: ChatMessage[]): boolean => {
  return messages.some(msg => 
    msg.type === 'ai' && 
    (msg.content.includes('想我了吗') || 
     msg.content.includes('很高兴为你服务') ||
     msg.content.includes('可以陪你聊天') ||
     msg.content.includes('最会听') ||
     msg.content.includes('健康小知识'))
  );
};

/**
 * 加载今日卡片计数
 */
export const loadTodayCardCount = async (): Promise<number> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 使用新的 chatMessagesService 获取今天的消息
    const allMessages = await chatMessagesService.getMessagesByDateRange(user.id, today, tomorrow);
    
    // 过滤出今天的 quickEntry 消息
    const quickEntryMessages = allMessages.filter(msg => 
      msg.message_type === 'quickEntry'
    );

    return quickEntryMessages.length;
  } catch {
    return 0;
  }
};

