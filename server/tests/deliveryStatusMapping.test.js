const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDeliveryStatus } = require('../config/deliveryStatusMapping');

test('should normalize sf_city provider alias to sf rules', () => {
  const result = resolveDeliveryStatus({
    provider: 'sf_city',
    status_code: 400,
  });

  assert.equal(result.status, 'shipped');
  assert.equal(result.matchedBy, 'provider_code');
  assert.equal(result.provider, 'sf');
});

test('should map default text when provider rule is absent', () => {
  const result = resolveDeliveryStatus({
    provider: 'unknown_vendor',
    status: 'delivered',
  });

  assert.equal(result.status, 'delivered');
  assert.equal(result.matchedBy, 'default_text');
});

