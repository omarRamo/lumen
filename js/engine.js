/* LUMEN — deterministic 120 Hz simulation, independent from the drawing rate.
 * Classic scripts deliberately support file://: no server, build or import required. */
(() => {
  'use strict';
  const WIDTH = 1280, HEIGHT = 720, STEP = 1 / 120;
  /** L'apaisement d'un dormeur : huit secondes pleines, annoncées une seconde et
   *  demie avant la fin, puis un répit d'autant avant qu'il puisse se fâcher de
   *  nouveau. Ces trois durées sont la promesse faite au joueur quand il appelle
   *  une créature ; elles ne dépendent d'aucun autre minuteur. */
  const CALM_TIME = 8, CALM_WARNING = 1.5, CALM_GRACE = 1.5;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (v, target, delta) => v < target ? Math.min(target, v + delta) : Math.max(target, v - delta);
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // Each garden throws its own debris when Lumen lands, starts running or bounces.
  // The type drives the renderer's particle shape, the colour its palette.
  const GROUND_DUST = {
    meadow: { type:'leaf', colors:['#c8e88a','#9ed08a','#f3d9a0'] },
    cavern: { type:'dust', colors:['#9db9cf','#7d9ab5','#bdacf5'] },
    tide:   { type:'bubble', colors:['#bdeee2','#8fd6cf','#e9f7d8'] },
    sky:    { type:'leaf', colors:['#e4f2c7','#fff0cd','#b4dcc4'] },
    forge:  { type:'ember', colors:['#ffc07a','#f79066','#ffe3ad'] },
    frost:  { type:'flake', colors:['#e6f7f1','#b6dbe6','#f6fbff'] },
    secret: { type:'petal', colors:['#f0c2d4','#e2b6e0','#ffe2ae'] },
    eclipse:{ type:'dust', colors:['#b6cfc4','#88a8a8','#f0cf96'] }
  };
  const MEDAL_RANK = { bronze:1, silver:2, gold:3 };
  const KEY_ACTIONS = { ArrowLeft:'left', KeyQ:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
    ArrowUp:'jump', KeyZ:'jump', KeyW:'jump', Space:'jump', ArrowDown:'down', KeyS:'down',
    ShiftLeft:'run', ShiftRight:'run', KeyX:'action', KeyJ:'action', Escape:'pause', KeyP:'pause', KeyR:'retry', KeyM:'sound', Enter:'confirm' };

  class Input {
    constructor(onCommand, getMode = () => '') {
      this.keys = new Map(); this.pressed = new Set(); this.released = new Set(); this.onCommand = onCommand; this.getMode = getMode;
      window.addEventListener('keydown', e => {
        const action = KEY_ACTIONS[e.code];
        if (!action || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (this.getMode() === 'map') {
          const direction = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' }[e.code];
          if (direction || e.code === 'Escape') {
            e.preventDefault(); if (!e.repeat) this.onCommand('journey-' + (direction || 'back')); return;
          }
          if (e.code === 'Enter' || e.code === 'Space') return;
          return;
        }
        // Let keyboard users activate focused interface controls normally.
        if ((e.code === 'Enter' || e.code === 'Space') && e.target.closest('button,a')) return;
        e.preventDefault();
        if (!e.repeat && !this.keys.has(e.code)) {
          this.keys.set(e.code, action); this.pressed.add(action);
          if (['pause','retry','sound','confirm'].includes(action)) this.onCommand(action);
        }
      });
      window.addEventListener('keyup', e => {
        const action = this.keys.get(e.code); this.keys.delete(e.code);
        if (action && !this.down(action)) this.released.add(action);
      });
      window.addEventListener('blur', () => this.reset());
    }
    down(action) { for (const value of this.keys.values()) if (value === action) return true; return false; }
    just(action) { return this.pressed.has(action); }
    virtual(action, down, pointer = '') {
      const key = 'touch:' + action + pointer;
      if (down && !this.keys.has(key)) { this.keys.set(key, action); this.pressed.add(action); }
      else if (!down && this.keys.delete(key)) { if (!this.down(action)) this.released.add(action); }
    }
    clearFrame() { this.pressed.clear(); this.released.clear(); }
    reset() { this.keys.clear(); this.clearFrame(); }
    pollGamepad(mode) {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const pad = [...navigator.getGamepads()].find(p => p && p.connected);
      const button = i => !!pad?.buttons[i]?.pressed;
      const horizontal = pad?.axes[0] || 0;
      if (mode === 'map') {
        // The map owns its focus, including its action buttons. Edge-triggered
        // navigation prevents one held stick from skipping several places.
        const vertical = pad?.axes[1] || 0;
        const navigation = { left:horizontal < -.5 || button(14), right:horizontal > .5 || button(15),
          up:vertical < -.5 || button(12), down:vertical > .5 || button(13), confirm:button(0), back:button(1) || button(9) };
        const previous = this.padJourney || { confirm: this.padConfirm, back: this.padPause };
        for (const [action, held] of Object.entries(navigation)) if (held && !previous[action]) this.onCommand('journey-' + action);
        this.padJourney = navigation; this.padConfirm = button(0); this.padPause = button(9); return;
      }
      this.padJourney = null;
      const actions = {left:horizontal < -.25 || button(14),right:horizontal > .25 || button(15),
        down:(pad?.axes[1] || 0) > .5 || button(13),jump:button(0) || button(1),
        action:button(2),run:button(4)||button(5)||button(6)||button(7)};
      for (const [action, held] of Object.entries(actions)) this.virtual(action, held, 'gamepad');
      if (button(9) && !this.padPause) this.onCommand('pause');
      if (button(0) && !this.padConfirm && ['home','paused','complete','ending','gameover'].includes(mode)) this.onCommand('confirm');
      this.padPause=button(9);this.padConfirm=button(0);
    }
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.renderer = new window.LumenRenderer(canvas); this.audio = new window.LumenAudio();
      this.listeners = {}; this.input = new Input(action => this.emit('command', action), () => this.mode);
      this.mode = 'home'; this.time = 0; this.runMode='explore'; this.camera = { x:0, y:0, shake:0 };
      // Les règles de la Résonance sont exposées telles quelles : l'interface,
      // les tests et les pilotes automatiques lisent les mêmes constantes que
      // la simulation, sans en recopier aucune.
      this.resonanceRules = window.LumenResonance;
      // Où l'on se trouve dans le JEU, et non dans le niveau : 'home',
      // 'campaign', 'hub' ou 'expedition'. Cet état est déclaré, pas déduit.
      // Avant lui, tout se lisait sur `this.run`, si bien qu'une nuit ouverte
      // suivait le joueur dans la campagne et y appliquait ses règles.
      this.session = 'home';
      this.run = null;   // l'expédition en cours, s'il y en a une
      this.lastRun = null; // la dernière nuit terminée, pour la recommencer
      // Les messages qui n'ont personne pour les entendre attendent ici que
      // l'interface soit prête (cf. flushNotices).
      this.notices = []; this.uiReady = false;
      this.progress = this.readProgress(); this.storageAvailable = true;
      this.journeyEvents = []; this.journeySnapshot = this.journeyLights();
      this.journeyTimes = Object.fromEntries((window.LumenJourney?.places(this) || []).map(place => [place.id, place.bestTimedTime]));
      this.audio.setMuted(!!this.progress.settings.muted);
      this.audio.volume = this.progress.settings.volume ?? .35;
      this.audio.setMix?.(this.progress.settings);
      this.lives = 5; this.score = 0; this.particles = []; this.floatingTexts = [];
      this.lastFrame = 0; this.accumulator = 0; this.running = false; this.frames = 0;
      this.fps = 60; this.frameWindow = []; this.loadLevel(0, false); this.showHome();
      this.resize = () => this.renderer.resize(window.innerWidth, window.innerHeight);
      window.addEventListener('resize', this.resize); this.resize();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (this.mode === 'playing') this.pause(); this.audio.pause(); this.input.reset(); }
        else if (this.mode === 'home') this.audio.resume();
        this.lastFrame = 0; this.accumulator = 0;
      });
      window.addEventListener('blur', () => { if (this.mode === 'playing') this.pause(); });
    }
    on(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, detail) { (this.listeners[name] || []).forEach(fn => fn(detail)); }
    /** La clé stable d'un chapitre. Les définitions en portent une ; le repli
     *  couvre un chapitre ajouté à la volée par un test ou un outil. */
    keyOf(index) {
      const level = window.LUMEN_LEVELS[index];
      return level && level.key ? level.key : 'chapitre-' + index;
    }
    indexOfKey(key) { return window.LUMEN_LEVELS.findIndex(level => level.key === key); }
    /** L'enregistrement d'un chapitre, par position — l'interface parcourt la liste. */
    recordFor(index) { return this.store.chapter(this.keyOf(index)); }
    /** Le prochain chapitre de campagne à reprendre : le premier encore fermé,
     *  ou le dernier ouvert si la campagne est terminée. */
    nextChapterIndex() {
      for (let i = 0; i < window.LUMEN_LEVELS.length; i++) {
        if (window.LUMEN_LEVELS[i].bonus || window.LUMEN_LEVELS[i].hub) continue;
        if (!this.isUnlocked(i)) return Math.max(0, i - 1);
        if (!this.recordFor(i)?.completed) return i;
      }
      return 0;
    }
    /** Un message destiné au joueur. Émis tout de suite si l'interface écoute,
     *  gardé sinon : un avertissement de stockage émis pendant le constructeur
     *  n'avait, avant, aucun auditeur et se perdait en silence. */
    notify(message) {
      if (this.uiReady) this.emit('toast', message);
      else this.notices.push(message);
    }
    /** Appelé par l'interface une fois ses écouteurs posés. */
    flushNotices() {
      this.uiReady = true;
      const pending = this.notices.splice(0);
      for (const message of pending) this.emit('toast', message);
      return pending.length;
    }
    readProgress() {
      const storage = (() => { try { return localStorage; } catch (_) { return null; } })();
      this.store = new window.LumenSave.SaveStore(storage);
      this.storageAvailable = this.store.available;
      if (this.store.recovered) this.notify('Sauvegarde principale illisible : la copie de secours a été restaurée.');
      if (this.store.futureSchema) this.notify('Cette sauvegarde vient d’une version plus récente de LUMEN : elle est laissée intacte, et cette partie ne sera pas enregistrée.');
      // `progress` reste exposé pour l'interface et les anciens tests ; la
      // vérité vit désormais dans le profil du magasin.
      return this.store.profile;
    }
    saveProgress() {
      if (!this.store) return;
      this.captureJourneyLights();
      if (!this.store.save(this.progress)) {
        this.storageAvailable = false;
        if (!this.storageWarned) { this.storageWarned = true;
          this.notify('Sauvegarde indisponible : la progression reste disponible pendant cette session.'); }
      }
    }
    isUnlocked(index) {
      if (index < 0 || index >= window.LUMEN_LEVELS.length) return false;
      const level = window.LUMEN_LEVELS[index];
      if (level.hub) return true;
      if (this.store.isUnlocked(this.keyOf(index))) return true;
      if (level.bonus) return !!this.progress.bonusUnlocked;
      // Un chapitre inséré dans une campagne déjà parcourue ne doit pas
      // apparaître verrouillé au milieu de chapitres ouverts : si un chapitre
      // ultérieur l'est, celui-ci l'est aussi.
      for (let later = index + 1; later < window.LUMEN_LEVELS.length; later++) {
        if (window.LUMEN_LEVELS[later].bonus || window.LUMEN_LEVELS[later].hub) continue;
        if (this.store.isUnlocked(this.keyOf(later))) return true;
      }
      return false;
    }
    showHome() {
      this.leaveExpedition();
      this.session = 'home';
      this.loadLevel(0, false); this.mode = 'home'; this.camera.x = 0;
      this.platforms = [
        {x:740,y:520,w:460,h:230,type:'ground',active:true},
        {x:585,y:605,w:125,h:150,type:'ground',active:true},
        {x:1175,y:440,w:170,h:190,type:'ground',active:true}
      ];
      this.enemies=[];this.collectibles=[{x:1080,y:413,type:'star',taken:false}];this.checkpoints=[];this.hazards=[];this.secrets=[];
      this.exit={x:2100,y:500,w:70,h:100,open:true};
      this.player.x = 890; this.player.y = 474; this.player.grounded = true; this.player.facing = -1;
      this.audio.setTheme('meadow'); this.emit('mode', this.mode);
    }
    start(index = 0, options = {}) {
      if (index < 0 || !this.isUnlocked(index)) return;
      // Entrer dans un chapitre, c'est SORTIR d'une nuit. Sans cette ligne,
      // une expédition ouverte continuait de gouverner la mort, le réessai,
      // la sortie de niveau et les souvenirs portés.
      this.leaveExpedition();
      this.lastRun = null;
      this.session = window.LUMEN_LEVELS[index].hub ? 'hub' : 'campaign';
      if (this.lives <= 0) this.lives = 5;
      this.runMode=options.timed?'timed':'explore';
      this.loadLevel(index); this.audio.unlock(); this.audio.resume();
    }
    loadLevel(index, active = true) {
      return this.applyLevel(window.LumenLevels.create(index), index, active);
    }
    nextSongIndex() {
      const index = window.LumenSong.ISLANDS.findIndex((island, i) => this.isSongUnlocked(i) && !this.store.chapter(island.key)?.completed);
      return index < 0 ? 0 : index;
    }
    isSongUnlocked(index) {
      if (window.LumenJourney) return window.LumenJourney.islandAccess(this, index).allowed;
      const islands = window.LumenSong?.ISLANDS || [];
      return Number.isInteger(index) && !!islands[index] && (!index || !!this.store.chapter(islands[index].key)?.completed);
    }
    startSong(index = 0, options = {}) {
      const Song = window.LumenSong;
      if (!Song || !Number.isInteger(index) || !Song.ISLANDS[index]) return false;
      if (!this.isSongUnlocked(index)) return false;
      this.leaveExpedition(); this.lastRun = null; this.session = 'song';
      const style = options.style || this.progress.settings.songStyle || 'gentle';
      this.runMode = style === 'flow' ? 'timed' : 'explore';
      this.lives = 5;
      this.applyLevel(Song.create(index, style), -1);
      this.audio.resume();
      return true;
    }
    /** Charge une définition de niveau quelconque — une salle d'expédition n'est
     *  pas dans la liste des chapitres, mais respecte exactement le même
     *  contrat de données. C'est ce qui permet de la jouer sans moteur parallèle. */
    applyLevel(data, index, active = true) {
      this.levelIndex = index; this.level = data; this.elapsed = 0; this.levelCoins = 0; this.levelStars = 0;
      this.song = data.song && window.LumenSong ? new window.LumenSong.Journey(data.song) : null;
      this.audio.setSongLayer?.(0);
      this.levelScore = 0; this.deaths = 0; this.secretCount = 0; this.deadTimer = 0;
      this.damageTaken=0;this.enemiesDefeated=0;this.echoTime=0;this.flash=null;this.danger=0;this.dangerTimer=0;
      const R = window.LumenResonance;
      this.wakeables = (data.wakeables || []).map((w, i) => R.createWakeable(w, i));
      this.waves = [];
      this.characters = (data.characters || []).map(c => ({ ...c, near: false, bob: 0 }));
      // Ce qui a déjà été réveillé au moins une fois dans ce chapitre : une
      // quête doit pouvoir être remplie sans exiger trois réveils simultanés.
      this.wokenOnce = new Set();
      // La géométrie des réveillables rejoint les plateformes ordinaires : elle
      // est prévisible à l'avance, donc vérifiable par le contrôle de parcours.
      const wakePlatforms = this.wakeables.flatMap(w => R.platformsFor(w));
      this.platforms = [...data.platforms, ...wakePlatforms].map((p, i) => ({ phase:0, ...p, active:p.type!=='echo'&&!p.wakeId, id:i, baseX:p.x, baseY:p.y, dx:0, dy:0, crumbleTimer:0, reformTimer:0 }));
      this.enemies = data.enemies.map((e, i) => ({ w:36, h:34, vx:0, vy:0, hp:1, alive:true, state:e.type==='sleeper'?'sleep':'orbit',chargeProgress:0,scatterTime:0,calmTime:0,rousing:false,rouseGrace:0, phase:i * 1.17, timer:.9 + i * .19, facing:-1, ...e, spawnX:e.x, spawnY:e.y }));
      this.collectibles = data.collectibles.map(c => ({ ...c, taken:false }));
      this.checkpoints = data.checkpoints.map(c => ({ ...c, active:false }));
      this.hazards = data.hazards || []; this.secrets = (data.secrets || []).map(s => ({ ...s, found:false }));
      // Une sortie peut être fermée par la définition du niveau (l'observatoire
      // attend sa quête). Ne l'ouvrir d'office que si elle ne s'est pas prononcée.
      this.exit = { w:70, h:100, ...data.exit,
        open: data.exit && data.exit.open !== undefined ? data.exit.open : !data.boss };
      this.restoreWorldState();
      this.projectiles = []; this.particles = []; this.floatingTexts = [];
      this.checkpoint = { x:data.spawn.x, y:data.spawn.y };
      this.player = { x:data.spawn.x, y:data.spawn.y, w:32, h:46, vx:0, vy:0, facing:1, grounded:false, anim:0,
        landTimer:0, dead:false, invuln:0, hp:3, power:null, powerTime:0, slide:false, coyote:0, jumpBuffer:0,
        airJumps:0, dashTime:0, actionCooldown:0, standingPlatform:null, wet:false, trailTimer:0,
        jumpTimer:0,runStartTimer:0,lastAxis:0,powerDuration:35,powerWarning:false,stepSoundTimer:0,gliding:false };
      this.boss = data.boss ? { x:data.width - 650, y:460, w:130, h:130, hp:12, maxHp:12, phase:1, timer:0,
        vulnerable:false, hitFlash:0, facing:-1, state:'sleep', vx:0, vy:0, attack:0, activated:false, homeX:data.width - 650,
        stage:1,flashTimer:0,arenaLeft:data.width-1400,arenaRight:data.width-180,arenaActive:false,arenaWarn:0,rainMarkers:[] } : null;
      this.camera = { x:clamp(data.spawn.x - 300, 0, Math.max(0, data.width - WIDTH)), y:0, shake:0 };
      if (data.place?.kind === 'ascent') this.camera.y = clamp(data.spawn.y - HEIGHT * .52, 0, Math.max(0, data.height - HEIGHT));
      this.place = window.LumenPlaces?.create(this) || null;
      this.input.reset(); this.audio.setTheme(data.theme);this.audio.setDanger?.(0);this.audio.setBossPhase?.(0);
      this.audio.setScene?.(data.song?.index ?? -1);
      if (active) { this.mode = 'playing'; this.emit('level', data); this.emit('mode', this.mode); }
    }
    /** Ce qu'une sauvegarde a déjà acquis et qui doit se revoir DANS le monde,
     *  et pas seulement dans un menu. Appelé à chaque chargement de niveau :
     *  une porte qu'une quête a ouverte ne se referme pas parce qu'on est sorti.
     *
     *  C'est la règle qui manquait : la quête était relue (les dialogues le
     *  prouvaient), mais son effet sur le décor ne l'était pas. */
    restoreWorldState() {
      const quest = this.level && this.level.quest;
      if (!quest || !this.store) return;
      if (this.store.questState(quest.id) !== 'done') return;
      this.exit.open = true;
    }
    /** LA règle d'accès aux Rêves nomades. Une seule, consultée aussi bien par
     *  le portail de l'observatoire que par le menu : il ne peut donc pas y
     *  avoir de porte verrouillée d'un côté et ouverte de l'autre. */
    canEnterDreams() {
      const hubIndex = window.LUMEN_LEVELS.findIndex(level => level.hub);
      const hub = window.LUMEN_LEVELS[hubIndex];
      const quest = hub && hub.quest;
      if (!quest) return { allowed: true };
      if (this.store.questState(quest.id) === 'done') return { allowed: true };
      return {
        allowed: false, hubIndex,
        reason: 'La porte des rêves ne s’ouvre qu’une fois la coupole rendue à son souffle.',
        action: 'Aller à l’observatoire'
      };
    }
    retry() {
      if (this.session === 'song' && this.song) return this.startSong(this.song.index, { style: this.song.style });
      // Une salle de rêve se recommence sur place ; une nuit perdue se
      // recommence depuis sa première salle ; un chapitre se recharge. Ce qui
      // n'existe pas — un « chapitre −1 » — n'est jamais demandé au chargeur.
      if (this.session === 'expedition' && this.run) return this.enterRoom(this.run.roomIndex);
      if (this.lastRun) return this.retryExpedition();
      if (this.levelIndex < 0) return this.showHome();
      this.lives = this.lives <= 0 ? 5 : this.lives;
      this.start(this.levelIndex,{timed:this.runMode==='timed'});
    }

    /* ── Les Rêves nomades ─────────────────────────────────────────────────
     * Une expédition n'est pas un second moteur : c'est une suite de salles
     * qui respectent le même contrat de données qu'un chapitre. Tout ce que le
     * joueur a appris dans la campagne y fonctionne à l'identique. */

    /** Démarre une nuit. `seed` peut être un nombre, un code-mot ou un texte. */
    startExpedition(seed, options = {}) {
      const Rng = window.LumenRng;
      const resolved = seed === undefined || seed === null || seed === ''
        ? Rng.randomSeed() : Rng.toSeed(seed);
      this.run = {
        seed: resolved,
        choices: Array.isArray(options.choices) ? options.choices.slice() : [],
        roomIndex: options.roomIndex || 0,
        upgrades: Array.isArray(options.upgrades) ? options.upgrades.slice() : [],
        claimed: new Set(options.claimed || []),
        powersSeen: [],
        lives: options.lives ?? 3,
        hp: options.hp ?? 3
      };
      this.replan();
      this.session = 'expedition';
      this.lastRun = null;
      // Reprendre une nuit enregistrée n'est pas une nouvelle tentative : c'est
      // la même, poursuivie. Seul un vrai départ compte.
      if (!options.resumed) this.progress.expeditions.runs++;
      this.saveProgress();
      this.audio.unlock(); this.audio.resume();
      this.enterRoom(this.run.roomIndex);
      return this.run;
    }
    replan() {
      this.run.plan = window.LumenExpedition.plan(this.run.seed, { choices: this.run.choices });
      this.run.code = this.run.plan.code;
      return this.run.plan;
    }
    /** Charge une salle. L'index est toujours celui du plan courant. */
    enterRoom(index) {
      const rooms = this.run.plan.rooms;
      // Sortir par le haut du plan est une VICTOIRE ; y entrer par un indice
      // aberrant venu d'une sauvegarde ne l'est pas. On ne confond pas les deux.
      if (index < 0 || index > rooms.length) { this.notify('Cette nuit n’a pas pu être reprise : elle repart du début.'); index = 0; }
      const room = rooms[index];
      if (!room) return this.finishExpedition(true);
      this.run.roomIndex = index;
      this.lives = this.run.lives;
      // La salle est un niveau ordinaire : même chargement, même simulation.
      this.applyLevel(JSON.parse(JSON.stringify(room.level)), -1, true);
      this.player.hp = this.run.hp;
      this.runMode = 'explore';
      this.emit('expedition', { run: this.run, room });
      if (room.kind === 'refuge') this.restAtRefuge(room);
      return room;
    }
    /** Un refuge : on y souffle, et la nuit s'enregistre telle quelle. */
    restAtRefuge(room) {
      this.run.hp = 3; this.player.hp = 3;
      this.progress.expeditions.bestRooms = Math.max(this.progress.expeditions.bestRooms, this.run.roomIndex + 1);
      this.store.saveExpedition({
        seed: this.run.seed, generationVersion: this.run.plan.version,
        roomIndex: this.run.roomIndex, route: this.run.choices,
        hp: this.run.hp, lives: this.run.lives,
        upgrades: this.run.upgrades, claimed: [...this.run.claimed],
        rng: this.run.plan.rng, savedAt: Date.now()
      });
      this.emit('toast', 'Refuge · la nuit est enregistrée. Vous pourrez repartir d’ici.');
      this.audio.sfx('checkpoint');
    }
    /** Reprend une expédition sauvegardée, à l'identique. */
    resumeExpedition() {
      const saved = this.progress.expedition;
      if (!saved) return null;
      if (saved.generationVersion !== window.LumenRng.GENERATION_VERSION) {
        this.emit('toast', 'Cette nuit a été rêvée dans une version antérieure : elle ne peut pas être reprise.');
        this.store.clearExpedition();
        return null;
      }
      return this.startExpedition(saved.seed, {
        resumed: true,
        choices: saved.route, roomIndex: saved.roomIndex,
        upgrades: saved.upgrades, claimed: saved.claimed,
        lives: saved.lives, hp: saved.hp
      });
    }
    /** Une salle est franchie : on propose la suite, ou on conclut. */
    completeRoom() {
      const run = this.run, plan = run.plan;
      const room = plan.rooms[run.roomIndex];
      run.hp = this.player.hp; run.lives = this.lives;
      this.addScore(250);
      if (run.roomIndex >= plan.rooms.length - 1) return this.finishExpedition(true);
      const next = plan.rooms[run.roomIndex + 1];
      const rewardRng = new window.LumenRng.RngSet(run.seed).rewards;
      for (let i = 0; i <= run.roomIndex; i++) rewardRng.next();
      const offer = window.LumenUpgrades.offer(rewardRng, run.upgrades, run.powersSeen);
      this.mode = 'route';
      this.emit('route', {
        run, from: room, next,
        branches: next.branches.map(kind => ({ kind, omen: window.LumenExpedition.OMENS[kind] })),
        offer
      });
      this.emit('mode', this.mode);
    }
    /** Le joueur a choisi sa route — et, éventuellement, un souvenir. */
    chooseRoute(kind, upgradeId) {
      const run = this.run;
      if (upgradeId && window.LumenUpgrades.byId[upgradeId]) {
        // Une récompense n'est encaissée qu'une fois, même après une reprise.
        const token = 'upgrade:' + run.roomIndex + ':' + upgradeId;
        if (!run.claimed.has(token)) {
          run.claimed.add(token);
          run.upgrades = window.LumenUpgrades.equip(run.upgrades, upgradeId);
          const combo = window.LumenUpgrades.comboFor(run.upgrades);
          if (combo) this.emit('toast', combo.name + ' · ' + combo.effect);
        }
      }
      run.choices[run.roomIndex + 1] = kind;
      this.replan();
      this.enterRoom(run.roomIndex + 1);
    }
    finishExpedition(won) {
      const run = this.run;
      if (won) {
        this.progress.expeditions.completed++;
        this.progress.expeditions.bestRooms = Math.max(this.progress.expeditions.bestRooms, run.plan.rooms.length);
        this.addScore(2000);
      }
      // Une nuit terminée ou perdue ne se reprend plus : c'était la tentative.
      this.store.clearExpedition();
      this.saveProgress();
      this.mode = won ? 'expedition-done' : 'gameover';
      this.emit('expedition-end', { run, won });
      this.emit('mode', this.mode);
      // La nuit est close, mais sa graine reste : on peut la recommencer telle
      // quelle, ou en demander une autre. C'est une décision, pas un hasard.
      this.lastRun = { seed: run.seed, code: run.code, won };
      this.run = null;
      this.session = 'home';
    }
    /** Quitte une nuit en cours sans la conclure : elle n'a pas eu lieu, et
     *  rien de ce qu'elle portait ne doit survivre dans un chapitre. */
    leaveExpedition() {
      if (this.session === 'expedition' && this.run) this.emit('expedition-end', { run: this.run, won: false, left: true });
      this.run = null;
      if (this.session === 'expedition') this.session = 'home';
    }
    /** Recommence la dernière nuit, avec sa graine, depuis sa première salle. */
    retryExpedition() {
      if (!this.lastRun) return null;
      return this.startExpedition(this.lastRun.seed);
    }
    /** Applique les souvenirs portés. Appelé par la simulation, jamais par l'UI. */
    hasUpgrade(id) { return this.session === 'expedition' && !!this.run && this.run.upgrades.includes(id); }
    pause() {
      if (this.mode !== 'playing') return;
      this.mode = 'paused'; this.input.reset(); this.audio.pause(); this.emit('mode', this.mode);
    }
    resume() {
      if (this.mode !== 'paused') return;
      this.mode = 'playing'; this.input.reset(); this.audio.resume(); this.lastFrame = 0; this.emit('mode', this.mode);
    }
    /** The map is a destination requested by the player, never a startup gate.
     * A song or campaign stays resumable; leaving an expedition keeps its
     * established session isolation rules. */
    showMap() {
      if (this.mode === 'map') return;
      this.journeyReturn = this.session !== 'expedition' ? { mode: this.mode, session: this.session } : null;
      this.leaveExpedition();
      this.mode = 'map'; this.input.reset(); this.audio.pause(); this.emit('mode', this.mode);
    }
    returnFromJourneyMap() {
      const previous = this.journeyReturn; this.journeyReturn = null;
      if (!previous || previous.mode === 'map' || previous.mode === 'dream') {
        const hub = window.LUMEN_LEVELS.findIndex(level => level.hub);
        return hub >= 0 ? this.start(hub) : this.startSong(0);
      }
      this.mode = previous.mode; this.session = previous.session; this.input.reset();
      this.lastFrame = 0; this.accumulator = 0;
      if (this.mode === 'playing') this.audio.resume();
      this.emit('mode', this.mode);
      return true;
    }
    nextJourneyPlace() { return window.LumenJourney?.next(this) || null; }
    openJourneyPlace(id, options = {}) {
      const place = window.LumenJourney?.places(this).find(node => node.id === id);
      if (!place) return false;
      if (!place.unlocked) { this.notify(place.reason); return false; }
      if (place.kind === 'island') return this.startSong(place.index, options);
      if (place.kind === 'dreams') {
        if (!this.canEnterDreams().allowed) return false;
        this.leaveExpedition(); this.session = 'home'; this.song = null; this.audio.setSongLayer?.(0);
        this.emit('portal', 'expedition'); return true;
      }
      // start() checks the authoritative stage guard again, including bonus.
      this.start(place.index, options); return true;
    }
    journeyLights() {
      if (!window.LumenJourney || !this.store) return {};
      return Object.fromEntries(window.LumenJourney.places(this).map(place => [place.id, place.lights.map(light => light.id)]));
    }
    captureJourneyLights() {
      if (!this.journeyEvents) return;
      const next = this.journeyLights(), previous = this.journeySnapshot || {};
      const times = Object.fromEntries((window.LumenJourney?.places(this) || []).map(place => [place.id, place.bestTimedTime]));
      for (const [id, lights] of Object.entries(next)) {
        const added = lights.filter(light => !(previous[id] || []).includes(light));
        // A better personal time lights the same clock again; it does not
        // manufacture an ever-growing collection of points in the profile.
        if (times[id] != null && this.journeyTimes?.[id] != null && times[id] < this.journeyTimes[id] && !added.includes(id + ':time')) added.push(id + ':time');
        if (!added.length) continue;
        let event = this.journeyEvents.find(item => item.id === id);
        if (!event) this.journeyEvents.push(event = { id, lights: [] });
        event.lights = [...new Set([...event.lights, ...added])];
        this.emit('journey-light', { id, lights: added });
      }
      this.journeySnapshot = next; this.journeyTimes = times;
    }
    consumeJourneyLights() { return this.journeyEvents.splice(0); }
    beginLoop() { if (this.running) return; this.running = true; requestAnimationFrame(t => this.frame(t)); }
    frame(timestamp) {
      if (!this.running) return;
      const realDt = this.lastFrame ? (timestamp - this.lastFrame) / 1000 : STEP;
      const dt = Math.min(.08, Math.max(0, realDt)); this.lastFrame = timestamp;
      this.input.pollGamepad(this.mode);
      this.accumulator += dt;
      while (this.accumulator >= STEP) { this.update(STEP); this.input.clearFrame(); this.accumulator -= STEP; }
      this.renderer.draw(this, dt); this.emit('frame', dt);
      this.frames++; this.frameWindow.push(realDt);
      if (this.frameWindow.length > 120) this.frameWindow.shift();
      if (this.frames % 30 === 0) this.fps = Math.round(this.frameWindow.length / this.frameWindow.reduce((a,b) => a+b, 0));
      requestAnimationFrame(t => this.frame(t));
    }
    update(dt) {
      if (this.mode === 'paused' || this.mode === 'map' || this.mode === 'help' || this.mode === 'gameover') return;
      this.time += dt;
      this.camera.shake = Math.max(0, this.camera.shake - dt * 20);
      if(this.flash){this.flash.life=Math.max(0,this.flash.life-dt);if(!this.flash.life)this.flash=null;}
      this.updateEffects(dt);
      if (this.mode === 'home') { this.player.anim += dt; return; }
      if (this.mode === 'dead') {
        this.elapsed+=dt;
        this.deadTimer -= dt; this.player.vy += 1200 * dt; this.player.y += this.player.vy * dt;
        if (this.deadTimer <= 0) this.respawn();
        return;
      }
      if (this.mode === 'complete' || this.mode === 'ending') {
        this.player.anim += dt;
        if (Math.random() < dt * 12) this.burst(this.player.x + 16, this.player.y - 25, 2, '#f5d279', 70, 'spark');
        return;
      }
      if (this.mode !== 'playing') return;
      this.elapsed += dt;
      this.echoTime=Math.max(0,this.echoTime-dt);
      this.updateResonance(dt);
      if (this.mode !== 'playing') return;
      this.updatePlatforms(dt); window.LumenPlaces?.beforePhysics(this, dt); this.updatePlayer(dt);
      if (this.mode !== 'playing') return;
      window.LumenPlaces?.afterPhysics(this, dt);
      if (this.song) this.song.update(this, dt);
      this.updateEnemies(dt);
      if (this.mode !== 'playing') return;
      this.updateBoss(dt);
      if (this.mode !== 'playing') return;
      this.updateProjectiles(dt);
      if (this.mode !== 'playing') return;
      this.updateCollectibles(dt);
      if (this.mode !== 'playing') return;
      this.updateCheckpoints(); this.updateSecrets(); this.updateCharacters(dt);
      this.updateDanger(dt);
      this.audio.updateWorld?.(this, dt);
      if (this.exit.open && overlap(this.player, this.exit)) {
        if (this.level.hub) { this.player.vx = 0; this.emit('portal', this.exit.leadsTo || 'map'); }
        else if (this.session === 'expedition' && this.run) this.completeRoom();
        else this.complete();
      }
      const visibleWidth = this.renderer.worldWidth || WIDTH;
      const target = clamp(this.player.x - visibleWidth * .36 + this.player.vx * .16, 0, Math.max(0, this.level.width - visibleWidth));
      this.camera.x += (target - this.camera.x) * (1 - Math.exp(-5 * dt));
      if (this.level.place?.kind === 'ascent') {
        const vertical = clamp(this.player.y - HEIGHT * .52, 0, Math.max(0, this.level.height - HEIGHT));
        this.camera.y += (vertical - this.camera.y) * (1 - Math.exp(-5 * dt));
      } else this.camera.y = 0;
    }
    updatePlatforms(dt) {
      for (const p of this.platforms) {
        const oldX = p.x, oldY = p.y;
        if (p.type === 'moving') {
          const offset = Math.sin(this.time * (p.speed || 1) + p.phase) * (p.range || 80);
          if (p.axis === 'y') p.y = p.baseY + offset; else p.x = p.baseX + offset;
        }
        if (p.type === 'vanish') {
          p.cycle = (this.time + p.phase) % 4.8;
          p.active = p.cycle < 3.6; p.warning = p.cycle > 2.8 && p.active;
        }
        if(p.type==='echo'){p.active=this.echoTime>0;p.warning=this.echoTime>0&&this.echoTime<1;}
        if(p.wakeId){
          const source=this.wakeables.find(w=>w.id===p.wakeId);
          p.active=!!source&&source.state==='awake';
          p.warning=!!source&&window.LumenResonance.isFading(source);
        }
        if (p.type === 'crumble') {
          if (p.crumbleTimer > 0) {
            p.crumbleTimer -= dt;
            if (p.crumbleTimer <= 0) { p.active = false; p.reformTimer = 3.5; this.burst(p.x+p.w/2,p.y,12,'#a6b79c',130,'stone'); this.audio.sfx('break'); }
          }
          if (p.reformTimer > 0) { p.reformTimer -= dt; if (p.reformTimer <= 0) p.active = true; }
        }
        p.dx = p.x - oldX; p.dy = p.y - oldY;
      }
    }
    updatePlayer(dt) {
      const p = this.player, input = this.input;
      p.gliding = false;
      p.anim += dt * (Math.abs(p.vx) > 20 ? Math.abs(p.vx) / 90 : 1);
      p.invuln = Math.max(0, p.invuln - dt); p.landTimer = Math.max(0, p.landTimer - dt);
      p.jumpTimer=Math.max(0,p.jumpTimer-dt);p.runStartTimer=Math.max(0,p.runStartTimer-dt);p.stepSoundTimer=Math.max(0,p.stepSoundTimer-dt);
      p.actionCooldown = Math.max(0, p.actionCooldown - dt); p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
      if (p.grounded) { p.coyote = .12; p.airJumps = 0; } else p.coyote = Math.max(0, p.coyote - dt);
      if (p.power) {
        p.powerTime -= dt;
        if(p.powerTime<5&&!p.powerWarning){p.powerWarning=true;this.audio.sfx('powerWarning');}
        if(p.powerTime<=0){const oldPower=p.power;p.power=null;this.audio.sfx('expire_'+oldPower);this.burst(p.x+16,p.y+22,12,'#d2dcbb',90,'spark');this.emit('toast','Le pouvoir s’est dissipé. Continuez votre voyage !');}
      }
      if (input.just('jump')) p.jumpBuffer = .15;
      const water = this.level.water;
      p.wet = !!water && p.x + p.w > (water.start || 0) && p.x < (water.end || this.level.width) && p.y + p.h * .6 > water.y;
      const axis = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
      if(axis&&p.grounded&&(!p.lastAxis||Math.sign(p.vx)!==axis)){p.runStartTimer=.15;this.groundBurst(p.x+16,p.y+p.h,4,60);}
      p.lastAxis=axis;
      if (axis) p.facing = axis;
      const sliding = input.down('down') && p.grounded && Math.abs(p.vx) > 160 && !p.wet;
      if (sliding !== p.slide) { const height = sliding ? 29 : 46; p.y += p.h - height; p.h = height; p.slide = sliding; }
      const maxSpeed = p.wet ? 235 : (input.down('run') ? 490 : 320) * (this.song && this.song.combo >= 10 ? 1.12 : 1);
      const friction = this.level.theme === 'frost' && p.grounded ? 520 : 2300;
      if (p.dashTime <= 0) {
        if (axis) p.vx = approach(p.vx, axis * maxSpeed, dt * (p.grounded ? (sliding ? 450 : 2350) : 1550));
        else p.vx = approach(p.vx, 0, dt * (p.grounded ? (sliding ? 400 : friction) : 720));
      }
      if (input.just('action')) this.usePower();
      if (p.jumpBuffer > 0 && !p.wet) {
        if (p.coyote > 0) this.jump(false);
        else if ((p.power === 'breeze' || this.level.song) && p.airJumps < 1) this.jump(true);
      }
      let windDrift = 0;
      if (p.wet) {
        p.vy += 500 * dt;
        if (input.down('jump')) { p.vy -= 1120 * dt; p.vy = Math.max(p.vy, -310); p.grounded = false; }
        p.vy = Math.min(p.vy, 190);
        if (input.just('jump')) { p.vy = -310; this.audio.sfx('jump'); this.burst(p.x+16,p.y+p.h,8,'#b8e6de',60,'bubble'); }
        if (Math.random() < dt * 7) this.burst(p.x+16,p.y+p.h/2,1,'#c5f2e9',22,'bubble');
      } else {
        p.vy += (p.vy > 0 ? 2100 : 1900) * dt;
        if (input.released.has('jump') && p.vy < -235) p.vy *= .48;
        p.vy = Math.min(1000, p.vy);
        if (this.level.song && input.down('jump') && p.vy > 0 && !input.down('down')) {
          p.gliding = true;
          p.vy = Math.min(140, p.vy);
        }
        if (this.level.song && input.down('jump') && !input.down('down')) {
          const wind = (this.song?.wind || this.level.song.wind || []).find(current => overlap(p, current));
          if (wind) { p.vy = approach(p.vy, -310, 4000 * dt); p.gliding = true; windDrift = wind.drift || 0; }
        }
      }
      if (p.dashTime > 0) {
        p.dashTime -= dt; p.vx = p.facing * 910; p.vy = 0;
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          this.burst(p.x+16-p.facing*12,p.y+24,4,'#dbc9ed',60,'trail'); p.trailTimer=.025;
          if (this.hasUpgrade('sillage')) {
            const caps = window.LumenUpgrades.byId.sillage.caps;
            this.emitResonance(p.x+16, p.y+22, window.LumenResonance.BASE_REACH * caps.reach, 'sillage');
          }
        }
      } else if(Math.abs(p.vx)>365) {
        p.trailTimer-=dt;
        if(p.trailTimer<=0){this.burst(p.x+16-p.facing*14,p.y+28,2,'#d4efd2',40,'trail');p.trailTimer=.045;}
      }
      if (p.standingPlatform && p.standingPlatform.active) {
        p.x += p.standingPlatform.dx; p.y += p.standingPlatform.dy;
        // Alizé du pont : le vent d'un pont réveillé accompagne la traversée.
        if (this.hasUpgrade('alize') && p.standingPlatform.wakeId && p.standingPlatform.type === 'solid') {
          p.x += Math.sign(p.vx || p.facing) * window.LumenUpgrades.byId.alize.caps.push * dt;
        }
        if (p.standingPlatform.type === 'conveyor') {
          p.x += (p.standingPlatform.direction || 1) * 125 * dt;
          if(p.stepSoundTimer<=0){this.audio.sfx('conveyor');p.stepSoundTimer=.42;}
        }
      }
      const oldY = p.y, oldBottom = p.y + p.h, wasGrounded = p.grounded;
      const horizontalSpeed = p.vx + windDrift;
      p.x += horizontalSpeed * dt;
      for (const ground of this.platforms) {
        if (!ground.active || ground.type !== 'ground' || !overlap(p,ground)) continue;
        if (oldBottom <= ground.y + 5 || p.y >= ground.y + ground.h - 3) continue;
        if (horizontalSpeed > 0) p.x = ground.x - p.w; else if (horizontalSpeed < 0) p.x = ground.x + ground.w;
        p.vx = 0;
      }
      p.x = clamp(p.x, 0, this.level.width - p.w); p.y += p.vy * dt;
      p.grounded = false; p.standingPlatform = null;
      if (p.vy >= 0) {
        // Crossed top surfaces only: decorative undersides never trap the player.
        let landing = null;
        for (const platform of this.platforms) {
          if (!platform.active || p.x + p.w <= platform.x + 2 || p.x >= platform.x + platform.w - 2) continue;
          if (oldBottom <= platform.y - platform.dy + 7 && p.y + p.h >= platform.y && (!landing || platform.y < landing.y)) landing = platform;
        }
        if (landing) {
          const fallSpeed = p.vy;
          p.y = landing.y - p.h; p.vy = 0; p.grounded = true; p.standingPlatform = landing;
          if (!wasGrounded && fallSpeed > 50) { p.landTimer = .18;p.landStrength=clamp(fallSpeed/600,.35,1); this.groundBurst(p.x+16,p.y+p.h,Math.max(5,Math.min(13,Math.floor(fallSpeed/65))),90); this.audio.sfx('land'); }
          if (landing.type === 'crumble' && landing.crumbleTimer <= 0) {landing.crumbleTimer = .62;this.audio.sfx('crumble');}
          if (landing.type === 'spring') {
            p.vy = -985; p.grounded = false; p.coyote = 0; p.standingPlatform = null;
            p.jumpTimer=.2;this.audio.sfx('spring'); this.groundBurst(p.x+16,p.y+p.h,14,140);
          }
          else if(p.jumpBuffer>0&&!p.wet){p.coyote=.12;this.jump(false);}
        }
      }
      // Un dormeur calmé devient une surface : on peut se poser sur son dos.
      if (p.vy >= 0) for (const e of this.enemies) {
        if (!e.alive || e.mount || e.type !== 'sleeper' || e.state !== 'calm') continue;
        if (p.x + p.w <= e.x + 4 || p.x >= e.x + e.w - 4) continue;
        if (oldBottom <= e.y + 8 && p.y + p.h >= e.y && (!p.standingPlatform || e.y < p.standingPlatform.y)) {
          p.y = e.y - p.h; p.vy = 0; p.grounded = true; p.standingPlatform = null;
          if (!wasGrounded) { p.landTimer = .18; p.landStrength = .5; this.audio.sfx('land'); }
        }
      }
      if (p.grounded && Math.abs(p.vx) > 130 && Math.random() < dt*14) this.groundBurst(p.x+16,p.y+p.h,1,35);
      p.previousY = oldY; p.previousBottom = oldBottom;
      for (const h of this.hazards) {
        if (overlap(p,{x:h.x+4,y:h.y+8,w:Math.max(1,h.w-8),h:Math.max(1,h.h-8)})) {
          if (h.type === 'lava') { this.die(); return; }
          this.hurt(1, h.x + h.w/2); p.vy = Math.min(p.vy,-410);
        }
      }
      if (p.y > (this.level.height || 900) - 70) this.die();
    }
    jump(double) {
      const p = this.player;
      p.vy = this.input.down('jump') ? (double ? -630 : -690) : -330;
      p.grounded = false; p.coyote = 0; p.jumpBuffer = 0; p.standingPlatform = null;
      p.jumpTimer=.18;
      if (double) {
        p.airJumps++;
        // Souffle d'azur : le second saut appelle, faiblement, sous les pieds.
        if (this.hasUpgrade('souffle')) {
          const caps = window.LumenUpgrades.byId.souffle.caps;
          this.emitResonance(p.x + p.w / 2, p.y + p.h, window.LumenResonance.BASE_REACH * caps.reach, 'souffle');
        }
      }
      this.audio.sfx(double ? 'doubleJump' : 'jump');
      if(double)this.burst(p.x+16,p.y+p.h,16,'#b7e8db',150,'spark');else this.groundBurst(p.x+16,p.y+p.h,10,110);
    }
    /** Le bouton action. Il émet TOUJOURS une Résonance ; les pouvoirs portés
     *  n'en prennent jamais la place, ils lui ajoutent leur effet historique.
     *  Un pouvoir qui expire ne retire donc jamais le verbe au joueur. */
    usePower() {
      const p = this.player, R = window.LumenResonance;
      if (p.actionCooldown > 0) return;
      const amplifier = R.AMPLIFIERS[p.power];
      this.emitResonance(p.x + p.w / 2, p.y + 22, R.reachFor(p.power) + (this.song ? this.song.count * 28 : 0));
      p.actionCooldown = R.COOLDOWN;

      // Les effets historiques des pouvoirs, inchangés, désormais portés par l'onde.
      if (amplifier && amplifier.seed) {
        this.projectiles.push({ x:p.x+16+p.facing*23, y:p.y+19, vx:p.facing*680, vy:-35, r:8, friendly:true, life:1.6 });
        this.audio.sfx('shoot'); this.burst(p.x+16+p.facing*26,p.y+19,4,'#f6cf7c',75,'spark');
      }
      if (amplifier && amplifier.dash) {
        p.dashTime = .21; p.invuln = Math.max(p.invuln,.4); p.trailTimer=0;
        p.actionCooldown = Math.max(p.actionCooldown, .85);
        this.audio.sfx('dash'); this.shake(3);
      }
      if (amplifier && amplifier.reveal) {
        this.echoTime = amplifier.reveal; this.echoOrigin = { x:p.x+16, y:p.y+22 };
        this.audio.sfx('echo'); this.updatePlatforms(0);
      }
    }
    /** Corolle persistante : l'onde laisse une fleur là où elle est née.
     *  Plafonnée à une seule fleur vivante, et elle ne peut pas se réveiller
     *  elle-même — sans quoi une onde en produirait une boucle infinie. */
    dropCorolle(x, y) {
      if (!this.hasUpgrade('corolle')) return;
      const caps = window.LumenUpgrades.byId.corolle.caps;
      const R = window.LumenResonance;
      this.wakeables = this.wakeables.filter(w => w.id !== 'corolle-vivante');
      this.platforms = this.platforms.filter(p => p.wakeId !== 'corolle-vivante');
      const flower = R.createWakeable({ type:'bloom', x, y: Math.min(y + 30, 690), id:'corolle-vivante', temporary:true }, 0);
      R.wake(flower); flower.remaining = caps.life;
      this.wakeables.push(flower);
      for (const platform of R.platformsFor(flower)) {
        this.platforms.push({ phase:0, ...platform, active:true, id:this.platforms.length,
          baseX:platform.x, baseY:platform.y, dx:0, dy:0, crumbleTimer:0, reformTimer:0 });
      }
      this.burst(x, y + 20, 10, '#ffd0bb', 110, 'petal');
    }
    /** Émet une onde. Les carillons en émettent aussi : c'est le même chemin. */
    emitResonance(x, y, reach, source = 'player') {
      const R = window.LumenResonance;
      if (this.waves.length >= 12) return null;
      const wave = R.createWave(x, y, reach, source);
      this.waves.push(wave);
      this.audio.sfx(source === 'player' ? 'resonance' : 'resonanceRelay');
      this.burst(x, y, source === 'player' ? 14 : 8, '#cfeee0', 120, 'spark');
      if (source === 'player') { this.shake(1.6); this.dropCorolle(x, y); }
      return wave;
    }
    updateResonance(dt) {
      const R = window.LumenResonance;
      for (const wakeable of this.wakeables) {
        if (R.advance(wakeable, dt) === 'slept' && R.WAKE_TYPES[wakeable.type].platforms(wakeable).length) {
          this.audio.sfx('wakeEnd');
        }
      }
      for (let i = this.waves.length - 1; i >= 0; i--) {
        const wave = this.waves[i];
        if (!R.advanceWave(wave, dt)) { this.waves.splice(i, 1); continue; }
        for (const wakeable of R.newlyReached(wave, this.wakeables)) {
          const outcome = R.wake(wakeable);
          const config = R.WAKE_TYPES[wakeable.type];
          this.audio.sfx(config.sound);
          this.burst(wakeable.x, wakeable.y, outcome === 'extended' ? 8 : 18, '#e8f6cf', 140, 'spark');
          if (outcome === 'woken') { this.addScore(15); this.wokenOnce.add(wakeable.id); }
          // Un carillon ne porte rien : il relance l'onde depuis sa place, une
          // seule fois par réveil, ce qui rend les chaînes finies et prévisibles.
          if (config.relay && !wakeable.relayed) {
            wakeable.relayed = true;
            this.emitResonance(wakeable.x, wakeable.y, wave.reach * .95, 'chime');
          }
        }
      }
      // La créature endormie a sa propre réaction : l'onde la lève en douceur
      // au lieu de la faire charger. Elle devient une marche, pas une menace.
      // L'apaisement a UN SEUL propriétaire : cette boucle. Elle tourne à chaque
      // image, quelle que soit la distance à Lumen, et le minuteur générique des
      // créatures (`timer`) n'a plus rien à dire dessus — c'est exactement ce
      // qui faisait retomber un dormeur au sommeil au bout d'une image.
      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy.type !== 'sleeper') continue;
        if (enemy.calmTime > 0) {
          enemy.calmTime -= dt;
          // Le réveil s'annonce avant d'arriver : la posture change, un son
          // discret part, et rien n'attaque tant que le répit n'est pas écoulé.
          const warning = enemy.calmTime <= CALM_WARNING;
          if (warning && !enemy.rousing) this.audio.sfx('powerWarning');
          enemy.rousing = warning;
          if (enemy.calmTime <= 0) {
            enemy.calmTime = 0; enemy.rousing = false;
            enemy.state = 'sleep'; enemy.chargeProgress = 0;
            // Le répit : elle se rendort, elle ne charge pas dans la seconde.
            enemy.rouseGrace = CALM_GRACE;
            this.burst(enemy.x + enemy.w / 2, enemy.y + 4, 8, '#cddcc4', 70, 'dust');
          }
        }
        for (const wave of this.waves) {
          const key = 'enemy:' + (enemy.spawnX + ':' + enemy.spawnY);
          if (wave.touched.has(key)) continue;
          if (R.distance(wave.x, wave.y, enemy.x + enemy.w / 2, enemy.y) > wave.radius) continue;
          wave.touched.add(key);
          // Prolonger, jamais raccourcir : une onde reçue à sept secondes de
          // répit ne doit pas ramener le compte à huit en le rabaissant.
          enemy.calmTime = Math.max(enemy.calmTime, CALM_TIME);
          enemy.state = 'calm'; enemy.chargeProgress = 0; enemy.vx = 0;
          enemy.rousing = false; enemy.rouseGrace = 0;
          this.audio.sfx('wakeCalm');
          this.burst(enemy.x + enemy.w / 2, enemy.y, 16, '#dbeccd', 130, 'spark');
        }
      }
    }
    updateEnemies(dt) {
      const p = this.player;
      for (const e of this.enemies) {
        if (e.mount) continue; // The moving sleeper's deck owns its collision.
        if (!e.alive || Math.abs(e.x - p.x) > 1250) continue;
        e.phase += dt; e.timer -= dt; e.hitFlash = Math.max(0,(e.hitFlash || 0)-dt);
        const distance = p.x-e.x;
        // A scattered swarm is already beaten: it drifts apart and harms nobody.
        if (e.scatterTime>0) {
          e.scatterTime-=dt; e.x+=e.vx*dt; e.y+=e.vy*dt; e.vy-=40*dt;
          if (e.scatterTime<=0) e.alive=false;
          continue;
        }
        if (e.type === 'swarm') {
          // Fireflies keep a loose ring around their thicket until Lumen comes close,
          // then the whole cloud leans towards him without ever matching his speed.
          const dy=(p.y+20)-(e.y+e.h/2), reach=Math.hypot(distance,dy);
          e.state=reach<330?'hunt':'orbit';
          const min=e.minX ?? e.spawnX-120, max=e.maxX ?? e.spawnX+120;
          const driftX=e.state==='hunt'?clamp(distance,-1,1)*72:Math.sin(e.phase*.85)*46;
          const driftY=e.state==='hunt'?clamp(dy*.9,-58,58):Math.sin(e.phase*1.5+1.2)*30;
          e.vx=approach(e.vx,driftX,dt*150); e.vy=approach(e.vy,driftY,dt*130);
          e.x=clamp(e.x+e.vx*dt,min,max-e.w); e.y=clamp(e.y+e.vy*dt,e.spawnY-120,e.spawnY+90);
          e.facing=e.vx<0?-1:1;
        } else if (e.type === 'sleeper') {
          // Tension by proximity: linger next to it and the mound wakes and charges.
          const near=Math.abs(distance)<180&&Math.abs((p.y+p.h)-(e.y+e.h))<140;
          if (e.state==='calm') {
            // Apaisée : elle ne charge pas, elle ne dérive pas, et sa durée
            // appartient à `updateResonance`. Rien ici ne doit l'abréger.
            e.vx=approach(e.vx,0,dt*400); e.chargeProgress=0;
          } else if (e.state==='sleep') {
            e.vx=0;
            // Le répit qui suit un apaisement : elle se rendort vraiment avant
            // de pouvoir se fâcher de nouveau.
            if (e.rouseGrace>0) { e.rouseGrace-=dt; e.chargeProgress=0; }
            else e.chargeProgress=clamp(e.chargeProgress+(near?dt/1.25:-dt*.9),0,1);
            if (e.chargeProgress>=1) { e.state='wake'; e.timer=.55; e.facing=distance<0?-1:1; this.audio.sfx('sleeperWake'); this.burst(e.x+e.w/2,e.y+6,10,'#ffd9a0',110,'spark'); }
          } else if (e.state==='wake') {
            e.vx=0;
            if (e.timer<=0) { e.state='charge'; e.timer=2.4; e.facing=distance<0?-1:1; }
          } else if (e.state==='charge') {
            e.vx=e.facing*245;
            const min=e.minX ?? e.spawnX-80, max=e.maxX ?? e.spawnX+100;
            if (e.x<=min&&e.facing<0) e.facing=1; if (e.x+e.w>=max&&e.facing>0) e.facing=-1;
            if (Math.random()<dt*22) this.burst(e.x+e.w/2,e.y+e.h,1,'#e8cfa4',55,'dust');
            if (e.timer<=0) { e.state='settle'; e.timer=1; }
          } else { e.vx=approach(e.vx,0,dt*320); if (e.timer<=0) { e.state='sleep'; e.chargeProgress=0; } }
          const oldBottom=e.y+e.h; e.x+=e.vx*dt; e.vy=Math.min(e.vy+1800*dt,900); e.y+=e.vy*dt; e.grounded=false;
          for (const ground of this.platforms) {
            if (!ground.active || e.x+e.w<=ground.x || e.x>=ground.x+ground.w) continue;
            if (e.vy>=0 && oldBottom<=ground.y+7 && e.y+e.h>=ground.y) { e.y=ground.y-e.h; e.vy=0; e.grounded=true; }
          }
          if (e.y>(this.level.height||900)-70) { e.alive=false; continue; }
        } else if (e.type === 'chaser') {
          e.vx = approach(e.vx, Math.abs(distance)<570 ? Math.sign(distance)*125 : Math.sign(e.spawnX-e.x)*60,dt*140);
          e.vy = approach(e.vy, Math.abs(distance)<570 ? clamp((p.y-35-e.y)*1.5,-110,110) : Math.sin(e.phase*2)*25,dt*120);
          e.x += e.vx*dt; e.y += e.vy*dt; e.facing=e.vx<0?-1:1;
        } else {
          const min = e.minX ?? e.spawnX-80, max = e.maxX ?? e.spawnX+100;
          if (e.x <= min) e.facing=1; if (e.x+e.w >= max) e.facing=-1;
          if (e.type === 'turret') {
            e.facing=distance<0?-1:1; e.vx=0;
            if (e.timer <= 0 && Math.abs(distance) < 780) {
              const dx=p.x+16-e.x-e.w/2, dy=p.y+20-e.y-10, len=Math.hypot(dx,dy)||1;
              this.projectiles.push({x:e.x+e.w/2,y:e.y+10,vx:dx/len*225,vy:dy/len*225,r:8,friendly:false,life:4});
              e.timer=2.4; this.burst(e.x+e.w/2,e.y+10,4,'#d58d74',60,'spark');
            }
          } else {
            e.vx=e.facing*(e.type==='hopper'?85:65);
            if (e.type === 'hopper' && e.timer <= 0 && e.grounded) { e.vy=-465; e.timer=1.6; }
          }
          const oldBottom=e.y+e.h; e.x+=e.vx*dt; e.vy=Math.min(e.vy+1800*dt,900); e.y+=e.vy*dt; e.grounded=false;
          for (const ground of this.platforms) {
            if (!ground.active || e.x+e.w<=ground.x || e.x>=ground.x+ground.w) continue;
            if (e.vy>=0 && oldBottom<=ground.y+7 && e.y+e.h>=ground.y) { e.y=ground.y-e.h; e.vy=0; e.grounded=true; }
          }
          if (e.y>(this.level.height||900)-70) {e.alive=false; continue;}
        }
        if (overlap(p,{x:e.x+3,y:e.y+3,w:e.w-6,h:e.h-3})) {
          if (p.dashTime>0) this.killEnemy(e);
          else if (p.vy>70 && p.previousBottom<=e.y+17) {
            this.killEnemy(e); p.vy=this.input.down('jump')?-560:-430; p.grounded=false; p.airJumps=0;
          }
          // A sleeping mound is only scenery: brushing past it costs nothing, and
          // that is precisely what makes lingering beside it a real decision.
          else if (!(e.type==='sleeper'&&(e.state==='sleep'||e.state==='calm'))) this.hurt(1,e.x+e.w/2);
        }
      }
    }
    killEnemy(e) {
      if (!e.alive || e.scatterTime>0) return;
      this.enemiesDefeated++; this.shake(3.2);
      if (e.type==='swarm') {
        // The cloud does not pop: it bursts apart and the motes drift out of sight.
        e.scatterTime=1.2; e.vx=(Math.random()*2-1)*120; e.vy=-160;
        this.addScore(220); this.audio.sfx('swarm'); this.burst(e.x+e.w/2,e.y+e.h/2,26,'#fff0b0',210,'spark');
        this.float(e.x,e.y,'+220','#ffeaa8'); return;
      }
      e.alive=false; this.addScore(150); this.audio.sfx('stomp'); this.burst(e.x+e.w/2,e.y+e.h/2,20,'#e2c280',180,'spark');
      this.float(e.x,e.y,'+150','#e8c775');
    }
    updateBoss(dt) {
      const b=this.boss, p=this.player;
      if (!b || b.hp<=0) return;
      b.hitFlash=Math.max(0,b.hitFlash-dt); b.facing=p.x<b.x?-1:1;
      if (!b.activated) {
        if (p.x > this.level.width - 1420) {
          b.activated=true; b.state='wake'; b.timer=1.7; this.emit('toast','Le Veilleur s’éveille. Visez sa couronne lorsqu’elle brille !');
          this.audio.sfx('bossAttack');
        } else return;
      }
      b.timer-=dt; b.phase=b.hp<=6?2:1;
      b.flashTimer=Math.max(0,b.flashTimer-dt);
      this.updateBossStage(b);
      this.updateArena(b,dt);
      if (b.state === 'wake' && b.timer<=0) { b.state='telegraph'; b.timer=1.15; b.attack++; }
      if (b.state === 'telegraph') {
        b.vulnerable=false;
        if (b.timer<=0) {
          // Phase one alternates leap and volley; phase two folds in a third pattern.
          const pattern=b.phase===2?['leap','volley','rain'][b.attack%3]:(b.attack%2===1?'leap':'volley');
          if (pattern==='leap') {
            b.state='leap'; b.vy=b.phase===2?-880:-800; b.vx=clamp((p.x-b.x)*(b.phase===2?1.35:1.15),-470,470); this.audio.sfx('bossAttack');
          } else if (pattern==='volley') {
            b.state='volley'; b.timer=b.phase===2?1.6:2.0; b.shotTimer=0;
          } else {
            // Falling light: the ground is marked well before anything comes down.
            b.state='rain'; b.timer=2.5; b.rainDropped=false;
            const left=b.arenaActive?b.arenaLeft:this.level.width-1330;
            const span=(b.arenaActive?b.arenaRight:this.level.width-200)-left;
            b.rainMarkers=Array.from({length:5},(_,i)=>({x:left+span*(i+.5)/5+(Math.random()*2-1)*40,life:1.1}));
            this.audio.sfx('bossAttack');
          }
        }
      } else if (b.state === 'rain') {
        for (const marker of b.rainMarkers) marker.life=Math.max(0,marker.life-dt);
        if (!b.rainDropped && b.timer<=1.4) {
          b.rainDropped=true; this.shake(5);
          for (const marker of b.rainMarkers) this.projectiles.push({x:marker.x,y:b.y-140,vx:0,vy:330,r:11,friendly:false,life:4,kind:'rain'});
        }
        if (b.timer<=0) { b.state='recover'; b.timer=2.4; b.vulnerable=true; b.rainMarkers=[]; }
      } else if (b.state === 'leap') {
        b.vy+=1550*dt; b.x=clamp(b.x+b.vx*dt,this.level.width-1330,this.level.width-260); b.y+=b.vy*dt;
        if (b.y+b.h>=600 && b.vy>0) {
          b.y=600-b.h; b.vy=0; b.vx=0; b.state='recover'; b.timer=b.phase===2?2.6:3.4; b.vulnerable=true;
          this.shake(11); this.burst(b.x+b.w/2,596,30,'#d3ad82',240,'stone'); this.audio.sfx('bossAttack');
          // The impact rings are low, slow and jumpable, with a clear landing tell.
          for (const direction of [-1,1]) this.projectiles.push({x:b.x+b.w/2+direction*60,y:582,vx:direction*(b.phase===2?290:230),vy:0,r:14,friendly:false,life:4,kind:'wave'});
        }
      } else if (b.state === 'volley') {
        b.shotTimer-=dt;
        if (b.shotTimer<=0) {
          const dx=p.x+16-b.x-b.w/2,dy=p.y+15-b.y-25,len=Math.hypot(dx,dy)||1;
          this.projectiles.push({x:b.x+b.w/2,y:b.y+25,vx:dx/len*245,vy:dy/len*245,r:10,friendly:false,life:5});
          b.shotTimer=b.phase===2?.4:.65; this.audio.sfx('shoot');
        }
        if (b.timer<=0) {b.state='recover'; b.timer=3.2; b.vulnerable=true;}
      } else if (b.state === 'recover' && b.timer<=0) {
        b.state='telegraph'; b.timer=b.phase===2?.8:1.2; b.vulnerable=false; b.attack++;
      }
      // During recovery the crown lowers to a reachable height, even without a power.
      if (b.state !== 'leap') { const targetY=b.vulnerable?530:470; b.y=approach(b.y,targetY,240*dt); }
      if (b.state !== 'leap' && b.arenaActive) b.x=clamp(b.x,b.arenaLeft+30,b.arenaRight-b.w-30);
      const body={x:b.x+15,y:b.y+12,w:b.w-30,h:Math.min(b.h,600-b.y)-12};
      if (overlap(p,body)) {
        if (b.vulnerable && p.vy>60 && p.previousBottom<=b.y+37) {this.hitBoss(2);p.vy=-650;p.airJumps=0;p.invuln=Math.max(p.invuln,.3);}
        else if (b.vulnerable && p.dashTime>0) this.hitBoss(2);
        else if (b.hitFlash<=0) this.hurt(1,b.x+b.w/2);
      }
    }
    /** Every third of its life removed is announced loudly: flash, shake, new tempo. */
    updateBossStage(b) {
      const stage=b.hp>b.maxHp*2/3?1:b.hp>b.maxHp/3?2:3;
      if (stage===b.stage) return;
      b.stage=stage; b.flashTimer=.5; this.shake(13);
      this.screenFlash(stage===3?'#ffd2a4':'#fff0c2',.55);
      this.audio.setBossPhase?.(stage); this.audio.sfx('bossStage');
      this.burst(b.x+b.w/2,b.y+b.h/2,46,'#ffe0a4',290,'spark');
      if (stage===2) this.emit('toast','Le Veilleur se referme. L’arène se resserre et ses attaques s’enchaînent.');
      if (stage===3) this.emit('toast','Dernier tiers ! Sa lumière vacille — tenez bon.');
    }
    /** Phase two literally narrows the ground the fight is played on. */
    updateArena(b,dt) {
      if (b.phase===2 && !b.arenaActive && b.activated) { b.arenaActive=true; b.arenaWarn=1.2; this.audio.sfx('arena'); }
      if (!b.arenaActive) return;
      b.arenaWarn=Math.max(0,b.arenaWarn-dt);
      const full=this.level.width-1400, open=this.level.width-180;
      b.arenaLeft=approach(b.arenaLeft,full+150,55*dt);
      b.arenaRight=approach(b.arenaRight,open-110,45*dt);
      // The walls push rather than crush: Lumen is nudged back inside, never trapped.
      const p=this.player;
      if (p.x<b.arenaLeft) { p.x=b.arenaLeft; if (p.vx<0) p.vx=0; }
      if (p.x+p.w>b.arenaRight) { p.x=b.arenaRight-p.w; if (p.vx>0) p.vx=0; }
    }
    hitBoss(damage) {
      const b=this.boss;
      if (!b || !b.vulnerable || b.hitFlash>0 || b.hp<=0) return false;
      b.hp=Math.max(0,b.hp-damage); b.hitFlash=.65;
      this.audio.sfx('bossHit');this.burst(b.x+b.w/2,b.y+25,22,'#f9d585',220,'spark');this.shake(7);
      if (b.hp<=0) {
        b.state='defeated';b.vulnerable=false;this.exit.open=true;this.projectiles=this.projectiles.filter(x=>x.friendly);
        this.addScore(3000);this.audio.sfx('victory');this.burst(b.x+b.w/2,b.y+40,80,'#ffe6a3',330,'spark');
        this.emit('toast','Le Veilleur retrouve sa lumière. Rejoignez la porte lunaire !');
      }
      return true;
    }
    updateProjectiles(dt) {
      for (const shot of this.projectiles) {
        shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
        const rect={x:shot.x-shot.r,y:shot.y-shot.r,w:shot.r*2,h:shot.r*2};
        if (shot.friendly) {
          for (const e of this.enemies) if (e.alive&&overlap(rect,e)) {this.killEnemy(e);shot.life=0;break;}
          if (this.boss&&this.boss.hp>0&&overlap(rect,{x:this.boss.x,y:this.boss.y,w:this.boss.w,h:this.boss.h})) {
            if (!this.hitBoss(1)) this.burst(shot.x,shot.y,5,'#93afa7',60,'spark');shot.life=0;
          }
        } else if (overlap(rect,this.player)) {this.hurt(1,shot.x);shot.life=0;}
        for (const p of this.platforms) if (p.type==='ground'&&p.active&&shot.y>p.y+3&&overlap(rect,p)) {shot.life=0;break;}
      }
      this.projectiles=this.projectiles.filter(s=>s.life>0&&s.y>-200&&s.y<850&&Math.abs(s.x-this.player.x)<1600);
    }
    updateCollectibles() {
      const p=this.player;
      for (const c of this.collectibles) {
        if (c.taken) continue;
        const radius=c.type==='star'?21:17;
        if (!overlap(p,{x:c.x-radius,y:c.y-radius,w:radius*2,h:radius*2})) continue;
        c.taken=true;
        if (c.type==='coin') {
          this.levelCoins++;this.addScore(25);this.burst(c.x,c.y,9,'#f2d17a',110,'spark');
          if (this.song) this.song.note(this, c);
          else {
            this.audio.sfx('coin');
            if (this.levelCoins%40===0) {this.lives=Math.min(9,this.lives+1);this.emit('toast','40 éclats : une vie supplémentaire !');this.audio.sfx('power');}
          }
        } else if (c.type==='star') {
          this.levelStars++;this.addScore(500);this.audio.sfx('star');this.burst(c.x,c.y,28,'#ffe4a1',210,'spark');this.float(c.x,c.y,'Fragment lunaire +500','#f9daa2');
        } else if (c.type==='heart') {
          p.hp=Math.min(3,p.hp+1);this.audio.sfx('power');this.burst(c.x,c.y,15,'#e7a994',130,'spark');this.float(c.x,c.y,'Une nouvelle énergie','#e6ac98');
        } else {
          const durations={echo:40},colors={breeze:'#bcebdc',comet:'#d8c7ed',echo:'#c4f1da'};
          p.power=c.type;p.powerDuration=durations[c.type]||35;p.powerTime=p.powerDuration;
          p.airJumps=0;p.actionCooldown=0;p.powerWarning=false;
          this.audio.sfx('power');this.burst(c.x,c.y,25,colors[c.type]||'#f2cd78',180,'spark');
          const names={bloom:'Fleur solaire · X pour lancer des graines de lumière',
            breeze:'Plume d’azur · Un second saut dans les airs',
            comet:'Cœur comète · X pour une ruée protectrice',
            echo:'Grelot d’écho · X pour révéler les chemins cachés pendant 4 s'};
          this.emit('toast',names[c.type]||'Un nouveau pouvoir !');
        }
      }
    }
    updateCheckpoints() {
      for (const c of this.checkpoints) {
        if (!c.active&&Math.abs(this.player.x+16-c.x)<42&&Math.abs(this.player.y+this.player.h-c.y)<85) {
          for (const other of this.checkpoints) other.active=false;
          c.active=true;this.checkpoint={x:c.x-16,y:c.y-48};this.player.hp=3;
          this.audio.sfx('checkpoint');this.burst(c.x,c.y-65,25,'#d5e4ab',175,'spark');this.emit('toast','Lanterne allumée · Énergie restaurée, passage mémorisé');
        }
      }
    }
    /* ── L'observatoire : personnages, quête, transformation ──────────────
     * Le lieu ne raconte rien par un long texte : il raconte par deux voix
     * courtes, par ce que le joueur fait de ses mains, et par un décor qui
     * change une fois pour toutes. */

    /** L'état de la quête du chapitre courant, s'il en a une. */
    questState() {
      const quest = this.level.quest;
      if (!quest) return null;
      return this.store.questState(quest.id);
    }
    /** Les répliques à afficher pour un personnage, selon l'avancement. */
    linesFor(character) {
      const state = this.questState() || 'unknown';
      const lines = character.lines || {};
      return lines[state] || lines.unknown || [];
    }
    updateCharacters(dt) {
      const p = this.player, quest = this.level.quest;
      for (const character of this.characters) {
        const near = Math.abs((p.x + p.w / 2) - character.x) < 76 && Math.abs((p.y + p.h) - character.y) < 90;
        character.bob = (character.bob || 0) + dt;
        if (near === character.near) continue;
        character.near = near;
        // Approcher suffit : aucune touche à découvrir, aucun appui à rater.
        if (near) {
          character.facing = p.x + p.w / 2 < character.x ? -1 : 1;
          this.emit('dialogue', { character, lines: this.linesFor(character) });
          if (quest && this.store.questState(quest.id) === 'unknown' && character.id === 'vesper') {
            this.store.setQuestState(quest.id, 'active');
            this.saveProgress();
            this.emit('quest', { quest, state: 'active' });
          }
        } else this.emit('dialogue', null);
      }
      if (!quest || this.store.questState(quest.id) === 'done') return;
      // La quête se lit dans le monde, pas dans un compteur caché : elle est
      // remplie quand les trois carillons ont effectivement été réveillés.
      const woken = quest.needs.filter(id => this.wokenOnce.has(id));
      if (woken.length < quest.needs.length) return;
      this.store.setQuestState(quest.id, 'done');
      if (quest.transformation) this.store.addTransformation(quest.transformation);
      this.saveProgress();
      this.exit.open = true;
      this.addScore(500);
      this.audio.sfx('victory'); this.screenFlash('#fff0c8', .7);
      this.burst(this.player.x + 16, this.player.y, 60, '#ffe9b4', 260, 'spark');
      this.emit('quest', { quest, state: 'done' });
      this.emit('toast', quest.reward);
    }
    updateSecrets() {
      for (const s of this.secrets) if (!s.found&&overlap(this.player,s)) {
        s.found=true;this.secretCount++;this.addScore(750);this.audio.sfx('secret');this.burst(this.player.x+16,this.player.y,35,'#cfe7b8',210,'spark');
        this.progress.bonusUnlocked=true;
        if (this.session !== 'expedition') this.store.recordSecrets(this.level.key, this.secretCount);
        this.saveProgress();this.float(this.player.x,this.player.y,'Passage secret +750','#daf0c4');
        this.emit('toast','Passage secret découvert ! Le Jardin oublié vous attend dans l’atlas.');
      }
    }
    hurt(amount, sourceX) {
      const p=this.player;
      if (p.invuln>0||p.dead||this.mode!=='playing') return;
      p.hp-=amount;p.invuln=1.5;p.vx=(p.x+16<sourceX?-1:1)*290;p.vy=-330;p.grounded=false;p.standingPlatform=null;
      this.damageTaken+=amount;
      this.shake(7);this.audio.sfx('hit');this.burst(p.x+16,p.y+20,18,'#e8ab95',185,'spark');
      this.screenFlash('#ff9d8c',.32);this.emit('damage',{hp:p.hp});
      if (p.hp<=0) this.die();
    }
    die() {
      if (this.mode!=='playing') return;
      if (this.song) {
        this.song.returnPoint = this.song.style === 'gentle' ? this.song.safe || this.checkpoint : this.checkpoint;
        this.song.combo = 0; this.song.comboTime = 0; this.song.trail = [];
        this.player.dead = true; this.player.vx = 0; this.player.vy = -160;
        this.mode = 'dead'; this.deadTimer = .5; this.deaths++;
        this.audio.sfx('wakeEnd'); this.emit('mode', this.mode);
        return;
      }
      this.player.dead=true;this.player.vy=-390;this.player.vx=0;this.mode='dead';this.deadTimer=.85;
      this.lives--;this.deaths++;if(this.session==='expedition'&&this.run)this.run.lives=this.lives;this.shake(9);this.audio.sfx('death');this.burst(this.player.x+16,this.player.y+24,30,'#e9c795',230,'spark');
      this.emit('mode',this.mode);
    }
    respawn() {
      if (this.lives<=0) {
        this.audio.pause();
        // L'échec met fin à la NUIT, pas au profil : tout ce qui a été appris
        // et débloqué reste acquis, et l'observatoire attend toujours.
        if (this.session === 'expedition' && this.run) return this.finishExpedition(false);
        this.mode='gameover';this.emit('mode',this.mode);return;
      }
      const p=this.player, returnPoint=this.song?.returnPoint || this.checkpoint;
      Object.assign(p,{x:returnPoint.x,y:returnPoint.y,vx:0,vy:0,w:32,h:46,hp:3,dead:false,invuln:2,
        grounded:false,coyote:0,jumpBuffer:0,airJumps:0,dashTime:0,standingPlatform:null,slide:false,power:null,powerTime:0});
      this.projectiles=[];
      // Safe landing after a fall: disappearing platforms return during respawn.
      for (const platform of this.platforms) if (platform.type==='crumble') {platform.active=true;platform.crumbleTimer=0;platform.reformTimer=0;}
      // Un retour au checkpoint remet le jardin dans son état de repos : le
      // joueur retrouve exactement l'énigme qu'il a échouée, pas un état à moitié.
      this.waves=[];
      for (const wakeable of this.wakeables) {wakeable.state='asleep';wakeable.remaining=0;wakeable.relayed=false;}
      for (const enemy of this.enemies) if (enemy.type==='sleeper') {enemy.calmTime=0;enemy.rousing=false;enemy.rouseGrace=0;enemy.state='sleep';enemy.chargeProgress=0;}
      window.LumenPlaces?.respawn(this);
      if (this.boss&&this.boss.activated&&this.boss.hp>0) {
        const b=this.boss;Object.assign(b,{x:b.homeX,y:470,state:'wake',timer:2,vx:0,vy:0,vulnerable:false});
      }
      const visibleWidth=this.renderer.worldWidth||WIDTH;
      this.camera.x=clamp(p.x-visibleWidth*.36,0,Math.max(0,this.level.width-visibleWidth));
      if (this.level.place?.kind === 'ascent') this.camera.y=clamp(p.y-HEIGHT*.52,0,Math.max(0,this.level.height-HEIGHT));
      this.mode='playing';this.input.reset();this.burst(p.x+16,p.y+23,26,'#d7e8b9',150,'spark');this.emit('mode',this.mode);
    }
    complete() {
      if (this.mode!=='playing') return;
      if (this.song) return this.completeSong();
      const final=!!this.level.final;this.mode=final?'ending':'complete';this.player.vx=0;this.player.vy=0;this.player.grounded=true;
      const bonus=1000+Math.max(0,1200-Math.floor(this.elapsed*5))+this.player.hp*100;
      this.addScore(bonus);
      const medal=this.medalFor(this.levelStars,this.damageTaken,this.elapsed);
      const timed=this.runMode==='timed';
      const record=this.store.recordChapter(this.keyOf(this.levelIndex),{
        stars:this.levelStars,coins:this.levelCoins,score:this.levelScore,secrets:this.secretCount,
        time:this.elapsed,medal,timed});
      // Un chapitre bonus atteint en avance n'ouvre pas la suite de la campagne.
      const openNext=!this.level.bonus||this.store.isUnlocked(this.keyOf(this.levelIndex));
      if (openNext&&this.levelIndex+1<window.LUMEN_LEVELS.length) this.store.unlock(this.keyOf(this.levelIndex+1));
      // Bonus stages remain optional in the journey. Preserve their historical
      // unlock, while also opening the next required garden after one.
      if (openNext) {
        const nextRequired = window.LUMEN_LEVELS.findIndex((level, index) => index > this.levelIndex && !level.bonus && !level.hub);
        if (nextRequired >= 0) this.store.unlock(this.keyOf(nextRequired));
      }
      if (final) this.progress.finished=true;
      this.saveProgress();this.audio.sfx('victory');this.burst(this.player.x+16,this.player.y,70,'#ffe1a0',300,'spark');
      if (medal==='gold') { this.audio.sfx('medal'); this.screenFlash('#fff0be',.6); }
      this.audio.setDanger?.(0);
      this.emit('complete',{index:this.levelIndex,final,coins:this.levelCoins,stars:this.levelStars,time:this.elapsed,
        score:this.levelScore,bonus,secrets:this.secretCount,medal,timed,record,
        enemiesDefeated:this.enemiesDefeated,damageTaken:this.damageTaken});
      this.emit('mode',this.mode);
    }
    completeSong() {
      if (this.mode !== 'playing' || !this.song || this.song.count !== this.song.lights.length) return false;
      // The third island is a breath before act III, not the end of LUMEN.
      const song = this.song, final = false;
      const timed = song.style === 'flow';
      const medal = this.medalFor(this.levelStars, this.deaths, this.elapsed);
      this.addScore(1000 + song.bestCombo * 25);
      const result = { stars: this.levelStars, coins: this.levelCoins, score: this.levelScore,
        time: this.elapsed, medal, timed };
      this.store.recordChapter(this.level.key, result);
      const record = this.store.recordChapter(this.level.key + ':' + song.style, result);
      this.saveProgress(); this.mode = final ? 'ending' : 'complete'; this.input.reset();
      this.player.vx = 0; this.player.vy = 0;
      this.audio.sfx('victory'); this.burst(this.player.x + 16, this.player.y, 70, '#fff0b4', 230, 'petal');
      this.emit('song-complete', { ...result, index: song.index, final, record,
        combo: song.bestCombo, airNotes: song.airNotes, falls: this.deaths });
      this.emit('mode', this.mode);
      return true;
    }
    /** Gold asks for everything at once; silver for a clean run; bronze for arriving.
     *  Both run modes award medals — the timer only records a personal best. */
    medalFor(stars,damage,seconds) {
      const total=this.level.collectibles.filter(c=>c.type==='star').length||3;
      const targets=this.level.medalTargets||{};
      if (stars>=total&&damage<=1&&seconds<=(targets.gold??Infinity)) return 'gold';
      if (stars>=Math.max(1,total-1)&&damage<=3&&seconds<=(targets.silver??Infinity)) return 'silver';
      return 'bronze';
    }
    addScore(amount) { this.score+=amount;this.levelScore+=amount; }
    /** Footfall debris drawn from the current garden: leaves, bubbles, embers, flakes. */
    groundBurst(x,y,count,speed=90) {
      const dust=GROUND_DUST[this.level?.theme]||GROUND_DUST.meadow;
      const room=Math.max(0,500-this.particles.length);
      for (let i=0;i<Math.min(count,room);i++) {
        // Debris sprays sideways along the floor rather than exploding upwards.
        const spread=(Math.random()*2-1)*Math.PI*.42, velocity=speed*(.35+Math.random()*.8);
        const life=.32+Math.random()*.5;
        this.particles.push({x:x+(Math.random()*2-1)*11,y,
          vx:Math.sin(spread)*velocity*1.35,vy:-Math.abs(Math.cos(spread))*velocity*.55-14,
          life,maxLife:life,size:2+Math.random()*3.4,
          color:dust.colors[Math.floor(Math.random()*dust.colors.length)],type:dust.type});
      }
    }
    /** L'échelle des effets d'écran. À 0,2, les secousses restent perceptibles
     *  sans jamais fatiguer ; les voiles lumineux disparaissent tout à fait. */
    get effectScale() { return this.progress.settings.reducedEffects ? .2 : 1; }
    /** A brief, low-opacity wash over the scene. The renderer caps it at 24 %. */
    screenFlash(color,life=.3) {
      if (this.progress.settings.reducedEffects) return;
      this.flash={color,life,maxLife:life};
    }
    /** Une secousse, mise à l'échelle du réglage de confort. */
    shake(amount) { this.camera.shake = Math.max(this.camera.shake, amount * this.effectScale); }
    /** Keeps the score's extra tension layer in step with what is actually hunting Lumen. */
    updateDanger(dt) {
      const p=this.player;
      let target=0;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const distance=Math.abs(e.x-p.x);
        if (distance>620) continue;
        const closeness=1-distance/620;
        if (e.type==='chaser') target=Math.max(target,closeness);
        else if (e.type==='sleeper'&&(e.state==='wake'||e.state==='charge')) target=Math.max(target,closeness*1.1);
        else if (e.type==='swarm'&&e.state==='hunt') target=Math.max(target,closeness*.8);
      }
      if (this.boss&&this.boss.activated&&this.boss.hp>0) target=Math.max(target,this.boss.phase===2?1:.55);
      // Tension rises quickly and falls back slowly, so the layer never flickers.
      this.danger=approach(this.danger,clamp(target,0,1),dt*(target>this.danger?2.2:.85));
      this.dangerTimer-=dt;
      if (this.dangerTimer<=0) { this.dangerTimer=.25; this.audio.setDanger?.(this.danger); }
    }
    burst(x,y,count,color,speed=100,type='spark') {
      const room=Math.max(0,500-this.particles.length);
      for (let i=0;i<Math.min(count,room);i++) {
        const angle=Math.random()*Math.PI*2,velocity=speed*(.25+Math.random()*.75),life=.3+Math.random()*.55;
        this.particles.push({x,y,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity-30,life,maxLife:life,size:2+Math.random()*4,color,type});
      }
    }
    float(x,y,text,color) {this.floatingTexts.push({x,y,text,life:1.5,color});}
    updateEffects(dt) {
      // Each debris shape falls with its own weight: embers rise, flakes drift, stones drop.
      const GRAVITY={bubble:-90,ember:-60,dust:30,flake:42,petal:58,leaf:66,trail:12,stone:260};
      for (const p of this.particles) {
        p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        p.vy+=(GRAVITY[p.type]??220)*dt;
        if (p.type==='leaf'||p.type==='petal'||p.type==='flake') p.x+=Math.sin(p.life*7+p.size)*22*dt;
        p.vx*=1-dt*(p.type==='flake'||p.type==='petal'?2.6:1.5);
      }
      this.particles=this.particles.filter(p=>p.life>0);
      for (const t of this.floatingTexts) {t.y-=30*dt;t.life-=dt;}
      this.floatingTexts=this.floatingTexts.filter(t=>t.life>0);
    }
  }
  window.LumenGame=Game;
  window.LumenPhysics={WIDTH,HEIGHT,STEP,clamp,overlap};
})();
