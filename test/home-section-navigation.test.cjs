const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadHomeSections() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'homeSections.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, require, module, filename, path.dirname(filename));
  return module.exports;
}

const { isHomeSectionHash, shouldScheduleHomeSectionScroll } = loadHomeSections();

test('recognizes the navbar hashes used by the rendered home sections', () => {
  assert.equal(isHomeSectionHash('#hero'), true);
  assert.equal(isHomeSectionHash('#latest-drop'), true);
  assert.equal(isHomeSectionHash('#collections'), true);
  assert.equal(isHomeSectionHash('#lookbook'), true);
  assert.equal(isHomeSectionHash('#collection'), false);
});

test('schedules fresh section navigation but never overrides browser Back/Forward restoration', () => {
  assert.equal(shouldScheduleHomeSectionScroll('#collections', false), true);
  assert.equal(shouldScheduleHomeSectionScroll('#latest-drop', false), true);
  assert.equal(shouldScheduleHomeSectionScroll('#hero', false), true);
  assert.equal(shouldScheduleHomeSectionScroll('#collections', true), false);
});

test('home section IDs match the navbar hashes', () => {
  const source = (file) => fs.readFileSync(path.join(__dirname, '..', 'src', 'components', file), 'utf8');

  assert.match(source('Hero.tsx'), /id="hero"/);
  assert.match(source('LatestDrop.tsx'), /id="latest-drop"/);
  assert.match(source('Collection.tsx'), /id="collections"/);
});
