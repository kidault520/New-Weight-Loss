import { useEffect, useRef, startTransition, type MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import {
  AUTH_GET_SESSION_ONBOARDING_CHECK_MS,
  SUPABASE_TABLE_QUERY_TIMEOUT_MS,
} from '../constants/authTimeouts';
import { removeUserStorageItem, getCurrentUserId } from '../utils/userStorage';
import { hasPersistedOnboardingUnlock } from '../utils/onboardingUnlockSignals';
import type { UserProfile } from '../utils/bmrCalculations';

/** 引导检查入参：若在 onAuthStateChange 内传入 authSession，可避免与 supabase-js 内部 _setSession 重入时 await getSession() 长时间挂起 */
export type CheckOnboardingStatusOptions = {
  onStatusDetermined?: () => void;
  authSession?: Session | null;
};

export type OnboardingDiagFn = (stage: string, extra?: Record<string, unknown>) => void;

export interface UseAppAuthOnboardingBootstrapParams {
  onboardingDiagRef: MutableRefObject<OnboardingDiagFn | undefined>;
  profileRef: MutableRefObject<UserProfile | null>;
  showOnboardingRef: MutableRefObject<boolean>;
  onboardingJustCompletedRef: MutableRefObject<boolean>;
  isLoadingRef: MutableRefObject<boolean>;
  onboardingCheckLockRef: MutableRefObject<boolean>;
  onboardingStatusCacheRef: MutableRefObject<{
    hasSeenOnboarding: boolean | null;
    timestamp: number;
  } | null>;
  hasHandledInitialSessionRef: MutableRefObject<boolean>;
  hasHandledSignedInRef: MutableRefObject<boolean>;
  /** DB 超时且档案仍在拉取时置 true，SIGNED_IN 的 finally 勿清除 checkingOnboardingAfterLogin */
  preserveCheckingOnboardingAfterLoginRef: MutableRefObject<boolean>;
  setShowOnboarding: (show: boolean) => void;
  setCheckingOnboarding: (checking: boolean) => void;
  setCheckingOnboardingAfterLogin: (checking: boolean) => void;
}

/**
 * 冷启动与 Supabase 会话：引导状态检查、onAuthStateChange、sessionStorage 快路径。
 * 仅挂载一次；依赖 ref / 稳定 setter 读取最新状态，避免空依赖闭包陈旧。
 */
export function useAppAuthOnboardingBootstrap(p: UseAppAuthOnboardingBootstrapParams): void {
  const paramsRef = useRef(p);
  paramsRef.current = p;

  useEffect(() => {
    const od = (stage: string, extra: Record<string, unknown> = {}) =>
      paramsRef.current.onboardingDiagRef.current?.(stage, extra);

    const clearOnboardingState = async () => {
      console.log('🧹 [App] Clearing all onboarding state from localStorage');

      await Promise.all([
        removeUserStorageItem('onboarding_step'),
        removeUserStorageItem('onboarding_data'),
        removeUserStorageItem('onboarding_completed'),
        removeUserStorageItem('onboarding_skipped'),
        removeUserStorageItem('onboarding_main_unlocked'),
        removeUserStorageItem('health_report_saved'),
        removeUserStorageItem('step14_profile_saved'),
      ]);

      try {
        const currentUserId = await getCurrentUserId();
        if (currentUserId) {
          const keysToRemove: string[] = [];
          const userIdPart = `:user:${currentUserId}`;

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
              key &&
              ((key.includes('chat_messages') && key.includes(userIdPart)) ||
                (key.includes('chat_history') && key.includes(userIdPart)) ||
                (key.startsWith('cache:chat_messages') && key.includes(userIdPart)) ||
                (key.startsWith('records:chat_messages') && key.includes(userIdPart)))
            ) {
              keysToRemove.push(key);
            }
          }

          keysToRemove.forEach((key) => localStorage.removeItem(key));
          console.log(`✅ [App] Cleared ${keysToRemove.length} chat cache items for user ${currentUserId}`);
        } else {
          console.log('⚠️ [App] No current user ID, skipping chat cache cleanup');
        }
      } catch (error) {
        console.error('❌ [App] Error clearing chat cache:', error);
      }

      console.log('✅ [App] Onboarding and chat state cleared');
    };

    const checkOnboardingStatus = async (opts: CheckOnboardingStatusOptions = {}) => {
      const { onStatusDetermined, authSession: authSessionFromEvent } = opts;
      const useSessionFromAuthCallback = Object.prototype.hasOwnProperty.call(opts, 'authSession');
      const hintUserId =
        useSessionFromAuthCallback && authSessionFromEvent?.user?.id ? authSessionFromEvent.user.id : null;

      od('check:start', {
        lock: paramsRef.current.onboardingCheckLockRef.current,
        sessionFromAuthCallback: useSessionFromAuthCallback,
      });
      if (paramsRef.current.onboardingCheckLockRef.current) {
        od('check:skip-locked');
        // 必须通知 SIGNED_IN：否则 finally 里 !onboardingStatusDetermined 会误判为新用户并 setShowOnboarding(true)
        onStatusDetermined?.();
        return;
      }

      try {
        paramsRef.current.onboardingCheckLockRef.current = true;
        paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current = false;

        if (paramsRef.current.onboardingJustCompletedRef.current) {
          console.log('⏸️ [App] Onboarding just completed, skipping status check to prevent redirect');
          od('check:skip-onboarding-just-completed');
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          paramsRef.current.onboardingCheckLockRef.current = false;
          onStatusDetermined?.();
          return;
        }

        if (paramsRef.current.showOnboardingRef.current) {
          const pr = paramsRef.current.profileRef.current;
          const profileDone = pr?.has_seen_onboarding === true;
          const cacheDone = paramsRef.current.onboardingStatusCacheRef.current?.hasSeenOnboarding === true;
          let storageDone = false;
          if (hintUserId) {
            try {
              storageDone = sessionStorage.getItem(`healthapp:onb_done:${hintUserId}`) === '1';
            } catch {
              /* ignore */
            }
          }
          const unlock = hintUserId ? hasPersistedOnboardingUnlock(hintUserId) : false;
          if (!(profileDone || cacheDone || storageDone || unlock)) {
            console.log('⏸️ [App] Onboarding is currently showing, skipping status check to prevent redirect');
            od('check:skip-onboarding-visible');
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
            paramsRef.current.onboardingCheckLockRef.current = false;
            onStatusDetermined?.();
            return;
          }
          od('check:bypass-visible-onboarding', { profileDone, cacheDone, storageDone, unlock });
        }

        if (paramsRef.current.onboardingStatusCacheRef.current) {
          const cacheAge = Date.now() - paramsRef.current.onboardingStatusCacheRef.current.timestamp;
          if (cacheAge < 10000 && paramsRef.current.onboardingStatusCacheRef.current.hasSeenOnboarding === true) {
            console.log('✅ [App] Using cached onboarding status - user has completed onboarding');
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
            paramsRef.current.onboardingCheckLockRef.current = false;
            onStatusDetermined?.();
            return;
          }
        }

        /**
         * 默认用 getSession() 读本地会话（getUser() 会打 Auth 网络）。
         * 禁止在 onAuthStateChange → _setSession 的同步调用栈里 await getSession()：会与客户端内部锁重入，表现为长时间挂起直至限时器触发。
         * 此时必须传入 opts.authSession（与事件参数 session 相同）。
         */
        let authSession: Session | null = null;
        if (useSessionFromAuthCallback) {
          authSession = authSessionFromEvent ?? null;
          od('check:session-from-callback', { hasUser: !!authSession?.user });
        } else {
          try {
            const sessionResult = await Promise.race([
              supabase.auth.getSession(),
              new Promise<never>((_, reject) => {
                setTimeout(
                  () => reject(new Error('AUTH_GET_SESSION_TIMEOUT')),
                  AUTH_GET_SESSION_ONBOARDING_CHECK_MS,
                );
              }),
            ]);
            authSession = sessionResult.data.session;
          } catch (e) {
            if (e instanceof Error && e.message === 'AUTH_GET_SESSION_TIMEOUT') {
              console.warn(
                '⚠️ [App] getSession 超时（引导检查）— 释放检查锁与首屏门闸，避免永久加载；档案到达后由 effect 纠偏',
              );
              od('check:getsession-timeout');
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              paramsRef.current.onboardingCheckLockRef.current = false;
              onStatusDetermined?.();
              return;
            }
            throw e;
          }
        }
        const currentProfile = paramsRef.current.profileRef.current;
        const user = authSession?.user ?? null;

        if (!user) {
          await clearOnboardingState();
          paramsRef.current.setShowOnboarding(false);
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          onStatusDetermined?.();
          return;
        }

        if (currentProfile?.has_seen_onboarding === true) {
          paramsRef.current.onboardingStatusCacheRef.current = {
            hasSeenOnboarding: true,
            timestamp: Date.now(),
          };
          try {
            sessionStorage.setItem(`healthapp:onb_done:${user.id}`, '1');
          } catch {
            /* ignore */
          }
          paramsRef.current.setShowOnboarding(false);
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          paramsRef.current.onboardingCheckLockRef.current = false;
          od('decision:profile-context-completed');
          onStatusDetermined?.();
          return;
        }

        if (currentProfile?.has_seen_onboarding === false) {
          paramsRef.current.onboardingStatusCacheRef.current = {
            hasSeenOnboarding: false,
            timestamp: Date.now(),
          };
          paramsRef.current.setShowOnboarding(true);
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          paramsRef.current.onboardingCheckLockRef.current = false;
          od('decision:profile-context-needs-onboarding');
          onStatusDetermined?.();
          return;
        }

        if (paramsRef.current.isLoadingRef.current && paramsRef.current.onboardingStatusCacheRef.current?.hasSeenOnboarding === true) {
          const cacheAge = Date.now() - paramsRef.current.onboardingStatusCacheRef.current.timestamp;
          if (cacheAge < 300000) {
            console.log('✅ [App] Using cached onboarding status (profile still loading): hasSeenOnboarding = true');
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
            paramsRef.current.onboardingCheckLockRef.current = false;
            onStatusDetermined?.();
            return;
          }
        }

        // 与 useUserProfileQuery 并发再打同表会放大弱网超时与重复日志；加载中交给 React Query，由 App 档案 effect 收口引导态
        if (paramsRef.current.isLoadingRef.current) {
          if (import.meta.env.DEV) {
            console.log(
              '⏳ [App] UserProfile 仍在拉取，跳过重复的 user_profiles 查询（避免与 useUserProfileQuery 抢连接）',
            );
          }
          od('check:skip-dup-profile-while-loading');
          paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current = true;
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.onboardingCheckLockRef.current = false;
          onStatusDetermined?.();
          return;
        }

        if (!paramsRef.current.isLoadingRef.current && paramsRef.current.profileRef.current === null) {
          if (import.meta.env.DEV) {
            console.log('⚠️ [App] UserProfileContext 已无 loading 但无档案行，向数据库确认 has_seen_onboarding');
          }
        }

        let profileData: { has_seen_onboarding: boolean } | null = null;
        let profileError: Error | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        let queryResolved = false;

        try {
          const profileQueryPromise = Promise.resolve(
            supabase
              .from('user_profiles')
              .select('has_seen_onboarding')
              .eq('user_id', user.id)
              .maybeSingle(),
          );

          profileQueryPromise
            .then(() => {
              queryResolved = true;
            })
            .catch(() => {
              queryResolved = true;
            });

          const profileQueryTimeoutMs = Math.min(
            Math.max(SUPABASE_TABLE_QUERY_TIMEOUT_MS, 8_000),
            45_000,
          );
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              if (!queryResolved) {
                reject(new Error(`Profile query timeout after ${profileQueryTimeoutMs}ms`));
              }
            }, profileQueryTimeoutMs);
          });

          const result = await Promise.race([
            profileQueryPromise
              .then((r) => {
                queryResolved = true;
                if (timeoutId) {
                  clearTimeout(timeoutId);
                  timeoutId = null;
                }
                return r;
              })
              .catch((err) => {
                queryResolved = true;
                if (timeoutId) {
                  clearTimeout(timeoutId);
                  timeoutId = null;
                }
                throw err;
              }),
            timeoutPromise,
          ]);

          profileData = result.data;
          profileError = result.error;
        } catch (error) {
          queryResolved = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (error instanceof Error && error.message.includes('timeout')) {
            if (import.meta.env.DEV) {
              console.warn('⚠️ [App] Profile query timeout - checking UserProfileContext');
            }
            od('db:timeout');
            profileError = error;
          } else {
            console.error('❌ [App] Error querying profile:', error);
            profileError = error instanceof Error ? error : new Error('Unknown error');
          }
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }

        if (profileError) {
          if (paramsRef.current.onboardingStatusCacheRef.current?.hasSeenOnboarding === true) {
            const cacheAge = Date.now() - paramsRef.current.onboardingStatusCacheRef.current.timestamp;
            if (cacheAge < 300000) {
              if (import.meta.env.DEV) {
                console.log('✅ [App] Profile query failed/timeout, but cache shows user has completed onboarding - using cache');
              }
              paramsRef.current.setShowOnboarding(false);
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              paramsRef.current.onboardingCheckLockRef.current = false;
              onStatusDetermined?.();
              return;
            }
          }

          if (currentProfile?.has_seen_onboarding === true) {
            if (import.meta.env.DEV) {
              console.log('✅ [App] Profile query failed/timeout, but UserProfileContext shows user has completed onboarding - using cached data');
            }
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
            paramsRef.current.onboardingCheckLockRef.current = false;
            paramsRef.current.onboardingStatusCacheRef.current = {
              hasSeenOnboarding: true,
              timestamp: Date.now(),
            };
            onStatusDetermined?.();
            return;
          }

          const profileStillIndeterminate = paramsRef.current.isLoadingRef.current;

          if (profileStillIndeterminate) {
            const latest = paramsRef.current.profileRef.current;
            if (latest?.has_seen_onboarding === true) {
              console.log('✅ [App] DB 超时/失败但 profileRef 显示已完成引导');
              paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
              paramsRef.current.setShowOnboarding(false);
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              paramsRef.current.onboardingCheckLockRef.current = false;
              onStatusDetermined?.();
              return;
            }
            if (latest?.has_seen_onboarding === false) {
              console.log('📋 [App] DB 超时/失败但 profileRef 显示需引导');
              paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: false, timestamp: Date.now() };
              paramsRef.current.setShowOnboarding(true);
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              paramsRef.current.onboardingCheckLockRef.current = false;
              onStatusDetermined?.();
              return;
            }
            if (hasPersistedOnboardingUnlock(user.id)) {
              console.log('✅ [App] DB 超时/失败但本地解锁标志显示已完成引导');
              paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
              paramsRef.current.setShowOnboarding(false);
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              paramsRef.current.onboardingCheckLockRef.current = false;
              onStatusDetermined?.();
              return;
            }
            console.warn(
              '⚠️ [App] DB 超时/失败且 UserProfileContext 仍在加载 — 暂不打开引导；保持门闸至档案落地（避免老用户闪引导页）',
            );
            od('db:defer-context-loading');
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.onboardingCheckLockRef.current = false;
            if (onStatusDetermined) {
              paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current = true;
              paramsRef.current.setCheckingOnboarding(false);
            } else {
              paramsRef.current.setCheckingOnboarding(true);
            }
            onStatusDetermined?.();
            return;
          }

          if (currentProfile === null) {
            if (hasPersistedOnboardingUnlock(user.id)) {
              console.log('✅ [App] Profile 查询失败/超时且无 Context 档案，但本地解锁标志存在 — 不进引导');
              paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
              startTransition(() => {
                paramsRef.current.setShowOnboarding(false);
                paramsRef.current.setCheckingOnboarding(false);
                paramsRef.current.setCheckingOnboardingAfterLogin(false);
                paramsRef.current.onboardingCheckLockRef.current = false;
              });
              onStatusDetermined?.();
              return;
            }
            console.warn(
              '⚠️ [App] Profile 直连失败/超时且无 Context 档案 — 不在此处打开引导，交由 App 档案 effect（避免与 399 竞态、误判老用户）',
            );
            od('db:defer-null-profile-after-error');
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.onboardingCheckLockRef.current = false;
            if (onStatusDetermined) {
              paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current = true;
              paramsRef.current.setCheckingOnboarding(false);
            } else {
              paramsRef.current.setCheckingOnboarding(true);
            }
            onStatusDetermined?.();
            return;
          }

          if (currentProfile.has_seen_onboarding === false) {
            console.log('📋 [App] Profile query failed/timeout but profile shows user needs onboarding');
            startTransition(() => {
              paramsRef.current.setShowOnboarding(true);
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              paramsRef.current.onboardingCheckLockRef.current = false;
            });
            onStatusDetermined?.();
            return;
          }

          if (hasPersistedOnboardingUnlock(user.id)) {
            console.log('✅ [App] Profile 查询失败/超时且无法判定，但本地解锁标志存在 — 不进引导');
            paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
            paramsRef.current.onboardingCheckLockRef.current = false;
            onStatusDetermined?.();
            return;
          }
          console.log('⚠️ [App] Profile query失败/超时且无法判定 — 默认展示引导，避免新用户进首页');
          paramsRef.current.setShowOnboarding(true);
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          paramsRef.current.onboardingCheckLockRef.current = false;
          onStatusDetermined?.();
          return;
        }

        console.log('📊 [App] Profile data from DB:', profileData);

        if (profileData?.has_seen_onboarding !== undefined) {
          paramsRef.current.onboardingStatusCacheRef.current = {
            hasSeenOnboarding: profileData.has_seen_onboarding,
            timestamp: Date.now(),
          };
        }

        await Promise.all([
          removeUserStorageItem('onboarding_completed'),
          removeUserStorageItem('onboarding_skipped'),
        ]);

        if (profileData?.has_seen_onboarding) {
          console.log('🧹 [App] User has completed onboarding - clearing stale onboarding_step');
          await Promise.all([
            removeUserStorageItem('onboarding_step'),
            removeUserStorageItem('onboarding_data'),
            removeUserStorageItem('health_report_saved'),
          ]);
        }

        const needsOnboarding = !profileData || !profileData.has_seen_onboarding;
        console.log('🔍 [App] Final onboarding decision:', {
          hasProfileData: !!profileData,
          has_seen_onboarding: profileData?.has_seen_onboarding,
          needsOnboarding,
        });
        od('decision:final', {
          hasProfileData: !!profileData,
          hasSeenOnboarding: profileData?.has_seen_onboarding ?? null,
          needsOnboarding,
        });

        if (needsOnboarding) {
          console.log('🎯 [App] User needs onboarding (has_seen_onboarding: false or no profile)');
        } else {
          console.log('✅ [App] User has completed onboarding - showing app');
          paramsRef.current.onboardingStatusCacheRef.current = {
            hasSeenOnboarding: true,
            timestamp: Date.now(),
          };
        }
        startTransition(() => {
          paramsRef.current.setShowOnboarding(needsOnboarding);
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          paramsRef.current.onboardingCheckLockRef.current = false;
        });
        if (!needsOnboarding) {
          try {
            sessionStorage.setItem(`healthapp:onb_done:${user.id}`, '1');
          } catch {
            /* ignore */
          }
        }
        onStatusDetermined?.();
      } catch (error) {
        console.error('❌ [App] Error checking onboarding status:', error);
        paramsRef.current.setCheckingOnboardingAfterLogin(false);
      } finally {
        paramsRef.current.setCheckingOnboarding(false);
        paramsRef.current.onboardingCheckLockRef.current = false;
      }
    };

    let initialSessionDelayId: ReturnType<typeof setTimeout> | null = null;

    const tryInitialSessionFastPath = (userId?: string): boolean => {
      if (userId) {
        try {
          if (sessionStorage.getItem(`healthapp:onb_done:${userId}`) === '1') {
            paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
            console.log('✅ [App] Initial session - sessionStorage indicates onboarding completed');
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
            od('auth:initial-session-storage-cache');
            return true;
          }
        } catch {
          /* 隐私模式等 */
        }
        if (hasPersistedOnboardingUnlock(userId)) {
          paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
          console.log('✅ [App] Initial session - local unlock flag indicates onboarding completed');
          paramsRef.current.setShowOnboarding(false);
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          od('auth:initial-session-local-unlock');
          return true;
        }
      }
      if (paramsRef.current.onboardingStatusCacheRef.current?.hasSeenOnboarding === true) {
        const cacheAge = Date.now() - paramsRef.current.onboardingStatusCacheRef.current.timestamp;
        if (cacheAge < 60000) {
          console.log('✅ [App] Initial session - Using cached onboarding status (user has completed)');
          paramsRef.current.setShowOnboarding(false);
          paramsRef.current.setCheckingOnboarding(false);
          paramsRef.current.setCheckingOnboardingAfterLogin(false);
          od('auth:initial-session-use-cache-completed');
          return true;
        }
      }
      const pNow = paramsRef.current.profileRef.current;
      if (pNow?.has_seen_onboarding === true) {
        console.log('✅ [App] Initial session - profile already indicates completed onboarding');
        paramsRef.current.setShowOnboarding(false);
        paramsRef.current.setCheckingOnboarding(false);
        paramsRef.current.setCheckingOnboardingAfterLogin(false);
        paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
        od('auth:initial-session-profile-sync');
        return true;
      }
      return false;
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (initialSessionDelayId !== null) {
          clearTimeout(initialSessionDelayId);
          initialSessionDelayId = null;
        }
        if (import.meta.env.DEV) {
          console.log('👋 [App] User signed out - clearing state');
        }
        try {
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i);
            if (k?.startsWith('healthapp:onb_done:')) sessionStorage.removeItem(k);
          }
        } catch {
          /* ignore */
        }
        paramsRef.current.onboardingCheckLockRef.current = false;
        paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current = false;
        paramsRef.current.hasHandledInitialSessionRef.current = false;
        paramsRef.current.hasHandledSignedInRef.current = false;
        clearOnboardingState().catch((error) => {
          console.error('❌ [App] Error clearing onboarding state on sign out:', error);
        });
        paramsRef.current.setShowOnboarding(false);
        paramsRef.current.setCheckingOnboarding(false);
        paramsRef.current.setCheckingOnboardingAfterLogin(false);
        od('auth:signed-out');
      } else if (event === 'INITIAL_SESSION') {
        if (paramsRef.current.hasHandledInitialSessionRef.current) {
          // 二次 INITIAL_SESSION（热更新/重复订阅）时若仍有未清标志，避免首屏门闸永久假
          if (session?.user) {
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
          }
          return;
        }
        paramsRef.current.hasHandledInitialSessionRef.current = true;

        if (!session?.user) {
          paramsRef.current.setCheckingOnboarding(true);
          void checkOnboardingStatus();
          return;
        }

        console.log('🔔 [App] Initial session — resolving onboarding (single path)');
        paramsRef.current.setCheckingOnboarding(true);

        if (tryInitialSessionFastPath(session.user.id)) {
          return;
        }

        initialSessionDelayId = setTimeout(async () => {
          initialSessionDelayId = null;
          if (paramsRef.current.onboardingStatusCacheRef.current?.hasSeenOnboarding === true) {
            const cacheAge = Date.now() - paramsRef.current.onboardingStatusCacheRef.current.timestamp;
            if (cacheAge < 60000) {
              paramsRef.current.setShowOnboarding(false);
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              od('auth:initial-session-use-cache-completed-delayed');
              return;
            }
          }
          const pDelayed = paramsRef.current.profileRef.current;
          if (pDelayed?.has_seen_onboarding === true) {
            console.log('✅ [App] Initial session - profile loaded, completed onboarding');
            paramsRef.current.setShowOnboarding(false);
            paramsRef.current.setCheckingOnboarding(false);
            paramsRef.current.setCheckingOnboardingAfterLogin(false);
            paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
            od('auth:initial-session-profile-completed');
            return;
          }
          if (paramsRef.current.onboardingStatusCacheRef.current?.hasSeenOnboarding !== true) {
            console.log('🔄 [App] Initial session - single onboarding check (DB)');
            await checkOnboardingStatus({ authSession: session });
          }
        }, 300);
      } else if (event === 'SIGNED_IN') {
        if (!paramsRef.current.hasHandledSignedInRef.current) {
          paramsRef.current.hasHandledSignedInRef.current = true;

          const signedInUserId = session?.user?.id ?? null;

          paramsRef.current.setCheckingOnboardingAfterLogin(true);

          let onboardingStatusDetermined = false;

          const signedInTimeoutId = setTimeout(() => {
            if (onboardingStatusDetermined) return;
            if (
              paramsRef.current.isLoadingRef.current ||
              paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current
            ) {
              od('auth:signed-in-5s-skip-still-waiting-profile');
              return;
            }
            const pr = paramsRef.current.profileRef.current;
            startTransition(() => {
              paramsRef.current.setCheckingOnboardingAfterLogin(false);
              paramsRef.current.setCheckingOnboarding(false);
              paramsRef.current.onboardingCheckLockRef.current = false;
              if (pr?.has_seen_onboarding === true) {
                paramsRef.current.setShowOnboarding(false);
                paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
              } else if (signedInUserId && hasPersistedOnboardingUnlock(signedInUserId)) {
                paramsRef.current.setShowOnboarding(false);
                paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
              } else {
                paramsRef.current.setShowOnboarding(true);
              }
            });
            od('auth:signed-in-timeout-fallback', { profileRefHasSeen: pr?.has_seen_onboarding ?? null });
          }, 5000);

          try {
            await new Promise((resolve) => setTimeout(resolve, 50));
            await checkOnboardingStatus({
              onStatusDetermined: () => {
                onboardingStatusDetermined = true;
              },
              authSession: session ?? null,
            });
          } catch (error) {
            console.error('❌ [App] Error during onboarding check after login:', error);
          } finally {
            clearTimeout(signedInTimeoutId);

            if (!onboardingStatusDetermined) {
              const pr = paramsRef.current.profileRef.current;
              if (
                paramsRef.current.isLoadingRef.current ||
                paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current
              ) {
                paramsRef.current.setShowOnboarding(false);
                paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current = true;
                paramsRef.current.setCheckingOnboarding(false);
                paramsRef.current.onboardingCheckLockRef.current = false;
                od('auth:signed-in-race-fallback-indeterminate', { profileRefHasSeen: pr?.has_seen_onboarding ?? null });
              } else if (pr?.has_seen_onboarding === true) {
                paramsRef.current.setShowOnboarding(false);
                paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
                paramsRef.current.setCheckingOnboardingAfterLogin(false);
                paramsRef.current.setCheckingOnboarding(false);
                paramsRef.current.onboardingCheckLockRef.current = false;
                od('auth:signed-in-race-fallback', { profileRefHasSeen: pr?.has_seen_onboarding ?? null });
              } else if (signedInUserId && hasPersistedOnboardingUnlock(signedInUserId)) {
                paramsRef.current.setShowOnboarding(false);
                paramsRef.current.onboardingStatusCacheRef.current = { hasSeenOnboarding: true, timestamp: Date.now() };
                paramsRef.current.setCheckingOnboardingAfterLogin(false);
                paramsRef.current.setCheckingOnboarding(false);
                paramsRef.current.onboardingCheckLockRef.current = false;
                od('auth:signed-in-race-fallback', { profileRefHasSeen: pr?.has_seen_onboarding ?? null });
              } else {
                paramsRef.current.setShowOnboarding(true);
                paramsRef.current.setCheckingOnboardingAfterLogin(false);
                paramsRef.current.setCheckingOnboarding(false);
                paramsRef.current.onboardingCheckLockRef.current = false;
                od('auth:signed-in-race-fallback', { profileRefHasSeen: pr?.has_seen_onboarding ?? null });
              }
            } else {
              const preserve = paramsRef.current.preserveCheckingOnboardingAfterLoginRef.current;
              paramsRef.current.setCheckingOnboarding(false);
              if (!preserve) {
                paramsRef.current.setCheckingOnboardingAfterLogin(false);
              }
              // preserve 为 true 时保留 ref，供 App 在档案落地后清零，避免 3s 兜底误关登录门闸
            }
          }
        }
      }
    });

    return () => {
      if (initialSessionDelayId !== null) {
        clearTimeout(initialSessionDelayId);
      }
      subscription.unsubscribe();
    };
    // 仅挂载一次；最新 params 经 paramsRef.current 读取
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap 与 Supabase 单例订阅
  }, []);
}
