/* Trouve un Chromium utilisable, sans jamais coder en dur le chemin d'une
 * machine. L'ordre est délibéré : ce que l'utilisateur a demandé d'abord, ce
 * que Playwright a installé ensuite, et seulement en dernier une recherche
 * dans un cache partagé.
 *
 * Le jeu n'en a aucun besoin : ceci ne sert qu'aux vérifications navigateur.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** Les emplacements où un Chromium de Playwright peut se trouver, du plus
 *  explicite au plus deviné. Chacun est vérifié avant d'être retenu. */
function candidates() {
  const found = [];
  // 1. Le choix explicite de la personne qui lance les tests.
  if (process.env.LUMEN_CHROMIUM) found.push(process.env.LUMEN_CHROMIUM);
  // 2. Un cache de navigateurs désigné par l'environnement (CI, image figée).
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (cache && cache !== '0' && fs.existsSync(cache)) {
    for (const entry of fs.readdirSync(cache)) {
      if (!/^chromium/.test(entry)) continue;
      for (const relative of ['chrome-linux/chrome', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        found.push(path.join(cache, entry, relative));
      }
    }
  }
  return found.filter(candidate => { try { return fs.statSync(candidate).isFile(); } catch (_) { return false; } });
}

/** Les options de lancement. Sans chemin trouvé, on ne passe rien : Playwright
 *  utilisera alors son propre navigateur, ce qui est le cas normal après
 *  `npx playwright install chromium`. */
function launchOptions(extra = {}) {
  if (process.env.LUMEN_BROWSER === 'webkit') return extra;
  let executablePath = candidates()[0];
  if (!executablePath && !fs.existsSync(require('playwright').chromium.executablePath()) && process.platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
    executablePath = roots.flatMap(directory => [
      path.join(directory, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(directory, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ]).find(candidate => fs.existsSync(candidate));
  }
  const options = { args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'], ...extra };
  if (executablePath) options.executablePath = executablePath;
  return options;
}

/** Un message utile plutôt qu'une trace de pile, si rien n'est installé. */
function explain(error) {
  if (process.env.LUMEN_BROWSER === 'webkit') return 'WebKit indisponible : npx playwright install webkit. ' + error.message;
  return 'Aucun Chromium utilisable.\n' +
    '  · Installez-en un : npx playwright install chromium\n' +
    '  · Ou désignez le vôtre : LUMEN_CHROMIUM=/chemin/vers/chrome npm run test:browser\n' +
    '  Détail : ' + error.message;
}

module.exports = { launchOptions, candidates, explain };
