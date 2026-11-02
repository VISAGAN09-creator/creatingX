const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadCartCatalog() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'cartCatalog.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(
    module.exports,
    require,
    module,
    filename,
    path.dirname(filename),
  );
  return module.exports;
}

const { cartCanCheckout, cartSubtotal, resolveCartLines } = loadCartCatalog();

const catalogue = {
  catalogStatus: 'ready',
  totdProducts: [],
  totdStatus: 'ready',
  catalogProducts: [
    {
      id: 'tees-king-ragnor',
      name: 'King Ragnor',
      price: 599,
      image: 'king-ragnor.jpg',
      alt: 'King Ragnor',
      sizes: [{ name: 'XXS', stock: 2 }],
      colors: [],
    },
    {
      id: 'tees-doctor-doom',
      name: 'Doctor Doom',
      price: 799,
      image: 'doctor-doom.jpg',
      alt: 'Doctor Doom',
      sizes: [{ name: 'XXS', stock: 1 }, { name: 'S', stock: 0 }],
      colors: [{ name: 'Black' }],
    },
  ],
};

test('resolves current and legacy size/color cart IDs to latest catalogue products', () => {
  const lines = [
    {
      id: 'tees-king-ragnor-XXS',
      checkoutProductId: 'tees-king-ragnor-XXS',
      name: 'King Ragnor (XXS)',
      price: 499,
      image: 'stale.jpg',
      alt: 'King Ragnor',
      selectedSize: 'XXS',
      quantity: 2,
    },
    {
      id: 'tees-doctor-doom-XXS--color-black',
      name: 'Doctor Doom (XXS)',
      price: 499,
      image: 'stale.jpg',
      alt: 'Doctor Doom',
      selectedSize: 'XXS',
      selectedColor: 'Black',
      quantity: 1,
    },
  ];

  const resolved = resolveCartLines(lines, catalogue);

  assert.deepEqual(resolved.map(({ name, image, price, availability }) => ({ name, image, price, availability })), [
    { name: 'King Ragnor', image: 'king-ragnor.jpg', price: 599, availability: 'available' },
    { name: 'Doctor Doom', image: 'doctor-doom.jpg', price: 799, availability: 'available' },
  ]);
  assert.equal(cartCanCheckout(resolved), true);
  assert.equal(cartSubtotal(resolved), 1997);
});

test('keeps genuinely deleted products and unavailable variants blocked', () => {
  const resolved = resolveCartLines([
    {
      id: 'tees-deleted-XXS',
      checkoutProductId: 'tees-deleted-XXS',
      name: 'Deleted Tee (XXS)',
      price: 499,
      image: 'stale.jpg',
      alt: 'Deleted Tee',
      selectedSize: 'XXS',
      quantity: 1,
    },
    {
      id: 'tees-doctor-doom-S',
      checkoutProductId: 'tees-doctor-doom-S',
      name: 'Doctor Doom (S)',
      price: 499,
      image: 'stale.jpg',
      alt: 'Doctor Doom',
      selectedSize: 'S',
      quantity: 1,
    },
  ], catalogue);

  assert.deepEqual(resolved.map((line) => line.availability), ['unavailable', 'variant-unavailable']);
  assert.equal(cartCanCheckout(resolved), false);
  assert.equal(cartSubtotal(resolved), null);
});
