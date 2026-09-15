/* LUMEN — original procedural artwork. All drawing uses world-space coordinates.
   The renderer is deliberately read-only: animation derives from game time. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const PALETTES = {
    meadow: { sky: ['#a1acee', '#b9d2ed', '#e3eacf'], far: '#8abf9d', middle: '#68ac89', glow: '#fff5d6', grass: '#c8e88a', grassDark: '#82bb73', stone: '#ae826d', rock: '#705c66', accent: '#f1bf71', flower: '#ffa598', dark: '#335263', mist: '#eaf2d5' },
    cavern: { sky: ['#102339', '#253853', '#486677'], far: '#283c53', middle: '#334b66', glow: '#9ae5e1', grass: '#a3cbe4', grassDark: '#658da9', stone: '#44566c', rock: '#303c54', accent: '#bdacf5', flower: '#baa9ee', dark: '#202d43', mist: '#9bbed3' },
    tide: { sky: ['#103b50', '#327c89', '#b6d8c5'], far: '#376976', middle: '#417b83', glow: '#ffe7ae', grass: '#ccdfa0', grassDark: '#759c85', stone: '#577983', rock: '#365c68', accent: '#ffd191', flower: '#ffb6ae', dark: '#173f51', mist: '#b8e3d5' },
    sky: { sky: ['#829fdf', '#c2dceb', '#f5e8c8'], far: '#90b7ac', middle: '#6da99e', glow: '#fff7d9', grass: '#d4edb2', grassDark: '#8fc7a3', stone: '#728e9b', rock: '#4c677d', accent: '#f8cd95', flower: '#fff2d2', dark: '#345765', mist: '#fff0d1' },
    forge: { sky: ['#291f38', '#654356', '#cb766c'], far: '#61384d', middle: '#7e4e5b', glow: '#ffc18b', grass: '#e8ad85', grassDark: '#b97567', stone: '#725467', rock: '#47394c', accent: '#ffba76', flower: '#ffc390', dark: '#34263e', mist: '#e8a285' },
    frost: { sky: ['#193044', '#4c7181', '#bddbd6'], far: '#426577', middle: '#5e8998', glow: '#e3faf4', grass: '#e2f1ea', grassDark: '#9fcbcb', stone: '#668595', rock: '#425e74', accent: '#b0d7f3', flower: '#dfbcf4', dark: '#294452', mist: '#e6f6ed' },
    secret: { sky: ['#282141', '#634969', '#d99b99'], far: '#695470', middle: '#95667e', glow: '#ffddb5', grass: '#e6b9cb', grassDark: '#b98cb4', stone: '#806480', rock: '#544361', accent: '#ffe09a', flower: '#ffdda6', dark: '#382c4b', mist: '#f3c9d1' },
    eclipse: { sky: ['#111d2e', '#29394c', '#576c72'], far: '#263b4e', middle: '#364e5b', glow: '#ffe0a7', grass: '#a6c8b4', grassDark: '#6b9a9b', stone: '#4b6670', rock: '#304751', accent: '#f5bf70', flower: '#e8be93', dark: '#1a2c3c', mist: '#bbd8d0' }
  };
  const seed = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mix = (a, b, t) => a + (b - a) * t;
  function ellipse(c, x, y, rx, ry, color, rotation = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rotation, 0, TAU); if (color) { c.fillStyle = color; c.fill(); } }
  function line(c, pts, color, width = 2) { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.stroke(); }
  function rounded(c, x, y, w, h, r, color) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = color; c.fill(); }
  function star(c, x, y, size, color, turn = 0) { c.save(); c.translate(x, y); c.rotate(turn); c.fillStyle = color; c.beginPath(); c.moveTo(0, -size); c.quadraticCurveTo(size * .16, -size * .16, size, 0); c.quadraticCurveTo(size * .16, size * .16, 0, size); c.quadraticCurveTo(-size * .16, size * .16, -size, 0); c.quadraticCurveTo(-size * .16, -size * .16, 0, -size); c.fill(); c.restore(); }
  function leaf(c, x, y, s, angle, color) { c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = color; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-s * .6, -s * .7, -s * .35, -s * 1.35, 0, -s * 1.5); c.bezierCurveTo(s * .4, -s, s * .6, -s * .35, 0, 0); c.fill(); c.restore(); }

  class LumenRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.width = 1280; this.height = 720; this.dpr = 1;
      this.worldWidth = 1280; this.sceneMode = 'home';
      this.skyCache = new Map();
      this.resize(canvas.clientWidth || 1280, canvas.clientHeight || 720);
    }
    static palette(theme) {
      const palette = PALETTES[theme] || PALETTES.meadow;
      if (window.LumenAppearance?.current !== 'dark') return palette;
      const skies = {
        meadow: ['#162e35', '#3a6269', '#778a83'], sky: ['#1b303a', '#456773', '#9ba99b'],
        tide: ['#122d38', '#2d626e', '#779e91'], secret: ['#352e38', '#665562', '#b0837d']
      };
      return { ...palette, sky: skies[theme] || palette.sky, far: palette.rock, middle: palette.dark };
    }
    resize(width, height) {
      this.width = Math.max(1, width); this.height = Math.max(1, height);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.updateViewport(this.sceneMode);
    }
    updateViewport(mode) {
      this.sceneMode = mode;
      // Portrait play keeps the hero readable; menus retain their composed scene.
      this.worldWidth = this.width < this.height && mode !== 'home' && mode !== 'map' ? 600 : 1280;
      this.scale = Math.min(this.width / this.worldWidth, this.height / 720);
      this.offsetX = (this.width - this.worldWidth * this.scale) / 2;
      this.offsetY = (this.height - 720 * this.scale) / 2;
    }
    createSky(theme, palette) {
      const surface = document.createElement('canvas'); surface.width = 1280; surface.height = 720;
      const c = surface.getContext('2d');
      const sky = c.createLinearGradient(0, 0, 0, 720); palette.sky.forEach((v, i) => sky.addColorStop(i / 2, v)); c.fillStyle = sky; c.fillRect(0, 0, 1280, 720);
      const light = c.createRadialGradient(995, 196, 0, 995, 196, 580); light.addColorStop(0, palette.glow + '35'); light.addColorStop(1, palette.glow + '00'); c.fillStyle = light; c.fillRect(0, 0, 1280, 720);
      for (let i = 0; i < 180; i++) {
        const x = seed(i + 3) * 1280, y = seed(i + 591) * 540;
        c.globalAlpha = .14 + seed(i + 718) * .44; ellipse(c, x, y, seed(i + 197) > .94 ? 1.7 : .7, seed(i + 197) > .94 ? 1.7 : .7, palette.glow);
      }
      c.globalAlpha = 1;
      // A quiet paper-grain finish, cached rather than sampled every frame.
      for (let i = 0; i < 6000; i++) { c.fillStyle = i % 2 ? '#ffffff08' : '#00182709'; c.fillRect(seed(i * 2) * 1280, seed(i * 2 + 1) * 720, 1, 1); }
      this.skyCache.set(theme + ':' + (window.LumenAppearance?.current || 'light'), surface); return surface;
    }
    draw(game, dt) {
      if (game.song && window.LumenSongArt) return window.LumenSongArt.draw(this, game);
      const c = this.ctx, level = game.level || {}, theme = level.theme || 'meadow', p = LumenRenderer.palette(theme), t = game.time || 0;
      this.updateViewport(game.mode || 'home');
      this.palette = p; this.time = t; this.theme = theme; this.echoTime = game.echoTime || 0;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.fillStyle = p.sky[0]; c.fillRect(0, 0, this.width, this.height);
      c.translate(this.offsetX, this.offsetY); c.scale(this.scale, this.scale); c.save(); c.beginPath(); c.rect(0, 0, this.worldWidth, 720); c.clip();
      const cam = game.camera || { x: 0, y: 0 }, cameraX = cam.x || 0, cameraY = cam.y || 0;
      this.cameraX = cameraX; this.cameraY = cameraY;
      this.background(c, theme, p, t, cameraX, game.mode);
      const shake = cam.shake || 0;
      c.save(); c.translate(-cameraX + Math.sin(t * 129) * shake, -cameraY + Math.cos(t * 113) * shake * .6);
      if (game.mode === 'home') this.homeGarden(c, t, p);
      if (game.level && game.level.hub) {
        const lit = !!(game.progress && game.progress.hub && game.progress.hub.transformations.includes('coupole-allumee'));
        this.observatory(c, t, p, lit);
      }
      if (game.boss) this.arena(c, game.boss, t, p);
      for (const s of game.secrets || []) if (!s.found && this.visible(s)) this.secret(c, s, t, p);
      // Ce qui dort est dessiné SOUS les plateformes : sa silhouette reste
      // visible en permanence, sans jamais masquer une surface jouable.
      for (const w of game.wakeables || []) if (this.visible({ x: w.x - (w.span || 0) / 2 - 40, y: w.y - 40, w: (w.span || 0) + 80, h: 80 }, 60)) this.wakeable(c, w, t, p);
      for (const platform of game.platforms || []) if (this.visible(platform, 100)) this.platform(c, platform, t, p);
      for (const h of game.hazards || []) if (this.visible(h)) this.hazard(c, h, t, p);
      for (const cp of game.checkpoints || []) if (this.visible(cp, 120)) this.checkpoint(c, cp, t, p);
      if (game.exit && this.visible(game.exit, 200)) this.portal(c, game.exit, t, p);
      for (const item of game.collectibles || []) if (!item.taken && this.visible(item, 60)) this.collectible(c, item, t, p);
      for (const character of game.characters || []) if (this.visible({ x: character.x - 40, y: character.y - 100, w: 80, h: 100 }, 60)) this.character(c, character, t, p);
      for (const enemy of game.enemies || []) if (enemy.alive !== false && this.visible(enemy, 70)) this.enemy(c, enemy, t, p);
      if (game.boss && this.visible(game.boss, 180)) this.boss(c, game.boss, t, p);
      for (const shot of game.projectiles || []) if (this.visible(shot, 60)) this.projectile(c, shot, t);
      if (game.player) {
        if (game.mode === 'home') {
          const center = game.player.x + (game.player.w || 32) / 2, foot = game.player.y + (game.player.h || 46);
          c.save(); c.translate(center, foot); c.scale(1.75, 1.75); c.translate(-center, -foot); window.LumenSongArt.drawLumen(c, game.player, t); c.restore();
        } else window.LumenSongArt.drawLumen(c, game.player, t);
        if (game.echoTime > 0) this.echoWave(c, game.player, game.echoTime, t);
      }
      for (const w of game.waves || []) this.wave(c, w, t);
      for (const part of game.particles || []) if (this.visible(part, 25)) this.particle(c, part);
      for (const ft of game.floatingTexts || []) { c.save(); c.globalAlpha = Math.min(1, Math.max(0, ft.life || 0)); c.textAlign = 'center'; c.font = '700 17px "Trebuchet MS", sans-serif'; c.direction = window.LumenI18n?.direction || 'ltr'; c.shadowColor = '#12343b'; c.shadowBlur = 3; c.fillStyle = ft.color || '#fff0b7'; c.fillText(window.LumenI18n?.t(ft.text || '') || ft.text || '', ft.x, ft.y); c.restore(); }
      if (level.water) this.water(c, level.water, cameraX, t, p);
      c.restore();
      this.foreground(c, t, cameraX, p, theme);
      // A subtle vignette keeps the luminous central play area legible.
      const centerX = this.worldWidth / 2;
      const vignette = c.createRadialGradient(centerX, 310, Math.min(310, this.worldWidth * .35), centerX, 360, Math.max(450, this.worldWidth * .6)); vignette.addColorStop(0, '#061e2700'); vignette.addColorStop(1, '#061e2748'); c.fillStyle = vignette; c.fillRect(0, 0, this.worldWidth, 720);
      if (game.flash && game.flash.life > 0) {
        c.save(); c.globalAlpha = Math.min(.24, (game.flash.life / (game.flash.maxLife || .35)) * .24);
        c.fillStyle = game.flash.color || '#fff2c9'; c.fillRect(0, 0, this.worldWidth, 720); c.restore();
      }
      c.restore();
    }
    visible(o, margin = 50) { return (o.x || 0) + (o.w || 0) >= this.cameraX - margin && (o.x || 0) <= this.cameraX + this.worldWidth + margin && (o.y || 0) < this.cameraY + 850; }
    background(c, theme, p, t, cameraX, mode) {
      c.drawImage(this.skyCache.get(theme + ':' + (window.LumenAppearance?.current || 'light')) || this.createSky(theme, p), 0, 0);
      // Halo and crescent are the recurring visual motif of the archipelago.
      const moonX = this.worldWidth * .785 - cameraX * .015, moonY = theme === 'eclipse' ? 187 : 149;
      const halo = c.createRadialGradient(moonX, moonY, 56, moonX, moonY, 200); halo.addColorStop(0, p.glow + '19'); halo.addColorStop(1, p.glow + '00'); c.fillStyle = halo; c.fillRect(moonX - 200, moonY - 200, 400, 400);
      c.save(); c.globalAlpha = theme === 'cavern' ? .3 : .9;
      // Clip the crescent's cutout to the lunar disc, keeping the sky visible.
      c.save(); c.beginPath(); c.ellipse(moonX, moonY, theme === 'eclipse' ? 73 : 56, theme === 'eclipse' ? 73 : 56, 0, 0, TAU); c.clip();
      c.beginPath(); c.ellipse(moonX, moonY, theme === 'eclipse' ? 73 : 56, theme === 'eclipse' ? 73 : 56, 0, 0, TAU);
      if (theme !== 'sky') c.ellipse(moonX + (theme === 'eclipse' ? 0 : 21), moonY - (theme === 'eclipse' ? 0 : 15), theme === 'eclipse' ? 64 : 50, theme === 'eclipse' ? 64 : 50, 0, 0, TAU);
      c.fillStyle = p.glow; c.fill('evenodd'); c.restore();
      c.strokeStyle = p.glow + '25'; c.lineWidth = 1; c.beginPath(); c.arc(moonX, moonY, 100, 0, TAU); c.stroke(); c.beginPath(); c.arc(moonX, moonY, 112, -.3, 1.3); c.stroke(); c.restore();
      // Tiny orbiting motes and elongated, painterly cloud banks.
      for (let i = 0; i < 9; i++) { const speed = 3 + seed(i) * 4; const x = ((seed(i + 82) * 1700 + t * speed - cameraX * .05) % 1700 + 1700) % 1700 - 200; const y = 92 + seed(i + 43) * 260; c.save(); c.globalAlpha = .035 + seed(i + 62) * .035; ellipse(c, x, y, 80 + seed(i + 23) * 130, 8 + seed(i + 7) * 11, p.mist); ellipse(c, x - 38, y - 8, 67, 15, p.mist); c.restore(); }
      if (theme === 'meadow' || theme === 'sky' || theme === 'tide') {
        // Broad readable silhouettes recall an inviting platform world, while the
        // moon gates, floating gardens and botanical details belong to LUMEN.
        for (let i = 0; i < 7; i++) {
          const x = ((i * 267 + seed(i + 720) * 96 + t * (2 + i % 3) - cameraX * .055) % 1810 + 1810) % 1810 - 225;
          this.cloud(c, x, 115 + seed(i + 302) * 205, .56 + seed(i + 445) * .56, theme === 'meadow' ? .82 : .61);
        }
        if (theme === 'meadow') this.rollingHills(c, cameraX, p, t);
      }
      if (theme === 'cavern') {
        c.fillStyle = p.dark; c.beginPath(); c.moveTo(0, 0); for (let x = 0; x <= 1320; x += 44) c.lineTo(x, 38 + seed(Math.floor((x + cameraX * .12) / 44)) * 92); c.lineTo(1280, 0); c.closePath(); c.fill();
        for (let i = 0; i < 11; i++) { const x = ((i * 190 - cameraX * .09) % 1500 + 1500) % 1500 - 100; this.crystal(c, x, 120 + seed(i) * 120, 24 + seed(i + 88) * 22, p.accent, .12, true); }
      }
      for (let layer = 0; layer < 3; layer++) {
        const factor = [.09, .19, .32][layer], gap = [410, 350, 480][layer], base = [437, 484, 572][layer];
        const offset = cameraX * factor;
        const start = Math.floor(offset / gap) - 1;
        for (let j = start; j < start + 6; j++) {
          const x = j * gap - offset + seed(j + 17 * layer) * 90;
          const y = base + seed(j + 139) * 90;
          const width = 170 + seed(j + 800) * 230;
          const height = 45 + seed(j + 410) * 120;
          c.save(); c.globalAlpha = [.28, .4, .47][layer];
          this.distantIsland(c, x, y, width, height, layer === 0 ? p.far : p.middle, p, j + layer * 9, theme);
          c.restore();
        }
      }
      if (theme === 'forge') {
        for (let i = 0; i < 28; i++) { const x = ((seed(i) * 1420 + Math.sin(t * .2 + i) * 20 - cameraX * .2) % 1420 + 1420) % 1420 - 70; const y = 760 - ((t * (12 + seed(i + 39) * 20) + seed(i + 8) * 850) % 850); c.globalAlpha = .25 + Math.sin(t + i) * .2; ellipse(c, x, y, 1.5, 3, p.accent); } c.globalAlpha = 1;
      } else {
        for (let i = 0; i < 32; i++) { const x = ((seed(i + 901) * 1420 + t * (3 + seed(i) * 7) - cameraX * .25) % 1420 + 1420) % 1420 - 70; const y = 160 + seed(i + 130) * 590 + Math.sin(t * .5 + i * 3) * 20; c.globalAlpha = .17 + (Math.sin(t * 1.4 + i) + 1) * .14; if (theme === 'frost') star(c, x, y, 2.5 + seed(i) * 2, '#edfaf4', t * .1); else ellipse(c, x, y, 1.3 + seed(i) * 1.1, 1.3 + seed(i) * 1.1, p.glow); } c.globalAlpha = 1;
      }
      const mist = c.createLinearGradient(0, 470, 0, 720); mist.addColorStop(0, p.mist + '00'); mist.addColorStop(1, p.mist + '23'); c.fillStyle = mist; c.fillRect(0, 470, 1280, 250);
    }
    cloud(c, x, y, s, opacity) {
      c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = opacity;
      const fill = c.createLinearGradient(0, -45, 0, 24); fill.addColorStop(0, '#fffef2'); fill.addColorStop(.7, '#f8fcf2'); fill.addColorStop(1, '#d9e8e9');
      c.fillStyle = fill; c.beginPath(); c.moveTo(-80, 17);
      c.bezierCurveTo(-110, 15, -110, -16, -83, -21); c.bezierCurveTo(-87, -48, -51, -65, -33, -41);
      c.bezierCurveTo(-22, -72, 24, -69, 29, -37); c.bezierCurveTo(56, -58, 80, -39, 77, -15);
      c.bezierCurveTo(112, -16, 114, 18, 84, 22); c.bezierCurveTo(31, 27, -35, 23, -80, 17); c.fill();
      c.strokeStyle = '#ffffffa6'; c.lineWidth = 2; c.beginPath(); c.moveTo(-77, -20); c.bezierCurveTo(-75, -43, -51, -48, -36, -32); c.stroke();
      c.strokeStyle = '#adcfd453'; c.beginPath(); c.moveTo(-76, 14); c.quadraticCurveTo(-17, 23, 69, 17); c.stroke(); c.restore();
    }
    rollingHills(c, cameraX, p, t) {
      for (let layer = 0; layer < 2; layer++) {
        const offset = cameraX * (.07 + layer * .065), gap = layer ? 590 : 460;
        for (let i = Math.floor(offset / gap) - 1; i < Math.floor(offset / gap) + 5; i++) {
          const x = i * gap - offset, y = 596 + layer * 31, w = 320 + seed(i + 612) * 190, h = 110 + seed(i + 521) * 150;
          c.save(); c.globalAlpha = layer ? .7 : .49;
          const color = c.createLinearGradient(0, y - h, 0, y + 70); color.addColorStop(0, layer ? '#a6d17e' : '#a2c7ad'); color.addColorStop(1, layer ? '#6bab8c' : '#7da9a0');
          c.fillStyle = color; c.beginPath(); c.moveTo(x - 90, y + 70); c.bezierCurveTo(x + w * .07, y + 4, x + w * .2, y - h, x + w * .49, y - h); c.bezierCurveTo(x + w * .77, y - h, x + w * .83, y - 16, x + w + 110, y + 70); c.closePath(); c.fill();
          c.strokeStyle = '#e2f0b64a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w * .12, y - 15); c.bezierCurveTo(x + w * .29, y - h * .86, x + w * .4, y - h * 1.08, x + w * .61, y - h * .9); c.stroke();
          if (layer) for (let k = 0; k < 4; k++) {
            const xx = x + w * (.29 + k * .12), yy = y - h * (.42 + Math.sin(k + i) * .13);
            leaf(c, xx, yy, 9 + k % 2 * 3, -.32 + Math.sin(t + i) * .02, '#568b7940'); leaf(c, xx + 8, yy + 1, 7, .55, '#e7efb13d');
          }
          c.restore();
        }
      }
    }
    homeGarden(c, t, p) {
      c.save();
      // The title's botanical vignette is intentionally larger than play-scale.
      // Its tree, carved arch and hanging lamps frame Lumen's first little island.
      const trunkX = 1112, floorY = 520, sway = Math.sin(t * .55) * 2;
      c.save(); c.globalAlpha = .18;
      const light = c.createRadialGradient(1055, 381, 10, 1055, 381, 230); light.addColorStop(0, '#ffffd8'); light.addColorStop(1, '#ffffd800'); c.fillStyle = light; c.fillRect(810, 140, 490, 490); c.restore();
      c.strokeStyle = '#709483'; c.lineWidth = 17; c.lineCap = 'round'; c.beginPath(); c.moveTo(trunkX - 2, floorY); c.bezierCurveTo(trunkX + 28, 454, trunkX - 23, 390, trunkX + 8 + sway, 305); c.stroke();
      c.strokeStyle = '#88a18a'; c.lineWidth = 4; c.beginPath(); c.moveTo(trunkX + 1, floorY); c.bezierCurveTo(trunkX + 24, 444, trunkX - 14, 369, trunkX + 10 + sway, 308); c.stroke();
      const boughs = [
        [1114,419,1068,376,1022,341,993,312], [1110,391,1148,364,1175,331,1206,318],
        [1114,355,1094,305,1082,283,1069,255], [1118,336,1150,293,1163,270,1165,245],
        [1094,374,1040,365,1024,343,975,348], [1120,411,1168,395,1192,364,1236,372]
      ];
      for (let i = 0; i < boughs.length; i++) {
        const b = boughs[i]; c.strokeStyle = i % 2 ? '#809987' : '#759482'; c.lineWidth = 6 - i * .45; c.beginPath(); c.moveTo(b[0], b[1]); c.bezierCurveTo(b[2], b[3], b[4] + sway, b[5], b[6] + sway, b[7]); c.stroke();
      }
      const crowns = [[993,303,48,-.65],[1033,319,57,-.7],[975,345,38,-1.12],[1072,277,53,-.45],[1102,299,45,.05],[1158,267,57,.3],[1198,311,48,.7],[1173,327,49,.53],[1230,362,41,.85],[1201,368,43,.57],[1060,348,43,-.7],[1122,320,45,.14]];
      const colors = ['#8eb99a','#abc49d','#75a58f','#c6d4a9','#98b99c'];
      crowns.forEach((a, i) => {
        const x = a[0] + sway, y = a[1], s = a[2], rotation = a[3] + Math.sin(t * .8 + i) * .025;
        c.save(); c.translate(x, y); c.rotate(rotation); leaf(c, 0, s * .65, s, 0, colors[i % colors.length]);
        c.strokeStyle = '#e3e9c450'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, s * .6); c.quadraticCurveTo(-3, 0, 0, -s * .63); c.stroke();
        for (let k = 0; k < 3; k++) line(c, [[-s * .24, s * (.25 - k * .27)], [0, s * (.12 - k * .27)], [s * .23, s * (.22 - k * .27)]], '#edf0cf28', 1); c.restore();
      });
      // Weathered moon gate: broad stone silhouette and restrained inlay.
      const ax = 1026, ay = 510;
      c.strokeStyle = '#648781'; c.lineWidth = 21; c.lineCap = 'butt'; c.beginPath(); c.moveTo(ax - 48, ay); c.lineTo(ax - 48, ay - 110); c.arc(ax, ay - 110, 48, Math.PI, TAU); c.lineTo(ax + 48, ay); c.stroke();
      c.strokeStyle = '#9eb59a'; c.lineWidth = 4; c.beginPath(); c.moveTo(ax - 44, ay); c.lineTo(ax - 44, ay - 110); c.arc(ax, ay - 110, 44, Math.PI, TAU); c.lineTo(ax + 44, ay - 12); c.stroke();
      for (let i = 0; i < 5; i++) { const a = Math.PI + i * Math.PI / 4; line(c, [[ax + Math.cos(a) * 40, ay - 110 + Math.sin(a) * 40], [ax + Math.cos(a) * 57, ay - 110 + Math.sin(a) * 57]], '#406f704f', 2); }
      rounded(c, ax - 62, ay - 1, 29, 11, 4, '#7c9c8b'); rounded(c, ax + 33, ay - 1, 29, 11, 4, '#7c9c8b');
      star(c, ax, ay - 158, 6, '#e7d8a2');
      const lampY = 424 + Math.sin(t * 1.2) * 2;
      line(c, [[ax, ay - 148], [ax, lampY - 15]], '#9bb39a', 1.5);
      c.strokeStyle = '#789b86'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(ax, lampY, 12, 19, Math.sin(t) * .06, 0, TAU); c.stroke();
      c.shadowColor = '#fff2b5'; c.shadowBlur = 16; ellipse(c, ax, lampY, 6, 10, '#ffedb7'); c.shadowBlur = 0; star(c, ax, lampY, 7, '#fff8cf');
      for (const vine of [{x:971,y:365,len:105},{x:1072,y:373,len:110},{x:1185,y:384,len:74}]) {
        c.strokeStyle = '#78a18a'; c.lineWidth = 2; c.beginPath(); c.moveTo(vine.x, vine.y); c.bezierCurveTo(vine.x - 7, vine.y + vine.len * .3, vine.x + 13, vine.y + vine.len * .7, vine.x + Math.sin(t + vine.x) * 3, vine.y + vine.len); c.stroke();
        for (let i = 0; i < vine.len / 17; i++) leaf(c, vine.x + Math.sin(i) * 3, vine.y + 10 + i * 17, 10, i % 2 ? .9 : -.9, i % 2 ? '#bad09b' : '#8caf8e');
      }
      for (let i = 0; i < 13; i++) { const x = 755 + i * 30, s = .85 + seed(i + 975) * .75; this.sprig(c, x, floorY - 2, s, t, p, i % 3 !== 0); }
      for (let i = 0; i < 3; i++) { const x = 978 + i * 85 + Math.sin(t * .7 + i * 2) * 14, y = 340 + Math.sin(t + i * 3) * 21; c.save(); c.translate(x, y); const flap = .3 + Math.abs(Math.sin(t * 7 + i)) * .7; ellipse(c, -3, 0, 5 * flap, 3, '#fff4c9', -.5); ellipse(c, 3, 0, 5 * flap, 3, '#fff4c9', .5); line(c, [[0,-2],[0,3]], '#92a786', 1); c.restore(); }
      c.restore();
    }
    distantIsland(c, x, y, w, h, color, p, id, theme) {
      c.fillStyle = color; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + w * .2, y - 14, x + w * .8, y - 14, x + w, y); c.lineTo(x + w * .78, y + h * .62); c.lineTo(x + w * .61, y + h); c.lineTo(x + w * .35, y + h * .7); c.closePath(); c.fill();
      if (theme === 'forge' || theme === 'eclipse') {
        rounded(c, x + w * .49, y - h * .9, 23, h, 3, color);
        c.strokeStyle = color; c.lineWidth = 9; c.beginPath(); c.arc(x + w * .46, y - h * .66, 30, Math.PI, 0); c.stroke();
        rounded(c, x + w * .27, y - h * .5, 15, h * .6, 3, color);
      } else if (theme === 'cavern') {
        for (let k = 0; k < 4; k++) this.crystal(c, x + w * (.25 + k * .13), y, 33 + seed(id + k) * 64, color, 1);
      } else {
        const tx = x + w * .5, th = 65 + seed(id + 404) * 75;
        c.strokeStyle = color; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx, y + 5); c.bezierCurveTo(tx - 9, y - th * .4, tx + 14, y - th * .64, tx + 9, y - th); c.stroke();
        ellipse(c, tx - 22, y - th * .73, w * .18, th * .29, color, -.35); ellipse(c, tx + 26, y - th * .85, w * .18, th * .34, color, .2); ellipse(c, tx + 1, y - th * 1.04, w * .13, th * .28, color, -.2);
        if (seed(id + 432) > .45) { c.lineWidth = 3; c.beginPath(); c.moveTo(x + w * .73, y); c.quadraticCurveTo(x + w * .68, y + h, x + w * .84, y + h + 65); c.stroke(); }
      }
    }
    platform(c, o, t, p) {
      // La géométrie d'un élément réveillé a son propre langage : elle est faite
      // de lumière et de pétales, jamais de la pierre des plateformes ordinaires.
      if (o.wakeId) { if (o.active) this.wakePlatform(c, o, t, p); return; }
      if (o.type === 'echo') {
        this.echoPlatform(c, o, t); return;
      }
      if (o.active === false && o.type === 'vanish') { c.save(); c.setLineDash([4, 8]); c.strokeStyle = p.grass + '38'; c.lineWidth = 2; c.strokeRect(o.x + 3, o.y + 3, o.w - 6, 10); c.restore(); return; }
      if (o.active === false && o.type === 'crumble') return;
      const x = o.x, y = o.y, w = o.w, h = Math.max(o.h || 25, 16), typ = o.type || 'solid';
      c.save();
      if (typ === 'vanish') c.globalAlpha = .6 + .3 * Math.sin((o.phase || 0) + t * 3);
      if (typ === 'crumble' && o.crumbleTimer > 0) c.translate(Math.sin(t * 90) * 1.7, 0);
      const stone = c.createLinearGradient(0, y, 0, y + Math.min(h, 180)); stone.addColorStop(0, p.stone); stone.addColorStop(1, p.rock);
      c.fillStyle = stone; c.beginPath(); c.moveTo(x + 7, y + 1); c.lineTo(x + w - 7, y + 1); c.quadraticCurveTo(x + w + 1, y + 6, x + w - 2, y + 17);
      if (h > 55) { c.lineTo(x + w - 9, y + h * .49); c.lineTo(x + w - 23, y + h * .65); c.lineTo(x + w * .76, y + h * .86); c.lineTo(x + w * .54, y + h); c.lineTo(x + w * .25, y + h * .88); c.lineTo(x + 12, y + h * .62); }
      else { c.lineTo(x + w - 10, y + h - 3); c.lineTo(x + w * .68, y + h + 8); c.lineTo(x + w * .3, y + h + 2); c.lineTo(x + 7, y + h - 1); }
      c.lineTo(x, y + 10); c.quadraticCurveTo(x, y + 2, x + 7, y + 1); c.fill();
      if (this.theme === 'meadow' || this.theme === 'forge' || typ === 'crumble') {
        // Brick courses follow the platform silhouette, so the collision surface
        // remains clear without turning the floating garden into a tile grid.
        c.save(); c.clip(); c.lineWidth = 2;
        const cell = typ === 'crumble' ? 34 : 49, rowH = typ === 'crumble' ? 20 : 27;
        for (let row = 0; row < Math.min(h, 190) / rowH; row++) {
          const yy = y + 11 + row * rowH, shift = row % 2 ? cell / 2 : 0;
          line(c, [[x + 2, yy + rowH], [x + w - 2, yy + rowH]], p.rock + '80', 2);
          for (let col = -1; col < w / cell + 1; col++) {
            const xx = x + col * cell + shift;
            line(c, [[xx, yy + 2], [xx, yy + rowH]], p.rock + '80', 2);
            line(c, [[xx + 4, yy + 4], [xx + cell - 5, yy + 4]], '#ffe2bd26', 1.5);
          }
        }
        c.restore();
      }
      // Inlaid strata, beveled stones and carved crescent glyphs.
      c.save(); c.globalAlpha = .35;
      for (let k = 0; k < Math.floor(w / 60); k++) { const sx = x + 19 + k * 61, sy = y + 22 + seed(k + x) * Math.min(50, h * .35); line(c, [[sx, sy], [sx + 13, sy + 4], [sx + 30, sy + 3]], p.dark, 2); if (h > 80) line(c, [[sx + 9, sy + 38], [sx + 26, sy + 34], [sx + 40, sy + 38]], p.stone, 2); }
      c.restore();
      c.strokeStyle = p.grassDark; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 6, y + 7); c.lineTo(x + w - 6, y + 7); c.stroke();
      if (typ === 'spring') {
        c.strokeStyle = p.accent; c.lineWidth = 3; c.beginPath(); for (let k = 0; k <= 5; k++) { const xx = x + 10 + k * (w - 20) / 5; k ? c.lineTo(xx, y + 13 + (k % 2) * 7) : c.moveTo(xx, y + 13); } c.stroke(); rounded(c, x, y - 4, w, 9, 5, p.flower); rounded(c, x + 4, y - 5, w - 8, 3, 2, '#ffedcd');
      } else if (typ === 'conveyor') {
        rounded(c, x, y, w, 10, 5, '#d9dba9'); for (let k = 0; k < w / 25; k++) { const xx = x + ((k * 25 + t * 32 * (o.direction || 1)) % w + w) % w; line(c, [[xx - 4, y + 3], [xx, y + 5], [xx - 4, y + 7]], p.rock, 2); }
      } else {
        rounded(c, x - 1, y - 2, w + 2, 7, 5, p.grass);
        for (let k = 0; k < w / 17; k++) { const xx = x + 8 + k * 17; ellipse(c, xx, y + 4, 10, 3 + seed(k + x) * 6, p.grassDark); }
        rounded(c, x + 2, y - 2, w - 4, 5, 3, p.grass);
        for (let k = 0; k < w / 53; k++) { const xx = x + 19 + k * 53, r = seed(k + x * .05); if (r > .38 && typ !== 'moving' && typ !== 'vanish') this.sprig(c, xx, y - 3, .6 + r * .6, t, p, r > .71); }
      }
      if (typ === 'moving') { c.strokeStyle = p.accent + '65'; c.lineWidth = 1; c.beginPath(); c.arc(x + w / 2, y + h / 2 + 3, 9, .1, TAU - .4); c.stroke(); star(c, x + w / 2, y + h / 2 + 3, 4, p.accent); for (let k = 0; k < 3; k++) ellipse(c, x + w * (.25 + k * .25), y + h + 9 + Math.sin(t * 3 + k) * 3, 2, 2, p.accent + '77'); }
      if (typ === 'crumble') { line(c, [[x + w * .5, y + 7], [x + w * .43, y + 16], [x + w * .53, y + 23], [x + w * .46, y + h]], p.dark, 2); line(c, [[x + w * .43, y + 16], [x + w * .3, y + 18]], p.dark, 1); }
      if (h > 70 && w > 90 && typ !== 'crumble') { const vx = x + w - 29, length = Math.min(120, h * .7); c.strokeStyle = p.grassDark; c.lineWidth = 2; c.beginPath(); c.moveTo(vx, y + 5); c.bezierCurveTo(vx - 4, y + length * .4, vx + 9, y + length * .8, vx + 2, y + length); c.stroke(); for (let k = 0; k < length / 18; k++) leaf(c, vx + Math.sin(k) * 3, y + 17 + k * 18, 8, k % 2 ? .9 : -.9, p.grassDark); }
      c.restore();
    }
    /** The eclipse arena: two standing light-curtains that close in for phase two. */
    arena(c, b, t, p) {
      if (!b.arenaActive) return;
      const warn = (b.arenaWarn || 0) > 0;
      for (const [x, direction] of [[b.arenaLeft, -1], [b.arenaRight, 1]]) {
        if (x < this.cameraX - 120 || x > this.cameraX + this.worldWidth + 120) continue;
        c.save();
        const curtain = c.createLinearGradient(x, 0, x + direction * 96, 0);
        curtain.addColorStop(0, warn ? '#ffd2a460' : '#a9c9d13a');
        curtain.addColorStop(1, '#a9c9d100');
        c.fillStyle = curtain; c.fillRect(Math.min(x, x + direction * 96), 60, 96, 560);
        c.globalAlpha = warn ? .5 + Math.abs(Math.sin(t * 9)) * .4 : .42;
        line(c, [[x, 70], [x, 618]], warn ? '#ffdcae' : '#cfe6dd', 2.5);
        for (let i = 0; i < 9; i++) {
          const y = 92 + i * 60 + Math.sin(t * 1.6 + i) * 5;
          star(c, x, y, i % 2 ? 3.4 : 2.2, warn ? '#ffe3b4' : '#dff0e4', t * .4 + i);
          c.strokeStyle = (warn ? '#ffdcae' : '#d7ecdf') + '44'; c.lineWidth = 1;
          c.beginPath(); c.arc(x, y, 11 + Math.sin(t * 2 + i) * 3, direction < 0 ? -1.2 : 1.94, direction < 0 ? 1.2 : 4.34); c.stroke();
        }
        c.restore();
      }
      // Falling-light attack: the floor is marked before anything comes down.
      for (const marker of b.rainMarkers || []) {
        const pulse = Math.max(0, marker.life || 0);
        c.save(); c.globalAlpha = .2 + pulse * .6;
        ellipse(c, marker.x, 596, 26 + pulse * 10, 7, '#ffd9a2');
        line(c, [[marker.x, 596], [marker.x, 596 - 150 * pulse]], '#ffe8bd66', 2);
        c.restore();
      }
    }
    /** The echo bell's ring, expanding from Lumen and fading as the reveal runs out. */
    echoWave(c, a, remaining, t) {
      const cx = a.x + (a.w || 32) / 2, cy = a.y + (a.h || 46) / 2;
      const elapsed = Math.max(0, 4 - remaining);
      c.save();
      for (let i = 0; i < 3; i++) {
        const age = elapsed - i * .22;
        if (age <= 0 || age > 1.5) continue;
        c.globalAlpha = Math.max(0, (1 - age / 1.5)) * .34;
        c.strokeStyle = '#d7f6e2'; c.lineWidth = 3 - i * .7;
        c.beginPath(); c.ellipse(cx, cy, age * 470, age * 360, 0, 0, TAU); c.stroke();
      }
      // A quiet reminder that the reveal is running: a small ring around the bell.
      c.globalAlpha = remaining < 1 ? .35 + Math.abs(Math.sin(t * 13)) * .45 : .5;
      c.strokeStyle = '#c9f2d8'; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy - 4, 26, -Math.PI / 2, -Math.PI / 2 + TAU * (remaining / 4)); c.stroke();
      c.restore();
    }
    /** L'observatoire : une coupole, une arche, et le changement qu'on y gagne.
     *  `lit` est vrai une fois la quête du premier souffle accomplie — c'est la
     *  seule chose qui distingue les deux états, et elle doit sauter aux yeux. */
    observatory(c, t, p, lit) {
      c.save();
      // La coupole, posée derrière le décor jouable.
      const cx = 790, base = 600;
      c.save(); c.globalAlpha = lit ? .3 : .1;
      const halo = c.createRadialGradient(cx, 330, 20, cx, 330, 330);
      halo.addColorStop(0, lit ? '#fff2c6' : '#cfd8e0'); halo.addColorStop(1, '#fff2c600');
      c.fillStyle = halo; c.fillRect(cx - 330, 0, 660, 660); c.restore();

      c.strokeStyle = lit ? '#b9a274' : '#7c7184'; c.lineWidth = 13; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(cx - 250, base); c.lineTo(cx - 250, 400);
      c.arc(cx, 400, 250, Math.PI, TAU); c.lineTo(cx + 250, base); c.stroke();
      c.strokeStyle = lit ? '#e6cf95' : '#93899d'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx - 242, base); c.lineTo(cx - 242, 400);
      c.arc(cx, 400, 242, Math.PI, TAU); c.lineTo(cx + 242, base); c.stroke();
      // Les nervures de la coupole. Allumées, elles portent chacune une lumière.
      for (let i = 0; i <= 8; i++) {
        const angle = Math.PI + i * Math.PI / 8;
        const x1 = cx + Math.cos(angle) * 242, y1 = 400 + Math.sin(angle) * 242;
        line(c, [[cx, 400], [x1, y1]], (lit ? '#d8c08c' : '#8a8194') + '77', 2);
        if (lit) { c.shadowColor = '#ffe9ae'; c.shadowBlur = 14; ellipse(c, x1, y1, 4.5, 4.5, '#fff3cd'); c.shadowBlur = 0; }
        else ellipse(c, x1, y1, 3, 3, '#7f7789');
      }
      star(c, cx, 400 - (lit ? 300 : 286) + Math.sin(t * 1.4) * (lit ? 5 : 1), lit ? 17 : 9, lit ? '#ffeeb0' : '#867d95', t * .12);
      // Les lierres de l'arche fleurissent seulement une fois la coupole vive.
      for (const side of [-1, 1]) {
        const vx = cx + side * 246;
        c.strokeStyle = lit ? '#93b881' : '#6f7f79'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(vx, 420);
        c.bezierCurveTo(vx + side * 16, 480, vx - side * 12, 530, vx + side * 6 + Math.sin(t + side) * 3, base - 8); c.stroke();
        for (let k = 0; k < 7; k++) {
          const ly = 436 + k * 22;
          leaf(c, vx + Math.sin(k + side) * 6, ly, lit ? 13 : 9, k % 2 ? .9 * side : -.9 * side, lit ? (k % 2 ? '#cbe3a4' : '#a9cb96') : '#6d7d78');
          if (lit && k % 3 === 1) { for (let j = 0; j < 5; j++) ellipse(c, vx + Math.sin(k) * 6 + Math.sin(j * TAU / 5) * 4, ly - 10 + Math.cos(j * TAU / 5) * 4, 3, 4, '#ffd9df', -j * TAU / 5); }
        }
      }
      c.restore();
    }
    /** Un habitant de l'observatoire. Deux silhouettes, deux façons de se tenir :
     *  Vesper est voûté sur son carnet, Ombeline est prête à partir. */
    character(c, ch, t, p) {
      const sway = Math.sin((ch.bob || 0) * 1.6) * 1.5, face = ch.facing || 1;
      c.save(); c.translate(ch.x, ch.y);
      ellipse(c, 0, 2, 19, 5, '#12343b33');
      // Une petite marque au sol dit qu'on peut s'approcher, sans aucun texte.
      c.save(); c.globalAlpha = ch.near ? .5 : .22 + Math.abs(Math.sin(t * 1.8)) * .12;
      c.strokeStyle = '#ffe6ad'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(0, 3, 34, 9, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 3; i++) star(c, Math.sin(t * 1.1 + i * 2.1) * 28, 3 + Math.cos(t * 1.1 + i * 2.1) * 7, 2.2, '#ffeec2', t);
      c.restore();
      c.scale(face, 1);
      if (ch.id === 'vesper') {
        // Long, voûté, une robe qui traîne : quelqu'un qui n'est pas pressé.
        const robe = c.createLinearGradient(0, -74, 0, 0);
        robe.addColorStop(0, '#6f7fa0'); robe.addColorStop(1, '#3e4a66');
        c.fillStyle = robe; c.beginPath(); c.moveTo(-15, 0); c.quadraticCurveTo(-20, -44, -10, -62);
        c.lineTo(11, -62); c.quadraticCurveTo(21, -44, 17, 0); c.closePath(); c.fill();
        for (let i = 0; i < 3; i++) line(c, [[-9 + i * 9, -54], [-11 + i * 9, -4]], '#8e9cba55', 2);
        ellipse(c, 2 + sway * .3, -72, 13, 12, '#f0e3cb');
        // Lunettes rondes : l'archiviste voit de près.
        c.strokeStyle = '#57607a'; c.lineWidth = 1.8;
        for (const eye of [-4, 6]) { c.beginPath(); c.arc(eye + sway * .3, -73, 4.6, 0, TAU); c.stroke(); ellipse(c, eye + sway * .3, -73, 1.7, 2.1, '#40506a'); }
        line(c, [[1.5 + sway * .3, -73], [1.5 + sway * .3, -73]], '#57607a', 2);
        ellipse(c, 2 + sway * .3, -83, 14, 7, '#8fa0c0');
        line(c, [[-6, -88], [10, -89]], '#b6c3dc', 3);
        // Le carnet, toujours ouvert.
        c.save(); c.translate(14, -40); c.rotate(-.25);
        rounded(c, -10, -8, 21, 16, 2, '#f6f0dc'); line(c, [[0, -8], [0, 8]], '#ccc2a6', 1.5);
        for (let i = 0; i < 3; i++) line(c, [[-7, -4 + i * 4], [-2, -4 + i * 4]], '#a9a288', 1);
        c.restore();
        line(c, [[11, -52], [15, -44]], '#5d6a88', 5);
      } else {
        // Petite, vive, une cape courte et une clé d'étoile à la ceinture.
        c.fillStyle = '#9a6f96'; c.beginPath(); c.moveTo(-13, -2); c.quadraticCurveTo(-17, -30, -8, -46);
        c.lineTo(9, -46); c.quadraticCurveTo(17, -28, 13, -2); c.closePath(); c.fill();
        rounded(c, -9, -46, 18, 24, 6, '#e6a98f');
        line(c, [[-6, -46], [-5, -26]], '#cf9078', 3); line(c, [[6, -46], [5, -26]], '#f2bb9d', 3);
        line(c, [[-8, -24], [-6, -4]], '#5f7fa8', 6); line(c, [[7, -24], [9, -4]], '#5f7fa8', 6);
        ellipse(c, -6, -2, 6.5, 4, '#6a5a5e'); ellipse(c, 9, -2, 6.5, 4, '#6a5a5e');
        ellipse(c, 1 + sway * .4, -56, 11.5, 10.5, '#f7e0c4');
        ellipse(c, -2 + sway * .4, -57, 2.6, 3.4, '#3f4f57'); ellipse(c, 5 + sway * .4, -57, 2.6, 3.4, '#3f4f57');
        ellipse(c, -1.4 + sway * .4, -58.4, .9, 1.2, '#fffdf0'); ellipse(c, 5.6 + sway * .4, -58.4, .9, 1.2, '#fffdf0');
        c.strokeStyle = '#c98a74'; c.lineWidth = 1.2; c.beginPath(); c.arc(2 + sway * .4, -52, 3.2, .25, Math.PI - .25); c.stroke();
        // Chignon haut et mèche au vent.
        ellipse(c, 1 + sway * .4, -65, 12, 7, '#7a5468');
        ellipse(c, 3 + sway * .4, -73, 6.5, 6, '#7a5468');
        line(c, [[-9, -63], [-16 + Math.sin(t * 2) * 2, -68]], '#7a5468', 3);
        // La clé d'étoile : ce qu'elle garde.
        line(c, [[11, -22], [15, -14]], '#caa96e', 2); star(c, 16, -11, 5.5, '#ffdf9e', t * .6);
      }
      c.restore();
    }
    /** La surface d'un élément réveillé : corolle pour une fleur, clair de lune
     *  pour un pont. Elle clignote pendant sa dernière seconde et demie. */
    wakePlatform(c, o, t, p) {
      const fading = !!o.warning;
      c.save();
      c.globalAlpha = fading ? .45 + Math.abs(Math.sin(t * 11)) * .55 : 1;
      if (o.type === 'spring') {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
        c.save(); c.globalAlpha *= .2; ellipse(c, cx, cy, o.w * .72, 24, '#ffd9a6'); c.restore();
        for (let i = 0; i < 7; i++) {
          const angle = -Math.PI + i * Math.PI / 6 + Math.sin(t * 2 + i) * .03;
          leaf(c, cx + Math.cos(angle) * 30, cy + 6, 27, angle + Math.PI / 2, i % 2 ? '#ffc4b0' : '#f8a898');
        }
        rounded(c, o.x + 4, o.y, o.w - 8, o.h, 10, '#ffe6b4');
        rounded(c, o.x + 10, o.y + 2, o.w - 20, 5, 3, '#fff7dd');
        for (let i = 0; i < 4; i++) star(c, o.x + 18 + i * (o.w - 36) / 3, o.y + 11, 3.4, '#e79a86', t + i);
        ellipse(c, cx, cy + 3, 9, 7, '#f6c98c');
      } else {
        const glow = c.createLinearGradient(0, o.y - 4, 0, o.y + o.h + 14);
        glow.addColorStop(0, '#f4fbe4'); glow.addColorStop(.35, '#bfe7dd'); glow.addColorStop(1, '#8fb9cc55');
        rounded(c, o.x, o.y, o.w, o.h, 8, glow);
        line(c, [[o.x + 6, o.y + 2], [o.x + o.w - 6, o.y + 2]], '#ffffffc0', 2.5);
        for (let i = 0; i < o.w / 34; i++) {
          const xx = o.x + 17 + i * 34;
          star(c, xx, o.y + 10, 3, '#f7ffe8', t * .5 + i);
          c.strokeStyle = '#e6f7e055'; c.lineWidth = 1;
          c.beginPath(); c.arc(xx, o.y + 11, 9 + Math.sin(t * 3 + i) * 2, Math.PI, TAU); c.stroke();
        }
        // Deux ancrages de pierre rappellent que le pont a toujours été là, endormi.
        for (const side of [o.x, o.x + o.w]) { rounded(c, side - 7, o.y - 6, 14, o.h + 12, 5, p.stone); ellipse(c, side, o.y - 4, 5, 4, p.accent); }
      }
      c.restore();
    }
    /** Ce qui dort. Un élément assoupi doit être lisible AVANT d'être réveillé :
     *  sa silhouette annonce ce qu'il deviendra, et une pulsation dit qu'il vit. */
    wakeable(c, w, t, p) {
      if (w.state === 'awake') return;
      const breath = .55 + Math.abs(Math.sin(t * 1.5 + w.pulse)) * .45;
      c.save(); c.translate(w.x, w.y);
      c.save(); c.globalAlpha = .1 + breath * .12; ellipse(c, 0, 0, 30, 26, '#e9f8d8'); c.restore();
      if (w.type === 'bloom') {
        // Un bouton fermé, penché, sur sa tige : la promesse d'un tremplin.
        line(c, [[0, 26], [-2, 10], [1, 0]], '#7fa47f', 4);
        leaf(c, -3, 18, 13, -1, '#8fb383'); leaf(c, 3, 21, 11, 1.1, '#a6c393');
        for (let i = 0; i < 4; i++) {
          const lean = -.5 + i * .33;
          ellipse(c, Math.sin(lean) * 5, -4 + Math.cos(lean) * 2, 6.5, 13 * breath + 4, '#e8a898', lean * .55);
        }
        ellipse(c, 0, -8, 5, 6, '#ffd9a8');
        c.save(); c.globalAlpha = breath; star(c, 0, -14, 3.6, '#fff3cd', t); c.restore();
      } else if (w.type === 'bridge') {
        // Le tracé fantôme du pont : on voit exactement où il apparaîtra.
        const span = w.span || 190, half = span / 2;
        c.save(); c.globalAlpha = .22 + breath * .2;
        c.strokeStyle = '#dff2e4'; c.lineWidth = 2; c.setLineDash([3, 10]);
        c.beginPath(); c.moveTo(-half, 6); c.lineTo(half, 6); c.stroke(); c.setLineDash([]);
        c.restore();
        for (const side of [-half, half]) { rounded(c, side - 7, 0, 14, 26, 5, p.stone); ellipse(c, side, 2, 5, 4, p.accent + 'aa'); }
        c.save(); c.globalAlpha = .35 + breath * .3; star(c, 0, 6, 4, '#eafbe2', t * .4); c.restore();
      } else {
        // Un carillon : une cloche suspendue, immobile, qui attend une voix.
        line(c, [[0, -26], [0, -12]], '#9fb79c', 2);
        c.strokeStyle = '#b9cfae'; c.lineWidth = 2; c.beginPath(); c.arc(0, -27, 11, Math.PI, TAU); c.stroke();
        const bell = c.createLinearGradient(-10, -12, 10, 12);
        bell.addColorStop(0, '#f1f7d8'); bell.addColorStop(.5, '#bfd9c2'); bell.addColorStop(1, '#7f9fa8');
        c.fillStyle = bell; c.beginPath(); c.moveTo(-5, -12); c.quadraticCurveTo(-12, -6, -11, 6);
        c.lineTo(-15, 10); c.quadraticCurveTo(0, 16, 15, 10); c.lineTo(11, 6);
        c.quadraticCurveTo(12, -6, 5, -12); c.closePath(); c.fill();
        ellipse(c, 0, 12, 4, 4, '#ffe4a1');
        c.save(); c.globalAlpha = .3 + breath * .4;
        for (const side of [-1, 1]) {
          c.strokeStyle = '#dff5e2'; c.lineWidth = 1.4;
          c.beginPath(); c.arc(0, 0, 21 + breath * 4, side < 0 ? 2.5 : -.6, side < 0 ? 3.8 : .7); c.stroke();
        }
        c.restore();
      }
      c.restore();
    }
    /** L'onde elle-même : un anneau qui s'ouvre et s'efface. */
    wave(c, w, t) {
      const strength = Math.max(0, w.life / w.maxLife);
      c.save();
      c.globalAlpha = strength * (w.source === 'player' ? .5 : .38);
      c.strokeStyle = w.source === 'player' ? '#dff7e6' : '#e8f0c8';
      c.lineWidth = 1 + strength * 3;
      c.beginPath(); c.ellipse(w.x, w.y, w.radius, w.radius * .86, 0, 0, TAU); c.stroke();
      c.globalAlpha = strength * .22; c.lineWidth = 1;
      c.beginPath(); c.ellipse(w.x, w.y, w.radius * .66, w.radius * .57, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = i * TAU / 6 + t * .5;
        c.globalAlpha = strength * .4;
        star(c, w.x + Math.cos(angle) * w.radius, w.y + Math.sin(angle) * w.radius * .86, 2.6, '#f2ffe4', t * 2);
      }
      c.restore();
    }
    echoPlatform(c, o, t) {
      const revealed = this.echoTime > 0, warning = this.echoTime > 0 && this.echoTime < 1, y = o.y, x = o.x;
      c.save();
      if (!revealed) {
        c.globalAlpha = .18 + Math.sin(t * 2 + x * .01) * .045;
        c.strokeStyle = '#d7f5ed'; c.lineWidth = 1.3; c.setLineDash([2, 11]);
        c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + o.w, y + 2); c.stroke(); c.setLineDash([]);
        star(c, x + o.w / 2, y + 2, 3, '#e5f9e4');
      } else {
        c.globalAlpha = warning ? .46 + Math.abs(Math.sin(t * 13)) * .5 : .93;
        const fill = c.createLinearGradient(0, y, 0, y + 30); fill.addColorStop(0, '#e6fbd9'); fill.addColorStop(.16, '#91ded1'); fill.addColorStop(1, '#678cb0aa');
        rounded(c, x, y, o.w, Math.min(o.h || 25, 34), 7, fill);
        line(c, [[x + 5, y + 1], [x + o.w - 5, y + 1]], '#f5ffe7', 2.5);
        for (let i = 0; i < o.w / 30; i++) {
          const xx = x + 14 + i * 30; star(c, xx, y + 14, 3.5, '#d9f5d7', Math.PI / 4);
          c.strokeStyle = '#e3ffe857'; c.lineWidth = 1; c.beginPath(); c.arc(xx, y + 15, 8, Math.PI, TAU); c.stroke();
        }
        const glow = c.createLinearGradient(0, y + 25, 0, y + 60); glow.addColorStop(0, '#b5f4db1c'); glow.addColorStop(1, '#b5f4db00');
        c.fillStyle = glow; c.fillRect(x + 5, y + 25, o.w - 10, 35);
      }
      c.restore();
    }
    sprig(c, x, y, s, t, p, flower) {
      c.save(); c.translate(x, y); c.scale(s, s); c.rotate(Math.sin(t * 1.4 + x) * .06);
      line(c, [[0, 0], [1, -11], [-1, -20]], p.grassDark, 1.5); leaf(c, 0, -5, 8, -.8, p.grassDark); leaf(c, 1, -9, 7, .9, p.grass);
      if (flower) { for (let j = 0; j < 5; j++) ellipse(c, Math.sin(j * TAU / 5) * 3.7 - 1, -21 + Math.cos(j * TAU / 5) * 3.7, 3.1, 4.2, p.flower, -j * TAU / 5); ellipse(c, -1, -21, 2.5, 2.5, p.glow); }
      c.restore();
    }
    crystal(c, x, y, h, color, alpha = 1, inverted = false) {
      c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (inverted) c.scale(1, -1);
      c.fillStyle = color; c.beginPath(); c.moveTo(-h * .2, 0); c.lineTo(-h * .24, -h * .62); c.lineTo(-h * .04, -h); c.lineTo(h * .21, -h * .7); c.lineTo(h * .22, -h * .12); c.lineTo(0, h * .06); c.fill();
      c.fillStyle = '#ffffff30'; c.beginPath(); c.moveTo(-h * .04, -h); c.lineTo(-h * .05, 0); c.lineTo(-h * .2, 0); c.lineTo(-h * .24, -h * .62); c.fill(); line(c, [[-h * .04, -h], [h * .02, -h * .7], [h * .21, -h * .7]], '#ffffff55', 1); c.restore();
    }
    hazard(c, h, t, p) {
      if (h.type === 'lava') {
        const y = h.y + Math.sin(t * 2 + h.x) * 2, gradient = c.createLinearGradient(0, y, 0, y + h.h); gradient.addColorStop(0, '#ffdb94'); gradient.addColorStop(.12, '#fa9673'); gradient.addColorStop(1, '#a75065'); c.fillStyle = gradient; c.beginPath(); c.moveTo(h.x, y); for (let j = 0; j <= h.w; j += 12) c.lineTo(h.x + j, y + Math.sin(j * .04 + t * 3) * 3); c.lineTo(h.x + h.w, y + h.h); c.lineTo(h.x, y + h.h); c.fill(); for (let j = 0; j < h.w / 80; j++) { const xx = h.x + 25 + j * 80, yy = y - (t * 19 + j * 26) % 67; c.save(); c.globalAlpha = Math.max(0, 1 - (y - yy) / 67) * .6; ellipse(c, xx + Math.sin(t + j) * 12, yy, 2.4, 2.4, '#ffdba6'); c.restore(); }
      } else {
        for (let x = h.x; x < h.x + h.w; x += 22) { const ww = Math.min(22, h.x + h.w - x); this.crystal(c, x + ww / 2, h.y + h.h, h.h, '#e7b4b4', 1); line(c, [[x + ww / 2, h.y + 4], [x + ww / 2 - 1, h.y + h.h - 4]], '#ffded1', 1); }
      }
    }
    checkpoint(c, cp, t, p) {
      c.save(); c.translate(cp.x, cp.y); const active = !!cp.active, col = active ? '#c7ecc7' : p.accent;
      ellipse(c, 0, 2, 25, 7, p.dark + '65'); rounded(c, -14, -5, 28, 8, 4, p.stone); line(c, [[0, -4], [0, -76]], p.grassDark, 4);
      c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(0, -80, 10, -.6, Math.PI + .6); c.stroke();
      c.fillStyle = active ? '#9dd9b0' : '#b3c6b5'; c.beginPath(); c.moveTo(3, -67); c.bezierCurveTo(16, -73, 20, -63 + Math.sin(t * 4) * 4, 37, -69 + Math.sin(t * 4) * 4); c.lineTo(29, -56 + Math.sin(t * 4) * 2); c.lineTo(37, -48 + Math.sin(t * 4) * 3); c.bezierCurveTo(19, -43, 16, -58, 3, -51); c.fill(); star(c, 16, -60, 4, '#f1f5d9');
      if (active) { c.shadowColor = '#cfffcb'; c.shadowBlur = 12; ellipse(c, 0, -82, 4, 4, '#f5f8ce'); c.shadowBlur = 0; for (let i = 0; i < 4; i++) star(c, Math.sin(t + i * 1.5) * 18, -82 + Math.cos(t + i * 1.5) * 18, 2, '#ddf3bf'); }
      c.restore();
    }
    portal(c, o, t, p) {
      const x = o.x + (o.w || 70) / 2, bottom = o.y + (o.h || 100), open = o.open !== false;
      c.save(); c.translate(x, bottom);
      ellipse(c, 0, 5, 61, 13, p.dark + '55'); rounded(c, -48, -7, 96, 14, 7, p.stone); rounded(c, -38, -14, 76, 11, 5, p.grassDark);
      const glow = c.createRadialGradient(0, -61, 8, 0, -61, 104); glow.addColorStop(0, p.accent + (open ? '3d' : '11')); glow.addColorStop(1, p.accent + '00'); c.fillStyle = glow; c.fillRect(-110, -175, 220, 220);
      c.strokeStyle = p.rock; c.lineWidth = 15; c.beginPath(); c.ellipse(0, -61, 40, 58, 0, 0, TAU); c.stroke();
      c.strokeStyle = p.grassDark; c.lineWidth = 9; c.beginPath(); c.ellipse(0, -62, 39, 57, 0, Math.PI * .7, TAU + Math.PI * .3); c.stroke();
      c.strokeStyle = open ? p.accent : p.stone; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -61, 32, 50, 0, 0, TAU); c.stroke();
      c.save(); c.globalAlpha = .4; for (let i = 0; i < 6; i++) { c.strokeStyle = p.glow; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -61, 6 + (i * 6 + t * 7) % 27, 9 + (i * 9 + t * 10.5) % 43, 0, .4 + i, 2.7 + i); c.stroke(); } c.restore();
      for (let j = 0; j < 8; j++) { const a = j * TAU / 8; star(c, Math.sin(a) * 39, -61 + Math.cos(a) * 57, j % 2 ? 2.2 : 3, open ? p.glow : p.stone, a); }
      leaf(c, -38, -16, 18, -.65, p.grassDark); leaf(c, 36, -24, 15, .65, p.grass); leaf(c, -40, -29, 12, -.8, p.grass);
      star(c, 0, -62 + Math.sin(t * 2) * 3, 11, open ? '#fff0c6' : p.grassDark, t * .15);
      c.restore();
    }
    collectible(c, item, t, p) {
      const ty = item.type || 'coin', x = item.x, y = item.y + Math.sin(t * 3 + item.x * .025) * 3;
      c.save(); c.translate(x, y);
      if (ty === 'coin') {
        const width = 5.8 + Math.abs(Math.cos(t * 2.2 + x * .018)) * 2.8;
        ellipse(c, 0, 0, width + 4, 14, '#f5cd7420'); ellipse(c, 0, 0, width, 10, '#a77e4d'); ellipse(c, -1.2, -1.2, Math.max(2, width - 1.1), 9.2, '#f5d382'); c.strokeStyle = '#fff1b7'; c.lineWidth = 1.3; c.beginPath(); c.ellipse(-1, -1.2, Math.max(1, width - 3), 6.1, 0, 0, TAU); c.stroke(); star(c, -1, -1.2, 3.4, '#fff4c7');
      } else if (ty === 'star') {
        c.rotate(Math.sin(t) * .12); c.shadowColor = '#ffcf6f'; c.shadowBlur = 14; star(c, 0, 0, 19, '#f5c772'); c.shadowBlur = 0; star(c, 0, 0, 12, '#ffebaa'); ellipse(c, -3, -2, 1.3, 2, '#94764a'); ellipse(c, 3, -2, 1.3, 2, '#94764a'); c.strokeStyle = '#a88d5b'; c.lineWidth = 1; c.beginPath(); c.arc(0, 1, 3, .2, Math.PI - .2); c.stroke(); c.strokeStyle = p.accent + '44'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 26, t, t + 4); c.stroke();
      } else if (ty === 'heart') {
        c.fillStyle = '#f5a4a2'; c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-23, -4, -8, -20, 0, -9); c.bezierCurveTo(8, -20, 23, -4, 0, 10); c.fill(); ellipse(c, -5, -7, 3, 2, '#ffe0c9', -.5);
      } else {
        const colors = { bloom: '#ffa58f', breeze: '#a8e8d4', comet: '#e2b0fc', echo: '#c4f1da' }, color = colors[ty] || '#ffdc93';
        c.strokeStyle = color + '55'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.stroke(); c.fillStyle = color + '18'; c.fill(); star(c, 20 * Math.sin(t * 2), 20 * Math.cos(t * 2), 3, color);
        if (ty === 'bloom') { for (let j = 0; j < 5; j++) leaf(c, 0, 3, 12, j * TAU / 5, color); ellipse(c, 0, 0, 6, 6, '#ffedab'); star(c, 0, 0, 4, '#fffbd5'); }
        else if (ty === 'breeze') { for (let j = 0; j < 3; j++) { c.strokeStyle = j % 2 ? '#eaffde' : color; c.lineWidth = 3; c.beginPath(); c.moveTo(-13, -9 + j * 8); c.bezierCurveTo(-3, -14 + j * 8, 8, -4 + j * 8, 12, -10 + j * 8); c.stroke(); } }
        else if (ty === 'echo') {
          c.rotate(Math.sin(t * 3) * .14);
          c.strokeStyle = '#e4fadc'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -10, 4, Math.PI, TAU); c.stroke();
          const gold = c.createLinearGradient(-10, -10, 10, 12); gold.addColorStop(0, '#effadb'); gold.addColorStop(.4, '#b5e0bd'); gold.addColorStop(1, '#739aa5');
          c.fillStyle = gold; c.beginPath(); c.moveTo(-5, -10); c.quadraticCurveTo(-11, -6, -10, 5); c.lineTo(-14, 9); c.quadraticCurveTo(0, 15, 14, 9); c.lineTo(10, 5); c.quadraticCurveTo(11, -6, 5, -10); c.closePath(); c.fill();
          ellipse(c, 0, 11, 4, 4, '#ffe4a1'); star(c, 0, -1, 5, '#faffdf');
          for (const side of [-1, 1]) { c.strokeStyle = '#d5f4dca0'; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, 17 + Math.sin(t * 3) * 2, side < 0 ? 2.5 : -.6, side < 0 ? 3.8 : .7); c.stroke(); }
        }
        else { c.rotate(-.4); leaf(c, 4, 11, 22, .4, color + '66'); leaf(c, 0, 4, 16, .4, color); star(c, 0, 3, 10, '#ffecce'); }
      }
      c.restore();
    }
    enemy(c, e, t, p) {
      c.save(); const w = e.w || 36, h = e.h || 32; c.translate(e.x + w / 2, e.y + h); if (e.hitFlash > 0) c.globalAlpha = .55;
      const phase = t * 4 + (e.phase || 0), facing = (e.vx || 1) < 0 ? -1 : 1;
      ellipse(c, 0, 2, w * .49, 4.5, '#12343b35');
      if (e.type === 'sleeper') {
        // Le dormeur de mousse: a low, wide mound. Nothing else in the gardens has
        // this silhouette, so its posture alone tells you whether it is awake.
        const charge = Math.min(1, e.chargeProgress || 0);
        const awake = e.state === 'wake' || e.state === 'charge';
        // Apaisée, la créature s'aplatit et s'ouvre : le dos devient une marche
        // franche, et cette silhouette ne ressemble à aucune autre. Quand le
        // répit touche à sa fin, elle se regonfle en pulsant — l'avertissement
        // est une FORME, lisible sans son et sans distinction de couleur.
        const calm = e.state === 'calm';
        const rousing = calm && e.rousing;
        const pulse = rousing ? (Math.sin(t * 11) * .5 + .5) : 0;
        const lean = e.state === 'charge' ? facing * .16 : 0;
        const breath = e.state === 'sleep' ? Math.sin(phase * .5) * 1.6
          : calm ? -3 + pulse * 3.5 : 0;
        c.rotate(lean);
        if (calm) {
          // Un liseré clair sur le dos : la marche est dessinée, pas devinée.
          c.save(); c.globalAlpha = .5 + pulse * .4;
          line(c, [[-w * .5 + 2, -h + 2 - breath], [w * .5 - 2, -h + 2 - breath]], '#eaf6de', 3);
          c.restore();
        }
        if (charge > 0 && !awake) { c.save(); c.globalAlpha = .1 + charge * .3; ellipse(c, 0, -14, 30 + charge * 8, 24 + charge * 6, '#ffca88'); c.restore(); }
        // Four stubby root-legs, tucked while asleep and splayed while charging.
        for (const side of [-1, 1]) for (const offset of [7, 15]) {
          const spread = awake ? side * offset * 1.25 : side * offset;
          line(c, [[spread, -6], [spread + (e.state === 'charge' ? Math.sin(phase * 6 + offset) * 4 : 0), -1]], '#6d8a72', 5);
        }
        // Mossy shell: overlapping plates with a seam of light that widens as it stirs.
        ellipse(c, 0, -13 - breath, 22, 14 + breath, '#7f9c78');
        ellipse(c, 0, -16 - breath, 20, 12, '#9cb585');
        for (let i = -1; i <= 1; i++) { c.save(); c.globalAlpha = .55; ellipse(c, i * 11, -17 - breath, 8.5, 9, '#b0c391'); c.restore(); }
        leaf(c, -9, -24 - breath, 11, -.85, '#c6d79c'); leaf(c, 8, -25 - breath, 10, .8, '#a8bf8a'); leaf(c, 0, -27 - breath, 9, .05, '#d3e0ab');
        if (charge > 0) { c.save(); c.globalAlpha = charge; line(c, [[-17, -15], [-5, -18], [7, -16], [17, -19]], '#ffd493', 2); c.restore(); }
        if (awake) {
          // One wide amber eye: unmistakable, and the only warning you need.
          ellipse(c, facing * 6, -17, 12, 11, '#3a4a46');
          ellipse(c, facing * 8, -17, 6.5, 7.5, e.state === 'charge' ? '#ffb478' : '#ffd79a');
          ellipse(c, facing * 9.5, -19, 2.2, 2.8, '#fff4d8');
          c.strokeStyle = '#ffcf94'; c.lineWidth = 1.6;
          c.beginPath(); c.arc(facing * 6, -17, 15 + Math.sin(t * 9) * 2, -1, 1.6); c.stroke();
        } else {
          line(c, [[facing * 2, -17], [facing * 10, -17]], '#4f6659', 2.2);
          for (let i = 0; i < 2; i++) { c.save(); c.globalAlpha = .35 + Math.sin(phase + i * 2) * .25; star(c, facing * 16 + i * 6, -30 - ((phase * 7 + i * 9) % 16), 2.4, '#e7f2cf'); c.restore(); }
        }
      } else if (e.type === 'swarm') {
        // L'essaim: five winged motes turning around a shared centre. Stomping one
        // scatters the whole ring rather than deleting a sprite.
        c.translate(0, -h * .55);
        const scatter = Math.max(0, e.scatterTime || 0), broken = scatter > 0;
        const spread = broken ? 1 + (1.2 - scatter) * 3.4 : 1;
        if (!broken) { c.save(); c.globalAlpha = .12 + Math.sin(phase) * .04; ellipse(c, 0, 0, 27, 19, e.state === 'hunt' ? '#ffd8a0' : '#d8ecc0'); c.restore(); }
        for (let i = 0; i < 5; i++) {
          const a = phase * (broken ? .6 : 1.15) + i * TAU / 5;
          const rx = (20 + Math.sin(phase * 1.7 + i) * 4) * spread, ry = (12 + Math.cos(phase * 1.3 + i) * 3) * spread;
          const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
          c.save(); c.globalAlpha = broken ? Math.max(0, scatter / 1.2) : 1;
          const flap = Math.abs(Math.sin(t * 26 + i)) * .8 + .25;
          ellipse(c, x - 5, y - 2, 5.5 * flap, 3.4, '#f3ffe0', -.5);
          ellipse(c, x + 5, y - 2, 5.5 * flap, 3.4, '#f3ffe0', .5);
          c.save(); c.globalAlpha *= .5; ellipse(c, x, y, 8, 8, e.state === 'hunt' ? '#ffd18d' : '#cdeeb4'); c.restore();
          ellipse(c, x, y, 4.2, 4.2, e.state === 'hunt' ? '#ffbc78' : '#dff5b6');
          ellipse(c, x, y, 2.2, 2.2, '#fffbe4');
          line(c, [[x - 1, y + 4], [x, y + 8]], '#b9d39d', 1.2);
          c.restore();
        }
        if (!broken) for (let i = 0; i < 5; i++) {
          const a = phase * 1.15 + i * TAU / 5, b2 = a + TAU / 5;
          c.save(); c.globalAlpha = .16;
          line(c, [[Math.cos(a) * 20, Math.sin(a) * 12], [Math.cos(b2) * 20, Math.sin(b2) * 12]], '#eaf8d2', 1);
          c.restore();
        }
      } else if (e.type === 'hopper') {
        const squeeze = Math.abs(e.vy || 0) > 20 ? 1.15 : 1 + Math.sin(phase) * .05; c.scale(1 / squeeze, squeeze);
        ellipse(c, -11, -3, 9, 5, '#789e93'); ellipse(c, 11, -3, 9, 5, '#789e93'); ellipse(c, 0, -16, 18, 17, '#c0bb94'); ellipse(c, 0, -19, 14, 12, '#dbcba3');
        leaf(c, -6, -29, 12, -.7, '#a4c4a2'); leaf(c, 4, -30, 14, .3, '#d0d6aa'); ellipse(c, 0, -19, 7.8, 8.5, '#3c5152'); ellipse(c, facing * 2, -20, 3.2, 4, '#ffdab0'); ellipse(c, facing * 2.4, -21, 1, 1.2, '#fff7cf'); line(c, [[-3, -7], [0, -6], [3, -7]], '#789184', 1.5);
      } else if (e.type === 'turret') {
        leaf(c, -7, 0, 19, -1.1, '#729a8e'); leaf(c, 7, 0, 19, 1, '#90b19b'); rounded(c, -6, -27, 12, 27, 6, '#819f8e');
        c.save(); c.translate(0, -30); c.rotate(Math.sin(phase) * .08); for (let i = 0; i < 6; i++) leaf(c, 0, 5, 18, i * TAU / 6, i % 2 ? '#dc968c' : '#efb7a2'); ellipse(c, 0, 0, 13, 12, '#ffe0aa'); ellipse(c, facing * 5, 0, 7, 7, '#936971'); ellipse(c, facing * 7, 0, 3.5, 4.5, '#503f50'); ellipse(c, -5, -5, 1.4, 1.8, '#755b65'); c.restore();
      } else if (e.type === 'chaser') {
        c.translate(0, -h * .5); const wing = Math.sin(t * 18) * 7;
        c.fillStyle = '#b895ba'; c.beginPath(); c.moveTo(-3, 4); c.quadraticCurveTo(-29, 5 - wing, -35, -15 - wing); c.quadraticCurveTo(-20, -10, -9, -13); c.quadraticCurveTo(0, -18, 9, -13); c.quadraticCurveTo(20, -10, 35, -15 - wing); c.quadraticCurveTo(29, 5 - wing, 3, 4); c.fill(); ellipse(c, 0, -4, 12, 12, '#d9b3c7'); ellipse(c, 0, -4, 8, 7, '#565169'); ellipse(c, -3, -4, 2, 3, '#ffddaa'); ellipse(c, 4, -4, 2, 3, '#ffddaa'); leaf(c, -4, -12, 8, -.35, '#dfc1d3'); leaf(c, 4, -12, 8, .35, '#dfc1d3'); line(c, [[0, 6], [Math.sin(t * 5) * 7, 16], [0, 21]], '#b58bae', 3);
      } else {
        c.scale(facing, 1); for (let j = 0; j < 3; j++) ellipse(c, -10 + j * 9 + Math.sin(phase * 2 + j) * 2, -2, 4.5, 3, '#8daea3'); ellipse(c, 0, -10, 20, 9, '#a4c0a5'); ellipse(c, -4, -21, 16, 16, '#d29387'); ellipse(c, -6, -23, 11, 11, '#e6b29a'); c.strokeStyle = '#b07f7b'; c.lineWidth = 2; c.beginPath(); for (let a = 0; a < TAU * 1.7; a += .15) { const r = a * .8; a ? c.lineTo(-6 + Math.cos(a) * r, -23 + Math.sin(a) * r) : c.moveTo(-6, -23); } c.stroke();
        ellipse(c, 15, -17, 9, 10, '#bfd3b2'); line(c, [[12, -24], [10, -31]], '#9abea3', 2); line(c, [[19, -24], [22, -31]], '#9abea3', 2); ellipse(c, 10, -31, 2.5, 3.2, '#ffdaa2'); ellipse(c, 22, -31, 2.5, 3.2, '#ffdaa2'); ellipse(c, 11, -31, 1, 1.8, '#476362'); ellipse(c, 23, -31, 1, 1.8, '#476362');
      }
      c.restore();
    }
    boss(c, b, t, p) {
      const cx = b.x + (b.w || 130) / 2, cy = b.y + (b.h || 130) / 2;
      c.save(); c.translate(cx, cy); c.scale((b.w || 130) / 130, (b.h || 130) / 130);
      const defeated = b.hp <= 0 || b.state === 'defeated', sleeping = b.state === 'sleep', warning = b.state === 'telegraph';
      const wing = defeated ? -.16 : sleeping ? -.23 : Math.sin(t * (warning ? 12 : 2.3)) * (warning ? .06 : .12), vulnerable = b.vulnerable;
      if (warning) { c.save(); c.globalAlpha = .15 + Math.sin(t * 15) * .07; ellipse(c, 0, 0, 91, 98, '#f4a585'); c.restore(); c.scale(1.04, .96); }
      // Each third of its life removed leaves a visible mark: a shockwave now, a
      // broken ring of crown-lights afterwards.
      const stage = b.stage || 1;
      if (b.flashTimer > 0) {
        const pulse = b.flashTimer / .5;
        c.save(); c.globalAlpha = pulse * .55; c.strokeStyle = '#ffe6ae'; c.lineWidth = 5 * pulse;
        c.beginPath(); c.ellipse(0, 0, 90 + (1 - pulse) * 150, 98 + (1 - pulse) * 150, 0, 0, TAU); c.stroke();
        c.globalAlpha = pulse * .3; ellipse(c, 0, 0, 95, 103, '#ffdca2'); c.restore();
      }
      if (stage > 1 && !defeated) {
        c.save(); c.globalAlpha = .35 + Math.sin(t * (stage === 3 ? 7 : 3.5)) * .15;
        for (let i = 0; i < 3; i++) {
          const angle = -2.2 + i * 1.1 + Math.sin(t * .8 + i) * .06;
          const worn = i < stage - 1;
          line(c, [[Math.cos(angle) * 52, Math.sin(angle) * 52 - 12], [Math.cos(angle) * (worn ? 60 : 72), Math.sin(angle) * (worn ? 60 : 72) - 12]], worn ? '#8ea59b' : '#ffcf8f', worn ? 2 : 3.4);
        }
        c.restore();
      }
      c.save(); c.globalAlpha = .1; ellipse(c, 0, 0, 103, 112, vulnerable ? '#ffd6a4' : '#a8c8c8'); c.restore();
      for (const side of [-1, 1]) { c.save(); c.scale(side, 1); c.rotate(wing); c.fillStyle = '#314958'; c.beginPath(); c.moveTo(25, -25); c.bezierCurveTo(69, -49, 96, -43, 111, -57); c.bezierCurveTo(103, -4, 81, 35, 43, 42); c.lineTo(18, 8); c.fill(); for (let i = 0; i < 4; i++) line(c, [[41 + i * 13, -24 - i * 4], [52 + i * 11, -14 - i * 2], [48 + i * 9, 22 - i * 6]], i % 2 ? '#5d7477' : '#79928a', 3); c.restore(); }
      ellipse(c, 0, 5, 48, 59, defeated ? '#879d93' : b.hitFlash > 0 ? '#bda994' : '#47616a'); ellipse(c, 0, 12, 31, 41, defeated ? '#bdc7aa' : '#70827c');
      for (let i = 0; i < 3; i++) { line(c, [[-21 + i * 5, 9 + i * 12], [0, 19 + i * 12], [21 - i * 5, 9 + i * 12]], '#405762', 3); }
      leaf(c, -30, -29, 36, -.3, '#5e7578'); leaf(c, 30, -29, 36, .3, '#5e7578');
      c.fillStyle = '#afbeaa'; c.beginPath(); c.moveTo(-45, -48); c.bezierCurveTo(-19, -56, -12, -43, 0, -34); c.bezierCurveTo(12, -43, 19, -56, 45, -48); c.bezierCurveTo(44, -2, 13, 3, 0, -10); c.bezierCurveTo(-13, 3, -44, -2, -45, -48); c.fill();
      for (const side of [-1, 1]) {
        ellipse(c, side * 21, -29, 16, 19, '#233744');
        c.strokeStyle = vulnerable || defeated ? '#f4c77e' : warning ? '#efac94' : '#799b96'; c.lineWidth = 2.4; c.beginPath(); c.arc(side * 21, -29, 12, -.6, 4.4); c.stroke();
        if (sleeping || defeated) { c.strokeStyle = defeated ? '#ffe8b5' : '#a2b6a5'; c.lineWidth = 2.5; c.beginPath(); c.arc(side * 21, defeated ? -25 : -32, 6, defeated ? Math.PI + .2 : .2, defeated ? TAU - .2 : Math.PI - .2); c.stroke(); }
        else { ellipse(c, side * 21, -29, vulnerable ? 5 : 3.3, 8, vulnerable ? '#ffdb94' : warning ? '#ffb498' : '#cce5c1'); ellipse(c, side * 21 - 1, -32, 1.5, 2, '#fff0c6'); }
      }
      c.fillStyle = '#ddb487'; c.beginPath(); c.moveTo(-7, -22); c.lineTo(0, -8); c.lineTo(8, -22); c.lineTo(0, -27); c.fill();
      c.strokeStyle = '#a9baa2'; c.lineWidth = 3; c.beginPath(); c.arc(0, -53, 17, Math.PI, TAU); c.stroke(); star(c, 0, -60, 7, vulnerable ? '#ffe1a0' : '#94ada1');
      for (const side of [-1, 1]) { ellipse(c, side * 21, 61, 14, 5, '#a9b8a3'); line(c, [[side * 21 - 5, 58], [side * 21 - 5, 64]], '#5a7474', 2); line(c, [[side * 21 + 3, 58], [side * 21 + 3, 64]], '#5a7474', 2); }
      if (vulnerable) { c.strokeStyle = '#f5cb854a'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 83, t, t + 4.5); c.stroke(); for (let i = 0; i < 4; i++) star(c, Math.sin(t * 1.3 + i * 1.57) * 79, Math.cos(t * 1.3 + i * 1.57) * 79, 4, '#f5cb85'); }
      if (defeated) { star(c, 0, -92 + Math.sin(t * 2) * 3, 15, '#ffe5a7', t * .2); for (let i = 0; i < 6; i++) { c.save(); c.globalAlpha = .7; star(c, Math.sin(i * 2.4 + t * .7) * 63, -25 - ((t * 12 + i * 21) % 100), 2.4, '#ffe5a7', t); c.restore(); } }
      c.restore();
    }
    projectile(c, s, t) {
      const color = s.friendly ? '#ffce93' : '#eda3b2', r = s.r || 8;
      if (s.kind === 'wave') {
        // A low ground ripple, drawn flat so it always reads as jumpable.
        c.save(); c.translate(s.x, s.y);
        for (let i = 0; i < 3; i++) { c.save(); c.globalAlpha = .5 - i * .13; c.strokeStyle = '#f3c3a8'; c.lineWidth = 3 - i; c.beginPath(); c.ellipse(0, 4, r * (1 + i * .5), r * (.45 + i * .12), 0, Math.PI, TAU); c.stroke(); c.restore(); }
        ellipse(c, 0, 2, r * .9, r * .5, '#f6cdae'); star(c, 0, -2, r * .6, '#fff1d2', t * 3); c.restore(); return;
      }
      if (s.kind === 'rain') {
        // Falling light: a bright shard with a long tail, unmistakable from above.
        c.save(); c.translate(s.x, s.y); ellipse(c, 0, -r * 1.9, r * .5, r * 2.1, '#ffd9a53a');
        c.fillStyle = '#ffdca6'; c.beginPath(); c.moveTo(0, r * 1.2); c.lineTo(-r * .62, -r * .4); c.lineTo(0, -r * 1.1); c.lineTo(r * .62, -r * .4); c.closePath(); c.fill();
        star(c, 0, 0, r * .55, '#fff6de', t * 5); c.restore(); return;
      }
      c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy || 0, s.vx || 0)); ellipse(c, -r * .9, 0, r * 2, r * .55, color + '33'); ellipse(c, -r * .2, 0, r * 1.2, r * .82, color); ellipse(c, r * .1, -1, r * .65, r * .55, '#fff0bd'); if (!s.friendly) star(c, 0, 0, r * 1.3, '#f8c7c7', t * 4); c.restore();
    }
    particle(c, a) {
      const alpha = Math.max(0, Math.min(1, (a.life || 0) / (a.maxLife || 1))); if (alpha <= 0) return;
      c.save(); c.globalAlpha = alpha; const size = Math.max(.1, a.size || 3), color = a.color || '#fae8b5';
      const spin = (a.life || 0) * 5;
      if (a.type === 'star' || a.type === 'spark') star(c, a.x, a.y, size * (.5 + alpha * .5), color, (a.life || 0) * 3);
      else if (a.type === 'leaf') leaf(c, a.x, a.y, size * 1.4, spin, color);
      else if (a.type === 'petal') { ellipse(c, a.x, a.y, size * 1.5, size * .7, color, spin); ellipse(c, a.x, a.y, size * .5, size * .3, '#fff6e2', spin); }
      else if (a.type === 'ember') { c.shadowColor = color; c.shadowBlur = 6; ellipse(c, a.x, a.y, size * .75, size * (1.1 + alpha * .5), color, Math.atan2(a.vy || 1, a.vx || 0)); c.shadowBlur = 0; }
      else if (a.type === 'flake') { star(c, a.x, a.y, size * 1.1, color, spin); c.strokeStyle = color; c.lineWidth = .9; for (let i = 0; i < 3; i++) { const ang = spin + i * Math.PI / 3; line(c, [[a.x - Math.cos(ang) * size, a.y - Math.sin(ang) * size], [a.x + Math.cos(ang) * size, a.y + Math.sin(ang) * size]], color, .9); } }
      else if (a.type === 'bubble') { c.strokeStyle = color; c.lineWidth = 1.2; c.beginPath(); c.arc(a.x, a.y, size, 0, TAU); c.stroke(); ellipse(c, a.x - size * .3, a.y - size * .3, size * .28, size * .22, '#ffffffcc'); }
      else if (a.type === 'trail') { c.globalAlpha *= .7; ellipse(c, a.x, a.y, size * (.6 + alpha), size * .55, color); }
      else if (a.type === 'stone') { c.save(); c.translate(a.x, a.y); c.rotate(spin); rounded(c, -size * .6, -size * .5, size * 1.2, size, size * .3, color); c.restore(); }
      else if (a.type === 'ring') { c.strokeStyle = color; c.lineWidth = Math.max(1, size * .13); c.beginPath(); c.arc(a.x, a.y, size * (2 - alpha), 0, TAU); c.stroke(); }
      else ellipse(c, a.x, a.y, size * (.5 + alpha * .5), size * (.5 + alpha * .5), color);
      c.restore();
    }
    secret(c, s, t, p) {
      c.save(); c.globalAlpha = .14 + Math.sin(t * 2) * .06;
      for (let i = 0; i < 4; i++) star(c, s.x + seed(i + s.x) * s.w, s.y + seed(i + s.y) * s.h, 4, p.glow, t * .2); c.restore();
    }
    water(c, water, cameraX, t, p) {
      const y = water.y ?? 590, left = Math.max(cameraX - 20, water.start ?? -Infinity), right = Math.min(cameraX + this.worldWidth + 20, water.end ?? Infinity);
      if (right <= left) return;
      c.save(); c.beginPath(); c.rect(left, y - 5, right - left, 910 - y); c.clip();
      const fill = c.createLinearGradient(0, y, 0, y + 240); fill.addColorStop(0, '#96dec925'); fill.addColorStop(1, '#1c6f8a99'); c.fillStyle = fill; c.fillRect(left, y, right - left, 900 - y);
      c.strokeStyle = '#d5f8d7aa'; c.lineWidth = 2; c.beginPath(); for (let j = 0; j <= right - left + 8; j += 8) { const x = left + j; j ? c.lineTo(x, y + Math.sin(x * .025 + t * 2.5) * 3) : c.moveTo(x, y); } c.stroke();
      for (let i = 0; i < 11; i++) { const x = cameraX + ((i * 139 + t * 13) % 1380), yy = y + 12 + seed(i + 339) * 180; line(c, [[x, yy], [x + 17 + seed(i) * 19, yy]], '#c4f3dd25', 2); } c.restore();
    }
    foreground(c, t, cameraX, p, theme) {
      if (theme === 'sky') return;
      c.save(); c.globalAlpha = .55;
      const gap = 480, offset = cameraX * 1.14;
      for (let i = Math.floor(offset / gap) - 1; i < Math.floor(offset / gap) + 4; i++) {
        const x = i * gap - offset + seed(i + 749) * 140;
        const y = 750, height = 65 + seed(i + 391) * 85;
        if (theme === 'cavern' || theme === 'frost') { this.crystal(c, x, y, height, p.dark); this.crystal(c, x + 30, y + 10, height * .7, p.rock); }
        else { line(c, [[x, y], [x + 15, y - height * .5], [x + 3 + Math.sin(t + i) * 3, y - height]], p.dark, 3); for (let j = 0; j < 4; j++) { leaf(c, x + j * 3, y - j * height / 5, 28 - j * 3, j % 2 ? .8 : -.9, p.dark); } }
      }
      c.restore();
    }
  }
  window.LumenRenderer = LumenRenderer;
})();
