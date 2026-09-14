/* Drawing smoke tests for the real renderer, against a recording canvas stub.
 * Run from the LUMEN directory: node tests/test-renderer.cjs
 *
 * The renderer is the one module the engine tests cannot reach, and a drawing
 * routine that does not exist fails silently until a player opens that chapter.
 * These checks call the actual draw path for every theme, every creature, every
 * platform type and every particle shape, and fail on the first thrown error.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const checks = [];
let failed = 0;

/** A canvas 2D context that accepts every call and records the method names used. */
function context2d(calls) {
  const gradient = { addColorStop() {} };
  const target = {
    canvas: { width: 1280, height: 720 },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 40 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) })
  };
  return new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      if (typeof key !== 'string') return undefined;
      return (...args) => { calls.add(key); for (const a of args) if (Number.isNaN(a)) throw new TypeError('NaN passed to ' + key); };
    },
    set() { return true; }
  });
}

function environment() {
  const calls = new Set();
  const canvas = { clientWidth: 1280, clientHeight: 720, getContext: () => context2d(calls) };
  const window = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {},
    LumenAudio: class { setMuted() {} setTheme() {} setDanger() {} setBossPhase() {} unlock() {} resume() {} pause() {} sfx() {} }
  };
  const document = {
    hidden: false, addEventListener() {}, body: { classList: { contains: () => true } },
    createElement: () => ({ width: 1280, height: 720, getContext: () => context2d(calls) })
  };
  const sandbox = { window, document, localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, console };
  const ctx = vm.createContext(sandbox);
  for (const file of ['rng.js', 'save.js', 'resonance.js', 'modules.js', 'expedition.js', 'upgrades.js', 'renderer.js', 'levels.js', 'song.js', 'song-art.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
  window.canvas = canvas;
  const game = new window.LumenGame(canvas);
  return { game, window, calls };
}

function test(name, run) {
  try { run(); checks.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { failed++; checks.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n      ' + error.message); }
}

test('Every chapter draws from spawn without a missing routine', () => {
  const { game, window } = environment();
  for (let index = 0; index < window.LUMEN_LEVELS.length; index++) {
    game.loadLevel(index);
    for (let frame = 0; frame < 12; frame++) { game.update(1 / 120); game.renderer.draw(game, 1 / 60); }
  }
});

test('The title garden, the atlas pose and the portrait viewport all draw', () => {
  const { game } = environment();
  for (const mode of ['home', 'map', 'playing', 'paused', 'complete', 'ending', 'dead']) {
    game.mode = mode; game.renderer.draw(game, 1 / 60);
  }
  game.renderer.resize(420, 860);
  game.mode = 'playing'; game.renderer.draw(game, 1 / 60);
  assert.equal(game.renderer.worldWidth, 600, 'Portrait play must narrow the viewport.');
  game.renderer.resize(1280, 720);
});

test('All six creatures draw in every state they can reach', () => {
  const { game, calls } = environment();
  game.loadLevel(0);
  const poses = [
    { type: 'patrol' }, { type: 'hopper', vy: -200 }, { type: 'turret' }, { type: 'chaser' },
    { type: 'sleeper', state: 'sleep', chargeProgress: 0 },
    { type: 'sleeper', state: 'sleep', chargeProgress: .7 },
    { type: 'sleeper', state: 'wake' }, { type: 'sleeper', state: 'charge' }, { type: 'sleeper', state: 'settle' },
    { type: 'swarm', state: 'orbit' }, { type: 'swarm', state: 'hunt' },
    { type: 'swarm', state: 'hunt', scatterTime: 1.1 }, { type: 'swarm', state: 'hunt', scatterTime: .2 }
  ];
  game.enemies = poses.map((pose, i) => ({ x: 120 + i * 70, y: 560, w: 44, h: 36, alive: true,
    vx: 20, vy: 0, facing: 1, phase: i, timer: 1, hitFlash: 0, chargeProgress: 0, scatterTime: 0, ...pose }));
  calls.clear();
  for (let frame = 0; frame < 8; frame++) { game.time += .07; game.renderer.draw(game, 1 / 60); }
  assert.ok(calls.has('fill') && calls.has('stroke'), 'The creatures produced no drawing at all.');
});

test('Every platform type, hazard and collectible has artwork', () => {
  const { game } = environment();
  game.loadLevel(0);
  const types = ['ground', 'solid', 'moving', 'crumble', 'vanish', 'spring', 'conveyor', 'echo'];
  game.platforms = types.map((type, i) => ({ x: 100 + i * 150, y: 480, baseX: 100 + i * 150, baseY: 480,
    w: 140, h: type === 'ground' ? 300 : 22, type, active: true, phase: i * .4, dx: 0, dy: 0,
    crumbleTimer: type === 'crumble' ? .4 : 0, reformTimer: 0, direction: -1, range: 60, speed: .8, axis: 'y' }));
  game.hazards = [{ x: 400, y: 578, w: 70, h: 22, type: 'spikes' }, { x: 600, y: 638, w: 200, h: 262, type: 'lava' }];
  game.collectibles = ['coin', 'star', 'heart', 'bloom', 'breeze', 'comet', 'echo']
    .map((type, i) => ({ type, x: 160 + i * 120, y: 430, taken: false }));
  game.checkpoints = [{ x: 300, y: 600, active: false }, { x: 500, y: 600, active: true }];
  for (const echoTime of [0, 4, .6]) {
    game.echoTime = echoTime; game.updatePlatforms(1 / 120);
    // Inactive crumbling and vanishing ledges take their own drawing branches.
    game.renderer.draw(game, 1 / 60);
    game.platforms.forEach(p => { if (p.type === 'crumble' || p.type === 'vanish') p.active = !p.active; });
    game.renderer.draw(game, 1 / 60);
  }
});

test('Every particle shape and both projectile kinds draw', () => {
  const { game } = environment();
  game.loadLevel(0);
  game.particles = ['spark', 'star', 'leaf', 'petal', 'ember', 'flake', 'bubble', 'trail', 'stone', 'dust', 'ring', 'unknown']
    .map((type, i) => ({ x: 120 + i * 60, y: 400, vx: 30, vy: -20, life: .4, maxLife: .6, size: 4, color: '#ffd9a2', type }));
  game.projectiles = [
    { x: 200, y: 520, vx: 200, vy: 0, r: 10, friendly: false, life: 2 },
    { x: 320, y: 520, vx: -200, vy: 0, r: 8, friendly: true, life: 2 },
    { x: 440, y: 582, vx: 230, vy: 0, r: 14, friendly: false, life: 3, kind: 'wave' },
    { x: 560, y: 320, vx: 0, vy: 330, r: 11, friendly: false, life: 3, kind: 'rain' }
  ];
  game.floatingTexts = [{ x: 300, y: 400, text: '+220', life: 1, color: '#ffeaa8' }];
  game.flash = { color: '#ff9d8c', life: .2, maxLife: .32 };
  game.renderer.draw(game, 1 / 60);
});

test('The Veilleur draws through every stage, pattern and the closing arena', () => {
  const { game, window } = environment();
  const finalIndex = window.LUMEN_LEVELS.findIndex(level => level.final);
  game.loadLevel(finalIndex);
  const b = game.boss;
  for (const state of ['sleep', 'wake', 'telegraph', 'leap', 'volley', 'rain', 'recover', 'defeated']) {
    for (const stage of [1, 2, 3]) {
      for (const vulnerable of [false, true]) {
        Object.assign(b, { state, stage, vulnerable, activated: true, hp: stage === 3 ? 2 : stage === 2 ? 6 : 12,
          hitFlash: vulnerable ? .3 : 0, flashTimer: .4, arenaActive: stage > 1, arenaWarn: stage === 2 ? .8 : 0,
          rainMarkers: state === 'rain' ? [{ x: 3600, life: .7 }, { x: 3900, life: .3 }] : [] });
        game.camera.x = b.x - 400;
        game.renderer.draw(game, 1 / 60);
      }
    }
  }
});

test('The echo bell ring and the revealed ledges draw over their whole lifetime', () => {
  const { game } = environment();
  game.loadLevel(8);
  game.player.power = 'echo'; game.player.powerTime = 6; game.player.powerDuration = 40;
  for (const remaining of [4, 3.2, 2, .9, .2]) {
    game.echoTime = remaining; game.updatePlatforms(1 / 120);
    game.camera.x = Math.max(0, game.platforms.find(p => p.type === 'echo').x - 300);
    game.renderer.draw(game, 1 / 60);
  }
  // An expiring power also draws its countdown ring around Nilo.
  game.player.powerTime = 3; game.echoTime = 0; game.renderer.draw(game, 1 / 60);
});

test('Tout ce qui dort se dessine endormi, réveillé et clignotant', () => {
  const { game, window } = environment();
  const stage = window.LUMEN_LEVELS.findIndex(level => level.key === 'verger-qui-reve');
  assert.ok(stage >= 0, 'Le chapitre de la Résonance doit exister.');
  game.loadLevel(stage);
  const R = window.LumenResonance;
  // Chaque nature d'élément, dans chacun de ses états, avec sa géométrie.
  for (const state of ['asleep', 'awake', 'fading']) {
    for (const w of game.wakeables) {
      w.state = state === 'asleep' ? 'asleep' : 'awake';
      w.remaining = state === 'fading' ? .4 : R.WAKE_TYPES[w.type].duration;
    }
    game.updatePlatforms(1 / 120);
    for (const w of game.wakeables) { game.camera.x = Math.max(0, w.x - 400); game.renderer.draw(game, 1 / 60); }
  }
  // Et les ondes elles-mêmes, du premier instant à leur extinction.
  game.waves = [
    { x: 600, y: 560, radius: 20, reach: 180, life: .5, maxLife: .55, source: 'player', touched: new Set() },
    { x: 900, y: 500, radius: 170, reach: 180, life: .05, maxLife: .55, source: 'chime', touched: new Set() }
  ];
  game.camera.x = 400;
  game.renderer.draw(game, 1 / 60);
});

test('Nilo draws in every posture: running, airborne, sliding, hurt and defeated', () => {
  const { game } = environment();
  game.loadLevel(0);
  const poses = [
    { vx: 0, grounded: true }, { vx: 420, grounded: true }, { vx: -420, grounded: true },
    { vx: 200, grounded: false, vy: -400 }, { vx: 200, grounded: false, vy: 400 },
    { vx: 380, grounded: true, slide: true, h: 29 },
    { vx: 0, grounded: true, invuln: 1.2 }, { vx: 0, grounded: false, dead: true },
    { vx: 0, grounded: true, landTimer: .12, landStrength: .8 },
    { vx: 0, grounded: false, jumpTimer: .14 }, { vx: 60, grounded: true, runStartTimer: .11 }
  ];
  for (const pose of poses) for (const power of [null, 'bloom', 'breeze', 'comet', 'echo']) {
    Object.assign(game.player, { x: 300, y: 554, w: 32, h: 46, facing: 1, anim: 1, vy: 0, slide: false,
      invuln: 0, dead: false, landTimer: 0, jumpTimer: 0, runStartTimer: 0, power, powerTime: power ? 3 : 0 }, pose);
    game.renderer.draw(game, 1 / 60);
  }
});

test('Every song island draws all routes, flight and awakened states without mutating the simulation', () => {
  const { game, window, calls } = environment();
  for (let index = 0; index < 3; index++) {
    game.applyLevel(window.LumenSong.create(index), -1);
    for (const viewport of [[1440, 900], [390, 844], [844, 390], [2560, 1080]]) {
      game.renderer.resize(...viewport);
      for (const count of [0, 1, 3]) {
        game.song.count = count; game.song.bloom = count / 3;
        game.song.lights.forEach((echo, rank) => { echo.found = rank < count; });
        game.exit.open = count === 3;
        for (let camera = 0; camera < game.level.width; camera += 600) {
          game.camera.x = camera; game.player.gliding = true;
          const before = JSON.stringify([game.song, game.player, game.platforms]);
          game.renderer.draw(game, 1 / 60);
          assert.equal(JSON.stringify([game.song, game.player, game.platforms]), before);
          assert.ok(Number.isFinite(game.renderer.scale));
        }
      }
      assert.ok(game.renderer.worldWidth >= 500);
    }
  }
  assert.ok(calls.has('drawImage'));
});

test('Day and night artwork use distinct caches while preserving geometry and collected objects', () => {
  const { game, window } = environment();
  window.LumenAppearance = { current: 'light' };
  for (let index = 0; index < 3; index++) {
    game.applyLevel(window.LumenSong.create(index), -1);
    const state = JSON.stringify([game.player, game.platforms, game.collectibles, game.song]);
    for (const appearance of ['light', 'dark', 'light']) {
      window.LumenAppearance.current = appearance;
      for (const viewport of [[1440,900], [390,844], [844,390]]) {
        game.renderer.resize(...viewport);
        game.renderer.draw(game, 0);
        assert.ok(game.renderer.songKey.endsWith(appearance === 'dark' ? ':night' : ':day'));
        const cache = game.renderer.songAssets;
        game.renderer.draw(game, 0);
        assert.equal(game.renderer.songAssets, cache);
        assert.equal(JSON.stringify([game.player, game.platforms, game.collectibles, game.song]), state);
      }
    }
    assert.notDeepEqual(window.LumenSongArt.paletteFor(game.level.song.sky,'dark').sky,
      window.LumenSongArt.paletteFor(game.level.song.sky,'light').sky);
  }
  for (const appearance of ['dark', 'light']) {
    window.LumenAppearance.current=appearance; game.start(0); game.renderer.draw(game,0);
    assert.ok(game.renderer.skyCache.has('meadow:'+appearance));
  }
});

console.log('\n' + (checks.length - failed) + '/' + checks.length + ' drawing checks passed.');
fs.writeFileSync(path.join(__dirname, 'renderer-test-results.json'), JSON.stringify({ passed: checks.length - failed, failed, checks }, null, 2));
process.exitCode = failed ? 1 : 0;
