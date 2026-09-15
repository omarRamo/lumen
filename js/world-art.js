(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const THEMES = {
    dawn: { sky: ['#93c2df', '#d0e3df', '#f6e6c7'], sea: '#83bdbd', far: '#9bafba', middle: '#528c89',
      rock: '#336e70', shade: '#24565d', facet: '#518b87', grass: '#c3df9f', rim: '#eaf1c1', leaf: '#276b63', lightLeaf: '#78b28e', coral: '#ef9679', stone: '#e9e5d3' },
    noon: { sky: ['#72bade', '#b7e1e9', '#e3f2ec'], sea: '#65b6c9', far: '#84bdc3', middle: '#558f9c',
      rock: '#3d737f', shade: '#2b555f', facet: '#64929a', grass: '#a3dec9', rim: '#e2f5d9', leaf: '#397e82', lightLeaf: '#84c7b6', coral: '#ed9db3', stone: '#e4e7df' },
    sunset: { sky: ['#e6a5a5', '#f7c7aa', '#f4e3c3'], sea: '#83b9b3', far: '#9eb9b0', middle: '#62958f',
      rock: '#37676d', shade: '#274f59', facet: '#588686', grass: '#a8d6b8', rim: '#eee6b1', leaf: '#326e67', lightLeaf: '#78ac8c', coral: '#efbc74', stone: '#e8ddc5' }
  };
  const NIGHT_THEMES = {
    dawn: { ...THEMES.dawn, sky: ['#142e32', '#355657', '#877576'], sea: '#427c7f', far: '#678483', middle: '#315d64',
      rock: '#294b54', shade: '#203b46', facet: '#466a72', grass: '#83b7a2', rim: '#d9edc8', leaf: '#356a69', lightLeaf: '#6c9e85', coral: '#f4a386', stone: '#bcc9b8', cloud: '#8dada7', night: true },
    noon: { ...THEMES.noon, sky: ['#172c38', '#3b5e68', '#839d9b'], sea: '#457f93', far: '#728f9c', middle: '#375c70',
      rock: '#2b475d', shade: '#203549', facet: '#52748c', grass: '#8ebfab', rim: '#dbebbe', leaf: '#416e80', lightLeaf: '#7ab6ae', coral: '#f2a3b7', stone: '#b9cbcb', cloud: '#9ebcbe', night: true },
    sunset: { ...THEMES.sunset, sky: ['#352e38', '#64505b', '#aa8179'], sea: '#538881', far: '#909b98', middle: '#3d6770',
      rock: '#364e5b', shade: '#293a49', facet: '#657c7e', grass: '#9ebc9d', rim: '#e3dbab', leaf: '#446967', lightLeaf: '#81a08a', coral: '#f3ba85', stone: '#c5c4ae', cloud: '#c0a7ad', night: true }
  };
  const paletteFor = (sky, appearance = global.LumenAppearance?.current) => (appearance === 'dark' ? NIGHT_THEMES : THEMES)[sky] || (appearance === 'dark' ? NIGHT_THEMES.dawn : THEMES.dawn);
  const CAMPAIGN_THEMES = {
    meadow: { ...THEMES.dawn },
    cavern: { ...THEMES.noon, sky: ['#597d88', '#8dacad', '#b4c9bd'], sea: '#669899',
      rock: '#345865', shade: '#26434e', facet: '#587d87', grass: '#acd7cf', rim: '#edf5d7', coral: '#dda1b1' },
    tide: { ...THEMES.noon, sky: ['#86c3cd', '#b6dfd9', '#e3edcf'], sea: '#6eadae',
      rock: '#326c75', shade: '#234e5c', facet: '#50868b', coral: '#efa696' },
    sky: { ...THEMES.noon, grass: '#c6e4b5', rim: '#f5f4ce' },
    forge: { ...THEMES.sunset, sky: ['#ac929d', '#d5b0a6', '#e7c9b1'], sea: '#879f9b',
      rock: '#555967', shade: '#3c414f', facet: '#7c737c', grass: '#e9c1ac', rim: '#fff0c6', coral: '#df917d' },
    frost: { ...THEMES.noon, sky: ['#9fbec8', '#c1d9dd', '#e2ece2'], sea: '#92b8be',
      rock: '#466b7a', shade: '#304d60', facet: '#7496a0', grass: '#d1eadf', rim: '#f8fae4', coral: '#dca4ba' },
    secret: { ...THEMES.sunset, sky: ['#c8a7b8', '#dfc4c6', '#ede2c9'], sea: '#97b9b0',
      rock: '#536470', shade: '#2c3b48', facet: '#80868a', grass: '#bfd8ad', rim: '#f1edbf' },
    eclipse: { ...THEMES.sunset, sky: ['#6b7e89', '#99a6a7', '#c5c9b5'], sea: '#749b9e',
      rock: '#3c5c66', shade: '#2c434e', facet: '#67838a', grass: '#b2cdb6', rim: '#eeebbd' }
  };
  const CAMPAIGN_NIGHT_THEMES = {
    meadow: { ...NIGHT_THEMES.dawn },
    cavern: { ...NIGHT_THEMES.noon, sky: ['#172c33', '#29494e', '#5b7978'], sea: '#345f65',
      rock: '#263f48', shade: '#1b303b', facet: '#47636c', grass: '#9bc9c0', rim: '#e1f0cf', coral: '#daa5b7' },
    tide: { ...NIGHT_THEMES.noon, sky: ['#193439', '#365f64', '#7b9992'], sea: '#457c7e',
      rock: '#284c58', shade: '#1b3543', facet: '#4b707c', grass: '#93c9b1', rim: '#dcecc3' },
    sky: { ...NIGHT_THEMES.noon, sky: ['#233a45', '#506d79', '#95a5a0'], sea: '#507e90',
      grass: '#a9cba7', rim: '#f0ecc4' },
    forge: { ...NIGHT_THEMES.sunset, sky: ['#382e37', '#654b53', '#a5756a'], sea: '#607e79',
      rock: '#434754', shade: '#2f303d', facet: '#75636d', grass: '#cdac94', rim: '#f5dfb0', coral: '#f2a17c' },
    frost: { ...NIGHT_THEMES.noon, sky: ['#253b45', '#536c76', '#98aca9'], sea: '#668c96',
      rock: '#354f61', shade: '#243949', facet: '#648390', grass: '#b5d7cb', rim: '#f0f5d8', coral: '#e0b1c6' },
    secret: { ...NIGHT_THEMES.sunset, sky: ['#3c3541', '#695965', '#ab8c8d'], sea: '#627f80',
      rock: '#414859', shade: '#2c3443', facet: '#716e7f', grass: '#b6c99f', rim: '#f1e6b1', coral: '#f2b19e' },
    eclipse: { ...NIGHT_THEMES.dawn, sky: ['#152b33', '#355058', '#708883'], sea: '#38616b',
      rock: '#294550', shade: '#1c303c', facet: '#506c77', grass: '#96baa5', rim: '#e6dfb3', coral: '#e9b78d' }
  };
  const campaignPalette = (theme, appearance = global.LumenAppearance?.current) => {
    const themes = appearance === 'dark' ? CAMPAIGN_NIGHT_THEMES : CAMPAIGN_THEMES;
    const palette = themes[theme] || themes.meadow;
    return { ...palette, glow: palette.rim, grassDark: palette.leaf, accent: palette.coral,
      flower: palette.coral, dark: palette.shade, mist: palette.sky[2] };
  };
  const PLATFORM_MARKS = Object.freeze({ ground: 'roots', solid: 'facet', moving: 'arrows',
    spring: 'petals', crumble: 'fracture', echo: 'rings', vanish: 'dashes', conveyor: 'chevrons' });
  function platformStyle(type, palette) {
    const colors = { ground: palette.grass, solid: palette.grass, moving: '#b1ddd5', spring: '#efb2a4',
      crumble: '#e4cea6', echo: '#d7ead9', vanish: '#d2c4de', conveyor: '#f1d992' };
    return { surface: colors[type] || palette.grass, rim: palette.rim, body: palette.shade,
      ink: palette.shade, mark: PLATFORM_MARKS[type] || PLATFORM_MARKS.solid };
  }
  const random = value => { const result = Math.sin(value * 127.1 + 311.7) * 43758.5453; return result - Math.floor(result); };
  const ellipse = (ctx, x, y, width, height, color, angle = 0) => {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01, width), Math.max(.01, height), angle, 0, TAU);
    ctx.fillStyle = color; ctx.fill();
  };
  function path(ctx, points, color) {
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(...point) : ctx.moveTo(...point));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function stroke(ctx, points, color, width = 2) {
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(...point) : ctx.moveTo(...point));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function leaf(ctx, x, y, size, angle, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-size * .6, -size * .4, -size * .5, -size, 0, -size * 1.5);
    ctx.bezierCurveTo(size * .5, -size, size * .6, -size * .4, 0, 0); ctx.fill(); ctx.restore();
  }
  function star(ctx, x, y, size, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * .18, y - size * .18, x + size, y);
    ctx.quadraticCurveTo(x + size * .18, y + size * .18, x, y + size);
    ctx.quadraticCurveTo(x - size * .18, y + size * .18, x - size, y);
    ctx.quadraticCurveTo(x - size * .18, y - size * .18, x, y - size); ctx.fill();
  }
  function sprite(renderer, key, width, height, paint) {
    if (!renderer.songAssets) renderer.songAssets = new Map();
    if (!renderer.songAssets.has(key)) {
      const surface = document.createElement('canvas'); surface.width = Math.ceil(width); surface.height = Math.ceil(height);
      paint(surface.getContext('2d')); renderer.songAssets.set(key, surface);
    }
    return renderer.songAssets.get(key);
  }
  function material(ctx, x, y, width, height, kind, palette, variation = 0) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const marks = Math.min(4200, Math.ceil(width * height / 62));
    for (let index = 0; index < marks; index++) {
      const horizontal = x + random(index + variation * 3) * width;
      const vertical = y + random(index * 3 + variation + 928) * height;
      const length = .7 + random(index + 755) * (kind === 'wood' ? 15 : 5);
      ctx.globalAlpha = .07 + random(index + 383) * .11;
      stroke(ctx, [[horizontal, vertical], [horizontal + (kind === 'wood' ? 1.8 : length), vertical + (kind === 'wood' ? length : -.8)]],
        index % 3 ? palette.rim : palette.shade, index % 5 ? .7 : 1.4);
    }
    if (kind === 'stone') for (let band = 0; band < height / 23; band++) {
      const baseline = y + band * 23;
      ctx.globalAlpha = .18;
      const points = Array.from({ length: Math.ceil(width / 35) + 1 }, (_, index) =>
        [x + index * 35, baseline + Math.sin(index * .6 + band + variation) * 7]);
      stroke(ctx, points, band % 3 ? palette.facet : palette.rim, .8);
    }
    ctx.restore();
  }
  function cloud(ctx, x, y, size, opacity = 1, color = '#f9fbed') {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size); ctx.globalAlpha = opacity;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-105, 15);
    ctx.bezierCurveTo(-147, 6, -132, -21, -91, -21); ctx.bezierCurveTo(-83, -53, -35, -50, -24, -33);
    ctx.bezierCurveTo(2, -66, 57, -45, 61, -21); ctx.bezierCurveTo(121, -24, 154, 10, 99, 20);
    ctx.bezierCurveTo(40, 32, -65, 25, -105, 15); ctx.fill();
    stroke(ctx, [[-97, 18], [-50, 22], [30, 23], [86, 18]], '#c1ded45c', 2);
    ctx.restore();
  }
  function tree(ctx, palette) {
    ctx.translate(230, 416);
    ctx.strokeStyle = palette.shade; ctx.lineWidth = 28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-34, -80, 29, -143, -12, -260); ctx.stroke();
    ctx.strokeStyle = palette.facet; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.bezierCurveTo(-22, -84, 20, -137, -18, -241); ctx.stroke();
    for (let index = 0; index < 7; index++) {
      const direction = index % 2 ? 1 : -1, endX = direction * (80 + random(index) * 85), endY = -170 - random(index + 2) * 130;
      ctx.strokeStyle = palette.shade; ctx.lineWidth = 10 - index * .8;
      ctx.beginPath(); ctx.moveTo(0, -82 - index * 18); ctx.quadraticCurveTo(endX * .85, endY + 38, endX, endY); ctx.stroke();
      const colors = [palette.leaf, palette.lightLeaf, palette.coral, palette.grass];
      for (let petal = 0; petal < 12; petal++) {
        const angle = petal / 12 * TAU, length = 30 + random(index * 30 + petal) * 35;
        leaf(ctx, endX + Math.cos(angle) * 16, endY + Math.sin(angle) * 12, length,
          angle + Math.PI / 2, colors[(index + (petal % 3 === 0 ? 1 : 0)) % colors.length]);
        stroke(ctx, [[endX + Math.cos(angle) * 18, endY + Math.sin(angle) * 13],
          [endX + Math.cos(angle) * (length + 9), endY + Math.sin(angle) * (length + 8)]], palette.rim + '35', .75);
      }
      for (let mark = 0; mark < 3; mark++) {
        ellipse(ctx, endX + mark * 7 - 6, endY + 5, 2.3, 3.6, '#f7edb4');
      }
      if (index % 2 === 0) {
        ctx.strokeStyle = palette.lightLeaf; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(endX, endY + 20); ctx.quadraticCurveTo(endX + 23, endY + 78, endX - 2, endY + 119); ctx.stroke();
        for (let vine = 0; vine < 6; vine++) leaf(ctx, endX + Math.sin(vine * .6) * 10, endY + 35 + vine * 13, 10, vine % 2 ? 1 : -1, palette.lightLeaf);
      }
    }
    for (let root = 0; root < 5; root++) {
      stroke(ctx, [[-6, -17], [-25 + root * 13, -3], [-60 + root * 29, 8]], palette.shade, 5);
    }
    material(ctx, -225, -406, 450, 418, 'wood', palette, 18);
    for (let ring = 0; ring < 5; ring++) {
      ctx.strokeStyle = palette.rim + '48'; ctx.lineWidth = .8; ctx.beginPath();
      ctx.ellipse(-9, -95, 4 + ring * 2, 9 + ring * 4, -.12, 0, TAU); ctx.stroke();
    }
  }
  function distantIsland(ctx, x, y, width, color, palette, variant) {
    path(ctx, [[x - width * .5, y], [x + width * .5, y - 4], [x + width * .28, y + width * .22],
      [x + width * .05, y + width * .34], [x - width * .22, y + width * .24]], color);
    ellipse(ctx, x, y - 2, width * .51, width * .04, palette.grass);
    path(ctx, [[x - width * .12, y + 8], [x + width * .12, y], [x + width * .04, y + width * .31]], palette.rim + '25');
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, width * .022);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - width * .06, y - width * .1, x + width * .06, y - width * .14, x, y - width * .25); ctx.stroke();
    for (let index = 0; index < 6; index++) {
      const angle = index / 6 * TAU;
      leaf(ctx, x, y - width * .2, width * .15, angle, variant % 2 ? palette.lightLeaf : color);
    }
    if (variant % 3 === 0) {
      ctx.globalAlpha *= .5; ctx.fillStyle = '#d9fbec'; ctx.fillRect(x + width * .2, y, width * .035, width * .8);
      ctx.fillStyle = '#ffffff80'; ctx.fillRect(x + width * .2, y, 2, width * .7);
    }
  }
  function terrain(renderer, platform, palette) {
    const ctx = renderer.ctx, width = platform.w, isGround = platform.type === 'ground';
    if (!platform.active) {
      ctx.save(); ctx.setLineDash([4, 9]); stroke(ctx, [[platform.x, platform.y], [platform.x + width, platform.y]], '#f2ffde80', 2); ctx.restore(); return;
    }
    if (platform.wakeId && platform.type === 'solid') {
      ctx.save(); ctx.globalAlpha = platform.warning ? .4 : .83;
      for (let index = 0; index < width; index += 26) {
        path(ctx, [[platform.x + index, platform.y], [platform.x + index + 24, platform.y],
          [platform.x + index + 21, platform.y + 12], [platform.x + index + 3, platform.y + 12]], '#ddf6d8');
      }
      stroke(ctx, [[platform.x, platform.y], [platform.x + width, platform.y]], '#fff9c9', 3); ctx.restore(); return;
    }
    const variant = Math.floor(platform.baseX ?? platform.x), depth = isGround ? 300 : Math.min(77, Math.max(24, platform.h || 22) + 28);
    const style = platformStyle(platform.type, palette);
    const image = sprite(renderer, 'terrain:' + width + ':' + depth + ':' + platform.type + ':' + variant + ':' + palette.rock + ':' + palette.rim, width + 36, depth + 36, paint => {
      paint.translate(18, 26);
      const points = [[0, 0], [width, 0], [width - 18, depth * .29], [width * .85, depth * .69],
        [width * .69, depth * .77], [width * .49, depth], [width * .34, depth * .73], [width * .11, depth * .7], [15, depth * .25]];
      path(paint, points, style.body); paint.save(); paint.beginPath(); points.forEach((point, index) => index ? paint.lineTo(...point) : paint.moveTo(...point)); paint.closePath(); paint.clip();
      for (let index = 0; index < Math.ceil(width / 85); index++) {
        const x = index * 94 - 35, lower = depth * (.25 + random(index + variant) * .6);
        path(paint, [[x, 10], [x + 130, 4], [x + 81, lower]], index % 2 ? palette.shade : palette.facet);
        path(paint, [[x, 10], [x + 81, lower], [x + 35, depth + 40]], index % 2 ? palette.facet : palette.shade);
        stroke(paint, [[x + 86, 31], [x + 54, lower * .7], [x + 55, lower]], palette.grass + '25', 1.5);
      }
      for (let index = 0; index < width / 13; index++) {
        const x = random(index + variant) * width, y = 18 + random(index + 987) * depth * .62;
        ellipse(paint, x, y, 1 + random(index) * 2.6, 1.1, palette.rim + '30');
      }
      material(paint, 0, 15, width, depth, 'stone', palette, variant);
      if (isGround) for (let index = 0; index < width / 170; index++) {
        const x = index*170 + 72, y = 45 + random(index+variant)*120;
        stroke(paint, [[x-25,y-22],[x-8,y-3],[x-12,y+15],[x+9,y+35]], palette.shade+'bb',1.5);
        stroke(paint, [[x-11,y+3],[x+9,y+8],[x+18,y+4]], palette.shade+'bb',1);
        ellipse(paint,x+18,y+18,9,4,palette.grass+'18',-.3);
      }
      paint.restore();
      path(paint, [[0, 0], [width, 0], [width - 9, 12], [width * .73, 18], [width * .4, 12], [12, 18]], style.surface);
      stroke(paint, [[1, 3], [width - 1, 3]], style.body, 3);
      stroke(paint, [[1, 0], [width - 1, 0]], palette.rim, 4);
      for (let index = 0; ['ground', 'solid'].includes(platform.type) && index < width / 16; index++) {
        const x = 8 + index * 16, length = 5 + random(index + variant) * 15;
        leaf(paint, x, 0, length, (random(index + 46) - .5) * 1.9, index % 5 ? palette.grass : palette.rim);
        if (index % 7 === 0) {
          stroke(paint, [[x, 0], [x + 2, -18]], palette.leaf, 1);
          for (let petal = 0; petal < 4; petal++) ellipse(paint, x + Math.cos(petal * Math.PI / 2) * 3, -19 + Math.sin(petal * Math.PI / 2) * 3, 3.5, 2.5, palette.coral, petal);
          ellipse(paint, x, -19, 1.8, 1.8, '#fff3bd');
        }
      }
      for (let vine = 0; isGround && vine < Math.ceil(width / 125); vine++) {
        const x = 30 + vine * 127, length = (isGround ? 48 : 20) + random(vine + variant) * 48;
        stroke(paint, [[x, 12], [x + 5, length * .4], [x - 5, length]], palette.lightLeaf, 2);
        for (let index = 0; index < length / 15; index++) leaf(paint, x, 16 + index * 14, 10, index % 2 ? 1 : -1, palette.lightLeaf);
      }
    });
    ctx.drawImage(image, platform.x - 18, platform.y - 26);
  }
  function platformMarks(ctx, platform, palette, time) {
    const { x, y, w: width, type } = platform, ink = palette.shade;
    ctx.save(); ctx.translate(x, y);
    if (type === 'moving') {
      const center = width / 2;
      stroke(ctx, [[center - 19, 13], [center + 19, 13]], ink, 2);
      stroke(ctx, [[center - 12, 7], [center - 19, 13], [center - 12, 19]], ink, 2);
      stroke(ctx, [[center + 12, 7], [center + 19, 13], [center + 12, 19]], ink, 2);
    } else if (type === 'spring') {
      for (let petal = 0; petal < 5; petal++) leaf(ctx, width / 2, 20, 18, (petal - 2) * .52, palette.coral);
      stroke(ctx, [[width / 2 - 8, 12], [width / 2, 5], [width / 2 + 8, 12]], ink, 2);
    } else if (type === 'crumble') {
      stroke(ctx, [[width * .48, 0], [width * .43, 9], [width * .54, 17], [width * .45, 36]], ink, 2.5);
      stroke(ctx, [[width * .54, 17], [width * .7, 24]], ink, 2);
    } else if (type === 'echo') {
      for (let center = 18; center < width - 8; center += 30) {
        ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(center, 14, 6, 0, TAU); ctx.stroke();
        star(ctx, center, 14, 2, palette.rim);
      }
    } else if (type === 'vanish') {
      ctx.setLineDash([8, 6]); stroke(ctx, [[8, 12], [width - 8, 12]], ink, 3);
    } else if (type === 'conveyor') {
      const direction = platform.direction || 1;
      for (let index = 0; index < Math.floor(width / 27); index++) {
        const center = 9 + ((index * 27 + time * 28 * direction) % (width - 18) + width - 18) % (width - 18);
        stroke(ctx, [[center - direction * 4, 7], [center + direction * 3, 12], [center - direction * 4, 17]], ink, 2);
      }
    }
    ctx.restore();
  }
  function note(ctx, x, y, palette) {
    ellipse(ctx, x, y, 7, 9, palette?.night ? '#f0d38c' : '#e9ba65', .25);
    ellipse(ctx, x - 1, y - 2, 3, 4.5, '#fff6c0', .25);
    stroke(ctx, [[x + 5, y], [x + 7, y - 15], [x + 12, y - 12]], palette?.night ? '#fff0bd' : '#866038', 2.4);
  }
  function facetedOval(ctx, x, y, width, height, base, facet) {
    ctx.save(); ellipse(ctx, x, y, width, height, base); ctx.clip();
    path(ctx, [[x - width, y - height], [x + width, y - height * .3], [x - width * .1, y + height]], facet);
    path(ctx, [[x - width, y], [x - width * .1, y + height], [x - width, y + height]], base);
    ctx.restore();
  }
  function sky(ctx, width, height, palette) {
    palette.sky.forEach((color, index) => {
      ctx.fillStyle = color; ctx.fillRect(0, index * height / 3, width, height / 3 + 1);
    });
    if (palette.night) for (let index = 0; index < 95; index++) {
      const x = random(index + 444) * width, y = random(index + 892) * height * .55;
      ctx.save(); ctx.globalAlpha = .25 + random(index + 94) * .5;
      if (index % 13 === 0) star(ctx, x, y, 2.5, '#fce4bb');
      else ellipse(ctx, x, y, .7, .7, '#e2efdf');
      ctx.restore();
    }
  }
  function horizon(renderer, palette, time, camera, width = renderer.width, height = renderer.height, backdrop = null) {
    const ctx = renderer.ctx;
    const skyImage = backdrop || sprite(renderer, 'sky:' + palette.sky.join(':') + ':' + width + ':' + height, width, height,
      paint => sky(paint, width, height, palette));
    ctx.drawImage(skyImage, 0, 0, width, height);
    const sunX = width * .74 - camera * .014, sunY = height * .235, radius = Math.min(width, height) * .079;
    if (palette.night) {
      ctx.save(); ctx.beginPath(); ctx.arc(sunX, sunY, radius, 0, TAU); ctx.clip();
      ctx.beginPath(); ctx.arc(sunX, sunY, radius, 0, TAU);
      ctx.arc(sunX + radius * .47, sunY - radius * .23, radius * .88, 0, TAU);
      ctx.fillStyle = '#f6e8c3'; ctx.fill('evenodd'); ctx.restore();
    } else ellipse(ctx, sunX, sunY, radius, radius, '#fff4cf');
    for (let index = 0; index < 8; index++) {
      const position = ((index * 347 + time * (2 + index % 3) - camera * .06) % (width + 500) + width + 500) % (width + 500) - 200;
      cloud(ctx, position, height * (.19 + random(index + 40) * .3), .5 + random(index + 9) * .6, palette.night ? .35 : .7, palette.cloud);
    }
    const waterline = height * .59;
    ctx.fillStyle = palette.sea; ctx.fillRect(0, waterline, width, height - waterline);
    ctx.fillStyle = palette.middle + '45'; ctx.fillRect(0, height * .82, width, height * .18);
    stroke(ctx, [[0, waterline], [width, waterline]], palette.rim + '70', 2);
    for (let layer = 0; layer < 3; layer++) {
      const gap = [440, 610, 900][layer], offset = camera * [.075, .14, .22][layer];
      for (let index = Math.floor(offset / gap) - 1; index < Math.floor((offset + width) / gap) + 2; index++) {
        ctx.save(); ctx.globalAlpha = [.25, .36, .44][layer];
        distantIsland(ctx, index * gap - offset + random(index) * 100,
          height * [.51, .66, .91][layer] + random(index + 4) * 45,
          [220, 330, 420][layer] + random(index + layer * 7) * 180, layer ? palette.middle : palette.far, palette, index + layer);
        ctx.restore();
      }
    }
    for (let index = 0; index < 25; index++) {
      const depth = random(index + 92), y = waterline + 15 + depth * (height - waterline);
      const x = (random(index + 91) * (width + 220) + time * (3 + depth * 5) - camera * .035) % (width + 220) - 110;
      stroke(ctx, [[x, y], [x + 15 + depth * 72, y]], palette.rim + (depth > .5 ? '45' : '80'), 1 + depth);
    }
  }
  global.LumenArt = { TAU, THEMES, NIGHT_THEMES, paletteFor, CAMPAIGN_THEMES, CAMPAIGN_NIGHT_THEMES,
    campaignPalette, PLATFORM_MARKS, platformStyle, platformMarks, random, ellipse, path, stroke, leaf, star,
    sprite, material, cloud, tree, distantIsland, terrain, note, facetedOval, sky, horizon };
})(typeof window !== 'undefined' ? window : globalThis);
