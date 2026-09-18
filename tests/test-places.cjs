/* Focused mechanics contracts. Position fixtures are named explicitly; whole
 * authored-route proofs live separately in test-places-playthrough.cjs. */
'use strict';
const assert = require('node:assert/strict');
const { environment } = require('./test-places-playthrough.cjs');
const DT = 1 / 120;
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS  ' + name); }
  catch (error) { failed++; console.error('FAIL  ' + name + '\n' + error.stack); }
}
function load(key) {
  const result = environment();
  result.game.loadLevel(result.window.LUMEN_LEVELS.findIndex(level => level.key === key));
  return result;
}
function tick(game, seconds) { for (let i = 0; i < Math.ceil(seconds / DT); i++) { game.update(DT); game.input.clearFrame(); } }
function call(game) { game.input.virtual('action', true, 'test'); tick(game, DT); game.input.virtual('action', false, 'test'); }
function position(game, x, y) {
  Object.assign(game.player, { x, y, vx: 0, vy: 0, grounded: false, standingPlatform: null, actionCooldown: 0 });
}

test('Six stable places add exactly two different decisions per act, each with fragments and safe lanterns', () => {
  const { window } = environment();
  const places = window.LUMEN_LEVELS.filter(level => level.place);
  assert.equal(places.length, 6); assert.equal(new Set(places.map(level => level.place.kind)).size, 6);
  for (const act of [1, 2, 3]) assert.equal(places.filter(level => level.journeyAct === act).length, 2);
  for (const level of places) {
    assert.equal(level.collectibles.filter(item => item.type === 'star').length, 3, level.key);
    assert.ok(level.checkpoints.length >= 2, level.key);
    for (const lantern of level.checkpoints) assert.ok(level.platforms.some(platform => platform.type === 'ground' && lantern.x >= platform.x && lantern.x <= platform.x + platform.w && lantern.y === platform.y), level.key + ': unsafe lantern');
    assert.ok(level.secrets.length >= 1, level.key);
  }
  assert.equal(places.find(level => level.place.kind === 'river').secrets.length, 4);
});

test('Position fixture: the sleeper only travels when calmed, physically carries its rider, then waits', () => {
  const { game } = load('dos-du-songe');
  const deck = game.place.deck;
  const initial = deck.x;
  tick(game, 1); assert.equal(deck.x, initial);
  position(game, deck.x + 90, deck.y - 46); tick(game, .05);
  assert.equal(game.player.standingPlatform, deck);
  call(game); tick(game, 2);
  assert.ok(deck.x > initial + 150);
  assert.ok(game.place.metrics.carriedDistance > 150);
  assert.equal(game.player.hp, 3);
  tick(game, 7); const stopped = deck.x; tick(game, 1);
  assert.equal(deck.x, stopped, 'expired calm should stop the mount, not drop its rider');
  assert.equal(game.player.standingPlatform, deck);
  assert.equal(game.player.hp, 3);
  game.die(); tick(game, 2);
  assert.equal(game.place.deck.x, game.level.place.fromX, 'a fall must not strand the mount across the void');
});

test('Position fixture: an autonomous star advances in awakened flowers and waits when their light ends', () => {
  const { game } = load('astre-a-guider');
  const start = game.place.astre.x;
  tick(game, 1); assert.equal(game.place.astre.x, start); assert.equal(game.exit.open, false);
  position(game, 410, 554); call(game); tick(game, 2);
  assert.ok(game.place.astre.x > start + 100);
  assert.equal(game.place.metrics.flowersWoken, 1);
  tick(game, 7); const waiting = game.place.astre.x; tick(game, 1);
  assert.equal(game.place.astre.x, waiting);
  assert.equal(game.exit.open, false);
});

test('Position fixture: the bridge needs every creature, relays once, expires and can always be recalled', () => {
  const { game } = load('pont-des-veilleurs');
  const platforms = game.platforms.filter(platform => platform.placeRole === 'living-bridge');
  assert.ok(platforms.every(platform => !platform.active));
  position(game, 650, 554); call(game); tick(game, .9);
  assert.equal(game.place.metrics.chainWakes, 3);
  assert.ok(platforms.every(platform => platform.active));
  assert.equal(game.place.propagation.length, 0);
  tick(game, 9); assert.ok(platforms.every(platform => !platform.active));
  call(game); tick(game, .9);
  assert.ok(platforms.every(platform => platform.active));
  assert.equal(game.place.metrics.chainWakes, 6);
});

test('Position fixture: all three river beacons require resonance and their transformation survives a fall', () => {
  const { game } = load('riviere-sans-lune');
  assert.equal(game.exit.open, false);
  for (const id of game.level.place.beacons) {
    const flower = game.wakeables.find(wakeable => wakeable.id === id);
    position(game, flower.x - 80, 554); call(game); tick(game, .5);
  }
  assert.equal(game.place.metrics.beaconsLit, 3);
  assert.equal(game.place.restored, true); assert.equal(game.exit.open, true);
  game.die(); tick(game, 2);
  assert.equal(game.place.restored, true); assert.equal(game.exit.open, true);
});

test('The tall garden starts alive below the old fixed screen and its camera follows world altitude', () => {
  const { game } = load('colonne-des-saisons');
  assert.ok(game.player.y > 830);
  tick(game, 1);
  assert.equal(game.mode, 'playing'); assert.equal(game.deaths, 0);
  assert.ok(game.camera.y > 1000);
  // Explicit position fixture for the generalized death boundary.
  position(game, 150, game.level.height - 60); tick(game, DT);
  assert.equal(game.mode, 'dead');
});

test('An idle controller never releases an unheld jump or cuts an automatic spring bounce', () => {
  const { game } = load('colonne-des-saisons');
  const spring = game.platforms.find(platform => platform.type === 'spring');
  // Landing fixture: no jump press precedes the automatic spring impulse.
  position(game, spring.x + 80, spring.y - 46);
  let highest = game.player.y;
  for (let frame = 0; frame < 100; frame++) {
    game.input.virtual('jump', false, 'idle-controller');
    assert.equal(game.input.released.has('jump'), false);
    tick(game, DT); highest = Math.min(highest, game.player.y);
  }
  assert.ok(spring.y - 46 - highest > 230, 'automatic spring impulse was cut without a release');
  game.input.virtual('jump', true, 'held-controller');
  game.input.virtual('jump', false, 'held-controller');
  assert.equal(game.input.released.has('jump'), true, 'a real release must still cut a manual jump');
});

test('Position fixture: rain grows only where sent, warns, expires and can grow the same foothold again', () => {
  const { game } = load('pluie-de-lumiere');
  const steps = game.platforms.filter(platform => platform.placeRole === 'rain-step');
  assert.ok(steps.every(platform => !platform.active));
  position(game, 455, 554); game.player.facing = 1;
  call(game); tick(game, 1.5);
  assert.equal(steps[0].active, true); assert.equal(steps[1].active, false);
  assert.ok(game.place.metrics.rainGrown >= 1);
  game.player.facing = -1; call(game); tick(game, 7.5);
  assert.equal(steps[0].warning, true);
  tick(game, 2); assert.equal(steps[0].active, false);
  game.player.facing = 1; call(game); tick(game, 2);
  assert.equal(steps[0].active, true);
});

test('A guarded place names what its exit is waiting for, and points at it once it is off screen', () => {
  const { game, window } = load('riviere-sans-lune');
  const objective = () => window.LumenPlaces.objective(game);
  const lit = () => objective().values.done;
  assert.equal(game.exit.open, false);
  assert.equal(objective().done, false);
  assert.equal(objective().text, 'Reflets rendus : {done} sur {total}.');
  assert.deepEqual({ ...objective().values }, { done: 0, total: 3 });
  // La cible désigne une balise éteinte, jamais la sortie ni un chemin.
  const beacons = game.level.place.beacons;
  assert.ok(beacons.includes(game.wakeables.find(w => w.x === objective().target.x).id));
  for (const id of beacons) {
    game.wokenOnce.add(id);
    tick(game, DT);
    assert.equal(lit(), beacons.indexOf(id) + 1);
  }
  assert.equal(objective().done, true);
  assert.equal(objective().target, null, 'Rien à désigner quand plus rien ne manque.');
  assert.equal(game.exit.open, true);
});

test('The little star reports how far it has walked, and its report never runs backwards', () => {
  const { game, window } = load('astre-a-guider');
  const objective = () => window.LumenPlaces.objective(game);
  assert.equal(game.exit.open, false);
  assert.equal(objective().values.done, 0);
  const astre = game.place.astre, config = game.level.place;
  astre.x = config.startX + (config.endX - config.startX) / 2;
  assert.equal(objective().values.done, 50);
  assert.deepEqual({ ...objective().target }, { x: astre.x, y: astre.y });
  astre.x = config.endX; tick(game, DT);
  assert.equal(objective().done, true);
  assert.equal(objective().values.done, 100);
  assert.equal(game.exit.open, true);
});

test('An ordinary place has nothing to announce, and a closed exit always says why', () => {
  const { game, window } = load('pont-des-veilleurs');
  assert.equal(window.LumenPlaces.objective(game), null, 'Un lieu sans condition ne doit rien afficher.');

  const river = load('riviere-sans-lune');
  const said = [];
  river.game.on('toast', message => said.push(message));
  // Arriver devant un portail fermé doit répondre, une fois, puis se taire.
  position(river.game, river.game.exit.x + 10, river.game.exit.y + 40);
  tick(river.game, .1);
  assert.deepEqual(said, [river.game.level.goal]);
  position(river.game, river.game.exit.x + 10, river.game.exit.y + 40);
  tick(river.game, 1);
  assert.equal(said.length, 1, 'Le rappel ne doit pas se répéter à chaque image.');
});

test('Entering a new place after a lost expedition makes Retry restart that place, not the old night', () => {
  const { game } = environment();
  game.startExpedition(42); game.finishExpedition(false);
  assert.ok(game.lastRun);
  // L'ordre du voyage décide seul de l'accès : on termine ce qui précède.
  for (const key of ['prairies-aurore', 'cathedrale-racines']) game.store.recordChapter(key, { stars: 0, time: 60 });
  game.start(game.indexOfKey('dos-du-songe'));
  assert.equal(game.session, 'campaign'); assert.equal(game.place.kind, 'ride');
  game.retry();
  assert.equal(game.session, 'campaign'); assert.equal(game.level.key, 'dos-du-songe');
  assert.equal(game.place.kind, 'ride'); assert.equal(game.place.metrics.carriedDistance, 0);
});

console.log(`\n${passed}/${passed + failed} place mechanics checks passed.`);
if (failed) process.exitCode = 1;
