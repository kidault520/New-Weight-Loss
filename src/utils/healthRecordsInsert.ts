import { supabase } from '../config/supabase';

const CHAT_MESSAGE_ID_SUPPORT_KEY = 'healthRecords_chatMessageId_supported';
let chatMessageIdSupportedCache: boolean | null = null;

function readChatMessageIdSupportCache(): boolean {
  if (chatMessageIdSupportedCache !== null) return chatMessageIdSupportedCache;
  if (typeof window === 'undefined') {
    chatMessageIdSupportedCache = true;
    return true;
  }

  try {
    const raw = window.localStorage.getItem(CHAT_MESSAGE_ID_SUPPORT_KEY);
    chatMessageIdSupportedCache = raw === 'false' ? false : true;
  } catch {
    chatMessageIdSupportedCache = true;
  }
  return chatMessageIdSupportedCache;
}

function writeChatMessageIdSupportCache(supported: boolean): void {
  chatMessageIdSupportedCache = supported;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAT_MESSAGE_ID_SUPPORT_KEY, supported ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

export function isHealthRecordsChatMessageIdUnsupportedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: string; message?: string; details?: string };
  const message = String(e.message || '');
  const details = String(e.details || '');
  const code = String(e.code || '');
  // PostgREST：列不在 schema cache；勿用「message 含 chat_message_id」兜底，否则会把其它 400 误判为可忽略
  if (code === 'PGRST204') return true;
  const combined = `${message} ${details}`.toLowerCase();
  return (
    combined.includes('could not find') &&
    combined.includes('chat_message_id') &&
    (combined.includes('column') || combined.includes('schema cache'))
  );
}

export function canUseHealthRecordsChatMessageId(): boolean {
  return readChatMessageIdSupportCache();
}

export function markHealthRecordsChatMessageIdUnsupported(): void {
  writeChatMessageIdSupportCache(false);
}

/**
 * 写入 health_records：优先保证落库，不因 chat_messages 外键或聊天侧异常挡写入。
 *
 * 策略：插入时**不带** chat_message_id；插入成功后若有合法 id，再 **UPDATE** 尝试挂上关联。
 * 若 UPDATE 失败（消息未落库、已删、FK 等），记录仍在，仅失去跨表链接，并打 warn。
 */
export async function insertHealthRecordWithChatMessageFallback(
  row: Record<string, unknown>
): Promise<{ error: { code?: string; message?: string; details?: string } | null }> {
  const chatMessageId = row.chat_message_id;
  const hadChat =
    chatMessageId != null && chatMessageId !== '' && String(chatMessageId).trim() !== '';
  const shouldTryLinkChat = hadChat && canUseHealthRecordsChatMessageId();

  const { chat_message_id: _omit, ...rowWithoutChat } = row;

  const { data, error } = await supabase
    .from('health_records')
    .insert(rowWithoutChat)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error };
  }

  const newId = data && typeof (data as { id?: string }).id === 'string' ? (data as { id: string }).id : null;

  if (shouldTryLinkChat && newId) {
    const { error: linkError } = await supabase
      .from('health_records')
      .update({ chat_message_id: chatMessageId })
      .eq('id', newId);

    if (linkError) {
      if (isHealthRecordsChatMessageIdUnsupportedError(linkError)) {
        markHealthRecordsChatMessageIdUnsupported();
        return { error: null };
      }
      console.warn(
        '[healthRecordsInsert] 健康记录已保存，但未能关联 chat_messages（聊天侧异常可忽略）:',
        linkError.message
      );
    }
  }

  return { error: null };
}
