/* Real simulation and authored geometry, mocked rendering/audio only.
 * No teleport, injected invulnerability, injected power or manual complete().
 * A level loading at its authored spawn is the sole initial fixture. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const pilot = require('./place-pilot.cjs');
const DT = 1 / 120;
const CONTRACTS = {
  // Itération 13 : l'aller se fait sur le dos du dormeur, le retour par les
  // hauteurs, jusqu'au sommet de la falaise que l'île de départ ne franchit pas.
  ride: metrics => metrics.carriedDistance >= 800 && metrics.returnedHigh === true,
  // Itération 13 : l'astre se porte. Porté sur toute la descente, posé sur
  // des passerelles qui n'existent que dans sa lumière, puis rendu chez lui.
  escort: metrics => metrics.carriedDistance >= 2400 && metrics.lightLandings >= 4 && metrics.escortArrived === true,
  chain: metrics => metrics.chainWakes >= 3 && metrics.bridgeDistance >= 300,
  river: metrics => metrics.beaconsLit >= 3 && metrics.riverRestored === true,
  ascent: metrics => metrics.climbed >= 800,
  rain: metrics => metrics.rainGrown >= 3 && metrics.rainLandings >= 2
};
function environment() {
  let seed = 6006;
  const random = Object.create(Math);
  random.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const window = { innerWidth: 1280, innerHeight: 720, addEventListener() {},
    LumenRenderer: class { resize() {} draw() {} },
    LumenAudio: class { setMuted() {} setTheme() {} setDanger() {} setBossPhase() {} unlock() {} resume() {} pause() {} sfx() {} } };
  const storage = new Map();
  const document = { hidden: false, addEventListener() {}, body: { classList: { contains: () => true } } };
  const context = vm.createContext({ window, document, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    requestAnimationFrame() {}, console, Math: random });
  for (const file of ['rng', 'save', 'resonance', 'modules', 'expedition', 'upgrades', 'places', 'levels', 'song', 'journey', 'engine']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
  }
  const game = new window.LumenGame({});
  return { game, window, storage };
}
function run(key, limit = 180) {
  const { game, window } = environment();
  const index = window.LUMEN_LEVELS.findIndex(level => level.key === key);
  assert.ok(index >= 0, 'Missing authored place ' + key);
  game.loadLevel(index);
  const initial = { x: game.player.x, y: game.player.y, power: game.player.power };
  const controller = pilot.create(game);
  for (let frame = 0; frame < 120 * limit && ['playing', 'dead'].includes(game.mode); frame++) {
    controller.step(); game.update(DT); game.input.clearFrame();
  }
  const result = controller.summary();
  result.initial = initial;
  result.savedCompletion = !!game.store.chapter(key)?.completed;
  result.ideaExercised = !!CONTRACTS[result.kind]?.(result.metrics);
  result.ok = game.mode === 'complete' && result.savedCompletion && result.ideaExercised;
  return result;
}
function runAll() {
  const { window } = environment();
  const levels = window.LUMEN_LEVELS.filter(level => level.place);
  assert.equal(levels.length, 6, 'Iteration 06 contains exactly six authored ideas.');
  assert.equal(new Set(levels.map(level => level.place.kind)).size, 6);
  return levels.map(level => run(level.key));
}
if (require.main === module) {
  const results = process.argv[2] ? [run(process.argv[2])] : runAll();
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(__dirname, 'places-playthrough-results.json'), JSON.stringify(results, null, 2) + '\n');
  process.exitCode = results.some(result => !result.ok) ? 1 : 0;
}
module.exports = { run, runAll, environment };
