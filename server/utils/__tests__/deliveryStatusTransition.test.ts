import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { evaluateTransition, VALID_DELIVERY_STATUSES } = require('../deliveryStatusTransition');

describe('deliveryStatusTransition', () => {
  it('should expose expected status list', () => {
    expect(VALID_DELIVERY_STATUSES).toEqual([
      'pending',
      'scheduled',
      'preparing',
      'shipped',
      'delivered',
      'cancelled',
    ]);
  });

  it('should allow forward transition from pending to preparing', () => {
    const result = evaluateTransition('pending', 'preparing');
    expect(result).toEqual({ ok: true, from: 'pending', to: 'preparing' });
  });

  it('should allow cancellation from non-terminal status', () => {
    const result = evaluateTransition('shipped', 'cancelled');
    expect(result).toEqual({ ok: true, from: 'shipped', to: 'cancelled' });
  });

  it('should block rollback transition', () => {
    const result = evaluateTransition('shipped', 'scheduled');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('status_rollback_not_allowed');
    expect(result.from).toBe('shipped');
    expect(result.to).toBe('scheduled');
  });

  it('should block transition from terminal status to another status', () => {
    const result = evaluateTransition('delivered', 'shipped');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('terminal_status_locked');
    expect(result.from).toBe('delivered');
    expect(result.to).toBe('shipped');
  });

  it('should allow staying in the same terminal status', () => {
    const result = evaluateTransition('cancelled', 'cancelled');
    expect(result).toEqual({ ok: true, from: 'cancelled', to: 'cancelled' });
  });

  it('should return invalid_target_status for unknown target', () => {
    const result = evaluateTransition('pending', 'unknown');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_target_status');
    expect(result.from).toBe('pending');
    expect(result.to).toBe('unknown');
  });

  it('should default unknown source status to pending', () => {
    const result = evaluateTransition('foo', 'scheduled');
    expect(result).toEqual({ ok: true, from: 'pending', to: 'scheduled' });
  });
});
