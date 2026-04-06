/**
 * Supabase `Database` 类型（当前为增量手写）。
 * 完整表结构可在本机启动 Supabase（Docker）后执行：
 *   npx supabase gen types typescript --local > src/types/database.generated.ts
 * 再与本文合并或替换。
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_today_quick_entry_merge_inputs: {
        Args: {
          p_user_id: string;
          p_day_start: string;
          p_day_end: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/** RPC 参数别名，便于调用处复用 */
export type GetTodayQuickEntryMergeInputsArgs =
  Database['public']['Functions']['get_today_quick_entry_merge_inputs']['Args'];
