/* LUMEN — original procedural artwork. All drawing uses world-space coordinates.
   The renderer is deliberately read-only: animation derives from game time. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const Art = window.LumenArt;
  const seed = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mix = (a, b, t) => a + (b - a) * t;
  function ellipse(c, x, y, rx, ry, color, rotation = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rotation, 0, TAU); if (color) { c.fillStyle = color; c.fill(); } }
  function line(c, pts, color, width = 2) { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.stroke(); }
  function rounded(c, x, y, w, h, r, color) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = color; c.fill(); }
  function star(c, x, y, size, color, turn = 0) { c.save(); c.translate(x, y); c.rotate(turn); c.fillStyle = color; c.beginPath(); c.moveTo(0, -size); c.quadraticCurveTo(size * .16, -size * .16, size, 0); c.quadraticCurveTo(size * .16, size * .16, 0, size); c.quadraticCurveTo(-size * .16, size * .16, -size, 0); c.quadraticCurveTo(-size * .16, -size * .16, 0, -size); c.fill(); c.restore(); }
  const leaf = Art.leaf;
  /** Issue 6 : tout ce qui fait mal porte le même code, et rien d'autre ne le
   *  porte. Un cramoisi qu'aucune palette de décor n'emploie (leurs « corail »
   *  sont saumon, pêche ou rose), une encre sombre, et un anneau qui respire. */
  const DANGER = { body: '#c73a48', light: '#f06a74', ink: '#2e1119', glow: '#ff5263' };
  function dangerRing(c, w, t, phase = 0) {
    const pulse = .5 + Math.sin(t * 5 + phase) * .5;
    c.save(); c.globalAlpha = .4 + pulse * .35; c.strokeStyle = DANGER.glow; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(0, 2, w * .62 + pulse * 4, 6 + pulse * 1.5, 0, 0, TAU); c.stroke(); c.restore();
  }

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
      return Art.campaignPalette(theme);
    }
    resize(width, height) {
      this.width = Math.max(1, width); this.height = Math.max(1, height);
      this.dpr = Math.min(window.devicePixelRatio || 1, window.LumenPlatform?.native || window.LumenTouch?.enabled ? 1.5 : 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.updateViewport(this.sceneMode);
    }
    updateViewport(mode) {
      this.sceneMode = mode;
      if (mode === 'home' || mode === 'map') {
        this.worldWidth = 1280;
        this.scale = Math.min(this.width / this.worldWidth, this.height / 720);
        this.offsetX = (this.width - this.worldWidth * this.scale) / 2;
        this.offsetY = (this.height - 720 * this.scale) / 2;
      } else {
        const view = window.LumenPlayView(this.width, this.height);
        this.scale = view.scale; this.worldWidth = view.worldWidth; this.offsetX = 0; this.offsetY = view.offsetY;
      }
    }
    createSky(theme, palette) {
      const surface = document.createElement('canvas'); surface.width = 1280; surface.height = 720;
      const c = surface.getContext('2d');
      Art.sky(c, 1280, 720, palette);
      this.skyCache.set(theme + ':' + (window.LumenAppearance?.current || 'light'), surface); return surface;
    }
    draw(game, dt) {
      if (game.song && window.LumenSongArt) return window.LumenSongArt.draw(this, game);
      const c = this.ctx, level = game.level || {}, theme = level.theme || 'meadow', p = LumenRenderer.palette(theme), t = game.time || 0;
      this.updateViewport(game.mode || 'home');
      this.palette = p; this.time = t; this.theme = theme; this.echoTime = game.echoTime || 0;
      const assetKey = 'classic:' + level.key + ':' + (p.night ? 'night' : 'day');
      if (this.songKey !== assetKey) { this.songKey = assetKey; this.songAssets = new Map(); }
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.fillStyle = p.sky[0]; c.fillRect(0, 0, this.width, this.height);
      const cam = game.camera || { x: 0, y: 0 }, cameraX = cam.x || 0, cameraY = cam.y || 0;
      this.cameraX = cameraX; this.cameraY = cameraY;
      const placeArt = window.LumenPlaceArt;
      const placeBackground = !!placeArt?.background(this, game, p, t);
      if (!placeBackground) this.background(c, theme, p, t, cameraX, game.mode);
      c.save(); c.translate(this.offsetX, this.offsetY); c.scale(this.scale, this.scale);
      const shake = cam.shake || 0;
      c.save(); c.translate(-cameraX + Math.sin(t * 129) * shake, -cameraY + Math.cos(t * 113) * shake * .6);
      if (game.mode === 'home') this.homeGarden(c, t, p);
      if (game.level && game.level.hub) {
        const lit = !!(game.progress && game.progress.hub && game.progress.hub.transformations.includes('coupole-allumee'));
        this.observatory(c, t, p, lit);
      }
      if (game.boss) this.arena(c, game.boss, t, p);
      placeArt?.beforePlatforms(c, game, p, t, this);
      for (const s of game.secrets || []) if (!s.found && this.visible(s)) this.secret(c, s, t, p);
      // Ce qui dort est dessiné SOUS les plateformes : sa silhouette reste
      // visible en permanence, sans jamais masquer une surface jouable.
      for (const w of game.wakeables || []) if (this.visible({ x: w.x - (w.span || 0) / 2 - 40, y: w.y - 40, w: (w.span || 0) + 80, h: 80 }, 60)) this.wakeable(c, w, t, p);
      for (const platform of game.platforms || []) if (this.visible(platform, 100) && !placeArt?.platform(c, platform, p, t, game, this)) this.platform(c, platform, t, p);
      for (const h of game.hazards || []) if (this.visible(h)) this.hazard(c, h, t, p);
      for (const cp of game.checkpoints || []) if (this.visible(cp, 120)) this.checkpoint(c, cp, t, p);
      if (game.exit && this.visible(game.exit, 200)) this.portal(c, game.exit, t, p);
      placeArt?.afterPlatforms(c, game, p, t, this);
      for (const item of game.collectibles || []) if (!item.taken && this.visible(item, 60)) this.collectible(c, item, t, p);
      for (const character of game.characters || []) if (this.visible({ x: character.x - 40, y: character.y - 100, w: 80, h: 100 }, 60)) this.character(c, character, t, p);
      for (const enemy of game.enemies || []) if (enemy.alive !== false && this.visible(enemy, 70) && !(enemy.mount && placeArt && level.place?.kind === 'ride')) this.enemy(c, enemy, t, p);
      if (game.boss && this.visible(game.boss, 180)) this.boss(c, game.boss, t, p);
      for (const shot of game.projectiles || []) if (this.visible(shot, 60)) this.projectile(c, shot, t);
      if (game.player) {
        window.LumenSongArt.drawLumen(c, game.player, t);
        if (game.echoTime > 0) this.echoWave(c, game.player, game.echoTime, t);
      }
      for (const wave of game.waves || []) this.wave(c, wave, t);
      for (const particle of game.particles || []) if (this.visible(particle, 25)) this.particle(c, particle);
      for (const text of game.floatingTexts || []) {
        c.save(); c.globalAlpha = Math.min(1, Math.max(0, text.life || 0)); c.textAlign = 'center';
        c.font = '600 17px ' + (window.LumenI18n?.canvasFont || 'Outfit, sans-serif');
        c.direction = window.LumenI18n?.direction || 'ltr'; c.fillStyle = text.color || p.rim;
        c.fillText(window.LumenI18n?.t(text.text || '') || text.text || '', text.x, text.y); c.restore();
      }
      if (level.water) this.water(c, level.water, cameraX, t, p);
      c.restore();
      if (!placeBackground) this.foreground(c, t, cameraX, p, theme);
      this.waypoint(c, game, p, t);
      if (game.flash && game.flash.life > 0) {
        c.save(); c.globalAlpha = Math.min(.24, (game.flash.life / (game.flash.maxLife || .35)) * .24);
        c.fillStyle = game.flash.color || '#fff2c9'; c.fillRect(0, 0, this.worldWidth, 720); c.restore();
      }
      c.restore();
    }
    visible(object, margin = 50) {
      return (object.x || 0) + (object.w || 0) >= this.cameraX - margin &&
        (object.x || 0) <= this.cameraX + this.worldWidth + margin && (object.y || 0) < this.cameraY + 850;
    }
    background(ctx, theme, palette, time, camera) {
      const backdrop = this.skyCache.get(theme + ':' + (window.LumenAppearance?.current || 'light')) || this.createSky(theme, palette);
      Art.horizon(this, palette, time, camera, this.width, this.height, backdrop);
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
    platform(c, o, t, p) {
      if (o.active === false && o.type === 'crumble') return;
      c.save();
      const fading = o.warning || (o.type === 'echo' && this.echoTime > 0 && this.echoTime < 1);
      if (o.type === 'crumble' && o.crumbleTimer > 0) c.translate(Math.sin(t * 90) * 1.7, 0);
      Art.terrain(this, o, p);
      if (fading) c.globalAlpha *= .45 + Math.abs(Math.sin(t * 11)) * .55;
      if (o.type === 'vanish' && o.active) c.globalAlpha *= .45 + .55 * Math.abs(Math.sin((o.phase || 0) + t * 3));
      if (o.active !== false) Art.platformMarks(c, o, p, t);
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

      for (let facet = 0; facet < 8; facet++) {
        const start = Math.PI + facet * Math.PI / 8, end = start + Math.PI / 8;
        c.save(); c.globalAlpha = lit ? .2 : .12;
        Art.path(c, [[cx, 400], [cx + Math.cos(start) * 245, 400 + Math.sin(start) * 245],
          [cx + Math.cos(end) * 245, 400 + Math.sin(end) * 245]], facet % 2 ? p.facet : p.grass);
        c.restore();
      }
      c.strokeStyle = lit ? p.stone : p.facet; c.lineWidth = 13; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(cx - 250, base); c.lineTo(cx - 250, 400);
      c.arc(cx, 400, 250, Math.PI, TAU); c.lineTo(cx + 250, base); c.stroke();
      c.strokeStyle = lit ? p.rim : p.stone; c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx - 242, base); c.lineTo(cx - 242, 400);
      c.arc(cx, 400, 242, Math.PI, TAU); c.lineTo(cx + 242, base); c.stroke();
      // Les nervures de la coupole. Allumées, elles portent chacune une lumière.
      for (let i = 0; i <= 8; i++) {
        const angle = Math.PI + i * Math.PI / 8;
        const x1 = cx + Math.cos(angle) * 242, y1 = 400 + Math.sin(angle) * 242;
        line(c, [[cx, 400], [x1, y1]], (lit ? p.rim : p.facet) + '77', 2);
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
        const y = h.y + Math.sin(t * 2 + h.x) * 2, gradient = c.createLinearGradient(0, y, 0, y + h.h); gradient.addColorStop(0, '#ffdb94'); gradient.addColorStop(.12, '#fa9673'); gradient.addColorStop(1, '#a75065'); c.fillStyle = gradient; c.beginPath(); c.moveTo(h.x, y); for (let j = 0; j <= h.w; j += 12) c.lineTo(h.x + j, y + Math.sin(j * .04 + t * 3) * 3); c.lineTo(h.x + h.w, y + h.h); c.lineTo(h.x, y + h.h); c.fill(); c.save(); c.globalAlpha = .55 + Math.sin(t * 4 + h.x) * .25; line(c, [[h.x, y], [h.x + h.w, y]], DANGER.glow, 3); c.restore(); for (let j = 0; j < h.w / 80; j++) { const xx = h.x + 25 + j * 80, yy = y - (t * 19 + j * 26) % 67; c.save(); c.globalAlpha = Math.max(0, 1 - (y - yy) / 67) * .6; ellipse(c, xx + Math.sin(t + j) * 12, yy, 2.4, 2.4, '#ffdba6'); c.restore(); }
      } else {
        // Des dents sombres à cœur cramoisi sur un socle qui rougeoie : rien du
        // décor — ni cristal, ni fleur — n'a cette forme ni cette couleur.
        const pulse = .5 + Math.sin(t * 4 + h.x) * .5, base = h.y + h.h;
        c.save(); c.globalAlpha = .25 + pulse * .25; rounded(c, h.x - 5, base - 7, h.w + 10, 10, 5, DANGER.glow); c.restore();
        rounded(c, h.x, base - 5, h.w, 5, 2, DANGER.ink);
        for (let x = h.x; x < h.x + h.w - 2; x += 14) {
          const ww = Math.min(14, h.x + h.w - x), top = h.y - 4;
          c.fillStyle = DANGER.ink; c.beginPath(); c.moveTo(x, base - 3); c.lineTo(x + ww / 2, top); c.lineTo(x + ww, base - 3); c.closePath(); c.fill();
          c.fillStyle = DANGER.body; c.beginPath(); c.moveTo(x + ww * .28, base - 4); c.lineTo(x + ww / 2, top + 4); c.lineTo(x + ww * .72, base - 4); c.closePath(); c.fill();
          ellipse(c, x + ww / 2, top + 3, 1.4, 1.4, DANGER.light);
        }
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
    /** Une balise au bord de l'écran quand ce que la sortie attend est sorti du
     *  champ. Elle donne une direction, jamais un chemin : le trajet, les sauts
     *  et les détours restent entiers. Elle disparaît dès que la chose est
     *  visible, et n'existe pas du tout dans un lieu sans condition. */
    waypoint(c, game, p, t) {
      const aim = window.LumenPlaces?.objective?.(game);
      if (!aim || aim.done || !aim.target || game.mode !== 'playing') return;
      const margin = 42, x = aim.target.x - this.cameraX;
      if (x > margin && x < this.worldWidth - margin) return;
      const side = x <= margin ? -1 : 1;
      const edge = side < 0 ? margin : this.worldWidth - margin;
      const y = Math.max(130, Math.min(610, aim.target.y - this.cameraY));
      const pulse = .74 + Math.sin(t * 3.4) * .26;
      c.save(); c.translate(edge, y);
      c.globalAlpha = .93;
      rounded(c, -27, -17, 54, 34, 17, p.rim || '#f6f2dc');
      c.strokeStyle = (p.dark || '#1d4147') + '3d'; c.lineWidth = 1.4;
      c.beginPath(); c.roundRect(-27, -17, 54, 34, 17); c.stroke();
      star(c, -side * 9, 0, 7.5, p.accent, t * .7);
      c.globalAlpha = pulse;
      c.strokeStyle = p.rock || '#3f6d70'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(side * 9, -7); c.lineTo(side * 16, 0); c.lineTo(side * 9, 7); c.stroke();
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
        Art.note(c, 0, 0, p);
      } else if (ty === 'star') {
        c.rotate(Math.sin(t) * .12); c.shadowColor = '#ffcf6f'; c.shadowBlur = 14; star(c, 0, 0, 19, '#f5c772'); c.shadowBlur = 0; star(c, 0, 0, 12, '#ffebaa'); ellipse(c, -3, -2, 1.3, 2, '#94764a'); ellipse(c, 3, -2, 1.3, 2, '#94764a'); c.strokeStyle = '#a88d5b'; c.lineWidth = 1; c.beginPath(); c.arc(0, 1, 3, .2, Math.PI - .2); c.stroke(); c.strokeStyle = p.accent + '44'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 26, t, t + 4); c.stroke();
      } else if (ty === 'life') {
        Art.life(c, 0, 0);
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
      // Seul un dormeur endormi ou apaisé se touche sans danger : il n'a pas d'anneau.
      if (!(e.type === 'sleeper' && (e.state === 'sleep' || e.state === 'calm'))) dangerRing(c, w, t, e.phase || 0);
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
        Art.facetedOval(c, 0, -13 - breath, 22, 14 + breath, p.leaf, p.lightLeaf);
        Art.facetedOval(c, 0, -16 - breath, 20, 12, p.lightLeaf, p.grass);
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
          Art.facetedOval(c, x, y, 4.2, 4.2, e.state === 'hunt' ? DANGER.light : DANGER.body, p.rim);
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
        ellipse(c, -11, -3, 9, 5, p.leaf); ellipse(c, 11, -3, 9, 5, p.leaf);
        Art.facetedOval(c, 0, -16, 18, 17, DANGER.body, DANGER.light); Art.facetedOval(c, 0, -19, 14, 12, DANGER.light, p.rim);
        leaf(c, -6, -29, 12, -.7, '#a4c4a2'); leaf(c, 4, -30, 14, .3, '#d0d6aa'); ellipse(c, 0, -19, 7.8, 8.5, '#3c5152'); ellipse(c, facing * 2, -20, 3.2, 4, '#ffdab0'); ellipse(c, facing * 2.4, -21, 1, 1.2, '#fff7cf'); line(c, [[-3, -7], [0, -6], [3, -7]], '#789184', 1.5);
      } else if (e.type === 'turret') {
        leaf(c, -7, 0, 19, -1.1, '#729a8e'); leaf(c, 7, 0, 19, 1, '#90b19b'); rounded(c, -6, -27, 12, 27, 6, '#819f8e');
        c.save(); c.translate(0, -30); c.rotate(Math.sin(phase) * .08); for (let i = 0; i < 6; i++) leaf(c, 0, 5, 18, i * TAU / 6, i % 2 ? DANGER.body : DANGER.ink); Art.facetedOval(c, 0, 0, 13, 12, DANGER.body, DANGER.light); ellipse(c, facing * 5, 0, 7, 7, DANGER.ink); ellipse(c, facing * 7, 0, 3.5, 4.5, '#503f50'); ellipse(c, -5, -5, 1.4, 1.8, '#755b65'); c.restore();
      } else if (e.type === 'chaser') {
        c.translate(0, -h * .5); const wing = Math.sin(t * 18) * 7;
        c.fillStyle = DANGER.body; c.beginPath(); c.moveTo(-3, 4); c.quadraticCurveTo(-29, 5 - wing, -35, -15 - wing); c.quadraticCurveTo(-20, -10, -9, -13); c.quadraticCurveTo(0, -18, 9, -13); c.quadraticCurveTo(20, -10, 35, -15 - wing); c.quadraticCurveTo(29, 5 - wing, 3, 4); c.fill(); Art.facetedOval(c, 0, -4, 12, 12, DANGER.body, DANGER.light); ellipse(c, 0, -4, 8, 7, DANGER.ink); ellipse(c, -3, -4, 2, 3, '#ffddaa'); ellipse(c, 4, -4, 2, 3, '#ffddaa'); leaf(c, -4, -12, 8, -.35, p.rim); leaf(c, 4, -12, 8, .35, p.rim); line(c, [[0, 6], [Math.sin(t * 5) * 7, 16], [0, 21]], DANGER.body, 3);
      } else {
        c.scale(facing, 1); for (let j = 0; j < 3; j++) ellipse(c, -10 + j * 9 + Math.sin(phase * 2 + j) * 2, -2, 4.5, 3, p.leaf); ellipse(c, 0, -10, 20, 9, p.lightLeaf); Art.facetedOval(c, -4, -21, 16, 16, DANGER.body, DANGER.light); ellipse(c, -6, -23, 11, 11, DANGER.body); c.strokeStyle = DANGER.ink; c.lineWidth = 2; c.beginPath(); for (let a = 0; a < TAU * 1.7; a += .15) { const r = a * .8; a ? c.lineTo(-6 + Math.cos(a) * r, -23 + Math.sin(a) * r) : c.moveTo(-6, -23); } c.stroke();
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
      const color = s.friendly ? '#ffce93' : DANGER.light, r = s.r || 8;
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
      c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy || 0, s.vx || 0)); ellipse(c, -r * .9, 0, r * 2, r * .55, color + '33'); ellipse(c, -r * .2, 0, r * 1.2, r * .82, color); ellipse(c, r * .1, -1, r * .65, r * .55, '#fff0bd'); if (!s.friendly) star(c, 0, 0, r * 1.3, DANGER.glow, t * 4); c.restore();
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
