const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const ts = require('typescript');
process.env.RAZORPAY_KEY_ID = 'rzp_test_mock';
process.env.RAZORPAY_KEY_SECRET = 'mock_secret';
const cwd = process.cwd();
process.chdir(os.tmpdir());
const { createPaymentOrderRequest, resolveCheckoutItems } = require('../server.cjs');
process.chdir(cwd);
const gateway = require('../gateway/razorpay.cjs');
const requests = [];
let returnedAmount;
global.fetch = async (url, options) => {
  assert.equal(url, 'https://api.razorpay.com/v1/orders');
  const body = JSON.parse(options.body);
  requests.push(body);
  return { ok: true, json: async () => ({ id: 'order_mock', currency: 'INR', amount: returnedAmount ?? body.amount }) };
};
const orderFetch = global.fetch;

async function checkout({ price = 1, quantity = 1, state = 'Tamil Nadu', extra = {}, product = {}, mismatch = false } = {}) {
  requests.length = 0;
  returnedAmount = mismatch ? 200 : undefined;
  const stored = [];
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await createPaymentOrderRequest({ body: {
    items: [{ id: 'others-667-XXL', quantity, size: 'XXL', price: 0.01 }],
    customer: { name: 'Dummy', email: 'dummy@example.invalid', phone: '9999999999' },
    shipping: { country: 'IN', state, pinCode: '600001', city: 'Dummy', doorNo: '1', addressLine1: 'Dummy' },
    ...extra,
  } }, res, {
    database: { collection: (name) => ({ doc: (id) => ({ set: async (value) => stored.push({ name, id, value }) }) }) },
    paymentGateway: gateway,
    resolveProduct: async () => ({ collectionName: 'Others', docId: '667', selectedSize: 'XXL', data: { name: '667', price, sizes: { XXL: 100 }, ...product } }),
    validateInventory: async (items) => { assert.equal(items.length, 1); assert.equal(items[0].quantity, quantity); },
    lookupPin: async () => state,
  });
  return { res, stored, request: requests[0] };
}

test('₹1 + ₹60 creates exactly 6100 paise and persists one item and the same total', async () => {
  const { res, stored, request } = await checkout();
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.pricing, { subtotalAmount: 1, taxAmount: 0, shippingAmount: 60, totalAmount: 61 });
  assert.equal(request.amount, 6100);
  assert.equal(request.currency, 'INR');
  assert.equal(res.body.gatewayData.amount, 6100);
  assert.equal(res.body.orderId, 'order_mock');
  assert.equal(stored[0].value.items.length, 1);
  assert.equal(stored[0].value.totalAmount, 61);
});

test('prices, quantities, decimal paise and shipping slabs change the real gateway amount', async () => {
  for (const [options, amount] of [
    [{ price: 99.99 }, 15999], [{ quantity: 3 }, 6300], [{ quantity: 4 }, 12400],
    [{ state: 'Kerala' }, 8100], [{ price: 0.29, quantity: 3 }, 6087],
  ]) {
    const { res, request } = await checkout(options);
    assert.equal(res.code, 200);
    assert.equal(request.amount, amount);
  }
});

test('client amount, tax, shipping and unsupported discount/coupon cannot change the charge', async () => {
  const { res, request } = await checkout({ extra: { amount: 2, totalAmount: 2, shippingAmount: 0, taxAmount: -60, discountAmount: 60, coupon: 'FREE' } });
  assert.equal(res.code, 200);
  assert.equal(request.amount, 6100);
  assert.equal(res.body.pricing.taxAmount, 0);
});

test('missing or invalid catalog prices fail before any Razorpay order is created', async () => {
  for (const price of [undefined, null, '', 0, -1, 'bad', 0.001]) {
    const { res, stored, request } = await checkout({ product: { price } });
    assert.equal(res.body.success, false);
    assert.equal(request, undefined);
    assert.equal(stored.length, 0);
  }
});

test('invalid quantities, identifiers and variants are rejected by authoritative resolution', async () => {
  const resolver = async () => ({ data: { price: 1 }, selectedSize: 'XXL' });
  for (const item of [{ id: '', quantity: 1 }, { id: 'p', quantity: 0 }, { id: 'p', quantity: 1.5 }, { id: 'p', quantity: 1, size: 'S' }]) {
    await assert.rejects(resolveCheckoutItems([item], resolver));
  }
});

test('provider returning 200 paise for a 6100 paise order is rejected without saving pending context', async () => {
  const { res, stored } = await checkout({ mismatch: true });
  assert.equal(res.code, 500);
  assert.equal(res.body.success, false);
  assert.equal(stored.length, 0);
});

test('signed callback must match the persisted amount; missing expected amount fails closed', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ id: 'pay_mock', order_id: 'order_mock', status: 'captured', currency: 'INR', amount: 200 }) });
  try {
    const paymentData = { razorpay_order_id: 'order_mock', razorpay_payment_id: 'pay_mock', razorpay_signature: crypto.createHmac('sha256', 'mock_secret').update('order_mock|pay_mock').digest('hex') };
    for (const totalAmount of [61, undefined]) {
      assert.equal((await gateway.verifyPayment({ orderId: 'order_mock', paymentData, orderDetails: { totalAmount } })).verified, false);
    }
  } finally { global.fetch = orderFetch; }
});

test('frontend opens only the backend order with a matching displayed amount and currency', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/paymentGateway.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', code)(module.exports, module);
  const opened = [];
  global.window = { Razorpay: class { constructor(options) { this.options = options; } on() {} open() { opened.push(this.options); } } };
  const orderData = { orderId: 'order_mock', amount: 61, currency: 'INR', gatewayData: { keyId: 'rzp_test_mock', razorpayOrderId: 'order_mock', amount: 6100 } };
  const context = { name: 'Dummy', email: 'dummy@example.invalid', phone: '', itemCount: 1, expectedAmountPaise: 6100, orderData };
  const errors = [];
  const callbacks = { onSuccess() {}, onDismiss() {}, onError: (error) => errors.push(error) };
  module.exports.openCheckout(context, callbacks);
  assert.equal(opened[0].order_id, 'order_mock');
  assert.equal(opened[0].amount, 6100);
  for (const data of [{ ...orderData, amount: 2 }, { ...orderData, orderId: 'other' }, { ...orderData, currency: 'USD' }, { ...orderData, gatewayData: { ...orderData.gatewayData, amount: 200 } }, { ...orderData, amount: 2, gatewayData: { ...orderData.gatewayData, amount: 200 } }]) {
    module.exports.openCheckout({ ...context, orderData: data }, callbacks);
  }
  assert.equal(opened.length, 1);
  assert.equal(errors.length, 5);
  delete global.window;
});
