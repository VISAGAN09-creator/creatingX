const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateCheckoutPricing } = require('../server.cjs');

test('charges a ₹1.00 server-resolved item as ₹1.00 with free shipping', () => {
  assert.deepEqual(calculateCheckoutPricing([{ lineTotal: 1 }]), {
    subtotalAmount: 1,
    taxAmount: 0,
    shippingAmount: 0,
    totalAmount: 1,
  });
});

test('totals multiple authoritative line items without adding tax', () => {
  assert.deepEqual(calculateCheckoutPricing([{ lineTotal: 2.02 }, { lineTotal: 7.65 }]), {
    subtotalAmount: 9.67,
    taxAmount: 0,
    shippingAmount: 0,
    totalAmount: 9.67,
  });
});

test('adds an explicit shipping charge once and rounds decimal totals to paise', () => {
  assert.deepEqual(calculateCheckoutPricing([{ lineTotal: 0.1 }, { lineTotal: 0.2 }, { lineTotal: 0.3 }], 49.5), {
    subtotalAmount: 0.6,
    taxAmount: 0,
    shippingAmount: 49.5,
    totalAmount: 50.1,
  });
});

test('does not accept a client-claimed total in place of resolved line totals', () => {
  const untrustedRequest = { totalAmount: 1.18 };
  const pricing = calculateCheckoutPricing([{ lineTotal: 1 }]);

  assert.equal(pricing.totalAmount, 1);
  assert.notEqual(pricing.totalAmount, untrustedRequest.totalAmount);
});
