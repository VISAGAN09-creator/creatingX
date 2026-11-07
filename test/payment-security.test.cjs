const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const os = require('node:os');
const test = require('node:test');

// dotenv.config() reads the process working directory. Keep these mock-only
// tests away from the developer's root .env and real payment/email credentials.
const originalCwd = process.cwd();
process.chdir(os.tmpdir());
const { createRazorpayPaidOrder, verifyRazorpayPaymentRequest, handleRazorpayWebhookRequest } = require('../server.cjs');
process.chdir(originalCwd);

function fakeDatabase() {
  const documents = new Map();
  let transactionQueue = Promise.resolve();
  const snapshot = (ref) => ({
    exists: documents.has(ref.path),
    data: () => structuredClone(documents.get(ref.path)),
    ref,
  });
  const reference = (collection, id) => ({
    id,
    path: `${collection}/${id}`,
    get() { return Promise.resolve(snapshot(this)); },
    set(value, options) {
      documents.set(this.path, options?.merge
        ? { ...(documents.get(this.path) || {}), ...structuredClone(value) }
        : structuredClone(value));
      return Promise.resolve();
    },
    update(value) {
      documents.set(this.path, { ...(documents.get(this.path) || {}), ...structuredClone(value) });
      return Promise.resolve();
    },
    delete() { documents.delete(this.path); return Promise.resolve(); },
  });
  return {
    collection: (name) => ({ doc: (id) => reference(name, id) }),
    seed: (collection, id, value) => documents.set(`${collection}/${id}`, structuredClone(value)),
    read: (collection, id) => documents.get(`${collection}/${id}`),
    count: (collection) => [...documents.keys()].filter((key) => key.startsWith(`${collection}/`)).length,
    runTransaction(callback) {
      const run = transactionQueue.then(async () => {
        const writes = [];
        const transaction = {
          get: async (ref) => snapshot(ref),
          set: (ref, value, options) => writes.push(() => {
            documents.set(ref.path, options?.merge
              ? { ...(documents.get(ref.path) || {}), ...structuredClone(value) }
              : structuredClone(value));
          }),
          update: (ref, value) => writes.push(() => {
            documents.set(ref.path, { ...(documents.get(ref.path) || {}), ...structuredClone(value) });
          }),
          create: (ref, value) => writes.push(() => {
            if (documents.has(ref.path)) throw new Error('Document already exists.');
            documents.set(ref.path, structuredClone(value));
          }),
        };
        const result = await callback(transaction);
        writes.forEach((write) => write());
        return result;
      });
      transactionQueue = run.catch(() => {});
      return run;
    },
  };
}

function pendingOrder(orderId) {
  return {
    razorpayOrderId: orderId,
    items: [{
      productId: 'products-tee-M', firestoreDocId: 'tee', collectionName: 'products',
      selectedSize: 'M', name: 'Dummy tee', price: 100, quantity: 1, lineTotal: 100, image: '',
    }],
    totalAmount: 100, taxAmount: 0, shippingAmount: 0,
    customer: { name: 'Dummy Customer', email: 'dummy@example.invalid', phone: '9999999999' },
    shipping: { country: 'IN', state: 'Delhi', pinCode: '110001', addressLine1: 'Dummy address' },
    status: 'pending',
  };
}

function capturedPayment(orderId) {
  return {
    verified: true, gatewayOrderId: orderId, gatewayPaymentId: `pay_${orderId}`,
    orderAmount: 100, orderCurrency: 'INR', paymentStatus: 'captured',
  };
}

function response() {
  return {
    code: 200,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function capturedWebhook(orderId, eventId = `evt_${orderId}`, validSignature = true, eventType = 'payment.captured') {
  const body = Buffer.from(JSON.stringify({
    event: eventType,
    payload: { payment: { entity: { id: `pay_${orderId}`, order_id: orderId } } },
  }));
  const signature = crypto.createHmac('sha256', 'dummy_webhook_secret').update(body).digest('hex');
  return {
    body,
    get: (header) => header === 'x-razorpay-signature'
      ? (validSignature ? signature : 'invalid')
      : header === 'x-razorpay-event-id' ? eventId : undefined,
  };
}

function webhookGateway() {
  return {
    verifyWebhookSignature: (body, signature) => {
      if (!Buffer.isBuffer(body) || typeof signature !== 'string') return false;
      const expected = crypto.createHmac('sha256', 'dummy_webhook_secret').update(body).digest('hex');
      return signature.length === expected.length
        && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
    verifyWebhookPayment: async ({ orderId }) => capturedPayment(orderId),
  };
}

test('two captured checkouts for the last item create one order and retain a paid review record', async () => {
  const database = fakeDatabase();
  database.seed('products', 'tee', { name: 'Dummy tee', sizes: { M: 1 } });
  database.seed('pendingOrders', 'order_a', pendingOrder('order_a'));
  database.seed('pendingOrders', 'order_b', pendingOrder('order_b'));
  const sent = [];
  const dependencies = { database, sendConfirmation: async (orderId) => { sent.push(orderId); } };

  const outcomes = await Promise.allSettled([
    createRazorpayPaidOrder('order_a', capturedPayment('order_a'), 'webhook', dependencies),
    createRazorpayPaidOrder('order_b', capturedPayment('order_b'), 'webhook', dependencies),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === 'rejected').reason.code, 'captured-inventory-conflict');
  assert.equal(database.count('orders'), 1);
  assert.equal(database.count('orders_production'), 1);
  assert.equal(database.read('products', 'tee').sizes.M, 0);
  assert.deepEqual(sent, ['order_a']);

  const review = database.read('pendingOrders', 'order_b');
  assert.equal(review.status, 'captured_inventory_conflict');
  assert.equal(review.paymentStatus, 'captured');
  assert.equal(review.customer.email, 'dummy@example.invalid');
  assert.equal(review.totalAmount, 100);
  assert.deepEqual(review.capturedPaymentIds, ['pay_order_b']);
  assert.equal(review.paymentException.razorpayOrderId, 'order_b');
  assert.equal(database.read('orders', 'order_b'), undefined);

  await assert.rejects(
    createRazorpayPaidOrder('order_b', capturedPayment('order_b'), 'webhook', dependencies),
    { code: 'captured-inventory-conflict' },
  );
  assert.deepEqual(database.read('pendingOrders', 'order_b').capturedPaymentIds, ['pay_order_b']);
  assert.equal(database.read('products', 'tee').sizes.M, 0);
  assert.deepEqual(sent, ['order_a']);
});

test('a known paid order ID alone or a mismatched callback never discloses customer details', async () => {
  const database = fakeDatabase();
  database.seed('orders', 'order_paid', {
    status: 'paid', pricing: { total: 100 },
    customer: { email: 'private@example.invalid' }, items: [{ name: 'Dummy tee' }],
    payment: { gateway: 'razorpay', razorpayOrderId: 'order_paid', razorpayPaymentId: 'pay_paid' },
  });
  const paymentGateway = {
    verifyPayment: async ({ orderId, paymentData }) => ({
      verified: paymentData.razorpay_signature === 'valid',
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentData.razorpay_payment_id,
      orderAmount: 100, orderCurrency: 'INR', paymentStatus: 'captured',
    }),
  };

  const idOnly = response();
  await verifyRazorpayPaymentRequest({ body: { orderId: 'order_paid' } }, idOnly, { database, paymentGateway });
  assert.equal(idOnly.code, 400);
  assert.doesNotMatch(JSON.stringify(idOnly.body), /private@example\.invalid/);

  for (const payment of [
    { razorpay_signature: 'invalid', razorpay_payment_id: 'pay_paid' },
    { razorpay_signature: 'valid', razorpay_payment_id: 'pay_other' },
  ]) {
    const rejected = response();
    await verifyRazorpayPaymentRequest({ body: { orderId: 'order_paid', payment } }, rejected, { database, paymentGateway });
    assert.equal(rejected.code, 401);
    assert.doesNotMatch(JSON.stringify(rejected.body), /private@example\.invalid/);
  }

  const verified = response();
  await verifyRazorpayPaymentRequest({ body: { orderId: 'order_paid', payment: { razorpay_signature: 'valid', razorpay_payment_id: 'pay_paid' } } }, verified, { database, paymentGateway });
  assert.equal(verified.code, 200);
  assert.equal(verified.body.order.customer.email, 'private@example.invalid');
  assert.equal(database.count('orders'), 1);
});

test('an additional captured payment cannot claim another payment\'s existing order', async () => {
  const database = fakeDatabase();
  database.seed('orders', 'order_paid', {
    status: 'paid', pricing: { total: 100 },
    customer: { email: 'private@example.invalid' },
    payment: { gateway: 'razorpay', razorpayOrderId: 'order_paid', razorpayPaymentId: 'pay_original' },
  });
  database.seed('pendingOrders', 'order_paid', pendingOrder('order_paid'));
  await assert.rejects(
    createRazorpayPaidOrder('order_paid', capturedPayment('order_paid'), 'checkout', { database }),
    { statusCode: 409 },
  );
  assert.equal(database.read('orders', 'order_paid').payment.razorpayPaymentId, 'pay_original');
});

test('concurrent different payments for one order cannot claim the same paid result', async () => {
  const database = fakeDatabase();
  database.seed('products', 'tee', { name: 'Dummy tee', sizes: { M: 1 } });
  database.seed('pendingOrders', 'order_same', pendingOrder('order_same'));
  const sent = [];
  const dependencies = { database, sendConfirmation: async (id) => { sent.push(id); } };
  const outcomes = await Promise.allSettled([
    createRazorpayPaidOrder('order_same', capturedPayment('order_same'), 'checkout', dependencies),
    createRazorpayPaidOrder('order_same', { ...capturedPayment('order_same'), gatewayPaymentId: 'pay_other' }, 'checkout', dependencies),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === 'rejected').reason.statusCode, 409);
  assert.equal(database.count('orders'), 1);
  assert.equal(database.read('products', 'tee').sizes.M, 0);
  assert.deepEqual(sent, ['order_same']);
});

test('an unverified payment never creates a paid order', async () => {
  const database = fakeDatabase();
  database.seed('pendingOrders', 'order_pending', pendingOrder('order_pending'));
  const rejected = response();
  await verifyRazorpayPaymentRequest(
    { body: { orderId: 'order_pending', payment: { razorpay_signature: 'invalid' } } },
    rejected,
    { database, paymentGateway: { verifyPayment: async () => ({ verified: false, paymentStatus: 'signature_invalid' }) } },
  );
  assert.equal(rejected.code, 200);
  assert.equal(rejected.body.success, false);
  assert.equal(database.count('orders'), 0);
});

test('captured stock exception reports review without suggesting another payment', async () => {
  const database = fakeDatabase();
  database.seed('pendingOrders', 'order_review', {
    ...pendingOrder('order_review'),
    status: 'captured_inventory_conflict',
    paymentException: { reason: 'inventory-insufficient', razorpayPaymentId: 'pay_order_review' },
  });
  const res = response();
  await verifyRazorpayPaymentRequest(
    { body: { orderId: 'order_review', payment: { razorpay_signature: 'valid' } } }, res,
    { database, paymentGateway: { verifyPayment: async () => capturedPayment('order_review') } },
  );
  assert.equal(res.code, 409);
  assert.equal(res.body.paymentStatus, 'captured');
  assert.equal(res.body.orderStatus, 'requires_review');
  assert.match(res.body.message, /Do not pay again/);
  assert.equal(database.count('orders'), 0);

  const unverified = response();
  await verifyRazorpayPaymentRequest(
    { body: { orderId: 'order_review', payment: { razorpay_signature: 'invalid' } } }, unverified,
    { database, paymentGateway: { verifyPayment: async () => ({ verified: false, paymentStatus: 'failed' }) } },
  );
  assert.equal(unverified.code, 200);
  assert.equal(database.read('pendingOrders', 'order_review').paymentStatus, 'captured');
});

test('captured webhook rejects invalid signature before any mutation', async () => {
  const database = fakeDatabase();
  database.seed('pendingOrders', 'order_invalid', pendingOrder('order_invalid'));
  const res = response();
  await handleRazorpayWebhookRequest(capturedWebhook('order_invalid', 'evt_invalid', false), res, {
    database, paymentGateway: webhookGateway(),
  });
  assert.equal(res.code, 401);
  assert.equal(database.count('paymentWebhookEvents'), 0);
  assert.equal(database.count('orders'), 0);
  assert.equal(database.read('pendingOrders', 'order_invalid').status, 'pending');
});

test('captured webhook finalizes once and duplicate delivery does not repeat stock or email', async () => {
  const database = fakeDatabase();
  database.seed('products', 'tee', { name: 'Dummy tee', sizes: { M: 1 } });
  database.seed('pendingOrders', 'order_webhook', pendingOrder('order_webhook'));
  const sent = [];
  const dependencies = {
    database,
    paymentGateway: webhookGateway(),
    finalize: (orderId, verification, source) => createRazorpayPaidOrder(orderId, verification, source, {
      database, sendConfirmation: async (id) => { sent.push(id); },
    }),
  };
  const request = capturedWebhook('order_webhook');
  const first = response();
  await handleRazorpayWebhookRequest(request, first, dependencies);
  assert.equal(first.code, 200);
  assert.equal(database.read('orders', 'order_webhook').status, 'paid');
  assert.equal(database.read('products', 'tee').sizes.M, 0);
  assert.deepEqual(sent, ['order_webhook']);

  const browserReturn = response();
  await verifyRazorpayPaymentRequest(
    { body: { orderId: 'order_webhook', payment: { razorpay_signature: 'valid', razorpay_payment_id: 'pay_order_webhook' } } },
    browserReturn,
    { database, paymentGateway: { verifyPayment: async () => capturedPayment('order_webhook') } },
  );
  assert.equal(browserReturn.code, 200);
  assert.equal(browserReturn.body.paymentStatus, 'paid');
  assert.equal(browserReturn.body.order.customer.email, 'dummy@example.invalid');
  assert.deepEqual(sent, ['order_webhook']);

  const lateFailure = response();
  await handleRazorpayWebhookRequest(capturedWebhook('order_webhook', 'evt_late_failure_paid', true, 'payment.failed'), lateFailure, dependencies);
  assert.equal(lateFailure.code, 200);
  assert.equal(database.read('pendingOrders', 'order_webhook'), undefined);
  assert.equal(database.read('orders', 'order_webhook').status, 'paid');

  const duplicate = response();
  await handleRazorpayWebhookRequest(request, duplicate, dependencies);
  assert.equal(duplicate.code, 200);
  assert.match(duplicate.body.message, /Already processed/);
  assert.equal(database.count('orders'), 1);
  assert.equal(database.read('products', 'tee').sizes.M, 0);
  assert.deepEqual(sent, ['order_webhook']);
});

test('captured webhook records depleted stock for manual review and acknowledges repeats', async () => {
  const database = fakeDatabase();
  database.seed('products', 'tee', { name: 'Dummy tee', sizes: { M: 0 } });
  database.seed('pendingOrders', 'order_depleted', pendingOrder('order_depleted'));
  let sends = 0;
  const dependencies = {
    database,
    paymentGateway: webhookGateway(),
    finalize: (orderId, verification, source) => createRazorpayPaidOrder(orderId, verification, source, {
      database, sendConfirmation: async () => { sends += 1; },
    }),
  };
  const request = capturedWebhook('order_depleted');
  const first = response();
  await handleRazorpayWebhookRequest(request, first, dependencies);
  assert.equal(first.code, 200);
  assert.match(first.body.message, /manual review/);
  assert.equal(database.read('pendingOrders', 'order_depleted').paymentStatus, 'captured');
  assert.equal(database.count('orders'), 0);
  assert.equal(sends, 0);

  const duplicate = response();
  await handleRazorpayWebhookRequest(request, duplicate, dependencies);
  assert.equal(duplicate.code, 200);
  assert.match(duplicate.body.message, /Already processed/);
  assert.equal(database.count('orders'), 0);
  assert.equal(sends, 0);

  const delayedFailure = response();
  await handleRazorpayWebhookRequest(capturedWebhook('order_depleted', 'evt_late_failure', true, 'payment.failed'), delayedFailure, dependencies);
  assert.equal(delayedFailure.code, 200);
  assert.equal(database.read('pendingOrders', 'order_depleted').status, 'captured_inventory_conflict');
  assert.equal(database.read('pendingOrders', 'order_depleted').paymentStatus, 'captured');
});

test('captured webhook with 200 paise cannot finalize a persisted 6100 paise checkout', async () => {
  const database = fakeDatabase();
  const pending = pendingOrder('order_amount');
  pending.items[0].price = 1;
  pending.items[0].lineTotal = 1;
  pending.totalAmount = 61;
  pending.shippingAmount = 60;
  database.seed('pendingOrders', 'order_amount', pending);
  database.seed('products', 'tee', { sizes: { M: 1 } });
  const res = response();
  const paymentGateway = webhookGateway();
  paymentGateway.verifyWebhookPayment = async () => ({ ...capturedPayment('order_amount'), orderAmount: 2 });
  await handleRazorpayWebhookRequest(capturedWebhook('order_amount'), res, {
    database, paymentGateway,
    finalize: (id, verification, source) => createRazorpayPaidOrder(id, verification, source, {
      database, sendConfirmation: async () => assert.fail('Unverified amount must not email'),
    }),
  });
  assert.equal(res.code, 500);
  assert.equal(database.count('orders'), 0);
  assert.equal(database.read('products', 'tee').sizes.M, 1);
});

test('failed webhook still marks a pending payment as failed', async () => {
  const database = fakeDatabase();
  database.seed('pendingOrders', 'order_failed', pendingOrder('order_failed'));
  const res = response();
  await handleRazorpayWebhookRequest(capturedWebhook('order_failed', 'evt_failure', true, 'payment.failed'), res, {
    database, paymentGateway: webhookGateway(),
  });
  assert.equal(res.code, 200);
  assert.equal(database.read('pendingOrders', 'order_failed').paymentStatus, 'failed');
  assert.equal(database.count('orders'), 0);
});
