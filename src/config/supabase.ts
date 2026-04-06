import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isProduction = import.meta.env.PROD;

const isValidUrl = typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl);
const hasAnonKey = typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 0;

if (isProduction && (!isValidUrl || !hasAnonKey)) {
  throw new Error(
    '[Supabase Config] 生产环境缺少有效配置：请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  );
}

// 非生产环境允许占位配置，便于本地开发
const finalUrl = isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = hasAnonKey ? supabaseAnonKey : 'placeholder-key';

if (!isValidUrl || !hasAnonKey) {
  console.warn('⚠️ [Supabase Config] Missing or invalid Supabase configuration:', {
    url: supabaseUrl ? 'provided but invalid' : 'missing',
    key: hasAnonKey ? 'provided' : 'missing'
  });
  console.warn('💡 [Supabase Config] App will run with limited functionality in non-production mode.');
  console.warn('💡 [Supabase Config] Please update .env file with valid Supabase credentials.');
}

console.log('✅ [Supabase Config] Initialized:', { 
  url: finalUrl.substring(0, 30) + '...', 
  hasKey: !!finalKey,
  isValid: isValidUrl && hasAnonKey
});

/** `database.types` 未列全表时 `createClient<Database>()` 会使全库 `.from()` 推断为 `never`；RPC 等仍可从 `../types/database.types` 单独引类型 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(finalUrl, finalKey, {
  auth: {
    autoRefreshToken: isValidUrl && hasAnonKey,
    persistSession: isValidUrl && hasAnonKey,
    detectSessionInUrl: isValidUrl && hasAnonKey
  }
});

// Auth helpers
export const auth = {
  async signUp(email: string, password: string, userData?: any) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

export default supabase;