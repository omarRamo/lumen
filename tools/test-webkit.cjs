const { execFileSync } = require('node:child_process');
for (const file of ['tools/build.cjs', 'tests/test-browser.cjs', 'tests/test-journey-browser.cjs']) {
  execFileSync(process.execPath, [file], { stdio: 'inherit', env: { ...process.env, LUMEN_BROWSER: 'webkit' } });
}
