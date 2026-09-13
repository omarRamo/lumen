/* Independent visual and performance regression harness for renderer.js.
 * Run with the bundled node runtime or any Node with Playwright available. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/omart/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  let browser;
  try { browser = await chromium.launch({ headless: true, channel: 'msedge' }); }
  catch (_) { browser = await chromium.launch({ headless: true }); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  const hasUI = fs.existsSync(path.join(root, 'js', 'ui.js'));
  if (hasUI) {
    await page.setViewportSize({width:1440,height:900});
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(__dirname,'renderer-home-ui.png')});
    await page.setViewportSize({width:1280,height:720});
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      for (const element of document.querySelector('#app').children) if(element.tagName !== 'CANVAS') element.style.display='none';
    });
  }
  else {
    await page.setContent('<html><head><style>html,body{margin:0;overflow:hidden;background:#103039}canvas{width:100vw;height:100vh}</style></head><body><canvas id="game"></canvas></body></html>');
    for (const name of ['levels', 'audio', 'renderer', 'engine']) await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8') });
  }
  await page.evaluate(() => {
    window.renderTestGame = window.lumen || new LumenGame(document.querySelector('canvas'));
    renderTestGame.running = false;
  });
  const result = [];
  for (let index = 0; index < 8; index++) {
    const report = await page.evaluate(index => {
      const game = window.renderTestGame;
      game.loadLevel(index, false); game.mode = 'playing'; game.emit('mode','playing'); game.time = 3.7;
      game.camera.x = index === 7 ? game.level.width - 1280 : index === 0 ? 0 : 850;
      game.player.x = game.camera.x + 250; game.player.y = 554; game.player.grounded = true;
      game.renderer.draw(game, 1 / 60);
      return { index, theme: game.level.theme, water: game.level.water || null };
    }, index);
    await page.screenshot({ path: path.join(__dirname, 'renderer-' + report.theme + '.png') });
    const timings = await page.evaluate(async () => {
      const game = window.renderTestGame, times = [];
      for (let frame = 0; frame < 100; frame++) {
        const start = performance.now(); game.time += 1 / 60; game.renderer.draw(game, 1 / 60); times.push(performance.now() - start);
        if (frame % 10 === 0) await new Promise(requestAnimationFrame);
      }
      times.sort((a, b) => a - b);
      return { median: times[50], p95: times[95], max: times[99], average: times.reduce((a, b) => a + b, 0) / times.length };
    });
    result.push({ ...report, timings });
  }
  await page.evaluate(() => {
    const game = renderTestGame; game.showHome(); game.time = 2.3;
    game.renderer.draw(game,1/60);
  });
  await page.screenshot({ path: path.join(__dirname, 'renderer-home.png') });
  if (hasUI) {
    for (const viewport of [{width:390,height:844,label:'portrait'},{width:844,height:390,label:'landscape'}]) {
      const mobile = await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
      mobile.on('pageerror',e=>errors.push(e.message));
      await mobile.goto(pathToFileURL(path.join(root,'index.html')).href);
      await mobile.locator('#start-button').click();
      await mobile.waitForTimeout(1800);
      await mobile.screenshot({path:path.join(__dirname,'renderer-game-'+viewport.label+'.png')});
      result.push(await mobile.evaluate(() => ({viewport:{width:innerWidth,height:innerHeight},worldWidth:lumen.renderer.worldWidth,scale:lumen.renderer.scale,mode:lumen.mode,playerVisible:lumen.player.x-lumen.camera.x>=0&&lumen.player.x-lumen.camera.x<lumen.renderer.worldWidth})));
      await mobile.close();
    }
  }
  fs.writeFileSync(path.join(__dirname, 'renderer-results.json'), JSON.stringify({ errors, hasUI, result }, null, 2));
  console.log(JSON.stringify({errors, hasUI, result}, null, 2));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
