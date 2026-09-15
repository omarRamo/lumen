/* Iteration 06 browser contracts. Map-population fixtures are explicitly
 * forced profiles. The lighting test instead completes chapter one with
 * actual physics and inputs: no teleports, invulnerability or complete().
 * Controller tests exercise navigator.getGamepads -> Input -> UI, not a
 * direct call to focusPlace/navigate. This is simulated input, not hardware.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const browserTools = require('../tools/browser.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'work', 'journey');
const results = [], filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const views = { desktop: { width: 1440, height: 900 }, portrait: { width: 390, height: 844 }, compact: { width: 320, height: 740 } };
let browser;
async function test(name, run) {
  if (filter && !filter.test(name)) return;
  try { await run(); results.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n' + error.stack); }
}
async function open({ view = 'desktop', source = true, language = 'fr', appearance = 'light', reduced = false } = {}) {
  const context = await browser.newContext({ viewport: views[view], locale: language, colorScheme: appearance,
    reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1, isMobile: view !== 'desktop', hasTouch: view !== 'desktop' });
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!/^(file|data):/.test(request.url())) external.push(request.url()); });
  await page.addInitScript(({ language, reduced }) => {
    if (!localStorage.getItem('lumen.gardens.v3')) localStorage.setItem('lumen.gardens.v3', JSON.stringify({ schema: 3, settings: { language, muted: true, reducedEffects: reduced } }));
    window.testPad = { id: 'Simulated standard controller', connected: true, mapping: 'standard', index: 0,
      axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.testPad] });
  }, { language, reduced });
  await page.goto(pathToFileURL(path.join(root, source ? 'index.html' : 'LUMEN.html')).href);
  await page.waitForFunction(() => window.lumen?.frames >= 2);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors, external };
}
async function map(page) {
  await page.evaluate(() => window.lumen.showMap());
  await page.waitForSelector('#map-screen.active');
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-place'));
}
async function pressPad(page, index) {
  await page.evaluate(index => {
    const game = window.lumen;
    window.testPad.buttons[index] = { pressed: true, value: 1 }; game.input.pollGamepad(game.mode);
    window.testPad.buttons[index] = { pressed: false, value: 0 }; game.input.pollGamepad(game.mode);
  }, index);
}
async function padTo(page, selector) {
  for (let steps = 0; steps < 100; steps++) {
    if (await page.evaluate(selector => document.activeElement?.matches(selector), selector)) return steps;
    await pressPad(page, 13);
  }
  assert.fail('Controller cannot reach ' + selector + ': ' + await page.evaluate(() => document.activeElement?.outerHTML));
}
async function forceCompleteProfile(page) {
  return page.evaluate(() => {
    const game = window.lumen, model = window.LumenJourney.describe(game), profile = game.store.profile;
    // Named forced-state fixture; never used by the real-completion test.
    profile.unlocked = model.places.filter(place => place.kind === 'stage' || place.kind === 'island').map(place => place.id);
    for (const place of model.places.filter(place => ['stage', 'island'].includes(place.kind))) {
      profile.chapters[place.id] = { completed: true, stars: place.maxStars, coins: 42, score: 2000, time: 80, medal: 'gold', bestTimedTime: 75 };
    }
    profile.bonusUnlocked = true; profile.finished = true;
    profile.hub.quests['premier-souffle'] = 'done'; profile.hub.transformations = ['coupole-allumee'];
    profile.codex.creatures = window.LumenSong.ISLANDS.flatMap(island => island.lights.map(light => 'chant-' + light.id));
    profile.expeditions.completed = 3;
    return model.places.map(({ id, kind, act }) => ({ id, kind, act }));
  });
}
async function clean(run) { assert.deepEqual(run.errors, []); assert.deepEqual(run.external, []); await run.context.close(); }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch(browserTools.launchOptions());
  try {
    await test('Une carte dynamique sans doublon remplace les deux accès dans source et portable', async () => {
      for (const source of [true, false]) {
        const run = await open({ source }), { page } = run;
        assert.equal(await page.evaluate(() => window.lumen.song.index), 0);
        assert.equal(await page.locator('#map-screen.active').count(), 0, 'The map must never appear at launch.');
        await page.locator('#song-shell [data-command="song-atlas"]').first().click();
        await page.waitForSelector('#map-screen.active');
        const first = await page.locator('[data-place]').evaluateAll(nodes => nodes.map(node => node.dataset.place));
        const expected = await page.evaluate(() => [...window.LUMEN_LEVELS.map(level => level.key), ...window.LumenSong.ISLANDS.map(island => island.key), window.LumenJourney.DREAMS_KEY]);
        assert.equal(new Set(first).size, expected.length); assert.deepEqual([...first].sort(), [...expected].sort());
        assert.equal(await page.locator('.song-panel-atlas, #level-grid').count(), 0);
        await page.evaluate(() => { window.lumen.start(0); window.lumen.showMap(); });
        assert.deepEqual(await page.locator('[data-place]').evaluateAll(nodes => nodes.map(node => node.dataset.place)), first);
        const labels = await page.locator('[data-place]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
        assert.ok(labels.every(label => label && label.length > 12));
        await clean(run);
      }
    });

    await test('Profil neuf : les Rêves expliquent leur verrou et la manette mène à la coupole', async () => {
      const run = await open({ view: 'portrait' }), { page } = run; await map(page);
      await padTo(page, '[data-place="reves-nomades"]'); await pressPad(page, 0);
      assert.equal(await page.locator('[data-journey-launch="reves-nomades"]').count(), 0);
      assert.ok((await page.locator('#journey-lock-note').textContent()).trim().length > 15);
      assert.equal(await page.evaluate(() => window.lumen.canEnterDreams().allowed), false);
      const hub = await page.evaluate(() => window.LUMEN_LEVELS.find(level => level.hub).key);
      await padTo(page, '[data-journey-requirement="' + hub + '"]'); await pressPad(page, 0);
      assert.equal(await page.locator('[data-place="' + hub + '"]').getAttribute('aria-pressed'), 'true');
      await padTo(page, '[data-journey-launch="' + hub + '"]'); await pressPad(page, 0);
      await page.waitForFunction(() => window.lumen.session === 'hub' && window.lumen.mode === 'playing');
      assert.equal(await page.evaluate(() => window.lumen.canEnterDreams().allowed), false);
      await clean(run);
    });

    await test('Un chapitre réellement joué allume la carte, annonce son succès et survit au rechargement', async () => {
      for (const reduced of [false, true]) {
        const run = await open({ reduced }), { page } = run;
        await map(page);
        const before = await page.locator('[data-place].is-lit').count();
        await page.locator('[data-place="prairies-aurore"]').click();
        await page.locator('[data-journey-launch="prairies-aurore"]').click();
        await page.waitForFunction(() => window.lumen.session === 'campaign' && window.lumen.mode === 'playing');
        const played = await page.evaluate(() => {
          const game = window.lumen; let jumpUntil = 0, lastJump = -10, jumps = 0;
          for (let frame = 0; frame < 120 * 90 && ['playing', 'dead'].includes(game.mode); frame++) {
            if (game.mode === 'playing') {
              game.input.virtual('right', true, 'journey-pilot');
              const p = game.player;
              const floor = game.platforms.filter(s => s.type === 'ground' && s.x <= p.x + 16 && s.x + s.w >= p.x + 16).sort((a, b) => b.x - a.x)[0];
              const enemy = game.enemies.some(e => e.alive && e.x > p.x && e.x - p.x < 125 && Math.abs(e.y - p.y) < 110);
              if (p.grounded && game.elapsed - lastJump > .12 && ((floor ? floor.x + floor.w : Infinity) - p.x < 80 || enemy)) {
                game.input.virtual('jump', true, 'journey-pilot'); jumpUntil = game.elapsed + .45; lastJump = game.elapsed; jumps++;
              } else if (game.elapsed > jumpUntil) game.input.virtual('jump', false, 'journey-pilot');
            }
            game.update(1 / 120); game.input.clearFrame();
          }
          game.input.reset(); game.renderer.draw(game, 0); game.emit('frame', .1);
          return { mode: game.mode, record: game.store.chapter('prairies-aurore'), jumps, hp: game.player.hp, coins: game.levelCoins };
        });
        assert.equal(played.mode, 'complete', JSON.stringify(played));
        assert.ok(played.jumps > 0 && played.coins > 0 && played.hp > 0 && played.record.completed);
        await page.locator('#complete-screen [data-command="map"]').click();
        await page.waitForSelector('#map-screen.active');
        assert.equal(await page.locator('[data-place].is-lit').count(), before + 1);
        assert.equal(await page.locator('[data-place="prairies-aurore"].is-new.is-lit').count(), 1);
        const announcement = await page.locator('#journey-announcement').textContent();
        assert.ok(announcement.includes('lumière')); assert.equal(await page.locator('#journey-announcement').getAttribute('aria-live'), 'polite');
        if (reduced) assert.equal(await page.locator('[data-place="prairies-aurore"] .journey-core').evaluate(node => getComputedStyle(node).animationName), 'none');
        await page.screenshot({ path: path.join(output, 'real-completion-' + (reduced ? 'reduced' : 'animated') + '.png') });
        await page.reload(); await page.waitForFunction(() => window.lumen?.frames >= 2); await map(page);
        assert.equal(await page.locator('[data-place="prairies-aurore"].is-lit').count(), 1);
        assert.equal(await page.locator('[data-place].is-lit').count(), before + 1);
        await clean(run);
      }
    });

    await test('[état forcé] Plusieurs succès en attente ouvrent la constellation du lieu tout juste quitté', async () => {
      const run = await open({ view: 'portrait' }), { page } = run;
      await page.evaluate(() => {
        const game = window.lumen;
        game.store.recordChapter('chant-petits-matins', { stars: 1 }); game.saveProgress();
        game.store.unlock('verger-qui-reve');
        game.start(window.LUMEN_LEVELS.findIndex(level => level.key === 'verger-qui-reve'));
        game.store.recordChapter('verger-qui-reve', { stars: 2 }); game.saveProgress();
      });
      await map(page);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.place), 'verger-qui-reve');
      assert.equal(await page.locator('.journey-region.is-current').getAttribute('data-act'), '3');
      assert.equal(await page.locator('[data-place="chant-petits-matins"].is-new').count(), 1);
      await clean(run);
    });

    await test('[état forcé] La manette atteint et lance chaque lieu, chaque acte et les actions de carte', async () => {
      for (const view of ['desktop', 'portrait']) {
        const run = await open({ view }), { page } = run;
        const places = await forceCompleteProfile(page), launched = [];
        for (const place of places) {
          // Each case starts on the map. All subsequent focus/activation is
          // driven exclusively by the Gamepad API until that place launches.
          await map(page);
          if (view === 'portrait' && place.act) {
            await padTo(page, '[data-journey-act="' + place.act + '"]'); await pressPad(page, 0);
          }
          await padTo(page, '[data-place="' + place.id + '"]'); await pressPad(page, 0);
          assert.equal(await page.locator('[data-place="' + place.id + '"]').getAttribute('aria-pressed'), 'true');
          if (place.kind === 'stage' || place.kind === 'island') {
            await padTo(page, '[data-journey-mode="timed"]'); await pressPad(page, 0);
            assert.equal(await page.locator('[data-journey-mode="timed"]').getAttribute('aria-pressed'), 'true');
            await padTo(page, '[data-journey-mode="explore"]'); await pressPad(page, 0);
          }
          await padTo(page, '[data-journey-launch="' + place.id + '"]'); await pressPad(page, 0);
          if (place.kind === 'dreams') await page.waitForSelector('#dream-screen.active');
          else await page.waitForFunction(id => window.lumen.mode === 'playing' && window.lumen.level.key === id, place.id);
          launched.push(place.id);
          await page.waitForFunction(() => !document.getElementById('transition').classList.contains('show'));
        }
        assert.deepEqual(launched, places.map(place => place.id));
        await map(page);
        const codex = view === 'desktop' ? '#journey-codex-button' : '.journey-mobile-codex';
        await padTo(page, codex); await pressPad(page, 0);
        assert.equal(await page.locator('#journey-codex').isVisible(), true);
        assert.equal(await page.locator('#journey-codex .journey-voice').count(), 9);
        await padTo(page, '[data-journey-codex="close"]'); await pressPad(page, 0);
        assert.equal(await page.locator('#journey-codex').isVisible(), false);
        await pressPad(page, 1); await page.waitForFunction(() => window.lumen.mode !== 'map');
        console.log('      ' + view + ': ' + launched.length + ' lieux lancés par Gamepad API simulée');
        await clean(run);
      }
    });

    await test('[état forcé] Cibles 48 px, aucun chevauchement et états distincts en gris sur mobile et arabe', async () => {
      const partial = JSON.parse(fs.readFileSync(path.join(root, 'docs/iteration-06/captures/before/manifest.json'), 'utf8')).profiles.mid;
      for (const view of ['desktop', 'portrait', 'compact']) for (const appearance of ['light', 'dark']) for (const language of ['fr', 'ar']) {
        const run = await open({ view, appearance, language }), { page } = run;
        await page.evaluate(profile => {
          const game = window.lumen;
          Object.assign(game.store.profile.chapters, profile.chapters);
          game.store.profile.unlocked = profile.unlocked;
        }, partial);
        await map(page);
        for (const act of [1, 2, 3]) {
          if (view !== 'desktop') await page.locator('[data-journey-act="' + act + '"]').click();
          const layout = await page.evaluate(() => {
            const elements = [...document.querySelectorAll('#map-screen button')].filter(element => element.getClientRects().length);
            const rects = elements.map(element => ({ key: element.dataset.place || element.textContent.trim(), ...element.getBoundingClientRect().toJSON() }));
            const pairs = [];
            for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i], b = rects[j];
              if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) pairs.push([a.key, b.key]);
            }
            return { small: rects.filter(rect => rect.width < 47.9 || rect.height < 47.9), overlaps: pairs,
              outside: rects.filter(rect => rect.left < -1 || rect.right > innerWidth + 1),
              overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.getElementById('map-screen').scrollWidth > innerWidth + 1 };
          });
          assert.deepEqual(layout.small, [], JSON.stringify({ view, appearance, language, act, layout }));
          assert.deepEqual(layout.overlaps, [], JSON.stringify({ view, appearance, language, act, layout }));
          assert.deepEqual(layout.outside, [], JSON.stringify({ view, appearance, language, act, layout }));
          assert.equal(layout.overflow, false);
        }
        if (view === 'desktop') {
          const shapes = await page.evaluate(() => {
            const read = selector => {
              const element = document.querySelector(selector), style = getComputedStyle(element);
              const lum = value => {
                const c = value.match(/[\d.]+/g).slice(0, 3).map(n => { const v = +n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
                return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
              };
              const ink = lum(style.color), background = lum(getComputedStyle(document.getElementById('map-screen')).backgroundColor);
              return { width: element.getBoundingClientRect().width, fontSize: style.fontSize, border: style.borderStyle,
                contrast: (Math.max(ink, background) + .05) / (Math.min(ink, background) + .05) };
            };
            return { lit: read('.journey-node.stage.is-lit .journey-core'), unlit: read('.journey-node.stage:not(.is-lit) .journey-core') };
          });
          assert.ok(shapes.lit.width > shapes.unlit.width, 'A lit point must change size independently of color.');
          assert.notEqual(shapes.lit.fontSize, shapes.unlit.fontSize);
          assert.ok(shapes.lit.contrast >= 3, JSON.stringify(shapes));
          if (language === 'fr') {
            await page.addStyleTag({ content: '#map-screen { filter: grayscale(1) !important; }' });
            await page.screenshot({ path: path.join(output, 'grayscale-' + appearance + '.png'), animations: 'disabled' });
          }
        }
        await clean(run);
      }
    });
  } finally { await browser.close(); }
  const failed = results.filter(result => !result.passed).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' journey browser contracts passed.');
  if (!filter) fs.writeFileSync(path.join(root, 'tests', 'journey-browser-results.json'), JSON.stringify({ passed: results.length - failed, failed, checks: results,
    scope: 'Desktop Chromium; simulated touch and Gamepad API. Forced fixtures labelled. Real chapter completion separate. No physical mobile/controller or human usability test.' }, null, 2) + '\n');
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
