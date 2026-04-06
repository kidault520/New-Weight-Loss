/**
 * useChatMessagesQuery - 使用 React Query 的聊天消息 Hook
 * 符合架构规范：组件 → Hook → Service → Supabase (3层)
 */
 

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { chatMessagesService, ChatMessage } from '../services/chatMessagesService';
import { QuickEntryData } from '../components/QuickEntryCard';
import { toLocalDateString } from '../utils/dateUtils';

const PAGE_SIZE = 50;

/**
 * 使用无限滚动查询聊天消息（分页加载）
 * @param enabled 为 false 时不请求（如单日视图时）
 */
export function useChatMessagesInfiniteQuery(enabled: boolean = true) {
  const { user } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ['chat-messages', user?.id],
    queryFn: ({ pageParam = 1 }) => {
      if (!user?.id) throw new Error('User not authenticated');
      return chatMessagesService.getMessages(user.id, pageParam, PAGE_SIZE);
    },
    enabled: !!user?.id && enabled,
    getNextPageParam: (lastPage: any, allPages: any) => {
      return lastPage.hasMore ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 扁平化所有页面的消息
  const messages: ChatMessage[] = query.data?.pages
    .flatMap((page: any) => page.messages)
    .map(chatMessagesService.convertRecordToMessage) || [];

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refresh: () => query.refetch(),
  };
}

/**
 * 使用普通查询获取聊天消息（单页）
 */
export function useChatMessagesQuery(page: number = 1, pageSize: number = PAGE_SIZE) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['chat-messages', user?.id, page, pageSize],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return chatMessagesService.getMessages(user.id, page, pageSize);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  const messages: ChatMessage[] = (query.data?.messages || []).map(
    chatMessagesService.convertRecordToMessage
  );

  return {
    messages,
    hasMore: query.data?.hasMore || false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: () => query.refetch(),
  };
}

/**
 * 获取有对话的日期列表（用于左侧抽屉日历日记流）
 */
export function useConversationDaysQuery(limitDays: number = 60) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['conversation-days', user?.id, limitDays],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return chatMessagesService.getDaysWithMessages(user.id, limitDays);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const normalizedDays = (query.data || []).map((item: any) => {
    const raw = item?.date;
    const date = raw instanceof Date ? raw : new Date(raw);
    return { ...item, date };
  });

  return {
    days: normalizedDays,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: () => query.refetch(),
  };
}

/**
 * 获取指定日期的聊天消息（单日视图）
 */
export function useChatMessagesByDayQuery(date: Date | null) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['chat-messages', user?.id, 'by-day', date ? toLocalDateString(date) : null],
    queryFn: () => {
      if (!user?.id || !date) throw new Error('User or date required');
      return chatMessagesService.getMessagesByDay(user.id, date);
    },
    enabled: !!user?.id && !!date,
    staleTime: 5 * 60 * 1000,
  });

  const messages: ChatMessage[] = (query.data || []).map(
    chatMessagesService.convertRecordToMessage
  );

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: () => query.refetch(),
  };
}

/**
 * 获取指定日期范围内的聊天消息
 */
export function useChatMessagesByDateRangeQuery(startDate: Date, endDate: Date) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['chat-messages', user?.id, 'date-range', startDate.toISOString(), endDate.toISOString()],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return chatMessagesService.getMessagesByDateRange(user.id, startDate, endDate);
    },
    enabled: !!user?.id && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });

  const messages: ChatMessage[] = (query.data || []).map(
    chatMessagesService.convertRecordToMessage
  );

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: () => query.refetch(),
  };
}

/**
 * 添加聊天消息的 Mutation
 */
export function useAddChatMessageMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      messageType,
      content,
      quickEntryData,
      isQuickEntryConfirmed,
    }: {
      messageType: 'user' | 'ai' | 'quickEntry' | 'feedback';
      content: string;
      quickEntryData?: QuickEntryData;
      isQuickEntryConfirmed?: boolean;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      return chatMessagesService.addMessage(
        user.id,
        messageType,
        content,
        quickEntryData,
        isQuickEntryConfirmed
      );
    },
    onSuccess: (_data, variables) => {
      if (user?.id) {
        if (variables.messageType === 'quickEntry') {
          queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', user.id] });
          queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', user.id] });
        }
      }
      setTimeout(() => {
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', user.id] });
          queryClient.invalidateQueries({ queryKey: ['conversation-days', user.id] });
        }
      }, 500);
    },
  });
}

/**
 * 更新聊天消息的 Mutation（主要用于快速录入卡片的确认）
 */
export function useUpdateChatMessageMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      messageId,
      updates,
    }: {
      messageId: string;
      updates: {
        is_quick_entry_confirmed?: boolean;
        quick_entry_data?: QuickEntryData;
      };
    }) => {
      return chatMessagesService.updateMessage(messageId, updates);
    },
    onSuccess: (_data, variables) => {
      // 🔥 修复：立即刷新缓存，确保状态实时更新
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', user.id] });
        if (variables.updates?.is_quick_entry_confirmed !== undefined) {
          queryClient.invalidateQueries({ queryKey: ['today-quick-entry-cards', user.id] });
          queryClient.invalidateQueries({ queryKey: ['daily-feedback-fixed', user.id] });
        }
      }
    },
  });
}

/**
 * 删除聊天消息的 Mutation
 */
export function useDeleteChatMessageMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => {
      return chatMessagesService.deleteMessage(messageId);
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['conversation-days', user?.id] });
      }, 500);
    },
  });
}

/**
 * 批量删除聊天消息的 Mutation
 */
export function useDeleteChatMessagesMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageIds: string[]) => {
      return chatMessagesService.deleteMessages(messageIds);
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['conversation-days', user?.id] });
      }, 500);
    },
  });
}

