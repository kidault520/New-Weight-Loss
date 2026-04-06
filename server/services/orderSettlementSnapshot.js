const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const DEFAULT_DISCOUNT_RATE = 0.6;
const DEFAULT_COMMISSION_RATE = 0.27;

function parseTs(value) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function pickVersionForOrder(versions, orderTs) {
  if (!versions.length) return null;
  if (!orderTs) return versions[0] || null;
  for (const v of versions) {
    const effectiveTs = parseTs(v.effective_at);
    if (!effectiveTs || effectiveTs <= orderTs) return v;
  }
  return versions[versions.length - 1] || null;
}

function resolveDiscountRate(version, productId) {
  if (!version) return DEFAULT_DISCOUNT_RATE;
  const productMappings = Array.isArray(version.product_mappings) ? version.product_mappings : [];
  const discountRates = Array.isArray(version.discount_rates) ? version.discount_rates : [];
  const mapping = productMappings.find((m) => String(m?.productId || m?.product_id || '') === String(productId || ''));
  if (!mapping) return DEFAULT_DISCOUNT_RATE;

  const category = String(mapping.category || '');
  const attribute = mapping.attribute != null ? String(mapping.attribute) : '';
  const hasAttributeRates = discountRates.some((r) => {
    if (String(r?.category || '') !== category) return false;
    return String(r?.attribute || '').trim().length > 0;
  });

  const exact = discountRates.find((r) => {
    if (String(r?.category || '') !== category) return false;
    return String(r?.attribute || '') === attribute;
  });
  if (typeof exact?.discountRate === 'number' && Number.isFinite(exact.discountRate)) {
    return exact.discountRate;
  }

  // Attribute-detail mode: do not fallback to category base.
  if (hasAttributeRates) {
    return DEFAULT_DISCOUNT_RATE;
  }

  const byCategory = discountRates.find((r) => String(r?.category || '') === category && !r?.attribute);
  if (typeof byCategory?.discountRate === 'number' && Number.isFinite(byCategory.discountRate)) {
    return byCategory.discountRate;
  }

  return DEFAULT_DISCOUNT_RATE;
}

async function ensureOrderSettlementSnapshot(orderId) {
  if (!orderId) return { ok: false, reason: 'missing_order_id' };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('order_settlement_snapshots')
    .select('id, order_id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return { ok: true, created: false, reason: 'already_exists' };

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, user_id, salesperson_id, product_id, total_amount, payment_status, payment_time, created_at')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order?.id) return { ok: false, reason: 'order_not_found' };
  if (String(order.payment_status || '').toLowerCase() !== 'paid') {
    return { ok: false, reason: 'order_not_paid' };
  }

  const { data: configVersions, error: versionsErr } = await supabaseAdmin
    .from('sales_product_config_versions')
    .select('version, effective_at, product_mappings, discount_rates')
    .eq('config_key', 'default')
    .order('effective_at', { ascending: false });
  if (versionsErr) throw versionsErr;

  const versions = configVersions || [];
  const orderTs = parseTs(order.payment_time) || parseTs(order.created_at);
  const usedVersion = pickVersionForOrder(versions, orderTs);
  const usedDiscountRate = resolveDiscountRate(usedVersion, order.product_id);
  const usedCommissionRate = DEFAULT_COMMISSION_RATE;
  const amount = Number(order.total_amount || 0);
  const estimatedCommission = amount * usedDiscountRate * usedCommissionRate;

  const payload = {
    order_id: order.id,
    order_number: order.order_number || null,
    user_id: order.user_id || null,
    salesperson_id: order.salesperson_id || null,
    product_id: order.product_id || null,
    payment_time: order.payment_time || null,
    settled_amount: amount,
    config_version: usedVersion?.version ?? null,
    discount_rate: usedDiscountRate,
    commission_rate: usedCommissionRate,
    estimated_commission: estimatedCommission,
    config_snapshot: usedVersion
      ? {
          version: usedVersion.version,
          effective_at: usedVersion.effective_at,
          product_mappings: Array.isArray(usedVersion.product_mappings) ? usedVersion.product_mappings : [],
          discount_rates: Array.isArray(usedVersion.discount_rates) ? usedVersion.discount_rates : [],
        }
      : null,
  };

  const { error: insertError } = await supabaseAdmin
    .from('order_settlement_snapshots')
    .insert(payload);

  if (insertError?.code === '23505') {
    return { ok: true, created: false, reason: 'race_duplicate' };
  }
  if (insertError) throw insertError;

  return { ok: true, created: true, reason: 'created' };
}

module.exports = {
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_COMMISSION_RATE,
  parseTs,
  pickVersionForOrder,
  resolveDiscountRate,
  ensureOrderSettlementSnapshot,
};

