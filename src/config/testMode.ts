/**
 * 历史遗留：曾支持 VITE_TEST_MODE 本地假会话。现开发与生产统一走真实 Supabase / 数据库。
 * `isTestMode()` 恒为 false，不再读取环境变量，避免误开假数据影响联调。
 */
export const TEST_MODE = false;

export const TEST_USER = {
  id: 'test-user-001',
  email: 'test@healthapp.dev',
  name: '测试用户'
};

export const isTestMode = (): boolean => false;
