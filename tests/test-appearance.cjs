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
  return { window, appearance: window.LumenAppearance, meta, change(dark) { media.matches = dark; change?.(); } };
}
test('The authored light palette is independent of device appearance', () => {
  for (const dark of [false, true]) {
    const env = environment(dark);
    for (const choice of ['system', 'dark', 'light', 'invalid']) {
      env.appearance.apply(choice); env.change(!dark);
      assert.equal(env.appearance.current, 'light');
      assert.equal(env.appearance.preference, 'light');
      assert.equal(env.window.document.documentElement.style.colorScheme, 'light');
      assert.equal(env.window.document.documentElement.dataset.appearance, 'light');
    }
    assert.equal(env.appearance.controls(), '');
  }
  assert.equal(environment(true, false).appearance.current, 'light');
});
test('Appearance notifications remain removable', () => {
  const { appearance } = environment(true), changes = [];
  const remove = appearance.onChange(value => changes.push(value));
  appearance.apply('dark'); remove(); appearance.apply('light');
  assert.deepEqual(changes, ['light']);
});
test('Legacy appearance choices normalize without losing progress or other settings', () => {
  const { window } = environment();
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  for (const appearance of ['dark', 'light', 'system']) {
    values.set('lumen.gardens.v3', JSON.stringify({schema:3,finished:true,settings:{appearance,language:'fr',musicVolume:.17}}));
    const store = new window.LumenSave.SaveStore(storage);
    assert.equal(store.profile.settings.appearance, 'light');
    assert.equal(store.profile.finished, true);
    assert.equal(store.profile.settings.musicVolume, .17);
    assert.equal(store.profile.settings.language, 'fr');
    assert.equal(store.setSetting('appearance', appearance), true);
    assert.equal(new window.LumenSave.SaveStore(storage).profile.settings.appearance, 'light');
  }
  assert.equal(new window.LumenSave.SaveStore(storage).setSetting('appearance', 'other'), false);
  assert.equal(window.LumenSave.validate({}).settings.appearance, 'light');
});
console.log('\n' + passed + ' appearance checks passed.');
