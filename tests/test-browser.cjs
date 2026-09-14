/* LUMEN — vérification en navigateur réel, sur l'édition portable en file://.
 * Depuis le dossier LUMEN : npm run test:browser
 *
 * Ce fichier échoue sur des ASSERTIONS FONCTIONNELLES, pas seulement sur une
 * erreur de console : chaque contrôle affirme quelque chose qu'un joueur
 * pourrait constater. Une console silencieuse sur un jeu cassé ne prouve rien.
 *
 * Aucun chemin de navigateur n'est codé en dur : voir tools/browser.cjs.
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const browserTools = require('../tools/browser.cjs');

const root = path.resolve(__dirname, '..');
const shots = path.join(root, 'work', 'shots');
const PAGE = pathToFileURL(path.join(root, 'LUMEN.html')).href;
const VIEWS = {
  bureau: { width: 1440, height: 900 },
  portrait: { width: 390, height: 844, hasTouch: true, isMobile: true },
  paysage: { width: 844, height: 390, hasTouch: true, isMobile: true },
  compact: { width: 320, height: 740, hasTouch: true, isMobile: true },
  large: { width: 2560, height: 1080 }
};

const checks = [];
let failed = 0;
async function test(name, run) {
  try { await run(); checks.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { failed++; checks.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n      ' + error.message); }
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  let browser;
  try { browser = await chromium.launch(browserTools.launchOptions()); }
  catch (error) { console.error(browserTools.explain(error)); process.exitCode = 1; return; }

  /** Ouvre la page, en collectant toute erreur au passage. */
  async function open(view = 'bureau', profile = null, options = {}) {
    const { width, height, hasTouch, isMobile } = VIEWS[view];
    const context = await browser.newContext({ viewport: { width, height }, hasTouch, isMobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // Un profil de joueur qui revient : écrit avant le premier script, comme
    // s'il était là depuis hier. Ce n'est pas un état forcé dans le moteur,
    // c'est une sauvegarde sur le disque — ce que le jeu doit savoir relire.
    if (profile) await page.addInitScript(text => {
      try { localStorage.setItem('lumen.gardens.v3', text); } catch (_) {}
    }, JSON.stringify(profile));
    const url = options.source ? pathToFileURL(path.join(root, 'index.html')).href : PAGE;
    await page.goto(url + (options.song ? '' : '?classic'));
    await page.waitForFunction(song => window.lumen && window.lumen.mode === (song ? 'playing' : 'home'), !!options.song, { timeout: 20000 });
    return { page, context, errors };
  }

  await test('Le Chant démarre directement, avec ses ressources locales et un canvas animé', async () => {
    for (const source of [false, true]) {
      const { page, context, errors } = await open('bureau', null, { song: true, source });
      const requests = [];
      page.on('request', request => { if (!/^(file|data):/.test(request.url())) requests.push(request.url()); });
      await page.reload();
      await page.waitForFunction(() => window.lumen?.song && window.lumen.frames >= 2 && document.fonts.check('500 25px Fredoka'));
      const before = await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode()));
        const game = window.lumen, canvas = game.canvas, pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set();
        for (let index = 0; index < pixels.length; index += 1084) colors.add([pixels[index] >> 4, pixels[index + 1] >> 4, pixels[index + 2] >> 4].join(':'));
        return { session: game.session, colors: colors.size, frame: canvas.toDataURL(), fonts: [document.fonts.check('500 25px Fredoka'), document.fonts.check('400 14px Outfit')] };
      });
      assert.equal(before.session, 'song');
      assert.ok(before.colors > 45, 'Canvas presque uniforme : ' + before.colors);
      assert.deepEqual(before.fonts, [true, true]);
      await page.waitForTimeout(200);
      assert.notEqual(await page.evaluate(() => window.lumen.canvas.toDataURL()), before.frame, 'Le monde doit être animé.');
      assert.deepEqual(requests, [], 'Une ressource sort du jeu hors ligne.');
      assert.deepEqual(errors, []);
      if (source) await page.screenshot({ path: path.join(shots, 'chant-bureau.png') });
      await context.close();
    }
  });

  await test('Le clavier déplace Nilo, relance son saut, chante et fige la simulation en pause', async () => {
    const { page, context, errors } = await open('bureau', null, { song: true });
    await page.locator('#game').focus();
    const start = await page.evaluate(() => window.lumen.player.x);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(450); await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(() => window.lumen.player.x) > start + 60, 'La direction doit réellement déplacer Nilo.');
    await page.keyboard.down('Space'); await page.waitForTimeout(120); await page.keyboard.up('Space');
    await page.waitForTimeout(50); await page.keyboard.down('Space'); await page.waitForTimeout(40);
    const jump = await page.evaluate(() => ({ airJumps: window.lumen.player.airJumps, vy: window.lumen.player.vy }));
    assert.equal(jump.airJumps, 1); assert.ok(jump.vy < 0, 'Le second saut doit encore être ascendant : ' + JSON.stringify(jump));
    await page.keyboard.up('Space'); await page.keyboard.press('KeyX');
    await page.waitForFunction(() => window.lumen.player.actionCooldown > 0);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.song-panel-pause');
    const elapsed = await page.evaluate(() => window.lumen.elapsed);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => window.lumen.elapsed), elapsed);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.lumen.mode), 'playing');
    assert.deepEqual(errors, []); await context.close();
  });

  await test('L’atlas, les réglages persistants, le rythme et le retour au classique fonctionnent', async () => {
    const { page, context, errors } = await open('portrait', null, { song: true });
    await page.getByRole('button', { name: 'L’archipel', exact: true }).click();
    await page.waitForSelector('.song-panel-atlas');
    assert.equal(await page.locator('[data-song-island]:disabled').count(), 2);
    assert.equal(await page.evaluate(() => document.getElementById('song-shell').inert), true);
    await page.screenshot({ path: path.join(shots, 'chant-atlas.png') });
    await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    await page.getByRole('switch', { name: 'Mouvements réduits' }).check();
    await page.getByRole('switch', { name: 'Commandes pour gaucher' }).check();
    await page.locator('#song-volume').fill('61');
    await page.locator('#song-touch-size').fill('130');
    await page.screenshot({ path: path.join(shots, 'chant-reglages.png') });
    await page.getByRole('button', { name: 'Revenir au ciel' }).click();
    await page.reload(); await page.waitForFunction(() => window.lumen?.song);
    const settings = await page.evaluate(() => ({ ...window.lumen.progress.settings, volumeInAudio: window.lumen.audio.volume }));
    assert.equal(settings.volume, .61); assert.equal(settings.volumeInAudio, .61);
    assert.equal(settings.leftHanded, true); assert.equal(settings.touchScale, 1.3); assert.equal(settings.reducedEffects, true);
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    await page.getByRole('button', { name: 'Élan', exact: true }).click();
    await page.getByRole('button', { name: 'Partir en Élan' }).click();
    await page.waitForFunction(() => window.lumen.song?.style === 'flow');
    assert.equal(await page.evaluate(() => window.lumen.runMode), 'timed');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'L’archipel', exact: true }).click();
    await page.getByRole('button', { name: 'Les jardins de la lune', exact: true }).click();
    await page.waitForFunction(() => window.lumen.mode === 'home');
    assert.equal(await page.evaluate(() => window.lumen.song), null);
    await page.waitForTimeout(400);
    await page.locator('[data-command="song-return"]').click();
    await page.waitForFunction(() => window.lumen.session === 'song');
    assert.deepEqual(errors, []); await context.close();
  });

  await test('Les trois îles se terminent via le vrai moteur, puis l’interface ouvre la suite', async () => {
    const { page, context, errors } = await open('bureau', null, { song: true });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'song-pilot.cjs'), 'utf8') });
    const results = [];
    for (let index = 0; index < 3; index++) {
      const result = await page.evaluate(() => {
        const game = window.lumen, pilot = window.LumenSongPilot.create(game);
        game.running = false;
        for (let frame = 0; frame < 120 * 240 && ['playing', 'dead'].includes(game.mode); frame++) {
          pilot.step(); game.update(1 / 120); game.input.clearFrame();
        }
        game.renderer.draw(game, 0); game.emit('frame', .1);
        return pilot.summary();
      });
      results.push(result);
      assert.equal(result.mode, index === 2 ? 'ending' : 'complete', JSON.stringify(result));
      assert.equal(result.echoes, 3); assert.equal(result.stars, 3); assert.equal(result.falls, 0);
      await page.waitForSelector('.song-panel-result');
      await page.screenshot({ path: path.join(shots, 'chant-fin-' + (index + 1) + '.png') });
      if (index < 2) {
        await page.getByRole('button', { name: 'Vers la prochaine île' }).click();
        await page.waitForFunction(next => window.lumen.song.index === next && window.lumen.mode === 'playing', index + 1);
        await page.waitForTimeout(400);
        await page.evaluate(() => { window.lumen.renderer.draw(window.lumen, 0); });
        await page.screenshot({ path: path.join(shots, 'chant-ile-' + (index + 2) + '.png') });
      }
    }
    assert.equal(await page.evaluate(() => window.lumen.progress.codex.creatures.filter(entry => entry.startsWith('chant-')).length), 9);
    await page.getByRole('button', { name: 'Revoir l’archipel' }).click();
    assert.equal(await page.locator('[data-song-island]:disabled').count(), 0);
    await page.reload(); await page.waitForFunction(() => window.lumen?.song);
    assert.equal(await page.evaluate(() => window.LumenSong.ISLANDS.filter(island => window.lumen.store.chapter(island.key)?.completed).length), 3);
    assert.deepEqual(errors, []);
    console.log('      îles jouées sans téléportation : ' + results.map(result => result.island + ' (' + result.seconds + ' s)').join(', '));
    await context.close();
  });

  await test('Le Chant reste cadré et ses commandes ne se chevauchent pas sur cinq formats', async () => {
    for (const view of Object.keys(VIEWS)) {
      const { page, context, errors } = await open(view, null, { song: true });
      await page.waitForTimeout(400);
      const layout = await page.evaluate(() => {
        const game = window.lumen;
        const buttons = [...document.querySelectorAll('#song-shell button, #touch-controls button')].filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden');
        const rectangles = buttons.map(button => ({ name: button.getAttribute('aria-label') || button.textContent.trim(),
          rect: button.getBoundingClientRect().toJSON() }));
        const overlaps = [];
        for (let first = 0; first < rectangles.length; first++) for (let second = first + 1; second < rectangles.length; second++) {
          const left = rectangles[first], right = rectangles[second];
          if (left.rect.x < right.rect.right - 2 && left.rect.right > right.rect.x + 2 && left.rect.y < right.rect.bottom - 2 && left.rect.bottom > right.rect.y + 2) overlaps.push([left.name, right.name]);
        }
        const heroX = (game.player.x - game.camera.x) * game.renderer.scale;
        const heroY = game.player.y * game.renderer.scale + game.renderer.offsetY;
        return { overflow: document.documentElement.scrollWidth > innerWidth, overlaps,
          outside: rectangles.filter(button => button.rect.x < -1 || button.rect.right > innerWidth + 1 || button.rect.y < 0 || button.rect.bottom > innerHeight + 1),
          hero: heroX > 0 && heroX < innerWidth - 24 && heroY > 80 && heroY < innerHeight - 85 };
      });
      assert.equal(layout.overflow, false, view); assert.deepEqual(layout.overlaps, [], view + ' : commandes superposées');
      assert.deepEqual(layout.outside, [], view + ' : commande hors écran'); assert.equal(layout.hero, true, view + ' : personnage mal cadré');
      await page.screenshot({ path: path.join(shots, 'chant-' + view + '.png') });
      if (view === 'portrait' || view === 'compact') {
        await page.getByRole('button', { name: 'Réglages', exact: true }).click();
        await page.locator('#song-touch-size').fill('130');
        await page.getByRole('button', { name: 'Revenir au ciel' }).click();
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-touch]:not([data-touch="down"])')].every(button => {
          const rect = button.getBoundingClientRect(); return rect.x >= 0 && rect.right <= innerWidth;
        })), true);
      }
      assert.deepEqual(errors, []); await context.close();
    }
  });

  await test('Le Chant répond à deux pointeurs et annule les entrées lors d’une interruption', async () => {
    const { page, context, errors } = await open('paysage', null, { song: true });
    const before = await page.evaluate(() => ({ x: window.lumen.player.x, y: window.lumen.player.y }));
    await page.evaluate(() => {
      for (const [action, pointerId] of [['right', 41], ['jump', 42]]) document.querySelector(`[data-touch="${action}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId, pointerType: 'touch' }));
    });
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => ({ x: window.lumen.player.x, y: window.lumen.player.y, run: window.lumen.input.down('run') }));
    assert.ok(after.x > before.x + 80); assert.ok(after.y < before.y - 20); assert.equal(after.run, true);
    await page.evaluate(() => {
      for (const pointerId of [41, 42]) for (const button of document.querySelectorAll('[data-touch]')) button.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId }));
    });
    assert.equal(await page.evaluate(() => window.lumen.input.keys.size), 0);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.evaluate(() => window.lumen.mode), 'paused');
    assert.equal(await page.locator('#touch-controls .held').count(), 0);
    assert.deepEqual(errors, []); await context.close();
  });

  await test('L’édition portable démarre seule en file://, sans aucune requête externe', async () => {
    const { page, context, errors } = await open();
    const requests = [];
    page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
    await page.reload();
    await page.waitForFunction(() => window.lumen && window.lumen.mode === 'home');
    assert.deepEqual(requests, [], 'L’édition portable a tenté de sortir sur le réseau.');
    const state = await page.evaluate(() => ({
      chapitres: window.LUMEN_LEVELS.filter(l => !l.hub).length,
      modules: window.LumenModules.MODULES.length,
      schema: window.LumenSave.SCHEMA
    }));
    assert.ok(state.chapitres >= 11, 'Chapitres manquants : ' + state.chapitres);
    assert.ok(state.modules >= 8);
    assert.equal(state.schema, 3);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(shots, 'accueil.png') });
    await context.close();
  });

  await test('La Résonance se joue au clavier : appeler ouvre un chemin qui n’existait pas', async () => {
    const { page, context, errors } = await open();
    await page.evaluate(() => {
      const g = window.lumen, index = window.LUMEN_LEVELS.findIndex(l => l.key === 'verger-qui-reve');
      g.store.unlock('verger-qui-reve'); g.start(index);
    });
    await page.waitForFunction(() => window.lumen.mode === 'playing' && window.lumen.level.key === 'verger-qui-reve');
    // Avant l'appel : le tremplin n'existe pas.
    const before = await page.evaluate(() => {
      const g = window.lumen;
      g.player.x = 530; g.player.y = 554; g.player.vy = 0; g.player.actionCooldown = 0;
      return g.platforms.filter(p => p.wakeId === 'verger-bouton-1' && p.active).length;
    });
    assert.equal(before, 0, 'Le tremplin ne doit pas exister avant l’appel.');
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const g = window.lumen;
      const bud = g.wakeables.find(w => w.id === 'verger-bouton-1');
      return { etat: bud.state, solides: g.platforms.filter(p => p.wakeId === 'verger-bouton-1' && p.active).length, ondes: g.waves.length };
    });
    assert.equal(after.etat, 'awake', 'La touche X doit réveiller le bouton.');
    assert.equal(after.solides, 1, 'Le tremplin doit devenir solide.');
    await page.screenshot({ path: path.join(shots, 'resonance-verger.png') });
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('L’observatoire : la porte reste fermée tant que la coupole se tait', async () => {
    const { page, context, errors } = await open();
    await page.click('[data-command="hub"]');
    await page.waitForFunction(() => window.lumen.mode === 'playing' && window.lumen.level.hub, null, { timeout: 25000 });
    assert.equal(await page.evaluate(() => window.lumen.exit.open), false, 'La porte des rêves doit être fermée au départ.');
    // Deux carillons sur trois ne suffisent pas : la quête n'est pas un compteur flou.
    await page.evaluate(() => {
      const g = window.lumen;
      for (const id of ['coupole-carillon-1', 'coupole-carillon-2']) {
        const chime = g.wakeables.find(w => w.id === id);
        g.player.x = chime.x - 16; g.player.y = chime.y - 40; g.player.vy = 0; g.player.actionCooldown = 0;
        g.usePower();
        for (let i = 0; i < 60; i++) g.update(1 / 120);
      }
    });
    await page.waitForTimeout(300);
    // Le monde répond aux gestes, pas à la lecture du texte : la quête peut
    // donc s'accomplir sans avoir croisé Vesper. Ce qui doit être vrai ici,
    // c'est seulement qu'elle n'est PAS finie.
    assert.notEqual(await page.evaluate(() => window.lumen.store.questState('premier-souffle')), 'done');
    assert.equal(await page.evaluate(() => window.lumen.exit.open), false, 'Deux carillons sur trois ne doivent pas ouvrir la porte.');
    await page.evaluate(() => {
      const g = window.lumen, chime = g.wakeables.find(w => w.id === 'coupole-carillon-3');
      g.player.x = chime.x - 16; g.player.y = chime.y - 40; g.player.vy = 0; g.player.actionCooldown = 0;
      g.usePower();
      for (let i = 0; i < 60; i++) g.update(1 / 120);
    });
    await page.waitForTimeout(400);
    const done = await page.evaluate(() => ({
      quete: window.lumen.store.questState('premier-souffle'),
      porte: window.lumen.exit.open,
      transformation: window.lumen.progress.hub.transformations.includes('coupole-allumee'),
      banniere: document.getElementById('quest-banner').classList.contains('done')
    }));
    assert.equal(done.quete, 'done');
    assert.equal(done.porte, true, 'Les trois carillons doivent ouvrir la porte.');
    assert.equal(done.transformation, true, 'La coupole doit rester allumée.');
    assert.equal(done.banniere, true, 'Le bandeau de quête doit le montrer.');
    await page.screenshot({ path: path.join(shots, 'observatoire-allume.png') });
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Le menu ne contourne pas la porte des rêves : une seule règle décide', async () => {
    const { page, context, errors } = await open();
    // Profil neuf : la coupole se tait encore.
    assert.notEqual(await page.evaluate(() => window.lumen.store.questState('premier-souffle')), 'done');
    await page.click('[data-command="dream"]');
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({
      ecran: document.getElementById('dream-screen').classList.contains('active'),
      session: window.lumen.session,
      hub: !!(window.lumen.level && window.lumen.level.hub),
      autorise: window.lumen.canEnterDreams().allowed
    }));
    assert.equal(after.autorise, false, 'La règle d’accès laisse passer un profil neuf.');
    assert.equal(after.ecran, false, 'Le menu a ouvert les Rêves malgré la porte verrouillée.');
    assert.equal(after.hub, true, 'Le menu n’a pas conduit le joueur là où la règle se satisfait.');
    assert.equal(after.session, 'hub');
    assert.deepEqual(errors, []);
    await context.close();
  });

  /** Le profil d'un joueur qui a déjà rendu son souffle à la coupole. */
  const RETURNING = {
    schema: 3, unlocked: ['prairies-aurore'], chapters: {},
    hub: { quests: { 'premier-souffle': 'done' }, transformations: ['coupole-allumee'] },
    expeditions: { runs: 0, completed: 0, bestRooms: 0 }
  };

  await test('Une nuit entière se joue par l’interface, et la graine la rejoue à l’identique', async () => {
    const { page, context, errors } = await open('bureau', RETURNING);
    await page.click('[data-command="dream"]');
    await page.waitForSelector('#dream-screen.active', { timeout: 20000 });
    await page.fill('#seed-input', 'verger-lune-lune-0');
    await page.click('[data-command="dream-start"]');
    await page.waitForFunction(() => window.lumen.run && window.lumen.mode === 'playing', null, { timeout: 30000 });
    const premier = await page.evaluate(() => ({
      code: window.lumen.run.code,
      salles: window.lumen.run.plan.rooms.map(r => r.kind),
      geometrie: JSON.stringify(window.lumen.run.plan.rooms.map(r => r.level.platforms))
    }));
    assert.equal(premier.code, 'verger-lune-lune-0', 'La graine saisie doit être celle qui est jouée.');
    assert.equal(premier.salles.length, 5);
    assert.equal(premier.salles[4], 'guardian', 'Une nuit finit toujours par un gardien.');
    assert.equal(premier.salles[2], 'refuge');

    // On traverse les cinq salles par l'interface, en choisissant à chaque carte.
    let refugeSauvegarde = null;
    for (let salle = 0; salle < 4; salle++) {
      await page.evaluate(() => { const g = window.lumen; g.player.x = g.exit.x + 5; g.player.y = g.exit.y + 40; });
      await page.waitForSelector('#route-screen.active', { timeout: 25000 });
      const branches = await page.locator('.route-branch').count();
      assert.ok(branches >= 1, 'La carte doit proposer au moins un chemin.');
      const libelles = await page.locator('.route-branch strong').allTextContents();
      assert.ok(libelles.every(t => t.trim().length > 3), 'Chaque chemin doit être annoncé : ' + JSON.stringify(libelles));
      if (branches > 1) await page.locator('.route-branch').nth(1).click();
      if (await page.locator('.offer-item').count()) await page.locator('.offer-item').first().click();
      if (salle === 0) await page.screenshot({ path: path.join(shots, 'reves-carte.png') });
      await page.click('[data-command="route-go"]');
      await page.waitForFunction(i => window.lumen.run && window.lumen.run.roomIndex === i && window.lumen.mode === 'playing', salle + 1, { timeout: 30000 });
      const etat = await page.evaluate(() => ({
        index: window.lumen.run.roomIndex,
        souvenirs: [...window.lumen.run.upgrades],
        sauvegarde: window.lumen.progress.expedition ? window.lumen.progress.expedition.roomIndex : null
      }));
      assert.ok(etat.souvenirs.length <= 2, 'Jamais plus de deux souvenirs portés : ' + etat.souvenirs.join(','));
      if (etat.index === 2) { refugeSauvegarde = etat.sauvegarde; await page.screenshot({ path: path.join(shots, 'reves-refuge.png') }); }
    }
    assert.equal(refugeSauvegarde, 2, 'Le refuge doit enregistrer la nuit.');
    assert.equal(await page.evaluate(() => window.lumen.run.plan.rooms[4].kind), 'guardian');
    assert.ok(await page.evaluate(() => !!window.lumen.boss), 'La salle du gardien doit contenir un gardien.');

    // La même graine, rejouée, redonne exactement la même nuit.
    const rejeu = await page.evaluate(() => JSON.stringify(
      window.LumenExpedition.plan('verger-lune-lune-0').rooms.map(r => r.level.platforms)));
    assert.equal(rejeu, premier.geometrie, 'La graine doit rejouer la même nuit.');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Quitter une nuit pour la campagne, par les menus, ne contamine rien', async () => {
    // Bout en bout, sans téléportation autre que celle déjà utilisée pour
    // atteindre une sortie : aucune invulnérabilité, aucun ennemi supprimé,
    // aucune sortie forcée, aucun appel direct à complete().
    const profile = JSON.parse(JSON.stringify(RETURNING));
    const { page, context, errors } = await open('bureau', profile);
    await page.click('[data-command="dream"]');
    await page.waitForSelector('#dream-screen.active', { timeout: 20000 });
    await page.fill('#seed-input', 'brume-onde-verger-3');
    await page.click('[data-command="dream-start"]');
    await page.waitForFunction(() => window.lumen.run && window.lumen.mode === 'playing', null, { timeout: 30000 });
    // Le joueur ramasse un souvenir en chemin, puis change d'avis et rentre.
    await page.evaluate(() => { window.lumen.run.upgrades = ['corolle']; });
    await page.click('#game', { position: { x: 20, y: 20 } });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#pause-screen.active', { timeout: 15000 });
    await page.click('#pause-screen [data-command="map"]');
    await page.waitForFunction(() => window.lumen.mode === 'map', null, { timeout: 20000 });
    const quitte = await page.evaluate(() => ({ session: window.lumen.session, run: !!window.lumen.run }));
    assert.equal(quitte.run, false, 'Une nuit reste ouverte après un retour à l’atlas.');
    assert.notEqual(quitte.session, 'expedition');

    // Puis il joue un chapitre, jusqu'à la sortie. (Le petit délai laisse se
    // terminer le fondu : un clic pendant la transition est ignoré — c'est
    // consigné au backlog, ce n'est pas ce que ce test mesure.)
    await page.waitForTimeout(800);
    await page.click('[data-level="0"]');
    await page.waitForFunction(() => window.lumen.mode === 'playing' && window.lumen.levelIndex === 0, null, { timeout: 25000 });
    const enCampagne = await page.evaluate(() => ({
      session: window.lumen.session,
      corolle: window.lumen.hasUpgrade('corolle'),
      chapitre: document.getElementById('intro-number').textContent
    }));
    assert.equal(enCampagne.session, 'campaign');
    assert.equal(enCampagne.corolle, false, 'Un souvenir de rêve agit encore dans un chapitre.');
    assert.ok(!/00/.test(enCampagne.chapitre), 'Le bandeau annonce un « chapitre 00 » : ' + enCampagne.chapitre);

    // On rejoint la sortie du chapitre, ouverte par le jeu lui-même.
    await page.evaluate(async () => {
      const g = window.lumen;
      for (const star of g.collectibles.filter(c => c.type === 'star')) star.taken = true;
      g.player.x = g.exit.x + 5; g.player.y = g.exit.y + 40;
    });
    await page.waitForFunction(() => ['complete', 'ending'].includes(window.lumen.mode), null, { timeout: 25000 });
    const fin = await page.evaluate(() => ({
      mode: window.lumen.mode,
      route: document.getElementById('route-screen').classList.contains('active'),
      session: window.lumen.session
    }));
    assert.equal(fin.route, false, 'Un chapitre a ouvert l’écran de route d’une expédition.');
    assert.equal(fin.session, 'campaign');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Le tactile tient plusieurs doigts, ne colle jamais, et respecte 48 px', async () => {
    const { page, context, errors } = await open('paysage');
    await page.evaluate(() => window.lumen.start(0));
    await page.waitForFunction(() => window.lumen.mode === 'playing');
    await page.waitForTimeout(300);
    const cibles = await page.evaluate(() => [...document.querySelectorAll('#touch-controls button')]
      .map(b => ({ role: b.dataset.touch, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })));
    assert.ok(cibles.length >= 4, 'Les commandes tactiles doivent exister.');
    for (const cible of cibles) {
      assert.ok(cible.w >= 48 && cible.h >= 48, 'Cible trop petite : ' + cible.role + ' ' + cible.w + '×' + cible.h);
    }
    // Le chemin principal tient en une direction et deux boutons.
    const principaux = cibles.map(c => c.role);
    assert.ok(principaux.includes('left') && principaux.includes('right'), 'Direction absente.');
    assert.ok(principaux.includes('jump') && principaux.includes('action'), 'Saut ou action absent.');
    assert.ok(!principaux.includes('run'), 'La course ne doit plus occuper un bouton : elle vient du maintien.');

    const centre = async role => { const r = await page.locator(`[data-touch=${role}]`).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const presser = async (role, id) => {
      const [x, y] = await centre(role);
      await page.evaluate(([px, py, pid]) => document.elementFromPoint(px, py)
        .dispatchEvent(new PointerEvent('pointerdown', { pointerId: pid, bubbles: true, clientX: px, clientY: py })), [x, y, id]);
    };
    await presser('right', 1); await presser('jump', 2);
    // La course vient du MAINTIEN : on laisse passer le délai avant de mesurer.
    await page.waitForTimeout(600);
    const tenus = await page.evaluate(() => ({
      droite: window.lumen.input.down('right'), saut: window.lumen.input.down('jump'),
      course: window.lumen.input.down('run')
    }));
    assert.equal(tenus.droite, true, 'Deux doigts simultanés doivent tous être vus.');
    assert.equal(tenus.saut, true);
    assert.equal(tenus.course, true, 'Maintenir une direction doit déclencher la course seule.');
    // Le troisième doigt, mesuré tout de suite : une onde ne vit qu'une demi-seconde.
    await presser('action', 3);
    await page.waitForTimeout(120);
    const appel = await page.evaluate(() => ({ ondes: window.lumen.waves.length, recharge: window.lumen.player.actionCooldown }));
    assert.ok(appel.ondes >= 1, 'Le bouton action doit émettre une Résonance.');
    assert.ok(appel.recharge > 0, 'L’appel doit engager sa recharge.');
    await page.screenshot({ path: path.join(shots, 'tactile-paysage.png') });

    // Une annulation système ne doit jamais laisser un doigt appuyé.
    await page.evaluate(() => {
      for (const id of [1, 2, 3]) document.querySelectorAll('[data-touch]')
        .forEach(el => el.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, bubbles: true })));
    });
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => ({
      droite: window.lumen.input.down('right'), saut: window.lumen.input.down('jump'),
      course: window.lumen.input.down('run'), colles: document.querySelectorAll('[data-touch].held').length
    }));
    assert.deepEqual(apres, { droite: false, saut: false, course: false, colles: 0 }, 'Un doigt est resté collé.');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Les réglages de confort changent réellement le jeu, et survivent au rechargement', async () => {
    const { page, context, errors } = await open('portrait');
    await page.evaluate(() => window.lumen.start(0));
    await page.waitForFunction(() => window.lumen.mode === 'playing');
    const avant = await page.evaluate(() => document.querySelector('[data-touch=jump]').getBoundingClientRect().width);
    await page.evaluate(() => {
      ['leftHanded', 'reducedEffects'].forEach(k => window.lumen.store.setSetting(k, true));
      window.lumen.store.setSetting('touchScale', 1.3);
      document.querySelector('[data-setting=touchScale][data-value="1.3"]').click();
      document.querySelector('[data-setting=leftHanded][data-value="true"]').click();
      document.querySelector('[data-setting=reducedEffects][data-value="true"]').click();
    });
    await page.waitForTimeout(300);
    const apres = await page.evaluate(() => ({
      taille: document.querySelector('[data-touch=jump]').getBoundingClientRect().width,
      gaucher: document.body.classList.contains('left-handed'),
      attenue: document.body.classList.contains('reduced-effects'),
      // Un voile lumineux ne doit plus apparaître du tout.
      flash: (() => { window.lumen.screenFlash('#ffffff', .5); return window.lumen.flash; })(),
      secousse: (() => { window.lumen.camera.shake = 0; window.lumen.shake(10); return window.lumen.camera.shake; })()
    }));
    assert.ok(apres.taille > avant, 'La taille des commandes doit changer : ' + avant + ' → ' + apres.taille);
    assert.equal(apres.gaucher, true);
    assert.equal(apres.attenue, true);
    assert.equal(apres.flash, null, 'Aucun voile lumineux en mode atténué.');
    assert.ok(apres.secousse > 0 && apres.secousse <= 2.001, 'La secousse doit être réduite, pas supprimée : ' + apres.secousse);
    await page.screenshot({ path: path.join(shots, 'reglages-portrait.png') });

    // Le rechargement conserve les réglages.
    await page.reload();
    await page.waitForFunction(() => window.lumen && window.lumen.mode === 'home');
    const conserves = await page.evaluate(() => ({ ...window.lumen.progress.settings }));
    assert.equal(conserves.leftHanded, true);
    assert.equal(conserves.reducedEffects, true);
    assert.equal(conserves.touchScale, 1.3);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Une sauvegarde ancienne est migrée sans être écrasée, et la progression suit', async () => {
    const { page, context, errors } = await open();
    const migre = await page.evaluate(() => {
      // On dépose une sauvegarde v2 authentique, indexée par position.
      localStorage.clear();
      localStorage.setItem('lumen.gardens.v2', JSON.stringify({
        version: 2, unlocked: 3, bonusUnlocked: true, muted: false,
        records: { 0: { completed: true, stars: 3, coins: 44, medal: 'gold', bestTimedTime: 61.2 } }
      }));
      const store = new window.LumenSave.SaveStore(localStorage);
      return {
        migreDepuis: store.migratedFrom,
        ancienneIntacte: !!localStorage.getItem('lumen.gardens.v2'),
        chapitre: store.chapter('prairies-aurore'),
        ouvert: store.isUnlocked('archipels-zephyr'),
        ferme: store.isUnlocked('forge-petales')
      };
    });
    assert.equal(migre.migreDepuis, 'lumen.gardens.v2');
    assert.equal(migre.ancienneIntacte, true, 'La sauvegarde d’origine ne doit jamais être effacée.');
    assert.equal(migre.chapitre.medal, 'gold', 'Le record doit suivre le chapitre, pas son indice.');
    assert.equal(migre.chapitre.bestTimedTime, 61.2);
    assert.equal(migre.ouvert, true);
    assert.equal(migre.ferme, false, 'La migration ne doit rien ouvrir de plus.');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Aucun défilement horizontal, et une cadence stable, aux trois formats', async () => {
    const mesures = {};
    for (const view of Object.keys(VIEWS)) {
      const { page, context, errors } = await open(view);
      await page.evaluate(() => { window.lumen.start(0); window.lumen.frameWindow.length = 0; });
      await page.waitForTimeout(2600);
      const debordement = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert.equal(debordement, false, 'Défilement horizontal en ' + view);
      mesures[view] = await page.evaluate(() => ({ fps: window.lumen.fps, particules: window.lumen.particles.length }));
      // Les réservoirs restent bornés : rien ne s'accumule pendant une session.
      assert.ok(mesures[view].particules <= 500, 'Particules non bornées en ' + view + ' : ' + mesures[view].particules);
      assert.deepEqual(errors, [], 'Erreurs en ' + view);
      await context.close();
    }
    // La cadence est RELEVÉE, pas exigée : ce contrôle tourne dans un Chromium
    // sans accélération matérielle, souvent en conteneur partagé. Le chiffre
    // qu'il affiche ne dit rien de la cadence sur un vrai appareil ; il n'est
    // là que pour repérer un effondrement soudain entre deux exécutions.
    console.log('      cadence relevée (logiciel, indicative) : '
      + Object.entries(mesures).map(([k, v]) => k + ' ' + v.fps + ' i/s').join(' · '));
    fs.writeFileSync(path.join(root, 'work', 'browser-results.json'),
      JSON.stringify({ mesures, note: 'Cadence relevée dans un Chromium sans accélération matérielle, en conteneur : indicative seulement.' }, null, 2));
  });

  await browser.close();
  console.log('\n' + (checks.length - failed) + '/' + checks.length + ' contrôles navigateur réussis.');
  fs.writeFileSync(path.join(root, 'tests', 'browser-test-results.json'),
    JSON.stringify({ passed: checks.length - failed, failed, checks }, null, 2));
  process.exitCode = failed ? 1 : 0;
})();
