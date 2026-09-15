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
      rock: '#294b54', shade: '#203b46', facet: '#466a72', grass: '#83b7a2', rim: '#c5e5bc', leaf: '#356a69', lightLeaf: '#6c9e85', coral: '#f4a386', stone: '#bcc9b8', cloud: '#8dada7', night: true },
    noon: { ...THEMES.noon, sky: ['#172c38', '#3b5e68', '#839d9b'], sea: '#457f93', far: '#728f9c', middle: '#375c70',
      rock: '#2b475d', shade: '#203549', facet: '#52748c', grass: '#8ebfab', rim: '#dbebbe', leaf: '#416e80', lightLeaf: '#7ab6ae', coral: '#f2a3b7', stone: '#b9cbcb', cloud: '#9ebcbe', night: true },
    sunset: { ...THEMES.sunset, sky: ['#352e38', '#64505b', '#aa8179'], sea: '#538881', far: '#909b98', middle: '#3d6770',
      rock: '#364e5b', shade: '#293a49', facet: '#657c7e', grass: '#9ebc9d', rim: '#e3dbab', leaf: '#446967', lightLeaf: '#81a08a', coral: '#f3ba85', stone: '#c5c4ae', cloud: '#c0a7ad', night: true }
  };
  const paletteFor = (sky, appearance = global.LumenAppearance?.current) => (appearance === 'dark' ? NIGHT_THEMES : THEMES)[sky] || (appearance === 'dark' ? NIGHT_THEMES.dawn : THEMES.dawn);
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
  function stitchedBanner(ctx, x, y, palette) {
    ctx.save(); ctx.translate(x, y);
    const outline = [[-28,0],[28,0],[25,80],[0,98],[-25,80]];
    stroke(ctx, [[-37,-3],[37,-3]], palette.stone, 4);
    path(ctx, outline, palette.coral);
    ctx.save(); ctx.beginPath(); outline.forEach((point,index) => index ? ctx.lineTo(...point) : ctx.moveTo(...point)); ctx.closePath(); ctx.clip();
    for (let thread = 0; thread < 56; thread += 3) stroke(ctx, [[thread-28,0],[thread-33,95]], thread % 2 ? '#fce7b62d' : '#713b4320', .7);
    for (let thread = 2; thread < 100; thread += 4) stroke(ctx, [[-29,thread],[29,thread-1]], '#fff3c029', .7);
    ctx.restore();
    ctx.save(); ctx.setLineDash([2,3]);
    stroke(ctx, [[-22,8],[-20,75],[0,90],[20,75],[22,8]], '#fff0bf', 1.2); ctx.restore();
    ctx.strokeStyle = '#fff0bf'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0,42,15,0,TAU); ctx.stroke();
    star(ctx, 0, 42, 9, '#fff4c7');
    stroke(ctx, [[0,20],[0,15]], '#fff2c5', 1.5);
    for (const side of [-1,1]) leaf(ctx, side*8,66,10,side*.65,'#fff2c590');
    stroke(ctx, [[0,98],[0,109]], palette.stone, 1); ellipse(ctx,0,110,2,3,'#efd29a');
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
  function arch(ctx, palette) {
    ctx.translate(180, 322);
    ctx.strokeStyle = palette.shade + '38'; ctx.lineWidth = 53;
    ctx.beginPath(); ctx.moveTo(-95, 4); ctx.lineTo(-95, -131); ctx.arc(0, -131, 95, Math.PI, TAU); ctx.lineTo(95, 4); ctx.stroke();
    ctx.strokeStyle = palette.stone; ctx.lineWidth = 43;
    ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(-100, -135); ctx.arc(0, -135, 100, Math.PI, TAU); ctx.lineTo(100, 0); ctx.stroke();
    ctx.strokeStyle = '#fffcefbb'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-115, -5); ctx.lineTo(-115, -137); ctx.arc(0, -137, 115, Math.PI, TAU); ctx.stroke();
    for (let index = 0; index < 9; index++) {
      const angle = Math.PI + index / 8 * Math.PI;
      stroke(ctx, [[Math.cos(angle) * 80, -135 + Math.sin(angle) * 80], [Math.cos(angle) * 122, -135 + Math.sin(angle) * 122]], palette.facet + '70', 2);
    }
    stroke(ctx, [[-121, -54], [-98, -61], [-79, -59]], palette.facet + '60', 2);
    path(ctx, [[86, -84], [121, -82], [116, -73], [102, -77]], palette.facet);
    for (const side of [-1, 1]) {
      ctx.fillStyle = palette.stone; ctx.fillRect(side * 100 - 33, -8, 66, 18);
      ctx.fillStyle = palette.grass; ctx.fillRect(side * 100 - 37, -12, 74, 6);
    }
    material(ctx,-139,-265,278,285,'stone',palette,72);
    for (let carving = 0; carving < 5; carving++) {
      const angle = Math.PI + (carving + 1) / 6 * Math.PI;
      const x = Math.cos(angle)*100, y = -135+Math.sin(angle)*100;
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle+Math.PI/2);
      stroke(ctx,[[-5,0],[0,-7],[5,0],[0,7],[-5,0]],palette.facet+'c0',1.1);
      stroke(ctx,[[-3,1],[0,-4],[3,1]],'#ffffdd88',.7); ctx.restore();
    }
    stitchedBanner(ctx, -52, -205, palette);
    ctx.strokeStyle = palette.leaf; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(63, -231); ctx.bezierCurveTo(135, -140, 40, -90, 100, -18); ctx.stroke();
    for (let index = 0; index < 13; index++) {
      const height = -215 + index * 15, x = 86 + Math.sin(index * .5) * 13;
      leaf(ctx, x, height, 14, index % 2 ? .9 : -.9, index % 3 ? palette.lightLeaf : palette.coral);
    }
    star(ctx, 0, -250, 10, '#fff5c7');
    stroke(ctx, [[0, -211], [0, -166]], palette.facet, 1.5);
    path(ctx, [[0, -171], [9, -156], [0, -132], [-9, -156]], palette.coral);
    ellipse(ctx, 0, -154, 3, 6, '#fff9d6');
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
  function leviathan(ctx, x, y, size, time, palette, awakened) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    const wing = Math.sin(time * 1.1) * 14;
    ctx.fillStyle = palette.facet; ctx.beginPath(); ctx.moveTo(-88, -4);
    ctx.bezierCurveTo(-158, -12, -130, -69 - wing, -182, -45 - wing);
    ctx.quadraticCurveTo(-145, 5, -128, 25); ctx.quadraticCurveTo(-107, 12, -71, 12); ctx.fill();
    ctx.fillStyle = awakened ? '#f6f6d9' : '#e4efdd'; ctx.beginPath(); ctx.moveTo(-113, 6);
    ctx.bezierCurveTo(-60, -14, -69, -45, 1, -42); ctx.bezierCurveTo(85, -45, 126, -19, 120, 10);
    ctx.bezierCurveTo(108, 55, -30, 56, -113, 6); ctx.fill();
    ctx.fillStyle = palette.grass; ctx.beginPath(); ctx.moveTo(-89, 13);
    ctx.bezierCurveTo(-15, 45, 73, 34, 112, 15); ctx.bezierCurveTo(73, 57, -21, 59, -89, 13); ctx.fill();
    for (let index = 0; index < 4; index++) {
      leaf(ctx, -24 + index * 18, -34, 23 - index * 3, -.5 + index * .25, index % 2 ? palette.coral : palette.lightLeaf);
    }
    ctx.fillStyle = palette.facet; ctx.beginPath(); ctx.moveTo(16, 18);
    ctx.bezierCurveTo(-10, 24, -4, 65 + wing, 52, 64 + wing); ctx.quadraticCurveTo(38, 36, 47, 19); ctx.fill();
    stroke(ctx, [[3, 24], [19, 48 + wing], [44, 57 + wing]], palette.grass, 2);
    ellipse(ctx, 92, 0, 4.5, 5.5, '#294e57'); ellipse(ctx, 93, -2, 1.5, 1.5, '#ffffff');
    stroke(ctx, [[105, 17], [100, 21], [91, 22]], '#659b94', 1.8);
    for (let index = 0; index < 7; index++) {
      ellipse(ctx, -48 + index * 18, 8 + Math.sin(index * .5) * 7, 2.2, 2.2, awakened ? '#fff5ad' : palette.facet);
    }
    ctx.restore();
  }
  function background(renderer, game, palette, time) {
    const ctx = renderer.ctx, width = renderer.width, height = renderer.height, camera = game.camera.x;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    palette.sky.forEach((color, index) => sky.addColorStop(index / 2, color)); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const sunX = width * .74 - camera * .014, sunY = height * .235;
    const moonRadius = Math.min(width, height) * .079;
    if (palette.night) {
      const skyDetails = sprite(renderer, 'night-sky:' + width + ':' + height, width, height, paint => {
        for (let index = 0; index < 135; index++) {
          const x = random(index + 444) * width, y = random(index + 892) * height * .55;
          paint.globalAlpha = .25 + random(index + 94) * .55;
          if (index % 13 === 0) star(paint, x, y, 2.8, '#fce4bb');
          else ellipse(paint, x, y, .7, .7, '#e2efdf');
        }
        paint.globalAlpha = .35;
        const pattern = [[.24,.18],[.29,.115],[.36,.145],[.395,.09],[.45,.16]];
        stroke(paint, pattern.map(([x,y]) => [x * width, y * height]), '#d5e0c7', .7);
        pattern.forEach(([x,y]) => star(paint, x * width, y * height, 2.5, '#fff0b9'));
      });
      ctx.drawImage(skyDetails, 0, 0);
      ctx.save(); ctx.beginPath(); ctx.arc(sunX, sunY, moonRadius, 0, TAU); ctx.clip();
      ctx.beginPath(); ctx.arc(sunX, sunY, moonRadius, 0, TAU);
      ctx.arc(sunX + moonRadius * .47, sunY - moonRadius * .23, moonRadius * .88, 0, TAU);
      ctx.fillStyle = '#f6e8c3'; ctx.fill('evenodd'); ctx.restore();
    } else ellipse(ctx, sunX, sunY, moonRadius, moonRadius, '#fff4cf');
    ctx.strokeStyle = '#fff8df7a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sunX, sunY, Math.min(width, height) * .105, -.6, 2.5); ctx.stroke();
    for (let index = 0; index < 8; index++) {
      const position = ((index * 347 + time * (2 + index % 3) - camera * .06) % (width + 500) + width + 500) % (width + 500) - 200;
      cloud(ctx, position, height * (.19 + random(index + 40) * .3), .5 + random(index + 9) * .6, palette.night ? .35 : .7, palette.cloud);
    }
    const horizon = height * .59;
    const water = ctx.createLinearGradient(0, horizon, 0, height);
    water.addColorStop(0, palette.sea + '0a'); water.addColorStop(.4, palette.sea + '95'); water.addColorStop(1, palette.middle);
    ctx.fillStyle = water; ctx.fillRect(0, horizon, width, height - horizon);
    for (let layer = 0; layer < 3; layer++) {
      const gap = [440, 610, 900][layer], factor = [.075, .14, .22][layer], offset = camera * factor;
      for (let index = Math.floor(offset / gap) - 1; index < Math.floor((offset + width) / gap) + 2; index++) {
        const islandWidth = [220, 330, 420][layer] + random(index + layer * 7) * 180;
        ctx.save(); ctx.globalAlpha = [.25, .36, .44][layer];
        distantIsland(ctx, index * gap - offset + random(index) * 100, height * [.51, .66, .91][layer] + random(index + 4) * 45,
          islandWidth, layer ? palette.middle : palette.far, palette, index + layer);
        ctx.restore();
      }
    }
    for (let index = 0; index < 22; index++) {
      const depth = random(index + 92), y = horizon + 22 + depth * (height - horizon);
      const x = (random(index + 91) * (width + 220) + time * (3 + depth * 5) - camera * .035) % (width + 220) - 110;
      stroke(ctx, [[x, y], [x + 15 + depth * 72, y]], '#f5f9e8' + (depth > .5 ? '35' : '60'), 1 + depth);
    }
    const awake = game.song.count === 3;
    leviathan(ctx, width * .56 + Math.sin(time * .12) * 26 - camera * .024,
      height * (width < height ? .245 : .31) + Math.sin(time * .75) * 9, Math.min(1.15, width / 900) * (awake ? 1.12 : 1), time, palette, awake);
    if (game.song.count) {
      ctx.save(); ctx.globalAlpha = game.song.bloom * .8;
      const points = [[width * .28, height * .15], [width * .39, height * .11], [width * .47, height * .2]];
      stroke(ctx, points.slice(0, game.song.count), '#ffffde80', 1);
      points.slice(0, game.song.count).forEach(point => star(ctx, point[0], point[1], 4, '#ffffef'));
      ctx.restore();
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
    const variant = Math.floor(platform.baseX || platform.x), depth = isGround ? 300 : 77;
    const image = sprite(renderer, 'terrain:' + width + ':' + isGround + ':' + variant, width + 36, depth + 36, paint => {
      paint.translate(18, 26);
      const points = [[0, 0], [width, 0], [width - 18, depth * .29], [width * .85, depth * .69],
        [width * .69, depth * .77], [width * .49, depth], [width * .34, depth * .73], [width * .11, depth * .7], [15, depth * .25]];
      path(paint, points, palette.rock); paint.save(); paint.beginPath(); points.forEach((point, index) => index ? paint.lineTo(...point) : paint.moveTo(...point)); paint.closePath(); paint.clip();
      for (let index = 0; index < Math.ceil(width / 85); index++) {
        const x = index * 94 - 35, lower = depth * (.25 + random(index + variant) * .6);
        path(paint, [[x, 10], [x + 130, 4], [x + 81, lower], [x + 35, depth + 40]], index % 2 ? palette.shade : palette.facet);
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
      path(paint, [[0, 0], [width, 0], [width - 9, 12], [width * .73, 18], [width * .4, 12], [12, 18]], palette.grass);
      stroke(paint, [[1, 0], [width - 1, 0]], palette.rim, 4);
      for (let index = 0; index < width / 16; index++) {
        const x = 8 + index * 16, length = 5 + random(index + variant) * 15;
        leaf(paint, x, 0, length, (random(index + 46) - .5) * 1.9, index % 5 ? palette.grass : palette.rim);
        if (index % 7 === 0) {
          stroke(paint, [[x, 0], [x + 2, -18]], palette.leaf, 1);
          for (let petal = 0; petal < 4; petal++) ellipse(paint, x + Math.cos(petal * Math.PI / 2) * 3, -19 + Math.sin(petal * Math.PI / 2) * 3, 3.5, 2.5, palette.coral, petal);
          ellipse(paint, x, -19, 1.8, 1.8, '#fff3bd');
        }
      }
      for (let vine = 0; vine < Math.ceil(width / 125); vine++) {
        const x = 30 + vine * 127, length = (isGround ? 48 : 20) + random(vine + variant) * 48;
        stroke(paint, [[x, 12], [x + 5, length * .4], [x - 5, length]], palette.lightLeaf, 2);
        for (let index = 0; index < length / 15; index++) leaf(paint, x, 16 + index * 14, 10, index % 2 ? 1 : -1, palette.lightLeaf);
      }
    });
    ctx.drawImage(image, platform.x - 18, platform.y - 26);
  }
  function wisp(ctx, echo, time, found = false, night = false) {
    const x = found ? echo.followX : echo.x, y = (found ? echo.followY : echo.y) + Math.sin(time * 2.2 + echo.voice) * 5;
    const size = found ? .72 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    if (!found) {
      ctx.strokeStyle = echo.color + '75'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 7]);
      ctx.beginPath(); ctx.arc(0, 0, 32 + Math.sin(time * 2) * 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      star(ctx, 0, -48 + Math.sin(time * 2) * 3, 8, '#fff7d1');
    }
    leaf(ctx, -8, -8, 13, -.8 - Math.sin(time * 3) * .1, echo.color);
    leaf(ctx, 8, -8, 13, .8 + Math.sin(time * 3) * .1, echo.color);
    ellipse(ctx, 0, 0, 17, 15, echo.color); ellipse(ctx, 0, 2, 12, 10, '#fff8df');
    if (found) {
      ellipse(ctx, -4, 0, 1.6, 2.6, '#315859'); ellipse(ctx, 4, 0, 1.6, 2.6, '#315859');
    } else {
      stroke(ctx, [[-8, 0], [-5, 2], [-2, 0]], '#476268', 1.6);
      stroke(ctx, [[2, 0], [5, 2], [8, 0]], '#476268', 1.6);
    }
    ellipse(ctx, -10, 5, 2.4, 1.5, '#ef9c8b'); ellipse(ctx, 10, 5, 2.4, 1.5, '#ef9c8b');
    if (!found) {
      ctx.textAlign = 'center'; ctx.font = '600 13px ' + (global.LumenI18n?.canvasFont || 'Outfit, sans-serif'); ctx.fillStyle = night ? '#f3efd0' : '#245c60';
      ctx.direction = global.LumenI18n?.direction || 'ltr';
      ctx.fillText(global.LumenI18n?.t(echo.name) || echo.name, 0, 51);
    }
    ctx.restore();
  }
  function drawLumen(ctx, player, time, flight = false) {
    const center = player.x + (player.w || 32) / 2, foot = player.y + (player.h || 46);
    const speed = Math.abs(player.vx || 0), direction = player.facing || 1, dashing = player.dashTime > 0;
    ctx.save();
    if (player.invuln > 0 && Math.floor(time * 16) % 2) ctx.globalAlpha *= .4;
    if (player.grounded) ellipse(ctx, center, foot + 2, player.slide ? 27 : 22, 4, '#1d5b5c40');
    if (player.power && (player.powerTime === undefined || player.powerTime > 0)) {
      const color = { bloom: '#ffc193', breeze: '#b5f3d0', comet: '#dbb2f6', echo: '#c5f5de' }[player.power];
      const expiring = player.powerTime > 0 && player.powerTime <= 5;
      if (color) {
        ctx.save(); ctx.globalAlpha *= expiring ? .25 + Math.abs(Math.sin(time * 10)) * .75 : 1;
        ctx.save(); ctx.globalAlpha *= .18;
        ellipse(ctx, center, foot - 30, 32 + Math.sin(time * 4) * 3, 39, color); ctx.restore();
        for (let spark = 0; spark < 3; spark++) star(ctx, center + Math.sin(time * 3 + spark * 2.1) * 32,
          foot - 30 + Math.cos(time * 3 + spark * 2.1) * 33, 2.7, color);
        if (expiring) {
          ctx.strokeStyle = color + 'a0'; ctx.lineWidth = 1.3; ctx.beginPath();
          ctx.arc(center, foot - 30, 39, -Math.PI / 2, -Math.PI / 2 + TAU * player.powerTime / 5); ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (dashing) for (let trail = 0; trail < 3; trail++) {
      stroke(ctx, [[center - direction * (27 + trail * 7), foot - 18 - trail * 12],
        [center - direction * (58 + trail * 9), foot - 18 - trail * 12]], '#f8eccb', 3 - trail * .6);
    }
    ctx.translate(center, foot); ctx.scale(1.2, 1.2);
    const stride = player.grounded ? Math.sin((player.anim || 0) * 1.5) * Math.min(6, speed / 55) : 3;
    const jump = Math.sin(Math.min(1, Math.max(0, player.jumpTimer || 0) / .16) * Math.PI) * .13;
    const squash = (player.landTimer > 0 ? 1 - player.landTimer * .7 : 1) + jump;
    ctx.scale((1 / squash) * (dashing ? 1.16 : 1), squash * (player.slide ? .61 : dashing ? .86 : 1));
    ctx.rotate(player.dead ? -.5 * direction : player.slide ? .2 * direction : dashing ? .18 * direction : (player.vx || 0) * .00009);
    if (player.dead) ctx.globalAlpha *= .6;
    if (flight && player.gliding && !player.grounded && !player.dead) {
      for (const side of [-1, 1]) {
        ctx.save(); ctx.scale(side, 1); ctx.rotate(Math.sin(time * 4) * .06);
        ctx.fillStyle = '#d9f8d4'; ctx.strokeStyle = '#67baa5'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(7, -24); ctx.bezierCurveTo(26, -52, 61, -57, 72, -30);
        ctx.quadraticCurveTo(56, -34, 48, -18); ctx.quadraticCurveTo(35, -26, 29, -10);
        ctx.quadraticCurveTo(16, -16, 7, -24); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.clip();
        for (let thread = 15; thread < 73; thread += 3) stroke(ctx,[[thread,-55],[thread+5,-8]],'#5c9b8829',.5);
        for (let thread = -49; thread < -12; thread += 4) stroke(ctx,[[9,thread],[72,thread+2]],'#ffffff38',.5);
        ctx.restore();
        stroke(ctx, [[10, -25], [34, -35], [64, -32]], '#86c8af', 1);
        ctx.save(); ctx.setLineDash([1.3,2.5]); stroke(ctx,[[13,-25],[32,-41],[51,-44],[65,-34]],'#528e7d',.65); ctx.restore();
        star(ctx,39,-35,4,'#f8edb7'); ctx.restore();
      }
    }
    ctx.save(); ctx.scale(direction, 1);
    ctx.fillStyle = '#e98c73'; ctx.beginPath(); ctx.moveTo(-4, -25);
    ctx.bezierCurveTo(-19, -26, -32, -18 + Math.sin(time * 8) * 5, -50 - speed * .025, -28 + Math.sin(time * 6) * 6);
    ctx.lineTo(-41, -19 + Math.sin(time * 6) * 6); ctx.bezierCurveTo(-27, -8, -15, -16, -3, -20); ctx.fill();
    ctx.save(); ctx.clip();
    for (let thread = -57; thread < -4; thread += 3) stroke(ctx,[[thread,-40],[thread+5,-5]],'#6a40582d',.6);
    ctx.restore();
    ctx.save(); ctx.setLineDash([1.6,1.5]);
    stroke(ctx, [[-13, -22], [-27, -19], [-40, -24 + Math.sin(time * 6) * 5]], '#ffe2ac', .9); ctx.restore(); ctx.restore();
    ellipse(ctx, -7 + stride, -2, 6, 3.7, '#234f53', -.15); ellipse(ctx, 7 - stride, -2, 6, 3.7, '#234f53', .15);
    ellipse(ctx, 0, -15, 12.5, 16, '#387d76'); ellipse(ctx, 1, -15, 7.5, 11, '#99d1b7');
    ctx.save(); ctx.setLineDash([1,2]); stroke(ctx,[[-7,-19],[-8,-9],[0,-3],[8,-9],[7,-19]],'#d2e4b3',.7); ctx.restore();
    star(ctx, 0, -14, 4, '#f3d096'); ellipse(ctx,0,-14,1.5,1.5,'#fff0ce');
    leaf(ctx, -9, -36, 17, -.56 - Math.sin(time * 2) * .04, '#306f70');
    leaf(ctx, 9, -36, 17, .5 + Math.sin(time * 2) * .05, '#306f70');
    leaf(ctx, -10, -39, 11, -.56, '#a6dfc6'); leaf(ctx, 10, -39, 11, .5, '#a6dfc6');
    ctx.fillStyle = '#fff7dc'; ctx.beginPath(); ctx.moveTo(-17, -33);
    ctx.bezierCurveTo(-25, -48, 3, -56, 17, -42); ctx.bezierCurveTo(28, -33, 15, -21, 0, -22);
    ctx.bezierCurveTo(-9, -21, -17, -25, -17, -33); ctx.fill();
    const blink = Math.sin(time * 1.4) > .994, facing = direction * 2;
    if (player.dead) for (const eye of [-6 + facing, 5 + facing]) {
      stroke(ctx, [[eye - 2, -37], [eye + 2, -33]], '#25575b', 1.6);
      stroke(ctx, [[eye - 2, -33], [eye + 2, -37]], '#25575b', 1.6);
    } else {
      ellipse(ctx, -6 + facing, -35, 2.4, blink ? .7 : 4, '#25575b');
      ellipse(ctx, 5 + facing, -35, 2.4, blink ? .7 : 4, '#25575b');
      if (!blink) { ellipse(ctx, -5.3 + facing, -36.4, .8, 1.1, '#ffffff'); ellipse(ctx, 5.7 + facing, -36.4, .8, 1.1, '#ffffff'); }
    }
    ellipse(ctx, -12, -30, 3, 1.7, '#edba9c'); ellipse(ctx, 12, -30, 3, 1.7, '#edba9c');
    star(ctx, 0, -47, 3.6, '#edc371');
    ctx.strokeStyle = '#ed9b77'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -23, 10, 3, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
  }
  function lantern(ctx, checkpoint, time, palette) {
    const x = checkpoint.x, y = checkpoint.y;
    stroke(ctx, [[x, y], [x - 4, y - 64], [x + 12, y - 80], [x + 26, y - 70]], palette.stone, 5);
    stroke(ctx, [[x + 26, y - 70], [x + 26, y - 58]], palette.leaf, 1.5);
    const bob = Math.sin(time * 1.6) * 2;
    path(ctx, [[x + 26, y - 63 + bob], [x + 38, y - 49 + bob], [x + 26, y - 31 + bob], [x + 14, y - 49 + bob]], checkpoint.active ? '#f5cf7b' : '#80bba8');
    ellipse(ctx, x + 26, y - 49 + bob, 4, 7, checkpoint.active ? '#fff6cc' : '#c6e6c7');
    if (checkpoint.active) star(ctx, x + 26, y - 49 + bob, 8, '#fff4c5');
    stroke(ctx,[[x+17,y-48+bob],[x+26,y-38+bob],[x+35,y-48+bob]],'#ffedb17a',1);
    for (let mark=0;mark<3;mark++) stroke(ctx,[[x-3,y-20-mark*11],[x+2,y-23-mark*11]],palette.facet,1);
    leaf(ctx, x - 3, y - 4, 16, -.7, palette.lightLeaf);
  }
  function portal(ctx, game, time, palette) {
    const exit = game.exit, x = exit.x + exit.w / 2, bottom = exit.y + exit.h;
    ctx.save(); ctx.translate(x, bottom);
    const gradient = ctx.createLinearGradient(0, -150, 0, 0);
    gradient.addColorStop(0, exit.open ? '#fff2b4c9' : '#a5d8c340'); gradient.addColorStop(1, exit.open ? '#b1f0d281' : '#c0e4d21a');
    ellipse(ctx, 0, -78, 50, 78, gradient);
    ctx.strokeStyle = palette.stone; ctx.lineWidth = 13; ctx.beginPath(); ctx.ellipse(0, -78, 58, 88, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fff8dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -78, 53, 84, 0, 0, TAU); ctx.stroke();
    for (let index = 0; index < 3; index++) star(ctx, (index - 1) * 30, -185 - (index === 1 ? 8 : 0), 7,
      index < game.song.count ? '#fff4be' : palette.facet);
    for (let index = 0; index < 6; index++) leaf(ctx, 52, -15 - index * 18, 17, .7, index % 2 ? palette.coral : palette.lightLeaf);
    if (exit.open) {
      for (let index = 0; index < 14; index++) {
        const y = -((time * 32 + index * 21) % 140), x = Math.sin(index * 19 + time) * 35;
        star(ctx, x, y - 7, 2 + index % 3, '#fff9d9');
      }
    }
    ctx.restore();
  }
  function draw(renderer, game) {
    const ctx = renderer.ctx, data = game.level.song, palette = paletteFor(data.sky);
    const time = game.progress.settings.reducedEffects ? 0 : game.time;
    const assetKey = game.level.key + ':' + (palette.night ? 'night' : 'day');
    if (renderer.songKey !== assetKey) { renderer.songKey = assetKey; renderer.songAssets = new Map(); }
    renderer.sceneMode = 'song';
    const portrait = renderer.width < renderer.height;
    const scale = portrait ? renderer.width / 510 : Math.max(.64, renderer.height / 790);
    renderer.scale = scale; renderer.worldWidth = renderer.width / scale;
    renderer.offsetX = 0; renderer.offsetY = renderer.height * (portrait ? .72 : renderer.height < 500 ? .69 : .79) - 600 * scale;
    renderer.cameraX = game.camera.x; renderer.cameraY = 0;
    ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0); ctx.globalAlpha = 1;
    background(renderer, game, palette, time);
    ctx.save(); ctx.translate(0, renderer.offsetY); ctx.scale(scale, scale);
    ctx.translate(-game.camera.x + Math.sin(time * 90) * game.camera.shake, 0);
    const visible = (x, width = 0, margin = 150) => x + width > game.camera.x - margin && x < game.camera.x + renderer.worldWidth + margin;
    for (const current of data.wind) {
      if (!visible(current.x, current.w)) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(current.x, current.y, current.w, current.h); ctx.clip();
      for (let index = 0; index < 18; index++) {
        const x = current.x + 15 + random(index + 122) * (current.w - 30);
        const y = current.y + current.h - ((time * (72 + index % 4 * 20) + index * 49) % current.h);
        ctx.strokeStyle = '#f5ffdc90'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + 25);
        ctx.quadraticCurveTo(x + 11, y + 13, x + 2, y - 12); ctx.stroke();
        if (index % 3 === 0) leaf(ctx, x, y, 7, -.3, '#e7f9c9');
      }
      ctx.restore();
    }
    for (const decoration of data.scenery) {
      if (!visible(decoration.x - 240 * decoration.size, 480 * decoration.size)) continue;
      const isTree = decoration.type === 'tree', width = isTree ? 460 : 360, height = isTree ? 440 : 350;
      const image = sprite(renderer, decoration.type, width, height, paint => isTree ? tree(paint, palette) : arch(paint, palette));
      ctx.drawImage(image, decoration.x - (isTree ? 230 : 180) * decoration.size,
        decoration.y - (isTree ? 416 : 322) * decoration.size, width * decoration.size, height * decoration.size);
    }
    for (const platform of game.platforms) {
      if (!visible(platform.x, platform.w)) continue;
      terrain(renderer, platform, palette);
      if (game.song.bloom < .01 || !platform.active || platform.wakeId) continue;
      const flowers = sprite(renderer, 'flowers:' + platform.w, platform.w, 80, paint => {
        for (let index = 0; index < platform.w / 55; index++) {
          const x = 18 + index * 55, height = 23 + random(index + 16) * 33;
          stroke(paint, [[x, 80], [x - 4, 80 - height * .7], [x, 80 - height]], palette.leaf, 1.8);
          leaf(paint, x, 67, 13, index % 2 ? .9 : -.8, palette.lightLeaf);
          for (let petal = 0; petal < 5; petal++) {
            const angle = petal / 5 * TAU;
            ellipse(paint, x + Math.cos(angle) * 6, 80 - height + Math.sin(angle) * 6, 7, 4.5, index % 3 ? palette.coral : '#f3cf85', angle);
          }
          ellipse(paint, x, 80 - height, 3.5, 3.5, '#fff5c7');
        }
      });
      ctx.save(); ctx.globalAlpha = game.song.bloom;
      ctx.drawImage(flowers, platform.x, platform.y - 80);
      if (game.song.count >= 2 && platform.type === 'ground' && platform.x > 1000) {
        const fallX = platform.x + platform.w - 70;
        const water = ctx.createLinearGradient(0, platform.y, 0, platform.y + 370);
        water.addColorStop(0, '#e2fff0cc'); water.addColorStop(1, '#d2fff000');
        ctx.fillStyle = water; ctx.fillRect(fallX, platform.y + 3, 19, 370);
        ctx.strokeStyle = '#ffffffa0'; ctx.lineWidth = 2;
        for (let flow = 0; flow < 6; flow++) {
          const y = platform.y + (time * 110 + flow * 61) % 340;
          stroke(ctx, [[fallX + 5 + flow % 3 * 4, y], [fallX + 5 + flow % 3 * 4, y + 19]], '#ffffffa0', 1.5);
        }
      }
      ctx.restore();
    }
    for (const wake of game.wakeables) {
      if (!visible(wake.x)) continue;
      if (wake.type === 'chime') {
        stroke(ctx, [[wake.x - 9, wake.y + 26], [wake.x - 9, wake.y - 32], [wake.x + 9, wake.y - 32]], palette.stone, 4);
        stroke(ctx, [[wake.x + 9, wake.y - 32], [wake.x + 9, wake.y - 12]], palette.leaf, 1);
        path(ctx, [[wake.x + 9, wake.y - 15], [wake.x + 22, wake.y + 4], [wake.x + 9, wake.y + 21], [wake.x - 4, wake.y + 4]], wake.state === 'awake' ? '#fff2bb' : '#d6e6c6');
        star(ctx, wake.x + 9, wake.y + 3, 5, palette.coral);
      } else if (wake.type === 'bloom') {
        for (let petal = 0; petal < 6; petal++) leaf(ctx, wake.x, wake.y + 8, wake.state === 'awake' ? 26 : 13, petal * TAU / 6, palette.coral);
        ellipse(ctx, wake.x, wake.y + 4, 7, 5, '#fff0aa');
      }
    }
    for (const checkpoint of game.checkpoints) if (visible(checkpoint.x)) lantern(ctx, checkpoint, time, palette);
    if (visible(game.exit.x)) portal(ctx, game, time, palette);
    for (const note of game.collectibles) {
      if (note.taken || !visible(note.x, 0, 30)) continue;
      const y = note.y + Math.sin(time * 2.4 + note.x * .02) * 4, souvenir = note.type === 'star';
      ctx.save(); ctx.translate(note.x, y);
      if (souvenir) {
        ctx.rotate(time * .3); ctx.strokeStyle = '#fff2c49c'; ctx.lineWidth = 1.5; ctx.strokeRect(-17, -17, 34, 34);
        star(ctx, 0, 0, 17, '#fff9da'); star(ctx, 0, 0, 10, '#efb967');
      } else {
        ellipse(ctx, 0, 0, 7, 9, '#f4c967', .25); ellipse(ctx, -1, -2, 3, 4.5, '#fff6c0', .25);
        stroke(ctx, [[5, 0], [7, -15], [12, -12]], '#ffefb3', 2);
      }
      ctx.restore();
    }
    for (const echo of game.song.lights) if (echo.found || visible(echo.x)) wisp(ctx, echo, time, echo.found, palette.night);
    if (game.player.gliding || game.song.combo >= 5) {
      const trail = game.song.trail;
      for (let index = 1; index < trail.length; index++) {
        const first = trail[index - 1], second = trail[index];
        ctx.save(); ctx.globalAlpha = index / trail.length * .55;
        stroke(ctx, [[first.x, first.y], [second.x, second.y]], '#f7f4b4', index / trail.length * 4); ctx.restore();
      }
    }
    global.LumenSongArt.drawLumen(ctx, game.player, time, true);
    for (const wave of game.waves) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - wave.radius / wave.reach) * .8;
      ctx.strokeStyle = '#faffd8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius * .87, 0, TAU); ctx.stroke(); ctx.restore();
    }
    for (const particle of game.particles) {
      ctx.save(); ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.type === 'petal' || particle.type === 'leaf') leaf(ctx, particle.x, particle.y, particle.size * 1.6, particle.life * 5, particle.color);
      else star(ctx, particle.x, particle.y, particle.size, particle.color);
      ctx.restore();
    }
    for (const text of game.floatingTexts) {
      ctx.save(); ctx.globalAlpha = Math.min(1, Math.max(0, text.life)); ctx.textAlign = 'center';
      ctx.font = '600 16px ' + (global.LumenI18n?.canvasFont || 'Outfit, sans-serif'); ctx.fillStyle = '#fff6d8'; ctx.strokeStyle = '#285a5b'; ctx.lineWidth = 3;
      const label = global.LumenI18n?.t(text.text) || text.text;
      ctx.direction = global.LumenI18n?.direction || 'ltr';
      ctx.strokeText(label, text.x, text.y); ctx.fillText(label, text.x, text.y); ctx.restore();
    }
    ctx.restore();
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side < 0 ? 0 : renderer.width, renderer.height + 18); ctx.scale(side < 0 ? 1 : -1, 1);
      for (let index = 0; index < 7; index++) leaf(ctx, index * 13, 6, (55 + random(index + 21) * 50) * Math.min(1, renderer.height / 650),
        .12 + index * .2 + Math.sin(time + index) * .015, index % 3 ? palette.leaf : palette.lightLeaf);
      ctx.restore();
    }
    if (renderer.height < 520 && renderer.width > renderer.height) {
      const haze = ctx.createLinearGradient(0, 0, 0, 145);
      haze.addColorStop(0, palette.sky[0]); haze.addColorStop(.6, palette.sky[0] + 'd9'); haze.addColorStop(1, palette.sky[0] + '00');
      ctx.fillStyle = haze; ctx.fillRect(0, 0, renderer.width, 145);
    }
    const grain = sprite(renderer, 'grain', 160, 160, paint => {
      for (let index = 0; index < 1200; index++) {
        paint.fillStyle = index % 2 ? '#ffffff0a' : '#15515607';
        paint.fillRect(random(index) * 160, random(index + 99) * 160, 1, 1);
      }
    });
    const pattern = ctx.createPattern(grain, 'repeat');
    if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, renderer.width, renderer.height); }
  }
  global.LumenSongArt = { draw, drawLumen, THEMES, NIGHT_THEMES, paletteFor };
})(typeof window !== 'undefined' ? window : globalThis);