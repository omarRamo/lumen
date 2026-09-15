/* LUMEN — aucun lieu n'est un couloir décoré.
 *
 * L'itération 06 a livré six lieux portés chacun par une idée, et deux fois
 * moins denses que les onze chapitres d'avant : la moitié des plateformes, un
 * tiers des objets, et QUATRE SUR SIX sans une seule créature. Aucune moyenne
 * ne l'avait dit, parce qu'une moyenne se satisfait d'un lieu riche et de cinq
 * pauvres.
 *
 * Ce contrôle pose donc un PLANCHER, lieu par lieu. Il ne demande pas
 * d'allonger : les seuils sont rapportés à la largeur, de sorte qu'un lieu
 * court et concentré passe, et qu'un lieu long et vide échoue.
 *
 * Exécution : node tests/test-density.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sources = ['rng.js', 'resonance.js', 'levels.js', 'song.js']
  .map(file => fs.readFileSync(path.join(root, 'js', file), 'utf8'));

/* ── Les planchers ────────────────────────────────────────────────────────
 * Relevés sur le jeu de l'itération 07, avec la marge la plus fine qui garde
 * le contrôle utile : le plus pauvre des lieux passe de justesse, et tout ce
 * qui descendrait sous lui échoue. Les relever est permis ; les abaisser
 * demande d'écrire ici pourquoi. */
const FLOORS = {
  creatures: 1,              // un lieu vivant en contient au moins une
  optionalDetours: 1,        // un passage secret au moins : une raison de regarder
  collectiblesPer1000px: 11  // observé : 12,9 au plus pauvre
};
/* Pas de plancher sur le nombre de plateformes : un lieu bâti sur un sol
 * continu n'en déclare qu'une pour trois mille pixels, et c'est un choix de
 * dessin, pas un vide. Compter les plateformes punirait un jardin plat autant
 * qu'un couloir désert, et ne distinguerait pas les deux. */

const checks = [];
let failed = 0;
function test(name, run) {
  try { run(); checks.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { failed++; checks.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n      ' + error.message); }
}

function world() {
  const context = vm.createContext({ console, Math });
  context.window = context;
  for (const source of sources) vm.runInContext(source, context);
  return context;
}
/** Les lieux jouables de la campagne. L'observatoire n'en est pas un — on n'y
 *  meurt pas, on n'y ramasse rien — et les îles sont des repos par décision. */
function stages(context) { return context.LUMEN_LEVELS.filter(level => !level.hub); }
const per1000 = (count, width) => count / (width / 1000);

test('Chaque lieu est habité : aucun n’est traversé sans rien y rencontrer', () => {
  const empty = stages(world())
    .filter(level => (level.enemies || []).length < FLOORS.creatures)
    .map(level => level.key);
  assert.deepEqual([...empty], [],
    empty.length + ' lieu(x) sans la moindre créature : ' + empty.join(', ') +
    '\n      Une créature qui sert l’idée du lieu, pas une créature pour faire nombre.');
});

test('Chaque lieu récompense d’avoir regardé ailleurs que devant soi', () => {
  const flat = stages(world())
    .filter(level => (level.secrets || []).length < FLOORS.optionalDetours)
    .map(level => level.key);
  assert.deepEqual([...flat], [], 'sans détour facultatif : ' + flat.join(', '));
});

test('La densité tient au mètre, pas en moyenne : un lieu pauvre ne se cache pas derrière un lieu riche', () => {
  const thin = [];
  for (const level of stages(world())) {
    const objects = per1000((level.collectibles || []).length, level.width);
    if (objects < FLOORS.collectiblesPer1000px) {
      thin.push(`${level.key} : ${objects.toFixed(1)} objets / 1000 px (plancher ${FLOORS.collectiblesPer1000px})`);
    }
  }
  assert.deepEqual(thin.slice(0, 6), [],
    thin.length + ' mesure(s) sous le plancher :\n      ' + thin.slice(0, 6).join('\n      ') +
    '\n      Remplir l’espace qui existe, pas allonger le lieu.');
});

test('Les îles restent des repos : c’est une décision, pas un oubli', () => {
  const context = world();
  for (const island of context.LumenSong.ISLANDS) {
    const level = context.LumenSong.create(context.LumenSong.ISLANDS.indexOf(island));
    assert.equal((level.enemies || []).length, 0, island.key + ' : une île ne contient pas de créature');
    assert.equal((level.hazards || []).length, 0, island.key + ' : une île ne contient pas de danger');
  }
  console.log('      3 îles, 0 créature, 0 danger — le souffle entre deux actes');
});

const summary = { ranAt: new Date().toISOString(), floors: FLOORS, total: checks.length, failed, checks };
fs.writeFileSync(path.join(root, 'tests', 'density-results.json'), JSON.stringify(summary, null, 2));
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' planchers de densité tenus.');
process.exit(failed ? 1 : 0);
