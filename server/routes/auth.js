const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const {
  setOtpRecord,
  getOtpRecord,
  deleteOtpRecord,
  setOtpIpQuotaRecord,
  getOtpIpQuotaRecord,
} = require('../services/otpStore');

const router = express.Router();

/** 全局固定验证码（登录与「发送验证码」均使用，不调用短信） */
const GLOBAL_FIXED_OTP = '111111';

function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return 'invalid';
  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

function normalizePhone(phone) {
  const s = String(phone || '').replace(/\D/g, '');
  if (s.length === 11 && s.startsWith('1')) return s;
  return null;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_SEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_IP_WINDOW_MS = 10 * 60 * 1000;
const OTP_IP_MAX_SEND = 30;
const OTP_IP_MAX_VERIFY = 120;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getRequestId(req) {
  const incoming = req.headers['x-request-id'];
  if (typeof incoming === 'string' && incoming.trim()) return incoming.trim();
  return `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function consumeIpQuota(ip, action) {
  const now = Date.now();
  const key = `${ip}:${action}`;
  const max = action === 'send' ? OTP_IP_MAX_SEND : OTP_IP_MAX_VERIFY;
  const existing = await getOtpIpQuotaRecord(key);

  if (!existing || now > existing.windowEnd) {
    await setOtpIpQuotaRecord(key, { count: 1, windowEnd: now + OTP_IP_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }

  if (existing.count >= max) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((existing.windowEnd - now) / 1000)),
    };
  }

  existing.count += 1;
  await setOtpIpQuotaRecord(key, existing);
  return { ok: true, retryAfter: 0 };
}

/**
 * POST /api/auth/send-verification-code
 * 固定验证码 GLOBAL_FIXED_OTP，不调用短信网关。
 */
router.post('/send-verification-code', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const ipQuota = await consumeIpQuota(ip, 'send');
    if (!ipQuota.ok) {
      return res.status(429).json({
        success: false,
        error: `请求过于频繁，请 ${ipQuota.retryAfter} 秒后重试`,
        code: 'OTP_IP_RATE_LIMIT',
        retryAfter: ipQuota.retryAfter,
      });
    }

    const phone = normalizePhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '请输入有效手机号',
        code: 'INVALID_PHONE',
      });
    }

    const now = Date.now();
    const existing = await getOtpRecord(phone);
    if (existing?.lastSentAt && now - existing.lastSentAt < OTP_SEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_SEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `发送过于频繁，请 ${retryAfterSeconds} 秒后重试`,
        code: 'OTP_SEND_COOLDOWN',
        retryAfter: retryAfterSeconds,
      });
    }

    const code = GLOBAL_FIXED_OTP;
    const expiresAt = Date.now() + OTP_TTL_MS;
    await setOtpRecord(phone, {
      code,
      expiresAt,
      attemptsLeft: OTP_MAX_VERIFY_ATTEMPTS,
      lastSentAt: now,
    });

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle();

    if (profile?.user_id) {
      const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        password: code,
      });
      if (pwdErr) {
        console.error('[auth] admin.updateUser password failed:', pwdErr.message);
        await deleteOtpRecord(phone);
        return res.status(500).json({
          success: false,
          error: '发送验证码失败，请稍后重试',
          code: 'OTP_PREP_FAILED',
        });
      }
    }

    return res.json({
      success: true,
      message: '验证码已发送',
      expiresIn: Math.floor(OTP_TTL_MS / 1000),
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    return res.status(500).json({
      success: false,
      error: '发送验证码失败',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/auth/login-with-code
 * Body: { phone, verificationCode }
 * 校验 OTP 后走 Supabase 登录/注册，返回 session 供前端 setSession。
 */
router.post('/login-with-code', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const ipQuota = await consumeIpQuota(ip, 'verify');
    if (!ipQuota.ok) {
      return res.status(429).json({
        success: false,
        error: `请求过于频繁，请 ${ipQuota.retryAfter} 秒后重试`,
        code: 'OTP_IP_RATE_LIMIT',
        retryAfter: ipQuota.retryAfter,
      });
    }

    const phone = normalizePhone(req.body.phone);
    const verificationCode = String(req.body.verificationCode || '').trim();

    if (!phone || verificationCode.length !== 6) {
      return res.status(400).json({
        success: false,
        error: '手机号或验证码格式不正确',
        code: 'VALIDATION_ERROR',
      });
    }

    if (verificationCode !== GLOBAL_FIXED_OTP) {
      return res.status(401).json({
        success: false,
        error: '验证码错误',
        code: 'INVALID_VERIFICATION_CODE',
      });
    }

    await deleteOtpRecord(phone);

    const email = `${phone}@healthapp.local`;
    const password = GLOBAL_FIXED_OTP;

    const { data: prof } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle();
    if (prof?.user_id) {
      const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(prof.user_id, {
        password,
      });
      if (pwdErr) {
        logger.info(`[auth] fixed OTP login: admin.updateUser password failed: ${pwdErr.message}`);
      }
    }

    let { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error && error.message.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { phone, login_method: 'verification_code' },
        },
      });

      if (signUpError) {
        return res.status(400).json({
          success: false,
          error: signUpError.message || '注册失败',
          code: 'SIGN_UP_FAILED',
        });
      }

      if (signUpData.user) {
        const { error: profileErr } = await supabaseAdmin.from('user_profiles').upsert(
          {
            user_id: signUpData.user.id,
            phone,
            nickname: '用户',
            has_seen_onboarding: false,
            profile_created_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (profileErr) {
          console.error('[auth] user_profiles upsert:', profileErr.message);
        }
      }

      if (signUpData.session) {
        data = signUpData;
      } else if (signUpData.user) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError || !signInData.session) {
          return res.status(500).json({
            success: false,
            error: '注册成功但无法登录，请重试',
            code: 'NO_SESSION_AFTER_SIGNUP',
          });
        }
        data = signInData;
      } else {
        return res.status(500).json({
          success: false,
          error: '注册失败，未返回用户信息',
          code: 'NO_USER_AFTER_SIGNUP',
        });
      }
    } else if (error) {
      return res.status(401).json({
        success: false,
        error: error.message || '登录失败',
        code: 'AUTH_FAILED',
      });
    }

    if (!data?.session || !data.user) {
      return res.status(500).json({
        success: false,
        error: '登录失败，未获取会话',
        code: 'NO_SESSION',
      });
    }

    return res.json({
      success: true,
      message: '登录成功',
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
    });
  } catch (error) {
    console.error('Login with code error:', error);
    return res.status(500).json({
      success: false,
      error: '登录失败',
      code: 'INTERNAL_ERROR',
    });
  }
});

router.post('/reset-password-by-phone', async (req, res) => {
  const ip = getClientIp(req);
  const requestId = getRequestId(req);
  const phoneForAudit = maskPhone(req.body?.phone);
  const actor = req.headers['x-admin-user'] || 'unknown';

  const resetEnabled = process.env.ENABLE_PHONE_PASSWORD_RESET === 'true';
  if (!resetEnabled) {
    logger.warn('auth.reset_password_by_phone.disabled', {
      requestId,
      ip,
      actor,
      phone: phoneForAudit,
      reason: 'feature_disabled',
    });
    return res.status(403).json({ error: 'Password reset by phone is disabled', code: 'RESET_DISABLED' });
  }

  const adminToken = process.env.PHONE_PASSWORD_RESET_TOKEN || '';
  if (!adminToken) {
    logger.error('auth.reset_password_by_phone.misconfigured', {
      requestId,
      ip,
      actor,
      phone: phoneForAudit,
      reason: 'missing_reset_token',
    });
    return res.status(500).json({ error: 'Server misconfigured', code: 'RESET_TOKEN_MISSING' });
  }
  const providedToken = String(req.headers['x-admin-reset-token'] || '').trim();
  if (!providedToken || providedToken !== adminToken) {
    logger.warn('auth.reset_password_by_phone.unauthorized', {
      requestId,
      ip,
      actor,
      phone: phoneForAudit,
      reason: 'invalid_admin_token',
    });
    return res.status(401).json({ error: 'Unauthorized', code: 'RESET_UNAUTHORIZED' });
  }

  try {
    const { phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      logger.warn('auth.reset_password_by_phone.validation_failed', {
        requestId,
        ip,
        actor,
        phone: phoneForAudit,
        reason: 'missing_phone_or_password',
      });
      return res.status(400).json({ error: 'Phone and new password are required', code: 'VALIDATION_ERROR' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle();

    if (profileError || !profile) {
      logger.warn('auth.reset_password_by_phone.user_not_found', {
        requestId,
        ip,
        actor,
        phone: phoneForAudit,
        dbError: profileError?.message || null,
      });
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
      password: newPassword,
    });

    if (updateError) {
      logger.error('auth.reset_password_by_phone.update_failed', {
        requestId,
        ip,
        actor,
        phone: phoneForAudit,
        userId: profile.user_id,
        error: updateError.message,
      });
      return res.status(400).json({ error: updateError.message, code: 'RESET_FAILED' });
    }

    logger.info('auth.reset_password_by_phone.success', {
      requestId,
      ip,
      actor,
      phone: phoneForAudit,
      userId: profile.user_id,
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('auth.reset_password_by_phone.exception', {
      requestId,
      ip,
      actor,
      phone: phoneForAudit,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to reset password', code: 'INTERNAL_ERROR' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
