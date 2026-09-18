/* Ce que ce Mac sait déjà faire pour Android, et la commande exacte qui manque.
 * N'installe rien : il regarde, puis il dit. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.HOME || '', 'Library/Android/sdk');

function run(command, args) {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (_) { return null; }
}
const sdk = relative => { const full = path.join(home, relative); return fs.existsSync(full) ? full : null; };

const checks = [
  {
    name: 'JDK 21',
    look: () => {
      const version = run('java', ['-version']) ?? run('/usr/libexec/java_home', ['-v', '21']);
      const reported = run('java', ['-XshowSettings:properties', '-version']);
      const major = /java\.version = (\d+)/.exec(reported || '')?.[1];
      return major && Number(major) >= 21 ? 'java ' + major : null;
    },
    fix: 'brew install --cask temurin@21   # puis : export JAVA_HOME=$(/usr/libexec/java_home -v 21)'
  },
  {
    name: 'SDK Android',
    look: () => sdk('platform-tools/adb') && home,
    fix: 'brew install --cask android-commandlinetools\n' +
         '    export ANDROID_HOME="$HOME/Library/Android/sdk"\n' +
         '    sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-36" "build-tools;36.0.0"'
  },
  {
    name: 'Émulateur',
    look: () => sdk('emulator/emulator'),
    fix: 'sdkmanager --sdk_root="$ANDROID_HOME" "emulator" "system-images;android-35;google_apis_playstore;arm64-v8a"'
  },
  {
    name: 'Appareil virtuel LUMEN',
    look: () => {
      const list = run(path.join(home, 'emulator/emulator'), ['-list-avds']);
      return list && list.split('\n').find(name => /lumen/i.test(name)) ? 'AVD prêt' : null;
    },
    fix: 'avdmanager create avd -n lumen-pixel -k "system-images;android-35;google_apis_playstore;arm64-v8a" -d pixel_8'
  },
  {
    name: 'Téléphone branché',
    look: () => {
      const list = run(path.join(home, 'platform-tools/adb'), ['devices']);
      const devices = (list || '').split('\n').slice(1).filter(line => /\tdevice$/.test(line));
      return devices.length ? devices.length + ' appareil(s)' : null;
    },
    fix: 'Facultatif. Brancher le téléphone, activer « Options pour les développeurs → Débogage USB », accepter l’empreinte.'
  }
];

let blocking = 0;
for (const check of checks) {
  let found = null;
  try { found = check.look(); } catch (_) {}
  if (found) { console.log('  ok    ' + check.name + ' — ' + found); continue; }
  const optional = check.name === 'Téléphone branché';
  if (!optional) blocking++;
  console.log((optional ? '  —     ' : '  MANQUE ') + check.name + '\n    ' + check.fix);
}
console.log(blocking
  ? '\n' + blocking + ' élément(s) à installer avant de construire un APK ici.\n' +
    'Sans eux, « npm run test:android » reste possible : il simule la WebView Android\n' +
    'dans Chromium, sans SDK ni émulateur.'
  : '\nCe poste peut construire et lancer l’APK : npm run android:sync puis npm run android:apk.');
