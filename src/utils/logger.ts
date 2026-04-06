type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const getGlobalLogLevel = (): LogLevel => {
  const raw = String(import.meta.env.VITE_LOG_LEVEL || '').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return import.meta.env.DEV ? 'info' : 'warn';
};

const shouldLog = (level: LogLevel): boolean => LEVEL_RANK[level] >= LEVEL_RANK[getGlobalLogLevel()];

export const createScopedLogger = (scope: string, debugStorageKey?: string) => {
  const isDebugEnabled = () =>
    import.meta.env.DEV
    && !!debugStorageKey
    && typeof window !== 'undefined'
    && window.localStorage?.getItem(debugStorageKey) === '1';

  return {
    debug: (...args: unknown[]) => {
      if (isDebugEnabled() || shouldLog('debug')) {
        console.log(`[${scope}]`, ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) {
        console.info(`[${scope}]`, ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(`[${scope}]`, ...args);
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(`[${scope}]`, ...args);
      }
    },
  };
};

