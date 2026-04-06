import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { API_BASE_URL } from '../services/api';
import { User, Session } from '@supabase/supabase-js';
import { clearUserStorage } from '../utils/userStorage';
import { AUTH_GET_USER_INIT_TIMEOUT_MS, SIGN_IN_WITH_PHONE_TOTAL_MS } from '../constants/authTimeouts';

// REMOVED: Helper function to sync onboarding data from localStorage to database after login
// This function caused race conditions where has_seen_onboarding was set to true prematurely
// causing new users to see the app home page flash before completing onboarding.
// Data is now saved directly by HealthReportPage when user clicks "查看营养方案" button.

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPhone: (phone: string, verificationCode: string) => Promise<{ error: AuthFlowError | null }>;
  signInWithWeChat: () => Promise<{ error: AuthFlowError | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  hasActiveSession: boolean;
}

export type AuthFlowError = Error & {
  code?: string;
  status?: number;
};

function makeAuthFlowError(message: string, code?: string, status?: number): AuthFlowError {
  const err = new Error(message) as AuthFlowError;
  if (code) err.code = code;
  if (typeof status === 'number') err.status = status;
  return err;
}

/** 冷启动 getUser() 偶发 403 / 网络错误时，仍保留 getSession() 用户，避免立刻 signOut 造成「刚登录就被踢」 */
function shouldUseSessionUserWhenGetUserFails(
  userError: unknown,
  fetchedUser: User | null,
  sessionUser: User | null
): boolean {
  if (!sessionUser) return false;
  const status =
    userError && typeof userError === 'object' && 'status' in userError
      ? Number((userError as { status?: number }).status)
      : NaN;
  const msg = userError instanceof Error ? userError.message : '';
  if (status === 403 || /403|Forbidden/i.test(msg)) return true;
  if (
    /Failed to fetch|NetworkError|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ERR_NETWORK|timeout/i.test(msg)
  ) {
    return true;
  }
  // 无明确错误但 user 为空：可能是网关/解析异常，有本地 session.user 时先不踢下线
  if (!fetchedUser && !msg) return true;
  return false;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const previousUserIdRef = React.useRef<string | null>(null);
  const hasInitializedRef = React.useRef(false);
  /** 防止重复点击登录导致并发 signInWithPhone 与 setSession 竞态 */
  const signInWithPhoneInFlightRef = React.useRef<Promise<{ error: AuthFlowError | null }> | null>(null);

  /**
   * 清除旧用户的所有缓存和同步状态
   * 在用户切换时调用，确保数据隔离
   */
  const clearPreviousUserData = async (oldUserId: string | null) => {
    if (!oldUserId) return;
    
    console.log(`🧹 [AuthContext] Clearing data for previous user: ${oldUserId}`);
    
    try {
      // 使用统一的清理函数清除该用户的所有数据
      clearUserStorage(oldUserId);
      
      // 清除该用户的同步时间
      const syncTimesKey = `sync_last_sync_times:user:${oldUserId}`;
      localStorage.removeItem(syncTimesKey);
      
      // 清除缓存（直接清除 localStorage）
      try {
        // 清除所有缓存相关的键
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('cache:') || key.startsWith('records:'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('  ✓ Cleared cache');
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
      
      // 清除所有包含该用户ID的缓存键（新格式：带 :user:userId）
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes(`:user:${oldUserId}`) ||
          (key.startsWith('cache:') && key.includes(`:user:${oldUserId}`)) ||
          (key.startsWith('records:') && key.includes(`:user:${oldUserId}`))
        )) {
          keysToRemove.push(key);
        }
      }
      
      // 也清除旧格式的键（向后兼容）
      // 注意：这些旧格式的键没有用户ID，所以切换用户时必须清除
      const oldFormatKeys = [
        'userProfile',
        'onboarding_data',
        'onboarding_step',
        'mealAddresses',
        'userDayDataOverrides',
        'dashboardCardOrder',
        'hiddenDashboardCards',
        'meal_plan_configured',
        'meal_plan_config_data',
        'mealPlan_lockedMeals',
        'mealPlan_manuallyModifiedMeals',
        'customFoods',
        'customExercises',
        'addressCustomTags',
        'has_seen_reports',
        'has_seen_onboarding',
        'onboarding_completed',
        'onboarding_skipped',
        'health_report_saved',
        'step14_profile_saved',
        'mealPlan_justReset'
      ];
      
      // 清除旧格式的键（这些键没有用户ID，所以切换用户时必须清除）
      oldFormatKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          keysToRemove.push(key);
        }
      });
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          console.log(`  ✓ Removed: ${key}`);
        } catch (error) {
          console.error(`  ✗ Failed to remove ${key}:`, error);
        }
      });
      
      console.log(`✅ [AuthContext] Cleared ${keysToRemove.length} cache entries for user ${oldUserId}`);
    } catch (error) {
      console.error('❌ [AuthContext] Error clearing previous user data:', error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 🔧 关键修复：检查退出登录标记，防止自动恢复已退出的session
        const signoutFlag = localStorage.getItem('_user_signout_flag');
        if (signoutFlag === 'true') {
          // 清除所有Supabase session键
          const supabaseKeys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
              supabaseKeys.push(key);
            }
          }
          supabaseKeys.forEach(key => localStorage.removeItem(key));
          await supabase.auth.signOut();
          // 清除退出标记（已经处理过了）
          localStorage.removeItem('_user_signout_flag');
          
          previousUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setHasActiveSession(false);
          setLoading(false);
          return;
        }

        // 🔧 关键修复：先检查是否有有效的 session
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.log('🔒 [AuthContext] Session check error:', sessionError.message);
          // 清除可能存在的无效会话
          await supabase.auth.signOut();
          previousUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setHasActiveSession(false);
          setLoading(false);
          return;
        }

        // 如果 session 存在，验证用户（getUser 可能长时间无响应，须超时兜底）
        if (existingSession) {
          // 验证 session 是否真的有效（检查过期时间）
          const now = Math.floor(Date.now() / 1000);
          if (existingSession.expires_at && existingSession.expires_at < now) {
            console.log('🔒 [AuthContext] Session expired, clearing...');
            await supabase.auth.signOut();
            previousUserIdRef.current = null;
            setUser(null);
            setSession(null);
            setHasActiveSession(false);
            setLoading(false);
            return;
          }

          const getUserPromise = supabase.auth.getUser();
          const timeoutPromise = new Promise<{ __authTimeout: true }>((resolve) => {
            setTimeout(() => resolve({ __authTimeout: true }), AUTH_GET_USER_INIT_TIMEOUT_MS);
          });
          const raced = await Promise.race([
            getUserPromise.then((r) => ({ getUserResult: r as Awaited<typeof getUserPromise> })),
            timeoutPromise,
          ]);

          let effectiveUser: User = existingSession.user;

          if ('__authTimeout' in raced && raced.__authTimeout) {
            console.warn(
              `⚠️ [AuthContext] getUser() exceeded ${AUTH_GET_USER_INIT_TIMEOUT_MS}ms; using user from local session.`
            );
          } else {
            const { getUserResult } = raced as {
              getUserResult: Awaited<typeof getUserPromise>;
            };
            const { data: { user: fetchedUser }, error: userError } = getUserResult;

            if (userError || !fetchedUser) {
              if (shouldUseSessionUserWhenGetUserFails(userError, fetchedUser, existingSession.user)) {
                console.warn(
                  '⚠️ [AuthContext] getUser() 未通过校验，暂沿用本地会话用户（避免误判登出）。若档案/接口仍失败，请核对前后端 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY 与网络/VPN。',
                  userError?.message || ''
                );
                effectiveUser = existingSession.user;
              } else {
                console.log('🔒 [AuthContext] Invalid session or user:', userError?.message);
                await supabase.auth.signOut();
                previousUserIdRef.current = null;
                setUser(null);
                setSession(null);
                setHasActiveSession(false);
                setLoading(false);
                return;
              }
            } else {
              effectiveUser = fetchedUser;
            }
          }

          // User has a valid session - restore it
          console.log('🔓 [AuthContext] Found existing session, restoring user');
          const userId = effectiveUser.id;

          // 清除退出标记（用户已经登录，说明这不是退出后的刷新）
          localStorage.removeItem('_user_signout_flag');

          // 检查是否切换了用户
          if (previousUserIdRef.current !== null && previousUserIdRef.current !== userId) {
            console.log(`🔄 [AuthContext] User switched from ${previousUserIdRef.current} to ${userId}`);
            await clearPreviousUserData(previousUserIdRef.current);
          }

          previousUserIdRef.current = userId;
          setUser(effectiveUser);
          setSession(existingSession);
          setHasActiveSession(true);
        } else {
          // No existing session - user needs to login
          
          // 清除退出标记（没有session说明已经退出）
          localStorage.removeItem('_user_signout_flag');
          
          // 如果有之前的用户，清除其数据
          if (previousUserIdRef.current !== null) {
            await clearPreviousUserData(previousUserIdRef.current);
          }
          
          previousUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setHasActiveSession(false);
        }
      } catch (error) {
        console.error('❌ [AuthContext] Error initializing auth:', error);
        // 出错时清除状态
        await supabase.auth.signOut();
        previousUserIdRef.current = null;
        setUser(null);
        setSession(null);
        setHasActiveSession(false);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      const newUserId = newSession?.user?.id || null;
      const oldUserId = previousUserIdRef.current;
      
      // 忽略 INITIAL_SESSION 事件（只在真正的初始化时处理，避免页面可见性变化时重复触发）
      if (event === 'INITIAL_SESSION') {
        if (!hasInitializedRef.current && newSession) {
          console.log('🔐 [AuthContext] INITIAL_SESSION event (first time)');
          hasInitializedRef.current = true;
          previousUserIdRef.current = newUserId;
          setSession(newSession);
          setUser(newSession.user);
          setHasActiveSession(true);
          // 避免与 initializeAuth 里 await getUser() 竞态：UI 已可登录态，auth loading 必须结束
          setLoading(false);
        }
        return;
      }
      
      // 检测用户切换（不是登出）
      if (event === 'SIGNED_IN' && newSession) {
        // 检查是否是用户切换
        if (oldUserId !== null && oldUserId !== newUserId) {
          console.log(`🔄 [AuthContext] User switched from ${oldUserId} to ${newUserId}`);
          await clearPreviousUserData(oldUserId);
        } else if (!hasInitializedRef.current) {
          // 首次登录
          console.log('🔐 [AuthContext] SIGNED_IN event (first time)');
          hasInitializedRef.current = true;
        } else {
          // 已经初始化且用户未变化，忽略（可能是页面可见性变化导致的重复触发）
          setLoading(false);
          return;
        }
        
        previousUserIdRef.current = newUserId;
        setSession(newSession);
        setUser(newSession.user);
        // 清除退出标记（用户已成功登录）
        localStorage.removeItem('_user_signout_flag');
        setHasActiveSession(true);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        // 登出时清除用户数据
        hasInitializedRef.current = false;
        if (oldUserId !== null) {
          await clearPreviousUserData(oldUserId);
        }
        previousUserIdRef.current = null;
        setUser(null);
        setSession(null);
        setHasActiveSession(false);
        setLoading(false);
      } else {
        // 其他事件（如 TOKEN_REFRESHED）正常处理
        if (newSession) {
          previousUserIdRef.current = newUserId;
          setSession(newSession);
          setUser(newSession.user);
          setLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPhone = async (phone: string, verificationCode: string) => {
    const existing = signInWithPhoneInFlightRef.current;
    if (existing) {
      return existing;
    }

    const loginAttempt = (async (): Promise<{ error: AuthFlowError | null }> => {
      let signOutGuardSub: { unsubscribe: () => void } | null = null;
      let resolveSignOutDuringLogin: (() => void) | null = null;
      const signOutDuringLoginPromise = new Promise<void>((resolve) => {
        resolveSignOutDuringLogin = resolve;
      });

      try {
        const { data: guardData } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') {
            resolveSignOutDuringLogin?.();
            resolveSignOutDuringLogin = null;
          }
        });
        signOutGuardSub = guardData.subscription;

        const abortedDuringLogin = () =>
          makeAuthFlowError(
            '登录已中断（可能已登出或清除了本地数据）。请勿在登录过程中点击开发工具里的「清除所有数据」，完成后可重新登录。',
            'LOGIN_ABORTED'
          );

        const deadline = Date.now() + SIGN_IN_WITH_PHONE_TOTAL_MS;
        const resolveIfSessionReady = async (): Promise<boolean> => {
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession?.access_token && currentSession?.user) {
              setSession(currentSession);
              setUser(currentSession.user);
              setHasActiveSession(true);
              localStorage.removeItem('_user_signout_flag');
              return true;
            }
          } catch {
            // ignore session probe errors on timeout fallback
          }
          return false;
        };

        try {
          const { error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            if (
              sessionError.message?.includes('Failed to fetch') ||
              sessionError.message?.includes('ERR_NAME_NOT_RESOLVED')
            ) {
              return {
                error: makeAuthFlowError(
                  'Supabase 服务无法访问，请检查 .env 文件中的 VITE_SUPABASE_URL 配置是否正确',
                  'SUPABASE_UNREACHABLE'
                ),
              };
            }
          }
        } catch (sessionCheckError: any) {
          if (
            sessionCheckError?.message?.includes('Failed to fetch') ||
            sessionCheckError?.message?.includes('ERR_NAME_NOT_RESOLVED')
          ) {
            return {
              error: makeAuthFlowError(
                'Supabase 服务无法访问，请检查 .env 文件中的 VITE_SUPABASE_URL 配置是否正确',
                'SUPABASE_UNREACHABLE'
              ),
            };
          }
          return { error: makeAuthFlowError('无法连接到认证服务，请检查网络连接', 'NETWORK_UNAVAILABLE') };
        }

        if (Date.now() >= deadline) {
          if (await resolveIfSessionReady()) {
            return { error: null };
          }
          return { error: makeAuthFlowError('登录请求超时，请检查网络后重试', 'LOGIN_TIMEOUT') };
        }

        const loginUrl = `${API_BASE_URL}/auth/login-with-code`;
        const controller = new AbortController();
        const fetchBudgetMs = Math.max(1, deadline - Date.now());
        const abortTimer = setTimeout(() => controller.abort(), fetchBudgetMs);

        let res: Response;
        try {
          const fetchPromise = fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, verificationCode }),
            signal: controller.signal,
          });
          const fetchOutcome = await Promise.race([
            fetchPromise.then((r) => ({ tag: 'response' as const, r })),
            signOutDuringLoginPromise.then(() => ({ tag: 'signout' as const })),
          ]);
          if (fetchOutcome.tag === 'signout') {
            controller.abort();
            return { error: abortedDuringLogin() };
          }
          res = fetchOutcome.r;
        } finally {
          clearTimeout(abortTimer);
        }

        if (Date.now() >= deadline) {
          if (await resolveIfSessionReady()) {
            return { error: null };
          }
          return { error: makeAuthFlowError('登录请求超时，请检查网络后重试', 'LOGIN_TIMEOUT') };
        }

        let payload: any = {};
        try {
          payload = await res.json();
        } catch {
          payload = {};
        }

        if (!res.ok) {
          let msg =
            payload.error ||
            payload.message ||
            (res.status === 401 ? '验证码错误或已过期，请重新获取' : `登录失败 (${res.status})`);
          if (res.status === 404) {
            const generic404 =
              !payload.error ||
              payload.error === 'Not found' ||
              payload.code === 'API_NOT_FOUND';
            if (generic404) {
              msg =
                '登录接口返回 404。请确认：① Vercel Root Directory 指向含 api/、server/、vercel.json 的目录并已重新部署；② 若 API 走外链 Node，需配置 API_PROXY_ORIGIN；若 API 已随本站 Serverless 部署，请检查构建是否包含 server 目录。可打开 /api/deploy-check 自检。';
            }
          }
          const code = typeof payload.code === 'string' ? payload.code : `HTTP_${res.status}`;
          return { error: makeAuthFlowError(msg, code, res.status) };
        }

        const session = payload.session;
        if (!session?.access_token || !session?.refresh_token) {
          return { error: makeAuthFlowError('登录成功但未返回会话，请重试', 'NO_SESSION') };
        }

        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          if (await resolveIfSessionReady()) {
            return { error: null };
          }
          return { error: makeAuthFlowError('登录请求超时，请检查网络后重试', 'LOGIN_TIMEOUT') };
        }

        const setSessionPromise = supabase.auth
          .setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
          .then((result) => result)
          .catch((e: unknown) => ({
            data: { session: null, user: null },
            error: e instanceof Error ? e : new Error(String(e)),
          }));

        const raced = await Promise.race([
          setSessionPromise.then((result) => ({ kind: 'session' as const, result })),
          new Promise<{ kind: 'deadline' }>((resolve) => {
            setTimeout(() => resolve({ kind: 'deadline' }), remainingMs);
          }),
          signOutDuringLoginPromise.then(() => ({ kind: 'signout' as const })),
        ]);

        if (raced.kind === 'signout') {
          return { error: abortedDuringLogin() };
        }

        if (raced.kind === 'deadline') {
          if (await resolveIfSessionReady()) {
            return { error: null };
          }
          return { error: makeAuthFlowError('登录请求超时，请检查网络后重试', 'LOGIN_TIMEOUT') };
        }

        const { data: sessionData, error: setErr } = raced.result;

        if (setErr) {
          return { error: makeAuthFlowError(setErr.message || '设置登录状态失败', 'SET_SESSION_FAILED') };
        }

        if (sessionData.session && sessionData.user) {
          setUser(sessionData.user);
          setSession(sessionData.session);
          setHasActiveSession(true);
          localStorage.removeItem('_user_signout_flag');
        }

        return { error: null };
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return { error: makeAuthFlowError('登录请求超时，请检查网络后重试', 'LOGIN_TIMEOUT') };
        }
        console.error('❌ [AuthContext] Unexpected error in signInWithPhone:', error);
        if (error instanceof Error) {
          return { error: error as AuthFlowError };
        }
        return { error: makeAuthFlowError('登录失败', 'AUTH_UNKNOWN') };
      } finally {
        signOutGuardSub?.unsubscribe();
      }
    })();

    signInWithPhoneInFlightRef.current = loginAttempt;
    try {
      return await loginAttempt;
    } finally {
      if (signInWithPhoneInFlightRef.current === loginAttempt) {
        signInWithPhoneInFlightRef.current = null;
      }
    }
  };

  const signInWithWeChat = async () => {
    try {
      console.log('💎 [AuthContext] WeChat login not yet implemented');
      return { error: makeAuthFlowError('WeChat login is not yet implemented', 'WECHAT_NOT_IMPLEMENTED') };
    } catch (error) {
      return { error: error as AuthFlowError };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 [AuthContext] Starting sign out process...');

      // 保存当前用户ID（在清除状态之前，用于清除 SyncService 数据）
      const currentUserId = user?.id || null;

      // 🔧 关键修复：设置退出登录标记，防止刷新后自动登录
      localStorage.setItem('_user_signout_flag', 'true');
      console.log('  ✓ Set signout flag to prevent auto-login on refresh');

      // 先清除本地状态（立即执行，不等待）
      setUser(null);
      setSession(null);
      setHasActiveSession(false);

      // 🔧 关键修复：先清除 Supabase session，确保完全登出
      console.log('�� [AuthContext] Signing out from Supabase...');
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('❌ [AuthContext] Supabase sign out error:', signOutError);
      } else {
        console.log('✅ [AuthContext] Supabase sign out successful');
      }

      // �� 关键修复：手动清除 Supabase 的 session 存储
      // Supabase 使用 sb-{project-ref}-auth-token 格式的键存储 session
      const supabaseKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          supabaseKeys.push(key);
        }
      }
      supabaseKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`  ✓ Removed Supabase key: ${key}`);
      });

      // 清除所有用户相关的 localStorage（使用统一的清理函数）
      console.log('🧹 [AuthContext] Clearing all user storage...');
      const { clearAllUserStorage, cleanupDashboardCache, clearTestData } = await import('../utils/userStorage');
      clearAllUserStorage();
      
      // 清理dashboard缓存和测试数据
      cleanupDashboardCache(7).catch(err => console.error('Failed to cleanup dashboard cache:', err));
      clearTestData();

      // 清除 SyncService 的离线队列和同步时间戳
      if (currentUserId) {
        try {
          const syncTimesKey = `sync_last_sync_times:user:${currentUserId}`;
          localStorage.removeItem(syncTimesKey);
          // 离线队列功能已移除，不再需要清理
          console.log('  ✓ Cleared SyncService data');
        } catch (error) {
          console.error('Failed to clear SyncService data:', error);
        }
      }

      // 清除缓存（直接清除 localStorage）
      try {
        // 清除所有缓存相关的键
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('cache:') || key.startsWith('records:') || key.includes('chat_messages'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('  ✓ Cleared cache');
      } catch (error) {
        console.error('  ✗ Failed to clear cache:', error);
      }

      // 清除用户ID缓存
      const { clearUserIdCache } = await import('../utils/userStorage');
      clearUserIdCache();
      console.log('  ✓ Cleared user ID cache');

      // UserProfileContext 会通过 supabase.auth.onAuthStateChange 自动响应
      console.log('  ✓ User signed out, contexts will auto-update via onAuthStateChange');

      // �� 关键修复：验证 session 已被清除
      const { data: { session: verifySession } } = await supabase.auth.getSession();
      if (verifySession) {
        console.error('⚠️ [AuthContext] WARNING: Session still exists after sign out!');
        // 强制清除
        await supabase.auth.signOut();
      } else {
        console.log('✅ [AuthContext] Verified: Session cleared successfully');
      }

      // 确保退出标记存在（防止刷新后自动登录）
      localStorage.setItem('_user_signout_flag', 'true');
      
      console.log('✅ [AuthContext] Signed out successfully');
    } catch (error) {
      console.error('❌ [AuthContext] Error signing out:', error);
      // 即使出错，也清除本地状态
      setUser(null);
      setSession(null);
      setHasActiveSession(false);
      
      // 尝试强制清除所有数据
      try {
        const { clearAllUserStorage, clearUserIdCache } = await import('../utils/userStorage');
        clearAllUserStorage();
        clearUserIdCache();
        
        // 强制清除 Supabase session
        const { clearSupabaseSession } = await import('../utils/userStorage');
        clearSupabaseSession();
      } catch (e) {
        console.error('Failed to clear storage:', e);
      }
      
      // 尝试强制登出
      try {
        await supabase.auth.signOut();
        console.log('✅ [AuthContext] Force sign out successful');
      } catch (e) {
        console.error('Failed to force sign out:', e);
      }
      
      // UserProfileContext 会通过 supabase.auth.onAuthStateChange 自动响应
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signInWithPhone,
    signInWithWeChat,
    signOut,
    isAuthenticated: !!user,
    hasActiveSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
