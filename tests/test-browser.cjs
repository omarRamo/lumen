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
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const chromium = require('playwright')[process.env.LUMEN_BROWSER || 'chromium'];
const browserTools = require('../tools/browser.cjs');
const capture = require('../tools/capture.cjs');

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
const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
let failed = 0;
async function test(name, run) {
  if(filter && !filter.test(name))return;
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
    const context = await browser.newContext({ viewport: { width, height }, hasTouch, isMobile, deviceScaleFactor: 1, locale: options.locale || 'fr-FR', colorScheme: options.colorScheme || 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    if (options.languages) await page.addInitScript(languages => {
      Object.defineProperty(navigator, 'languages', { get: () => languages });
    }, options.languages);
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

  // Le joueur choisit une lumière puis son action ; le mobile change de
  // constellation explicitement. Aucun accès n'est accordé par ce helper.
  async function enterPlace(page, key) {
    const node = page.locator('[data-place="' + key + '"]');
    if (!await node.isVisible()) {
      const act = await node.evaluate(element => element.closest('[data-act]').dataset.act);
      await page.locator('[data-journey-act="' + act + '"]').click();
    }
    await node.click();
    await page.locator('[data-journey-launch="' + key + '"]').click();
  }

  await test('Le démarrage natif attend le miroir, masque le plein écran et écoute le cycle de vie', async () => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!/^(file|data):/.test(request.url())) external.push(request.url()); });
    await page.addInitScript(() => {
      window.Capacitor = { isNativePlatform: () => true, Plugins: {
        App: { addListener: async (_, listener) => { window.nativeState = listener; } },
        StatusBar: { hide: async () => {} },
        Filesystem: {
          readFile: () => new Promise(resolve => setTimeout(() => resolve({ data: JSON.stringify({
            'lumen.gardens.v3': JSON.stringify({ schema: 3, settings: { volume: .17, muted: true }, finished: true })
          }) }), 100)),
          writeFile: async () => {}, rename: async () => {}
        }
      } };
    });
    await page.goto(PAGE);
    await page.waitForFunction(() => window.lumen?.frames >= 2);
    assert.equal(await page.evaluate(() => window.lumen.progress.finished), true);
    assert.equal(await page.evaluate(() => window.lumen.progress.settings.volume), .17);
    assert.equal(await page.locator('#song-fullscreen').isVisible(), false);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehavior), 'none');
    await page.evaluate(() => window.nativeState({ isActive: false }));
    assert.equal(await page.evaluate(() => window.lumen.mode), 'paused');
    await page.evaluate(() => window.nativeState({ isActive: true }));
    assert.equal(await page.evaluate(() => window.lumen.mode), 'paused');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await context.close();
  });

  await test('La palette claire reste stable avec les anciens réglages et le système sombre', async () => {
    for(const source of [false,true]){
      const {page,context,errors}=await open('bureau',null,{song:true,source,colorScheme:'dark'});
      await page.waitForFunction(()=>window.lumen.frames>=2);
      assert.equal(await page.evaluate(()=>window.LumenAppearance.current),'light');
      assert.equal(await page.evaluate(()=>window.lumen.progress.settings.appearance),'light');
      await page.locator('#song-shell .song-icon[data-command="song-settings"]').click();
      assert.equal(await page.locator('#song-panel [data-appearance]').count(),0);
      const before=await page.evaluate(()=>JSON.stringify([window.lumen.player,window.lumen.song,window.lumen.elapsed]));
      await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});
      assert.equal(await page.evaluate(()=>window.LumenAppearance.current),'light');
      assert.equal(await page.evaluate(()=>JSON.stringify([window.lumen.player,window.lumen.song,window.lumen.elapsed])),before);
      await page.evaluate(()=>{const key='lumen.gardens.v3';const save=JSON.parse(localStorage.getItem(key)||'{}');save.settings={...save.settings,appearance:'dark'};localStorage.setItem(key,JSON.stringify(save));});
      await page.reload();await page.waitForFunction(()=>window.lumen?.song);
      assert.equal(await page.evaluate(()=>window.LumenAppearance.current),'light');
      assert.equal(await page.evaluate(()=>window.lumen.progress.settings.appearance),'light');
      assert.deepEqual(errors,[]);await context.close();
    }
  });

  await test('La palette reste lisible sous les deux apparences système, sur mobile et bureau', async () => {
    for(const view of ['bureau','portrait','paysage','compact','large']){
      const {page,context,errors}=await open(view,null,{song:true});
      await page.waitForFunction(()=>window.lumen.frames>=2);
      const readings={};
      for(const appearance of ['light','dark']){
        await page.locator('#song-shell .song-icon[data-command="song-settings"]').click();
        await page.emulateMedia({colorScheme:appearance});
        assert.equal(await page.evaluate(()=>LumenAppearance.current),'light');
        const contrast=await page.evaluate(()=>{
          const panel=getComputedStyle(document.getElementById('song-panel'));
          const luminance=color=>{
            const rgb=color.match(/[\d.]+/g).slice(0,3).map(value=>{const normalized=Number(value)/255;return normalized<=.04045?normalized/12.92:Math.pow((normalized+.055)/1.055,2.4);});
            return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
          };
          const ink=luminance(panel.color),surface=luminance(panel.backgroundColor);
          return (Math.max(ink,surface)+.05)/(Math.min(ink,surface)+.05);
        });
        assert.ok(contrast>=4.5,view+' '+appearance+' contrast '+contrast);
        assert.equal(await page.locator('#song-panel').evaluate(panel=>panel.scrollWidth<=panel.clientWidth+1),true);
        if(view==='bureau'||view==='portrait')await page.screenshot({path:path.join(shots,'appearance-'+appearance+'-'+view+'-settings.png')});
        await page.locator('#song-panel [data-command="song-close"]').first().click();
        readings[appearance]=await page.evaluate(()=>{
          const game=window.lumen;game.renderer.draw(game,0);
          const canvas=game.canvas,pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          let brightness=0,count=0;const colors=new Set();
          for(let index=0;index<pixels.length;index+=1612){brightness+=pixels[index]*.2126+pixels[index+1]*.7152+pixels[index+2]*.0722;count++;colors.add([pixels[index]>>3,pixels[index+1]>>3,pixels[index+2]>>3].join(':'));}
          const controls=[...document.querySelectorAll('#song-shell button,#touch-controls button')].filter(button=>button.getClientRects().length);
          const outside=controls.filter(button=>{const rect=button.getBoundingClientRect();return rect.left<0||rect.right>innerWidth+1||rect.bottom>innerHeight+1;});
          return {brightness:brightness/count,colors:colors.size,outside:outside.map(button=>button.getAttribute('aria-label')),key:game.renderer.songKey};
        });
        assert.deepEqual(readings[appearance].outside,[]);
        assert.ok(readings[appearance].colors>45,'Canvas is too uniform: '+view+' '+appearance+' '+JSON.stringify(readings[appearance]));
        await page.screenshot({path:path.join(shots,'appearance-'+appearance+'-'+view+'.png')});
      }
      assert.equal(readings.dark.key,readings.light.key,view+' must keep its authored palette');
      assert.deepEqual(errors,[]);await context.close();
    }
    const {page,context,errors}=await open('portrait',null,{song:true,locale:'ar-SA',colorScheme:'dark'});
    await page.locator('#song-shell .song-icon[data-command="song-settings"]').click();
    assert.equal(await page.locator('#song-panel [data-appearance]').count(),0);
    assert.equal(await page.evaluate(()=>LumenAppearance.current),'light');
    await page.screenshot({path:path.join(shots,'appearance-dark-arabic-settings.png')});
    assert.deepEqual(errors,[]);await context.close();
  });

  await test('Les huit plateformes ont des pixels contrastés et des formes distinctes en jour et en nuit', async () => {
    const { page, context, errors } = await open('bureau', null, { song: true, source: true });
    const gallery = path.join(root, 'docs', 'platforms');
    fs.mkdirSync(gallery, { recursive: true });
    const measurements = [];
    const scenes = await page.evaluate(() => [
      ...['meadow', 'cavern', 'tide', 'sky', 'forge', 'frost', 'secret', 'eclipse'].map(theme => ({theme, id:theme})),
      ...window.LUMEN_LEVELS.filter(level => level.place).map(level => ({theme:level.theme, id:level.key, placeKey:level.key}))
    ]);
    for (const appearance of ['light', 'dark']) for (const scene of scenes) {
      const result = await page.evaluate(({ appearance, theme, placeKey }) => {
        document.getElementById('platform-gallery')?.remove();
        const canvas = document.createElement('canvas'); canvas.id = 'platform-gallery';
        canvas.style.cssText = 'position:fixed;inset:0;z-index:100;width:1440px;height:380px';
        document.body.append(canvas);
        const renderer = new window.LumenRenderer(canvas); renderer.resize(1440, 380);
        const ctx = renderer.ctx, Art = window.LumenArt, palette = Art.campaignPalette(theme, appearance);
        const types = Object.keys(Art.PLATFORM_MARKS), rows = [], shapes = [];
        if (placeKey) {
          window.lumen.loadLevel(window.lumen.indexOfKey(placeKey), false);
          if (window.LumenPlaceArt.background(renderer, window.lumen, palette, 2) !== true) {
            throw new Error(placeKey + ': missing authored place background');
          }
        } else Art.horizon(renderer, palette, 2, 0, 1440, 380);
        const luminance = (red, green, blue) => {
          const channels = [red, green, blue].map(value => value / 255)
            .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const appearanceState = JSON.stringify(window.lumen.progress.settings);
        for (const [index, type] of types.entries()) {
          const platform = { x: 16 + index * 178, y: 190, w: 160, h: type === 'ground' ? 300 : 22,
            type, baseX: 0, active: true, direction: 1 };
          const before = ctx.getImageData(platform.x + 8, platform.y - 3, 144, 10).data;
          renderer.platform(ctx, platform, 2, palette);
          const after = ctx.getImageData(platform.x + 8, platform.y - 3, 144, 10).data;
          let contrasted = 0;
          for (let offset = 0; offset < before.length; offset += 4) {
            const backdrop = luminance(before[offset], before[offset + 1], before[offset + 2]);
            const surface = luminance(after[offset], after[offset + 1], after[offset + 2]);
            if ((Math.max(backdrop, surface) + .05) / (Math.min(backdrop, surface) + .05) >= 3) contrasted++;
          }
          const maskCanvas = document.createElement('canvas'); maskCanvas.width = 180; maskCanvas.height = 180;
          const mask = maskCanvas.getContext('2d'), saved = renderer.ctx;
          renderer.ctx = mask;
          renderer.platform(mask, { ...platform, x: 10, y: 30 }, 2, palette);
          renderer.ctx = saved;
          const pixels = mask.getImageData(0, 0, 180, 180).data;
          let fingerprint = 2166136261;
          for (let offset = 0; offset < pixels.length; offset += 4) {
            const grey = Math.round(luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2]) * 255);
            fingerprint = Math.imul(fingerprint ^ grey ^ pixels[offset + 3], 16777619);
          }
          shapes.push(fingerprint);
          rows.push({ type, contrasted, fingerprint });
          ctx.font = '500 14px Outfit'; ctx.fillStyle = palette.night ? palette.rim : palette.shade;
          ctx.fillText(type, platform.x + 8, 125);
        }
        return { theme, placeKey: placeKey || null, appearance, rows, distinct: new Set(shapes).size,
          untouched: appearanceState === JSON.stringify(window.lumen.progress.settings) };
      }, { appearance, ...scene });
      assert.ok(result.untouched);
      for (const row of result.rows) assert.ok(row.contrasted >= 144,
        `${appearance}/${scene.id}/${row.type}: ${row.contrasted} reception pixels at 3:1`);
      assert.equal(result.distinct, 8, appearance + '/' + scene.id + ': identical platform shapes');
      await capture.shot(page.locator('#platform-gallery'), path.join(gallery, appearance + '-' + scene.id + capture.EXTENSION), {});
      measurements.push(result);
    }
    fs.writeFileSync(path.join(gallery, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
    assert.deepEqual(errors, []); await context.close();
  });

  await test('Le vrai rendu Web Audio produit trois thèmes distincts, sans saturation et avec silence intégral', async () => {
    const {page,context,errors}=await open('bureau',null,{song:true});
    const renders=await page.evaluate(async()=>{
      const results=[];
      for(const config of [{island:0},{island:1},{island:2},{island:0,night:true},{island:0,muted:true},{island:0,zero:true}]){
        const audio=new window.LumenAudio(),offline=new OfflineAudioContext(2,44100*6,44100);
        audio.setScene(config.island);audio.setNight(config.night);audio.setMuted(config.muted);
        audio.setMix({musicVolume:config.zero?0:.8,effectsVolume:config.zero?0:.9,ambienceVolume:config.zero?0:.6});
        audio._init(offline);audio.unlocked=true;audio.setSongLayer(.7);audio._updateBeds();
        const score=window.LumenAudio.SONG_SCORES[config.island];
        for(let step=0;step<12;step++)audio._playSongStep(step,.05+step*.3,.3,score);
        audio.sfx('resonance');audio.rescue(2,.65,1);
        const rendered=await offline.startRendering(),left=rendered.getChannelData(0),right=rendered.getChannelData(1);
        let peak=0,energy=0,stereo=0,signature=0,finite=true;
        for(let index=0;index<left.length;index++){
          peak=Math.max(peak,Math.abs(left[index]),Math.abs(right[index]));energy+=(left[index]**2+right[index]**2)/2;
          stereo+=(left[index]-right[index])**2;finite=finite&&Number.isFinite(left[index])&&Number.isFinite(right[index]);
          if(index%97===0)signature+=Math.round(left[index]*1e7);
        }
        results.push({...config,peak,rms:Math.sqrt(energy/left.length),stereo:Math.sqrt(stereo/left.length),signature,finite,voices:audio._voices.size,beds:audio._beds.length});
        audio.destroy();
      }
      return results;
    });
    for(const result of renders){
      assert.equal(result.finite,true);assert.ok(result.peak<.95,'Clipping risk: '+JSON.stringify(result));
      if(result.muted||result.zero)assert.equal(result.peak,0,'Silence must include reverb and ambience.');
      else {assert.ok(result.rms>.002,'Silent composition: '+JSON.stringify(result));assert.ok(result.stereo>.0001);}
      assert.equal(result.voices,0,'Finished sounds should release their nodes.');assert.equal(result.beds,3);
    }
    assert.equal(new Set(renders.slice(0,4).map(result=>result.signature)).size,4);
    console.log('      audio mesuré : '+renders.slice(0,4).map(result=>'île '+(result.island+1)+(result.night?' nuit':'')+' RMS '+result.rms.toFixed(4)+' crête '+result.peak.toFixed(3)).join(' · '));
    assert.deepEqual(errors,[]);await context.close();
  });

  await test('Le mixage est mémorisé, la démonstration se joue en pause et les sons se nettoient', async () => {
    const {page,context,errors}=await open('portrait',null,{song:true});
    assert.equal(await page.evaluate(()=>window.lumen.audio.ctx),null,'No audio context before a gesture.');
    await page.locator('#song-shell .song-icon[data-command="song-settings"]').click();
    await page.locator('#song-musicVolume').fill('25');await page.locator('#song-effectsVolume').fill('70');await page.locator('#song-ambienceVolume').fill('40');
    await page.locator('#song-panel [data-command="sound-preview"]').click();
    await page.waitForFunction(()=>window.lumen.audio.unlocked&&[...window.lumen.audio._voices].some(voice=>voice.bus==='preview'));
    assert.equal(await page.evaluate(()=>window.lumen.mode),'paused');
    const audible=await page.evaluate(async()=>{
      const audio=window.lumen.audio,analyser=audio.ctx.createAnalyser();analyser.fftSize=2048;audio.master.connect(analyser);
      await new Promise(resolve=>setTimeout(resolve,300));
      const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);analyser.disconnect();
      return [...samples].some(value=>Math.abs(value)>.0001);
    });
    assert.equal(audible,true,'The preview should produce actual samples.');
    await page.reload();await page.waitForFunction(()=>window.lumen?.song);
    assert.deepEqual(await page.evaluate(()=>window.lumen.audio.mix),{music:.25,effects:.7,ambience:.4});
    await page.locator('#game').focus();await page.keyboard.press('KeyX');await page.waitForFunction(()=>window.lumen.audio.unlocked);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>window.lumen.mode==='paused');
    await page.waitForTimeout(450);
    const paused=await page.evaluate(()=>({music:window.lumen.audio.music.gain.value,effects:window.lumen.audio.effects.gain.value,ambience:window.lumen.audio.ambience.gain.value}));
    assert.ok(Object.values(paused).every(value=>value<.002),'All world audio must fade on pause: '+JSON.stringify(paused));
    const cleanup=await page.evaluate(()=>{
      const audio=window.lumen.audio;
      for(let index=0;index<150;index++)audio._tone(220+index,audio.ctx.currentTime+.01,.3,.001,'reed');
      const count=audio._voices.size;audio.destroy();return {count,voices:audio._voices.size,beds:audio._beds.length,context:audio.ctx,timer:audio._timer};
    });
    assert.ok(cleanup.count<=90);assert.deepEqual({...cleanup,count:0},{count:0,voices:0,beds:0,context:null,timer:null});
    assert.deepEqual(errors,[]);await context.close();
  });

  await test('Les réglages de son restent disponibles dans l’aventure classique', async () => {
    const {page,context,errors}=await open('bureau',null,{colorScheme:'dark'});
    await page.locator('#masthead [data-command="help"]').click();
    assert.equal(await page.locator('#help-screen [data-appearance]').count(),0);
    assert.equal(await page.evaluate(()=>window.LumenAppearance.current),'light');

    await page.locator('#classic-music').fill('35');
    assert.equal(await page.evaluate(()=>window.lumen.audio.mix.music),.35);
    await page.screenshot({path:path.join(shots,'appearance-dark-classic-settings.png')});
    assert.deepEqual(errors,[]);await context.close();
  });

  await test('Les cinq langues système traduisent les éditions source et portable sans réseau', async () => {
    const cases = [
      ['en-GB', 'en', 'The Island of Little Dawns'], ['fr-CA', 'fr', 'L’île des petits matins'],
      ['es-MX', 'es', 'La isla de los amaneceres'], ['ar-SA', 'ar', 'جزيرة الفجر الصغير'], ['zh-TW', 'zh', '小小晨光岛']
    ];
    for (const source of [false, true]) for (const [locale, language, name] of cases) {
      const { page, context, errors } = await open('bureau', null, { song: true, source, locale });
      const external = [];
      page.on('request', request => { if (!/^(file|data):/.test(request.url())) external.push(request.url()); });
      await page.reload(); await page.waitForFunction(() => window.lumen?.frames >= 2);
      const state = await page.evaluate(() => ({ language: window.LumenI18n.language,
        preference: window.lumen.progress.settings.language, lang: document.documentElement.lang, dir: document.documentElement.dir,
        name: document.getElementById('song-island-name').textContent, title: document.title,
        settings: document.querySelector('#song-shell .song-icon[data-command="song-settings"]').getAttribute('aria-label') }));
      assert.equal(state.language, language); assert.equal(state.preference, 'auto');
      assert.equal(state.lang, language === 'zh' ? 'zh-Hans' : language);
      assert.equal(state.dir, language === 'ar' ? 'rtl' : 'ltr'); assert.equal(state.name, name);
      assert.equal(state.settings, { en: 'Settings', fr: 'Réglages', es: 'Ajustes', ar: 'الإعدادات', zh: '设置' }[language]);
      if (language !== 'fr') assert.ok(!state.title.includes('Le Chant'));
      assert.deepEqual(external, []); assert.deepEqual(errors, []);
      if (source) await page.screenshot({ path: path.join(shots, 'language-' + language + '-desktop.png') });
      await context.close();
    }
  });

  await test('La priorité système, le repli anglais et le choix sauvegardé sont respectés', async () => {
    for (const scenario of [
      { locale: 'de-DE', languages: ['de-DE', 'ja-JP'], expected: 'en' },
      { locale: 'de-DE', languages: ['de-DE', 'es-ES', 'fr-FR'], expected: 'es' },
      { locale: 'zh-CN', saved: 'ar', expected: 'ar' },
      { locale: 'es-ES', saved: 'invalid', expected: 'es' }
    ]) {
      const profile = scenario.saved ? { schema: 3, settings: { language: scenario.saved } } : null;
      const { page, context, errors } = await open('bureau', profile, { song: true, ...scenario });
      assert.equal(await page.evaluate(() => window.LumenI18n.language), scenario.expected);
      assert.deepEqual(errors, []); await context.close();
    }
  });

  await test('Changer de langue conserve la partie et le focus, et le choix survit au rechargement', async () => {
    const { page, context, errors } = await open('portrait', null, { song: true, locale: 'fr-FR' });
    await page.locator('#game').focus(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(180); await page.keyboard.up('ArrowRight');
    await page.locator('#song-shell .song-icon[data-command="song-settings"]').click();
    const before = await page.evaluate(() => ({ x: window.lumen.player.x, y: window.lumen.player.y, elapsed: window.lumen.elapsed, key: window.lumen.level.key, chapters: JSON.stringify(window.lumen.progress.chapters) }));
    for (const language of ['es', 'ar', 'zh', 'en', 'fr', 'ar']) {
      await page.locator('#song-language').selectOption(language);
      await page.waitForFunction(code => window.LumenI18n.language === code && document.activeElement.id === 'song-language', language);
      assert.equal(await page.locator('#song-language').inputValue(), language);
      const after = await page.evaluate(() => ({ x: window.lumen.player.x, y: window.lumen.player.y, elapsed: window.lumen.elapsed, key: window.lumen.level.key, chapters: JSON.stringify(window.lumen.progress.chapters) }));
      assert.deepEqual(after, before);
      assert.equal(await page.locator('#song-panel-title').textContent(), await page.evaluate(() => window.LumenI18n.t('Un peu de confort')));
      await page.screenshot({ path: path.join(shots, 'language-' + language + '-settings.png') });
    }
    await page.reload(); await page.waitForFunction(() => window.lumen?.song);
    assert.equal(await page.evaluate(() => window.LumenI18n.language), 'ar');
    await page.locator('#song-shell .song-icon[data-command="song-settings"]').click();
    await page.locator('#song-language').selectOption('auto');
    assert.equal(await page.evaluate(() => window.LumenI18n.language), 'fr');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['zh-CN'] });
      window.dispatchEvent(new Event('languagechange'));
    });
    assert.equal(await page.evaluate(() => window.LumenI18n.language), 'zh');
    assert.equal(await page.locator('#song-language').inputValue(), 'auto');
    assert.deepEqual(errors, []); await context.close();
  });

  await test('Les traductions arabe et chinoise restent cadrées sans inverser les commandes', async () => {
    for (const locale of ['ar-SA', 'zh-CN', 'es-ES']) for (const view of ['compact', 'paysage']) {
      const { page, context, errors } = await open(view, null, { song: true, locale });
      await page.waitForFunction(() => window.lumen.frames >= 2);
      const layout = await page.evaluate(() => {
        const rectangles = [...document.querySelectorAll('#song-shell button, #touch-controls button')]
          .filter(button => button.getClientRects().length).map(button => ({ role: button.getAttribute('aria-label') || button.textContent, rect: button.getBoundingClientRect().toJSON() }));
        const overlap = [];
        for (let first = 0; first < rectangles.length; first++) for (let second = first + 1; second < rectangles.length; second++) {
          const left = rectangles[first], right = rectangles[second];
          if (left.rect.x < right.rect.right - 2 && left.rect.right > right.rect.x + 2 && left.rect.y < right.rect.bottom - 2 && left.rect.bottom > right.rect.y + 2) overlap.push([left.role, right.role]);
        }
        return { outside: rectangles.filter(button => button.rect.x < -1 || button.rect.right > innerWidth + 1 || button.rect.bottom > innerHeight + 1), overlap,
          classicHidden: [...document.querySelectorAll('.screen')].every(screen => getComputedStyle(screen).display === 'none'),
          overflow: document.documentElement.scrollWidth > innerWidth,
          left: document.querySelector('[data-touch="left"]').getBoundingClientRect().x,
          right: document.querySelector('[data-touch="right"]').getBoundingClientRect().x };
      });
      assert.deepEqual(layout.outside, [], locale + ' ' + view); assert.deepEqual(layout.overlap, [], locale + ' ' + view);
      assert.equal(layout.classicHidden, true, 'The classic home must not flash over the localized game.');
      assert.equal(layout.overflow, false); assert.ok(layout.left < layout.right);
      await page.screenshot({ path: path.join(shots, 'language-' + locale + '-' + view + '.png') });
      const before = await page.evaluate(() => window.lumen.player.x);
      await page.locator('#game').focus(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
      assert.ok(await page.evaluate(() => window.lumen.player.x) > before + 30, 'Right must still move right.');
      await page.locator('#song-shell .song-icon[data-command="song-atlas"]').click();
      await page.waitForSelector('#map-screen.active');
      assert.ok(await page.locator('#map-screen').evaluate(panel => panel.scrollWidth <= panel.clientWidth + 1));
      await page.screenshot({ path: path.join(shots, 'language-' + locale + '-' + view + '-atlas.png') });
      assert.deepEqual(errors, []); await context.close();
    }
  });

  await test('L’édition classique, les dialogues et le changement de langue sont traduits', async () => {
    const { page, context, errors } = await open('bureau', null, { locale: 'es-ES' });
    assert.equal(await page.locator('#start-button span').first().textContent(), 'Empezar la aventura');
    await page.locator('#masthead [data-command="help"]').click();
    await page.locator('#classic-language').selectOption('ar');
    assert.equal(await page.locator('#help-title').textContent(), 'اتبع اندفاعك.');
    await page.locator('#help-screen [data-command="close-help"]').first().click();
    await page.locator('#home-screen [data-command="hub"]').click();
    await page.waitForFunction(() => window.lumen.level.hub && window.lumen.mode === 'playing');
    await page.waitForTimeout(350);
    await page.locator('#game').focus(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
    await page.waitForFunction(() => !document.getElementById('dialogue').classList.contains('hidden'));
    assert.equal(await page.locator('#dialogue-name').textContent(), 'فيسبر');
    assert.ok(/[\u0600-\u06ff]/.test(await page.locator('#dialogue-line').textContent()));
    assert.equal(await page.evaluate(() => window.lumen.level.key), 'observatoire');
    assert.deepEqual(errors, []); await context.close();
  });

  await test('Les textes statiques du document possèdent une traduction sans modifier les graines', async () => {
    const { page, context, errors } = await open('bureau', null, { song: true, locale: 'en-US' });
    const missing = await page.evaluate(html => {
      const source = new DOMParser().parseFromString(html, 'text/html');
      const texts = new Set(), walker = source.createTreeWalker(source.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement?.closest('script, style, svg, noscript, [translate="no"], #song-goal')) continue;
        texts.add(node.nodeValue.trim().replace(/\s+/g, ' '));
      }
      for (const element of source.querySelectorAll('[aria-label], [title], [placeholder]')) {
        if (element.id === 'seed-input') continue;
        for (const name of ['aria-label', 'title', 'placeholder']) if (element.hasAttribute(name)) texts.add(element.getAttribute(name));
      }
      return [...texts].filter(text => /\p{L}/u.test(text) && !/^[A-Z]$/.test(text) && !['LUMEN', 'Lumen'].includes(text) && !window.LumenI18n.has(text));
    }, fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    assert.deepEqual(missing, []);
    const codes = await page.evaluate(() => {
      const before = window.LumenRng.encodeSeed(12345);
      window.LumenI18n.setLanguage('ar');
      return [before, window.LumenRng.encodeSeed(12345)];
    });
    assert.equal(codes[0], codes[1]); assert.deepEqual(errors, []); await context.close();
  });

  await test('Le Chant démarre directement, avec ses ressources locales et un canvas animé', async () => {
    for (const source of [false, true]) {
      const { page, context, errors } = await open('bureau', null, { song: true, source });
      const requests = [];
      page.on('request', request => { if (!/^(file|data):/.test(request.url())) requests.push(request.url()); });
      await page.evaluate(() => localStorage.setItem('lumen.gardens.v3', JSON.stringify({ schema: 3,
        chapters: { [window.LumenSong.ISLANDS[0].key]: { completed: true, stars: 2 } } })));
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
      assert.equal(await page.evaluate(() => window.lumen.song.index), 0);
      assert.equal(await page.locator('#song-welcome').isVisible(), true);
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => window.lumen.player.vx > 1);
      await page.waitForFunction(() => document.getElementById('song-welcome').hidden);
      await page.keyboard.up('ArrowRight');
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

  await test('Le clavier déplace Lumen, relance son saut, chante et fige la simulation en pause', async () => {
    const { page, context, errors } = await open('bureau', null, { song: true });
    await page.locator('#game').focus();
    const start = await page.evaluate(() => window.lumen.player.x);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(450); await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(() => window.lumen.player.x) > start + 60, 'La direction doit réellement déplacer Lumen.');
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

  await test('La carte commune, les réglages persistants et le rythme fonctionnent', async () => {
    const { page, context, errors } = await open('portrait', null, { song: true });
    await page.locator('#song-shell .song-icon[data-command="song-atlas"]').click();
    await page.waitForSelector('#map-screen.active');
    const placeCount = await page.evaluate(() => window.LUMEN_LEVELS.length + window.LumenSong.ISLANDS.length + 1);
    assert.equal(await page.locator('[data-place]').count(), placeCount);
    assert.equal(await page.locator('.journey-node.island.is-locked').count(), 2);
    assert.equal(await page.locator('#level-grid,.song-islands').count(), 0);
    await page.screenshot({ path: path.join(shots, 'chant-atlas.png') });
    await page.locator('[data-journey-back]').click();
    await page.waitForFunction(() => window.lumen.song && window.lumen.mode === 'playing');
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
    await page.locator('#song-shell .song-icon[data-command="song-atlas"]').click();
    await page.waitForFunction(() => window.lumen.mode === 'map');
    assert.equal(await page.evaluate(() => window.lumen.song?.index), 0, 'La carte suspend l’île sans perdre sa session.');
    const chapterCount = await page.evaluate(() => window.LUMEN_LEVELS.filter(level => !level.hub).length);
    assert.equal(await page.locator('.journey-node.stage').count(), chapterCount);
    assert.equal(await page.locator('.journey-node.hub').count(), 1);
    await page.waitForTimeout(400);
    await page.locator('[data-journey-back]').click();
    await page.waitForFunction(() => window.lumen.session === 'song');
    assert.deepEqual(errors, []); await context.close();
  });

  await test('Le parcours île, atlas, chapitre joué et retour conserve la progression sans triche', async () => {
    for (const source of [true, false]) {
      const { page, context, errors } = await open('bureau', null, { song: true, source });
      assert.equal(await page.evaluate(() => window.lumen.song.index), 0);
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => window.lumen.player.x > 180);
      await page.keyboard.up('ArrowRight');
      await page.locator('#song-shell .song-icon[data-command="song-atlas"]').click();
      await page.waitForSelector('#map-screen.active');
      await enterPlace(page, 'prairies-aurore');
      await page.waitForFunction(() => window.lumen.session === 'campaign' && window.lumen.mode === 'playing');
      const played = await page.evaluate(() => {
        const game = window.lumen;
        let jumpUntil = 0, lastJump = -10, jumps = 0;
        for (let frame = 0; frame < 120 * 90 && ['playing', 'dead'].includes(game.mode); frame++) {
          if (game.mode === 'playing') {
            game.input.virtual('right', true, 'identity-pilot');
            game.input.virtual('run', true, 'identity-pilot');
            const player = game.player;
            const ground = game.platforms.filter(platform => platform.type === 'ground' &&
              platform.x <= player.x + 16 && platform.x + platform.w >= player.x + 16)
              .sort((first, second) => second.x - first.x)[0];
            const edge = ground ? ground.x + ground.w : Infinity;
            const creature = game.enemies.some(enemy => enemy.alive && enemy.x > player.x &&
              enemy.x - player.x < 125 && Math.abs(enemy.y - player.y) < 110);
            if (player.grounded && game.elapsed - lastJump > .12 && (edge - player.x < 95 || creature)) {
              game.input.virtual('jump', true, 'identity-pilot');
              jumpUntil = game.elapsed + .45; lastJump = game.elapsed; jumps++;
            } else if (game.elapsed > jumpUntil) game.input.virtual('jump', false, 'identity-pilot');
          }
          game.update(1 / 120); game.input.clearFrame();
        }
        game.input.reset(); game.renderer.draw(game, 0); game.emit('frame', .1);
        return { mode: game.mode, key: game.level.key, record: JSON.stringify(game.store.chapter(game.level.key)),
          jumps, notes: game.levelCoins, deaths: game.deaths, hp: game.player.hp, seconds: game.elapsed };
      });
      assert.equal(played.mode, 'complete', JSON.stringify(played));
      assert.ok(played.jumps > 0 && played.notes > 0 && played.hp > 0);
      assert.equal(JSON.parse(played.record).completed, true);
      await page.waitForSelector('#complete-screen.active');
      await page.screenshot({ path: path.join(shots, 'identity-route-' + (source ? 'source' : 'portable') + '.png') });
      await page.locator('#complete-screen [data-command="map"]').click();
      await page.waitForSelector('#map-screen.active');
      await enterPlace(page, 'chant-petits-matins');
      await page.waitForFunction(() => window.lumen.song?.index === 0 && window.lumen.mode === 'playing');
      assert.equal(await page.evaluate(key => JSON.stringify(window.lumen.store.chapter(key)), played.key), played.record);
      await page.reload(); await page.waitForFunction(() => window.lumen?.song?.index === 0);
      assert.equal(await page.evaluate(key => JSON.stringify(window.lumen.store.chapter(key)), played.key), played.record);
      assert.deepEqual(errors, []);
      console.log('      parcours ' + (source ? 'source' : 'portable') + ' : ' + played.jumps + ' sauts, ' + played.notes +
        ' notes, ' + played.deaths + ' chute(s), aucune position ni invulnérabilité injectée');
      await context.close();
    }
  });

  await test('Les trois îles se jouent réellement avec une fixture d’accès historique et conduisent aux actes', async () => {
    // État forcé d'accès uniquement. Les échos, fragments et sorties sont joués.
    // Le parcours de progression neuf est couvert par test-journey.cjs.
    const { page, context, errors } = await open('bureau', null, { song: true });
    await page.evaluate(() => { window.lumen.store.unlock('coeur-eclipse'); window.lumen.saveProgress(); });
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
      assert.ok(['complete','ending'].includes(result.mode), JSON.stringify(result));
      assert.equal(result.echoes, 3); assert.equal(result.stars, 3); assert.equal(result.falls, 0);
      await page.waitForSelector('.song-panel-result');
      await page.screenshot({ path: path.join(shots, 'chant-fin-' + (index + 1) + '.png') });
      if (index < 2) {
        await page.locator('#song-panel [data-command="song-next"]').click();
        await page.waitForFunction(() => window.lumen.session === 'campaign' && window.lumen.mode === 'playing');
        await page.evaluate(() => window.lumen.showMap());
        await page.waitForSelector('#map-screen.active');
        const nextIsland = await page.evaluate(next => window.LumenSong.ISLANDS[next].key, index + 1);
        await enterPlace(page, nextIsland);
        await page.waitForFunction(next => window.lumen.song?.index === next && window.lumen.mode === 'playing', index + 1);
        await page.waitForTimeout(400);
        await page.evaluate(() => { window.lumen.renderer.draw(window.lumen, 0); });
        await page.screenshot({ path: path.join(shots, 'chant-ile-' + (index + 2) + '.png') });
      }
    }
    assert.equal(await page.evaluate(() => window.lumen.progress.codex.creatures.filter(entry => entry.startsWith('chant-')).length), 9);
    await page.locator('#song-panel [data-command="song-atlas"]').click();
    await page.waitForSelector('#map-screen.active');
    assert.equal(await page.locator('.journey-node.island.is-locked').count(), 0);
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
    await page.waitForFunction(() => window.lumen.frames >= 2 && window.lumen.player.grounded);
    const before = await page.evaluate(() => ({ x: window.lumen.player.x, y: window.lumen.player.y, elapsed: window.lumen.elapsed }));
    await page.evaluate(() => {
      for (const [action, pointerId] of [['right', 41], ['jump', 42]]) document.querySelector(`[data-touch="${action}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId, pointerType: 'touch' }));
    });
    await page.waitForFunction(elapsed => window.lumen.elapsed >= elapsed + .45, before.elapsed);
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
    const standalone = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-build-'));
    try {
      for (const file of ['index.html', 'style.css', 'song.css', 'journey.css', 'play.css', 'icon.svg', 'assets', 'js', 'tools']) {
        fs.cpSync(path.join(root, file), path.join(standalone, file), { recursive: true });
      }
      assert.equal(fs.existsSync(path.join(standalone, 'node_modules')), false);
      const build = spawnSync(process.execPath, [path.join(standalone, 'tools', 'build.cjs')], { encoding: 'utf8', cwd: standalone });
      assert.equal(build.status, 0, build.stderr);
      assert.equal(fs.readFileSync(path.join(standalone, 'LUMEN.html'), 'utf8'), fs.readFileSync(path.join(root, 'LUMEN.html'), 'utf8'));
    } finally { fs.rmSync(standalone, { recursive: true, force: true }); }
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
    await page.waitForFunction(() => document.getElementById('chapter-caption').textContent === window.LumenI18n.t('L’OBSERVATOIRE'));
    assert.equal(await page.locator('#chapter-number').isVisible(), false);
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
    await page.waitForFunction(() => document.getElementById('chapter-caption').textContent.includes('01 / 05'));
    assert.equal(await page.locator('#chapter-number').isVisible(), false);

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
    await enterPlace(page, 'prairies-aurore');
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
    const firstVersion = await page.evaluate(() => {
      localStorage.clear();
      const original = JSON.stringify({ version: 1, unlocked: 7, finished: true, bonusUnlocked: true,
        records: { 7: { completed: true, stars: 3, coins: 51, score: 8700, time: 87.2, medal: 'gold' } } });
      localStorage.setItem('lumen.gardens.v1', original);
      const store = new window.LumenSave.SaveStore(localStorage);
      return { source: store.migratedFrom, intact: localStorage.getItem('lumen.gardens.v1') === original,
        finale: store.chapter('coeur-eclipse'), unrelated: store.chapter('vergers-vent'),
        finished: store.profile.finished, addedChapter: store.isUnlocked('galerie-echos') };
    });
    assert.equal(firstVersion.source, 'lumen.gardens.v1');
    assert.equal(firstVersion.intact, true);
    assert.equal(firstVersion.finale.stars, 3);
    assert.equal(firstVersion.finale.score, 8700);
    assert.equal(firstVersion.unrelated, null);
    assert.equal(firstVersion.finished, true);
    assert.equal(firstVersion.addedChapter, true);
    await page.goto(PAGE);
    await page.waitForFunction(() => window.lumen?.song?.index === 0);
    assert.deepEqual(await page.evaluate(() => window.lumen.store.chapter('coeur-eclipse')), firstVersion.finale);
    await page.evaluate(() => {
      const profile = JSON.parse(localStorage.getItem('lumen.gardens.v3'));
      profile.hub = { quests: { 'premier-souffle': 'done' }, transformations: ['coupole-allumee'] };
      localStorage.setItem('lumen.gardens.v3', JSON.stringify(profile));
    });
    await page.reload(); await page.waitForFunction(() => window.lumen?.song?.index === 0);
    const thirdVersion = await page.evaluate(() => ({ finale: window.lumen.store.chapter('coeur-eclipse'),
      quest: window.lumen.store.questState('premier-souffle'), transformations: window.lumen.progress.hub.transformations,
      allowed: window.lumen.canEnterDreams().allowed, legacy: !!localStorage.getItem('lumen.gardens.v1') }));
    assert.deepEqual(thirdVersion.finale, firstVersion.finale);
    assert.equal(thirdVersion.quest, 'done');
    assert.deepEqual(thirdVersion.transformations, ['coupole-allumee']);
    assert.equal(thirdVersion.allowed, true);
    assert.equal(thirdVersion.legacy, true);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('Aucun défilement horizontal et des particules bornées sur cinq formats', async () => {
    const mesures = {};
    for (const view of Object.keys(VIEWS)) {
      const { page, context, errors } = await open(view);
      await page.evaluate(() => { window.lumen.start(0); window.lumen.frameWindow.length = 0; });
      await page.waitForTimeout(2600);
      const debordement = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert.equal(debordement, false, 'Défilement horizontal en ' + view);
      mesures[view] = await page.evaluate(() => ({ particules: window.lumen.particles.length }));
      // Les réservoirs restent bornés : rien ne s'accumule pendant une session.
      assert.ok(mesures[view].particules <= 500, 'Particules non bornées en ' + view + ' : ' + mesures[view].particules);
      assert.deepEqual(errors, [], 'Erreurs en ' + view);
      await context.close();
    }
    fs.writeFileSync(path.join(root, 'work', 'browser-results.json'),
      JSON.stringify({ mesures, note: 'Cadrage et bornes de particules seulement ; aucune mesure de performance.' }, null, 2));
  });

  await browser.close();
  console.log('\n' + (checks.length - failed) + '/' + checks.length + ' contrôles navigateur réussis.');
  if(!filter)fs.writeFileSync(path.join(root, 'tests', 'browser-test-results.json'),
    JSON.stringify({ passed: checks.length - failed, failed, checks }, null, 2));
  process.exitCode = failed ? 1 : 0;
})();
