import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = supabaseUrl && supabaseUrl.startsWith('http');
const finalUrl = isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

if (!isValidUrl || !supabaseAnonKey) {
  console.warn('⚠️ [Supabase] 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，将使用 localStorage');
}

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    autoRefreshToken: isValidUrl && !!supabaseAnonKey,
    persistSession: isValidUrl && !!supabaseAnonKey,
    detectSessionInUrl: isValidUrl && !!supabaseAnonKey,
  },
});

export const isSupabaseConfigured = isValidUrl && !!supabaseAnonKey;
