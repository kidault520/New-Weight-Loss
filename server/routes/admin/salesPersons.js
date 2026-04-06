/**
 * 管理员 - 销售员账号管理（设置密码、列表等）
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateAdmin, checkPermission } = require('../../middleware/adminAuth');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../utils/logger');
const {
  DEFAULT_COMMISSION_RATE,
  parseTs,
  pickVersionForOrder,
  resolveDiscountRate,
} = require('../../services/orderSettlementSnapshot');
const router = express.Router();

/**
 * 获取销售员列表（用于订单关联等）
 * GET /api/admin/sales-persons?limit=500
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
    const search = req.query.search || '';

    let query = supabaseAdmin
      .from('sales_persons')
      .select('id, code, display_id, name, level, status')
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,display_id.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      throw error;
    }

    res.json({ salesPersons: data || [] });
  } catch (err) {
    logger.error('Get sales persons error:', err);
    res.status(500).json({ error: '获取销售员列表失败' });
  }
});

/**
 * 获取销售员业绩汇总（从已支付订单）
 * GET /api/admin/sales-persons/performance?start_date=2025-01-01&end_date=2025-12-31
 */
router.get('/performance', authenticateAdmin, async (req, res) => {
  try {
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('salesperson_id, total_amount, id, order_number, created_at, payment_time, payment_status, product_id')
      .eq('payment_status', 'paid')
      .not('salesperson_id', 'is', null);

    if (startDate) ordersQuery = ordersQuery.gte('created_at', startDate);
    if (endDate) ordersQuery = ordersQuery.lte('created_at', endDate + 'T23:59:59.999Z');

    const { data: orders, error } = await ordersQuery;

    if (error) throw error;

    const { data: configVersions, error: versionsErr } = await supabaseAdmin
      .from('sales_product_config_versions')
      .select('version, effective_at, product_mappings, discount_rates')
      .eq('config_key', 'default')
      .order('effective_at', { ascending: false });
    if (versionsErr) throw versionsErr;
    const versions = configVersions || [];
    const orderIds = (orders || []).map((o) => o.id).filter(Boolean);
    const snapshotByOrderId = {};
    if (orderIds.length > 0) {
      const { data: snapshots, error: snapshotError } = await supabaseAdmin
        .from('order_settlement_snapshots')
        .select('order_id, discount_rate, commission_rate, estimated_commission, config_version')
        .in('order_id', orderIds);
      if (snapshotError) throw snapshotError;
      (snapshots || []).forEach((s) => {
        if (s?.order_id) snapshotByOrderId[s.order_id] = s;
      });
    }

    const byPerson = {};
    (orders || []).forEach((o) => {
      const amount = parseFloat(o.total_amount || 0);
      const snapshot = snapshotByOrderId[o.id] || null;
      let usedVersion = null;
      let discountRate = null;
      let commissionRate = null;
      let estimatedCommission = null;
      if (snapshot) {
        usedVersion = snapshot.config_version != null ? { version: snapshot.config_version } : null;
        discountRate = Number(snapshot.discount_rate || 0);
        commissionRate = Number(snapshot.commission_rate || DEFAULT_COMMISSION_RATE);
        estimatedCommission = Number(snapshot.estimated_commission || 0);
      } else {
        const orderTs = parseTs(o.payment_time) || parseTs(o.created_at);
        usedVersion = pickVersionForOrder(versions, orderTs);
        discountRate = resolveDiscountRate(usedVersion, o.product_id);
        commissionRate = DEFAULT_COMMISSION_RATE;
        estimatedCommission = amount * discountRate * commissionRate;
      }

      const id = o.salesperson_id;
      if (!byPerson[id]) {
        byPerson[id] = {
          salesperson_id: id,
          total_amount: 0,
          order_count: 0,
          estimated_commission_total: 0,
          orders: [],
        };
      }
      byPerson[id].total_amount += amount;
      byPerson[id].order_count += 1;
      byPerson[id].estimated_commission_total += estimatedCommission;
      byPerson[id].orders.push({
        id: o.id,
        order_number: o.order_number,
        total_amount: o.total_amount,
        created_at: o.created_at,
        payment_time: o.payment_time || null,
        product_id: o.product_id || null,
        used_discount_rate: discountRate,
        used_commission_rate: commissionRate,
        used_config_version: usedVersion?.version ?? null,
        estimated_commission: estimatedCommission,
      });
    });

    const personIds = Object.keys(byPerson);
    if (personIds.length > 0) {
      const { data: persons } = await supabaseAdmin
        .from('sales_persons')
        .select('id, code, display_id, name, level')
        .in('id', personIds);
      const personMap = {};
      (persons || []).forEach((p) => { personMap[p.id] = p; });
      Object.keys(byPerson).forEach((id) => {
        byPerson[id].salesperson = personMap[id] || null;
      });
    }

    res.json({
      summary: Object.values(byPerson),
      total_orders: orders?.length || 0,
      total_amount: (orders || []).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0),
    });
  } catch (err) {
    logger.error('Get sales performance error:', err);
    res.status(500).json({ error: '获取销售业绩失败' });
  }
});

/**
 * 结算快照列表（用于审计追溯）
 * GET /api/admin/sales-persons/settlement-snapshots
 *   ?start_date=2025-01-01
 *   &end_date=2025-12-31
 *   &order_number=ORDxxx
 *   &salesperson_id=uuid
 *   &salesperson_keyword=姓名/工号
 *   &limit=200
 */
router.get('/settlement-snapshots', authenticateAdmin, async (req, res) => {
  try {
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();
    const orderNumber = String(req.query.order_number || '').trim();
    const salespersonId = String(req.query.salesperson_id || '').trim();
    const salespersonKeyword = String(req.query.salesperson_keyword || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);

    let salespersonIdsFilter = null;
    if (salespersonKeyword) {
      const { data: personsMatched, error: personsMatchErr } = await supabaseAdmin
        .from('sales_persons')
        .select('id')
        .or(`name.ilike.%${salespersonKeyword}%,code.ilike.%${salespersonKeyword}%,display_id.ilike.%${salespersonKeyword}%`)
        .limit(200);
      if (personsMatchErr) throw personsMatchErr;
      salespersonIdsFilter = [...new Set((personsMatched || []).map((p) => p.id).filter(Boolean))];
      if (salespersonIdsFilter.length === 0) {
        return res.json({
          summary: { total_count: 0, total_amount: 0, total_estimated_commission: 0 },
          snapshots: [],
        });
      }
    }

    let query = supabaseAdmin
      .from('order_settlement_snapshots')
      .select(
        'id, order_id, order_number, user_id, salesperson_id, product_id, payment_time, settled_amount, config_version, discount_rate, commission_rate, estimated_commission, config_snapshot, created_at'
      )
      .order('payment_time', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (startDate) query = query.gte('payment_time', startDate);
    if (endDate) query = query.lte('payment_time', `${endDate}T23:59:59.999Z`);
    if (orderNumber) query = query.ilike('order_number', `%${orderNumber}%`);
    if (salespersonId) query = query.eq('salesperson_id', salespersonId);
    if (salespersonIdsFilter) query = query.in('salesperson_id', salespersonIdsFilter);

    const { data: snapshots, error } = await query;
    if (error) throw error;

    const rows = snapshots || [];
    const mappingProductIds = new Set();
    rows.forEach((row) => {
      const mappings = Array.isArray(row?.config_snapshot?.product_mappings)
        ? row.config_snapshot.product_mappings
        : [];
      mappings.forEach((m) => {
        const pid = String(m?.productId || m?.product_id || '').trim();
        if (pid) mappingProductIds.add(pid);
      });
    });

    const productRefMap = {};
    if (mappingProductIds.size > 0) {
      const ids = [...mappingProductIds];
      const { data: products, error: productErr } = await supabaseAdmin
        .from('products')
        .select('id, product_code, product_name')
        .in('id', ids);
      if (productErr) throw productErr;
      (products || []).forEach((p) => {
        productRefMap[p.id] = {
          id: p.id,
          product_code: p.product_code || '',
          product_name: p.product_name || '',
        };
      });
    }

    const salespersonIds = [...new Set(rows.map((r) => r.salesperson_id).filter(Boolean))];
    const salespersonMap = {};
    if (salespersonIds.length > 0) {
      const { data: persons, error: personErr } = await supabaseAdmin
        .from('sales_persons')
        .select('id, name, code, display_id, level')
        .in('id', salespersonIds);
      if (personErr) throw personErr;
      (persons || []).forEach((p) => {
        salespersonMap[p.id] = p;
      });
    }

    const summary = rows.reduce(
      (acc, row) => {
        acc.total_count += 1;
        acc.total_amount += Number(row.settled_amount || 0);
        acc.total_estimated_commission += Number(row.estimated_commission || 0);
        return acc;
      },
      { total_count: 0, total_amount: 0, total_estimated_commission: 0 }
    );

    res.json({
      summary,
      product_ref_map: productRefMap,
      snapshots: rows.map((r) => ({
        ...r,
        salesperson: r.salesperson_id ? salespersonMap[r.salesperson_id] || null : null,
        config_snapshot: r?.config_snapshot
          ? {
              ...r.config_snapshot,
              product_mappings: Array.isArray(r.config_snapshot.product_mappings)
                ? r.config_snapshot.product_mappings.map((m) => {
                    const pid = String(m?.productId || m?.product_id || '').trim();
                    const ref = pid ? productRefMap[pid] : null;
                    if (!ref) return m;
                    return {
                      ...m,
                      product_code: ref.product_code || '',
                      product_name: ref.product_name || '',
                    };
                  })
                : [],
            }
          : r?.config_snapshot ?? null,
      })),
    });
  } catch (err) {
    logger.error('Get settlement snapshots error:', err);
    res.status(500).json({ error: '获取结算快照失败' });
  }
});

/**
 * 为销售员设置/重置密码
 * POST /api/admin/sales-persons/:id/set-password
 * Body: { password }
 */
router.post('/:id/set-password', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    const hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('sales_persons')
      .update({ password_hash: hash })
      .eq('id', id)
      .select('id, code, display_id, name')
      .single();

    if (error) {
      logger.error('Set sales password error:', error);
      return res.status(500).json({ error: '设置失败' });
    }

    if (!data) {
      return res.status(404).json({ error: '人员不存在' });
    }

    res.json({ success: true, message: '密码已设置' });
  } catch (err) {
    logger.error('Set sales password error:', err);
    res.status(500).json({ error: '设置失败' });
  }
});

module.exports = router;
