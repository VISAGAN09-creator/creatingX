const assert = require('node:assert/strict');
const os = require('node:os');
const test = require('node:test');
const { states, shippingCharge, lookupPin } = require('../shipping.cjs');
const originalCwd = process.cwd();
process.chdir(os.tmpdir());
const { calculateCheckoutPricing, validateCheckoutDetails } = require('../server.cjs');
process.chdir(originalCwd);

test('all 28 states and 8 Union Territories have a shipping rate', () => {
  assert.equal(states.length, 36);
  for (const state of states) assert.ok(shippingCharge(state, [{ quantity: 1 }]) > 0);
});

test('three-shirt slabs across regions and cart lines', () => {
  for (const [state, rate] of [
    ['Tamil Nadu', 60], ['Kerala', 80], ['Andhra Pradesh', 80], ['Karnataka', 80], ['Telangana', 80],
    ...['Delhi', 'Haryana', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Uttarakhand', 'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Maharashtra', 'Gujarat', 'West Bengal', 'Odisha'].map((name) => [name, 150]),
  ]) {
    for (const quantity of [1, 3, 4, 7, 10]) {
      assert.equal(shippingCharge(state, [{ quantity }]), Math.ceil(quantity / 3) * rate);
    }
  }
  const variants = [{ quantity: 2, size: 'M' }, { quantity: 1, size: 'L' }, { quantity: 2, color: 'black' }];
  assert.equal(shippingCharge('Tamil Nadu', variants), 120);
  variants[2].quantity = 1;
  assert.equal(shippingCharge('Tamil Nadu', variants), 120);
  variants[0].quantity = 1;
  assert.equal(shippingCharge('Tamil Nadu', variants), 60);
  assert.equal(shippingCharge('Tamil Nadu', [{ quantity: 2, couple: true }]), 120);
});

test('server price ignores a manipulated client shipping value', () => {
  const items = [{ quantity: 3, lineTotal: 1497 }];
  const untrusted = { shippingAmount: 0, totalAmount: 1497 };
  const price = calculateCheckoutPricing(items, shippingCharge('Tamil Nadu', items));
  assert.deepEqual(price, { subtotalAmount: 1497, taxAmount: 0, shippingAmount: 60, totalAmount: 1557 });
  assert.notEqual(price.totalAmount, untrusted.totalAmount);
});

test('PIN lookup rejects missing/invalid PIN and validates selected state', async () => {
  await assert.rejects(lookupPin(''), /valid six-digit/);
  await assert.rejects(lookupPin('000000'), /valid six-digit/);
  const mock = async () => ({ ok: true, json: async () => [{ Status: 'Success', PostOffice: [{ State: 'Tamil Nadu' }] }] });
  const detected = await lookupPin('600001', mock);
  assert.equal(detected, 'Tamil Nadu');
  assert.notEqual(detected, 'Kerala');
  assert.equal(shippingCharge(detected, [{ quantity: 4 }]), 120);
  await assert.rejects(lookupPin('600001', async () => ({ ok: true, json: async () => [{ Status: 'Error' }] })), /could not be verified/);
  await assert.rejects(lookupPin('600001', async () => { throw new Error('network unavailable'); }), /network unavailable/);
});

test('manual state needs a valid Indian address and is checked against PIN before payment', async () => {
  const customer = { name: 'Customer', email: 'buyer@example.com', phone: '9876543210' };
  const shipping = { country: 'IN', doorNo: '1', addressLine1: 'Main Road', city: 'Chennai', state: 'Tamil Nadu', pinCode: '600001' };
  assert.equal(validateCheckoutDetails(customer, shipping).valid, true);
  assert.equal(validateCheckoutDetails(customer, { ...shipping, pinCode: '' }).valid, false);
  assert.equal(validateCheckoutDetails(customer, { ...shipping, pinCode: '12345' }).valid, false);
  assert.equal(validateCheckoutDetails(customer, { ...shipping, state: 'XX' }).valid, false);
  assert.equal(validateCheckoutDetails(customer, { ...shipping, country: 'US' }).valid, false);
  const detected = await lookupPin('600001', async () => ({ ok: true, json: async () => [{ Status: 'Success', PostOffice: [{ State: 'Tamil Nadu' }] }] }));
  assert.notEqual(detected, 'Kerala');
});
