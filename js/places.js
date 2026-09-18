/* Six places, six physical decisions. Their state belongs to one visit, never
 * to the renderer. Platforms remain ordinary collision surfaces for the engine. */
(function (global) {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const approach = (value, target, step) => value < target ? Math.min(target, value + step) : Math.max(target, value - step);
  const touched = (game, object, id) => game.waves.some(wave => {
    const key = 'place:' + id;
    if (wave.touched.has(key) || Math.hypot(wave.x - object.x, wave.y - object.y) > wave.radius) return false;
    wave.touched.add(key); return true;
  });
  function create(game) {
    const config = game.level.place;
    if (!config) return null;
    const state = { kind: config.kind, metrics: {}, elapsed: 0 };
    if (config.kind === 'ride') {
      state.mount = game.enemies.find(enemy => enemy.mount);
      state.deck = game.platforms.find(platform => platform.placeRole === 'mount');
      // Un aller-retour peut commencer à l'autre bout : le dormeur attend alors
      // à `toX` et part vers la gauche.
      state.direction = config.startAt === 'to' ? -1 : 1; state.metrics.carriedDistance = 0;
      if (config.returnAt) state.metrics.returnedHigh = false;
    }
    if (config.kind === 'escort') {
      // L'astre ne marche plus seul : on le prend, on le porte, on le pose.
      // Sa lumière fait exister les passerelles autour de lui, où qu'il soit.
      state.astre = { x: config.startX, y: config.starY, carried: false, arrived: false };
      state.lights = game.platforms.filter(platform => platform.placeRole === 'astre-light');
      state.metrics.carriedDistance = 0; state.metrics.lightLandings = 0; state.metrics.placements = 0;
      state.metrics.escortArrived = false; state.lastLanding = null;
      lightAround(state, config); game.exit.open = false;
    }
    if (config.kind === 'chain') {
      state.keepers = config.keepers.map(keeper => ({ ...keeper, remaining: 0, pulse: 0 }));
      state.propagation = []; state.metrics.chainWakes = 0; state.metrics.bridgeDistance = 0;
      state.worn = false; if (config.wear) { state.metrics.worn = false; state.metrics.wornWakes = 0; }
      for (const platform of game.platforms.filter(p => p.placeRole === 'living-bridge')) platform.active = false;
    }
    if (config.kind === 'river') {
      state.light = 0; state.restored = false;
      state.metrics.beaconsLit = 0; state.metrics.riverRestored = false; game.exit.open = false;
      if (config.flood) {
        state.flooded = false; state.metrics.flooded = false; state.metrics.raftLandings = 0; state.lastLanding = null;
        state.floodPlatforms = game.platforms.filter(platform => ['flood-bed', 'flood-raft'].includes(platform.placeRole));
        for (const platform of state.floodPlatforms) platform.active = false;
      }
    }
    if (config.kind === 'ascent') {
      state.peakY = game.player.y; state.metrics.climbed = 0; state.metrics.peakY = state.peakY;
    }
    if (config.kind === 'rain') {
      // Chaque nuage tient sa propre ronde au-dessus d'un seul vide. Il ne
      // répond à rien : on lit son rythme, puis on choisit quand partir.
      state.clouds = config.clouds.map(route => ({ ...route, y: 220, x: route.from, direction: 1, alpha: 0, stage: 'forming' }));
      state.cloud = state.clouds[0];
      state.metrics.rainGrown = 0; state.metrics.rainLandings = 0; state.lastLanding = null;
      for (const platform of game.platforms.filter(p => p.placeRole === 'rain-step')) {
        platform.active = false; platform.rainLife = 0; platform.charge = 0;
      }
    }
    return state;
  }
  function wakeKeeper(game, state, index, propagate) {
    const keeper = state.keepers[index];
    if (!keeper) return;
    const config = game.level.place;
    if (keeper.remaining <= 0) { state.metrics.chainWakes++; if (state.worn) state.metrics.wornWakes++; }
    keeper.remaining = (state.worn ? config.wear.wakeTime : config.wakeTime) || 9;
    keeper.pulse = .4;
    if (propagate) {
      // Each neighbour sings in turn. Refreshing any member renews the whole
      // chain once, rather than an exponentially repeating resonance loop.
      // Usée par la nuit, la voix ne va plus qu'aux voisins immédiats.
      const range = state.worn ? 1 : Infinity;
      state.propagation = state.keepers.map((_, next) => ({ index: next, delay: Math.abs(next - index) * .24 }))
        .filter(item => item.index !== index && Math.abs(item.index - index) <= range);
    }
    game.audio.sfx('wakeBridge');
  }
  function beforePhysics(game, dt) {
    const state = game.place, config = game.level.place;
    if (!state || !config) return;
    state.elapsed += dt;
    if (state.kind === 'ride') {
      const mount = state.mount, deck = state.deck;
      const old = deck.x;
      if (mount.calmTime > 0) {
        deck.x += state.direction * config.speed * dt;
        if (deck.x >= config.toX) { deck.x = config.toX; state.direction = -1; }
        if (deck.x <= config.fromX) { deck.x = config.fromX; state.direction = 1; }
      }
      deck.dx = deck.x - old; deck.dy = 0;
      mount.x = deck.x; mount.y = deck.y + 3; mount.facing = state.direction;
      if (game.player.standingPlatform === deck) state.metrics.carriedDistance += Math.abs(deck.dx);
      // Le retour par les hauteurs : avoir été porté, puis atteindre le haut
      // de la falaise, là où l'île de départ ne mène jamais.
      const back = config.returnAt, p = game.player;
      if (back && !state.metrics.returnedHigh && state.metrics.carriedDistance > 800 &&
        p.x + p.w / 2 >= back.x && p.y + p.h <= back.surfaceY + 6) state.metrics.returnedHigh = true;
    }
    if (state.kind === 'escort') carryBeforePhysics(game, state, config);
    if (state.kind === 'chain') {
      for (let index = 0; index < state.keepers.length; index++) {
        const keeper = state.keepers[index];
        keeper.remaining = Math.max(0, keeper.remaining - dt); keeper.pulse = Math.max(0, keeper.pulse - dt);
        if (touched(game, keeper, 'keeper-' + index)) wakeKeeper(game, state, index, true);
      }
      for (const event of state.propagation) { event.delay -= dt; if (event.delay <= 0) wakeKeeper(game, state, event.index, false); }
      state.propagation = state.propagation.filter(event => event.delay > 0);
      // L'usure : poser le pied au-delà de la première travée — sur l'île du
      // milieu ou ses corniches, n'importe quoi sauf un tablier — fait tomber
      // la nuit. Le chant en cours faiblit, et ne se propage plus qu'aux voisins.
      const p = game.player;
      if (config.wear && !state.worn && p.standingPlatform && p.standingPlatform.placeRole !== 'living-bridge' &&
        p.x + p.w / 2 >= config.wear.atX) {
        state.worn = true; state.metrics.worn = true; state.propagation = [];
        for (const keeper of state.keepers) keeper.remaining = Math.min(keeper.remaining, config.wear.falter || 1.2);
        game.audio.sfx('wakeEnd'); game.emit('toast', 'La nuit tombe sur le pont. Le chant des veilleurs s’use.');
      }
      const awake = state.keepers.every(keeper => keeper.remaining > 0);
      for (const platform of game.platforms.filter(p => p.placeRole === 'living-bridge')) {
        // Un tablier tient tant que les deux veilleurs qui le bordent chantent.
        const pair = platform.between ? platform.between.map(index => state.keepers[index]) : state.keepers;
        const held = platform.between ? pair.every(keeper => keeper.remaining > 0) : awake;
        platform.active = held;
        platform.warning = held && pair.some(keeper => keeper.remaining < 1.5);
        if (game.player.standingPlatform === platform) state.metrics.bridgeDistance += Math.abs(game.player.vx) * dt;
      }
    }
    if (state.kind === 'rain') {
      for (const cloud of state.clouds) placeCloud(cloud, state.elapsed);
      for (const platform of game.platforms.filter(p => p.placeRole === 'rain-step')) {
        platform.rainLife = Math.max(0, platform.rainLife - dt);
        const raining = state.clouds.some(cloud => cloud.alpha > .5 && Math.abs(platform.x + platform.w / 2 - cloud.x) < 112);
        platform.charge = clamp(platform.charge + dt * (raining ? 1 : -.5), 0, .55);
        if (platform.charge >= .55 && raining) {
          if (!platform.active) { state.metrics.rainGrown++; game.audio.sfx('wakeBloom'); }
          platform.rainLife = config.life || 8;
        }
        platform.active = platform.rainLife > 0;
        platform.warning = platform.active && platform.rainLife < 1.5;
      }
    }
  }
  /** Où est un nuage à l'instant `time`. Une ronde fixe, toujours dans le
   *  sens du voyage : il se forme au-dessus de la rive, traverse, se défait
   *  au-dessus de l'autre rive, puis se reforme au départ. Une fonction du
   *  temps seul — le même nuage au même moment, quoi que fasse le joueur, et
   *  une chute ne dérègle rien. Qui arrive trop tard attend moins de dix
   *  secondes le passage suivant. */
  function placeCloud(cloud, time) {
    const travel = Math.abs(cloud.to - cloud.from) / cloud.speed, rest = cloud.rest || 1.6, fade = cloud.fade || .8;
    const period = rest + travel + fade;
    const t = ((time + (cloud.phase || 0)) % period + period) % period;
    cloud.direction = Math.sign(cloud.to - cloud.from) || 1;
    if (t < rest) { cloud.x = cloud.from; cloud.alpha = Math.min(1, t / (rest * .6)); cloud.stage = 'forming'; }
    else if (t < rest + travel) { cloud.x = cloud.from + (cloud.to - cloud.from) * (t - rest) / travel; cloud.alpha = 1; cloud.stage = 'crossing'; }
    else { cloud.x = cloud.to; cloud.alpha = Math.max(0, 1 - (t - rest - travel) / fade); cloud.stage = 'fading'; }
  }
  /** La crue. Déclenchée une fois, par le nombre de reflets rendus, et
   *  jamais défaite : l'eau monte à sa vitesse, les radeaux montent avec
   *  elle, et le lit du gouffre devient un fond où l'on nage au lieu d'un
   *  vide où l'on tombe. */
  function flood(game, state, rule, dt) {
    if (!state.flooded && state.metrics.beaconsLit >= rule.after) {
      state.flooded = true; state.metrics.flooded = true;
      state.waterY = rule.from || 700;
      for (const platform of state.floodPlatforms) platform.active = true;
      game.audio.sfx('wakeBridge'); game.shake?.(4);
      game.emit('toast', 'La rivière se souvient, et déborde.');
    }
    if (!state.flooded) return;
    state.waterY = Math.max(rule.y, state.waterY - (rule.rise || 70) * dt);
    game.level.water = { y: state.waterY, start: rule.start, end: rule.end };
    for (const platform of state.floodPlatforms) {
      if (platform.placeRole !== 'flood-raft') continue;
      const old = platform.y;
      // Un radeau flotte : tant que l'eau monte, il monte avec elle.
      platform.y = Math.max(platform.baseY, state.waterY + 10);
      platform.dy = platform.y - old;
    }
    const landing = game.player.standingPlatform;
    if (landing?.placeRole === 'flood-raft' && landing !== state.lastLanding) state.metrics.raftLandings++;
    state.lastLanding = landing;
  }
  /** La distance d'un point au rectangle d'une plateforme. */
  function reachOf(platform, x, y) {
    const dx = Math.max(platform.x - x, 0, x - platform.x - platform.w);
    const dy = Math.max(platform.y - y, 0, y - platform.y - (platform.h || 22));
    return Math.hypot(dx, dy);
  }
  function lightAround(state, config) {
    for (const platform of state.lights) {
      const lit = reachOf(platform, state.astre.x, state.astre.y) <= (config.reach || 250);
      platform.active = lit;
      // Le bord du halo prévient : une passerelle qui va s'éteindre tremble.
      platform.warning = lit && reachOf(platform, state.astre.x, state.astre.y) > (config.reach || 250) - 40;
    }
  }
  function carryBeforePhysics(game, state, config) {
    const astre = state.astre, p = game.player;
    const center = p.x + p.w / 2;
    if (!astre.arrived && game.input.just('action')) {
      if (astre.carried && p.grounded) {
        // Posé au pied du joueur, à hauteur de poitrine : il reste là, il
        // continue d'éclairer, et on part sans lui — mais pas loin.
        astre.carried = false; astre.x = center; astre.y = p.y + 8;
        state.metrics.placements++; game.audio.sfx('wakeEnd');
      } else if (!astre.carried && Math.hypot(astre.x - center, astre.y - (p.y + p.h / 2)) < 64) {
        astre.carried = true; game.audio.sfx('wakeBloom');
      }
    }
    if (astre.carried) { astre.x = center; astre.y = p.y - 24; }
    p.burden = astre.carried;
    lightAround(state, config);
  }
  function carryAfterPhysics(game, state, config) {
    const astre = state.astre, p = game.player;
    if (astre.carried) {
      const oldX = astre.x, oldY = astre.y;
      astre.x = p.x + p.w / 2; astre.y = p.y - 24;
      state.metrics.carriedDistance += Math.hypot(astre.x - oldX, astre.y - oldY);
    }
    const landing = p.standingPlatform;
    if (landing?.placeRole === 'astre-light' && landing !== state.lastLanding) state.metrics.lightLandings++;
    state.lastLanding = landing;
    // Sa maison est au fond du vallon : il suffit de l'y amener.
    if (!astre.arrived && astre.x >= config.endX - 20 && astre.y >= config.homeY - 90) {
      astre.arrived = true; astre.carried = false; p.burden = false;
      astre.x = config.endX; astre.y = config.homeY - 40;
      game.audio.sfx('victory'); game.emit('toast', 'Le petit astre a retrouvé sa maison.');
    }
    state.metrics.escortArrived = astre.arrived; game.exit.open = astre.arrived;
  }
  function afterPhysics(game, dt) {
    const state = game.place, config = game.level.place;
    if (!state || !config) return;
    if (state.kind === 'escort') carryAfterPhysics(game, state, config);
    if (state.kind === 'river') {
      state.metrics.beaconsLit = config.beacons.filter(id => game.wokenOnce.has(id)).length;
      state.light = state.metrics.beaconsLit / config.beacons.length;
      if (state.light >= 1 && !state.restored) {
        state.restored = true; state.metrics.riverRestored = true;
        game.audio.sfx('victory'); game.emit('toast', 'La rivière se souvient de la lune.');
      }
      game.exit.open = state.restored;
      if (config.flood) flood(game, state, config.flood, dt);
    }
    if (state.kind === 'ascent') {
      state.peakY = Math.min(state.peakY, game.player.y);
      state.metrics.peakY = state.peakY;
      state.metrics.climbed = game.level.spawn.y - state.peakY;
    }
    if (state.kind === 'rain') {
      const landing = game.player.standingPlatform;
      if (landing?.placeRole === 'rain-step' && landing !== state.lastLanding) state.metrics.rainLandings++;
      state.lastLanding = landing;
    }
  }
  /** Ce qui manque encore pour que le portail s'ouvre, dit en clair.
   *
   *  Un lieu gardé ne se lit pas dans son décor : on peut ramasser chaque note
   *  d'un bout à l'autre et repartir sans avoir compris que la sortie attend
   *  autre chose. Alors le lieu le dit lui-même — une phrase, un décompte, et
   *  le point vers lequel regarder quand il est sorti de l'écran.
   *
   *  `target` n'est jamais une flèche vers la solution : c'est la position de
   *  ce qui attend, que le joueur a déjà vu ou va voir. Le chemin pour y aller
   *  reste entier. */
  function objective(game) {
    const state = game.place, config = game.level.place;
    if (!state || !config || game.level.exit?.open !== false) return null;
    const nearest = points => points.filter(Boolean)
      .sort((a, b) => Math.abs(a.x - game.player.x) - Math.abs(b.x - game.player.x))[0] || null;
    if (state.kind === 'escort') {
      const span = Math.max(1, config.endX - config.startX);
      const walked = Math.round(clamp((state.astre.x - config.startX) / span, 0, 1) * 100);
      // Porté, il est dans les bras du joueur : rien à désigner. Posé, on
      // montre où on l'a laissé si on s'en est éloigné.
      const waiting = !state.astre.arrived && !state.astre.carried;
      return { done: !!state.metrics.escortArrived, target: waiting ? { x: state.astre.x, y: state.astre.y } : null,
        text: 'Le petit astre a fait {done} % du chemin.', values: { done: walked } };
    }
    if (state.kind === 'river') {
      const missing = config.beacons.filter(id => !game.wokenOnce.has(id))
        .map(id => game.wakeables.find(wakeable => wakeable.id === id));
      return { done: !!state.metrics.riverRestored, target: nearest(missing),
        text: 'Reflets rendus : {done} sur {total}.',
        values: { done: state.metrics.beaconsLit, total: config.beacons.length } };
    }
    return null;
  }
  function respawn(game) {
    const state = game.place;
    if (!state) return;
    if (state.kind === 'ride') {
      const config = game.level.place;
      const x = game.checkpoint.x > config.toX ? config.toX : config.fromX;
      state.deck.x = state.mount.x = x; state.deck.dx = 0; state.direction = x === config.fromX ? 1 : -1;
    }
    if (state.kind === 'chain') {
      state.propagation = []; for (const keeper of state.keepers) keeper.remaining = 0;
      for (const platform of game.platforms.filter(p => p.placeRole === 'living-bridge')) platform.active = false;
    }
    if (state.kind === 'rain') {
      // Les nuages ne s'arrêtent pas pour une chute : seule la pousse s'efface.
      for (const platform of game.platforms.filter(p => p.placeRole === 'rain-step')) { platform.active = false; platform.rainLife = 0; platform.charge = 0; }
      state.lastLanding = null;
    }
    if (state.kind === 'escort' && !state.astre.arrived) {
      // Une chute ne sépare jamais le joueur de l'astre : il revient avec lui
      // à la lanterne. Sans cela, un astre posé au bord d'un vide deviendrait
      // un chemin qu'on ne peut plus reprendre.
      const p = game.player;
      state.astre.carried = true; state.astre.x = p.x + p.w / 2; state.astre.y = p.y - 24;
      p.burden = true; lightAround(state, game.level.place);
    }
    if (state.kind === 'river' && state.floodPlatforms && !state.flooded) {
      // Avant la crue, un radeau friable remis par la chute n'existe pas encore.
      for (const platform of state.floodPlatforms) platform.active = false;
    }
    // The river remembers its lit beacons (and its flood):
    // a fall loses the traversal, never the work already done in this visit.
  }
  global.LumenPlaces = { create, beforePhysics, afterPhysics, respawn, objective };
})(typeof window !== 'undefined' ? window : globalThis);
