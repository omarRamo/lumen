'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, check) { check(); passed++; console.log('PASS  ' + name); }
function environment(systemDark = false, hasMedia = true) {
  let change;
  const media = { matches: systemDark, addEventListener(event, listener) { assert.equal(event, 'change'); change = listener; } };
  const meta = { content: '' };
  const window = { document: { documentElement: { dataset: {}, style: {} }, querySelector: () => meta } };
  if (hasMedia) window.matchMedia = query => { assert.equal(query, '(prefers-color-scheme: dark)'); return media; };
  const context = vm.createContext({ window, console });
  for (const file of ['appearance.js', 'save.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
  return { window, appearance: window.LumenAppearance, meta, change(dark) { media.matches = dark; change(); } };
}
test('Appearance follows the system by default and falls back to light without matchMedia', () => {
  for (const dark of [false, true]) {
    const { appearance, window } = environment(dark);
    assert.equal(appearance.preference, 'system');
    assert.equal(appearance.current, dark ? 'dark' : 'light');
    assert.equal(window.document.documentElement.dataset.appearance, appearance.current);
    assert.equal(window.document.documentElement.style.colorScheme, appearance.current);
  }
  assert.equal(environment(true, false).appearance.current, 'light');
});
test('Live system changes apply only when the player has not overridden the system', () => {
  const env = environment(false);
  env.change(true); assert.equal(env.appearance.current, 'dark');
  env.appearance.apply('light'); env.change(false); env.change(true);
  assert.equal(env.appearance.current, 'light');
  env.appearance.apply('dark'); env.change(false);
  assert.equal(env.appearance.current, 'dark');
  env.appearance.apply('system'); assert.equal(env.appearance.current, 'light');
  env.change(true); assert.equal(env.appearance.current, 'dark');
});
test('Appearance notifications are removable and invalid preferences select the system', () => {
  const { appearance } = environment(true);
  const changes = [];
  const remove = appearance.onChange(value => changes.push(value));
  appearance.apply('light'); remove(); appearance.apply('invalid');
  assert.deepEqual(changes, ['light']);
  assert.equal(appearance.preference, 'system'); assert.equal(appearance.current, 'dark');
});
test('Old saves default to system appearance and valid overrides survive reloading', () => {
  const { window } = environment();
  assert.equal(window.LumenSave.validate({}).settings.appearance, 'system');
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const store = new window.LumenSave.SaveStore(storage);
  for (const appearance of ['dark', 'light', 'system']) {
    assert.equal(store.setSetting('appearance', appearance), true);
    assert.equal(new window.LumenSave.SaveStore(storage).profile.settings.appearance, appearance);
  }
  assert.equal(store.setSetting('appearance', 'other'), false);
  assert.equal(window.LumenSave.validate({ settings: { appearance: {} } }).settings.appearance, 'system');
});
console.log('\n' + passed + ' appearance checks passed.');