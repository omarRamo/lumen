/* Input-only pilot for the authored places. Waypoints are route instructions,
 * never player placements. All movement, calls, landings, deaths and rewards
 * pass through the real simulation. This proves completion, not enjoyment. */
(function (global) {
  'use strict';
  const set = (game, action, pressed) => game.input.virtual(action, pressed, 'place-pilot');
  function create(game) {
    const route = game.level.place.pilot || [];
    return {
      waypoint: 0, frames: 0, calls: 0, jumps: 0, jumpUntil: 0, lastJump: -10,
      minY: game.player.y, maxX: game.player.x, deathsSeen: game.deaths,
      peakMetrics: {}, trace: [], lastTrace: -10,
      step() {
        this.frames++;
        this.minY = Math.min(this.minY, game.player.y);
        this.maxX = Math.max(this.maxX, game.player.x);
        for (const [key, value] of Object.entries(game.place?.metrics || {})) {
          if (typeof value === 'number') this.peakMetrics[key] = Math.max(this.peakMetrics[key] || 0, value);
          else if (value) this.peakMetrics[key] = value;
        }
        if (game.mode !== 'playing') return;
        const p = game.player, center = p.x + p.w / 2, foot = p.y + p.h;
        if (game.deaths !== this.deathsSeen) {
          this.deathsSeen = game.deaths; this.drop = null;
          this.waypoint = route.reduce((best, entry, index) => {
            const point = Array.isArray(entry) ? { x: entry[0], surfaceY: entry[1] } : entry;
            const distance = Math.hypot(point.x - center, (point.surfaceY ?? point.y ?? foot) - foot);
            return distance < best.distance ? { index, distance } : best;
          }, { index: 0, distance: Infinity }).index;
        }
        let target = route[Math.min(this.waypoint, route.length - 1)] || { x: game.exit.x + game.exit.w / 2, y: game.exit.y + game.exit.h };
        if (Array.isArray(target)) target = { x: target[0], y: target[1] };
        else target = { ...target, y: target.surfaceY ?? target.y };
        if (game.place.kind === 'ascent' && p.grounded && foot > target.y + 150) {
          const candidate = route.findIndex(entry => foot - (entry.surfaceY ?? entry.y) <= 123 && foot - (entry.surfaceY ?? entry.y) >= -10);
          if (candidate >= 0) { this.waypoint = candidate; target = { ...route[candidate], y: route[candidate].surfaceY ?? route[candidate].y }; }
        }
        const near = Math.abs(center - target.x) < (target.radius || 35);
        const atHeight = target.y == null || (foot <= target.y + 18 && foot > target.y - 135);
        const bounced = p.vy < -500 && foot < target.y + 5 && game.platforms.some(platform => platform.type === 'spring' &&
          target.x >= platform.x && target.x <= platform.x + platform.w && Math.abs(platform.y - target.y) < 30 &&
          p.x + p.w > platform.x && p.x < platform.x + platform.w);
        const specialReady = target.ride ? game.place.deck.x >= game.level.place.toX - 90 : target.escort ? game.place.astre.arrived : true;
        if ((near && atHeight && (target.airborne || p.grounded) || bounced || (target.ride || target.escort) && specialReady) && specialReady && this.waypoint < route.length - 1) {
          this.waypoint++; target = route[this.waypoint];
          if (Array.isArray(target)) target = { x: target[0], y: target[1] };
          else target = { ...target, y: target.surfaceY ?? target.y };
        }
        if (target.ride) target = { ...target, x: game.place.deck.x + game.place.deck.w * .48, y: game.place.deck.y };
        if (target.escort) target = { ...target, x: game.place.astre.x + 100, y: 600 };
        // A lower destination cannot be reached by stopping above it. Walk
        // off the current ledge, then steer back once below its surface.
        if (!target.ride && !target.escort && p.standingPlatform && target.y > foot + 80 && Math.abs(center - target.x) < 45) {
          const ledge = p.standingPlatform;
          const left = Math.max(20, ledge.x - 35), right = Math.min(game.level.width - 20, ledge.x + ledge.w + 35);
          this.drop = { x: Math.abs(center - left) < Math.abs(center - right) ? left : right, surfaceY: foot };
        }
        if (this.drop && foot > this.drop.surfaceY + 65) this.drop = null;
        if (this.drop) target = { ...target, x: this.drop.x };
        const prediction = center + p.vx * .10;
        set(game, 'left', prediction > target.x + 6); set(game, 'right', prediction < target.x - 6);
        set(game, 'run', !!target.run);
        const standing = p.standingPlatform;
        const delta = target.x - center;
        const edge = standing ? (delta > 0 ? standing.x + standing.w - p.x - p.w : p.x - standing.x) : Infinity;
        const climbing = target.y != null && foot > target.y + 8;
        const destination = game.platforms.filter(platform => target.x >= platform.x && target.x <= platform.x + platform.w &&
          Math.abs(platform.y - target.y) < 30).sort((a, b) => Math.abs(a.y - target.y) - Math.abs(b.y - target.y))[0];
        const climbApproach = !destination || (delta > 0 ? destination.x - center : center - destination.x - destination.w) < 115;
        const waitingForRain = game.place.kind === 'rain' && p.grounded && destination?.placeRole === 'rain-step' && !destination.active;
        const waitingForLift = game.place.kind === 'ascent' && p.grounded && destination?.type === 'moving' && foot - destination.y > 121;
        const crossing = !!standing && edge < (target.edge || 70) && Math.abs(delta) > 65;
        const danger = game.enemies.some(enemy => enemy.alive && enemy.state !== 'calm' && enemy.type !== 'sleeper' && Math.abs(enemy.x - p.x) < 95 && Math.abs(enemy.y - p.y) < 90);
        const readyDirection = Math.sign(delta) * p.vx > -25;
        if (p.grounded && !waitingForRain && !waitingForLift && readyDirection && game.elapsed - this.lastJump > .16 && ((climbing && climbApproach) || crossing || danger)) {
          set(game, 'jump', true); this.jumpUntil = game.elapsed + .46; this.lastJump = game.elapsed; this.jumps++;
        } else if (game.elapsed > this.jumpUntil) set(game, 'jump', false);
        const shouldCall = p.actionCooldown <= 0 && !game.input.down('action') && (!target.ride || p.standingPlatform === game.place.deck);
        set(game, 'action', shouldCall);
        if (shouldCall) this.calls++;
        if (waitingForRain) {
          // Wait on a living foothold, looking towards the next bed. The call
          // moves the real cloud; only its real rain can create that surface.
          set(game, 'left', delta < 0 && p.facing > 0); set(game, 'right', delta > 0 && p.facing < 0); set(game, 'jump', false);
        }
        if (waitingForLift) { set(game, 'left', false); set(game, 'right', false); set(game, 'jump', false); }
        if (p.grounded && standing && delta > 0 && edge < 105 && ['river', 'chain'].includes(game.place.kind)) {
          const end = standing.x + standing.w;
          const waitingBridge = game.platforms.some(platform => !platform.active && platform.w > 250 &&
            (platform.wakeId || platform.placeRole === 'living-bridge') && platform.x < end + 50 && platform.x + platform.w > end + 150);
          if (waitingBridge) { set(game, 'left', false); set(game, 'right', false); set(game, 'jump', false); }
        }
        if (game.elapsed - this.lastTrace >= 2) {
          this.trace.push({ t: +game.elapsed.toFixed(1), x: Math.round(p.x), y: Math.round(p.y), waypoint: this.waypoint,
            standing: standing?.id || standing?.type || null, state: game.place?.phase || null });
          this.lastTrace = game.elapsed;
        }
      },
      summary() {
        return { key: game.level.key, kind: game.level.place.kind, mode: game.mode,
          seconds: +game.elapsed.toFixed(2), deaths: game.deaths, lives: game.lives, hp: game.player.hp,
          coins: game.levelCoins, stars: game.levelStars, calls: this.calls, jumps: this.jumps,
          waypoint: this.waypoint, waypoints: route.length, maxX: Math.round(this.maxX), minY: Math.round(this.minY),
          metrics: { ...this.peakMetrics, ...game.place?.metrics },
          player: { x: Math.round(game.player.x), y: Math.round(game.player.y) },
          checkpoint: game.checkpoint, trace: this.trace };
      }
    };
  }
  const pilot = { create };
  if (typeof module !== 'undefined') module.exports = pilot;
  else global.LumenPlacePilot = pilot;
})(globalThis);
