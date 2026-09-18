'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { validate, secrets } = require('../tools/android-release.cjs');
// Uniquement des valeurs d'essai : aucun magasin de clés n'est lu ni écrit ici.
const keystore = Buffer.alloc(2048, 7).toString('base64');
const configuration = { ANDROID_KEYSTORE_BASE64: keystore, ANDROID_KEYSTORE_PASSWORD: 'not-a-password',
  ANDROID_KEY_ALIAS: 'lumen-placeholder', ANDROID_KEY_PASSWORD: 'not-a-password' };

// Sans aucun secret, la voie de test reste ouverte : un APK sort quand même.
assert.equal(validate({}), 'debug');
assert.equal(validate(configuration), 'release');
// À moitié configurée, la signature est un piège silencieux : elle doit refuser.
for (const name of secrets) {
  const partial = { ...configuration }; delete partial[name];
  assert.throws(() => validate(partial), error =>
    error.message.includes(name) && !error.message.includes('not-a-password') && !error.message.includes(keystore));
}
assert.throws(() => validate({ ...configuration, ANDROID_KEYSTORE_BASE64: Buffer.alloc(64).toString('base64') }), /tronqué/);
assert.throws(() => validate({ ...configuration, ANDROID_KEY_ALIAS: 'un alias avec espaces' }), /ANDROID_KEY_ALIAS/);

const script = require.resolve('../tools/android-release.cjs');
// Un poste nu doit savoir dire quelle voie il prendrait, sans toucher à Gradle.
const check = spawnSync(process.execPath, [script, '--check'], { env: {}, encoding: 'utf8' });
assert.equal(check.status, 0);
assert.match(check.stdout, /clé de débogage/);
const signed = spawnSync(process.execPath, [script, '--check'], { env: configuration, encoding: 'utf8' });
assert.equal(signed.status, 0);
assert.match(signed.stdout, /signé/);
assert.ok(!signed.stdout.includes('not-a-password') && !signed.stdout.includes(keystore));
// Sans numéro de run, la version de l'APK serait indéterminée : échouer avant Gradle.
const assemble = spawnSync(process.execPath, [script, '--assemble'], { env: {}, encoding: 'utf8' });
assert.equal(assemble.status, 1);
assert.match(assemble.stderr, /GITHUB_RUN_NUMBER/);
assert.ok(!assemble.stderr.includes('gradlew'));

console.log('PASS Android CI picks its lane, refuses half a signature and never echoes a secret');
