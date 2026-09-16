'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('./test-dist.cjs');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const key = 'lumen.gardens.v3', backup = key + '.backup';
function fixture({ native = true, values = {}, mirror = {}, diskError = false, wakeLock } = {}) {
  const data = new Map(Object.entries(values)), events = {}, timers = new Map(), writes = [], disk = { ...mirror };
  let timerId = 0, listener, readCount = 0;
  const localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
  const document = { hidden: false, documentElement: { classList: { add() {} } }, addEventListener: (name, fn) => { events[name] = fn; } };
  const window = { localStorage, document, navigator: { wakeLock },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    Capacitor: { isNativePlatform: () => native, Plugins: {
      Filesystem: {
        async readFile() { readCount++; if (diskError) throw Error('disk'); return { data: JSON.stringify(disk) }; },
        async writeFile(options) { if (diskError) throw Error('disk'); writes.push(options); },
        async rename() { Object.assign(disk, JSON.parse(writes.at(-1).data)); }
      },
      App: { addListener(name, fn) { assert.equal(name, 'appStateChange'); listener = fn; return Promise.resolve({ remove() {} }); } }
    } }
  };
  const context = vm.createContext({ window, console });
  vm.runInContext(read('js/platform.js'), context);
  vm.runInContext(read('js/save.js'), context);
  return { platform: window.LumenPlatform, SaveStore: window.LumenSave.SaveStore, localStorage, data, events, timers, writes, disk,
    document, state: active => listener({ isActive: active }), reads: () => readCount };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.equal(config.appId, 'com.omartrabelsi.lumen');
  assert.equal(config.appName, 'LUMEN'); assert.equal(config.webDir, 'dist');
  assert.deepEqual(config.server, { iosScheme: 'capacitor' }); // origin is a save contract
  assert.deepEqual(config.ios, { scheme: 'LUMEN', contentInset: 'never', scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true, backgroundColor: '#dce6d5' });
  const plist = read('ios/App/App/Info.plist');
  for (const [name, value] of Object.entries({ CADisableMinimumFrameDurationOnPhone: true, UIStatusBarHidden: true,
    UIViewControllerBasedStatusBarAppearance: false, UIRequiresFullScreen: true, ITSAppUsesNonExemptEncryption: false })) {
    assert.match(plist, new RegExp(`<key>${name}</key>\\s*<${value}/>`));
  }
  function array(name) { return [...plist.match(new RegExp(`<key>${name}</key>\\s*<array>([\\s\\S]*?)</array>`))[1].matchAll(/<string>(.*?)<\/string>/g)].map(m => m[1]); }
  assert.deepEqual(array('UISupportedInterfaceOrientations'), ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']);
  assert.deepEqual(array('UISupportedInterfaceOrientations~ipad'), ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']);
  assert.deepEqual(array('WKAppBoundDomains'), ['localhost']);
  assert.match(read('index.html'), /name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/);
  assert.doesNotMatch(read('ios/App/App/AppDelegate.swift'), /AVAudioSession/);
  const web = fixture({ native: false });
  assert.equal(web.platform.storage(), web.localStorage);
  await web.platform.prepare(); web.platform.attach({}); await web.platform.flush();
  assert.equal(web.reads(), 0); assert.equal(web.writes.length, 0);
  console.log('PASS frozen origin, plist, viewport and literally unchanged web storage');

  const profile = JSON.stringify({ schema: 3, finished: true, settings: { volume: .17 }, chapters: { 'prairies-aurore': { completed: true, stars: 3 } } });
  const restored = fixture({ mirror: { [key]: profile, [backup]: profile, unrelated: 'no' } });
  await restored.platform.prepare();
  const store = new restored.SaveStore(restored.platform.storage());
  assert.equal(store.profile.finished, true); assert.equal(store.chapter('prairies-aurore').stars, 3);
  assert.equal(restored.localStorage.getItem(backup), profile); assert.equal(restored.localStorage.getItem('unrelated'), null);
  store.setSetting('volume', .2); store.setSetting('volume', .3);
  assert.equal(restored.timers.size, 1); assert.equal(restored.writes.length, 0);
  assert.equal(new restored.SaveStore(restored.platform.storage()).profile.settings.volume, .3);
  await restored.platform.flush();
  assert.equal(restored.writes.length, 1); assert.equal(JSON.parse(restored.disk[key]).settings.volume, .3);
  assert.equal(restored.writes[0].directory, 'DATA');
  const secondBoot = fixture({ mirror: restored.disk }); await secondBoot.platform.prepare();
  assert.equal(new secondBoot.SaveStore(secondBoot.platform.storage()).profile.settings.volume, .3);
  const existing = fixture({ values: { [key]: profile }, mirror: { [key]: '{}' } });
  await existing.platform.prepare(); assert.equal(existing.reads(), 0); assert.equal(existing.localStorage.getItem(key), profile);
  for (const version of [1, 2]) {
    const oldKey = 'lumen.gardens.v' + version, legacy = JSON.stringify({ schema: version, unlocked: 3 });
    const old = fixture({ mirror: { [oldKey]: legacy } }); await old.platform.prepare();
    const migrated = new old.SaveStore(old.platform.storage());
    assert.equal(migrated.migratedFrom, oldKey); assert.equal(old.localStorage.getItem(oldKey), legacy);
    await old.platform.flush(); assert.equal(old.disk[oldKey], legacy);
  }
  const failed = fixture({ diskError: true }); await failed.platform.prepare();
  const resilient = new failed.SaveStore(failed.platform.storage()); resilient.setSetting('volume', .4);
  await failed.platform.flush(); assert.equal(resilient.profile.settings.volume, .4);
  console.log('PASS mirror recovery, synchronous saves, debounce, persistence, migrations and disk failure');

  let acquire, released = 0, resumed = 0, modeListener;
  const life = fixture({ wakeLock: { request: () => new Promise(resolve => { acquire = resolve; }) } });
  const game = { mode: 'playing', on: (_, fn) => { modeListener = fn; }, input: { reset() {} },
    audio: { ctx: { state: 'suspended' }, pause() {}, async unlock() { resumed++; this.ctx.state = 'running'; } },
    pause() { this.mode = 'paused'; modeListener(); } };
  life.platform.attach(game);
  life.state(false); assert.equal(game.mode, 'paused');
  acquire({ release: async () => { released++; }, addEventListener() {} }); await tick();
  assert.equal(released, 1, 'A lock arriving after pause must be released');
  life.state(true); await tick(); assert.equal(resumed, 1); assert.equal(game.mode, 'paused');
  game.audio.ctx.state = 'suspended'; life.events.visibilitychange(); await tick(); assert.equal(resumed, 2);
  game.mode = 'playing'; modeListener(); let releasedCallback;
  acquire({ release: async () => { released++; }, addEventListener: (_, fn) => { releasedCallback = fn; } }); await tick();
  game.mode = 'map'; modeListener(); await tick(); assert.equal(released, 2);
  releasedCallback();
  const absent = fixture(); absent.platform.attach(game); await tick();
  const rejected = fixture({ wakeLock: { request: async () => { throw Error('denied'); } } });
  game.mode = 'playing'; rejected.platform.attach(game); await tick();
  console.log('PASS native pause, audio recovery, wake-lock races, release, unsupported and denied APIs');
})().catch(error => { console.error(error); process.exitCode = 1; });
