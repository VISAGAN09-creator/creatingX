const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadSitePaths() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'sitePaths.ts');
  const source = fs.readFileSync(filename, 'utf8').replace('import.meta.env.BASE_URL', "'/varataaa'");
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

const { createSitePaths, mainWebsitePath, mainWebsiteSectionPath, policyPagePath } = loadSitePaths();

test('builds main-storefront fragment URLs without a slash before the hash', () => {
  const paths = createSitePaths('/varataaa');

  assert.equal(paths.mainWebsitePath, '/varataaa');
  assert.equal(paths.mainWebsiteSectionPath('#hero'), '/varataaa#hero');
  assert.equal(paths.mainWebsiteSectionPath('collections'), '/varataaa#collections');
  assert.notEqual(paths.mainWebsiteSectionPath('#products'), '/varataaa/#products');
  assert.equal(mainWebsitePath, '/varataaa');
  assert.equal(mainWebsiteSectionPath('#hero'), '/varataaa#hero');
  assert.equal(policyPagePath('terms-and-conditions'), '/varataaa/terms-and-conditions');
});

test('keeps policy page routes under the storefront base path', () => {
  const { policyPagePath } = createSitePaths('/varataaa');

  assert.equal(policyPagePath('terms-and-conditions'), '/varataaa/terms-and-conditions');
  assert.equal(policyPagePath('shipping-policy'), '/varataaa/shipping-policy');
  assert.equal(policyPagePath('refund-policy'), '/varataaa/refund-policy');
  assert.equal(policyPagePath('privacy-policy'), '/varataaa/privacy-policy');
});

test('uses root-relative navigation in a root-mounted local development build', () => {
  const paths = createSitePaths('/');

  assert.equal(paths.mainWebsitePath, '/');
  assert.equal(paths.mainWebsiteSectionPath('#hero'), '/#hero');
  assert.equal(paths.policyPagePath('terms-and-conditions'), '/terms-and-conditions');
});
