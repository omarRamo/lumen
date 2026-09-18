/* CI et poste local. Aucun magasin de clés ni mot de passe n'appartient au dépôt
 * ni à la console : les valeurs sont masquées avant toute sortie d'erreur. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const secrets = ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];

/**
 * Deux voies, et une seule décision : la présence d'un magasin de clés.
 * Sans secret, l'APK de test est signé par la clé de débogage du poste qui le
 * construit — installable, mais dont l'empreinte change d'une machine à l'autre.
 * Renvoie 'release' ou 'debug' ; lève si la configuration n'est qu'à moitié posée.
 */
function validate(env) {
  const present = secrets.filter(name => env[name]?.trim());
  if (!present.length) return 'debug';
  const missing = secrets.filter(name => !env[name]?.trim());
  if (missing.length) throw Error('Signature Android incomplète : ' + missing.join(', ') + ' manque(nt) parmi les secrets GitHub.');
  let keystore;
  try { keystore = Buffer.from(env.ANDROID_KEYSTORE_BASE64, 'base64'); }
  catch (_) { throw Error('ANDROID_KEYSTORE_BASE64 n’est pas du base64.'); }
  // Un magasin JKS ou PKCS12 réel dépasse largement le kilo-octet ; en deçà,
  // c'est un copier-coller tronqué, et l'erreur de Gradle serait illisible.
  if (keystore.length < 1024) throw Error('ANDROID_KEYSTORE_BASE64 décode moins d’un kio : le secret est tronqué.');
  if (!/^[\w.-]{1,64}$/.test(env.ANDROID_KEY_ALIAS)) throw Error('Format ANDROID_KEY_ALIAS invalide.');
  return 'release';
}

function redact(text, env) {
  let output = String(text);
  for (const name of secrets) if (env[name]?.trim()) output = output.split(env[name].trim()).join('[masqué]');
  return output;
}

function gradle(args, label, env, extra) {
  console.log(label);
  try {
    execFileSync(path.join(root, 'android/gradlew'), args,
      { cwd: path.join(root, 'android'), env: { ...env, ...extra }, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    const output = redact(String(error.stderr || '') + '\n' + String(error.stdout || ''), env);
    const details = output.split('\n').filter(line => /error|failed|exception|not found|sdk/i.test(line)).slice(-15).join('\n');
    throw Error(label + ' a échoué. Vérifiez le JDK 21, le SDK Android et, en voie signée, le magasin de clés.\n' + details);
  }
}

function apk(lane) {
  const folder = path.join(root, 'android/app/build/outputs/apk', lane);
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => name.endsWith('.apk')) : [];
  if (files.length !== 1) throw Error('Un seul APK est attendu dans ' + folder + ', ' + files.length + ' trouvé(s).');
  return path.join(folder, files[0]);
}

function release(mode, env = process.env) {
  const lane = validate(env);
  if (mode === '--check') {
    console.log(lane === 'release'
      ? 'Magasin de clés présent : APK de version signé (valeurs masquées).'
      : 'Aucun magasin de clés : APK de test signé par la clé de débogage du runner.');
    return lane;
  }
  if (mode === '--verify') { verify(apk(lane), env); return lane; }
  if (mode !== '--assemble') throw Error('Usage : android-release.cjs --check | --assemble | --verify');
  if (!/^\d+$/.test(env.GITHUB_RUN_NUMBER || '')) throw Error('GITHUB_RUN_NUMBER manque : lancez le workflow GitHub Actions.');

  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const options = ['-Plumen.versionCode=' + env.GITHUB_RUN_NUMBER, '-Plumen.versionName=' + version, '--no-daemon'];
  const temporary = fs.mkdtempSync(path.join(env.RUNNER_TEMP || os.tmpdir(), 'lumen-android-'));
  fs.chmodSync(temporary, 0o700);
  try {
    let extra = {};
    if (lane === 'release') {
      const store = path.join(temporary, 'lumen.keystore');
      fs.writeFileSync(store, Buffer.from(env.ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
      options.push('-Plumen.storeFile=' + store);
      extra = { LUMEN_STORE_PASSWORD: env.ANDROID_KEYSTORE_PASSWORD, LUMEN_KEY_ALIAS: env.ANDROID_KEY_ALIAS, LUMEN_KEY_PASSWORD: env.ANDROID_KEY_PASSWORD };
    }
    gradle([lane === 'release' ? 'assembleRelease' : 'assembleDebug', ...options],
      'APK ' + (lane === 'release' ? 'de version' : 'de test'), env, extra);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  const built = apk(lane);
  console.log('APK : ' + path.relative(root, built) + ' (' + Math.round(fs.statSync(built).size / 1024) + ' kio)');
  return lane;
}

/** Android 11 et suivants refusent un APK sans signature v2. Le prouver avant le téléphone. */
function verify(file, env = process.env) {
  const home = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!home) throw Error('ANDROID_HOME manque : apksigner introuvable.');
  const builds = path.join(home, 'build-tools');
  const versions = fs.readdirSync(builds).sort();
  const signer = path.join(builds, versions[versions.length - 1], 'apksigner');
  const report = execFileSync(signer, ['verify', '--verbose', file], { encoding: 'utf8' });
  const scheme = /APK Signature Scheme v2\b[^\n]*: true/.test(report) || /Verified using v2 scheme[^\n]*: true/.test(report);
  if (!scheme) throw Error('APK sans signature v2 : Android 11 et suivants la refuseraient.\n' + redact(report, env));
  console.log('Signature vérifiée (v2 présente) : ' + path.relative(root, file));
}

module.exports = { validate, release, verify, secrets };
if (require.main === module) {
  try { release(process.argv[2]); }
  catch (error) { console.error('::error::' + error.message.replace(/\n/g, '%0A')); process.exitCode = 1; }
}
