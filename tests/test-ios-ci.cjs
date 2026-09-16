'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { validate } = require('../tools/ios-release.cjs');
// Only placeholders: no key material is generated, read or written by this test.
const configuration = { APPSTORE_ISSUER_ID: 'issuer-placeholder', APPSTORE_KEY_ID: 'KEYPLACEHOLDER', APPSTORE_PRIVATE_KEY: 'not-a-private-key', APPLE_TEAM_ID: 'TEAMTEST00' };
for (const name of Object.keys(configuration)) {
  const missing = { ...configuration }; delete missing[name];
  assert.throws(() => validate(missing), error => error.message.includes(name) && !error.message.includes('not-a-private-key'));
}
assert.doesNotThrow(() => validate(configuration));
assert.throws(() => validate({ ...configuration, APPLE_TEAM_ID: 'incorrect' }), /APPLE_TEAM_ID/);
const result = spawnSync(process.execPath, [require.resolve('../tools/ios-release.cjs'), '--check'], { env: {}, encoding: 'utf8' });
assert.equal(result.status, 1);
for (const name of Object.keys(configuration)) assert.ok(result.stderr.includes(name));
assert.ok(!result.stderr.includes('xcodebuild'));
console.log('PASS iOS CI fails before xcodebuild and names every missing setting without exposing values');
