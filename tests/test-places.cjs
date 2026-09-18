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

test('Position fixture: the sleeper only travels when calmed, carries its rider away from the exit, then waits', () => {
  const { game } = load('dos-du-songe');
  const deck = game.place.deck, config = game.level.place;
  const initial = deck.x;
  assert.equal(initial, config.toX, 'Le dormeur attend au bout de l’île de départ.');
  tick(game, 1); assert.equal(deck.x, initial);
  position(game, deck.x + 90, deck.y - 46); tick(game, .05);
  assert.equal(game.player.standingPlatform, deck);
  call(game); tick(game, 2);
  assert.ok(deck.x < initial - 150, 'L’aller part vers la gauche, loin de la sortie.');
  assert.ok(game.place.metrics.carriedDistance > 150);
  assert.equal(game.player.hp, 3);
  tick(game, 7); const stopped = deck.x; tick(game, 1);
  assert.equal(deck.x, stopped, 'expired calm should stop the mount, not drop its rider');
  assert.equal(game.player.standingPlatform, deck);
  assert.equal(game.player.hp, 3);
  game.die(); tick(game, 2);
  assert.equal(game.place.deck.x, config.toX, 'a fall from the departure island must bring the mount back to it');
});

test('The departure island is sealed by its cliff: the only way on is the ride out and the high road back', () => {
  const { game } = load('dos-du-songe');
  const cliff = game.platforms.find(p => p.type === 'ground' && p.x === 2900);
  assert.ok(cliff && game.level.spawn.y + 46 - cliff.y >= 300, 'La falaise doit dépasser tout saut.');
  // De vraies entrées : courir et sauter contre la falaise, longtemps.
  game.input.virtual('right', true, 'test'); game.input.virtual('run', true, 'test');
  for (let f = 0; f < 120 * 6; f++) {
    game.input.virtual('jump', f % 60 < 30, 'test'); tick(game, DT);
  }
  game.input.virtual('right', false, 'test'); game.input.virtual('run', false, 'test'); game.input.virtual('jump', false, 'test');
  assert.ok(game.player.x + game.player.w <= cliff.x + 1, 'Rien ne franchit la falaise depuis le bas : x = ' + game.player.x);
  assert.ok(game.player.y + game.player.h > 500, 'Et rien n’y mène par-dessus.');
  assert.equal(game.place.metrics.returnedHigh, false);
});

test('Position fixture: the little star is carried, not called — its light makes the footbridges, and without it they are gone', () => {
  const { game } = load('astre-a-guider');
  const astre = game.place.astre, lights = game.place.lights;
  assert.equal(game.level.wakeables.length, 0, 'Plus rien à réveiller : le lieu ne se joue plus à la voix.');
  // Un appel à côté de lui ne le fait pas bouger d'un pixel.
  position(game, astre.x - 40, 254); tick(game, .2);
  const before = { x: astre.x, y: astre.y };
  game.input.virtual('jump', false, 'test');
  call(game); call(game); tick(game, 1);
  // Le premier appui l'a pris, le second l'a posé : il est là où l'on se tient.
  assert.equal(astre.carried, false);
  assert.ok(Math.abs(astre.x - (game.player.x + 16)) < 2, 'Posé au pied du joueur.');
  void before;
  call(game); assert.equal(astre.carried, true, 'Reprendre l’astre se fait avec le même geste.');
  // Porté au bord du plateau, il allume la passerelle suivante ; resté sur
  // le plateau, il ne peut pas allumer la troisième.
  position(game, 520, 254); tick(game, .3);
  assert.equal(lights[0].active, true);
  assert.equal(lights[1].active, false, 'Une passerelle loin de l’astre n’existe pas.');
});

test('Position fixture: loaded, the jump falls short of a light ledge; set the star down beside it and jump free', () => {
  const { game } = load('astre-a-guider');
  const astre = game.place.astre, ledge = game.platforms.find(p => p.placeRole === 'astre-light' && p.y === 450);
  const terrace = game.platforms.find(p => p.type === 'ground' && p.y === 560);
  const jumpFrom = () => {
    Object.assign(game.player, { x: ledge.x + 40, y: terrace.y - 46, vx: 0, vy: 0, grounded: true, standingPlatform: terrace });
    tick(game, .1); let top = game.player.y;
    game.input.virtual('jump', true, 'test');
    for (let f = 0; f < 120 * .8; f++) { tick(game, DT); top = Math.min(top, game.player.y); }
    game.input.virtual('jump', false, 'test'); tick(game, .8);
    return { rise: terrace.y - 46 - top, on: game.player.standingPlatform === ledge };
  };
  astre.carried = true;
  const loaded = jumpFrom();
  assert.equal(ledge.active, true, 'Porté, l’astre allume bien la corniche…');
  assert.equal(loaded.on, false, '…mais un saut chargé ne l’atteint pas : ' + loaded.rise.toFixed(0) + ' px');
  assert.ok(loaded.rise < 95 && loaded.rise > 70, 'Saut chargé ≈ 85 px : ' + loaded.rise);
  // Posé au pied de la corniche, l'astre continue de l'éclairer.
  Object.assign(game.player, { x: ledge.x + 40, y: terrace.y - 46, vx: 0, vy: 0, grounded: true, standingPlatform: terrace });
  tick(game, .1); call(game); tick(game, .1);
  assert.equal(astre.carried, false); assert.equal(game.place.metrics.placements, 1);
  const free = jumpFrom();
  assert.equal(free.on, true, 'Les mains libres, la corniche est atteinte : ' + free.rise.toFixed(0) + ' px');
  // Et la corniche mène au passage secret, qu'on ne trouve pas autrement.
  game.input.virtual('jump', true, 'test'); tick(game, .5); game.input.virtual('jump', false, 'test'); tick(game, .6);
  assert.equal(game.secretCount, 1, 'Le passage secret récompense la pose.');
});

test('Position fixture: going ahead without the star is a fall, and a fall always brings the star back to you', () => {
  const { game } = load('astre-a-guider');
  const astre = game.place.astre;
  // Pris puis posé sur le plateau : on part seul vers la vallée.
  position(game, astre.x - 20, 254); tick(game, .2); call(game); tick(game, .2);
  assert.equal(astre.carried, true);
  Object.assign(game.player, { x: 300, y: 254 }); tick(game, .3); call(game); tick(game, .2);
  assert.equal(astre.carried, false);
  game.input.virtual('right', true, 'test');
  for (let f = 0; f < 120 * 4 && game.mode === 'playing'; f++) tick(game, DT);
  game.input.virtual('right', false, 'test');
  assert.equal(game.mode, 'dead', 'Sans sa lumière, la deuxième passerelle n’existe pas.');
  tick(game, 2);
  assert.equal(game.mode, 'playing');
  assert.equal(astre.carried, true, 'L’astre revient avec le joueur : aucune chute ne le laisse hors d’atteinte.');
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

test('The rain keeps its own rhythm: a call cannot steer it, steps grow in its wake, fade behind it, and grow again next round', () => {
  const { game } = load('pluie-de-lumiere');
  const steps = game.platforms.filter(platform => platform.placeRole === 'rain-step');
  const config = game.level.place.clouds[0];
  assert.ok(steps.every(platform => !platform.active));
  // Deux visites identiques, l'une où l'on appelle sans cesse, l'autre en
  // silence : le nuage est au même endroit. Le lieu ne se joue plus à la voix.
  const quiet = load('pluie-de-lumiere').game;
  position(game, 455, 554); position(quiet, 455, 554);
  for (let i = 0; i < 12; i++) { game.player.facing = i % 2 ? 1 : -1; call(game); tick(game, .25); tick(quiet, .25); tick(quiet, DT); }
  assert.equal(game.elapsed.toFixed(4), quiet.elapsed.toFixed(4));
  assert.ok(Math.abs(game.place.clouds[0].x - quiet.place.clouds[0].x) < 2, 'Un appel ne doit pas déplacer le nuage.');
  // Une ronde : il se forme sur la rive, traverse dans le sens du voyage,
  // fait pousser les pas un par un, puis se défait sur l'autre rive.
  const fresh = load('pluie-de-lumiere').game;
  const beds = fresh.platforms.filter(platform => platform.placeRole === 'rain-step').slice(0, 4);
  const grownAt = beds.map(() => null), goneAt = beds.map(() => null);
  let lastX = -Infinity, crossedBackwards = false;
  position(fresh, 300, 554);
  for (let frame = 0; frame < 120 * 12; frame++) {
    tick(fresh, DT);
    const x = fresh.place.clouds[0].x;
    if (fresh.place.clouds[0].stage === 'crossing' && x < lastX - 1) crossedBackwards = true;
    lastX = fresh.place.clouds[0].stage === 'crossing' ? x : -Infinity;
    beds.forEach((bed, index) => {
      if (bed.active && grownAt[index] === null) grownAt[index] = fresh.elapsed;
      if (!bed.active && grownAt[index] !== null && goneAt[index] === null) goneAt[index] = fresh.elapsed;
    });
  }
  assert.equal(crossedBackwards, false, 'La traversée va toujours dans le sens du voyage.');
  assert.ok(grownAt.every(time => time !== null), 'Chaque pas doit pousser pendant une ronde : ' + grownAt);
  for (let index = 1; index < beds.length; index++) assert.ok(grownAt[index] > grownAt[index - 1] + 1, 'Les pas poussent un par un, dans l’ordre.');
  assert.ok(goneAt[0] !== null && goneAt[0] < grownAt[3] + 3, 'Un pas quitté par la pluie s’efface.');
  // Et le nuage repasse : moins de dix secondes plus tard, le premier pas repousse.
  const period = 1.6 + Math.abs(config.to - config.from) / config.speed + .8;
  assert.ok(period < 10, 'Qui arrive trop tard ne doit pas attendre plus de dix secondes.');
  tick(fresh, period - 12 + grownAt[0] + .5);
  assert.equal(beds[0].active, true, 'Le premier pas repousse à la ronde suivante.');
  assert.ok(fresh.place.metrics.rainGrown >= 5);
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

test('The little star reports how far it has come, points at itself only when left behind, and opens the exit at home', () => {
  const { game, window } = load('astre-a-guider');
  const objective = () => window.LumenPlaces.objective(game);
  const astre = game.place.astre, config = game.level.place;
  assert.equal(game.exit.open, false);
  assert.equal(objective().values.done, 0);
  assert.deepEqual({ ...objective().target }, { x: astre.x, y: astre.y }, 'Pas encore pris : on le désigne.');
  astre.carried = true; astre.x = config.startX + (config.endX - config.startX) / 2;
  assert.equal(objective().values.done, 50);
  assert.equal(objective().target, null, 'Porté, il n’y a rien à désigner.');
  // Porté jusqu'au fond du vallon : la maison le garde et la sortie s'ouvre.
  Object.assign(game.player, { x: config.endX - 10, y: config.homeY - 46, vx: 0, vy: 0 });
  tick(game, .2);
  assert.equal(astre.arrived, true); assert.equal(astre.carried, false);
  assert.equal(objective().done, true); assert.equal(objective().values.done, 100);
  assert.equal(objective().target, null, 'Rentré chez lui, il n’y a plus rien à désigner.');
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
