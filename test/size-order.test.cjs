const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadSizeUtilities() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'sizes.ts');
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

const { sortClothingSizes } = loadSizeUtilities();
const names = (sizeNames) => sortClothingSizes(sizeNames.map((name, index) => ({ name, stock: index }))).map((size) => size.name);

test('orders standard apparel sizes by progression instead of Firestore insertion order', () => {
  assert.deepEqual(names(['S', 'XL', 'XS', 'L', 'XXXL', 'XXS', 'M', 'XXL']), ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']);
  assert.deepEqual(names(['M', 'XL', 'S']), ['S', 'M', 'XL']);
  assert.deepEqual(names(['XXL', 'XS', 'M', 'XXS']), ['XXS', 'XS', 'M', 'XXL']);
});

test('orders numeric XL aliases with their equivalent standard apparel rank', () => {
  assert.deepEqual(names(['3XL', 'XL', '2XL', 'L']), ['L', 'XL', '2XL', '3XL']);
  assert.deepEqual(names(['10XL', '5XL', '4XL', 'XXXXL', 'XXXL']), ['XXXL', '4XL', 'XXXXL', '5XL', '10XL']);
});

test('does not add unavailable sizes and preserves the original stored labels', () => {
  const sizes = sortClothingSizes([
    { name: '3XL', stock: 4 },
    { name: 'S', stock: 0 },
    { name: 'XL', stock: 2 },
  ]);

  assert.deepEqual(sizes, [
    { name: 'S', stock: 0 },
    { name: 'XL', stock: 2 },
    { name: '3XL', stock: 4 },
  ]);
});

test('removes duplicate labels while preserving the first configured variant', () => {
  assert.deepEqual(
    sortClothingSizes([
      { name: 'XL', stock: 3 },
      { name: 'S', stock: 1 },
      { name: ' xl ', stock: 9 },
    ]),
    [
      { name: 'S', stock: 1 },
      { name: 'XL', stock: 3 },
    ],
  );
});
