const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateCheckoutPricing, coupleStockAdapters, orderConfirmationMessage, paidOrderItem, pendingOrderItem, sendOrderConfirmationEmail, walkInCustomer, walkInOrderId, walkInPayment } = require('../server.cjs');

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

test('omits inapplicable optional size fields from a standard pending order item', () => {
  const item = pendingOrderItem({
    productId: 'tees-standard-M',
    firestoreDocId: 'standard',
    collectionName: 'tees',
    couple: false,
    selectedSize: 'M',
    selectedMensSize: undefined,
    selectedWomensSize: undefined,
    selectedColor: undefined,
    name: 'Standard tee',
    price: 499,
    quantity: 1,
    lineTotal: 499,
    image: '',
  });

  assert.deepEqual(item, {
    productId: 'tees-standard-M',
    firestoreDocId: 'standard',
    collectionName: 'tees',
    couple: false,
    selectedSize: 'M',
    name: 'Standard tee',
    price: 499,
    quantity: 1,
    lineTotal: 499,
    image: '',
  });
});

test('persists both couple sizes without mixing them between order items', () => {
  const items = [
    paidOrderItem({ productId: 'tees-couple-a', name: 'Couple A', couple: true, selectedMensSize: 'M', selectedWomensSize: 'S', price: 999, quantity: 1, image: '' }),
    paidOrderItem({ productId: 'tees-couple-b', name: 'Couple B', couple: true, selectedMensSize: 'XL', selectedWomensSize: 'L', price: 999, quantity: 2, image: '' }),
  ];

  assert.deepEqual(items.map(({ mensSize, womensSize }) => ({ mensSize, womensSize })), [
    { mensSize: 'M', womensSize: 'S' },
    { mensSize: 'XL', womensSize: 'L' },
  ]);
});

test('does not emit undefined optional fields in paid standard-product order items', () => {
  const item = paidOrderItem({ productId: 'tees-standard-M', name: 'Standard tee', selectedSize: 'M', price: 499, quantity: 1, image: '' });

  assert.deepEqual(item, {
    id: 'tees-standard-M',
    name: 'Standard tee',
    size: 'M',
    price: 499,
    quantity: 1,
    image: '',
  });
  assert.equal(Object.values(item).some((value) => value === undefined), false);
});

test('validates walk-in customer and payment details without trusting client totals', () => {
  assert.equal(walkInCustomer({ name: 'Walk In', email: 'customer@example.com', phone: '9876543210' }).valid, true);
    assert.equal(walkInCustomer({ name: 'Walk In' }).valid, true);
  assert.equal(walkInCustomer({ name: 'Walk In', email: 'customer@example.com', phone: '123' }).valid, false);
    assert.equal(walkInPayment({ method: 'cash', received: false }).valid, false);
  assert.deepEqual(walkInPayment({ method: 'other', otherMethod: 'UPI', received: true }), { valid: true, method: 'other', otherMethod: 'UPI', status: 'paid' });
  assert.equal(walkInPayment({ method: 'other', received: true }).valid, false);
});

test('walk-in request IDs are deterministic for safe retry idempotency', () => {
  const first = walkInOrderId('request-123456789012');
  assert.equal(first, walkInOrderId('request-123456789012'));
  assert.notEqual(first, walkInOrderId('request-123456789013'));
  assert.match(first, /^walkin-[a-f0-9]{32}$/);
});

test('couple stock adapters preserve separate maps and legacy shared stock', () => {
  const independent = coupleStockAdapters({ mensSizes: { M: 2 }, womensSizes: { S: 3 } });
  assert.equal(independent.mens.quantities.M, 2);
  assert.equal(independent.womens.quantities.S, 3);
  assert.equal(independent.legacy, null);

  const legacy = coupleStockAdapters({ sizes: { M: 2 } });
  assert.equal(legacy.legacy.quantities.M, 2);
});

test('builds a confirmation email from persisted paid-order data', () => {
  const message = orderConfirmationMessage('order_123', {
    customer: { firstName: 'Asha' },
    items: [{ id: 'tees-black-M', name: 'Black Tee', quantity: 2, price: 499, image: 'https://example.com/tee.jpg' }],
    pricing: { total: 998 },
  }, 'https://example.com/logo.png');
  assert.match(message.subject, /order_123/);
  assert.match(message.html, /Black Tee/);
  assert.match(message.html, /tees-black-M/);
  assert.match(message.html, /https:\/\/example.com\/tee.jpg/);
  assert.match(message.html, /https:\/\/example.com\/logo.png/);
  assert.match(message.html, /handle2227@gmail\.com/);
  assert.match(message.html, /7 Days to dispatch/);
  assert.match(message.html, /varataaah@gmail.com/);
  assert.match(message.text, /handle2227@gmail\.com/);
  assert.match(message.text, /varataaah@gmail\.com/);
  assert.match(message.text, /₹998\.00/);
});

test('renders safely when optional order fields or images are malformed', () => {
  const message = orderConfirmationMessage('order_malformed', {
    customer: null,
    items: [null, { id: 'no-image', name: 'No image', image: 'not-a-url', quantity: 'bad', price: 'bad' }],
    pricing: { total: 'bad' },
  });
  assert.match(message.html, /Product ID unavailable/);
  assert.match(message.html, /No image/);
  assert.doesNotMatch(message.html, /<img/);
});

function fakeOrderDb(order) {
  const state = { ...order };
  const ref = {
    update: async (patch) => Object.assign(state, patch),
  };
  return {
    state,
    collection: () => ({ doc: () => ref }),
    runTransaction: async (callback) => callback({
      get: async () => ({ exists: true, data: () => ({ ...state }) }),
      update: (_ref, patch) => Object.assign(state, patch),
    }),
  };
}

test('claims confirmation delivery once and uses the persisted order snapshot', async () => {
  const db = fakeOrderDb({
    customer: { email: 'persisted@example.com', firstName: 'Persisted' },
    items: [{ id: 'persisted-id', name: 'Persisted product', quantity: 1, price: 250 }],
    pricing: { total: 250 },
  });
  const sent = [];
  const transporter = { sendMail: async (mail) => { sent.push(mail); return { messageId: 'mock-1' }; } };

  const results = await Promise.all([
    sendOrderConfirmationEmail('order_claim', { customer: { email: 'stale@example.com' } }, { db, transporter }),
    sendOrderConfirmationEmail('order_claim', { customer: { email: 'stale@example.com' } }, { db, transporter }),
  ]);

  assert.deepEqual(results.map(({ status }) => status).sort(), ['sent', 'skipped']);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'persisted@example.com');
  assert.match(sent[0].html, /persisted-id/);
  assert.equal(db.state.emailDelivery.status, 'sent');
});

test('records SMTP failures without retrying a failed claim automatically', async () => {
  const db = fakeOrderDb({
    customer: { email: 'customer@example.com' },
    items: [],
    pricing: { total: 0 },
  });
  const failingTransport = { sendMail: async () => { throw new Error('mock SMTP failure'); } };
  const successfulTransport = { sendMail: async () => ({ messageId: 'should-not-send' }) };

  const failed = await sendOrderConfirmationEmail('order_failure', null, { db, transporter: failingTransport });
  const retry = await sendOrderConfirmationEmail('order_failure', null, { db, transporter: successfulTransport });

  assert.equal(failed.status, 'failed');
  assert.equal(retry.status, 'skipped');
  assert.equal(db.state.emailDelivery.status, 'failed');
});

test('does not reclaim sending, sent, failed, or skipped delivery states', async () => {
  for (const status of ['sending', 'sent', 'failed', 'skipped']) {
    const db = fakeOrderDb({ customer: { email: 'customer@example.com' }, emailDelivery: { status } });
    let sends = 0;
    const result = await sendOrderConfirmationEmail('order_' + status, null, {
      db,
      transporter: { sendMail: async () => { sends += 1; return { messageId: 'unexpected' }; } },
    });
    assert.equal(result.status, 'skipped');
    assert.equal(sends, 0);
  }
});
