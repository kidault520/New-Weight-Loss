/**
 * 弱网 / Supabase 超时导致 profile 为 null 时，仍可根据本地信号判断「曾进入主应用」，
 * 避免老用户被反复打进引导页。
 */
import { getUserStorageKeySync } from './userStorage';

const LOCAL_KEY = 'onboarding_main_unlocked';

export function readSessionOnboardingDone(userId: string): boolean {
  try {
    return sessionStorage.getItem(`healthapp:onb_done:${userId}`) === '1';
  } catch {
    return false;
  }
}

export function readLocalOnboardingMainUnlocked(userId: string): boolean {
  try {
    const key = getUserStorageKeySync(LOCAL_KEY, userId);
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

/** 同步：任一路径为真即视为已解锁主应用（档案可稍后补齐） */
export function hasPersistedOnboardingUnlock(userId: string): boolean {
  return readSessionOnboardingDone(userId) || readLocalOnboardingMainUnlocked(userId);
}

export function persistOnboardingUnlockToSession(userId: string): void {
  try {
    sessionStorage.setItem(`healthapp:onb_done:${userId}`, '1');
  } catch {
    /* 隐私模式等 */
  }
}
