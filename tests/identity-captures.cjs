'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const browserTools = require('../tools/browser.cjs');

const root = path.resolve(__dirname, '..');
const phase = process.argv[2];
assert.ok(['before', 'after'].includes(phase), 'Choose before or after.');
const output = path.join(root, 'docs', 'iteration-05', 'captures', phase);
const returning = {
  schema: 3, unlocked: ['prairies-aurore'], chapters: {},
  hub: { quests: { 'premier-souffle': 'done' }, transformations: ['coupole-allumee'] },
  expeditions: { runs: 0, completed: 0, bestRooms: 0 }
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch(browserTools.launchOptions());
  const captures = [];
  try {
    for (const [view, viewport, colorScheme] of [
      ['desktop', { width: 1440, height: 900 }, 'light'],
      ['mobile', { width: 390, height: 844 }, 'dark']
    ]) {
      for (const scene of ['home', 'chapter-1', 'observatory', 'dream', 'island-1', 'island-2', 'island-3']) {
        const context = await browser.newContext({ viewport, colorScheme, locale: 'fr-FR', deviceScaleFactor: 1,
          hasTouch: view === 'mobile', isMobile: view === 'mobile' });
        const page = await context.newPage();
        const errors = [], external = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (!/^(file|data):/.test(request.url())) external.push(request.url()); });
        await page.addInitScript(profile => {
          localStorage.setItem('lumen.gardens.v3', JSON.stringify(profile));
          const frame = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = callback => frame(time => { if (!window.captureFrozen) callback(time); });
        }, returning);
        const classic = ['chapter-1', 'observatory', 'dream'].includes(scene);
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href + (classic ? '?classic' : ''));
        await page.waitForFunction(() => window.lumen?.frames >= 2);
        await page.evaluate(() => document.fonts.ready);
        if (scene === 'chapter-1') {
          await page.evaluate(() => window.lumen.start(0));
          await page.waitForFunction(() => window.lumen.mode === 'playing');
        } else if (scene === 'observatory') {
          await page.click('[data-command="hub"]');
          await page.waitForFunction(() => window.lumen.mode === 'playing' && window.lumen.level.hub);
        } else if (scene === 'dream') {
          await page.click('[data-command="dream"]');
          await page.waitForSelector('#dream-screen.active');
          await page.fill('#seed-input', 'verger-lune-lune-0');
          await page.click('[data-command="dream-start"]');
          await page.waitForFunction(() => window.lumen.run && window.lumen.mode === 'playing');
        } else if (scene.startsWith('island-')) {
          await page.evaluate(index => {
            window.lumen.applyLevel(window.LumenSong.create(index), -1);
          }, Number(scene.at(-1)) - 1);
          await page.keyboard.down('ArrowRight');
          await page.waitForFunction(() => window.lumen.player.x > 180);
          await page.keyboard.up('ArrowRight');
        }
        const state = await page.evaluate(() => {
          const game = window.lumen;
          window.captureFrozen = true;
          game.time = 2;
          game.camera.x = 0; game.camera.y = 0; game.camera.shake = 0;
          Object.assign(game.player, { x: 180, y: 554, vx: 0, vy: 0, grounded: true, facing: 1,
            anim: 0, landTimer: 0, jumpTimer: 0, invuln: 0 });
          game.renderer.draw(game, 0);
          return { key: game.level.key, session: game.session, x: game.player.x, y: game.player.y,
            camera: { x: game.camera.x, y: game.camera.y }, time: game.time };
        });
        const image = view + '-' + scene + '.png';
        await page.screenshot({ path: path.join(output, image), animations: 'disabled' });
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        captures.push({ image, scene, viewport, colorScheme, ...state });
        console.log('CAPTURE ' + phase + '/' + image);
        await context.close();
      }
    }
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ phase, captures }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });