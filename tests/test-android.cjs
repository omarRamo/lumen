/* Le projet Android tient ses promesses avant tout SDK : orientation, plein écran,
 * origine de sauvegarde, plancher WebView, icône adaptative et poids. Aucun Gradle ici. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const android = name => read(path.join('android', name));

(async () => {
  const config = JSON.parse(read('capacitor.config.json'));
  // L'origine décide où vit la sauvegarde. La changer effacerait les profils installés.
  assert.equal(config.server.androidScheme, 'https');
  assert.deepEqual(config.android, { backgroundColor: '#dce6d5', zoomEnabled: false, allowMixedContent: false,
    captureInput: false, useLegacyBridge: false, minWebViewVersion: 90, loggingBehavior: 'production' });
  // Le plancher vaut ce que le jeu exige vraiment : :is() et aspect-ratio arrivent
  // avec Chrome 88, overflow:clip avec Chrome 90. Chaque déclaration récente est
  // précédée de son repli, pour l'iOS 15 que le projet accepte encore.
  assert.match(read('style.css'), /#app\{height:100%;height:100dvh[^}]*overflow:hidden;overflow:clip/);

  const manifest = android('app/src/main/AndroidManifest.xml');
  // Paysage sur téléphone ; Android 16 rend la rotation aux grands écrans, comme l'iPad.
  assert.match(manifest, /android:screenOrientation="sensorLandscape"/);
  assert.match(manifest, /android:resizeableActivity="true"/);
  assert.match(manifest, /android:hardwareAccelerated="true"/);
  assert.match(manifest, /android:appCategory="game"/);
  // La rotation et le changement de densité ne relancent pas l'activité : une partie survit.
  for (const change of ['orientation', 'screenSize', 'smallestScreenSize', 'screenLayout', 'density', 'uiMode']) {
    assert.match(manifest, new RegExp(`android:configChanges="[^"]*\\b${change}\\b`), change + ' doit être absorbé');
  }
  const permissions = [...manifest.matchAll(/<uses-permission android:name="android\.permission\.(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(permissions, ['INTERNET'], 'Le jeu est hors ligne : aucune permission de plus');
  assert.doesNotMatch(manifest, /android:required="true"/, 'Aucun matériel exigé : ni écran tactile, ni manette');

  const variables = android('variables.gradle');
  const number = name => Number(new RegExp(name + '\\s*=\\s*(\\d+)').exec(variables)[1]);
  // Un téléphone de cinq ans tourne sous Android 11 (API 30) ; le plancher est bien plus bas.
  assert.ok(number('minSdkVersion') <= 30, 'minSdk doit couvrir les téléphones de cinq ans');
  assert.ok(number('targetSdkVersion') >= 35, 'targetSdk sous 35 perd le bord-à-bord et les boutiques');
  assert.equal(number('compileSdkVersion'), number('targetSdkVersion'));

  const build = android('app/build.gradle');
  // Capacitor charge ses plugins par réflexion : R8 les effacerait en silence.
  assert.match(build, /minifyEnabled false/);
  assert.match(build, /versionCode lumenVersionCode/);
  assert.match(build, /enableV2Signing true/, 'Android 11 refuse un APK sans signature v2');
  // Un mot de passe passé en -P se relit dans « ps » et dans les traces de Gradle.
  for (const secret of ['storePassword', 'keyAlias', 'keyPassword']) {
    assert.match(build, new RegExp(secret + " System\\.getenv\\('LUMEN_"), secret + ' doit venir de l’environnement');
  }
  assert.doesNotMatch(build, /storePassword findProperty|keyPassword findProperty/);

  const activity = android('app/src/main/java/com/omartrabelsi/lumen/MainActivity.java');
  assert.match(activity, /setDecorFitsSystemWindows\(getWindow\(\), false\)/, 'Sans bord-à-bord, env(safe-area-inset-*) reste à zéro');
  assert.match(activity, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES/);
  assert.match(activity, /FLAG_KEEP_SCREEN_ON/);
  assert.match(activity, /setSustainedPerformanceMode\(true\)/);
  assert.match(activity, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
  // Les pouces tiennent le bas de l'écran, là où Android attend « retour » et « accueil ».
  assert.match(activity, /setSystemGestureExclusionRects/);
  assert.match(activity, /onWindowFocusChanged/, 'Les barres reviennent après une notification');

  const styles = android('app/src/main/res/values/styles.xml');
  assert.match(read('android/app/src/main/res/values/colors.xml'), /name="lumen_background">#dce6d5</);
  assert.match(styles, /windowSplashScreenBackground">@color\/lumen_background/);
  for (const theme of [/AppTheme\.NoActionBar"[\s\S]*?<\/style>/, /AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/]) {
    assert.match(styles.match(theme)[0], /android:windowBackground/, 'Un fond blanc apparaîtrait à la rotation');
  }

  const res = path.join(root, 'android/app/src/main/res');
  assert.deepEqual(fs.readdirSync(res).filter(name => /^drawable/.test(name)), ['drawable']);
  assert.deepEqual(fs.readdirSync(path.join(res, 'drawable')), ['splash.xml'], 'Aucun bitmap de démarrage par densité');
  assert.match(android('app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), /@mipmap\/ic_launcher_foreground/);

  for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const file = path.join(res, 'mipmap-' + density, 'ic_launcher_foreground.webp');
    const image = sharp(file);
    const meta = await image.metadata();
    assert.equal(meta.width, Math.round(108 * scale), density + ' : le premier plan adaptatif mesure 108 dp');
    assert.equal(meta.height, meta.width);
    // Le masque du système rogne hors des 72 dp centraux ; la bordure doit être vide.
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const margin = Math.floor(meta.width * 15 / 108);
    let ink = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const outside = x < margin || y < margin || x >= info.width - margin || y >= info.height - margin;
        if (outside && data[(y * info.width + x) * info.channels + 3] > 8) ink++;
      }
    }
    assert.equal(ink, 0, density + ' : de l’encre déborde de la zone sûre et serait rognée');
    for (const name of ['ic_launcher.webp', 'ic_launcher_round.webp']) {
      assert.ok(fs.existsSync(path.join(res, 'mipmap-' + density, name)), density + '/' + name + ' manque');
    }
  }

  const weight = fs.readdirSync(res, { recursive: true })
    .map(name => path.join(res, name)).filter(file => fs.statSync(file).isFile())
    .reduce((total, file) => total + fs.statSync(file).size, 0);
  assert.ok(weight < 256 * 1024, 'Les ressources Android pèsent ' + Math.round(weight / 1024) + ' kio');

  console.log('PASS Android shell: landscape, edge-to-edge, thumbs, frozen origin, adaptive icon, ' + Math.round(weight / 1024) + ' kio of resources');
})().catch(error => { console.error(error); process.exitCode = 1; });
