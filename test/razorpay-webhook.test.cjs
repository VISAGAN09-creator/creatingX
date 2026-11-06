const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { claimRazorpayEvent } = require('../server.cjs');

test('validates a Razorpay webhook HMAC over the original bytes only', () => {
  const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test"}}}}';
  const secret = 'test_webhook_secret';
  const signature = crypto.createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
  const script = [
    "const gateway = require('./gateway/razorpay.cjs');",
    'const body = Buffer.from(process.argv[1]);',
    'console.log(gateway.verifyWebhookSignature(body, process.argv[2]));',
  ].join('');
  const valid = execFileSync(process.execPath, ['-e', script, body, signature], {
    cwd: process.cwd(),
    env: { ...process.env, RAZORPAY_WEBHOOK_SECRET: secret },
  }).toString().trim();
  const invalid = execFileSync(process.execPath, ['-e', script, body, 'invalid'], {
    cwd: process.cwd(),
    env: { ...process.env, RAZORPAY_WEBHOOK_SECRET: secret },
  }).toString().trim();
  assert.equal(valid, 'true');
  assert.equal(invalid, 'false');
});

test('accepts only captured Razorpay payments for finalisation', () => {
  const script = [
    "const crypto = require('node:crypto');",
    "global.fetch = async () => ({ ok: true, json: async () => ({ id: 'pay_test', order_id: 'order_test', status: process.argv[1], currency: 'INR', amount: 12345 }) });",
    "const gateway = require('./gateway/razorpay.cjs');",
    "const orderId = 'order_test'; const paymentId = 'pay_test';",
    "const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');",
    "gateway.verifyPayment({ orderId, paymentData: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }, orderDetails: { totalAmount: 123.45 } }).then((result) => console.log(JSON.stringify(result)));",
  ].join('');
  const verify = (status) => JSON.parse(execFileSync(process.execPath, ['-e', script, status], {
    cwd: process.cwd(),
    env: {
      RAZORPAY_KEY_ID: 'rzp_test_mock',
      RAZORPAY_KEY_SECRET: 'test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    },
  }).toString());

  assert.equal(verify('captured').verified, true);
  assert.equal(verify('paid').verified, false);
});

function eventDb() {
  const documents = new Map();
  return {
    documents,
    collection: () => ({
      doc: (id) => ({
        id,
        set: async (value, options) => documents.set(id, options?.merge
          ? { ...(documents.get(id) || {}), ...value }
          : value),
      }),
    }),
    runTransaction: (callback) => callback({
      get: async (ref) => ({
        exists: documents.has(ref.id),
        data: () => documents.get(ref.id),
      }),
      set: (ref, value, options) => documents.set(ref.id, options?.merge
        ? { ...(documents.get(ref.id) || {}), ...value }
        : value),
    }),
  };
}

test('claims a webhook event once after it is marked processed', async () => {
  const db = eventDb();
  const first = await claimRazorpayEvent(db, 'evt_test_duplicate', 'payment.captured', 'order_test');
  assert.equal(first.duplicate, false);
  await first.ref.set({ status: 'processed' }, { merge: true });
  const duplicate = await claimRazorpayEvent(db, 'evt_test_duplicate', 'payment.captured', 'order_test');
  assert.equal(duplicate.duplicate, true);
});
