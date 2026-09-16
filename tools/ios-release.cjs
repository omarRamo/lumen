/* CI only. No Apple account material belongs in the repository or console. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const required = ['APPSTORE_ISSUER_ID', 'APPSTORE_KEY_ID', 'APPSTORE_PRIVATE_KEY', 'APPLE_TEAM_ID'];
function validate(env) {
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) throw Error('Configuration GitHub manquante : ' + missing.map(name => name + (name === 'APPLE_TEAM_ID' ? ' (variable)' : ' (secret)')).join(', '));
  if (!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID)) throw Error('La variable APPLE_TEAM_ID doit contenir le Team ID Apple à 10 caractères.');
  if (!/^[A-Za-z0-9]+$/.test(env.APPSTORE_KEY_ID)) throw Error('Format APPSTORE_KEY_ID invalide.');
}
function release(mode, env = process.env) {
  validate(env);
  if (mode === '--check') { console.log('Configuration Apple présente (valeurs masquées).'); return; }
  if (!['--export', '--upload'].includes(mode)) throw Error('Usage : ios-release.cjs --check | --export | --upload');
  if (!/^\d+$/.test(env.GITHUB_RUN_NUMBER || '')) throw Error('GITHUB_RUN_NUMBER manque : lancez le workflow GitHub Actions.');
  const root = path.resolve(__dirname, '..'), build = path.join(root, 'ios/App/build');
  const temporary = fs.mkdtempSync(path.join(env.RUNNER_TEMP || os.tmpdir(), 'lumen-signing-'));
  fs.chmodSync(temporary, 0o700);
  try {
    const keyPath = path.join(temporary, 'AuthKey_' + env.APPSTORE_KEY_ID + '.p8');
    fs.writeFileSync(keyPath, env.APPSTORE_PRIVATE_KEY, { mode: 0o600 });
    const auth = ['-allowProvisioningUpdates', '-authenticationKeyPath', keyPath,
      '-authenticationKeyID', env.APPSTORE_KEY_ID, '-authenticationKeyIssuerID', env.APPSTORE_ISSUER_ID];
    function run(command, args, label) {
      console.log(label);
      try { execFileSync(command, args, { cwd: root, env: { ...env, API_PRIVATE_KEYS_DIR: temporary }, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }); }
      catch (error) {
        // Apple tools can echo account identifiers. Report useful error lines after redaction.
        let output = String(error.stderr || '') + '\n' + String(error.stdout || '');
        for (const name of required) output = output.split(env[name]).join('[masqué]');
        output = output.replace(/-----BEGIN [\s\S]*?-----END[^\n]*-----/g, '[clé masquée]');
        const details = output.split('\n').filter(line => /error:|error |failed|no profiles|certificate|provisioning/i.test(line)).slice(-12).join('\n');
        throw Error(label + ' a échoué. Vérifiez les accords Apple, le Team ID, le Bundle ID et les droits Certificates, Identifiers & Profiles / signature cloud de la clé.\n' + details);
      }
    }
    if (mode === '--export') {
      fs.mkdirSync(build, { recursive: true });
      const options = path.join(temporary, 'ExportOptions.plist');
      fs.writeFileSync(options, fs.readFileSync(path.join(root, 'ios/ExportOptions.plist'), 'utf8').replace('__APPLE_TEAM_ID__', env.APPLE_TEAM_ID));
      const archive = path.join(build, 'LUMEN.xcarchive');
      run('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'LUMEN', '-configuration', 'Release',
        '-destination', 'generic/platform=iOS', '-archivePath', archive,
        'DEVELOPMENT_TEAM=' + env.APPLE_TEAM_ID, 'CODE_SIGN_STYLE=Automatic',
        'CURRENT_PROJECT_VERSION=' + env.GITHUB_RUN_NUMBER, ...auth, 'archive'], 'Archive iOS');
      run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', path.join(build, 'export'),
        '-exportOptionsPlist', options, ...auth], 'Export IPA');
    } else {
      const folder = path.join(build, 'export'), ipas = fs.readdirSync(folder).filter(name => name.endsWith('.ipa'));
      if (ipas.length !== 1) throw Error('Un seul IPA exporté est attendu avant l’envoi.');
      run('xcrun', ['altool', '--upload-app', '--type', 'ios', '--file', path.join(folder, ipas[0]),
        '--apiKey', env.APPSTORE_KEY_ID, '--apiIssuer', env.APPSTORE_ISSUER_ID], 'Envoi TestFlight interne');
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
module.exports = { validate, release };
if (require.main === module) {
  try { release(process.argv[2]); }
  catch (error) { console.error('::error::' + error.message.replace(/\n/g, '%0A')); process.exitCode = 1; }
}
