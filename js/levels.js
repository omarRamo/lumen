/* LUMEN — Les jardins de la lune
 * Ten hand-authored routes. Geometry is expressed in world pixels.
 * Platforms use their top-left corner; collectibles use their centre;
 * checkpoints stand on the indicated surface. Every mandatory route is
 * possible without a power-up. Raised routes contain optional moon shards.
 */
(function () {
  'use strict';

  const ground = (x, w, y = 600) => ({ x, y, w, h: 900 - y, type: 'ground' });
  const ledge = (x, y, w = 140, type = 'solid', extra = {}) =>
    ({ x, y, w, h: 22, type, ...extra });
  const enemy = (type, x, surface, minX, maxX) => {
    const w = type === 'swarm' ? 54 : type === 'sleeper' ? 44 : 36;
    const h = type === 'swarm' || type === 'sleeper' ? 36 : 34;
    return { type, x, y: surface - h, w, h, minX, maxX };
  };
  const item = (type, x, y) => ({ type, x, y });
  const coins = (x, y, count = 5, step = 34) =>
    Array.from({ length: count }, (_, i) => item('coin', x + i * step, y));
  const arc = (x, y, count = 5, step = 32) =>
    Array.from({ length: count }, (_, i) =>
      item('coin', x + i * step, y - Math.sin(i / (count - 1) * Math.PI) * 52));
  const checkpoint = (x, y = 600) => ({ x, y });
  /** Un élément que la Résonance réveille. `x`/`y` désignent son cœur — c'est
   *  de là que part la distance à l'onde — et non son coin supérieur gauche.
   *  Un pont précise `span` : la longueur exacte qui apparaîtra. */
  const wake = (type, x, y, extra = {}) => ({ type, x, y, ...extra });
  const secret = (x, y, w, h) => ({ x, y, w, h, found: false });
  const exit = (width, y = 500) => ({ x: width - 150, y, w: 70, h: 100, open: true });
  const spikes = (x, y, w = 70) => ({ x, y: y - 22, w, h: 22, type: 'spikes' });
  const lava = (x, w) => ({ x, y: 638, w, h: 262, type: 'lava' });

  const levels = [
    {
      id: 0, key: 'prairies-aurore', name: 'Les prairies d’aurore', subtitle: 'Un battement d’ailes suffit.',
      medalTargets: { gold: 70, silver: 115 },
      theme: 'meadow', width: 3900, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(3900),
      goal: 'Rallume la première porte des jardins.',
      platforms: [
        ground(0, 950), ground(1060, 780), ground(1960, 860), ground(2960, 940),
        // The first optional staircase teaches small, successive jumps.
        ledge(420, 510, 170), ledge(585, 450, 130), ledge(720, 390, 190),
        ledge(1220, 510, 190),
        ledge(1600, 530, 160, 'moving', { range: 50, speed: 0.75, axis: 'y', phase: 0 }),
        ledge(1990, 510, 150), ledge(2170, 420, 210),
        ledge(2440, 510, 150, 'spring'),
        ledge(3060, 510, 180), ledge(3250, 430, 150), ledge(3390, 350, 180)
      ],
      enemies: [
        enemy('patrol', 670, 600, 610, 880),
        enemy('patrol', 1470, 600, 1420, 1770),
        enemy('patrol', 2390, 600, 2220, 2540),
        enemy('hopper', 3180, 600, 3090, 3370)
      ],
      collectibles: [
        ...coins(230, 550, 5), ...coins(450, 468, 4), ...coins(760, 350, 3),
        ...arc(875, 528, 7), ...coins(1130, 554, 5), ...coins(1510, 480, 4),
        ...arc(1790, 528, 7), ...coins(2025, 464, 4), ...coins(2210, 378, 4),
        ...coins(2570, 550, 5), ...arc(2770, 528, 8), ...coins(3100, 468, 4),
        ...coins(3420, 308, 4), ...coins(3630, 550, 4),
        item('star', 817, 307), item('star', 2310, 337), item('star', 3476, 267),
        item('breeze', 1280, 468), item('bloom', 2080, 550), item('comet', 3080, 550),
        item('heart', 1410, 550), item('heart', 2690, 550)
      ],
      checkpoints: [checkpoint(1340), checkpoint(2660)],
      hazards: [], secrets: [secret(2130, 270, 310, 185)],
      hints: [
        { x: 120, text: 'Q / D ou ← / → pour avancer · Espace pour sauter' },
        { x: 410, text: 'Un appui long donne un saut plus haut. Les éclats de lune sont là-haut !' },
        { x: 790, text: 'Saute sur les créatures. Maintiens Maj pour courir.' },
        { x: 1200, text: 'Plume azur : un second saut en plein vol, le temps du pouvoir.' },
        { x: 1850, text: 'Les lanternes sauvegardent ta position. Explore les chemins en hauteur.' },
        { x: 2020, text: 'Fleur solaire : X ou J lance une étincelle.' },
        { x: 2980, text: 'Comète : X ou J te propulse. ↓ permet de glisser au sol.' }
      ]
    },
    {
      id: 1, key: 'cathedrale-racines', name: 'La cathédrale des racines', subtitle: 'Sous la terre, les étoiles poussent.',
      medalTargets: { gold: 90, silver: 145 },
      theme: 'cavern', width: 4320, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(4320),
      goal: 'Traverse les racines et leurs ponts fragiles.',
      platforms: [
        ground(0, 820), ground(1040, 780), ground(2190, 750), ground(3210, 1110),
        ledge(390, 515, 150), ledge(550, 435, 150), ledge(700, 360, 160),
        ledge(875, 565, 115, 'crumble'),
        ledge(1150, 510, 170), ledge(1370, 430, 180, 'crumble'),
        ledge(1610, 510, 140),
        // Deliberate two-step fragile bridge; no running or buff required.
        ledge(1870, 555, 120, 'crumble'), ledge(2040, 530, 110, 'crumble'),
        ledge(2240, 510, 160), ledge(2430, 430, 150), ledge(2600, 350, 170),
        ledge(2985, 550, 170, 'moving', { range: 25, speed: 0.6, axis: 'x', phase: 1.5 }),
        ledge(3330, 510, 160), ledge(3515, 435, 150), ledge(3690, 360, 180),
        ledge(3910, 485, 170, 'spring'),
        // Echo bridges reveal a quick route to the vault; the stairs remain usable.
        ledge(2330, 395, 130, 'echo'), ledge(2490, 320, 120, 'echo')
      ],
      enemies: [
        enemy('patrol', 260, 600, 200, 580),
        enemy('hopper', 1240, 600, 1110, 1410),
        enemy('turret', 1690, 600, 1690, 1690),
        enemy('patrol', 2420, 600, 2250, 2720),
        enemy('hopper', 3470, 600, 3290, 3590),
        enemy('patrol', 3920, 600, 3800, 4050)
      ],
      collectibles: [
        ...coins(140, 550, 4), ...coins(416, 472, 4), ...coins(730, 318, 4),
        ...arc(780, 494, 7), ...coins(1180, 465, 4), ...coins(1390, 385, 4),
        ...arc(1780, 490, 5), ...arc(1980, 470, 5),
        ...coins(2270, 466, 4), ...coins(2630, 308, 4), ...coins(2760, 550, 4),
        ...arc(2910, 488, 8), ...coins(3360, 466, 4), ...coins(3720, 318, 4),
        ...coins(4030, 550, 4),
        item('star', 790, 277), item('star', 2690, 267), item('star', 3780, 277),
        item('bloom', 1195, 550), item('breeze', 2310, 550), item('comet', 3590, 393),
        item('heart', 1760, 550), item('heart', 3290, 550), item('echo', 2240, 550)
      ],
      checkpoints: [checkpoint(1570), checkpoint(3270)],
      hazards: [spikes(1460, 600, 64), spikes(2760, 600, 68)],
      secrets: [secret(2530, 225, 300, 160)],
      hints: [
        { x: 100, text: 'Les racines gardent des chemins au-dessus du chemin.' },
        { x: 660, text: 'Le bois doré s’effrite : saute avant qu’il ne tombe.' },
        { x: 1220, text: 'Les sentinelles tirent devant elles. Une étincelle ou un saut suffit.' },
        { x: 1680, text: 'Deux petites plateformes, deux sauts. Prends ton temps avant de partir.' },
        { x: 2230, text: 'Grelot d’écho : X révèle les marches de lune pendant quatre secondes.' },
        { x: 3260, text: 'Le dernier éclat se cache près de la voûte.' }
      ]
    },
    {
      id: 2, key: 'lagon-lucioles', name: 'Le lagon des lucioles', subtitle: 'Respire. La lumière sait nager.',
      medalTargets: { gold: 100, silver: 160 },
      theme: 'tide', width: 4400, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(4400),
      goal: 'Remonte le courant et retrouve la rive.',
      water: { y: 430, start: 460, end: 4110 },
      platforms: [
        ground(0, 530), ground(530, 3360, 740), ground(3890, 510),
        ledge(580, 640, 210), ledge(825, 560, 180),
        ledge(1050, 620, 180), ledge(1290, 540, 170),
        ledge(1530, 635, 190), ledge(1780, 550, 180),
        // Air route: a chain of lilies leading above the lagoon.
        ledge(1970, 600, 170), ledge(2160, 515, 160), ledge(2330, 430, 180),
        ledge(2525, 345, 195),
        ledge(2830, 610, 180, 'moving', { range: 40, speed: 0.55, axis: 'y', phase: 2 }),
        ledge(3070, 530, 170), ledge(3260, 620, 160),
        ledge(3480, 540, 170), ledge(3680, 520, 150)
      ],
      enemies: [
        enemy('patrol', 960, 740, 780, 1200),
        enemy('hopper', 1560, 740, 1400, 1760),
        enemy('turret', 2270, 740, 2270, 2270),
        enemy('chaser', 2980, 740, 2750, 3210),
        enemy('patrol', 3590, 740, 3440, 3750)
      ],
      collectibles: [
        ...coins(230, 550, 5), ...coins(610, 590, 4), ...coins(856, 512, 4),
        ...coins(1110, 680, 4), ...coins(1330, 490, 4), ...coins(1580, 685, 4),
        ...coins(1820, 500, 4), ...coins(2005, 550, 4), ...coins(2200, 465, 4),
        ...coins(2365, 380, 4), ...coins(2560, 295, 4), ...coins(2855, 555, 4),
        ...coins(3110, 480, 4), ...coins(3510, 490, 4), ...coins(3950, 550, 5),
        item('star', 1065, 690), item('star', 2630, 258), item('star', 3370, 681),
        item('breeze', 1300, 490), item('bloom', 2010, 688), item('comet', 3090, 478),
        item('heart', 1650, 690), item('heart', 3600, 690)
      ],
      checkpoints: [checkpoint(1510, 740), checkpoint(3150, 740), checkpoint(3930)],
      hazards: [spikes(2410, 740, 100), spikes(3240, 740, 64)],
      secrets: [secret(2490, 215, 285, 165)],
      hints: [
        { x: 120, text: 'Le lagon est accueillant : tu peux rester sous l’eau sans limite.' },
        { x: 490, text: 'Dans l’eau, appuie sur Saut pour nager vers la surface.' },
        { x: 1750, text: 'Les nénuphars mènent à un jardin suspendu au-dessus de l’eau.' },
        { x: 2760, text: 'Les ombres te poursuivent si tu approches. Utilise les hauteurs.' },
        { x: 3770, text: 'Nage vers le haut pour rejoindre la dernière rive.' }
      ]
    },
    {
      id: 3, key: 'archipels-zephyr', name: 'Les archipels du zéphyr', subtitle: 'Le ciel aussi a ses sentiers.',
      medalTargets: { gold: 105, silver: 170 },
      theme: 'sky', width: 4700, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(4700),
      goal: 'Emprunte les courants entre les îles célestes.',
      platforms: [
        ground(0, 650), ground(1090, 650), ground(2070, 720), ground(3200, 610), ground(4190, 510),
        // Wide lower catch platforms keep the moving-platform routes forgiving.
        ledge(720, 650, 170), ledge(930, 625, 155),
        ledge(1780, 650, 155), ledge(1955, 625, 120),
        ledge(2835, 650, 165), ledge(3050, 625, 155),
        ledge(3860, 650, 150), ledge(4050, 625, 145),
        ledge(390, 510, 180, 'spring'),
        ledge(750, 510, 170, 'moving', { range: 65, speed: 0.65, axis: 'x', phase: 0.2 }),
        ledge(1120, 510, 160), ledge(1300, 430, 165), ledge(1475, 350, 160),
        ledge(1790, 510, 170, 'moving', { range: 45, speed: 0.7, axis: 'y', phase: 0.8 }),
        ledge(2170, 510, 160), ledge(2340, 430, 170), ledge(2530, 350, 165),
        ledge(2870, 515, 165, 'moving', { range: 70, speed: 0.65, axis: 'x', phase: 2 }),
        ledge(3290, 510, 160), ledge(3470, 430, 160, 'vanish', { phase: 0.4 }),
        ledge(3650, 350, 170),
        ledge(3900, 505, 160, 'moving', { range: 50, speed: 0.65, axis: 'x', phase: 1 }),
        ledge(4320, 510, 170, 'spring'),
        ledge(2300, 400, 135, 'echo'), ledge(2480, 315, 120, 'echo')
      ],
      enemies: [
        enemy('hopper', 1250, 600, 1130, 1480),
        enemy('patrol', 2390, 600, 2160, 2660),
        enemy('turret', 2630, 600, 2630, 2630),
        enemy('chaser', 3560, 600, 3280, 3690),
        enemy('hopper', 4320, 600, 4250, 4430),
        enemy('swarm', 1640, 452, 1480, 1720)
      ],
      collectibles: [
        ...coins(220, 550, 5), ...coins(420, 466, 4), ...coins(755, 595, 4),
        ...coins(960, 577, 3), ...coins(1150, 468, 4), ...coins(1500, 308, 4),
        ...coins(1810, 592, 4), ...coins(1980, 574, 3), ...coins(2205, 466, 4),
        ...coins(2560, 308, 4), ...coins(2870, 595, 4), ...coins(3080, 576, 3),
        ...coins(3320, 466, 4), ...coins(3680, 308, 4), ...coins(3890, 595, 3),
        ...coins(4090, 576, 3), ...coins(4450, 550, 4),
        item('star', 1560, 267), item('star', 2615, 267), item('star', 3735, 267),
        item('breeze', 440, 466), item('comet', 2290, 550), item('bloom', 3360, 550),
        item('heart', 1540, 550), item('heart', 3330, 550), item('echo', 2180, 550)
      ],
      checkpoints: [checkpoint(1570), checkpoint(3260)], hazards: [],
      secrets: [secret(3590, 210, 285, 190)],
      hints: [
        { x: 120, text: 'Des îlots plus bas te rattrapent. Observe le mouvement des nacelles.' },
        { x: 400, text: 'Les fleurs roses sont des tremplins : reste au centre et laisse-toi porter.' },
        { x: 1110, text: 'Les éclats préfèrent les chemins les plus hauts.' },
        { x: 3190, text: 'La pierre pâle apparaît puis disparaît. Attends son retour avant de sauter.' }
      ]
    },
    {
      id: 4, key: 'forge-petales', name: 'La forge des pétales', subtitle: 'Même le feu peut fleurir.',
      medalTargets: { gold: 95, silver: 155 },
      theme: 'forge', width: 4600, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(4600),
      goal: 'Traverse la forge et garde ta lumière.',
      platforms: [
        ground(0, 840), ground(980, 770), ground(1900, 900), ground(2960, 740), ground(3850, 750),
        ledge(360, 510, 180), ledge(565, 430, 150), ledge(735, 350, 175),
        ledge(1030, 510, 260, 'conveyor', { direction: 1, speed: 105 }),
        ledge(1360, 500, 160, 'crumble'), ledge(1550, 415, 155),
        ledge(2030, 510, 180, 'conveyor', { direction: -1, speed: 100 }),
        ledge(2230, 430, 165), ledge(2410, 350, 170),
        ledge(2650, 510, 180, 'spring'),
        ledge(3040, 510, 160), ledge(3220, 430, 160, 'vanish', { phase: 1.6 }),
        ledge(3390, 350, 170),
        ledge(3930, 510, 240, 'conveyor', { direction: 1, speed: 90 })
      ],
      enemies: [
        enemy('patrol', 530, 600, 380, 760),
        enemy('turret', 1240, 600, 1240, 1240),
        enemy('hopper', 1590, 600, 1460, 1660),
        enemy('chaser', 2250, 600, 2010, 2470),
        enemy('turret', 2770, 600, 2770, 2770),
        enemy('hopper', 3290, 600, 3060, 3480),
        enemy('sleeper', 4120, 600, 3980, 4260)
      ],
      collectibles: [
        ...coins(200, 550, 5), ...coins(395, 466, 4), ...coins(760, 308, 4),
        ...arc(790, 517, 8), ...coins(1060, 466, 6), ...coins(1400, 455, 3),
        ...arc(1700, 520, 8), ...coins(2065, 466, 4), ...coins(2440, 308, 4),
        ...coins(2675, 466, 4), ...arc(2750, 517, 8), ...coins(3070, 466, 4),
        ...coins(3420, 308, 4), ...arc(3650, 520, 8), ...coins(3960, 466, 6),
        ...coins(4340, 550, 4),
        item('star', 822, 267), item('star', 2495, 267), item('star', 3475, 267),
        item('bloom', 1070, 550), item('comet', 2050, 550), item('breeze', 3100, 550),
        item('heart', 1540, 550), item('heart', 3600, 550), item('heart', 4300, 550)
      ],
      checkpoints: [checkpoint(1450), checkpoint(3020)],
      hazards: [lava(840, 140), lava(1750, 150), lava(2800, 160), lava(3700, 150),
        spikes(2530, 600, 74), spikes(3500, 600, 68)],
      secrets: [secret(3330, 215, 280, 180)],
      hints: [
        { x: 100, text: 'Au-dessus de la lave, un saut précis vaut mieux qu’un départ précipité.' },
        { x: 990, text: 'Les tapis te transportent. Le sens des chevrons indique le courant.' },
        { x: 1890, text: 'Les pouvoirs sont des raccourcis : le chemin reste possible sans eux.' },
        { x: 3880, text: 'Le dormeur accumule ta présence. Traverse sans attendre, ou passe au-dessus.' },
        { x: 3030, text: 'Une lanterne, un souffle… puis la dernière traversée.' }
      ]
    },
    {
      id: 5, key: 'palais-givre', name: 'Le palais du givre', subtitle: 'Le silence a mille reflets.',
      medalTargets: { gold: 110, silver: 175 },
      theme: 'frost', width: 4580, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(4580),
      goal: 'Retrouve la cadence des miroirs lunaires.',
      platforms: [
        ground(0, 1000), ground(1150, 870), ground(2180, 750), ground(3090, 1490),
        ledge(420, 510, 160), ledge(600, 430, 160, 'vanish', { phase: 0.2 }),
        ledge(780, 350, 160),
        ledge(1260, 510, 190, 'conveyor', { direction: -1, speed: 85 }),
        ledge(1460, 430, 160), ledge(1640, 350, 160, 'vanish', { phase: 2 }),
        ledge(1820, 270, 160),
        ledge(2230, 510, 175), ledge(2440, 480, 180, 'moving', { range: 55, speed: 0.75, axis: 'y', phase: 1 }),
        ledge(2710, 510, 150, 'crumble'),
        ledge(3200, 510, 175), ledge(3400, 430, 170, 'vanish', { phase: 1.2 }),
        ledge(3590, 350, 170),
        ledge(3810, 480, 250, 'conveyor', { direction: 1, speed: 100 }),
        ledge(4140, 510, 170, 'spring'),
        ledge(1550, 390, 125, 'echo'), ledge(1720, 300, 125, 'echo')
      ],
      enemies: [
        enemy('hopper', 650, 600, 520, 820),
        enemy('chaser', 1450, 600, 1230, 1560),
        enemy('turret', 1880, 600, 1880, 1880),
        enemy('sleeper', 2560, 600, 2390, 2720),
        enemy('hopper', 3370, 600, 3200, 3480),
        enemy('chaser', 3940, 600, 3800, 4200)
      ],
      collectibles: [
        ...coins(220, 550, 5), ...coins(450, 466, 4), ...coins(805, 308, 4),
        ...arc(950, 515, 8), ...coins(1290, 466, 5), ...coins(1490, 386, 4),
        ...coins(1670, 308, 4), ...coins(1850, 228, 4), ...arc(1970, 515, 8),
        ...coins(2260, 466, 4), ...coins(2490, 424, 3), ...coins(2740, 466, 3),
        ...arc(2880, 515, 8), ...coins(3230, 466, 4), ...coins(3620, 308, 4),
        ...coins(3840, 436, 6), ...coins(4320, 550, 4),
        item('star', 860, 267), item('star', 1900, 187), item('star', 3675, 267),
        item('breeze', 1260, 550), item('bloom', 2300, 550), item('comet', 3870, 436),
        item('heart', 1770, 550), item('heart', 3130, 550), item('heart', 4270, 550),
        item('echo', 1480, 386)
      ],
      checkpoints: [checkpoint(1730), checkpoint(3150)],
      hazards: [spikes(1530, 600, 62), spikes(2660, 600, 66), spikes(3530, 600, 76)],
      secrets: [secret(1780, 135, 260, 175)],
      hints: [
        { x: 100, text: 'Les miroirs respirent : observe leur lueur avant de t’engager.' },
        { x: 1170, text: 'Les passages au sol restent ouverts. Les sommets récompensent la patience.' },
        { x: 2190, text: 'Une plateforme qui monte peut te porter jusqu’au prochain reflet.' },
        { x: 3090, text: 'Au-delà du givre, le vent garde encore des jardins à découvrir.' }
      ]
    },
    {
      id: 6, key: 'jardin-heures-bleues', name: 'Le jardin des heures bleues', subtitle: 'Un détour que la lune avait oublié.',
      medalTargets: { gold: 85, silver: 140 },
      theme: 'secret', width: 4200, height: 900, bonus: true,
      spawn: { x: 100, y: 554 }, exit: exit(4200),
      goal: 'Récolte les trésors du jardin oublié.',
      platforms: [
        ground(0, 780), ground(910, 700), ground(1750, 740), ground(2630, 700), ground(3470, 730),
        ledge(310, 510, 165, 'spring'), ledge(500, 430, 160), ledge(680, 350, 170),
        ledge(960, 510, 175), ledge(1160, 430, 170), ledge(1350, 350, 170),
        ledge(1540, 430, 150, 'moving', { range: 45, speed: 0.6, axis: 'y', phase: 0.5 }),
        ledge(1840, 510, 160), ledge(2020, 430, 160), ledge(2200, 350, 170),
        ledge(2380, 270, 170),
        ledge(2700, 510, 170, 'spring'), ledge(2900, 430, 170, 'vanish', { phase: 0.5 }),
        ledge(3090, 350, 170),
        ledge(3540, 510, 170), ledge(3730, 430, 190, 'conveyor', { direction: 1, speed: 80 }),
        ledge(2150, 405, 130, 'echo'), ledge(2310, 315, 125, 'echo')
      ],
      enemies: [
        enemy('patrol', 1150, 600, 1000, 1350),
        enemy('hopper', 1940, 600, 1840, 2110),
        enemy('patrol', 3650, 600, 3540, 3860),
        enemy('swarm', 3000, 465, 2860, 3190)
      ],
      collectibles: [
        ...coins(210, 550, 6), ...coins(340, 466, 4), ...coins(530, 386, 4),
        ...coins(710, 308, 4), ...arc(730, 515, 7), ...coins(990, 466, 4),
        ...coins(1190, 386, 4), ...coins(1380, 308, 4), ...arc(1560, 515, 8),
        ...coins(1870, 466, 4), ...coins(2050, 386, 4), ...coins(2230, 308, 4),
        ...coins(2410, 228, 4), ...arc(2440, 515, 8), ...coins(2740, 466, 4),
        ...coins(2930, 386, 4), ...coins(3120, 308, 4), ...arc(3280, 515, 8),
        ...coins(3570, 466, 4), ...coins(3760, 386, 5), ...coins(3930, 550, 4),
        item('star', 1435, 267), item('star', 2465, 187), item('star', 3175, 267),
        item('breeze', 350, 466), item('comet', 1390, 550), item('bloom', 2740, 550),
        item('heart', 1020, 550), item('heart', 2330, 550), item('heart', 3830, 550),
        item('echo', 2070, 386)
      ],
      checkpoints: [checkpoint(1460), checkpoint(2790)], hazards: [],
      secrets: [secret(2320, 130, 300, 185)],
      hints: [
        { x: 100, text: 'Bienvenue dans le jardin oublié. Chaque détour cache une lumière.' },
        { x: 950, text: 'Explore à ton rythme. Les éclats conservés apparaissent sur la carte.' },
        { x: 1780, text: 'Suis l’escalier de pétales jusqu’au cœur du jardin.' },
        { x: 3480, text: 'Le jardin oublié rejoint les vergers du vent. Fais le plein de lumière.' }
      ]
    },
    {
      id: 7, key: 'vergers-vent', name: 'Les vergers du vent', subtitle: 'Chaque branche dessine un nouveau ciel.',
      medalTargets: { gold: 120, silver: 190 },
      theme: 'sky', width: 5760, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(5760),
      goal: 'Réveille les trois fruits de lune au sommet des vergers.',
      platforms: [
        // A forgiving walking route winds below six distinct canopy gardens.
        ground(0, 960), ground(1090, 810), ground(2040, 920),
        ground(3100, 840), ground(4080, 720), ground(4940, 820),
        // Orchard I: an ascending branch and a spring shortcut to its crown.
        ledge(390, 510, 175), ledge(575, 430, 160), ledge(755, 350, 170),
        ledge(1095, 510, 165, 'spring'), ledge(1290, 420, 170),
        ledge(1480, 340, 170), ledge(1660, 420, 170),
        // Orchard II: moving fruit baskets over a broad safe floor.
        ledge(2080, 510, 180),
        ledge(2280, 440, 170, 'moving', { range: 42, speed: .65, axis: 'y', phase: .7 }),
        ledge(2500, 350, 170), ledge(2690, 430, 180, 'crumble'),
        // Echo leaves offer a faster alternative to the permanent branch stair.
        ledge(2200, 400, 130, 'echo'), ledge(2380, 310, 130, 'echo'),
        // Orchard III: the lower branch transports; the higher one blinks.
        ledge(3190, 510, 250, 'conveyor', { direction: 1, speed: 85 }),
        ledge(3450, 430, 170, 'vanish', { phase: .8 }), ledge(3640, 350, 175),
        // Orchard IV: a broad resting tree before the last long climb.
        ledge(4140, 510, 175), ledge(4330, 430, 170), ledge(4520, 350, 175),
        ledge(4370, 320, 140, 'echo'), ledge(4550, 250, 140, 'echo'),
        ledge(4990, 510, 170), ledge(5180, 430, 170, 'crumble'),
        ledge(5370, 350, 170), ledge(5550, 470, 150)
      ],
      enemies: [
        enemy('patrol', 620, 600, 490, 820),
        enemy('swarm', 1430, 458, 1240, 1590),
        enemy('hopper', 1720, 600, 1560, 1800),
        enemy('sleeper', 2550, 600, 2370, 2820),
        enemy('swarm', 2790, 445, 2560, 2870),
        enemy('turret', 3760, 600, 3760, 3760),
        enemy('sleeper', 4500, 600, 4340, 4670),
        enemy('chaser', 5390, 600, 5260, 5510)
      ],
      collectibles: [
        ...coins(210, 550, 5), ...coins(420, 466, 4), ...coins(785, 308, 4),
        ...arc(910, 517, 8), ...coins(1130, 466, 4), ...coins(1315, 378, 4),
        ...coins(1510, 298, 4), ...coins(1690, 378, 4), ...arc(1850, 517, 8),
        ...coins(2110, 466, 4), ...coins(2320, 388, 3), ...coins(2530, 308, 4),
        ...coins(2725, 386, 4), ...arc(2910, 517, 8), ...coins(3230, 466, 6),
        ...coins(3480, 386, 4), ...coins(3670, 308, 4), ...arc(3890, 517, 8),
        ...coins(4170, 466, 4), ...coins(4360, 386, 4), ...coins(4550, 308, 4),
        ...arc(4750, 517, 8), ...coins(5020, 466, 4), ...coins(5210, 386, 4),
        ...coins(5400, 308, 4), ...coins(5580, 550, 3),
        item('star', 1565, 258), item('star', 2585, 267), item('star', 5450, 267),
        item('breeze', 430, 466), item('comet', 3220, 466), item('bloom', 4150, 550),
        item('echo', 2130, 550), item('echo', 4390, 386),
        item('heart', 1420, 550), item('heart', 3270, 550), item('heart', 5130, 550)
      ],
      checkpoints: [checkpoint(1370), checkpoint(3280), checkpoint(5160)],
      hazards: [],
      secrets: [secret(2430, 230, 330, 180), secret(4310, 195, 425, 130)],
      hints: [
        { x: 120, text: 'Six arbres, trois fruits de lune. Les branches hautes dessinent une seconde route.' },
        { x: 1140, text: 'Les papillons voyagent en essaim. Un saut dessus disperse toute leur lumière.' },
        { x: 2150, text: 'Sonne le grelot avec X : les feuilles translucides deviennent des plateformes.' },
        { x: 2340, text: 'Le dormeur se réveille si tu restes près de lui. Traverse ou saute au-dessus.' },
        { x: 3160, text: 'Le courant des branches porte ta course. Les lanternes t’attendent au sol.' },
        { x: 4990, text: 'La dernière cime se gagne marche après marche. Son fruit n’attend que toi.' }
      ]
    },
    {
      id: 8, key: 'galerie-echos', name: 'La galerie des échos', subtitle: 'Les murs se souviennent de la lumière.',
      medalTargets: { gold: 130, silver: 205 },
      theme: 'cavern', width: 6000, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(6000),
      goal: 'Rassemble les trois notes qui ouvrent le passage de l’éclipse.',
      platforms: [
        // All five mandatory gaps can be crossed with a normal held jump.
        ground(0, 1060), ground(1200, 880), ground(2220, 980),
        ground(3340, 820), ground(4300, 740), ground(5180, 820),
        // Chamber I: solid notes introduce the tall winding gallery.
        ledge(370, 510, 175), ledge(560, 430, 170), ledge(750, 350, 175),
        ledge(930, 430, 160, 'crumble'),
        // Chamber II: an ordinary stair and an echo shortcut share a crown.
        ledge(1250, 510, 180), ledge(1450, 430, 170),
        ledge(1640, 350, 170), ledge(1830, 270, 170),
        ledge(1390, 390, 130, 'echo'), ledge(1570, 305, 130, 'echo'),
        // Chamber III: fragile notes cross above sleeping stone creatures.
        ledge(2280, 510, 175), ledge(2470, 430, 175, 'crumble'),
        ledge(2660, 350, 175, 'crumble'), ledge(2850, 270, 180),
        ledge(3050, 440, 170, 'moving', { range: 35, speed: .6, axis: 'y', phase: 1.2 }),
        // Chamber IV: a fast low conveyor and a safe, permanent upper stair.
        ledge(3410, 510, 220, 'conveyor', { direction: -1, speed: 80 }),
        ledge(3640, 430, 175), ledge(3840, 350, 170, 'vanish', { phase: 1.4 }),
        ledge(4040, 450, 170),
        // Chamber V: the grelot unlocks a shortcut across the quiet well.
        ledge(4360, 510, 180, 'spring'), ledge(4560, 430, 175),
        ledge(4750, 350, 175), ledge(4930, 270, 165),
        ledge(4520, 320, 135, 'echo'), ledge(4700, 240, 135, 'echo'),
        // The final staircase sits over continuous ground, clear of the exit.
        ledge(5250, 510, 175), ledge(5440, 430, 175), ledge(5630, 350, 175)
      ],
      enemies: [
        enemy('sleeper', 770, 600, 590, 910),
        enemy('hopper', 1370, 600, 1280, 1530),
        enemy('swarm', 1930, 434, 1730, 1990),
        enemy('sleeper', 2640, 600, 2460, 2860),
        enemy('turret', 3120, 600, 3120, 3120),
        enemy('patrol', 3750, 600, 3580, 3960),
        enemy('swarm', 4020, 438, 3820, 4070),
        enemy('sleeper', 4780, 600, 4590, 4880),
        enemy('chaser', 5550, 600, 5430, 5710)
      ],
      collectibles: [
        ...coins(210, 550, 5), ...coins(400, 466, 4), ...coins(590, 386, 4),
        ...coins(780, 308, 4), ...arc(1010, 517, 8), ...coins(1280, 466, 4),
        ...coins(1480, 386, 4), ...coins(1670, 308, 4), ...coins(1860, 228, 4),
        ...arc(2030, 517, 8), ...coins(2310, 466, 4), ...coins(2500, 386, 4),
        ...coins(2690, 308, 4), ...coins(2880, 228, 4), ...coins(3080, 395, 3),
        ...arc(3150, 517, 8), ...coins(3440, 466, 5), ...coins(3670, 386, 4),
        ...coins(3870, 308, 4), ...arc(4110, 517, 8), ...coins(4390, 466, 4),
        ...coins(4590, 386, 4), ...coins(4780, 308, 4), ...coins(4960, 228, 3),
        ...arc(4990, 517, 8), ...coins(5280, 466, 4), ...coins(5470, 386, 4),
        ...coins(5660, 308, 4), ...coins(5830, 550, 4),
        item('star', 1915, 187), item('star', 2940, 187), item('star', 5710, 267),
        item('breeze', 405, 466), item('bloom', 2280, 550), item('comet', 3450, 550),
        item('echo', 1280, 550), item('echo', 4430, 550),
        item('heart', 1760, 550), item('heart', 3520, 550), item('heart', 5340, 550)
      ],
      checkpoints: [checkpoint(1720), checkpoint(3480), checkpoint(5330)],
      hazards: [spikes(2900, 600, 68), spikes(3970, 600, 62)],
      secrets: [secret(1770, 125, 325, 185), secret(4460, 175, 475, 135)],
      hints: [
        { x: 120, text: 'La galerie résonne de tes pas. Les dormeurs préfèrent le silence.' },
        { x: 1250, text: 'Les marches d’écho restent quatre secondes. Le chemin de pierre reste toujours ouvert.' },
        { x: 2250, text: 'Les notes dorées s’effritent. Saute à la suivante dès que tu touches la surface.' },
        { x: 3380, text: 'Une lanterne avant le dernier mouvement. Respire et observe les essaims.' },
        { x: 4330, text: 'Le puits de lumière cache un détour. Le grelot révèle ses contours.' },
        { x: 5230, text: 'Un dernier escalier. Au-delà de cette porte, le Veilleur de l’éclipse.' }
      ]
    },
    {
      // Ce chapitre n'enseigne qu'une chose, en six temps : ta voix réveille le
      // monde. Chaque temps introduit un usage, et aucun ne punit l'erreur.
      id: 9, key: 'verger-qui-reve', name: 'Le verger qui rêve', subtitle: 'Ce qui dort attend seulement qu’on l’appelle.',
      medalTargets: { gold: 95, silver: 150 },
      theme: 'meadow', width: 4500, height: 900,
      spawn: { x: 100, y: 554 }, exit: exit(4500),
      goal: 'Réveille le verger et rends sa voix au jardin.',
      platforms: [
        // TEMPS 1 — l'idée. Un sol continu : rien ne peut mal tourner ici.
        ground(0, 980),
        ledge(470, 430, 170),
        // TEMPS 2 — l'apprentissage. Trois boutons, un escalier, aucun danger.
        ground(1120, 900),
        ledge(1200, 440, 150), ledge(1440, 368, 150), ledge(1690, 296, 170),
        // TEMPS 3 — la variation. Un trou franchi par un pont qui ne dure pas,
        // et juste dessous une corniche de rattrapage avec de quoi remonter.
        ledge(2060, 700, 170),
        // TEMPS 4 — la combinaison. Un gouffre trop large, un carillon comme
        // seul relais, et une corniche de secours au fond.
        ground(2260, 300),
        ledge(2700, 690, 190),
        ground(2960, 620),
        ledge(3080, 420, 160), ledge(3300, 336, 170),
        // TEMPS 5 — le moment. La créature qui barrait le passage le devient.
        ledge(3600, 660, 130),
        // TEMPS 6 — la respiration. Un plateau large, une lanterne, la porte.
        ground(3800, 700),
        ledge(4020, 430, 160), ledge(4230, 350, 150)
      ],
      // Les réveillables : leur `x`/`y` est leur cœur, d'où part la distance.
      wakeables: [
        // Un bouton posé au sol ouvre son tremplin 60 px plus haut : on saute
        // dessus, on ne le traverse pas.
        wake('bloom', 560, 550, { id: 'verger-bouton-1' }),
        wake('bloom', 1270, 550), wake('bloom', 1510, 550), wake('bloom', 1760, 550),
        // Le pont d'apprentissage est à hauteur de sol : il prolonge la prairie.
        wake('bridge', 2140, 600, { span: 240, id: 'verger-pont-1' }),
        wake('bloom', 2140, 650),
        // Le carillon est à portée depuis la rive ; le cœur du grand pont, non.
        wake('chime', 2640, 520, { id: 'verger-carillon' }),
        wake('bridge', 2760, 600, { span: 400, id: 'verger-pont-gouffre' }),
        wake('bloom', 2790, 640),
        wake('bloom', 3010, 550),
        wake('bloom', 3880, 550)
      ],
      enemies: [
        enemy('patrol', 1380, 600, 1180, 1620),
        // Ce dormeur-ci n'est pas un obstacle : c'est la marche du temps 5.
        enemy('sleeper', 3640, 660, 3600, 3720),
        enemy('swarm', 3300, 250, 3150, 3450),
        enemy('patrol', 4020, 600, 3860, 4180)
      ],
      collectibles: [
        ...coins(200, 550, 5), ...arc(520, 520, 5), ...coins(500, 386, 4),
        ...coins(1180, 550, 4), ...coins(1230, 396, 3), ...coins(1470, 324, 3),
        ...coins(1720, 252, 4), ...arc(1900, 515, 6),
        ...coins(2290, 550, 3), ...coins(2740, 646, 4),
        ...coins(3000, 550, 4), ...coins(3110, 376, 3), ...coins(3330, 292, 3),
        ...arc(3840, 515, 6), ...coins(4050, 386, 3), ...coins(4250, 306, 3),
        item('star', 1775, 250), item('star', 3385, 290), item('star', 4305, 304),
        item('breeze', 1160, 550), item('comet', 2300, 550),
        item('bloom', 3000, 550), item('echo', 3860, 550),
        item('heart', 2480, 550), item('heart', 3900, 550)
      ],
      checkpoints: [checkpoint(1150), checkpoint(2480), checkpoint(3860)],
      hazards: [],
      secrets: [secret(4160, 190, 210, 140)],
      hints: [
        { x: 100, text: 'Appuie sur X : ta voix réveille ce qui dort autour de toi.' },
        { x: 540, text: 'Ce bouton attend d’être appelé. Réveille-le, puis saute dessus.' },
        { x: 1180, text: 'Trois boutons, un escalier. Prends ton temps : rien ne peut te blesser ici.' },
        { x: 2020, text: 'Le pont ne dure que six secondes. Rappelle-le sous tes pieds si besoin.' },
        { x: 2420, text: 'Le gouffre est hors de portée de ta voix. Mais le carillon, lui, est à portée.' },
        { x: 2760, text: 'Un carillon réveillé renvoie l’onde plus loin que toi.' },
        { x: 3560, text: 'Celui-ci dort en travers du chemin. Appelle-le doucement plutôt que de l’attendre.' },
        { x: 3860, text: 'Le verger respire. La porte est au bout, et une lumière se cache tout en haut.' }
      ]
    },
    {
      id: 10, key: 'coeur-eclipse', name: 'Le cœur de l’éclipse', subtitle: 'Une petite lumière. Une immense nuit.',
      medalTargets: { gold: 130, silver: 210 },
      theme: 'eclipse', width: 4800, height: 900, final: true,
      spawn: { x: 100, y: 554 }, exit: { ...exit(4800), open: false }, boss: true,
      goal: 'Éveille le Gardien et rends la lune aux jardins.',
      platforms: [
        ground(0, 940), ground(1070, 930), ground(2140, 770), ground(3050, 1750),
        ledge(370, 510, 160), ledge(550, 430, 160), ledge(730, 350, 160),
        ledge(1130, 510, 165, 'conveyor', { direction: 1, speed: 90 }),
        ledge(1320, 430, 160, 'crumble'), ledge(1500, 350, 160),
        ledge(1700, 270, 170),
        ledge(2200, 510, 155), ledge(2375, 430, 155, 'vanish', { phase: 1 }),
        ledge(2550, 350, 170), ledge(2750, 435, 160),
        // The last 1350 pixels are one continuous, uncluttered boss arena.
        ledge(3090, 510, 130)
      ],
      enemies: [
        enemy('patrol', 540, 600, 420, 810),
        enemy('turret', 1230, 600, 1230, 1230),
        enemy('hopper', 1700, 600, 1550, 1840),
        enemy('chaser', 2390, 600, 2230, 2580),
        enemy('turret', 2830, 600, 2830, 2830)
      ],
      collectibles: [
        ...coins(210, 550, 5), ...coins(400, 466, 4), ...coins(760, 308, 4),
        ...arc(890, 515, 7), ...coins(1160, 466, 4), ...coins(1350, 386, 4),
        ...coins(1530, 308, 4), ...coins(1730, 228, 4), ...arc(1950, 515, 8),
        ...coins(2230, 466, 4), ...coins(2580, 308, 4), ...coins(2780, 393, 4),
        ...arc(2860, 515, 8), ...coins(3150, 550, 4),
        item('star', 810, 267), item('star', 1785, 187), item('star', 2635, 267),
        item('breeze', 1160, 550), item('comet', 2260, 550), item('bloom', 3260, 550),
        item('heart', 1860, 550), item('heart', 3130, 550), item('heart', 3390, 550)
      ],
      checkpoints: [checkpoint(1430), checkpoint(3090), checkpoint(3420)],
      hazards: [spikes(1770, 600, 65), spikes(2620, 600, 68)],
      secrets: [secret(1660, 125, 290, 185)],
      hints: [
        { x: 100, text: 'Les neuf jardins brillent derrière toi. La lune attend le dernier éclat.' },
        { x: 2100, text: 'Un dernier passage, puis le Gardien. La prochaine lanterne est tout près.' },
        { x: 3080, text: 'Gardien : esquive ses attaques. Frappe sa tête lorsqu’il se repose.' },
        { x: 3420, text: 'Sa lumière change avant chaque attaque. Observe, saute, puis riposte.' }
      ]
    },
    {
      /* L'OBSERVATOIRE — le seul lieu du jeu où l'on ne peut pas mourir.
       *
       * Il n'a ni sortie à atteindre, ni chronomètre, ni médaille : c'est
       * volontaire. On y vient pour parler à deux personnes, réveiller trois
       * carillons, et voir la coupole changer. Le drapeau `hub` le tient donc
       * hors de la campagne, de l'atlas et du décompte des chapitres. */
      id: 11, key: 'observatoire', hub: true,
      name: 'L’observatoire', subtitle: 'Le premier souffle.',
      theme: 'secret', width: 1900, height: 900,
      spawn: { x: 180, y: 554 },
      // La porte des rêves ne s'ouvre qu'après la quête : elle est le signe
      // visible que quelque chose a changé ici.
      exit: { x: 1660, y: 500, w: 70, h: 100, open: false, leadsTo: 'expedition' },
      goal: 'Rends son souffle à la coupole.',
      platforms: [
        ground(0, 1900),
        // Chaque corniche est à 110 px au plus de la précédente : un saut
        // ordinaire suffit, sans course ni pouvoir.
        ledge(430, 490, 150), ledge(700, 420, 170), ledge(1010, 490, 150),
        ledge(1240, 380, 180)
      ],
      // Les trois carillons de la coupole : la quête entière tient là.
      wakeables: [
        // Chaque carillon pend 40 px au-dessus de sa corniche : hors de portée
        // depuis le sol, à portée dès qu'on est monté. Il faut grimper.
        wake('chime', 505, 450, { id: 'coupole-carillon-1' }),
        wake('chime', 785, 380, { id: 'coupole-carillon-2' }),
        wake('chime', 1085, 450, { id: 'coupole-carillon-3' })
      ],
      characters: [
        {
          id: 'vesper', name: 'Vesper', x: 330, y: 600, facing: 1,
          role: 'L’archiviste de la coupole',
          lines: {
            unknown: ['Ah, une petite lumière. Bienvenue.',
                      'La coupole a perdu son souffle : ses trois carillons se sont tus.',
                      'Approche-toi d’eux et appelle. Ta voix suffira.'],
            active: ['Continue. Un carillon réveillé en appelle un autre.',
                     'Je note tout, tu sais. C’est mon seul talent.'],
            done: ['Écoute-la respirer. Je n’avais pas entendu ça depuis longtemps.',
                   'Va voir Ombeline. Elle t’attendait, elle, bien avant moi.']
          }
        },
        {
          id: 'ombeline', name: 'Ombeline', x: 1500, y: 600, facing: -1,
          role: 'La veilleuse de la porte',
          lines: {
            unknown: ['Cette porte ? Elle ne mène nulle part tant que la coupole se tait.',
                      'Réveille les carillons. Ensuite on parlera.'],
            active: ['Pas encore. J’entends qu’il en manque.'],
            done: ['Voilà. Derrière cette porte, les jardins rêvent.',
                   'Chaque nuit ils inventent un chemin différent. Tu veux voir ?']
          }
        }
      ],
      quest: {
        id: 'premier-souffle',
        title: 'Le premier souffle',
        summary: 'Réveille les trois carillons de la coupole.',
        needs: ['coupole-carillon-1', 'coupole-carillon-2', 'coupole-carillon-3'],
        transformation: 'coupole-allumee',
        reward: 'La porte des rêves s’ouvre.'
      },
      enemies: [], hazards: [], secrets: [],
      collectibles: [...coins(560, 550, 4), ...coins(900, 550, 4), ...arc(1180, 520, 5)],
      checkpoints: [],
      hints: [
        { x: 180, text: 'Ici, rien ne peut vous blesser. Parlez à Vesper, puis regardez en haut.' },
        { x: 700, text: 'Les carillons sont posés sur les corniches. Approchez-vous et appelez avec X.' },
        { x: 1480, text: 'Ombeline garde la porte des rêves.' }
      ]
    }
  ];

  // Static definitions are never mutated by the simulation. Creating a stage
  // restores collected objects, crumbling platforms and enemy state cleanly.
  window.LUMEN_LEVELS = levels;
  window.LumenLevels = {
    create(index) {
      const definition = levels[index];
      if (!definition) throw new RangeError('Niveau inconnu : ' + index);
      return JSON.parse(JSON.stringify(definition));
    }
  };
})();
