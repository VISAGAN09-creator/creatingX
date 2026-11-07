const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
for (const file of ['server.cjs', 'shipping.cjs', 'shipping-rates.json', 'gateway/index.cjs', 'gateway/razorpay.cjs']) {
  assert.deepEqual(
    fs.readFileSync(path.join(__dirname, file)),
    fs.readFileSync(path.join(root, file)),
    `Functions package is stale: ${file}. Run copy-server before deployment.`,
  );
}

// Load the packaged app without local credentials or external requests.
const originalCwd = process.cwd();
let app;
try {
  process.chdir(os.tmpdir());
  ({ app } = require('./server.cjs'));
} finally {
  process.chdir(originalCwd);
}

for (const route of ['/api/checkout-preview', '/api/create-order', '/api/verify-payment', '/api/razorpay-webhook']) {
  assert.ok(
    app.router.stack.some((layer) => layer.route?.path === route && layer.route.methods.post),
    `Functions package is missing POST ${route}.`,
  );
}
console.log('Functions package matches root source and registers checkout/payment routes.');
