const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'cancelled'];
const PAYMENT_STATUS_RANK = {
  pending: 0,
  paid: 1,
  refunded: 2,
  cancelled: 2,
};
const TERMINAL_PAYMENT_STATUSES = new Set(['refunded', 'cancelled']);

function evaluatePaymentTransition(currentStatus, targetStatus) {
  const from = String(currentStatus || 'pending').toLowerCase();
  const to = String(targetStatus || '').toLowerCase();

  if (!VALID_PAYMENT_STATUSES.includes(to)) {
    return { ok: false, reason: 'invalid_target', from, to };
  }

  if (!VALID_PAYMENT_STATUSES.includes(from)) {
    return { ok: false, reason: 'invalid_current', from, to };
  }

  if (from === to) {
    return { ok: true, reason: 'noop', from, to };
  }

  if (TERMINAL_PAYMENT_STATUSES.has(from)) {
    return { ok: false, reason: 'terminal_locked', from, to };
  }

  if (PAYMENT_STATUS_RANK[to] < PAYMENT_STATUS_RANK[from]) {
    return { ok: false, reason: 'rollback_blocked', from, to };
  }

  return { ok: true, reason: 'forward', from, to };
}

module.exports = {
  VALID_PAYMENT_STATUSES,
  PAYMENT_STATUS_RANK,
  TERMINAL_PAYMENT_STATUSES,
  evaluatePaymentTransition,
};
