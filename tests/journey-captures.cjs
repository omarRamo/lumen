/* Reproducible iteration 06 visual evidence. These are deliberately FORCED
 * SAVED PROFILES, not playthroughs. Real progression is tested separately.
 * node tests/journey-captures.cjs before <checkout-of-0806ceb>
 * node tests/journey-captures.cjs after
 * node tests/journey-captures.cjs after --stages-only (unchanged game sources only)
 * The same profile bytes, viewport, locale and appearance are compared.
 * The old atlas and chapter grid are two separate destinations. After the
 * change both entry points must lead to the shared map; this is not a claim
 * that different map layouts depict the same world-space location.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const browserTools = require('../tools/browser.cjs');

const root = path.resolve(__dirname, '..');
const phase = process.argv[2];
assert.ok(['before', 'after'].includes(phase), 'Choose before or after.');
const stagesOnly = process.argv.includes('--stages-only');
assert.ok(!stagesOnly || phase === 'after', 'Stage-only refresh requires after.');
const sourceArgument = process.argv.slice(3).find(arg => !arg.startsWith('--'));
const sourceRoot = sourceArgument ? path.resolve(sourceArgument) : root;
if (phase === 'before') assert.notEqual(sourceRoot, root, 'Before requires the unchanged starting checkout.');
const directory = path.join(root, 'docs', 'iteration-06', 'captures');
const output = path.join(directory, phase);
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const sourceDigest = () => digest(['index.html', 'style.css', 'song.css', 'js/ui.js', 'js/song-ui.js', 'js/levels.js', 'js/places.js', 'js/place-art.js', 'js/renderer.js', 'js/world-art.js', 'js/journey.js', 'js/journey-ui.js', 'journey.css'].filter(file => fs.existsSync(path.join(sourceRoot, file))).map(file => fs.readFileSync(path.join(sourceRoot, file), 'utf8')).join('\n'));
const views = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

function fixturesFor(data) {
  const fresh = { schema: 3, unlocked: [data.campaign[0]], chapters: {},
    bonusUnlocked: false, finished: false,
    settings: { language: 'fr', appearance: 'system', muted: true },
    hub: { quests: {}, transformations: [] }, codex: { creatures: [], phenomena: [] },
    expeditions: { runs: 0, completed: 0, bestRooms: 0 } };
  const record = index => ({ completed: true, stars: 3, coins: 42, score: 2400,
    time: 65 + index, medal: index % 2 ? 'silver' : 'gold', bestTimedTime: 60 + index });
  const mid = JSON.parse(JSON.stringify(fresh));
  mid.unlocked = data.campaign.slice(0, 5);
  [...data.campaign.slice(0, 4), ...data.islands.slice(0, 2)].forEach((key, index) => { mid.chapters[key] = record(index); });
  mid.hub = { quests: { 'premier-souffle': 'done' }, transformations: ['coupole-allumee'] };
  mid.codex.creatures = data.voices.slice(0, 6);
  mid.expeditions = { runs: 3, completed: 1, bestRooms: 5 };
  const full = JSON.parse(JSON.stringify(mid));
  full.unlocked = [...data.campaign]; full.finished = true; full.bonusUnlocked = true;
  [...data.campaign, ...data.islands].forEach((key, index) => { full.chapters[key] = record(index); });
  full.codex.creatures = [...data.voices];
  full.expeditions = { runs: 8, completed: 5, bestRooms: 5 };
  return { fresh, mid, full };
}

async function metadata(browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(sourceRoot, 'index.html')).href);
    await page.waitForFunction(() => window.lumen?.frames >= 2);
    return await page.evaluate(() => ({
      campaign: window.LUMEN_LEVELS.filter(level => !level.hub).map(level => level.key),
      islands: window.LumenSong.ISLANDS.map(island => island.key),
      voices: window.LumenSong.ISLANDS.flatMap(island => island.lights.map(light => 'chant-' + light.id)),
      authoredPlaces: window.LUMEN_LEVELS.filter(level => level.place).map(level => level.key)
    }));
  } finally { await context.close(); }
}

async function capturePlace(browser, key, appearance, profile) {
  const viewport = views.desktop;
  const context = await browser.newContext({ viewport, colorScheme: appearance, locale: 'fr-FR', deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!/^(file|data):/.test(request.url())) external.push(request.url()); });
  try {
    await page.addInitScript(saved => {
      localStorage.clear(); localStorage.setItem('lumen.gardens.v3', JSON.stringify(saved));
      let seed = 6006;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      const frame = window.requestAnimationFrame.bind(window);
      let bootstrapFrames = 0;
      // The world clock includes time on the title screen. Bootstrap exactly
      // two fixed steps so moving platforms begin both appearances in phase.
      window.requestAnimationFrame = callback => frame(() => {
        if (window.captureFrozen) return;
        callback(++bootstrapFrames * 1000 / 120);
        if (window.lumen?.frames >= 2) window.captureFrozen = true;
      });
    }, profile);
    await page.goto(pathToFileURL(path.join(sourceRoot, 'index.html')).href);
    await page.waitForFunction(() => window.lumen?.frames >= 2, null, { polling: 100 });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'tests', 'place-pilot.cjs'), 'utf8') });
    const state = await page.evaluate(key => {
      const game = window.lumen;
      window.captureFrozen = true;
      const initialSimulationTime = game.time;
      game.start(window.LUMEN_LEVELS.findIndex(level => level.key === key));
      const pilot = window.LumenPlacePilot.create(game), config = game.level.place;
      const target = config.captureMetric;
      for (let frame = 0; frame < 120 * 90 && game.mode === 'playing'; frame++) {
        pilot.step(); game.update(1 / 120); game.input.clearFrame();
        if (target ? Number(game.place?.metrics?.[target.name]) >= target.min : game.elapsed >= (config.captureAfter || 6)) break;
      }
      game.input.reset(); game.emit('frame', .1); game.renderer.draw(game, 0);
      return { key, initialSimulationTime, captureMethod: 'input-only replay from authored spawn; completed profile only grants access',
        mode: game.mode, elapsed: +game.elapsed.toFixed(4), camera: { x: +game.camera.x.toFixed(3), y: +game.camera.y.toFixed(3) },
        player: { x: +game.player.x.toFixed(3), y: +game.player.y.toFixed(3) }, metrics: { ...game.place?.metrics },
        expectedTitle: window.LumenI18n.t(game.level.name), hudTitle: document.getElementById('chapter-name').textContent };
    }, key);
    assert.equal(state.mode, 'playing', key + ' capture should show gameplay');
    assert.equal(state.hudTitle, state.expectedTitle, key + ' must announce its actual stage in the HUD');
    await page.evaluate(() => document.fonts.ready);
    // Gameplay RAF is deliberately frozen above; poll the real-time intro timer independently.
    await page.waitForFunction(() => !document.getElementById('chapter-intro').classList.contains('show'), null, { polling: 100 });
    const image = 'place-' + key + '-' + appearance + '-desktop.png';
    await page.screenshot({ path: path.join(output, image), animations: 'disabled' });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('CAPTURE ' + phase + '/' + image);
    return { image, viewport, appearance, locale: 'fr-FR', cosmeticSeed: 6006, bootstrapFrames: 2, fixedStep: 1 / 120, ...state };
  } finally { await context.close(); }
}

async function capture(browser, profile, fixture, entry, view, appearance, supplemental = false) {
  const viewport = views[view];
  const context = await browser.newContext({ viewport, colorScheme: appearance,
    locale: 'fr-FR', deviceScaleFactor: 1, hasTouch: view === 'mobile', isMobile: view === 'mobile' });
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!/^(file|data):/.test(request.url())) external.push(request.url()); });
  try {
    await page.addInitScript(saved => {
      localStorage.clear(); localStorage.setItem('lumen.gardens.v3', JSON.stringify(saved));
      let seed = 6006;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      const frame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => frame(time => { if (!window.captureFrozen) callback(time); });
    }, profile);
    await page.goto(pathToFileURL(path.join(sourceRoot, 'index.html')).href + (entry === 'campaign' ? '?classic' : ''));
    await page.waitForFunction(() => window.lumen?.frames >= 2);
    await page.evaluate(() => document.fonts.ready);
    if (entry === 'archipelago') await page.locator('#song-shell [data-command="song-atlas"]').first().click();
    else await page.evaluate(() => window.lumen.showMap());
    await page.waitForFunction(() => !!document.querySelector('.song-panel-atlas, #map-screen.active'));
    await page.waitForFunction(() => !document.getElementById('transition').classList.contains('show'));
    await page.evaluate(() => document.fonts.ready);
    const surface = await page.evaluate(() => {
      const game = window.lumen;
      window.captureFrozen = true; game.time = 2;
      game.camera.x = 0; game.camera.y = 0; game.camera.shake = 0;
      Object.assign(game.player, { x: 180, y: 554, vx: 0, vy: 0, grounded: true, facing: 1,
        anim: 0, landTimer: 0, jumpTimer: 0, invuln: 0 });
      game.particles.length = 0; game.renderer.draw(game, 0);
      const panel = document.querySelector('.song-panel-atlas') || document.getElementById('map-screen');
      for (const element of [document.scrollingElement, panel, ...panel.querySelectorAll('*')]) {
        if (element) { element.scrollLeft = 0; element.scrollTop = 0; }
      }
      return { mode: game.mode, renderedSurface: panel.className,
        oldIslandCards: panel.querySelectorAll('[data-song-island]').length,
        oldChapterCards: panel.querySelectorAll('[data-level]').length,
        journeyNodes: panel.querySelectorAll('[data-place]').length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight,
        title: panel.querySelector('h1,h2')?.textContent || '' };
    });
    const image = [fixture, appearance, view, entry].join('-') + '.png';
    await page.screenshot({ path: path.join(output, image), animations: 'disabled' });
    assert.deepEqual(errors, [], image + ' has JavaScript errors');
    assert.deepEqual(external, [], image + ' made a network request');
    console.log('CAPTURE ' + phase + '/' + image);
    return { image, fixture, fixtureKind: 'forced-saved-profile', profileHash: digest(profile),
      entry, view, viewport, appearance, locale: 'fr-FR', deviceScaleFactor: 1,
      cosmeticSeed: 6006, frozenTime: 2, scrollPosition: 'top-left', supplemental, surface };
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch(browserTools.launchOptions());
  try {
    const data = await metadata(browser);
    const before = phase === 'after' ? JSON.parse(fs.readFileSync(path.join(directory, 'before', 'manifest.json'), 'utf8')) : null;
    const profiles = before ? before.profiles : fixturesFor(data);
    const previous = stagesOnly ? JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8')) : null;
    if (previous) {
      assert.equal(previous.sourceDigest, sourceDigest(), 'Game sources changed; regenerate the full matrix.');
      assert.deepEqual(previous.content, data, 'Capture content changed; regenerate the full matrix.');
      assert.deepEqual(previous.profiles, profiles, 'Capture profiles changed; regenerate the full matrix.');
      assert.equal(previous.captures.length, 28, 'Stage-only refresh needs a complete map matrix.');
      for (const entry of previous.captures) assert.ok(fs.statSync(path.join(output, entry.image)).size > 0);
    }
    const captures = previous ? previous.captures : [];
    if (!previous) for (const [fixture, profile] of Object.entries(profiles)) {
      for (const appearance of ['light', 'dark']) for (const view of Object.keys(views)) {
        for (const entry of ['archipelago', 'campaign']) captures.push(await capture(browser, profile, fixture, entry, view, appearance));
      }
    }
    if (before) {
      const conditions = entries => entries.map(({ surface, ...condition }) => condition);
      assert.deepEqual(conditions(captures.filter(capture => !capture.supplemental)), conditions(before.captures), 'Before and after conditions or fixed saved profiles differ.');
      // The exact baseline-complete profile intentionally leaves newly added
      // stages unplayed. Additional images show ALL current stages completed,
      // and are explicitly excluded from the identical-profile comparison.
      if (!previous && data.campaign.some(key => !before.content.campaign.includes(key))) {
        const currentFull = fixturesFor(data).full;
        for (const appearance of ['light', 'dark']) for (const view of Object.keys(views)) {
          captures.push(await capture(browser, currentFull, 'all-current', 'archipelago', view, appearance, true));
        }
      }
    }
    const stageCaptures = [];
    if (phase === 'after') for (const key of data.authoredPlaces || []) for (const appearance of ['light', 'dark']) {
      stageCaptures.push(await capturePlace(browser, key, appearance, fixturesFor(data).full));
    }
    for (const key of data.authoredPlaces || []) {
      const pair = stageCaptures.filter(capture => capture.key === key);
      const geometry = capture => ({ key: capture.key, initialSimulationTime: capture.initialSimulationTime, elapsed: capture.elapsed, camera: capture.camera, player: capture.player, metrics: capture.metrics });
      assert.deepEqual(geometry(pair[0]), geometry(pair[1]), key + ': day and night must show the same replay state');
    }
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ phase,
      revision: phase === 'before' ? '0806ceb' : 'working-tree-iteration-06',
      sourceDigest: sourceDigest(),
      method: 'Forced saved-profile fixtures. Identical profile hashes and capture conditions are compared. Not evidence of actual progression, hardware testing, or human usability.',
      fullFixtureMeaning: 'Every campaign stage and island from the BEFORE revision is complete. Supplemental all-current images, when present, additionally complete new stages.',
      content: data, profiles, comparedWithBefore: !!before, captures, stageCaptures }, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
