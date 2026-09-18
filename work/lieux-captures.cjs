/* LUMEN — itération 13 : les captures avant / après des lieux retravaillés.
 *
 * Deux sortes d'images, et aucune n'est une preuve de jouabilité (ça, c'est
 * tests/test-places-playthrough.cjs) :
 *
 *   · un PLAN : le profil de chaque lieu, première partie seulement (avant la
 *     suite commune), dessiné à partir des données de LUMEN_LEVELS. Il montre
 *     la silhouette — ce que « c'est le même stage répété » voulait dire.
 *   · une SCÈNE par lieu : le vrai rendu du jeu, le joueur posé à un endroit
 *     choisi (placement d'illustration, jamais utilisé comme preuve), puis
 *     quelques secondes de vraie simulation.
 *
 * Usage : node work/lieux-captures.cjs avant|apres   (après npm run build)
 */
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const browserTools = require('../tools/browser.cjs');
const capture = require('../tools/capture.cjs');
const entry = require('../tests/browser-entry.cjs');
const root = path.resolve(__dirname, '..');
const label = process.argv[2] === 'apres' ? 'apres' : 'avant';
const out = path.join(root, 'docs', 'iteration-13');
const KEYS = ['dos-du-songe', 'astre-a-guider', 'pont-des-veilleurs', 'riviere-sans-lune', 'colonne-des-saisons', 'pluie-de-lumiere'];
const SHOWN = ['dos-du-songe', 'astre-a-guider', 'pont-des-veilleurs', 'riviere-sans-lune', 'pluie-de-lumiere'];

(async () => {
  const browser = await chromium.launch(browserTools.launchOptions());
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, locale: 'fr-FR' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root, 'LUMEN.html')).href + '?classic');
  await entry.enter(page, { legacy: true });

  // ── Le plan : six profils l'un sous l'autre, à la même échelle.
  const plan = await page.evaluate(KEYS => {
    const levels = KEYS.map(key => window.LUMEN_LEVELS.find(level => level.key === key));
    return levels.map(level => {
      const end = level.continuation ? level.continuation.start + 80 : level.width;
      const original = window.LumenLevels.create(window.LUMEN_LEVELS.indexOf(level));
      return { key: level.key, name: level.name, end, height: level.height || 900,
        spawn: level.spawn, kind: level.place?.kind,
        platforms: original.platforms.filter(p => p.x < end).map(p => ({ x: p.x, y: p.y, w: Math.min(p.w, end - p.x), h: p.h, type: p.type, role: p.placeRole || null })),
        wakeables: (original.wakeables || []).filter(w => w.x < end && w.type === 'bridge').map(w => ({ x: w.x, y: w.y, span: w.span })),
        water: original.place?.flood || null };
    });
  }, KEYS);
  const svg = drawPlan(plan);
  await page.setViewportSize({ width: 960, height: 1010 });
  await page.evaluate(svg => {
    const layer = document.createElement('div');
    layer.id = 'plan-layer';
    layer.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f4efe3';
    layer.innerHTML = svg; document.body.appendChild(layer);
  }, svg);
  await capture.shot(page, path.join(out, 'plan-' + label + '.webp'));
  await page.evaluate(() => document.getElementById('plan-layer').remove());
  await page.setViewportSize({ width: 960, height: 540 });

  // ── Une scène par lieu retravaillé.
  for (const key of SHOWN) {
    await page.evaluate(key => {
      const game = window.lumen, index = game.indexOfKey(key);
      for (const level of window.LUMEN_LEVELS.slice(0, index)) if (!level.hub) game.store.recordChapter(level.key, { stars: 0, time: 60 });
      game.start(index);
    }, key);
    await page.waitForFunction(() => window.lumen.mode === 'playing' && window.lumen.frames > 4);
    await page.waitForFunction(() => !document.getElementById('chapter-intro').classList.contains('show'), null, { timeout: 15000 }).catch(() => {});

    await page.evaluate(({ key, label }) => {
      const game = window.lumen, scene = window.__scene = {
        avant: {
          'dos-du-songe': { x: 1180, y: 554, act: g => { const d = g.place.deck; g.place.mount.calmTime = 9; d.x = 1060; Object.assign(g.player, { x: d.x + 90, y: d.y - 46 }); } },
          'astre-a-guider': { act: g => { for (const f of g.place.flowers.slice(0, 3)) window.LumenResonance.wake(f); g.place.astre.x = 900; Object.assign(g.player, { x: 1080, y: 554 }); } },
          'pont-des-veilleurs': { act: g => { for (const k of g.place.keepers) k.remaining = 9; Object.assign(g.player, { x: 1000, y: 554 }); } },
          'riviere-sans-lune': { act: g => { Object.assign(g.player, { x: 3180, y: 554 }); } },
          'pluie-de-lumiere': { act: g => { Object.assign(g.player, { x: 560, y: 554 }); } }
        },
        apres: {
          'dos-du-songe': { act: g => { const d = g.place.deck; g.place.mount.calmTime = 9; d.x = 1500; g.place.direction = -1; Object.assign(g.player, { x: d.x + 90, y: d.y - 46 }); } },
          'astre-a-guider': { act: g => { const s = g.place; s.astre.carried = true; Object.assign(g.player, { x: 1150, y: 514 }); s.astre.x = 1166; s.astre.y = 498; } },
          'pont-des-veilleurs': { act: g => { g.place.worn = true; for (const k of g.place.keepers.slice(1, 3)) k.remaining = 5; Object.assign(g.player, { x: 1850, y: 554 }); } },
          'riviere-sans-lune': { act: g => { for (const id of g.level.place.beacons.slice(0, 2)) g.wokenOnce.add(id); Object.assign(g.player, { x: 2700, y: 400 }); } },
          'pluie-de-lumiere': { act: g => { Object.assign(g.player, { x: 700, y: 480 }); } }
        }
      }[label][key];
      scene.act(game);
      game.player.vx = 0; game.player.vy = 0;
    }, { key, label });
    await page.waitForTimeout(key === 'riviere-sans-lune' && label === 'apres' ? 3600 : key === 'pluie-de-lumiere' ? 2600 : 900);
    await page.evaluate(() => { for (const id of ['toast', 'level-hint']) document.getElementById(id)?.classList.remove('show'); });
    await capture.shot(page, path.join(out, key + '-' + label + '.webp'));
    await page.evaluate(() => window.lumen.showHome());
  }
  await browser.close();
  if (errors.length) { console.error(errors); process.exitCode = 1; }
  console.log('Captures ' + label + ' écrites dans docs/iteration-13/.');
})();

function drawPlan(plan) {
  const W = 960, rowH = 160, pad = 16, scale = (W - 2 * pad) / 4100;
  const color = { ground: '#6f8f6a', solid: '#9dbb8f', crumble: '#c9a46a', vanish: '#b89ad0', spring: '#e08a5c', moving: '#6aa6c9', conveyor: '#8a8fbf', echo: '#b0b0b0' };
  const role = { mount: '#c26b8f', 'living-bridge': '#d9b24a', 'rain-step': '#4fb0a0', 'astre-light': '#f0c94a', 'flood-raft': '#4f9fc9' };
  let body = '';
  plan.forEach((level, row) => {
    const top = pad + row * rowH, vScale = (rowH - 34) / level.height;
    const X = x => pad + x * scale, Y = y => top + 26 + y * vScale;
    body += `<text x="${pad}" y="${top + 14}" font-family="sans-serif" font-size="14" fill="#2d3a2c"><tspan font-weight="700">${level.name}</tspan>  ·  ${level.kind}</text>`;
    body += `<rect x="${pad}" y="${top + 24}" width="${W - 2 * pad}" height="${rowH - 30}" fill="#fffaf0" stroke="#d8cfbd"/>`;
    if (level.water) body += `<rect x="${X(level.water.start)}" y="${Y(level.water.y)}" width="${(level.water.end - level.water.start) * scale}" height="${Y(level.height) - Y(level.water.y) - 4}" fill="#7fb3d0" opacity=".35"/>`;
    for (const p of level.platforms) {
      const h = p.type === 'ground' ? Math.min(Y(p.y + (p.h || 40)), Y(level.height) - 4) - Y(p.y) : 4;
      body += `<rect x="${X(p.x)}" y="${Y(p.y)}" width="${Math.max(2, p.w * scale)}" height="${Math.max(3, h)}" fill="${role[p.role] || color[p.type] || '#9dbb8f'}" opacity="${p.type === 'ground' ? .75 : 1}"/>`;
    }
    for (const w of level.wakeables) body += `<rect x="${X(w.x - w.span / 2)}" y="${Y(w.y)}" width="${w.span * scale}" height="3" fill="#d9b24a" opacity=".6"/>`;
    body += `<circle cx="${X(level.spawn.x)}" cy="${Y(level.spawn.y + 20)}" r="5" fill="#2d6bd0"/>`;
    body += `<text x="${X(Math.min(level.end, 4050)) - 4}" y="${top + 40}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#7a705f">→ suite commune</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${pad * 2 + plan.length * rowH}">${body}</svg>`;
}
