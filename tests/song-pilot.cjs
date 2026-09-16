(function (global) {
  'use strict';
  const ROUTES = [
    [[350,600],[520,500],[705,420,'pip'],[730,342],[900,600],[1210,590],
      [1350,500],[1540,415],[1750,340,'sao'],[1930,590],[2360,560],[2500,465],
      [2760,375],[2800,290],[2980,560],[3350,600],[3490,505,'milo'],[3680,420],[3690,342],[3930,600],[4060,600]],
    [[370,600],[470,490],[690,410,'aya'],[1210,560],[1310,465],[1530,365],[1790,210],
      [2170,325,'lou'],[2440,530],[2560,430],[2800,246],[3080,430],[3500,590],
      [3590,490],[3810,390,'tika'],[4240,600],[4320,490],[4590,600]],
    [[350,600],[480,495],[720,405,'sol'],[1210,560],[1340,460],[1540,370],[1770,206],
      [2020,350],[2280,310,'neve'],[2490,570],[2570,475],[2810,385],[3020,217],
      [3510,540],[3620,440],[3890,350,'orion'],[4430,600],[4510,485],[4870,600],[4980,600]]
  ];
  const set = (game, action, pressed) => game.input.virtual(action, pressed, 'song-pilot');
  function create(game) {
    const route = ROUTES[game.song.index].map(point => {
      const copy = [...point];
      if (game.song.index && copy[2] === game.song.lights[2].id) copy.pop();
      return copy;
    }).concat(game.level.continuation?.route || []);
    return {
      waypoint: 0, frames: 0, calls: 0, maxInputs: 0, foldWings: false,
      step() {
        this.frames++;
        if (game.mode !== 'playing') return;
        let target = route[Math.min(this.waypoint, route.length - 1)];
        const player = game.player, foot = player.y + player.h;
        const echo = target[2] && game.song.lights.find(entry => entry.id === target[2]);
        const landing = game.platforms.some(platform => target[0] > platform.x + 5 && target[0] < platform.x + platform.w - 5 && Math.abs(platform.y - target[1]) < 40);
        const souvenir = !landing && game.collectibles.find(entry => entry.type === 'star' && Math.abs(entry.x - target[0]) < 70 && Math.abs(entry.y - target[1]) < 70);
        if (Math.abs(player.x + player.w / 2 - target[0]) < 34 && foot <= target[1] + 14 && foot > target[1] - 140 &&
          (!landing || player.grounded) && (!souvenir || souvenir.taken) && (!echo || echo.found)) {
          this.waypoint++;
          this.foldWings = false;
          target = route[Math.min(this.waypoint, route.length - 1)];
        }
        const delta = target[0] - (player.x + player.w / 2), prediction = player.x + player.w / 2 + player.vx * .1;
        set(game, 'left', prediction > target[0] + 7); set(game, 'right', prediction < target[0] - 7);
        const standing = player.standingPlatform;
        const edge = standing && (delta > 0 ? standing.x + standing.w - player.x - player.w : player.x - standing.x);
        const climbing = foot > target[1] + 18;
        const crossing = !!standing && edge < 85 && Math.abs(delta) > 70;
        const inCurrent = game.level.song.wind.some(current => player.x + player.w > current.x && player.x < current.x + current.w && foot > current.y && player.y < current.y + current.h);
        if (player.grounded) this.foldWings = false;
        else if (Math.abs(delta) < 65 && foot <= target[1] + 2 && (player.vy >= 0 || inCurrent)) this.foldWings = true;
        if (player.grounded) set(game, 'jump', (climbing || crossing) && !game.input.down('jump'));
        else if (this.foldWings) set(game, 'jump', false);
        else if (climbing && player.vy > -80 && player.airJumps < 1) set(game, 'jump', !game.input.down('jump'));
        else set(game, 'jump', true);
        const nearEcho = game.song.lights.some(entry => !entry.found && Math.hypot(entry.x - player.x - 16, entry.y - player.y - 22) < 165 + game.song.count * 28);
        const call = nearEcho && player.actionCooldown <= 0 && !game.input.down('action');
        set(game, 'action', call);
        if (call) { set(game, 'left', false); set(game, 'right', false); this.calls++; }
        this.maxInputs = Math.max(this.maxInputs, ['left','right','jump','action'].filter(action => game.input.down(action)).length);
      },
      summary() {
        return { island: game.song.index + 1, style: game.song.style, mode: game.mode,
          seconds: Math.round(game.elapsed * 10) / 10, notes: game.levelCoins, stars: game.levelStars,
          echoes: game.song.count, falls: game.deaths, bestCombo: game.song.bestCombo,
          waypoint: this.waypoint, target: route[Math.min(this.waypoint, route.length - 1)],
          player: { x: Math.round(game.player.x), y: Math.round(game.player.y) }, calls: this.calls, maxInputs: this.maxInputs };
      }
    };
  }
  const pilot = { ROUTES, create };
  if (typeof module !== 'undefined') module.exports = pilot;
  else global.LumenSongPilot = pilot;
})(globalThis);