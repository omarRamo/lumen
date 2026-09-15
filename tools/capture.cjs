/* LUMEN — écrire une capture au format du dépôt.
 *
 * Playwright n'encode que PNG et JPEG. Le PNG 24 bits d'un écran de jeu en
 * aplats pèse dix fois ce qu'il devrait ; le JPEG salit les aplats et les
 * textes. On passe donc par le WebP, qui rend exactement ces images-là.
 *
 * Les captures sont une PREUVE de travail, pas une ressource du jeu : elles
 * n'entrent jamais dans `LUMEN.html` et le jeu n'en dépend pas. `sharp` est
 * une dépendance de développement, au même titre que Playwright.
 *
 * Le budget de poids est tenu par tests/test-repo-weight.cjs.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** L'extension que porte toute capture du dépôt. */
const EXTENSION = '.webp';
/** Qualité choisie sur les captures réelles du jeu : au-dessus, le fichier
 *  grossit sans que l'œil y gagne ; en dessous, les liserés fins bavent. */
const QUALITY = 88;

/** Le nom de fichier d'une capture, quelle que soit la forme demandée. */
function name(file) { return file.replace(/\.(png|jpe?g|webp)$/i, '') + EXTENSION; }

/**
 * Écrit une capture de `page` à `destination`, en WebP.
 * Signature volontairement proche de `page.screenshot`.
 */
async function shot(page, destination, options = {}) {
  const target = name(destination);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const buffer = await page.screenshot({ ...options, path: undefined, type: 'png' });
  let sharp;
  try { sharp = require('sharp'); }
  catch (error) {
    // Sans sharp, on préfère une capture lourde à pas de capture du tout :
    // le contrôle de poids le dira, et il dira pourquoi.
    fs.writeFileSync(target.replace(EXTENSION, '.png'), buffer);
    return target.replace(EXTENSION, '.png');
  }
  await sharp(buffer).webp({ quality: QUALITY, effort: 6 }).toFile(target);
  return target;
}

module.exports = { shot, name, EXTENSION, QUALITY };
