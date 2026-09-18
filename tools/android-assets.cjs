/* Icônes Android à partir de icon.svg : une icône adaptative, et le repli carré
 * et rond des appareils antérieurs à Android 8. Aucun bitmap de démarrage :
 * drawable/splash.xml compose la couleur et cette même face.
 * En WebP, qu'Android lit depuis l'API 18 et que le dépôt exige (test-repo-weight). */
'use strict';
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');
const BACKGROUND = '#dce6d5';
// mdpi = 1× ; l'icône adaptative mesure 108 dp, l'icône héritée 48 dp.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// Zone sûre de l'icône adaptative : 72 dp sur 108. Le masque du système et
// l'écran de démarrage d'Android 12 rognent tout ce qui déborde.
const SAFE = 66 / 108;

async function face(size) {
  return sharp(path.join(root, 'icon.svg'), { density: 600 })
    .resize(Math.round(size * 64 / 76), size, { fit: 'contain', background: '#00000000' })
    .png().toBuffer();
}
function circle(size) {
  return Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
}
async function write(file, image) {
  await image.webp({ lossless: true, effort: 6 }).toFile(file);
}

(async () => {
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const folder = path.join(res, 'mipmap-' + density);
    fs.mkdirSync(folder, { recursive: true });
    const adaptive = Math.round(108 * scale), legacy = Math.round(48 * scale);

    // Premier plan transparent : le fond adaptatif est la couleur, pas un bitmap.
    await write(path.join(folder, 'ic_launcher_foreground.webp'),
      sharp({ create: { width: adaptive, height: adaptive, channels: 4, background: '#00000000' } })
        .composite([{ input: await face(Math.round(adaptive * SAFE)), gravity: 'centre' }]));

    const flat = sharp({ create: { width: legacy, height: legacy, channels: 3, background: BACKGROUND } })
      .composite([{ input: await face(Math.round(legacy * 0.74)), gravity: 'centre' }]).flatten({ background: BACKGROUND });
    await write(path.join(folder, 'ic_launcher.webp'), flat);
    await write(path.join(folder, 'ic_launcher_round.webp'),
      sharp(await flat.webp({ lossless: true }).toBuffer()).composite([{ input: circle(legacy), blend: 'dest-in' }]));
  }
  console.log('Android icons written for ' + Object.keys(DENSITIES).join(', ') + '.');
})().catch(error => { console.error(error); process.exitCode = 1; });
