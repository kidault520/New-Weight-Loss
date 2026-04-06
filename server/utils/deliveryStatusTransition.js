const VALID_DELIVERY_STATUSES = ['pending', 'scheduled', 'preparing', 'shipped', 'delivered', 'cancelled'];

const STATUS_RANK = {
  pending: 10,
  scheduled: 20,
  preparing: 30,
  shipped: 40,
  delivered: 50,
  cancelled: 60,
};

const TERMINAL_STATUSES = new Set(['delivered', 'cancelled']);

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  return VALID_DELIVERY_STATUSES.includes(value) ? value : null;
}

function evaluateTransition(fromStatus, toStatus, options = {}) {
  const { allowCancelFromTerminal = false } = options;
  const from = normalizeStatus(fromStatus) || 'pending';
  const to = normalizeStatus(toStatus);

  if (!to) {
    return { ok: false, reason: 'invalid_target_status', from, to: toStatus };
  }

  if (from === to) {
    return { ok: true, from, to };
  }

  if (TERMINAL_STATUSES.has(from)) {
    if (allowCancelFromTerminal && to === 'cancelled') {
      return { ok: true, from, to };
    }
    return { ok: false, reason: 'terminal_status_locked', from, to };
  }

  if (to !== 'cancelled' && (STATUS_RANK[to] || 0) < (STATUS_RANK[from] || 0)) {
    return { ok: false, reason: 'status_rollback_not_allowed', from, to };
  }

  return { ok: true, from, to };
}

module.exports = {
  VALID_DELIVERY_STATUSES,
  evaluateTransition,
};
