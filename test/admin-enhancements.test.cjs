const assert = require('node:assert/strict');
const test = require('node:test');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const os = require('node:os');

const originalCwd = process.cwd();
process.chdir(os.tmpdir());
const { selectCollectionAddition, app } = require('../server.cjs');
process.chdir(originalCwd);

const csvPath = path.resolve(__dirname, '../src/utils/ordersCsv.ts');
const source = require('node:fs').readFileSync(csvPath, 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const csvModule = new Module(csvPath, module);
csvModule.filename = csvPath;
csvModule.paths = module.paths;
csvModule._compile(js, csvPath);
const { buildOrdersCsv } = csvModule.exports;

function parseCsv(csv) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 1; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"' && quoted && csv[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\r' && csv[i + 1] === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows;
}

const order = {
  orderId: 'order_1', orderType: 'online', createdAt: '2026-11-01T10:00:00Z',
  customer: { name: 'A, B', email: 'a@example.com', phone: '123' },
  shipping: { addressLine1: '1, Main \"Street\"', country: 'India', state: 'Goa', city: 'Panaji', pinCode: '012345' },
  items: [{ name: 'Tee', quantity: 1 }], pricing: { total: 499 },
  payment: { razorpayOrderId: 'rzp_1' }, paymentStatus: 'paid', fulfillmentStatus: 'production',
};

test('collection decision reuses case-insensitive matches and rejects website slug collisions', () => {
  assert.deepEqual(selectCollectionAddition('cricket', ['Cricket']), { collectionName: 'Cricket', created: false });
  assert.deepEqual(selectCollectionAddition('Cricket!', ['Cricket']), { conflict: true });
  assert.deepEqual(selectCollectionAddition('Football', ['Cricket']), { collectionName: 'Football', created: true });
});

test('admin mutations reject unauthenticated requests before reaching Firestore', async () => {
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [method, url] of [
      ['POST', '/api/admin/product-collections'],
      ['DELETE', '/api/admin/products/products/example'],
    ]) {
      const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify({ name: 'Example' }) } : {}) });
      assert.equal(response.status, 401);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('CSV exports separate structured address fields and retains existing columns', () => {
  const [headers, values] = parseCsv(buildOrdersCsv([order]));
  const record = Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  assert.equal(record.Country, 'India');
  assert.equal(record.State, 'Goa');
  assert.equal(record.City, 'Panaji');
  assert.equal(record['PIN Code'], '012345');
  assert.equal(record['Shipping Address'], '1, Main \"Street\", Panaji, Goa, 012345, India');
  assert.equal(record['Customer Name'], 'A, B');
  assert.equal(record['Gateway Order ID'], 'rzp_1');
});

test('CSV leaves missing legacy fields empty and escapes commas, quotes and newlines', () => {
  const legacy = { ...order, shipping: { address: 'One, Two' }, customer: { ...order.customer, name: 'A\n"B"' } };
  const [headers, values] = parseCsv(buildOrdersCsv([legacy]));
  const record = Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  for (const field of ['Country', 'State', 'City', 'PIN Code']) assert.equal(record[field], '');
  assert.equal(record['Shipping Address'], 'One, Two');
  assert.equal(record['Customer Name'], 'A\n"B"');
});
