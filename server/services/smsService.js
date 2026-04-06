const axios = require('axios');
const { getRuntimePolicy } = require('../config/runtimeMode');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SMS_PROVIDER = String(process.env.SMS_PROVIDER || 'mock').toLowerCase();

function providerName() {
  if (SMS_PROVIDER === 'mock' || SMS_PROVIDER === 'webhook') return SMS_PROVIDER;
  return 'mock';
}

async function sendViaWebhook({ phone, code, expiresInSeconds }) {
  const url = process.env.SMS_WEBHOOK_URL || '';
  if (!url) {
    return {
      delivered: false,
      provider: 'webhook',
      error: 'SMS_WEBHOOK_URL is missing',
    };
  }

  const timeoutMs = Number(process.env.SMS_WEBHOOK_TIMEOUT_MS || 8000);
  const token = process.env.SMS_WEBHOOK_TOKEN || '';

  try {
    const resp = await axios.post(
      url,
      { phone, code, expiresInSeconds, scene: 'login_otp' },
      {
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );

    if (resp.status >= 200 && resp.status < 300) {
      return {
        delivered: true,
        provider: 'webhook',
        messageId: String(resp.data?.messageId || ''),
      };
    }
    return {
      delivered: false,
      provider: 'webhook',
      error: `Unexpected webhook status: ${resp.status}`,
    };
  } catch (e) {
    return {
      delivered: false,
      provider: 'webhook',
      error: e?.message || 'Webhook send failed',
    };
  }
}

async function sendVerificationCode({ phone, code, expiresInSeconds }) {
  const provider = providerName();

  if (provider === 'webhook') {
    return sendViaWebhook({ phone, code, expiresInSeconds });
  }

  const { allowSimulatedSms } = getRuntimePolicy();
  if (IS_PRODUCTION && !allowSimulatedSms) {
    return {
      delivered: false,
      provider: 'mock',
      error: 'SMS_PROVIDER is mock in production (set ALLOW_SIMULATED_SMS=true for staging)',
    };
  }

  console.log(
    `[smsService] MOCK SMS -> ${phone}, code=${code}, expiresIn=${expiresInSeconds}s`
  );
  return {
    delivered: true,
    provider: 'mock',
    messageId: `mock-${Date.now()}`,
  };
}

module.exports = {
  sendVerificationCode,
};
