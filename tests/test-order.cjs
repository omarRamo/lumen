/* LUMEN — l'ordre du voyage, prouvé acte par acte.
 *
 * Une seule règle décide : un jardin requis n'ouvre que lorsque le jardin
 * requis qui le précède est TERMINÉ. Ce fichier vérifie les deux moitiés de
 * cette promesse — on ne saute jamais un lieu, et une sauvegarde héritée,
 * même incohérente, ne perd rien de ce qu'elle avait.
 *
 * Aucun état n'est forcé dans le moteur : tout passe par le magasin de
 * sauvegarde, c'est-à-dire par ce qu'un vrai disque contiendrait.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = ['rng', 'save', 'resonance', 'modules', 'expedition', 'upgrades', 'places', 'levels', 'song', 'journey', 'engine'];
const sources = files.map(file => fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'));
let failed = 0, passed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS  ' + name); }
  catch (error) { failed++; console.error('FAIL  ' + name + '\n' + error.stack); }
}
function world(storage = new Map()) {
  const window = { innerWidth: 1280, innerHeight: 720, addEventListener() {},
    LumenRenderer: class { resize() {} },
    LumenAudio: class { setMuted() {} setTheme() {} setDanger() {} setBossPhase() {} unlock() {} resume() {} pause() {} sfx() {} } };
  const document = { hidden: false, addEventListener() {}, body: { classList: { contains: () => true } } };
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const context = vm.createContext({ window, document, localStorage, navigator: { getGamepads: () => [] }, requestAnimationFrame() {}, console, Math });
  for (const source of sources) vm.runInContext(source, context);
  return { game: new window.LumenGame({}), window, storage };
}
const open = (game, key) => game.isUnlocked(game.indexOfKey(key));
const finish = (game, key) => game.store.recordChapter(key, { stars: 0, time: 90 });

test('Acte par acte : aucun lieu requis n’est jouable avant que son précédent soit terminé', () => {
  const { game, window } = world();
  const required = window.LumenJourney.route();
  // Départ : seul le tout premier jardin est ouvert, dans les trois actes.
  for (const item of required.slice(1)) {
    assert.equal(open(game, item.level.key), false, 'ouvert trop tôt : ' + item.level.key);
  }
  assert.equal(open(game, required[0].level.key), true);
  // Puis, un par un : terminer le précédent ouvre le suivant, et lui seul.
  for (let position = 0; position < required.length - 1; position++) {
    finish(game, required[position].level.key);
    assert.equal(open(game, required[position + 1].level.key), true, 'devrait ouvrir : ' + required[position + 1].level.key);
    for (const later of required.slice(position + 2)) {
      assert.equal(open(game, later.level.key), false, 'saut possible vers ' + later.level.key);
    }
  }
});

test('Le cinquième lieu d’un acte reste fermé tant qu’il manque un seul des quatre premiers', () => {
  const { game, window } = world();
  const required = window.LumenJourney.route();
  for (const act of [1, 2, 3]) {
    const places = required.filter(item => item.act === act);
    const fresh = world().game;
    // Tout est terminé jusqu'au deuxième lieu de cet acte — lui, pas encore.
    for (const item of required) {
      if (item.level.key === places[1].level.key) break;
      finish(fresh, item.level.key);
    }
    assert.equal(open(fresh, places[1].level.key), true, 'le lieu atteint doit être jouable');
    for (const item of places.slice(2)) {
      assert.equal(open(fresh, item.level.key), false, `acte ${act} : ${item.level.key} ne doit pas s’ouvrir sans ${places[1].level.key}`);
    }
  }
});

test('Une île de repos attend que tout l’acte précédent soit terminé', () => {
  const { game, window } = world();
  const required = window.LumenJourney.route();
  assert.equal(game.isSongUnlocked(0), true);
  assert.equal(game.isSongUnlocked(1), false);
  const act = required.filter(item => item.act === 1);
  for (const item of act.slice(0, -1)) finish(game, item.level.key);
  assert.equal(game.isSongUnlocked(1), false, 'un seul jardin manquant suffit à retenir l’île');
  finish(game, act.at(-1).level.key);
  assert.equal(game.isSongUnlocked(1), true);
  assert.equal(game.isSongUnlocked(2), false);
});

test('Un lieu bonus ne déverrouille pas la campagne, et la campagne ne déverrouille pas le bonus', () => {
  const { game, window } = world();
  const bonus = (window.LUMEN_LEVELS || []).filter(level => level.bonus && !level.hub);
  assert.ok(bonus.length, 'aucun lieu bonus dans le catalogue');
  for (const level of bonus) {
    assert.equal(open(game, level.key), false);
    finish(game, level.key);
  }
  const required = window.LumenJourney.route();
  for (const item of required.slice(1)) assert.equal(open(game, item.level.key), false, 'le bonus a ouvert ' + item.level.key);
});

test('Sauvegarde héritée hors séquence : ce qui est terminé le reste, sans rien ouvrir de plus', () => {
  const first = world();
  const profile = first.window.LumenSave.emptyProfile();
  // Un disque incohérent : un lieu de l'acte III terminé, l'acte I à peine entamé.
  profile.chapters['verger-qui-reve'] = { completed: true, stars: 1, time: 120 };
  profile.unlocked = ['prairies-aurore'];
  first.storage.set(first.window.LumenSave.KEY, JSON.stringify(profile));
  const { game } = world(first.storage);
  assert.equal(game.store.chapter('verger-qui-reve').completed, true, 'la sauvegarde ne doit rien perdre');
  assert.equal(open(game, 'verger-qui-reve'), true, 'un lieu terminé ne se referme jamais');
  assert.equal(open(game, 'colonne-des-saisons'), true, 'le lieu suivant un lieu terminé reste ouvert');
  // Un lieu terminé prouve un passage : la migration écrit la route jusqu'à lui,
  // sans jamais aller plus loin.
  assert.equal(open(game, 'galerie-echos'), true);
  assert.equal(open(game, 'cathedrale-racines'), true);
  assert.equal(open(game, 'pluie-de-lumiere'), false, 'rien ne s’ouvre au-delà du lieu terminé');
  assert.equal(open(game, 'coeur-eclipse'), false);
});

test('Frontière héritée : migrée une fois en clés stables, jamais rejouée comme exception', () => {
  const first = world();
  const profile = first.window.LumenSave.emptyProfile();
  profile.unlocked = first.window.LumenSave.LEGACY_ORDER_V2.slice(0, 6);
  first.storage.set(first.window.LumenSave.KEY, JSON.stringify(profile));
  const { game, window } = world(first.storage);
  const required = window.LumenJourney.route();
  const frontier = required.findIndex(item => item.level.key === 'palais-givre');
  for (const item of required.slice(0, frontier + 1)) {
    assert.equal(game.store.isUnlocked(item.level.key), true, 'non migré : ' + item.level.key);
    assert.equal(open(game, item.level.key), true);
  }
  for (const item of required.slice(frontier + 1)) assert.equal(open(game, item.level.key), false, 'migré trop loin : ' + item.level.key);
  assert.equal(game.isSongUnlocked(1), true, 'l’acte I est derrière la frontière');
  assert.equal(game.isSongUnlocked(2), false, 'l’acte II ne l’est pas');
  // La migration est écrite : une relecture ne la refait pas.
  const again = world(first.storage);
  assert.equal(again.game.migrateJourneyFrontier(), false);
  assert.equal(JSON.parse(first.storage.get(first.window.LumenSave.KEY)).schema, first.window.LumenSave.SCHEMA);
});

test('Le chemin proposé par « Continuer » est toujours un lieu réellement jouable', () => {
  const { game, window } = world();
  const required = window.LumenJourney.route();
  for (let position = 0; position < required.length; position++) {
    const target = window.LumenJourney.next(game);
    assert.ok(target, 'aucun lieu proposé');
    assert.equal(target.unlocked, true, 'Continuer propose un lieu fermé : ' + target.id);
    assert.equal(target.completed, false);
    finish(game, required[position].level.key);
  }
});

console.log(`\n${passed}/${passed + failed} order checks passed.`);
if (failed) process.exitCode = 1;
