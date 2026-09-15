const { chromium } = require('playwright');
const t = require('../tools/browser.cjs');
const path = require('path');
const PLACE = process.env.PLACE || 'colonne-des-saisons';
const P = { schema: 3, unlocked: ['prairies-aurore'], chapters: {},
  hub: { quests: { 'premier-souffle': 'done' }, transformations: ['coupole-allumee'] } };
(async () => {
  const b = await chromium.launch(t.launchOptions());
  for (const appearance of ['light', 'dark']) {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    const p = await c.newPage();
    await p.addInitScript(x => { try { localStorage.setItem('lumen.gardens.v3', x); } catch (_) {} },
      JSON.stringify({ ...P, settings: { appearance } }));
    await p.goto('file://' + path.resolve(__dirname,'..','LUMEN.html') + '?classic');
    await p.waitForFunction(() => window.lumen && window.lumen.mode === 'home', null, { timeout: 20000 });
    await p.evaluate(key => {
      const g = window.lumen;
      for (const level of window.LUMEN_LEVELS) g.store.unlock(level.key);
      g.saveProgress();
      g.start(window.LUMEN_LEVELS.findIndex(l => l.key === key));
    }, PLACE);
    await p.waitForFunction(key => window.lumen.mode === 'playing' && window.lumen.level.key === key,
      PLACE, { timeout: 20000 });
    await p.waitForTimeout(2600);
    for (const [py, tag] of JSON.parse(process.env.SPOTS || '[[1754,"bas"],[1000,"milieu"],[260,"haut"]]')) {
      await p.evaluate(([y, px]) => {
        const g = window.lumen;
        g.player.x = px; g.player.y = y; g.player.vy = 0;
        g.camera.y = Math.max(0, Math.min(y - 720 * 0.52, g.level.height - 720));
        for (let n = 0; n < 8; n++) g.update(1 / 120);
      }, [py, Number(process.env.PX || 300)]);
      await p.waitForTimeout(500);
      await p.screenshot({ path: '/tmp/claude-0/' + (process.env.TAG || 'col') + '-' + tag + '-' + appearance + '.png' });
    }
    console.log(appearance, await p.evaluate(() => window.lumen.level.theme + ' camY=' + Math.round(window.lumen.camera.y)));
    await c.close();
  }
  await b.close();
})();
