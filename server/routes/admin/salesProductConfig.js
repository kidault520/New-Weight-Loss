const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');

const router = express.Router();

router.use(authenticateAdmin);
router.use(auditLog);

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseTs(value) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function toAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function makeStableCode(prefix, raw) {
  const base = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'x';
  return `${prefix}_${base}`;
}

function pad2(n) {
  return String(Math.max(1, Number(n) || 1)).padStart(2, '0');
}

function isValidCategoryId(value) {
  return /^pl\d{2,}$/i.test(normalizeText(value));
}

function isValidAttributeId(value) {
  return /^\d{2,}$/.test(normalizeText(value));
}

function rateKey(rate) {
  const category = normalizeKey(rate?.categoryId || rate?.category);
  const attribute = normalizeKey(rate?.attributeId || rate?.attribute);
  return `${category}__${attribute}`;
}

function dedupeDiscountRates(rates) {
  const list = normalizeArray(rates);
  // Last-write-wins: keep the latest item for duplicate category/attribute key.
  const seen = new Set();
  const out = [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i] || {};
    const key = rateKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.unshift(item);
  }
  return out;
}

function normalizeCategories(categories) {
  const usedCategoryIds = new Set();
  return normalizeArray(categories).map((c, idx) => {
    const name = normalizeText(c?.name);
    const id = normalizeText(c?.id) || makeStableCode('cat', name);
    let categoryId = normalizeText(c?.categoryId);
    if (!isValidCategoryId(categoryId)) {
      categoryId = `pl${pad2(idx + 1)}`;
    }
    while (usedCategoryIds.has(categoryId.toLowerCase())) {
      categoryId = `pl${pad2(Number(categoryId.replace(/^pl/i, '')) + 1)}`;
    }
    usedCategoryIds.add(categoryId.toLowerCase());

    const attributes = normalizeArray(c?.attributes).map((a) => normalizeText(a)).filter(Boolean);
    const attributeIds = {};
    const usedAttrIds = new Set();
    attributes.forEach((attr, attrIdx) => {
      let attrId = c?.attributeIds && normalizeText(c.attributeIds[attr]);
      if (!isValidAttributeId(attrId)) {
        attrId = pad2(attrIdx + 1);
      }
      while (usedAttrIds.has(attrId)) {
        attrId = pad2(Number(attrId) + 1);
      }
      usedAttrIds.add(attrId);
      attributeIds[attr] = attrId;
    });
    return {
      ...c,
      id,
      categoryId,
      name,
      attributes,
      attributeIds,
    };
  });
}

function normalizeProductMappings(mappings, categories) {
  const categoryMapByName = new Map();
  const categoryMapById = new Map();
  categories.forEach((c) => {
    categoryMapByName.set(normalizeKey(c.name), c);
    categoryMapById.set(normalizeKey(c.categoryId), c);
  });
  return normalizeArray(mappings).map((m) => {
    const productId = normalizeText(m?.productId || m?.product_id);
    const categoryName = normalizeText(m?.category);
    const categoryIdRaw = normalizeText(m?.categoryId);
    const matchById = categoryMapById.get(normalizeKey(categoryIdRaw));
    const matchByName = categoryMapByName.get(normalizeKey(categoryName));
    const matchedCategory = matchById || matchByName || null;
    const category = matchedCategory?.name || categoryName;
    const categoryId = matchedCategory?.categoryId || (isValidCategoryId(categoryIdRaw) ? categoryIdRaw : '');
    const attribute = normalizeText(m?.attribute);
    const attributeId = attribute
      ? (matchedCategory?.attributeIds?.[attribute] || (isValidAttributeId(m?.attributeId) ? normalizeText(m?.attributeId) : ''))
      : '';
    return {
      ...m,
      mappingId: normalizeText(m?.mappingId) || makeStableCode('mp', productId || `${categoryId}_${attribute || 'base'}`),
      productId: productId || null,
      category,
      categoryId,
      attribute: attribute || undefined,
      attributeId: attributeId || undefined,
    };
  });
}

function normalizeDiscountRates(rates, categories) {
  const categoryMapByName = new Map();
  const categoryMapById = new Map();
  categories.forEach((c) => {
    categoryMapByName.set(normalizeKey(c.name), c);
    categoryMapById.set(normalizeKey(c.categoryId), c);
  });
  const normalized = normalizeArray(rates).map((r) => {
    const categoryName = normalizeText(r?.category);
    const categoryIdRaw = normalizeText(r?.categoryId);
    const matchById = categoryMapById.get(normalizeKey(categoryIdRaw));
    const matchByName = categoryMapByName.get(normalizeKey(categoryName));
    const matchedCategory = matchById || matchByName || null;
    const category = matchedCategory?.name || categoryName;
    const categoryId = matchedCategory?.categoryId || (isValidCategoryId(categoryIdRaw) ? categoryIdRaw : '');
    const attribute = normalizeText(r?.attribute);
    const attributeId = attribute
      ? (matchedCategory?.attributeIds?.[attribute] || (isValidAttributeId(r?.attributeId) ? normalizeText(r?.attributeId) : ''))
      : '';
    const discountRate = Number(r?.discountRate);
    return {
      ...r,
      rateId: normalizeText(r?.rateId) || makeStableCode('dr', `${categoryId}_${attributeId || 'base'}`),
      category,
      categoryId,
      attribute: attribute || undefined,
      attributeId: attributeId || undefined,
      discountRate: Number.isFinite(discountRate) ? discountRate : 0,
    };
  });
  return dedupeDiscountRates(normalized);
}

function entityCategoryKey(item) {
  return normalizeKey(item?.categoryId || item?.category);
}

function entityAttributeKey(item) {
  return normalizeKey(item?.attributeId || item?.attribute);
}

function mappingEntityKey(mapping) {
  const mappingId = normalizeKey(mapping?.mappingId);
  if (mappingId) return mappingId;
  return `${normalizeKey(mapping?.productId || mapping?.product_id)}__${entityCategoryKey(mapping)}__${entityAttributeKey(mapping)}`;
}

function rateEntityKey(rate) {
  return `${entityCategoryKey(rate)}__${entityAttributeKey(rate)}`;
}

function buildUsageSets(versions, paidOrders) {
  const usedCategoryKeys = new Set();
  const usedAttributeKeys = new Set();
  const usedMappingKeys = new Set();
  const usedRateKeys = new Set();

  const ordered = [...versions]
    .map((v) => ({
      ...v,
      effectiveTs: parseTs(v.effective_at) || 0,
      productMappingsNorm: normalizeProductMappings(v.product_mappings, normalizeCategories(v.categories)),
      discountRatesNorm: normalizeDiscountRates(v.discount_rates, normalizeCategories(v.categories)),
    }))
    .sort((a, b) => a.effectiveTs - b.effectiveTs || Number(a.version || 0) - Number(b.version || 0));
  if (!ordered.length) {
    return { usedCategoryKeys, usedAttributeKeys, usedMappingKeys, usedRateKeys };
  }

  const orders = normalizeArray(paidOrders)
    .map((o) => ({
      ...o,
      orderTs: parseTs(o.payment_time) || parseTs(o.created_at) || 0,
    }))
    .filter((o) => o.orderTs > 0)
    .sort((a, b) => a.orderTs - b.orderTs);

  let versionIdx = 0;
  for (const order of orders) {
    while (versionIdx + 1 < ordered.length && ordered[versionIdx + 1].effectiveTs <= order.orderTs) {
      versionIdx += 1;
    }
    const version = ordered[versionIdx] || ordered[0];
    const productId = normalizeText(order.product_id);
    if (!productId) continue;
    const mapping = version.productMappingsNorm.find((m) => normalizeText(m.productId) === productId);
    if (!mapping) continue;

    const catKey = entityCategoryKey(mapping);
    const attrKey = entityAttributeKey(mapping);
    const mapKey = mappingEntityKey(mapping);
    if (catKey) usedCategoryKeys.add(catKey);
    if (catKey || attrKey) usedAttributeKeys.add(`${catKey}__${attrKey}`);
    if (mapKey) usedMappingKeys.add(mapKey);

    const exactRate = version.discountRatesNorm.find((r) => rateEntityKey(r) === `${catKey}__${attrKey}`);
    const hasAttributeRates = version.discountRatesNorm.some((r) => entityCategoryKey(r) === catKey && entityAttributeKey(r));
    const fallbackRate = hasAttributeRates
      ? null
      : version.discountRatesNorm.find((r) => rateEntityKey(r) === `${catKey}__`);
    const usedRate = exactRate || fallbackRate || null;
    if (usedRate) usedRateKeys.add(rateEntityKey(usedRate));
  }

  return { usedCategoryKeys, usedAttributeKeys, usedMappingKeys, usedRateKeys };
}

function buildCategoryMap(categories) {
  const map = new Map();
  normalizeArray(categories).forEach((c) => {
    const key = entityCategoryKey(c);
    if (!key) return;
    map.set(key, {
      categoryId: normalizeText(c?.categoryId),
      name: normalizeText(c?.name),
    });
  });
  return map;
}

function buildAttributeMap(categories) {
  const map = new Map();
  normalizeArray(categories).forEach((c) => {
    const catKey = entityCategoryKey(c);
    if (!catKey) return;
    normalizeArray(c?.attributes).forEach((attr) => {
      const attrId = normalizeText(c?.attributeIds?.[attr] || attr);
      const key = `${catKey}__${normalizeKey(attrId || attr)}`;
      map.set(key, {
        categoryId: normalizeText(c?.categoryId),
        categoryName: normalizeText(c?.name),
        attributeId: attrId,
        attributeName: normalizeText(attr),
      });
    });
  });
  return map;
}

function buildMappingMap(mappings) {
  const map = new Map();
  normalizeArray(mappings).forEach((m) => {
    const key = mappingEntityKey(m);
    if (!key) return;
    map.set(key, {
      mappingId: normalizeText(m?.mappingId),
      productId: normalizeText(m?.productId || m?.product_id),
      categoryId: normalizeText(m?.categoryId),
      categoryName: normalizeText(m?.category),
      attributeId: normalizeText(m?.attributeId),
      attributeName: normalizeText(m?.attribute),
    });
  });
  return map;
}

function buildRateMap(rates) {
  const map = new Map();
  normalizeArray(rates).forEach((r) => {
    const key = rateEntityKey(r);
    if (!key) return;
    map.set(key, {
      categoryId: normalizeText(r?.categoryId),
      categoryName: normalizeText(r?.category),
      attributeId: normalizeText(r?.attributeId),
      attributeName: normalizeText(r?.attribute),
      discountRate: Number(r?.discountRate),
    });
  });
  return map;
}

function normalizeForCompare(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCompare(item));
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((key) => {
      out[key] = normalizeForCompare(value[key]);
    });
    return out;
  }
  return value ?? null;
}

function isSameConfig(a, b) {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}

async function writeAdminChangeAudit({
  adminId = null,
  module,
  action,
  entityId = null,
  beforeData = null,
  afterData = null,
  reason = null,
}) {
  try {
    await supabaseAdmin.from('admin_change_audit_logs').insert({
      admin_id: adminId,
      module,
      action,
      entity_id: entityId,
      before_data: beforeData,
      after_data: afterData,
      reason,
    });
  } catch (error) {
    logger.warn('[admin/sales-product-config] write admin_change_audit_logs failed:', error?.message || error);
  }
}

/**
 * GET /api/admin/sales-product-config
 * 读取当前生效商品配置（单一 SoT：sales_product_config）
 */
router.get('/', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales_product_config')
      .select('id, config_key, categories, product_mappings, discount_rates, version, effective_at, updated_at')
      .eq('config_key', 'default')
      .maybeSingle();

    if (error) throw error;

    const safeCategories = normalizeCategories(data?.categories);
    const safeMappings = normalizeProductMappings(data?.product_mappings, safeCategories);
    const safeDiscountRates = normalizeDiscountRates(data?.discount_rates, safeCategories);

    return res.json({
      success: true,
      code: 'OK',
      config: {
        id: data?.id || null,
        configKey: 'default',
        categories: safeCategories,
        productMappings: safeMappings,
        discountRates: safeDiscountRates,
        version: data?.version ?? 1,
        effectiveAt: data?.effective_at || null,
        updatedAt: data?.updated_at || null,
      },
    });
  } catch (error) {
    logger.error('Get sales product config error:', error);
    return res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      error: 'Failed to get sales product config',
      details: error?.message || 'unknown error',
    });
  }
});

/**
 * GET /api/admin/sales-product-config/versions?limit=20
 * 查询版本历史（倒序）
 */
router.get('/versions', checkPermission('manage_menu'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const { data, error } = await supabaseAdmin
      .from('sales_product_config_versions')
      .select('id, config_key, version, effective_at, source, note, created_by_admin_id, created_at, categories, product_mappings, discount_rates')
      .eq('config_key', 'default')
      .order('effective_at', { ascending: true })
      .order('version', { ascending: true });

    if (error) throw error;

    const versions = data || [];
    const { data: currentConfig, error: currentErr } = await supabaseAdmin
      .from('sales_product_config')
      .select('id, config_key, version, effective_at, categories, product_mappings, discount_rates, updated_at')
      .eq('config_key', 'default')
      .maybeSingle();
    if (currentErr) throw currentErr;
    const { data: paidOrders, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, product_id, total_amount, payment_time, created_at')
      .eq('payment_status', 'paid')
      .order('payment_time', { ascending: true });
    if (orderErr) throw orderErr;

    const statsByVersionId = new Map();
    versions.forEach((v) => {
      statsByVersionId.set(v.id, {
        covered_order_count: 0,
        covered_total_amount: 0,
        applied_order_count: 0,
        applied_total_amount: 0,
        categoryMap: new Map(),
      });
    });

    for (const order of (paidOrders || [])) {
      const orderTs = parseTs(order.payment_time) || parseTs(order.created_at);
      if (!orderTs) continue;
      let matchedVersion = null;
      for (let i = versions.length - 1; i >= 0; i -= 1) {
        const v = versions[i];
        const effectiveTs = parseTs(v.effective_at);
        if (!effectiveTs || effectiveTs <= orderTs) {
          matchedVersion = v;
          break;
        }
      }
      // If order is older than earliest snapshot, attribute to earliest available version.
      if (!matchedVersion && versions.length > 0) {
        matchedVersion = versions[0];
      }
      if (!matchedVersion) continue;

      const stat = statsByVersionId.get(matchedVersion.id);
      if (!stat) continue;

      const amount = toAmount(order.total_amount);
      stat.covered_order_count += 1;
      stat.covered_total_amount += amount;

      const mappings = normalizeArray(matchedVersion.product_mappings);
      const mapping = mappings.find((m) => String(m?.productId || m?.product_id || '') === String(order.product_id || ''));
      if (!mapping) continue;

      const category = String(mapping.category || '未分类');
      const attribute = mapping.attribute != null ? String(mapping.attribute) : '';
      const key = `${category}__${attribute}`;
      const prev = stat.categoryMap.get(key) || {
        category,
        attribute: attribute || null,
        order_count: 0,
        total_amount: 0,
      };
      prev.order_count += 1;
      prev.total_amount += amount;
      stat.categoryMap.set(key, prev);

      stat.applied_order_count += 1;
      stat.applied_total_amount += amount;
    }

    const adminIds = [...new Set((versions || []).map((v) => v.created_by_admin_id).filter(Boolean))];
    const adminUserById = {};
    if (adminIds.length > 0) {
      const { data: adminUsers, error: adminErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, user_id')
        .in('id', adminIds);
      if (adminErr) throw adminErr;
      (adminUsers || []).forEach((a) => {
        adminUserById[a.id] = a;
      });
    }

    const adminUserIds = [...new Set(Object.values(adminUserById).map((a) => a.user_id).filter(Boolean))];
    const profileByUserId = {};
    if (adminUserIds.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, nickname, name')
        .in('user_id', adminUserIds);
      if (profileErr) throw profileErr;
      (profiles || []).forEach((p) => {
        profileByUserId[p.user_id] = p;
      });
    }

    const enriched = versions
      .map((v) => {
        const stat = statsByVersionId.get(v.id);
        const categoryBreakdown = stat
          ? Array.from(stat.categoryMap.values()).sort((a, b) => b.order_count - a.order_count)
          : [];
        const categoriesSnapshot = normalizeArray(v.categories);
        const mappingsSnapshot = normalizeArray(v.product_mappings);
        const ratesSnapshot = normalizeArray(v.discount_rates);
        const adminUser = v.created_by_admin_id ? adminUserById[v.created_by_admin_id] : null;
        const profile = adminUser?.user_id ? profileByUserId[adminUser.user_id] : null;
        const createdByName =
          (profile && (profile.nickname || profile.name)) ||
          (v.created_by_admin_id ? `管理员(${String(v.created_by_admin_id).slice(0, 8)})` : '-');
        return {
          id: v.id,
          config_key: v.config_key,
          version: v.version,
          effective_at: v.effective_at,
          source: v.source,
          note: v.note,
          created_by_admin_id: v.created_by_admin_id,
          created_by_name: createdByName,
          created_at: v.created_at,
          latest_change_at: v.created_at || null,
          is_current: Number(v.version) === Number(currentConfig?.version || -1),
          covered_order_count: stat?.covered_order_count || 0,
          covered_total_amount: stat?.covered_total_amount || 0,
          applied_order_count: stat?.applied_order_count || 0,
          applied_total_amount: stat?.applied_total_amount || 0,
          category_breakdown: categoryBreakdown,
          categories: categoriesSnapshot,
          product_mappings: mappingsSnapshot,
          discount_rates: ratesSnapshot,
        };
      })
      .sort((a, b) => (parseTs(b.effective_at) || 0) - (parseTs(a.effective_at) || 0))
      .slice(0, limit);

    return res.json({
      success: true,
      code: 'OK',
      versions: enriched,
    });
  } catch (error) {
    logger.error('Get sales product config versions error:', error);
    return res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      error: 'Failed to get sales product config versions',
      details: error?.message || 'unknown error',
    });
  }
});

/**
 * GET /api/admin/sales-product-config/versions/history?limit=100
 * 查询配置操作历史（来自审计日志，独立于版本快照是否被删除）
 */
router.get('/versions/history', checkPermission('manage_menu'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('admin_change_audit_logs')
      .select('id, admin_id, module, action, entity_id, before_data, after_data, reason, created_at')
      .eq('module', 'sales_product_config')
      .in('action', ['publish', 'delete_version'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (logsErr) throw logsErr;

    const rows = logs || [];
    const adminIds = [...new Set(rows.map((r) => r.admin_id).filter(Boolean))];
    const adminUserById = {};
    if (adminIds.length > 0) {
      const { data: adminUsers, error: adminErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, user_id')
        .in('id', adminIds);
      if (adminErr) throw adminErr;
      (adminUsers || []).forEach((a) => {
        adminUserById[a.id] = a;
      });
    }

    const adminUserIds = [...new Set(Object.values(adminUserById).map((a) => a.user_id).filter(Boolean))];
    const profileByUserId = {};
    if (adminUserIds.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, nickname, name')
        .in('user_id', adminUserIds);
      if (profileErr) throw profileErr;
      (profiles || []).forEach((p) => {
        profileByUserId[p.user_id] = p;
      });
    }

    const history = rows.map((r) => {
      const adminUser = r.admin_id ? adminUserById[r.admin_id] : null;
      const profile = adminUser?.user_id ? profileByUserId[adminUser.user_id] : null;
      const adminName =
        (profile && (profile.nickname || profile.name)) ||
        (r.admin_id ? `管理员(${String(r.admin_id).slice(0, 8)})` : '-');
      return {
        ...r,
        admin_name: adminName,
      };
    });

    return res.json({
      success: true,
      code: 'OK',
      history,
    });
  } catch (error) {
    logger.error('Get sales product config history error:', error);
    return res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      error: 'Failed to get sales product config history',
      details: error?.message || 'unknown error',
    });
  }
});

/**
 * GET /api/admin/sales-product-config/usage-locks
 * 返回已被生效订单使用、应禁止编辑/删除的品类与属性键
 */
router.get('/usage-locks', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { data: currentConfig, error: currentErr } = await supabaseAdmin
      .from('sales_product_config')
      .select('config_key, version, effective_at, categories, product_mappings, discount_rates')
      .eq('config_key', 'default')
      .maybeSingle();
    if (currentErr) throw currentErr;

    const { data: configVersions, error: versionsErr } = await supabaseAdmin
      .from('sales_product_config_versions')
      .select('version, effective_at, categories, product_mappings, discount_rates')
      .eq('config_key', 'default')
      .order('effective_at', { ascending: true })
      .order('version', { ascending: true });
    if (versionsErr) throw versionsErr;

    const versions = normalizeArray(configVersions);
    const hasCurrent = versions.some((v) => Number(v.version) === Number(currentConfig?.version || -1));
    if (currentConfig?.version && !hasCurrent) {
      versions.push({
        version: currentConfig.version,
        effective_at: currentConfig.effective_at || new Date().toISOString(),
        categories: normalizeArray(currentConfig.categories),
        product_mappings: normalizeArray(currentConfig.product_mappings),
        discount_rates: normalizeArray(currentConfig.discount_rates),
      });
    }

    const { data: paidOrders, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, product_id, payment_time, created_at')
      .eq('payment_status', 'paid');
    if (orderErr) throw orderErr;

    const usage = buildUsageSets(versions, paidOrders || []);

    return res.json({
      success: true,
      code: 'OK',
      locks: {
        usedCategoryKeys: [...usage.usedCategoryKeys],
        usedAttributeKeys: [...usage.usedAttributeKeys],
        usedRateKeys: [...usage.usedRateKeys],
        usedMappingKeys: [...usage.usedMappingKeys],
      },
    });
  } catch (error) {
    logger.error('Get sales product config usage locks error:', error);
    return res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      error: 'Failed to get sales product config usage locks',
      details: error?.message || 'unknown error',
    });
  }
});

/**
 * DELETE /api/admin/sales-product-config/versions/:id
 * 删除非当前使用版本
 */
router.delete('/versions/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const versionId = String(req.params.id || '').trim();
    if (!versionId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'version id is required',
      });
    }

    const { data: target, error: targetErr } = await supabaseAdmin
      .from('sales_product_config_versions')
      .select('id, version, config_key')
      .eq('id', versionId)
      .maybeSingle();
    if (targetErr) throw targetErr;
    if (!target?.id) {
      return res.status(404).json({
        success: false,
        code: 'VERSION_NOT_FOUND',
        error: 'version not found',
      });
    }

    const { data: current, error: currentErr } = await supabaseAdmin
      .from('sales_product_config')
      .select('version')
      .eq('config_key', 'default')
      .maybeSingle();
    if (currentErr) throw currentErr;
    if (Number(target.version) === Number(current?.version || -1)) {
      return res.status(409).json({
        success: false,
        code: 'VERSION_IN_USE',
        error: 'current active version cannot be deleted',
        details: '正在使用中的配置版本不可删除',
      });
    }

    const { error: delErr } = await supabaseAdmin
      .from('sales_product_config_versions')
      .delete()
      .eq('id', target.id);
    if (delErr) throw delErr;

    await writeAdminChangeAudit({
      adminId: req.admin?.id || null,
      module: 'sales_product_config',
      action: 'delete_version',
      entityId: target.id,
      beforeData: { version: target.version, configKey: target.config_key },
      afterData: null,
      reason: 'admin_delete_non_current_sales_product_config_version',
    });

    return res.json({
      success: true,
      code: 'OK',
      message: 'Version deleted',
    });
  } catch (error) {
    logger.error('Delete sales product config version error:', error);
    const errCode = String(error?.code || error?.cause?.code || error?.originalError?.code || '');
    const errMsg = String(
      error?.message || error?.details || error?.hint || error?.cause?.message || error?.originalError?.message || ''
    );
    if (errCode === '55000' || /append-only|cannot be deleted|immutable/i.test(errMsg)) {
      return res.status(409).json({
        success: false,
        code: 'VERSION_DELETE_BLOCKED',
        error: 'version delete blocked by database guard',
        details: '当前数据库规则不允许删除该版本，请先确认“允许删除非当前版本”的迁移已执行。',
      });
    }
    return res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      error: 'Failed to delete version',
      details: error?.message || 'unknown error',
    });
  }
});

/**
 * PUT /api/admin/sales-product-config
 * 更新当前生效商品配置（覆盖式）
 */
router.put('/', checkPermission('manage_menu'), async (req, res) => {
  try {
    const categories = normalizeCategories(req.body?.categories);
    const productMappings = normalizeProductMappings(req.body?.productMappings, categories);
    const discountRates = normalizeDiscountRates(req.body?.discountRates, categories);
    const requestedEffectiveAt = req.body?.effectiveAt ? new Date(req.body.effectiveAt).toISOString() : null;
    const effectiveAt = requestedEffectiveAt || new Date().toISOString();
    const changeNote = req.body?.note ? String(req.body.note).trim().slice(0, 500) : null;
    const publishVersion = Boolean(req.body?.publishVersion);
    if (!publishVersion) {
      return res.status(400).json({
        success: false,
        code: 'DRAFT_LOCAL_ONLY',
        error: 'draft updates must stay local',
        details: '草稿仅在前端本地保存，发布版本后才会写入服务端与历史。',
      });
    }
    if (publishVersion && !changeNote) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'version note is required when publishing',
        details: '发布新版本时必须填写版本标识',
      });
    }

    const row = {
      config_key: 'default',
      categories,
      product_mappings: productMappings,
      discount_rates: discountRates,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('sales_product_config')
      .select('id, categories, product_mappings, discount_rates, version, effective_at, updated_at')
      .eq('config_key', 'default')
      .maybeSingle();
    if (existingErr) throw existingErr;

    let saved;
    let nextVersion = 1;
    const incomingConfig = {
      categories,
      productMappings,
      discountRates,
    };

    if (existing?.id) {
      const existingCategories = normalizeCategories(existing.categories);
      const existingMappings = normalizeProductMappings(existing.product_mappings, existingCategories);
      const existingRates = normalizeDiscountRates(existing.discount_rates, existingCategories);
      const currentConfig = {
        categories: existingCategories,
        productMappings: existingMappings,
        discountRates: existingRates,
      };
      if (isSameConfig(incomingConfig, currentConfig)) {
        return res.json({
          success: true,
          code: 'OK',
          message: 'No config changes, version not incremented',
          config: {
            id: existing.id,
            configKey: 'default',
            categories: currentConfig.categories,
            productMappings: currentConfig.productMappings,
            discountRates: currentConfig.discountRates,
            version: existing.version ?? 1,
            effectiveAt: existing.effective_at || null,
            updatedAt: existing.updated_at || null,
          },
        });
      }

      const existingCategoryMap = buildCategoryMap(existingCategories);
      const incomingCategoryMap = buildCategoryMap(categories);
      const existingAttributeMap = buildAttributeMap(existingCategories);
      const incomingAttributeMap = buildAttributeMap(categories);
      const existingMappingMap = buildMappingMap(existingMappings);
      const incomingMappingMap = buildMappingMap(productMappings);
      const existingRateMap = buildRateMap(existingRates);
      const incomingRateMap = buildRateMap(discountRates);

      const removedCategoryKeys = new Set(
        [...existingCategoryMap.keys()].filter((k) => !incomingCategoryMap.has(k))
      );
      const removedAttributeKeys = new Set(
        [...existingAttributeMap.keys()].filter((k) => !incomingAttributeMap.has(k))
      );
      const removedMappingKeys = new Set(
        [...existingMappingMap.keys()].filter((k) => !incomingMappingMap.has(k))
      );
      const removedRateKeys = new Set(
        [...existingRateMap.keys()].filter((k) => !incomingRateMap.has(k))
      );
      const changedCategoryKeys = new Set(
        [...existingCategoryMap.keys()].filter((k) => incomingCategoryMap.has(k) && !isSameConfig(existingCategoryMap.get(k), incomingCategoryMap.get(k)))
      );
      const changedAttributeKeys = new Set(
        [...existingAttributeMap.keys()].filter((k) => incomingAttributeMap.has(k) && !isSameConfig(existingAttributeMap.get(k), incomingAttributeMap.get(k)))
      );
      const changedMappingKeys = new Set(
        [...existingMappingMap.keys()].filter((k) => incomingMappingMap.has(k) && !isSameConfig(existingMappingMap.get(k), incomingMappingMap.get(k)))
      );
      const changedRateKeys = new Set(
        [...existingRateMap.keys()].filter((k) => incomingRateMap.has(k) && !isSameConfig(existingRateMap.get(k), incomingRateMap.get(k)))
      );

      if (
        removedCategoryKeys.size > 0 ||
        removedAttributeKeys.size > 0 ||
        removedMappingKeys.size > 0 ||
        removedRateKeys.size > 0 ||
        changedCategoryKeys.size > 0 ||
        changedAttributeKeys.size > 0 ||
        changedMappingKeys.size > 0 ||
        changedRateKeys.size > 0
      ) {
        const { data: configVersions, error: versionsErr } = await supabaseAdmin
          .from('sales_product_config_versions')
          .select('version, effective_at, categories, product_mappings, discount_rates')
          .eq('config_key', 'default')
          .order('effective_at', { ascending: true })
          .order('version', { ascending: true });
        if (versionsErr) throw versionsErr;
        const versions = normalizeArray(configVersions);
        const hasCurrent = versions.some((v) => Number(v.version) === Number(existing.version || 1));
        if (!hasCurrent) {
          versions.push({
            version: existing.version || 1,
            effective_at: existing.effective_at || new Date().toISOString(),
            categories: existingCategories,
            product_mappings: existingMappings,
            discount_rates: existingRates,
          });
        }
        const { data: paidOrders, error: orderErr } = await supabaseAdmin
          .from('orders')
          .select('id, product_id, payment_time, created_at')
          .eq('payment_status', 'paid');
        if (orderErr) throw orderErr;

        const usage = buildUsageSets(versions, paidOrders || []);
        const blockedCategories = [...removedCategoryKeys].filter((k) => usage.usedCategoryKeys.has(k));
        const blockedAttributes = [...removedAttributeKeys].filter((k) => usage.usedAttributeKeys.has(k));
        const blockedMappings = [...removedMappingKeys].filter((k) => usage.usedMappingKeys.has(k));
        const blockedRates = [...removedRateKeys].filter((k) => usage.usedRateKeys.has(k));

        const modifiedCategories = [...existingCategoryMap.keys()].filter((k) => {
          if (!usage.usedCategoryKeys.has(k)) return false;
          if (!incomingCategoryMap.has(k)) return false;
          return !isSameConfig(existingCategoryMap.get(k), incomingCategoryMap.get(k));
        });
        const modifiedAttributes = [...existingAttributeMap.keys()].filter((k) => {
          if (!usage.usedAttributeKeys.has(k)) return false;
          if (!incomingAttributeMap.has(k)) return false;
          return !isSameConfig(existingAttributeMap.get(k), incomingAttributeMap.get(k));
        });
        const modifiedMappings = [...existingMappingMap.keys()].filter((k) => {
          if (!usage.usedMappingKeys.has(k)) return false;
          if (!incomingMappingMap.has(k)) return false;
          return !isSameConfig(existingMappingMap.get(k), incomingMappingMap.get(k));
        });
        const modifiedRates = [...existingRateMap.keys()].filter((k) => {
          if (!usage.usedRateKeys.has(k)) return false;
          if (!incomingRateMap.has(k)) return false;
          return !isSameConfig(existingRateMap.get(k), incomingRateMap.get(k));
        });

        if (
          blockedCategories.length ||
          blockedAttributes.length ||
          blockedMappings.length ||
          blockedRates.length ||
          modifiedCategories.length ||
          modifiedAttributes.length ||
          modifiedMappings.length ||
          modifiedRates.length
        ) {
          return res.status(409).json({
            success: false,
            code: 'CONFIG_ENTITY_IN_USE',
            error: 'Attempted to modify/delete entities already used by paid orders',
            reason: 'config_entity_used_by_paid_orders',
            details: JSON.stringify({
              blockedCategories,
              blockedAttributes,
              blockedMappings,
              blockedRates,
              modifiedCategories,
              modifiedAttributes,
              modifiedMappings,
              modifiedRates,
            }),
            hint: '已被生效订单使用过的品类/属性/映射/折算率不可修改或删除，只允许新增。',
          });
        }
      }
    }

    if (existing?.id) {
      if (publishVersion) {
        const { data: latestVersionRow, error: latestVersionErr } = await supabaseAdmin
          .from('sales_product_config_versions')
          .select('version')
          .eq('config_key', 'default')
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestVersionErr) throw latestVersionErr;

        const latestSnapshotVersion = Number(latestVersionRow?.version || 0);
        nextVersion = latestSnapshotVersion > 0 ? latestSnapshotVersion + 1 : Number(existing.version || 1);

        const { data, error } = await supabaseAdmin
          .from('sales_product_config')
          .update({
            ...row,
            version: nextVersion,
            effective_at: effectiveAt,
          })
          .eq('id', existing.id)
          .select('id, config_key, categories, product_mappings, discount_rates, version, effective_at, updated_at')
          .single();
        if (error) throw error;
        saved = data;
      } else {
        nextVersion = Number(existing.version || 1);
        const { data, error } = await supabaseAdmin
          .from('sales_product_config')
          .update({
            ...row,
          })
          .eq('id', existing.id)
          .select('id, config_key, categories, product_mappings, discount_rates, version, effective_at, updated_at')
          .single();
        if (error) throw error;
        saved = data;
      }
    } else {
      nextVersion = 1;
      const { data, error } = await supabaseAdmin
        .from('sales_product_config')
        .insert({
          id: 'a0000000-0000-0000-0000-000000000010',
          ...row,
          version: 1,
          effective_at: effectiveAt,
        })
        .select('id, config_key, categories, product_mappings, discount_rates, version, effective_at, updated_at')
        .single();
      if (error) throw error;
      saved = data;
    }

    if (publishVersion) {
      // Append immutable version snapshot for audit/replay only when publishing.
      const { error: verErr } = await supabaseAdmin
        .from('sales_product_config_versions')
        .insert({
          config_key: 'default',
          version: nextVersion,
          effective_at: effectiveAt,
          categories,
          product_mappings: productMappings,
          discount_rates: discountRates,
          created_by_admin_id: req.admin?.id || null,
          source: 'manual',
          note: changeNote,
        });
      if (verErr) {
        logger.error('Save sales product config version snapshot error:', verErr);
        throw verErr;
      }
    }

    if (publishVersion) {
      await writeAdminChangeAudit({
        adminId: req.admin?.id || null,
        module: 'sales_product_config',
        action: 'publish',
        entityId: saved.id,
        beforeData: existing?.id
          ? {
              categories: normalizeArray(existing.categories),
              productMappings: normalizeArray(existing.product_mappings),
              discountRates: normalizeArray(existing.discount_rates),
              version: existing.version ?? 1,
              effectiveAt: existing.effective_at || null,
            }
          : null,
        afterData: {
          categories: normalizeArray(saved.categories),
          productMappings: normalizeArray(saved.product_mappings),
          discountRates: normalizeArray(saved.discount_rates),
          version: saved.version ?? 1,
          effectiveAt: saved.effective_at || null,
          note: changeNote || null,
        },
        reason: changeNote || null,
      });
    }

    return res.json({
      success: true,
      code: 'OK',
      message: 'Sales product config published as new version',
      config: {
        id: saved.id,
        configKey: 'default',
        categories: normalizeArray(saved.categories),
        productMappings: normalizeArray(saved.product_mappings),
        discountRates: normalizeArray(saved.discount_rates),
        version: saved.version ?? 1,
        effectiveAt: saved.effective_at || null,
        updatedAt: saved.updated_at || null,
      },
    });
  } catch (error) {
    logger.error('Save sales product config error:', error);
    return res.status(500).json({
      success: false,
      code: 'SYSTEM_INTERNAL_ERROR',
      error: 'Failed to save sales product config',
      details: error?.message || 'unknown error',
    });
  }
});

module.exports = router;

