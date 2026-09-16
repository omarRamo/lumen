(function (global) {
  'use strict';
  const ground = (x, width, y = 600) => ({ x, y, w: width, h: 900 - y, type: 'ground' });
  const ledge = (x, y, width = 160, type = 'solid', extra = {}) => ({ x, y, w: width, h: 22, type, ...extra });
  const notes = (x, y, count, step = 42, rise = 0) => Array.from({ length: count }, (_, index) => ({
    type: 'coin', x: x + index * step, y: y - Math.sin(index / Math.max(1, count - 1) * Math.PI) * rise
  }));
  const light = (id, name, x, y, color, voice) => ({ id, name, x, y, color, voice });
  const ISLANDS = [
    {
      key: 'chant-petits-matins', name: 'L’île des petits matins', subtitle: 'Quelque part, le ciel a perdu sa voix.',
      theme: 'meadow', width: 4200, accent: '#ee825e', sky: 'dawn', medalTargets: { gold: 145, silver: 240 },
      spawn: { x: 170, y: 554 },
      platforms: [
        ground(0, 980), ground(1150, 900, 590), ground(2260, 780, 560), ground(3250, 950),
        ledge(420, 500), ledge(610, 420, 200), ledge(1250, 500, 180), ledge(1460, 415),
        ledge(1660, 340, 205), ledge(2440, 465, 175), ledge(2660, 375, 190),
        ledge(3400, 505, 160), ledge(3590, 420, 180)
      ],
      collectibles: [
        ...notes(290, 548, 7, 43), ...notes(445, 455, 4), ...notes(645, 370, 4),
        ...notes(890, 488, 8, 43, 55), ...notes(1290, 450, 4), ...notes(1500, 363, 3),
        ...notes(1700, 294, 4), ...notes(1940, 455, 9, 43, 65), ...notes(2400, 507, 6, 45),
        ...notes(2680, 328, 4), ...notes(2940, 445, 9, 44, 70), ...notes(3430, 452, 3),
        ...notes(3630, 367, 3), ...notes(3860, 546, 5),
        { type: 'star', x: 730, y: 322 }, { type: 'star', x: 2800, y: 270 }, { type: 'star', x: 3690, y: 322 }
      ],
      lights: [light('pip', 'Pip', 705, 535, '#f7c75f', 0), light('sao', 'Sao', 1770, 285, '#f48b82', 2), light('milo', 'Milo', 3490, 543, '#6ee0c2', 4)],
      wind: [{ x: 2080, y: 240, w: 170, h: 440 }],
      wakeables: [
        { type: 'bloom', x: 1330, y: 575, id: 'matins-fleur' },
        { type: 'chime', x: 1990, y: 485, id: 'matins-cloche' },
        { type: 'bridge', x: 2140, y: 558, span: 290, id: 'matins-pont' }
      ],
      checkpoints: [{ x: 1270, y: 590 }, { x: 2390, y: 560 }, { x: 3380, y: 600 }],
      scenery: [
        { type: 'tree', x: 88, y: 600, size: 1.3 }, { type: 'arch', x: 900, y: 600, size: 1.25 },
        { type: 'tree', x: 1390, y: 590, size: .8 }, { type: 'arch', x: 2850, y: 560, size: .8 },
        { type: 'tree', x: 3770, y: 600, size: 1.15 }
      ]
    },
    {
      key: 'chant-recifs-ciel', name: 'Les récifs du ciel', subtitle: 'Les îles se rapprochent quand on les écoute.',
      theme: 'sky', width: 4700, accent: '#e988a0', sky: 'noon', medalTargets: { gold: 170, silver: 275 },
      spawn: { x: 130, y: 554 },
      platforms: [
        ground(0, 820), ground(1110, 790, 560), ground(2320, 680, 530), ground(3370, 580, 590), ground(4150, 550),
        ledge(380, 490, 170), ledge(590, 410, 190), ledge(1240, 465), ledge(1450, 365, 190),
        ledge(1720, 285, 160), ledge(2070, 325, 190), ledge(2480, 430, 180),
        ledge(2710, 330, 200), ledge(3060, 430, 175, 'moving', { axis: 'y', range: 30, speed: .6 }),
        ledge(3510, 490), ledge(3730, 390, 175), ledge(4240, 490, 175)
      ],
      collectibles: [
        ...notes(220, 548, 6, 43), ...notes(412, 440, 3), ...notes(620, 357, 4),
        ...notes(775, 448, 9, 44, 85), ...notes(1270, 416, 3), ...notes(1475, 314, 4),
        ...notes(1750, 235, 3), ...notes(1890, 239, 10, 44, 80), ...notes(2505, 380, 4),
        ...notes(2740, 279, 4), ...notes(2940, 375, 11, 44, 75), ...notes(3450, 538, 5),
        ...notes(3760, 340, 3), ...notes(3910, 448, 8, 42, 65), ...notes(4360, 548, 5),
        { type: 'star', x: 1810, y: 184 }, { type: 'star', x: 2830, y: 221 }, { type: 'star', x: 3830, y: 282 }
      ],
      lights: [light('aya', 'Aya', 704, 350, '#ffb861', 1), light('lou', 'Lou', 2160, 265, '#88dbed', 3), light('tika', 'Tika', 3790, 335, '#efa4c7', 5)],
      wind: [{ x: 835, y: 180, w: 230, h: 540 },
        { x: 1930, y: 130, w: 335, h: 570, id: 'recifs-courant', respondsToCall: true, drift: -150 },
        { x: 3010, y: 230, w: 330, h: 470 }],
      wakeables: [{ type: 'bloom', x: 1380, y: 545, id: 'recifs-fleur' }, { type: 'chime', x: 2900, y: 420, id: 'recifs-cloche' }],
      checkpoints: [{ x: 1220, y: 560 }, { x: 2440, y: 530 }, { x: 3460, y: 590 }, { x: 4250, y: 600 }],
      scenery: [
        { type: 'arch', x: 450, y: 600, size: 1 }, { type: 'tree', x: 1480, y: 560, size: .9 },
        { type: 'arch', x: 2800, y: 530, size: 1.45 }, { type: 'tree', x: 3870, y: 590, size: .85 }
      ]
    },
    {
      key: 'chant-grand-chorus', name: 'Le grand chœur', subtitle: 'Même les géants ont besoin d’une petite lumière.',
      theme: 'secret', width: 5100, accent: '#f6bf65', sky: 'sunset', medalTargets: { gold: 195, silver: 310 },
      spawn: { x: 140, y: 554 },
      platforms: [
        ground(0, 900), ground(1130, 730, 560), ground(2380, 750, 570), ground(3440, 650, 540), ground(4320, 780),
        ledge(400, 495), ledge(620, 405, 200), ledge(1260, 460, 180), ledge(1465, 370, 185),
        ledge(1680, 285, 155), ledge(1940, 350, 165), ledge(2200, 310, 180),
        ledge(2500, 475, 180), ledge(2730, 385, 190), ledge(2960, 295, 155),
        ledge(3550, 440, 190), ledge(3770, 350, 190), ledge(4440, 485, 190)
      ],
      collectibles: [
        ...notes(240, 548, 6, 44), ...notes(430, 445, 3), ...notes(650, 354, 4),
        ...notes(850, 467, 8, 44, 65), ...notes(1290, 408, 4), ...notes(1500, 319, 4),
        ...notes(1710, 234, 3), ...notes(1860, 300, 11, 45, 65), ...notes(2530, 423, 4),
        ...notes(2760, 334, 4), ...notes(2990, 244, 3), ...notes(3080, 425, 9, 43, 95),
        ...notes(3585, 388, 4), ...notes(3800, 298, 4), ...notes(4020, 425, 9, 44, 75),
        ...notes(4470, 433, 4), ...notes(4730, 548, 6, 42),
        { type: 'star', x: 1790, y: 181 }, { type: 'star', x: 3030, y: 192 }, { type: 'star', x: 3900, y: 240 }
      ],
      lights: [light('sol', 'Sol', 740, 350, '#f3bd64', 0),
        { ...light('neve', 'Nève', 2280, 252, '#aff0df', 3), roam: { x: 1990, y: 294, speed: 90 } },
        light('orion', 'Orion', 3860, 293, '#ffb1b1', 6)],
      wind: [{ x: 1920, y: 175, w: 400, h: 525 }, { x: 3150, y: 180, w: 270, h: 520 }, { x: 4100, y: 260, w: 180, h: 450 }],
      wakeables: [
        { type: 'chime', x: 1820, y: 360, id: 'choeur-cloche-a' },
        { type: 'chime', x: 2010, y: 300, id: 'choeur-cloche-b' },
        { type: 'chime', x: 2190, y: 260, id: 'choeur-cloche-c' },
        { type: 'bridge', x: 2120, y: 552, span: 570, id: 'choeur-pont' },
        { type: 'bloom', x: 2640, y: 555, id: 'choeur-fleur' }
      ],
      checkpoints: [{ x: 1240, y: 560 }, { x: 2480, y: 570 }, { x: 3540, y: 540 }, { x: 4430, y: 600 }],
      scenery: [
        { type: 'tree', x: 70, y: 600, size: 1.4 }, { type: 'arch', x: 1510, y: 560, size: 1.1 },
        { type: 'tree', x: 2850, y: 570, size: 1.2 }, { type: 'arch', x: 3890, y: 540, size: 1.1 },
        { type: 'tree', x: 4900, y: 600, size: 1.8 }
      ]
    }
  ];

  // The first island remains a short introduction. The next two open into
  // a second archipelago: climb, glide, a sheltered grove, then one last voice.
  for (const [index, island] of ISLANDS.entries()) {
    if (!index) continue;
    const start = island.width - 80;
    const terraces = index === 1
      ? [[0,450,600],[560,360,520],[1030,380,440],[1520,380,360],[2010,430,440],[2550,430,520],[3090,480,600],[3680,600,600]]
      : [[0,420,600],[540,370,510],[1030,370,420],[1520,380,330],[2020,430,420],[2570,400,510],[3090,480,600],[3680,600,600]];
    island.originalWidth = island.width;
    island.width = start + 4280;
    island.medalTargets.gold += 80; island.medalTargets.silver += 115;
    island.continuation = { start, route: [] };
    for (const [i, [x, width, y]] of terraces.entries()) {
      island.platforms.push(ground(start + x, width, y));
      island.collectibles.push(...notes(start + x + 35, y - 50, 8, (width - 70) / 7));
      island.continuation.route.push([start + x + width * .55, y]);
      if ([0,4,7].includes(i)) island.checkpoints.push({ x: start + x + 100, y });
      if ([0,3,6].includes(i)) island.scenery.push({ type: i === 3 ? 'arch' : 'tree', x: start + x + width * .65, y, size: i === 3 ? 1.4 : .9 });
    }
    const third = island.lights[2];
    Object.assign(third, { x: start + 3280, y: 440 });
    island.platforms.push(ledge(start + 3190, 495, 240));
    Object.assign(island.collectibles.filter(c => c.type === 'star').at(-1), { x: start + 3350, y: 395 });
    island.continuation.route.splice(7, 0, [start + 3280,495,third.id], [start + 3350,415]);
    island.continuation.route.push([island.width - 130,600]);
    island.wind.push({ x: start + 1910, y: 260, w: 100, h: 410 });
    island.wakeables.push({ type: 'bloom', x: start + 2160, y: terraces[4][2] - 15, id: island.key + '-bosquet' },
      { type: 'chime', x: start + 1600, y: terraces[3][2] - 60, id: island.key + '-carillon' });
  }

  function create(index, style = 'gentle') {
    if (!Number.isInteger(index) || !ISLANDS[index]) return null;
    const island = JSON.parse(JSON.stringify(ISLANDS[index]));
    const song = { index, style: style === 'flow' ? 'flow' : 'gentle', lights: island.lights,
      wind: island.wind, scenery: island.scenery, sky: island.sky, accent: island.accent };
    return { ...island, id: -1, height: 900, song, goal: 'Retrouver les trois échos.',
      exit: { x: island.width - 185, y: 470, w: 95, h: 130, open: false },
      enemies: [], hazards: [], secrets: [], hints: [] };
  }

  class Journey {
    constructor(data) {
      this.index = data.index; this.style = data.style;
      this.lights = data.lights.map(entry => ({ ...entry, found: false, followX: entry.x, followY: entry.y,
        originX: entry.x, originY: entry.y, motion: 0, drift: 0 }));
      this.wind = data.wind.map(current => ({ ...current }));
      this.count = 0; this.combo = 0; this.comboTime = 0; this.bestCombo = 0;
      this.bloom = 0; this.celebration = 0; this.safe = null; this.returnPoint = null;
      this.trail = []; this.trailTime = 0; this.airNotes = 0;
    }
    note(game, note) {
      this.combo++; this.comboTime = this.style === 'flow' ? 2.5 : 4;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      game.addScore(Math.min(8, Math.ceil(this.combo / 5)) * 10);
      if (!game.player.grounded) {
        game.player.airJumps = 0; this.airNotes++;
        game.burst(note.x, note.y, 5, '#d0fff1', 70, 'trail');
      }
      game.audio.songNote?.(this.combo - 1, Math.max(-.7,Math.min(.7,(note.x-game.player.x-16)/220)));
    }
    update(game, dt) {
      this.comboTime = Math.max(0, this.comboTime - dt);
      if (!this.comboTime) this.combo = 0;
      this.celebration = Math.max(0, this.celebration - dt);
      this.bloom += (this.count / this.lights.length - this.bloom) * (1 - Math.exp(-dt * 1.8));
      const player = game.player, standing = player.standingPlatform;
      for (const current of this.wind) {
        if (!current.respondsToCall) continue;
        const key = 'wind:' + current.id;
        for (const wave of game.waves) {
          if (wave.source !== 'player' || wave.touched.has(key)) continue;
          const nearestX = Math.max(current.x, Math.min(wave.x, current.x + current.w));
          const nearestY = Math.max(current.y, Math.min(wave.y, current.y + current.h));
          if (Math.hypot(nearestX - wave.x, nearestY - wave.y) > wave.radius) continue;
          current.drift *= -1; wave.touched.add(key);
          game.burst(nearestX, nearestY, 12, '#e5f5c5', 80, 'leaf');
        }
      }
      if (player.grounded && standing && standing.type === 'ground' &&
          player.x > standing.x + 20 && player.x + player.w < standing.x + standing.w - 20) {
        this.safe = { x: player.x, y: standing.y - 48 };
      }
      for (const echo of this.lights) {
        if (echo.found) continue;
        if (echo.roam) {
          const spanX = echo.roam.x - echo.originX, spanY = echo.roam.y - echo.originY;
          const distance = Math.hypot(spanX, spanY);
          echo.motion = (echo.motion + dt * echo.roam.speed / distance) % 2;
          const fraction = echo.motion <= 1 ? echo.motion : 2 - echo.motion;
          echo.x = echo.originX + spanX * fraction; echo.y = echo.originY + spanY * fraction;
          echo.drift = (echo.motion < 1 ? 1 : -1) * spanX / distance;
        }
        if (!game.waves.some(wave => Math.hypot(echo.x - wave.x, echo.y - wave.y) <= wave.radius)) continue;
        echo.found = true; this.count++; this.celebration = 2.5;
        game.addScore(750); game.burst(echo.x, echo.y, 38, echo.color, 170, 'petal');
        game.audio.rescue?.(echo.voice, Math.max(-.7,Math.min(.7,(echo.x-player.x-16)/220)), this.count);
        game.store.discover('creatures', 'chant-' + echo.id); game.saveProgress();
        game.emit('song-rescue', echo);
        if (this.count === this.lights.length) {
          game.exit.open = true; game.audio.sfx('secret');
          game.burst(player.x + 16, player.y, 55, '#fff4c8', 240, 'spark');
        }
      }
      let followX = player.x + player.w / 2 - player.facing * 44;
      let followY = player.y + 2;
      for (const echo of this.lights.filter(entry => entry.found)) {
        echo.followX += (followX - echo.followX) * (1 - Math.exp(-dt * 5));
        echo.followY += (followY - echo.followY) * (1 - Math.exp(-dt * 5));
        followX = echo.followX - player.facing * 30; followY = echo.followY - 10;
      }
      this.trailTime -= dt;
      if (this.trailTime <= 0) {
        this.trailTime = .045;
        this.trail.push({ x: player.x + 16, y: player.y + 24 });
        if (this.trail.length > 16) this.trail.shift();
      }
      game.audio.setSongLayer?.(this.bloom * .65 + Math.min(1, this.combo / 20) * .35);
    }
    nearest(player) {
      return this.lights.filter(entry => !entry.found).sort((first, second) =>
        Math.hypot(first.x - player.x, first.y - player.y) - Math.hypot(second.x - player.x, second.y - player.y))[0] || null;
    }
  }
  global.LumenSong = { ISLANDS, create, Journey };
})(typeof window !== 'undefined' ? window : globalThis);