const { createClient } = require('redis');

const memoryStore = new Map();

let redisClient = null;
let redisReady = false;
let redisConnectPromise = null;
let redisWarned = false;

const OTP_KEY_PREFIX = process.env.OTP_REDIS_PREFIX || 'otp:phone:';
const OTP_IP_RATE_KEY_PREFIX = process.env.OTP_IP_RATE_REDIS_PREFIX || 'otp:ipquota:';
const OTP_STORE_PROVIDER = String(process.env.OTP_STORE_PROVIDER || 'auto').toLowerCase();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getEffectiveProvider() {
  if (OTP_STORE_PROVIDER === 'memory' || OTP_STORE_PROVIDER === 'redis') {
    return OTP_STORE_PROVIDER;
  }
  // auto: 开发环境允许降级；生产环境按 redis 强制
  return IS_PRODUCTION ? 'redis' : 'auto';
}

function wantsRedis() {
  const provider = getEffectiveProvider();
  return provider === 'redis' || provider === 'auto';
}

function redisRequired() {
  return getEffectiveProvider() === 'redis';
}

function getRedisUrl() {
  return process.env.REDIS_URL || process.env.OTP_REDIS_URL || '';
}

function logRedisFallbackOnce(reason) {
  if (redisWarned) return;
  redisWarned = true;
  console.warn(`[otpStore] Redis unavailable, fallback to memory store: ${reason}`);
}

async function ensureRedisClient() {
  if (!wantsRedis()) return null;
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    if (redisRequired()) {
      throw new Error('OTP_STORE_PROVIDER=redis but REDIS_URL/OTP_REDIS_URL is missing');
    }
    logRedisFallbackOnce('missing REDIS_URL');
    return null;
  }

  if (redisReady && redisClient) return redisClient;
  if (redisConnectPromise) {
    await redisConnectPromise;
    return redisReady ? redisClient : null;
  }

  redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (e) => {
    redisReady = false;
    if (!redisRequired()) {
      logRedisFallbackOnce(e?.message || 'redis error');
      return;
    }
    console.error('[otpStore] Redis error:', e);
  });

  redisConnectPromise = redisClient
    .connect()
    .then(() => {
      redisReady = true;
    })
    .catch((e) => {
      redisReady = false;
      if (redisRequired()) {
        throw e;
      }
      logRedisFallbackOnce(e?.message || 'redis connect failed');
    })
    .finally(() => {
      redisConnectPromise = null;
    });

  await redisConnectPromise;
  return redisReady ? redisClient : null;
}

async function ensureOtpStoreReady() {
  if (IS_PRODUCTION && OTP_STORE_PROVIDER !== 'redis') {
    throw new Error(
      `Production requires OTP_STORE_PROVIDER=redis (current: ${OTP_STORE_PROVIDER || 'empty'})`
    );
  }

  if (!redisRequired()) return;

  const client = await ensureRedisClient();
  if (!client) {
    throw new Error('OTP Redis is required but unavailable');
  }
}

function otpRedisKey(phone) {
  return `${OTP_KEY_PREFIX}${phone}`;
}

function otpIpRateRedisKey(key) {
  return `${OTP_IP_RATE_KEY_PREFIX}${key}`;
}

function computeTtlSeconds(record) {
  const expiresAt = Number(record?.expiresAt || 0);
  const ttlMs = expiresAt - Date.now();
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

function computeWindowTtlSeconds(windowEnd) {
  const ttlMs = Number(windowEnd || 0) - Date.now();
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

async function setOtpRecord(phone, record) {
  const client = await ensureRedisClient();
  if (client) {
    const ttlSec = computeTtlSeconds(record);
    await client.set(otpRedisKey(phone), JSON.stringify(record), { EX: ttlSec });
    return;
  }
  memoryStore.set(phone, record);
}

async function getOtpRecord(phone) {
  const client = await ensureRedisClient();
  if (client) {
    const raw = await client.get(otpRedisKey(phone));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return memoryStore.get(phone) || null;
}

async function deleteOtpRecord(phone) {
  const client = await ensureRedisClient();
  if (client) {
    await client.del(otpRedisKey(phone));
    return;
  }
  memoryStore.delete(phone);
}

async function setOtpIpQuotaRecord(key, record) {
  const client = await ensureRedisClient();
  if (client) {
    const ttlSec = computeWindowTtlSeconds(record?.windowEnd);
    await client.set(otpIpRateRedisKey(key), JSON.stringify(record), { EX: ttlSec });
    return;
  }
  memoryStore.set(otpIpRateRedisKey(key), record);
}

async function getOtpIpQuotaRecord(key) {
  const client = await ensureRedisClient();
  if (client) {
    const raw = await client.get(otpIpRateRedisKey(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return memoryStore.get(otpIpRateRedisKey(key)) || null;
}

module.exports = {
  setOtpRecord,
  getOtpRecord,
  deleteOtpRecord,
  setOtpIpQuotaRecord,
  getOtpIpQuotaRecord,
  ensureOtpStoreReady,
};
