const assert = require('node:assert/strict');
const os = require('node:os');
const test = require('node:test');

const originalCwd = process.cwd();
let app;
try {
  process.chdir(os.tmpdir());
  ({ app } = require('../server.cjs'));
} finally {
  process.chdir(originalCwd);
}

test('checkout preview is a registered POST route before order creation', () => {
  const routes = app.router.stack.filter((layer) => layer.route).map((layer) => layer.route);
  const preview = routes.find((route) => route.path === '/api/checkout-preview');
  const createOrder = routes.find((route) => route.path === '/api/create-order');
  assert.equal(preview?.methods.post, true);
  assert.equal(createOrder?.methods.post, true);
  assert.ok(routes.indexOf(preview) < routes.indexOf(createOrder));
});

test('Firebase deploy copies and verifies the Functions package', () => {
  const config = require('../firebase.json');
  assert.deepEqual(config.functions[0].predeploy, [
    'npm --prefix functions run copy-server',
    'npm --prefix functions run verify-package',
  ]);
  assert.deepEqual(config.hosting.rewrites.slice(0, 2).map(({ source, function: name }) => [source, name]), [
    ['/varataaa/api/**', 'api'],
    ['/api/**', 'api'],
  ]);
});
