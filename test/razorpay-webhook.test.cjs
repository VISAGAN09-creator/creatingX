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
