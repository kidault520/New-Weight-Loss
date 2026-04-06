/**
 * 销售员登录认证
 * 手机号 + 密码登录，首次登录后激活账号
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../utils/logger');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'sales-jwt-secret-change-in-production';

/**
 * 销售员登录
 * POST /api/sales/auth/login
 * Body: { phone, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }

    const normalizedPhone = String(phone).replace(/\s/g, '').trim();
    if (normalizedPhone.length < 11) {
      return res.status(400).json({ error: '请输入有效的手机号' });
    }

    const { data: person, error } = await supabaseAdmin
      .from('sales_persons')
      .select('id, code, display_id, name, level, phone, password_hash, is_activated')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (error) {
      logger.error('Sales login query error:', error);
      return res.status(500).json({ error: '登录失败，请稍后重试' });
    }

    if (!person) {
      return res.status(401).json({ error: '手机号或密码错误' });
    }

    if (!person.password_hash) {
      return res.status(401).json({ 
        error: '账号尚未设置密码',
        hint: '请联系管理员为您设置初始密码'
      });
    }

    const valid = await bcrypt.compare(password, person.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '手机号或密码错误' });
    }

    // 首次登录：标记为已激活
    if (!person.is_activated) {
      await supabaseAdmin
        .from('sales_persons')
        .update({ is_activated: true })
        .eq('id', person.id);
    }

    const token = jwt.sign(
      { sub: person.id, type: 'sales', displayId: person.display_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: person.id,
        displayId: person.display_id || person.code,
        code: person.code,
        name: person.name,
        level: person.level,
        isActivated: true,
      },
      session: { access_token: token },
    });
  } catch (err) {
    logger.error('Sales login error:', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

/**
 * 获取当前销售员信息（需 token）
 * GET /api/sales/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'sales') {
      return res.status(403).json({ error: '无效的销售员令牌' });
    }

    const { data: person, error } = await supabaseAdmin
      .from('sales_persons')
      .select('id, code, display_id, name, level, phone, is_activated')
      .eq('id', decoded.sub)
      .single();

    if (error || !person) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      user: {
        id: person.id,
        displayId: person.display_id || person.code,
        code: person.code,
        name: person.name,
        level: person.level,
        isActivated: person.is_activated,
      },
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌无效或已过期' });
    }
    logger.error('Sales me error:', err);
    res.status(500).json({ error: '获取信息失败' });
  }
});

module.exports = router;
