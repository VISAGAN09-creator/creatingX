const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const shipping = require('../shipping.cjs');

const products = new Map([
  ['tee', { name: 'Current tee', image: 'current.png', price: 499, sizes: { M: 10 } }],
  ['second', { name: 'Second tee', image: 'second.png', price: 699, sizes: { L: 10 } }],
]);
const pending = new Map();
const charged = [];
const db = {
  doc: () => ({ get: async () => ({ exists: false }) }),
  collection: (name) => ({ doc: (id) => ({
    get: async () => ({ exists: name === 'products' && products.has(id), data: () => products.get(id) }),
    set: async (value) => { if (name === 'pendingOrders') pending.set(id, value); },
  }) }),
};
const admin = { apps: [], credential: { cert: () => ({}) }, initializeApp() { this.apps.push({}); }, firestore: () => db };
const gateway = { gatewayName: 'cashfree', createOrder: async ({ amount, currency }) => {
  charged.push(amount);
  return { orderId: `order-${charged.length}`, amount, currency, gatewayData: { order_id: `order-${charged.length}` } };
} };
const originalLoad = Module._load;
const previousKey = process.env.FIREBASE_PRIVATE_KEY;
const previousEmail = process.env.FIREBASE_CLIENT_EMAIL;
const previousProject = process.env.FIREBASE_PROJECT_ID;
process.env.FIREBASE_PRIVATE_KEY = 'test-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.invalid';
process.env.FIREBASE_PROJECT_ID = 'test-project';
Module._load = function (request, parent, isMain) {
  if (request === 'firebase-admin') return admin;
  if (parent?.filename?.endsWith('server.cjs') && request === './gateway/index.cjs') return gateway;
  if (parent?.filename?.endsWith('server.cjs') && request === './shipping.cjs') return { ...shipping, lookupPin: async () => 'Tamil Nadu' };
  return originalLoad.call(this, request, parent, isMain);
};
const { app } = require('../server.cjs');
Module._load = originalLoad;
for (const [key, value] of [['FIREBASE_PRIVATE_KEY', previousKey], ['FIREBASE_CLIENT_EMAIL', previousEmail], ['FIREBASE_PROJECT_ID', previousProject]]) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}

test('checkout quote and payment use current Firestore prices for one and multiple stored cart items', async () => {
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (route, body) => {
      const response = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const first = { id: 'products-tee-M', quantity: 1, size: 'M', price: 499 };
    products.get('tee').price = 599;
    const quote = await post('/api/checkout-quote', { items: [first] });
    assert.equal(quote.status, 200);
    assert.equal(quote.body.items[0].price, 599);
    assert.equal(quote.body.subtotal, 599);

    const customer = { name: 'Test Buyer', email: 'buyer@example.invalid', phone: '9876543210' };
    const address = { country: 'IN', doorNo: '1', addressLine1: 'Main Road', city: 'Chennai', state: 'Tamil Nadu', pinCode: '600001' };
    const order = await post('/api/create-order', { items: [first], customer, shipping: address, shippingAmount: 0, totalAmount: 499 });
    assert.equal(order.status, 200);
    assert.equal(charged.at(-1), 659);
    assert.equal(pending.get('order-1').subtotalAmount, 599);
    assert.equal(pending.get('order-1').totalAmount, 659);

    products.get('second').price = 799;
    const second = { id: 'products-second-L', quantity: 2, size: 'L', price: 699 };
    const multipleQuote = await post('/api/checkout-quote', { items: [first, second] });
    assert.equal(multipleQuote.status, 200);
    assert.deepEqual(multipleQuote.body.items.map((item) => item.price), [599, 799]);
    assert.equal(multipleQuote.body.subtotal, 2197);
    const multipleOrder = await post('/api/create-order', { items: [first, second], customer, shipping: address, totalAmount: 1897 });
    assert.equal(multipleOrder.status, 200);
    assert.equal(charged.at(-1), 2257);

    const invalidVariant = await post('/api/checkout-quote', { items: [{ ...first, size: 'XL' }] });
    assert.equal(invalidVariant.status, 409);
    products.delete('second');
    const deletedProduct = await post('/api/checkout-quote', { items: [second] });
    assert.equal(deletedProduct.status, 404);
    assert.equal(charged.length, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
