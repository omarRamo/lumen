/* LUMEN — le dépôt ne doit pas peser trente fois le jeu.
 *
 * Les captures sont une preuve de travail légitime, et elles sont demandées à
 * chaque itération. Leur POIDS, lui, ne l'est pas : entre les itérations 04 et
 * 06 le dépôt est passé de 4,6 Mo à 54 Mo pour un jeu qui en pèse 1,7, et
 * personne ne l'a vu parce que rien ne le mesurait.
 *
 * Ce contrôle mesure. Il ne juge pas du contenu : il dit seulement que passer
 * le budget doit être une décision, pas un effet de bord.
 *
 * Exécution : node tests/test-repo-weight.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

/* ── Les budgets ──────────────────────────────────────────────────────────
 * Relevés après la conversion en WebP de l'itération 07, avec une marge
 * d'environ 40 % : de quoi ajouter une série de captures sans rien décider,
 * pas de quoi en ajouter cinq sans s'en apercevoir.
 *
 * Augmenter un budget est permis. Le faire sans l'écrire ici ne l'est pas. */
const BUDGETS = {
  images: 6 * 1024 * 1024,   // toutes les images suivies, captures comprises
  total: 12 * 1024 * 1024    // tout ce qui est suivi, hors historique
};
/** Les formats d'image tolérés dans le dépôt. Le PNG d'une capture d'écran de
 *  jeu en aplats pèse six fois son WebP : voir tools/capture.cjs. */
const IMAGE_FORMATS = ['.webp', '.svg', '.woff2'];
const FORBIDDEN_FORMATS = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'];

const checks = [];
let failed = 0;
function test(name, run) {
  try { run(); checks.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { failed++; checks.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n      ' + error.message); }
}

function tracked() {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 26 });
  return output.toString('utf8').split('\0').filter(file => file && !/^(dist\/|ios\/App\/Pods\/)/.test(file));
}
function weigh(files) {
  let total = 0;
  for (const file of files) {
    try { total += fs.statSync(path.join(root, file)).size; } catch (_) { /* supprimé mais encore indexé */ }
  }
  return total;
}
const mb = bytes => (bytes / 1048576).toFixed(1) + ' Mo';

test('Aucune capture n’entre dans le dépôt dans un format qui pèse six fois son poids', () => {
  const files = tracked().filter(file => FORBIDDEN_FORMATS.includes(path.extname(file).toLowerCase()));
  assert.deepEqual(files.slice(0, 8), [],
    files.length + ' image(s) dans un format interdit. Passer par tools/capture.cjs :\n      ' +
    files.slice(0, 8).join('\n      '));
});

test('Le poids des images suivies tient dans son budget', () => {
  const images = tracked().filter(file => IMAGE_FORMATS.includes(path.extname(file).toLowerCase()));
  const weight = weigh(images);
  assert.ok(weight <= BUDGETS.images,
    `${images.length} images pèsent ${mb(weight)}, budget ${mb(BUDGETS.images)}.\n` +
    '      Convertir, réduire la résolution, ou retirer une série close — ' +
    'ou relever le budget dans ce fichier, en le décidant.');
  console.log(`      ${images.length} images · ${mb(weight)} / ${mb(BUDGETS.images)}`);
});

test('Le dépôt suivi reste petit devant ce qu’il contient', () => {
  const files = tracked();
  const weight = weigh(files);
  assert.ok(weight <= BUDGETS.total,
    `${files.length} fichiers suivis pèsent ${mb(weight)}, budget ${mb(BUDGETS.total)}.`);
  const game = weigh(files.filter(file =>
    !file.startsWith('docs/') && !file.startsWith('tests/') && !file.startsWith('work/') && !file.startsWith('tools/')));
  console.log(`      dépôt ${mb(weight)} · le jeu seul ${mb(game)} · rapport ×${(weight / game).toFixed(1)}`);
});

fs.writeFileSync(path.join(root, 'tests', 'repo-weight-results.json'),
  JSON.stringify({ ranAt: new Date().toISOString(), budgets: BUDGETS, total: checks.length, failed, checks }, null, 2));
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' contrôles de poids réussis.');
process.exit(failed ? 1 : 0);
