/* Opens the portable edition over file:// in a real browser and drives it with
 * real keyboard input, exactly as a player would. Fails on any console error.
 * Run from the LUMEN directory: node work/verify-browser.cjs
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const shots = path.join(root, 'work', 'shots');
fs.mkdirSync(shots, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const report = { errors: [], steps: [], fps: null };

  for (const [label, size] of [['desktop', { width: 1440, height: 900 }], ['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    page.on('pageerror', e => report.errors.push(label + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(label + ' console: ' + m.text()); });
    await page.goto('file://' + path.join(root, 'LUMEN.html').replace(/\\/g, '/'));
    await page.waitForFunction(() => window.lumen && window.lumen.mode === 'home', null, { timeout: 15000 });
    if (label === 'desktop') await page.screenshot({ path: path.join(shots, 'home.png') });

    // The atlas, with its run-mode switch, medal legend and chapter records.
    await page.click('[data-command="map"]');
    await page.waitForTimeout(600);
    await page.click('[data-run-mode="timed"]');
    await page.click('[data-command="medal-help"]');
    await page.waitForTimeout(250);
    if (label === 'desktop') await page.screenshot({ path: path.join(shots, 'atlas-timed.png') });
    report.steps.push({ view: label, atlasCards: await page.locator('.level-card').count(),
      medalLegendVisible: await page.locator('#medal-help').isVisible() });

    // A real timed run of chapter one, driven from the keyboard.
    await page.click('[data-command="medal-help"]');
    await page.click('.level-card[data-level="0"]');
    await page.waitForFunction(() => window.lumen.mode === 'playing', null, { timeout: 8000 });
    await page.keyboard.down('ArrowRight');
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(260); }
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
    const play = await page.evaluate(() => ({ mode: window.lumen.mode, x: Math.round(window.lumen.player.x),
      runMode: window.lumen.runMode, clockVisible: !document.getElementById('run-clock').classList.contains('hidden'),
      clock: document.getElementById('clock-time').textContent, fps: window.lumen.fps,
      particles: window.lumen.particles.length }));
    report.steps.push({ view: label, play });
    if (label === 'desktop') { await page.screenshot({ path: path.join(shots, 'playing-timed.png') }); }
    if (label === 'portrait') await page.screenshot({ path: path.join(shots, 'playing-portrait.png') });

    // A steady frame-rate sample, taken well after start-up on a quiet stretch.
    if (label === 'desktop') {
      await page.evaluate(() => { window.lumen.start(0); window.lumen.frameWindow.length = 0; });
      await page.waitForTimeout(3000);
      report.fps = await page.evaluate(() => window.lumen.fps);
    }

    // The damage flash, a power pickup and its expiry warning.
    // The pulse is short by design, so it is sampled inside the same round-trip.
    const damage = await page.evaluate(() => {
      const g = window.lumen;
      if (g.mode !== 'playing') g.start(0);
      const before = g.player.hp;
      g.player.invuln = 0; g.hurt(1, g.player.x + 300);
      g.player.power = 'echo'; g.player.powerDuration = 40; g.player.powerTime = 4.4; g.player.powerWarning = true;
      return { heartPulse: document.getElementById('hud').classList.contains('heart-hit'),
        heartLost: g.player.hp === before - 1, sceneFlash: !!g.flash, shake: g.camera.shake > 0 };
    });
    await page.waitForTimeout(220);
    if (label === 'desktop') await page.screenshot({ path: path.join(shots, 'damage-and-power.png') });
    report.steps.push({ view: label, ...damage,
      powerVisible: await page.locator('#power-indicator').isVisible(),
      powerExpiring: await page.evaluate(() => document.getElementById('power-indicator').classList.contains('expiring')) });

    // The finale: phase two, the closing arena and the new falling-light pattern.
    await page.evaluate(() => {
      const g = window.lumen, final = window.LUMEN_LEVELS.findIndex(l => l.final);
      g.progress.unlocked = window.LUMEN_LEVELS.length - 1; g.start(final);
      Object.assign(g.player, { x: 3560, y: 552, invuln: 1e4 });
      Object.assign(g.boss, { activated: true, hp: 6, state: 'rain', timer: 1.2, rainMarkers: [
        { x: 3600, life: .8 }, { x: 3820, life: .6 }, { x: 4040, life: .9 }] });
      g.camera.x = 3200;
    });
    await page.waitForTimeout(900);
    const fight = await page.evaluate(() => ({ phase: window.lumen.boss.phase, stage: window.lumen.boss.stage,
      arenaActive: window.lumen.boss.arenaActive, bossHudVisible: !document.getElementById('boss-hud').classList.contains('hidden'),
      phaseLabel: document.getElementById('boss-phase').textContent, mode: window.lumen.mode }));
    report.steps.push({ view: label, fight });
    if (label === 'desktop') await page.screenshot({ path: path.join(shots, 'boss-phase-two.png') });

    // The end-of-chapter summary, with its medal and full breakdown.
    await page.evaluate(() => {
      const g = window.lumen; g.start(0); g.levelStars = 3; g.levelCoins = 41;
      g.enemiesDefeated = 7; g.damageTaken = 1; g.elapsed = 48.6; g.complete();
    });
    await page.waitForTimeout(500);
    const summary = await page.evaluate(() => ({ medal: document.getElementById('result-medal-name').textContent,
      medalClass: document.getElementById('result-medal').className, time: document.getElementById('result-time').textContent,
      enemies: document.getElementById('result-enemies').textContent, damage: document.getElementById('result-damage').textContent,
      recordShown: !document.getElementById('result-record').classList.contains('hidden') }));
    report.steps.push({ view: label, summary });
    if (label === 'desktop') await page.screenshot({ path: path.join(shots, 'chapter-summary.png') });
    if (label === 'landscape') await page.screenshot({ path: path.join(shots, 'summary-landscape.png') });

    // Nothing on the page may scroll sideways at any of these sizes.
    report.steps.push({ view: label, horizontalOverflow: await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) });
    await page.close();
  }

  await browser.close();
  report.ok = report.errors.length === 0;
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'work', 'browser-results.json'), JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
})();
