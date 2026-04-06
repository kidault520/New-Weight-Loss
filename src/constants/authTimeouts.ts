/**
 * 手机号验证码登录：整段流程（含 Node 验码 fetch + setSession）共用上限。
 * Auth 与 LoginPage 只认这一处，避免双计时器先后触发导致误报超时或状态错乱。
 */
export const SIGN_IN_WITH_PHONE_TOTAL_MS = 45_000;

/**
 * 冷启动时用 getUser() 向 Auth 服务校验 JWT；若网络阻塞，不能与 UI 登录态脱节导致 authLoading 永久 true。
 * 超时后沿用 getSession() 已给出的 user（本地会话仍在）。
 */
export const AUTH_GET_USER_INIT_TIMEOUT_MS = 12_000;

/**
 * 引导检查里 supabase.auth.getSession() 若永久 pending，会占住 onboardingCheckLock 且 checkingOnboarding 不释放，导致全屏「加载中」死锁。
 */
export const AUTH_GET_SESSION_ONBOARDING_CHECK_MS = 10_000;

/**
 * 浏览器直连 Supabase PostgREST 的单次读超时（user_profiles / user_preferences 等）。
 * 弱网/VPN 下易超时；可在 .env 设置 VITE_SUPABASE_CLIENT_TIMEOUT_MS（毫秒，建议 30000–60000）。
 */
const envClientTimeout = Number(import.meta.env.VITE_SUPABASE_CLIENT_TIMEOUT_MS);
/** 弱网/VPN 下 40s 仍易与多路并发读叠加超时；可调 VITE_SUPABASE_CLIENT_TIMEOUT_MS */
const DEFAULT_SUPABASE_TABLE_MS = 50_000;
export const SUPABASE_TABLE_QUERY_TIMEOUT_MS =
  Number.isFinite(envClientTimeout) && envClientTimeout >= 5_000 && envClientTimeout <= 120_000
    ? envClientTimeout
    : DEFAULT_SUPABASE_TABLE_MS;
