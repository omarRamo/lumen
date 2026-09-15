'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const window = { navigator: { languages: ['es-MX', 'en-US'], language: 'es-MX' } };
const context = vm.createContext({ window, console });
for (const file of ['i18n.js', 'save.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
context.LumenI18n = window.LumenI18n;
for (const file of ['locales-ui.js', 'locales-classic.js', 'locales-world.js', 'rng.js', 'resonance.js', 'modules.js', 'expedition.js', 'upgrades.js', 'levels.js', 'song.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
const I18n = window.LumenI18n;
let passed = 0;
function test(name, check) { check(); passed++; console.log('PASS  ' + name); }

test('Regional system locales resolve to the five supported languages', () => {
  for (const [tag, expected] of [['es-MX', 'es'], ['fr-CA', 'fr'], ['ar-SA', 'ar'], ['en-GB', 'en'], ['zh-CN', 'zh'], ['zh-Hant-TW', 'zh'], ['ZH_hans_CN', 'zh']]) {
    assert.equal(I18n.resolve('auto', [tag]), expected);
  }
});
test('System preferences are ordered and unsupported or missing languages fall back to English', () => {
  assert.equal(I18n.resolve(), 'es');
  assert.equal(I18n.resolve('auto', ['de-DE', 'ar-EG', 'fr']), 'ar');
  assert.equal(I18n.resolve('auto', ['de-DE', 'ja-JP']), 'en');
  assert.equal(I18n.resolve('auto', []), 'en');
  assert.equal(I18n.resolve('auto', [null, 42, 'not a locale']), 'en');
});
test('An explicit preference wins, while auto follows a changed system language', () => {
  assert.equal(I18n.setLanguage('fr', ['es']), 'fr');
  assert.equal(I18n.preference, 'fr');
  assert.equal(I18n.setLanguage('auto', ['ar']), 'ar');
  assert.equal(I18n.direction, 'rtl');
  assert.equal(I18n.setLanguage('auto', ['zh-TW']), 'zh');
  assert.equal(I18n.locale, 'zh-Hans');
  assert.equal(I18n.direction, 'ltr');
});
test('Saved language survives validation and invalid preferences return to auto', () => {
  assert.equal(window.LumenSave.emptyProfile().settings.language, 'auto');
  for (const language of ['auto', 'en', 'fr', 'es', 'ar', 'zh']) {
    const clean = window.LumenSave.validate({ settings: { language } });
    assert.equal(clean.settings.language, language);
  }
  for (const language of ['de', null, 9, {}, '__proto__']) {
    assert.equal(window.LumenSave.validate({ settings: { language } }).settings.language, 'auto');
  }
});
test('Messages interpolate named values literally and reject incomplete translations', () => {
  I18n.add([['Bonjour {name}', 'Hello {name}', 'Hola {name}', 'مرحبًا {name}', '你好，{name}']]);
  I18n.setLanguage('en');
  assert.equal(I18n.t('Bonjour {name}', { name: '$& <Lumen>' }), 'Hello $& <Lumen>');
  I18n.setLanguage('ar');
  assert.equal(I18n.t('Bonjour {name}', { name: 'Lumen' }), 'مرحبًا Lumen');
  assert.throws(() => I18n.add([['Missing', 'Only English']]), /Incomplete/);
});
test('Every catalog translation keeps the same named placeholders', () => {
  const tokens = text => [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(match => match[1]).sort();
  for (const [source, translations] of I18n.entries()) {
    for (const code of Object.keys(I18n.LANGUAGES)) assert.deepEqual(tokens(translations[code]), tokens(source), code + ': ' + source);
  }
});
test('Every authored level, quest, dialogue, echo and offered upgrade has five translations', () => {
  const sources = new Set();
  function levelText(level) {
    for (const field of ['name', 'subtitle', 'goal']) if (level[field]) sources.add(level[field]);
    for (const hint of level.hints || []) sources.add(hint.text);
    for (const character of level.characters || []) {
      sources.add(character.name); sources.add(character.role);
      Object.values(character.lines).flat().forEach(line => sources.add(line));
    }
    if (level.quest) for (const field of ['title', 'summary', 'reward']) sources.add(level.quest[field]);
    for (const echo of level.lights || []) sources.add(echo.name);
  }
  window.LUMEN_LEVELS.forEach(levelText); window.LumenSong.ISLANDS.forEach(levelText);
  for (const omen of Object.values(window.LumenExpedition.OMENS)) { sources.add(omen.label); sources.add(omen.hint); }
  for (const upgrade of window.LumenUpgrades.UPGRADES) { sources.add(upgrade.name); sources.add(upgrade.hint); }
  for (const combo of window.LumenUpgrades.COMBOS) { sources.add(combo.name); sources.add(combo.effect); }
  for (let seed = 0; seed < 40; seed++) window.LumenExpedition.plan(seed).rooms.forEach(room => levelText(room.level));
  assert.deepEqual([...sources].filter(source => !I18n.has(source)), []);
});
test('Lumen is the same proper name in all five languages', () => {
  for (const code of Object.keys(I18n.LANGUAGES)) {
    I18n.setLanguage(code);
    assert.equal(I18n.t('Lumen'), 'Lumen');
    for (const [source, translations] of I18n.entries()) {
      if (/\bLumen\b/.test(source)) assert.ok(/\bLumen\b/.test(translations[code]), code + ': ' + source);
    }
  }
});
test('The former hero name cannot return to sources, catalogs or the portable edition', () => {
  const formerName = new RegExp('\\b' + ['Ni', 'lo'].join('') + '\\b|' +
    String.fromCodePoint(0x646, 0x64a, 0x644, 0x648) + '|' + String.fromCodePoint(0x5c3c, 0x6d1b), 'i');
  const offenders = [];
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'docs', 'BACKLOG.md'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(file);
      else if (/\.(?:js|cjs|html|css|json|md|svg)$/.test(entry.name) && formerName.test(fs.readFileSync(file, 'utf8'))) {
        offenders.push(path.relative(root, file));
      }
    }
  }
  inspect(root);
  assert.deepEqual(offenders, [], 'Historical names belong only in docs/ or BACKLOG.md.');
});
console.log('\n' + passed + ' localization checks passed.');