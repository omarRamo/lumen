/* Deterministic, dependency-free integration checks for the real game engine.
 * Run from the LUMEN directory: node tests/test-engine.cjs
 * Browser drawing/audio are mocked; level data and simulation are not.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const scripts = ['rng.js', 'save.js', 'resonance.js', 'modules.js', 'expedition.js', 'upgrades.js', 'levels.js', 'song.js', 'journey.js', 'engine.js'].map(file => fs.readFileSync(path.join(root, 'js', file), 'utf8'));
const DT = 1 / 120;
const checks = [];
let failed = 0;

function environment(storage = new Map(), rejectStorage = false) {
  let seed = 0x12ab34cd;
  const seededMath = Object.create(Math);
  seededMath.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
  const events = new Map();
  const window = {
    innerWidth: 1280, innerHeight: 720,
    addEventListener(name, handler) { if (!events.has(name)) events.set(name, []); events.get(name).push(handler); },
    LumenRenderer: class { resize() {} draw() {} },
    LumenAudio: class {
      constructor() { this.sounds = []; }
      setMuted(value) { this.muted = value; }
      setTheme(value) { this.theme = value; }
      setDanger(value) { this.danger = value; }
      setBossPhase(value) { this.bossPhase = value; }
      unlock() {} resume() {} pause() {}
      sfx(name) { this.sounds.push(name); }
    }
  };
  const document = { hidden: false, addEventListener() {}, body: { classList: { contains: () => true } } };
  const localStorage = {
    getItem(key) { if (rejectStorage) throw new Error('Storage denied'); return storage.get(key) ?? null; },
    setItem(key, value) { if (rejectStorage) throw new Error('Storage denied'); storage.set(key, value); }
  };
  const context = vm.createContext({ window, document, localStorage, Math: seededMath, requestAnimationFrame() {}, console });
  for (const source of scripts) vm.runInContext(source, context);
  const game = new window.LumenGame({});
  return { game, window, storage, events };
}

const DEFINITIONS = environment().window.LUMEN_LEVELS;
const STAGE_COUNT = DEFINITIONS.length;
const FINAL_INDEX = DEFINITIONS.findIndex(level => level.final);

function fresh(index = 0) {
  const result = environment();
  result.game.loadLevel(index);
  return result.game;
}
function tick(game, seconds, isolated = false) {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) {
    if (isolated) { game.time += DT; game.updatePlatforms(DT); game.updatePlayer(DT); }
    else game.update(DT);
    game.input.clearFrame();
  }
}
function hold(game, action, down = true) { game.input.virtual(action, down, 'test'); }
function place(game, x, surface = 600) {
  game.input.reset();
  Object.assign(game.player, { x, y: surface - 46, w: 32, h: 46, vx: 0, vy: 0, grounded: true,
    coyote: .12, jumpBuffer: 0, airJumps: 0, dead: false, invuln: 0, standingPlatform: null,
    slide: false, dashTime: 0, power: null, powerTime: 0, actionCooldown: 0 });
  game.mode = 'playing';
}
function safeWorld(game) {
  game.enemies = []; game.hazards = []; game.collectibles = []; game.checkpoints = []; game.secrets = [];
  game.boss = null; game.exit.open = false; delete game.level.water;
  game.platforms = [{ x: 0, y: 600, w: game.level.width, h: 300, type: 'ground', active: true,
    baseX: 0, baseY: 600, phase: 0, dx: 0, dy: 0 }];
}
function collect(game, type) {
  game.collectibles = [{ type, x: game.player.x + 16, y: game.player.y + 20, taken: false }];
  game.updateCollectibles();
}
function test(name, run) {
  try { run(); checks.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { failed++; checks.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n      ' + error.message); }
}

test('Every authored stage loads with independent objects, a stable key and a stable spawn', () => {
  const { game, window } = environment();
  assert.equal(window.LUMEN_LEVELS.length, 12);
  // Les clés sont le contrat des sauvegardes : uniques, et jamais recyclées.
  const keys = window.LUMEN_LEVELS.map(level => level.key);
  assert.equal(new Set(keys).size, keys.length, 'Deux chapitres partagent une clé : ' + keys.join(', '));
  assert.ok(keys.every(key => typeof key === 'string' && key.length > 2));
  for (let index = 0; index < STAGE_COUNT; index++) {
    game.loadLevel(index);
    assert.equal(game.levelIndex, index);
    assert.equal(game.level.key, keys[index]);
    // L'observatoire n'est pas un chapitre : ni fragments, ni lanternes, ni
    // médailles. Il est vérifié séparément.
    if (game.level.hub) { assert.ok(game.level.characters.length >= 2); continue; }
    assert.equal(game.collectibles.filter(c => c.type === 'star').length, 3);
    assert.ok(game.checkpoints.length >= 2);
    assert.ok(game.secrets.length >= 1);
    assert.equal(game.level.id, index);
    assert.ok(game.level.medalTargets.gold > 0);
    assert.ok(game.level.medalTargets.silver > game.level.medalTargets.gold);
    for (const type of ['breeze', 'bloom', 'comet']) assert.ok(game.collectibles.some(c => c.type === type));
    tick(game, .15);
    assert.equal(game.mode, 'playing');
    assert.ok(game.player.grounded);
    assert.equal(game.player.hp, 3);
    game.collectibles[0].taken = true;
    game.loadLevel(index);
    assert.equal(game.collectibles[0].taken, false);
  }
  assert.equal(window.LUMEN_LEVELS[0].collectibles[0].taken, undefined);
});

test('New chapters have long authored routes, safe lanterns, echo detours and distinct creatures', () => {
  const { window } = environment();
  for (const stage of [7, 8]) {
    const level = window.LUMEN_LEVELS[stage];
    assert.ok(level.width >= 5600);
    assert.ok(level.checkpoints.length >= 3);
    assert.ok(level.platforms.filter(p => p.type === 'echo').length >= 2);
    assert.ok(level.collectibles.some(c => c.type === 'echo'));
    for (const type of ['sleeper', 'swarm']) {
      const e = level.enemies.find(enemy => enemy.type === type);
      assert.ok(e, 'Missing ' + type + ' in chapter ' + stage);
      assert.equal(e.w, type === 'sleeper' ? 44 : 54);
      assert.equal(e.h, 36);
    }
  }
  assert.ok(window.LUMEN_LEVELS.slice(0, 7).filter(l => l.collectibles.some(c => c.type === 'echo')).length >= 3);
  const final = window.LUMEN_LEVELS[FINAL_INDEX], arenaStart = final.width - 1350;
  assert.ok(final.platforms.some(p => p.type === 'ground' && p.x <= arenaStart && p.x + p.w >= final.width));
  assert.ok(final.platforms.every(p => p.type === 'ground' || p.x + p.w <= arenaStart));
  assert.ok(final.hazards.every(h => h.x + h.w <= arenaStart));
});

test('Jump height varies with release and lands without sinking', () => {
  const heights = [];
  for (const short of [false, true]) {
    const game = fresh(); safeWorld(game); place(game, 100);
    let highest = game.player.y;
    hold(game, 'jump');
    for (let frame = 0; frame < 150; frame++) {
      if (short && frame === 5) hold(game, 'jump', false);
      tick(game, DT);
      highest = Math.min(highest, game.player.y);
    }
    heights.push(554 - highest);
    assert.ok(game.player.grounded);
    assert.equal(game.player.y, 554);
  }
  assert.ok(heights[0] > 115 && heights[0] < 130, JSON.stringify(heights));
  assert.ok(heights[1] < heights[0] * .6, JSON.stringify(heights));
});

test('Song flight is permanent, limited to one air jump and isolated from classic chapters', () => {
  for (const song of [false, true]) {
    const game = fresh(); safeWorld(game); place(game, 100);
    game.level.song = song;
    hold(game, 'jump'); tick(game, .15);
    hold(game, 'jump', false); tick(game, .03);
    hold(game, 'jump'); tick(game, DT);
    assert.equal(game.player.airJumps, song ? 1 : 0);
    if (song) assert.ok(game.player.vy < -600);
    hold(game, 'jump', false); tick(game, .03);
    hold(game, 'jump'); tick(game, DT);
    assert.equal(game.player.airJumps, song ? 1 : 0);
    assert.equal(game.player.power, null);
  }
});

test('Song glide slows descent only while jump is held and never changes classic gravity', () => {
  for (const song of [false, true]) {
    const game = fresh(); safeWorld(game); place(game, 100);
    game.level.song = song;
    Object.assign(game.player, { y: 220, grounded: false, coyote: 0, airJumps: 1, vy: 300 });
    hold(game, 'jump'); tick(game, .1);
    assert.equal(game.player.gliding, song);
    assert.ok(song ? game.player.vy <= 140 : game.player.vy > 400);
    hold(game, 'jump', false); tick(game, .1);
    assert.equal(game.player.gliding, false);
    assert.ok(game.player.vy > 300);
  }
});

test('The three song islands are independent and progression cannot skip an island', () => {
  const { game, window } = environment();
  assert.equal(window.LumenSong.ISLANDS.length, 3);
  assert.equal(game.startSong(1), false);
  assert.equal(game.startSong(-1), false);
  assert.equal(game.startSong(0), true);
  assert.equal(game.session, 'song');
  assert.equal(game.exit.open, false);
  assert.equal(game.complete(), false);
  assert.equal(game.song.lights.length, 3);
  game.song.lights[0].found = true;
  game.retry();
  assert.equal(game.song.lights[0].found, false);
  assert.equal(game.levelIndex, -1);
  for (let index = 0; index < 3; index++) {
    const level = window.LumenSong.create(index);
    assert.equal(level.collectibles.filter(entry => entry.type === 'star').length, 3);
    assert.ok(level.platforms.length >= 12);
    assert.ok(level.checkpoints.length >= 3);
    assert.ok(level.song.wind.length > 0);
  }
});

test('Only actual resonance rescues echoes, opens the portal and survives a fall', () => {
  const { game } = environment(); game.startSong(0);
  const echo = game.song.lights[0];
  place(game, echo.x - 16); tick(game, .1);
  assert.equal(echo.found, false);
  hold(game, 'action'); tick(game, .4);
  assert.equal(echo.found, true);
  assert.equal(game.song.count, 1);
  assert.equal(game.exit.open, false);
  const score = game.levelScore;
  tick(game, .4);
  assert.equal(game.levelScore, score);
  game.die(); tick(game, .7);
  assert.equal(game.mode, 'playing');
  assert.equal(game.song.count, 1);
  assert.equal(game.lives, 5);
  for (const remaining of game.song.lights.filter(entry => !entry.found)) {
    game.emitResonance(remaining.x, remaining.y, 180);
    tick(game, .3);
  }
  assert.equal(game.song.count, 3);
  assert.equal(game.exit.open, true);
});

test('Airborne notes recharge flight once, form a bounded combo and expire on pause-safe simulation time', () => {
  const { game } = environment(); game.startSong(0); safeWorld(game);
  Object.assign(game.player, { x: 200, y: 220, grounded: false, coyote: 0, airJumps: 1 });
  game.collectibles = [{ type: 'coin', x: 216, y: 240 }];
  game.updateCollectibles(); game.updateCollectibles();
  assert.equal(game.player.airJumps, 0);
  assert.equal(game.song.combo, 1);
  assert.equal(game.song.airNotes, 1);
  const time = game.song.comboTime;
  game.pause(); tick(game, 8);
  assert.equal(game.song.comboTime, time);
  game.resume(); tick(game, 4.2);
  assert.equal(game.song.combo, 0);
  assert.equal(game.song.bestCombo, 1);
});

test('Wind lifts a held glide, while release restores gravity', () => {
  const { game } = environment(); game.startSong(0); safeWorld(game);
  Object.assign(game.player, { x: 2120, y: 360, vy: 100, grounded: false, coyote: 0, airJumps: 1 });
  hold(game, 'jump'); tick(game, .4);
  assert.equal(game.player.gliding, true);
  assert.ok(game.player.vy < 0);
  hold(game, 'jump', false); tick(game, .4);
  assert.ok(game.player.vy > 0);
});

test('Island two lets each player call reverse one current once, with real lateral flight in both styles', () => {
  for (const style of ['gentle', 'flow']) {
    const { game, window } = environment();
    const authored = JSON.stringify(window.LumenSong.ISLANDS);
    game.applyLevel(window.LumenSong.create(1, style), -1);
    const current = game.song.wind.find(wind => wind.respondsToCall);
    assert.equal(game.song.wind.filter(wind => wind.respondsToCall).length, 1);
    place(game, 2000, 270);
    Object.assign(game.player, { grounded: false, coyote: 0, airJumps: 1, vy: 100 });
    hold(game, 'jump'); tick(game, .2);
    assert.ok(game.player.x < 1980, 'The initial current must carry a glide left.');
    hold(game, 'action'); tick(game, .05); hold(game, 'action', false);
    assert.equal(current.drift, 150);
    const turningPoint = game.player.x;
    tick(game, .3);
    assert.ok(game.player.x > turningPoint + 25, 'The same glide must now go right.');
    assert.equal(current.drift, 150, 'One expanding wave must not flip a current every frame.');
    game.emitResonance(2010, 210, 180, 'chime'); tick(game, .2);
    assert.equal(current.drift, 150, 'Relays must not undo the player decision.');
    game.pause(); tick(game, 4); assert.equal(current.drift, 150); game.resume();
    place(game, 2000, 270); game.usePower(); tick(game, .1);
    assert.equal(current.drift, -150, 'A new player call reverses it again.');
    assert.equal(JSON.stringify(window.LumenSong.ISLANDS), authored);
    game.applyLevel(window.LumenSong.create(1, style), -1);
    assert.equal(game.song.wind.find(wind => wind.respondsToCall).drift, -150);
    game.start(0); assert.equal(game.song, null);
  }
});

test('Island three moves one echo along existing ledges, pauses it and rescues it through a real call', () => {
  for (const style of ['gentle', 'flow']) {
    const { game, window } = environment();
    const authored = JSON.stringify(window.LumenSong.ISLANDS);
    game.applyLevel(window.LumenSong.create(2, style), -1);
    const echo = game.song.lights.find(entry => entry.roam);
    assert.equal(game.song.lights.filter(entry => entry.roam).length, 1);
    assert.ok(echo.roam.speed < 320, 'The echo can be caught without waiting for a cycle.');
    const origin = { x: echo.x, y: echo.y };
    game.pause(); tick(game, 3); assert.deepEqual({ x: echo.x, y: echo.y }, origin);
    game.resume(); tick(game, 2);
    assert.ok(echo.x < origin.x - 150 && echo.y > origin.y);
    assert.equal(echo.found, false);
    tick(game, 2);
    assert.ok(echo.x >= echo.roam.x && echo.x <= echo.originX);
    assert.ok(echo.y >= echo.originY && echo.y <= echo.roam.y);
    place(game, echo.x - 16, echo.y + 24);
    hold(game, 'action'); tick(game, .15); hold(game, 'action', false);
    assert.equal(echo.found, true);
    assert.equal(game.song.count, 1);
    const rescued = { x: echo.x, y: echo.y };
    tick(game, .6); assert.deepEqual({ x: echo.x, y: echo.y }, rescued);
    assert.equal(JSON.stringify(window.LumenSong.ISLANDS), authored);
  }
});

test('Island ideas do not add notes, distance, platforms or another mechanic to the first island', () => {
  const { window } = environment();
  const islands = window.LumenSong.ISLANDS;
  assert.deepEqual(Array.from(islands, island => island.width), [4200, 4700, 5100]);
  assert.deepEqual(Array.from(islands, island => island.collectibles.filter(item => item.type === 'coin').length), [73, 82, 90]);
  assert.deepEqual(Array.from(islands, island => island.platforms.filter(platform => platform.type === 'ground').length), [4, 5, 5]);
  assert.deepEqual(Array.from(islands, island => island.platforms.filter(platform => platform.type !== 'ground').length), [9, 12, 13]);
  assert.deepEqual(Array.from(islands, island => island.wind.filter(current => current.respondsToCall).length), [0, 1, 0]);
  assert.deepEqual(Array.from(islands, island => island.lights.filter(echo => echo.roam).length), [0, 0, 1]);
});

test('Balade returns near the fall, Elan returns to a lantern, and neither loses rescued echoes', () => {
  for (const style of ['gentle', 'flow']) {
    const { game } = environment(); game.startSong(0, { style });
    place(game, 700); tick(game, .1);
    assert.ok(game.song.safe.x > 650);
    const expected = style === 'gentle' ? game.song.safe.x : game.checkpoint.x;
    game.die(); tick(game, .6);
    assert.equal(game.mode, 'playing');
    assert.equal(game.player.x, expected);
    assert.equal(game.lives, 5);
  }
});

test('Song records persist separately; the next resting island still requires its preceding act', () => {
  const { game, storage } = environment(); game.startSong(0, { style: 'flow' });
  for (const echo of game.song.lights) { game.emitResonance(echo.x, echo.y, 180); tick(game, .3); }
  game.elapsed = 80; game.levelStars = 3;
  const unlocked = [...game.progress.unlocked];
  game.complete();
  assert.equal(game.mode, 'complete');
  assert.equal(game.store.chapter(game.level.key + ':flow').bestTimedTime, 80);
  assert.deepEqual([...game.progress.unlocked], unlocked);
  assert.equal(game.store.chapter('prairies-aurore'), null);
  const restored = environment(storage).game;
  assert.equal(restored.nextSongIndex(), 0, 'The next island cannot be proposed before its act.');
  assert.equal(restored.startSong(1), false);
  restored.start(0);
  assert.equal(restored.song, null);
  assert.equal(restored.session, 'campaign');
});

test('Coyote jump succeeds after walking off a real ledge, then expires', () => {
  const game = fresh(); safeWorld(game);
  game.platforms[0].w = 220;
  place(game, 185); game.player.vx = 320; hold(game, 'right');
  while (game.player.grounded) tick(game, DT);
  tick(game, .05); hold(game, 'jump'); tick(game, DT);
  assert.ok(game.player.vy < -600);
  assert.equal(game.player.coyote, 0);
  place(game, 230, 550); game.player.grounded = false; game.player.coyote = .01;
  tick(game, .03); hold(game, 'jump'); tick(game, DT);
  assert.ok(game.player.vy > 0, 'A normal jump must not be available after coyote time expires.');
});

test('Buffered jump fires on landing, including a jump pressed in the air', () => {
  const game = fresh(); safeWorld(game); place(game, 100, 565);
  game.player.grounded = false; game.player.coyote = 0; game.player.vy = 320;
  hold(game, 'jump');
  let bounced = false;
  for (let i = 0; i < 25; i++) { tick(game, DT); if (game.player.vy < -600) bounced = true; }
  assert.ok(bounced, 'The buffered input was lost before landing.');
});

test('A buffered tap released before landing produces a short jump', () => {
  const game = fresh(); safeWorld(game); place(game, 100, 565);
  game.player.grounded = false; game.player.coyote = 0; game.player.vy = 320;
  hold(game, 'jump'); tick(game, DT); hold(game, 'jump', false);
  let bounced = false, highest = 554;
  for (let i = 0; i < 90; i++) {
    tick(game, DT);
    if (game.player.vy < 0) bounced = true;
    if (bounced) highest = Math.min(highest, game.player.y);
  }
  assert.ok(bounced, 'The released buffered tap must still trigger a jump.');
  assert.ok(554 - highest > 20 && 554 - highest < 45, 'A released tap must not become a full-height jump.');
  assert.ok(game.player.grounded);
});

test('Horizontal and vertical moving platforms carry a standing player', () => {
  for (const axis of ['x', 'y']) {
    const game = fresh(); safeWorld(game);
    const moving = { x: 400, y: 470, baseX: 400, baseY: 470, w: 190, h: 22,
      type: 'moving', axis, speed: .75, range: 55, phase: 0, active: true, dx: 0, dy: 0 };
    game.platforms.push(moving); place(game, 440, 470); game.player.standingPlatform = moving;
    const offset = axis === 'x' ? game.player.x - moving.x : game.player.y + 46 - moving.y;
    tick(game, 1, true);
    assert.ok(game.player.grounded, axis + ' carry lost grounding');
    const after = axis === 'x' ? game.player.x - moving.x : game.player.y + 46 - moving.y;
    assert.ok(Math.abs(after - offset) < .01, axis + ' platform slipped under the player');
  }
});

test('Crumble/reform, vanish cycle, spring boost and conveyor transport work', () => {
  const game = fresh(); safeWorld(game);
  const base = { x: 100, y: 500, baseX: 100, baseY: 500, w: 180, h: 22, active: true, phase: 0,
    dx: 0, dy: 0, crumbleTimer: 0, reformTimer: 0 };
  const crumble = { ...base, type: 'crumble' }; game.platforms.push(crumble); place(game, 150, 500);
  tick(game, .1, true); assert.ok(crumble.crumbleTimer > 0);
  tick(game, .65, true); assert.equal(crumble.active, false);
  tick(game, 3.7, true); assert.equal(crumble.active, true);
  const vanish = { ...base, type: 'vanish' }; game.platforms = [vanish];
  game.time = 3.8; game.updatePlatforms(DT); assert.equal(vanish.active, false);
  game.time = 5; game.updatePlatforms(DT); assert.equal(vanish.active, true);
  game.platforms = [{ ...base, type: 'spring' }]; place(game, 150, 500); tick(game, DT, true);
  assert.ok(game.player.vy < -900);
  const conveyor = { ...base, type: 'conveyor', direction: -1, speed: 100 };
  game.platforms = [conveyor]; place(game, 180, 500); game.player.standingPlatform = conveyor;
  tick(game, .3, true); assert.ok(game.player.x < 150);
});

test('Checkpoint heals, death costs exactly one life, respawn restores a safe state', () => {
  const game = fresh();
  game.enemies = []; game.hazards = []; game.collectibles = [];
  const checkpoint = game.checkpoints[0]; place(game, checkpoint.x - 16, checkpoint.y);
  game.player.hp = 1; tick(game, DT);
  assert.equal(checkpoint.active, true); assert.equal(game.player.hp, 3);
  const saved = { ...game.checkpoint }, lives = game.lives;
  game.player.power = 'comet'; game.player.powerTime = 30;
  game.die(); game.die(); assert.equal(game.lives, lives - 1);
  tick(game, .9);
  assert.equal(game.mode, 'playing'); assert.equal(game.player.dead, false);
  assert.ok(Math.abs(game.player.x - saved.x) < 1);
  assert.ok(Math.abs(game.player.y - saved.y) < 4);
  assert.equal(game.player.hp, 3); assert.equal(game.player.power, null); assert.ok(game.player.invuln > 1.8);
  game.lives = 1; game.die(); tick(game, 1); assert.equal(game.mode, 'gameover');
  game.retry(); assert.equal(game.mode, 'playing'); assert.equal(game.lives, 5);
});

test('Damage grace period prevents repeated hits; falling and lava are lethal', () => {
  const game = fresh(); safeWorld(game); place(game, 100);
  game.hurt(1, 200); game.hurt(1, 200); assert.equal(game.player.hp, 2);
  tick(game, 1.6); game.hurt(1, 200); assert.equal(game.player.hp, 1);
  place(game, 100, 900); tick(game, DT); assert.equal(game.mode, 'dead');
  game.loadLevel(4); game.enemies = []; place(game, 850, 690);
  tick(game, DT); assert.equal(game.mode, 'dead');
});

test('A lethal enemy contact stops the frame before the corpse can collect items', () => {
  const game = fresh(); safeWorld(game); place(game, 100);
  game.player.hp = 1;
  game.enemies = [{ x: 100, y: 566, w: 36, h: 34, alive: true, type: 'patrol', minX: 70, maxX: 180,
    vx: 0, vy: 0, facing: -1, phase: 0, timer: 1, spawnX: 100, spawnY: 566 }];
  game.collectibles = [{ type: 'coin', x: 116, y: 574, taken: false },
    { type: 'heart', x: 116, y: 574, taken: false }];
  tick(game, DT);
  assert.equal(game.mode, 'dead'); assert.equal(game.player.hp, 0);
  assert.equal(game.levelCoins, 0); assert.ok(game.collectibles.every(item => !item.taken));
});

test('Coins/stars/heart collect once; forty coins award exactly one extra life', () => {
  const game = fresh(); safeWorld(game); place(game, 100);
  const lives = game.lives;
  for (let i = 0; i < 40; i++) collect(game, 'coin');
  assert.equal(game.levelCoins, 40); assert.equal(game.lives, lives + 1); assert.equal(game.levelScore, 1000);
  game.updateCollectibles(); assert.equal(game.levelCoins, 40);
  collect(game, 'star'); assert.equal(game.levelStars, 1); assert.equal(game.levelScore, 1500);
  game.player.hp = 1; collect(game, 'heart'); assert.equal(game.player.hp, 2);
});

test('Breeze allows exactly one double jump and replenishes after landing', () => {
  const game = fresh(); safeWorld(game); place(game, 100); collect(game, 'breeze');
  hold(game, 'jump'); tick(game, .18); hold(game, 'jump', false); tick(game, .03);
  hold(game, 'jump'); tick(game, DT); assert.equal(game.player.airJumps, 1); assert.ok(game.player.vy < -600);
  hold(game, 'jump', false); tick(game, .08); const before = game.player.vy;
  hold(game, 'jump'); tick(game, DT); assert.equal(game.player.airJumps, 1); assert.ok(game.player.vy > before);
  hold(game, 'jump', false); tick(game, 1.2); assert.ok(game.player.grounded); assert.equal(game.player.airJumps, 0);
});

test('Bloom projectile kills a patrol and action respects its cooldown', () => {
  const game = fresh(); safeWorld(game); place(game, 100); collect(game, 'bloom');
  game.enemies = [{ x: 320, y: 566, w: 36, h: 34, alive: true, type: 'patrol', minX: 300, maxX: 440,
    vx: 0, vy: 0, facing: -1, phase: 0, timer: 1, spawnX: 320, spawnY: 566 }];
  hold(game, 'action'); tick(game, DT); assert.equal(game.projectiles.length, 1);
  game.usePower(); assert.equal(game.projectiles.length, 1);
  tick(game, .4); assert.equal(game.enemies[0].alive, false); assert.equal(game.levelScore, 150);
});

test('Comet produces a brief dash and invulnerability; powers expire cleanly', () => {
  const game = fresh(); safeWorld(game); place(game, 100); collect(game, 'comet');
  hold(game, 'action'); tick(game, .1);
  assert.ok(game.player.x > 180); assert.equal(game.player.vx, 910); assert.ok(game.player.invuln > 0);
  tick(game, .3); assert.ok(game.player.dashTime <= 0); assert.ok(game.player.vx < 910);
  game.player.powerTime = .01; tick(game, .03); assert.equal(game.player.power, null);
});

test('All four enemy behaviours run: patrol turn, hopper leap, turret shot, pursuing wisp', () => {
  const game = fresh(); safeWorld(game); place(game, 700);
  const make = (type, x) => ({ type, x, y: 566, w: 36, h: 34, alive: true, grounded: true,
    minX: x - 50, maxX: x + 100, vx: 0, vy: 0, facing: 1, phase: 0, timer: 0, spawnX: x, spawnY: 566 });
  const patrol = make('patrol', 200); patrol.x = patrol.maxX - 35;
  const hopper = make('hopper', 350), turret = make('turret', 450), chaser = make('chaser', 550);
  game.enemies = [patrol, hopper, turret, chaser];
  tick(game, .1);
  assert.ok(patrol.vx < 0); assert.ok(hopper.vy < 0); assert.ok(game.projectiles.some(s => !s.friendly));
  assert.ok(chaser.x > 550);
});

test('Completion persists records, opens the next stage and restores from localStorage', () => {
  const { game, storage } = environment(); game.loadLevel(0);
  game.levelStars = 2; game.levelCoins = 17; game.elapsed = 55; game.levelScore = 900;
  game.complete(); assert.equal(game.mode, 'complete'); assert.ok(game.isUnlocked(1));
  assert.equal(game.recordFor(0).stars, 2); assert.equal(game.recordFor(0).time, 55);
  // La progression est désormais nommée : elle survit à un chapitre inséré ailleurs.
  assert.ok(Object.prototype.hasOwnProperty.call(game.progress.chapters, 'prairies-aurore'));
  const restored = environment(storage).game;
  assert.equal(restored.recordFor(0).coins, 17); assert.ok(restored.isUnlocked(1)); assert.ok(!restored.isUnlocked(2));
  restored.start(2); assert.equal(restored.levelIndex, 0);
  restored.start(1); assert.equal(restored.levelIndex, 1);
});

test('A secret opens the bonus early without unlocking late story levels', () => {
  const { game, storage } = environment(); game.loadLevel(0);
  const area = game.secrets[0]; place(game, area.x + 10, area.y + 80);
  game.updateSecrets(); game.updateSecrets();
  assert.equal(game.secretCount, 1); assert.equal(game.levelScore, 750);
  assert.equal(game.progress.bonusUnlocked, true); assert.ok(game.isUnlocked(6)); assert.ok(!game.isUnlocked(7));
  game.start(6); game.complete(); assert.ok(!game.isUnlocked(7), 'Le bonus ne doit pas ouvrir la suite de la campagne.');
  assert.equal(environment(storage).game.progress.bonusUnlocked, true);
});

test('Inserting a chapter before the finale preserves dynamic progression flags', () => {
  const { game, window } = environment();
  const extra = window.LumenLevels.create(0);
  extra.name = 'Integration test garden'; extra.id = FINAL_INDEX; extra.key = 'jardin-de-test';
  window.LUMEN_LEVELS.splice(FINAL_INDEX, 0, extra);
  window.LUMEN_LEVELS.forEach((level, index) => { level.id = index; });
  game.loadLevel(FINAL_INDEX); game.complete();
  assert.equal(game.mode, 'complete'); assert.ok(game.isUnlocked(FINAL_INDEX + 1));
  // Le chapitre inséré a sa propre entrée ; il n'a volé le record de personne.
  assert.ok(game.progress.chapters['jardin-de-test']);
  assert.ok(!game.progress.chapters['coeur-eclipse']);
  game.start(FINAL_INDEX + 1); assert.equal(game.level.final, true); game.complete();
  assert.equal(game.mode, 'ending'); assert.equal(game.progress.finished, true);
});

test('Denied storage and malformed save data do not prevent play', () => {
  const denied = environment(new Map(), true).game; denied.start(0); denied.complete();
  assert.equal(denied.mode, 'complete'); assert.equal(denied.storageAvailable, false);
  const malformed = environment(new Map([['lumen.gardens.v1', '{broken json']])).game;
  malformed.start(0); tick(malformed, .2); assert.equal(malformed.mode, 'playing');
});

test('Boss wakes, alternates telegraph/leap/volley/recovery, and enters phase two', () => {
  const game = fresh(FINAL_INDEX); game.enemies = []; game.hazards = []; game.collectibles = []; game.checkpoints = [];
  place(game, 3500); game.player.invuln = 100;
  const seen = new Set();
  for (let i = 0; i < 1600; i++) { tick(game, DT); seen.add(game.boss.state); }
  for (const state of ['wake', 'telegraph', 'leap', 'recover', 'volley']) assert.ok(seen.has(state), 'Missing ' + state);
  assert.equal(game.boss.activated, true); assert.equal(game.exit.open, false);
  game.boss.hp = 6; game.updateBoss(DT); assert.equal(game.boss.phase, 2);
});

test('Boss armour rejects damage; a real falling stomp damages its lowered crown', () => {
  const game = fresh(FINAL_INDEX); game.enemies = []; game.hazards = []; game.collectibles = [];
  const boss = game.boss;
  assert.equal(game.hitBoss(2), false); assert.equal(boss.hp, 12);
  Object.assign(boss, { activated: true, state: 'recover', timer: 3, vulnerable: true, y: 530, hitFlash: 0 });
  place(game, boss.x + 45, boss.y + 15); game.player.grounded = false;
  game.player.vy = 240; game.player.previousBottom = boss.y + 9;
  game.updateBoss(DT);
  assert.equal(boss.hp, 10); assert.equal(game.player.vy, -650);
  assert.equal(game.hitBoss(2), false, 'The same impact must not repeatedly damage the boss.');
  for (let i = 0; i < 5; i++) { boss.hitFlash = 0; boss.vulnerable = true; assert.equal(game.hitBoss(2), true); }
  assert.equal(boss.hp, 0); assert.equal(boss.state, 'defeated'); assert.equal(game.exit.open, true);
  place(game, game.exit.x + 5); tick(game, DT); assert.equal(game.mode, 'ending'); assert.equal(game.progress.finished, true);
});

test('Boss death/respawn retains earned damage and reopens with a clear warning', () => {
  const game = fresh(FINAL_INDEX); place(game, 3500); game.boss.activated = true; game.boss.hp = 5;
  game.checkpoint = { x: 3404, y: 552 }; game.die(); tick(game, .9);
  assert.equal(game.mode, 'playing'); assert.equal(game.boss.hp, 5);
  assert.equal(game.boss.state, 'wake'); assert.equal(game.boss.vulnerable, false); assert.ok(game.boss.timer > 1.8);
});

test('Lagoon allows sustained swimming and a physical exit onto its higher shore', () => {
  const game = fresh(2); game.enemies = []; game.hazards = []; game.collectibles = [];
  place(game, 3760, 740); hold(game, 'jump'); hold(game, 'right');
  let landed = false;
  for (let i = 0; i < 600; i++) {
    tick(game, DT);
    if (game.player.x > 3930) { hold(game, 'right', false); hold(game, 'jump', false); }
    if (game.player.x >= 3890 && game.player.grounded && game.player.y <= 554) { landed = true; break; }
  }
  assert.ok(landed, 'The shore cannot be reached with the actual swimming controls.');
  assert.equal(game.mode, 'playing'); assert.equal(game.player.hp, 3);
});

test('All mandatory dry gaps have physical walking-jump solutions without powers', () => {
  // A segment rig uses the authored geometry and real updatePlayer/updatePlatforms.
  // Enemies are excluded here to isolate reachability from combat randomness.
  const paths = {
    0: [0, 1, 2, 3], 1: [0, 7, 1, 11, 12, 2, 16, 3],
    3: [0, 5, 6, 1, 7, 8, 2, 9, 10, 3, 11, 12, 4],
    4: [0, 1, 2, 3, 4], 5: [0, 1, 2, 3], 6: [0, 1, 2, 3, 4],
    7: [0, 1, 2, 3, 4, 5], 8: [0, 1, 2, 3, 4, 5],
    // Le verger de la Résonance : seuls les tronçons qui doivent rester
    // franchissables à pied figurent ici. Le gouffre et le passage du dormeur
    // sont commandés par la Résonance — un verbe permanent, jamais expirable —
    // et ont leurs propres contrôles de franchissabilité plus haut.
    9: [0, 2], [FINAL_INDEX]: [0, 1, 2, 3]
  };
  const failures = [];
  for (const [stage, route] of Object.entries(paths)) {
    for (let n = 0; n < route.length - 1; n++) {
      let success = false;
      for (const launchMargin of [70, 45, 90, 110, 25]) {
        const game = fresh(Number(stage)); game.enemies = []; game.collectibles = []; game.checkpoints = []; game.secrets = []; game.boss = null; game.exit.open = false;
        game.time = 0; game.updatePlatforms(0);
        const source = game.platforms[route[n]], target = game.platforms[route[n + 1]];
        place(game, source.x + source.w - launchMargin, source.y);
        game.player.standingPlatform = source; game.player.vx = 320;
        hold(game, 'right'); hold(game, 'jump');
        for (let i = 0; i < 190; i++) {
          // Release horizontal movement over a narrow target; air inertia remains real.
          if (game.player.x + 16 > target.x + target.w * .5 && target.w < 220) hold(game, 'right', false);
          tick(game, DT, true);
          const support = game.player.standingPlatform;
          if (i > 10 && game.player.grounded && support && game.player.x + 30 > target.x + 5 &&
              game.player.x < target.x + target.w - 5 && game.player.y + game.player.h <= target.y + 8) {
            success = true; break;
          }
          if (game.mode === 'dead' || game.player.y > 830) break;
        }
        if (success) break;
      }
      if (!success) failures.push('stage ' + stage + ': platform ' + route[n] + ' -> ' + route[n + 1]);
    }
  }
  assert.deepEqual(failures, []);
});

test('Every authored checkpoint respawns above stable ground without immediate damage', () => {
  for (let stage = 0; stage < STAGE_COUNT; stage++) {
    const game = fresh(stage);
    for (const checkpoint of game.checkpoints) {
      place(game, checkpoint.x - 16, checkpoint.y); game.updateCheckpoints();
      assert.equal(checkpoint.active, true, 'Checkpoint activation: ' + stage + '/' + checkpoint.x);
      game.lives = 5; game.die(); tick(game, 1.1);
      assert.equal(game.mode, 'playing', 'Checkpoint respawn: ' + stage + '/' + checkpoint.x);
      assert.ok(game.player.grounded, 'Checkpoint support: ' + stage + '/' + checkpoint.x);
      assert.equal(game.player.hp, 3, 'Checkpoint hazard: ' + stage + '/' + checkpoint.x);
    }
  }
});

test('Pause freezes simulation and resume clears held input', () => {
  const game = fresh(); hold(game, 'right'); tick(game, .2);
  game.pause(); const elapsed = game.elapsed, x = game.player.x;
  tick(game, 2); assert.equal(game.elapsed, elapsed); assert.equal(game.player.x, x);
  game.resume(); assert.equal(game.input.down('right'), false); tick(game, .1); assert.ok(game.elapsed > elapsed);
});

function creature(game, type, x, surface = 600, extra = {}) {
  const w = type === 'swarm' ? 54 : type === 'sleeper' ? 44 : 36, h = type === 'swarm' || type === 'sleeper' ? 36 : 34;
  const e = { type, x, y: surface - h, w, h, alive: true, grounded: true, minX: x - 100, maxX: x + 160,
    vx: 0, vy: 0, facing: -1, phase: 0, timer: 0, hp: 1, spawnX: x, spawnY: surface - h,
    state: type === 'sleeper' ? 'sleep' : 'orbit', chargeProgress: 0, scatterTime: 0, ...extra };
  game.enemies = [e];
  return e;
}

test('The sleeper only wakes when Lumen lingers, then charges and settles back', () => {
  const game = fresh(); safeWorld(game);
  const e = creature(game, 'sleeper', 400);
  // Standing far away leaves it asleep no matter how long the player waits.
  place(game, 100); tick(game, 1.4);
  assert.equal(e.state, 'sleep');
  assert.equal(e.chargeProgress, 0, 'Distance must not charge the sleeper.');
  // Brushing past a sleeping mound is deliberately harmless.
  place(game, 380); game.player.hp = 3; game.player.invuln = 0;
  tick(game, .4);
  assert.equal(game.player.hp, 3, 'A sleeping mound must not hurt on contact.');
  assert.ok(e.chargeProgress > 0 && e.chargeProgress < 1, 'Proximity must build tension gradually.');
  // Staying beside it does wake it, and then it is dangerous.
  tick(game, 1.3);
  assert.notEqual(e.state, 'sleep', 'Lingering beside the sleeper must wake it.');
  tick(game, .7);
  assert.equal(e.state, 'charge');
  assert.ok(Math.abs(e.vx) > 200, 'A charging sleeper must actually run.');
  place(game, 100); game.player.invuln = 100;
  tick(game, 3.6);
  assert.equal(e.state, 'sleep', 'The sleeper must settle back down once left alone.');
  assert.equal(e.chargeProgress, 0);
});

test('A stomped swarm scatters harmlessly before it disappears', () => {
  const game = fresh(); safeWorld(game);
  const e = creature(game, 'swarm', 400, 500, { grounded: false });
  place(game, 410);
  Object.assign(game.player, { y: e.y - 41, vy: 200, grounded: false, previousBottom: e.y + 6, invuln: 0 });
  game.updateEnemies(DT);
  assert.ok(e.scatterTime > 0, 'The swarm must scatter rather than vanish.');
  assert.equal(e.alive, true);
  assert.ok(game.player.vy < 0, 'Stomping a swarm must still bounce Lumen.');
  assert.equal(game.enemiesDefeated, 1);
  assert.equal(game.levelScore, 220);
  game.player.hp = 3; game.player.invuln = 0;
  tick(game, .5);
  assert.equal(game.player.hp, 3, 'A scattering swarm must not damage the player.');
  tick(game, 1);
  assert.equal(e.alive, false);
});

test('A hunting swarm leans towards Lumen without ever leaving its thicket', () => {
  const game = fresh(); safeWorld(game);
  const e = creature(game, 'swarm', 700, 500, { grounded: false });
  place(game, 300); game.player.invuln = 100;
  tick(game, 1); assert.equal(e.state, 'orbit');
  place(game, 560); game.player.invuln = 100;
  tick(game, 1);
  assert.equal(e.state, 'hunt');
  assert.ok(e.x < 700, 'A hunting swarm must drift towards the player.');
  tick(game, 6);
  assert.ok(e.x >= e.minX && e.x + e.w <= e.maxX, 'The swarm must stay inside its authored range.');
});

test('The echo bell reveals hidden ledges for four seconds, then hides them again', () => {
  const game = fresh(8); game.enemies = []; game.hazards = []; game.projectiles = [];
  const echoes = game.platforms.filter(p => p.type === 'echo');
  assert.ok(echoes.length >= 2, 'Chapter 9 must contain an echo detour.');
  assert.ok(echoes.every(p => !p.active), 'Echo ledges start intangible.');
  place(game, game.level.spawn.x, game.level.spawn.y + 46);
  collect(game, 'echo');
  assert.equal(game.player.power, 'echo');
  assert.equal(game.player.powerDuration, 40, 'The bell lasts longer than the other charms.');
  game.usePower();
  assert.ok(game.echoTime > 3.9);
  assert.ok(echoes.every(p => p.active), 'Using the bell must make the ledges solid.');
  // Changement délibéré : le grelot n'a plus sa recharge propre de 3,5 s, il
  // hérite de celle de la Résonance. Le révélé dure toujours 4 s — la seule
  // différence est qu'on peut le rallumer sous ses pieds, ce que le cahier des
  // charges exige explicitement (« ne jamais bloquer le joueur »).
  assert.ok(game.player.actionCooldown > .7 && game.player.actionCooldown <= .9,
    'Le grelot suit désormais la recharge de la Résonance.');
  tick(game, 3.2);
  assert.ok(echoes.every(p => p.active && p.warning), 'The last second must warn before the ledges fade.');
  tick(game, 1.1);
  assert.ok(echoes.every(p => !p.active), 'The reveal must expire on its own.');
  assert.equal(game.player.power, 'echo', 'Ringing the bell must not consume the charm itself.');
});

test('Every power announces its own expiry and leaves a distinct sound', () => {
  for (const power of ['bloom', 'breeze', 'comet', 'echo']) {
    const game = fresh(); safeWorld(game); place(game, 100);
    collect(game, power);
    game.player.powerTime = 5.02; game.audio.sounds.length = 0;
    tick(game, .1);
    assert.ok(game.player.powerWarning, power + ' must warn before it fades.');
    assert.ok(game.audio.sounds.includes('powerWarning'), power + ' is missing its warning sound.');
    game.player.powerTime = .01; tick(game, .05);
    assert.equal(game.player.power, null);
    assert.ok(game.audio.sounds.includes('expire_' + power), power + ' is missing its own expiry sound.');
  }
});

test('Each garden throws its own debris when Lumen lands', () => {
  for (const [stage, type] of [[0, 'leaf'], [2, 'bubble'], [4, 'ember'], [5, 'flake']]) {
    const game = fresh(stage); game.particles = [];
    game.groundBurst(200, 600, 8, 90);
    assert.ok(game.particles.length > 0, 'No debris in stage ' + stage);
    assert.ok(game.particles.every(p => p.type === type), 'Stage ' + stage + ' should throw ' + type);
  }
});

test('Medals weigh fragments, damage and time, and a weaker run never demotes one', () => {
  const game = fresh(0);
  const targets = game.level.medalTargets;
  assert.equal(game.medalFor(3, 0, targets.gold - 5), 'gold');
  assert.equal(game.medalFor(3, 2, targets.gold - 5), 'silver', 'Damage must cost the gold medal.');
  assert.equal(game.medalFor(3, 0, targets.gold + 5), 'silver', 'Time must cost the gold medal.');
  assert.equal(game.medalFor(1, 0, targets.gold - 5), 'bronze', 'Silver needs the fragments too.');
  assert.equal(game.medalFor(3, 0, targets.silver + 5), 'bronze');
  game.levelStars = 3; game.damageTaken = 0; game.elapsed = targets.gold - 10;
  game.complete();
  assert.equal(game.recordFor(0).medal, 'gold');
  const again = fresh(0); again.progress = game.progress;
  again.levelStars = 0; again.damageTaken = 5; again.elapsed = targets.silver + 60;
  again.store.profile = game.progress; again.complete();
  assert.equal(again.recordFor(0).medal, 'gold', 'A later, weaker run must not remove a medal.');
});

test('Timed runs record a personal best; exploration never overwrites the clock', () => {
  const { game } = environment(); game.start(0, { timed: true });
  let result = null; game.on('complete', detail => { result = detail; });
  assert.equal(game.runMode, 'timed');
  game.elapsed = 64; game.complete();
  assert.equal(result.timed, true); assert.equal(result.record, true);
  assert.equal(game.recordFor(0).bestTimedTime, 64);
  game.start(0, { timed: true }); game.elapsed = 81; game.complete();
  assert.equal(result.record, false, 'A slower race must not claim a record.');
  assert.equal(game.recordFor(0).bestTimedTime, 64);
  game.start(0, { timed: true }); game.elapsed = 40; game.complete();
  assert.equal(game.recordFor(0).bestTimedTime, 40);
  game.start(0); assert.equal(game.runMode, 'explore');
  game.elapsed = 9; game.complete();
  assert.equal(result.timed, false);
  assert.equal(game.recordFor(0).bestTimedTime, 40, 'Exploration must leave the record alone.');
  game.retry(); assert.equal(game.runMode, 'explore', 'Retry must keep the run mode it was started with.');
});

test('Each third of the boss taken announces itself and drives the music', () => {
  const game = fresh(FINAL_INDEX); place(game, 3500); game.player.invuln = 1e4;
  const b = game.boss; b.activated = true;
  assert.equal(b.stage, 1);
  b.hp = 7; game.updateBoss(DT);
  assert.equal(b.stage, 2); assert.ok(b.flashTimer > 0); assert.ok(game.flash);
  assert.equal(game.audio.bossPhase, 2, 'The score must follow the boss stage.');
  b.hp = 3; game.updateBoss(DT);
  assert.equal(b.stage, 3); assert.equal(game.audio.bossPhase, 3);
  game.loadLevel(0); assert.equal(game.audio.bossPhase, 0, 'Leaving the finale must clear the boss layer.');
});

test('Phase two adds a third attack pattern and narrows the arena around Lumen', () => {
  const game = fresh(FINAL_INDEX); game.enemies = []; game.hazards = []; game.collectibles = []; game.checkpoints = [];
  place(game, 3500); game.player.invuln = 1e4;
  const b = game.boss; b.activated = true; b.state = 'telegraph'; b.timer = .1; b.hp = 6;
  const openLeft = b.arenaLeft, openRight = b.arenaRight;
  const seen = new Set();
  for (let i = 0; i < 2600; i++) { tick(game, DT); seen.add(b.state); }
  assert.equal(b.phase, 2);
  assert.ok(seen.has('rain'), 'Phase two must introduce the falling-light pattern.');
  assert.ok(seen.has('leap') && seen.has('volley'), 'The earlier patterns must remain.');
  assert.ok(b.arenaActive && b.arenaLeft > openLeft && b.arenaRight < openRight, 'The arena must close in.');
  assert.ok(game.projectiles.every(s => s.y < 900), 'Falling light must stay inside the arena.');
  // The walls nudge rather than trap: Lumen is pushed back in, never crushed or killed.
  game.player.x = b.arenaLeft - 300; game.updateArena(b, DT);
  assert.ok(game.player.x >= b.arenaLeft);
  game.player.x = b.arenaRight + 300; game.updateArena(b, DT);
  assert.ok(game.player.x + game.player.w <= b.arenaRight);
  assert.equal(game.mode, 'playing');
});

test('Danger drives the extra music layer and clears when the threat is gone', () => {
  const game = fresh(); safeWorld(game); place(game, 400); game.player.invuln = 1e4;
  creature(game, 'chaser', 520, 560, { grounded: false });
  tick(game, 2);
  assert.ok(game.danger > .25, 'A pursuing creature must raise the tension layer.');
  assert.ok(game.audio.danger > 0, 'The tension must actually reach the score.');
  game.enemies = [];
  tick(game, 6);
  assert.ok(game.danger < .1, 'Tension must fall back once nothing is hunting.');
});

test('Losing a heart reports the damage for the interface and counts towards the medal', () => {
  const game = fresh(); safeWorld(game); place(game, 200);
  let hits = 0; game.on('damage', () => { hits++; });
  game.hurt(1, 400);
  assert.equal(hits, 1); assert.equal(game.damageTaken, 1);
  assert.ok(game.flash, 'A lost heart must flash the scene.');
  assert.ok(game.camera.shake > 0);
  game.player.invuln = 0; game.hurt(1, 400);
  assert.equal(hits, 2); assert.equal(game.damageTaken, 2);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * LA RÉSONANCE
 * Le verbe central du jeu. Ces contrôles portent sur ses règles, sur son
 * articulation avec les anciens pouvoirs, et sur la franchissabilité réelle
 * des passages qu'elle commande dans le chapitre qui l'enseigne.
 * ───────────────────────────────────────────────────────────────────────────*/

const RESONANCE_STAGE = DEFINITIONS.findIndex(level => level.key === 'verger-qui-reve');
const wakeableIn = (game, id) => game.wakeables.find(w => w.id === id);
/** Le sol d'un réveillable : la ou les plateformes qu'il fait apparaître. */
const wakePlatforms = (game, id) => game.platforms.filter(p => p.wakeId === id);

test('La Résonance est toujours disponible, sans dépendre d’aucun pouvoir', () => {
  const game = fresh(RESONANCE_STAGE); place(game, 300);
  assert.equal(game.player.power, null);
  game.audio.sounds.length = 0;
  hold(game, 'action'); tick(game, DT);
  assert.equal(game.waves.length, 1, 'Le bouton action doit émettre une onde même sans pouvoir.');
  assert.ok(game.audio.sounds.includes('resonance'));
  // La recharge est courte et ne dépend pas non plus d'un pouvoir.
  assert.ok(game.player.actionCooldown > .7 && game.player.actionCooldown <= .8);
  hold(game, 'action', false); tick(game, .2); hold(game, 'action'); tick(game, DT);
  assert.equal(game.waves.length, 1, 'La recharge doit empêcher le martèlement.');
  tick(game, .7); hold(game, 'action', false); tick(game, DT);
  hold(game, 'action'); tick(game, DT);
  assert.ok(game.waves.length >= 1, 'Après la recharge, l’onde repart.');
});

test('Chaque pouvoir amplifie la Résonance sans jamais la remplacer', () => {
  const R = environment().window.LumenResonance;
  // La portée suit le pouvoir, mais l'onde part toujours.
  for (const [power, expected] of [[null, 1], ['echo', 1.8], ['comet', 1.15], ['bloom', 1], ['breeze', 1]]) {
    assert.equal(R.reachFor(power), R.BASE_REACH * expected, 'Portée de ' + power);
  }
  // La fleur solaire garde sa graine, la comète sa ruée, le grelot son révélé.
  const seeds = fresh(RESONANCE_STAGE); safeWorld(seeds); place(seeds, 300);
  collect(seeds, 'bloom'); seeds.player.actionCooldown = 0; seeds.usePower();
  assert.equal(seeds.projectiles.length, 1, 'La fleur solaire doit toujours tirer.');
  assert.equal(seeds.waves.length, 1, '…et émettre l’onde en même temps.');

  const dash = fresh(RESONANCE_STAGE); safeWorld(dash); place(dash, 300);
  collect(dash, 'comet'); dash.player.actionCooldown = 0; dash.usePower();
  assert.ok(dash.player.dashTime > 0, 'Le cœur comète doit toujours propulser.');
  assert.equal(dash.waves.length, 1);

  const bell = fresh(RESONANCE_STAGE); safeWorld(bell); place(bell, 300);
  collect(bell, 'echo'); bell.player.actionCooldown = 0; bell.usePower();
  assert.ok(bell.echoTime > 3.9, 'Le grelot doit toujours révéler les chemins.');
  assert.equal(bell.waves.length, 1);
  assert.equal(bell.waves[0].reach, R.BASE_REACH * 1.8, '…avec sa portée amplifiée.');
});

test('Un élément se réveille, dure, prévient, puis se rendort', () => {
  const game = fresh(RESONANCE_STAGE); game.enemies = [];
  const R = environment().window.LumenResonance;
  const bud = wakeableIn(game, 'verger-bouton-1');
  assert.ok(bud, 'Le chapitre doit contenir le bouton d’apprentissage.');
  assert.equal(bud.state, 'asleep');
  assert.equal(wakePlatforms(game, bud.id).every(p => !p.active), true, 'Sa surface n’existe pas avant le réveil.');

  place(game, bud.x - 30); game.player.actionCooldown = 0; game.usePower();
  tick(game, .35);
  assert.equal(bud.state, 'awake');
  assert.ok(wakePlatforms(game, bud.id).every(p => p.active), 'Le tremplin doit devenir solide.');
  assert.ok(!R.isFading(bud), 'Il ne clignote pas dès le premier instant.');

  // Le clignotement prévient avant la fin, et la surface le signale.
  tick(game, R.WAKE_TYPES.bloom.duration - R.WARNING + .1);
  assert.ok(R.isFading(bud), 'Il doit prévenir avant de s’éteindre.');
  assert.ok(wakePlatforms(game, bud.id).every(p => p.warning));
  tick(game, R.WARNING + .1);
  assert.equal(bud.state, 'asleep');
  assert.ok(wakePlatforms(game, bud.id).every(p => !p.active));
});

test('Ré-émettre prolonge au lieu de ne rien faire : le joueur ne peut pas être piégé', () => {
  const game = fresh(RESONANCE_STAGE); game.enemies = [];
  const bridge = wakeableIn(game, 'verger-pont-1');
  // Au bord de la prairie, sur le sol : c'est là que le joueur se tiendra.
  place(game, 1985);
  assert.ok(game.player.grounded, 'Le rig doit poser Lumen sur un sol réel.');
  game.player.actionCooldown = 0; game.usePower();
  tick(game, .35);
  assert.equal(bridge.state, 'awake');
  // On attend presque l'extinction, puis on rappelle le pont sous ses pieds.
  tick(game, 5.2);
  const before = bridge.remaining;
  assert.ok(before < 1, 'Le pont doit être sur le point de s’éteindre.');
  game.player.actionCooldown = 0; game.usePower(); tick(game, .35);
  assert.ok(bridge.remaining > before + 4, 'Le rappel doit rendre toute sa durée au pont.');
  assert.equal(bridge.state, 'awake');
});

test('Le carillon relaie l’onde une seule fois et la chaîne reste finie', () => {
  const game = fresh(RESONANCE_STAGE); game.enemies = [];
  const chime = wakeableIn(game, 'verger-carillon');
  const far = wakeableIn(game, 'verger-pont-gouffre');
  const R = environment().window.LumenResonance;

  // Depuis la rive, le cœur du grand pont est HORS de portée directe :
  // sans cette vérité, le carillon ne servirait à rien et l'énigme n'existerait pas.
  const shore = { x: 2510 + 16, y: 554 + 22 };
  assert.ok(R.distance(shore.x, shore.y, far.x, far.y) > R.BASE_REACH,
    'Le grand pont doit être hors de portée directe depuis la rive.');
  assert.ok(R.distance(shore.x, shore.y, chime.x, chime.y) <= R.BASE_REACH,
    'Le carillon, lui, doit être à portée depuis la rive.');

  place(game, 2510); game.player.actionCooldown = 0; game.usePower();
  tick(game, .6);
  assert.equal(chime.state, 'awake', 'Le carillon doit s’être réveillé.');
  assert.equal(far.state, 'awake', 'Le relais doit avoir réveillé le grand pont.');
  const waveCount = game.waves.length;
  assert.ok(waveCount <= 3, 'La chaîne doit rester courte : ' + waveCount);
  // Pas d'emballement : on laisse tourner et le nombre d'ondes retombe à zéro.
  tick(game, 3);
  assert.equal(game.waves.length, 0, 'Aucune onde ne doit survivre indéfiniment.');
});

test('Le grand pont porte réellement Lumen au-dessus du gouffre, avec la vraie physique', () => {
  const game = fresh(RESONANCE_STAGE);
  game.enemies = []; game.collectibles = []; game.checkpoints = []; game.secrets = [];
  place(game, 2500); game.player.actionCooldown = 0;
  game.usePower();
  tick(game, .6);
  hold(game, 'right'); hold(game, 'run');
  let crossed = false;
  for (let i = 0; i < 120 * 5; i++) {
    tick(game, DT);
    if (game.player.x > 2990 && game.player.grounded) { crossed = true; break; }
    if (game.mode !== 'playing') break;
  }
  assert.ok(crossed, 'Le pont réveillé doit permettre de franchir le gouffre en marchant.');
  assert.equal(game.mode, 'playing');
  assert.equal(game.player.hp, 3, 'La traversée ne doit rien coûter.');
});

test('Sans le carillon, le gouffre reste infranchissable — l’énigme existe vraiment', () => {
  const game = fresh(RESONANCE_STAGE);
  game.enemies = []; game.collectibles = []; game.checkpoints = []; game.secrets = [];
  // On retire le carillon : plus aucun relais, donc plus aucun pont.
  game.wakeables = game.wakeables.filter(w => w.id !== 'verger-carillon');
  place(game, 2500); game.player.actionCooldown = 0; game.usePower(); tick(game, .6);
  assert.equal(wakeableIn(game, 'verger-pont-gouffre').state, 'asleep');
  hold(game, 'right'); hold(game, 'run');
  let reached = false;
  for (let i = 0; i < 120 * 4; i++) { tick(game, DT); if (game.player.x > 2960) reached = true; if (game.mode !== 'playing') break; }
  assert.equal(reached, false, 'Sans relais, la rive opposée doit rester hors d’atteinte.');
});

test('La créature réveillée en douceur devient une marche, et cesse d’être une menace', () => {
  const game = fresh(RESONANCE_STAGE); game.collectibles = []; game.checkpoints = [];
  const sleeper = game.enemies.find(e => e.type === 'sleeper');
  assert.ok(sleeper, 'Le chapitre doit contenir le dormeur du temps 5.');
  place(game, 3540); game.player.actionCooldown = 0; game.player.invuln = 0;
  game.usePower(); tick(game, .5);
  assert.equal(sleeper.state, 'calm', 'L’onde doit lever le dormeur en douceur.');

  // Elle ne charge plus, et le contact ne coûte rien.
  const hp = game.player.hp;
  place(game, sleeper.x + 4); game.player.y = sleeper.y - 20; game.player.invuln = 0;
  tick(game, .4);
  assert.equal(game.player.hp, hp, 'Une créature apaisée ne doit pas blesser.');
  assert.notEqual(sleeper.state, 'charge');

  // Et son dos porte : on se pose dessus avec la vraie physique.
  place(game, sleeper.x + 6, sleeper.y - 40);
  game.player.grounded = false; game.player.vy = 120;
  let landed = false;
  for (let i = 0; i < 90; i++) { tick(game, DT); if (game.player.grounded && game.player.y + game.player.h <= sleeper.y + 2) { landed = true; break; } }
  assert.ok(landed, 'Le dos de la créature apaisée doit porter Lumen.');
});

test('Le retour à la lanterne rendort tout le jardin, sans état à moitié', () => {
  const game = fresh(RESONANCE_STAGE);
  place(game, 2500); game.player.actionCooldown = 0; game.usePower(); tick(game, .6);
  const sleeper = game.enemies.find(e => e.type === 'sleeper');
  sleeper.state = 'calm'; sleeper.calmTime = 5;
  assert.ok(game.wakeables.some(w => w.state === 'awake'));
  game.lives = 5; game.die(); tick(game, 1.1);
  assert.equal(game.mode, 'playing');
  assert.ok(game.wakeables.every(w => w.state === 'asleep'), 'Tout doit être rendormi au respawn.');
  assert.equal(game.waves.length, 0);
  assert.equal(sleeper.state, 'sleep');
  assert.ok(game.platforms.filter(p => p.wakeId).every(p => !p.active));
});

test('Les six temps du chapitre de la Résonance sont réellement présents', () => {
  const level = DEFINITIONS[RESONANCE_STAGE];
  const kinds = new Set(level.wakeables.map(w => w.type));
  // Trois interactions environnementales distinctes, pas trois portes identiques.
  assert.ok(kinds.has('bloom') && kinds.has('bridge') && kinds.has('chime'),
    'Les trois natures d’interaction doivent exister : ' + [...kinds].join(', '));
  assert.ok(level.enemies.some(e => e.type === 'sleeper'), 'La réaction d’une créature aussi.');
  // Un apprentissage sans danger : aucun piège, et un sol continu sous les
  // premiers boutons.
  assert.equal(level.hazards.length, 0);
  const ground = level.platforms.filter(p => p.type === 'ground');
  const learning = level.wakeables.filter(w => w.type === 'bloom' && w.x > 1100 && w.x < 2000);
  assert.ok(learning.length >= 3, 'Le temps d’apprentissage doit répéter l’idée.');
  for (const bud of learning) {
    assert.ok(ground.some(g => g.x <= bud.x && g.x + g.w >= bud.x), 'Un sol sûr sous chaque bouton d’apprentissage.');
  }
  assert.ok(level.hints.length >= 6, 'Chaque temps doit être annoncé.');
});

console.log('\n' + (checks.length - failed) + '/' + checks.length + ' integration checks passed.');
fs.writeFileSync(path.join(__dirname, 'engine-test-results.json'), JSON.stringify({ passed: checks.length - failed, failed, checks }, null, 2));
process.exitCode = failed ? 1 : 0;
