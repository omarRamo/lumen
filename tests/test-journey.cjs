/* The constellation is a view of saved facts, never a second access system.
 * State fixtures are explicitly marked. The illumination test plays the real
 * first garden, from spawn to exit, using movement/jump inputs only. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = ['rng', 'save', 'resonance', 'modules', 'expedition', 'upgrades', 'places', 'levels', 'song', 'journey', 'engine'];
const sources = files.map(file => fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'));
const DT = 1 / 120;
let failed = 0, passed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS  ' + name); }
  catch (error) { failed++; console.error('FAIL  ' + name + '\n' + error.stack); }
}
function world(storage = new Map()) {
  const listeners = {}, pad = { current: null };
  const window = { innerWidth: 1280, innerHeight: 720,
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    LumenRenderer: class { resize() {} },
    LumenAudio: class { setMuted() {} setTheme() {} setDanger() {} setBossPhase() {} unlock() {} resume() {} pause() {} sfx() {} }
  };
  const document = { hidden: false, addEventListener() {}, body: { classList: { contains: () => true } } };
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const context = vm.createContext({ window, document, localStorage, navigator: { getGamepads: () => pad.current ? [pad.current] : [] }, requestAnimationFrame() {}, console, Math });
  for (const source of sources) vm.runInContext(source, context);
  const game = new window.LumenGame({});
  return { game, window, storage, listeners, pad, model: () => window.LumenJourney.describe(game) };
}
function step(game) { game.update(DT); game.input.clearFrame(); }
function set(game, action, down) { game.input.virtual(action, down, 'journey-test'); }

test('Every island, stage, hub and dream entrance appears exactly once, with data-driven totals', () => {
  const { game, window, model } = world();
  const before = model();
  assert.equal(before.places.length, window.LUMEN_LEVELS.length + window.LumenSong.ISLANDS.length + 1);
  assert.equal(new Set(before.places.map(place => place.id)).size, before.places.length);
  assert.equal(before.totals.maxStars, window.LUMEN_LEVELS.concat(window.LumenSong.ISLANDS).reduce((n, level) => n + level.collectibles.filter(c => c.type === 'star').length, 0));
  assert.equal(before.totals.maxSecrets, window.LUMEN_LEVELS.reduce((n, level) => n + (level.secrets || []).length, 0));
  // Catalog fixture: an inserted definition must not require editing the map.
  const sample = JSON.parse(JSON.stringify(window.LUMEN_LEVELS[0]));
  sample.key = 'test-stable-insertion'; sample.journeyAct = 2;
  window.LUMEN_LEVELS.splice(4, 0, sample);
  assert.equal(model().places.length, before.places.length + 1);
  assert.equal(model().places.find(place => place.id === sample.key).act, 2);
  assert.equal(game.isUnlocked(4), false);
});

test('A fresh map cannot open locked campaign stages, islands or dreams', () => {
  const { game, model } = world();
  assert.equal(model().places.find(place => place.kind === 'dreams').unlocked, game.canEnterDreams().allowed);
  assert.equal(game.startSong(0), true);
  const firstSong = game.song;
  game.showMap();
  assert.equal(game.mode, 'map'); assert.equal(game.song, firstSong);
  for (const place of model().places.filter(place => !place.unlocked)) {
    assert.equal(game.openJourneyPlace(place.id), false, place.id);
    assert.equal(game.mode, 'map', place.id + ' changed the mode');
    assert.ok(place.reason, place.id + ' has no explanation');
    assert.ok(model().places.some(node => node.id === place.requirementId), place.id + ' has no useful destination');
  }
  assert.equal(game.startSong(1), false);
  assert.equal(game.returnFromJourneyMap(), true);
  assert.equal(game.mode, 'playing'); assert.equal(game.song, firstSong);
});

test('State fixture: act completion opens the following rest island; collecting fragments is optional', () => {
  const { game, window } = world();
  game.store.recordChapter('chant-petits-matins', { stars: 0, time: 80 });
  assert.equal(game.isSongUnlocked(1), false, 'the old island-to-island gate survived');
  for (const place of window.LumenJourney.places(game).filter(p => p.act === 1 && p.kind === 'stage' && !p.optional)) {
    game.store.recordChapter(place.id, { stars: 0, time: 100 });
  }
  assert.equal(game.isSongUnlocked(1), true);
  game.level = window.LUMEN_LEVELS.find(level => level.key === 'lagon-lucioles');
  assert.equal(game.nextJourneyPlace().id, 'chant-recifs-ciel');
  game.store.recordChapter('chant-recifs-ciel', {stars:0,time:80});
  game.store.unlock('archipels-zephyr');
  game.level = window.LumenSong.ISLANDS[1];
  assert.equal(game.nextJourneyPlace().id, 'archipels-zephyr');
});

test('State fixture: a completed second island and five historical open chapters survive reload', () => {
  const first = world();
  const profile = first.window.LumenSave.emptyProfile();
  profile.unlocked = first.window.LumenSave.LEGACY_ORDER_V2.slice(0, 5);
  profile.chapters['chant-recifs-ciel'] = { completed: true, stars: 2, medal: 'silver', time: 240 };
  first.storage.set(first.window.LumenSave.KEY, JSON.stringify(profile));
  const reloaded = world(first.storage);
  for (const key of profile.unlocked) assert.equal(reloaded.game.isUnlocked(reloaded.game.indexOfKey(key)), true, key);
  assert.equal(reloaded.game.startSong(1), true);
  assert.equal(reloaded.game.store.chapter('chant-recifs-ciel').stars, 2);
});

test('State fixture: a legacy campaign frontier opens intervening islands without rewriting stable keys', () => {
  const { game } = world();
  game.store.unlock('vergers-vent');
  assert.equal(game.isSongUnlocked(1), true);
  assert.equal(game.isSongUnlocked(2), true);
  assert.equal(game.store.isUnlocked('chant-recifs-ciel'), false, 'derived access should not require a migration');
});

test('The real first-stage playthrough adds map light, queues its birth, and retains it after a full reload', () => {
  const { game, storage, model } = world();
  const initial = model().totals.lights;
  const events = []; game.on('journey-light', event => events.push(event));
  game.start(0);
  let jumpUntil = 0, lastJump = -10;
  for (let frame = 0; frame < 120 * 120 && game.mode !== 'complete' && game.mode !== 'gameover'; frame++) {
    if (game.mode === 'playing') {
      set(game, 'right', true); set(game, 'run', true);
      const p = game.player;
      const source = game.platforms.filter(s => s.type === 'ground' && s.x <= p.x + 16 && s.x + s.w >= p.x + 16).sort((a, b) => b.x - a.x)[0];
      const edge = source ? source.x + source.w : Infinity;
      const upcoming = game.enemies.some(e => e.alive && e.x > p.x && e.x - p.x < 125 && Math.abs(e.y - p.y) < 110);
      if (p.grounded && game.elapsed - lastJump > .12 && (edge - p.x < 95 || upcoming)) {
        set(game, 'jump', true); jumpUntil = game.elapsed + .45; lastJump = game.elapsed;
      } else if (game.elapsed > jumpUntil) set(game, 'jump', false);
    }
    step(game);
  }
  assert.equal(game.mode, 'complete', 'the bot must reach the exit without invoking complete()');
  assert.ok(events.some(event => event.id === 'prairies-aurore' && event.lights.includes('prairies-aurore:completed')));
  game.showMap();
  assert.ok(model().totals.lights > initial);
  assert.ok(game.consumeJourneyLights().some(event => event.id === 'prairies-aurore'));
  assert.equal(game.consumeJourneyLights().length, 0, 'birth animation replayed without a new success');
  const reloaded = world(storage);
  assert.equal(reloaded.model().totals.lights, model().totals.lights);
  assert.equal(reloaded.model().places.find(place => place.id === 'prairies-aurore').completed, true);
  assert.equal(reloaded.game.consumeJourneyLights().length, 0, 'reload should show a steady saved light');
});

test('Secret discovery (positioned inside its authored zone) persists even when the stage is left unfinished', () => {
  const { game, storage, model } = world();
  game.start(0);
  const secret = game.secrets[0];
  game.player.x = secret.x + 5; game.player.y = secret.y + 5;
  game.updateSecrets();
  assert.equal(game.store.chapter(game.level.key).completed, false);
  assert.equal(game.nextChapterIndex(), 0, 'a secret is not a completed chapter');
  assert.equal(model().places.find(place => place.id === game.level.key).secrets, 1);
  const reloaded = world(storage);
  assert.equal(reloaded.game.store.chapter(game.level.key).secrets, 1);
  reloaded.game.store.recordChapter(game.level.key, { secrets: 0, stars: 0 });
  assert.equal(reloaded.game.store.chapter(game.level.key).secrets, 1);
});

test('State fixture: weak replays never extinguish lights and unreadable secret data does not lose the chapter', () => {
  const { game, window, model } = world();
  game.store.recordChapter('prairies-aurore', { stars: 3, secrets: 1, medal: 'gold', time: 50, timed: true });
  const before = model().totals.lights;
  game.store.recordChapter('prairies-aurore', { stars: 0, secrets: -99, medal: 'bronze', time: 100, timed: true });
  assert.equal(model().totals.lights, before);
  const repaired = window.LumenSave.validate({ chapters: { 'prairies-aurore': { completed: true, stars: 2, secrets: 'not a count' } } });
  assert.equal(repaired.chapters['prairies-aurore'].completed, true);
  assert.equal(repaired.chapters['prairies-aurore'].stars, 2);
  assert.equal(repaired.chapters['prairies-aurore'].secrets, 0);
  game.store.recordSecrets('prairies-aurore', 1e9);
  assert.equal(game.store.chapter('prairies-aurore').secrets, 99);
});

test('The hub quest completed by real resonance actions opens the same dream node after reload', () => {
  const { game, storage, model } = world();
  game.start(game.indexOfKey('observatoire'));
  // Positions place the player near each authored chime; only real action
  // inputs wake it and let the engine complete its quest.
  for (const id of game.level.quest.needs) {
    const chime = game.wakeables.find(w => w.id === id);
    game.player.x = chime.x - 16; game.player.y = chime.y - 24;
    game.player.vx = game.player.vy = 0; game.player.actionCooldown = 0;
    set(game, 'action', true); step(game); set(game, 'action', false);
    for (let tick = 0; tick < 50; tick++) step(game);
  }
  assert.equal(game.canEnterDreams().allowed, true);
  assert.equal(model().places.find(place => place.kind === 'dreams').unlocked, true);
  assert.equal(model().places.find(place => place.kind === 'hub').completed, true);
  const reloaded = world(storage);
  assert.equal(reloaded.model().places.find(place => place.kind === 'dreams').unlocked, true);
  let opened = 0; reloaded.game.on('portal', target => { if (target === 'expedition') opened++; });
  assert.equal(reloaded.game.openJourneyPlace('reves-nomades'), true);
  assert.equal(opened, 1);
});

test('Map controller input emits separate navigation/actions once per press and never moves the hero', () => {
  const { game, pad } = world();
  game.startSong(0); game.showMap();
  const commands = []; game.on('command', command => commands.push(command));
  pad.current = { connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
  for (const [button, expected] of [[14, 'left'], [15, 'right'], [12, 'up'], [13, 'down'], [0, 'confirm'], [1, 'back']]) {
    pad.current.buttons[button].pressed = true;
    game.input.pollGamepad('map'); game.input.pollGamepad('map');
    assert.equal(commands.at(-1), 'journey-' + expected);
    pad.current.buttons[button].pressed = false; game.input.pollGamepad('map');
  }
  assert.equal(commands.length, 6);
  assert.equal(game.input.down('jump'), false); assert.equal(game.input.down('right'), false);
});

test('State fixture: an improved personal time lights its clock again without increasing saved point count', () => {
  const { game, model } = world();
  game.store.recordChapter('prairies-aurore', { time: 80, timed: true });
  game.saveProgress(); game.consumeJourneyLights();
  const before = model().totals.lights;
  game.store.recordChapter('prairies-aurore', { time: 75, timed: true });
  game.saveProgress();
  assert.ok(game.consumeJourneyLights().some(event => event.lights.includes('prairies-aurore:time')));
  assert.equal(model().totals.lights, before);
  game.store.recordChapter('prairies-aurore', { time: 90, timed: true });
  game.saveProgress(); assert.equal(game.consumeJourneyLights().length, 0);
});

test('State fixture: a fully populated journey remains bounded far below localStorage limits', () => {
  const { game, model } = world();
  for (let run = 0; run < 100; run++) for (const place of model().places) {
    game.store.recordChapter(place.id, { stars: place.maxStars, secrets: place.maxSecrets, medal: 'gold', time: 80, timed: true });
    game.store.unlock(place.id);
  }
  game.saveProgress();
  const size = Buffer.byteLength(JSON.stringify(game.progress), 'utf8');
  assert.ok(size < 32 * 1024, 'profile uses ' + size + ' bytes');
  assert.ok(game.journeyEvents.length <= model().places.length, 'transient queue grew per replay');
});
console.log(`\n${passed}/${passed + failed} journey checks passed.`);
if (failed) process.exitCode = 1;
