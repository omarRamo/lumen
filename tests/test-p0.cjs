/* LUMEN — les promesses du jalon A.
 *
 * Chaque test de ce fichier protège une promesse que le jeu FAIT au joueur :
 * une carte qui dit vrai, une créature apaisée qui reste apaisée, une porte qui
 * se souvient d'avoir été ouverte, une nuit qui ne déteint pas sur la campagne,
 * une sauvegarde qui ne se détruit pas elle-même.
 *
 * Tous ont d'abord été écrits en ÉCHEC contre le code d'avant le jalon A ; ce
 * fichier est donc la preuve du défaut autant que du correctif. Aucun ne force
 * un état interne pour se faire plaisir : quand il faut poser Lumen quelque part
 * pour observer une règle, c'est dit dans le nom du test.
 *
 * Exécution : node tests/test-p0.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const FILES = ['rng.js', 'save.js', 'resonance.js', 'modules.js', 'expedition.js', 'upgrades.js', 'levels.js', 'engine.js'];
const sources = FILES.map(file => fs.readFileSync(path.join(root, 'js', file), 'utf8'));
const DT = 1 / 120;

const checks = [];
let failed = 0;

function test(name, run) {
  try { run(); checks.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { failed++; checks.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n      ' + error.message); }
}

/* ── Un monde de test ──────────────────────────────────────────────────────
 * Le même moteur que le jeu, sans dessin ni son. Le stockage est un Map que
 * l'on peut préremplir, corrompre, ou faire échouer à volonté. */
function environment(options = {}) {
  const storage = options.storage || new Map();
  let seed = 0x12ab34cd;
  const seededMath = Object.create(Math);
  seededMath.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
  const window = {
    innerWidth: 1280, innerHeight: 720,
    addEventListener() {},
    LumenRenderer: class { resize() {} draw() {} },
    LumenAudio: class {
      constructor() { this.sounds = []; }
      setMuted() {} setTheme() {} setDanger() {} setBossPhase() {}
      unlock() {} resume() {} pause() {}
      sfx(name) { this.sounds.push(name); }
    }
  };
  const document = { hidden: false, addEventListener() {}, body: { classList: { contains: () => true } } };
  const localStorage = {
    getItem(key) { if (options.rejectRead) throw new Error('Storage denied'); return storage.get(key) ?? null; },
    setItem(key, value) { if (options.rejectWrite) throw new Error('Storage denied'); storage.set(key, value); }
  };
  const context = vm.createContext({ window, document, localStorage, Math: seededMath, requestAnimationFrame() {}, console });
  for (const source of sources) vm.runInContext(source, context);
  const game = new window.LumenGame({});
  // Ce que l'interface aurait écouté si elle avait été là.
  const toasts = [];
  game.on('toast', message => toasts.push(message));
  return { game, window, storage, toasts };
}

function tick(game, seconds) {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) { game.update(DT); game.input.clearFrame(); }
}
function place(game, x, surface = 600) {
  game.input.reset();
  Object.assign(game.player, { x, y: surface - 46, vx: 0, vy: 0, grounded: true, coyote: .12,
    jumpBuffer: 0, airJumps: 0, dead: false, invuln: 0, standingPlatform: null, dashTime: 0, actionCooldown: 0 });
  game.mode = 'playing';
}
/** Un plateau nu : un sol, rien d'autre. Ce qu'on y ajoute est donc le sujet. */
function bareStage(game) {
  game.enemies = []; game.hazards = []; game.collectibles = []; game.checkpoints = [];
  game.secrets = []; game.characters = []; game.boss = null; game.wakeables = []; game.waves = [];
  game.exit = { x: 30000, y: 0, w: 10, h: 10, open: false };
  game.platforms = [{ x: 0, y: 600, w: 6000, h: 300, type: 'ground', active: true,
    baseX: 0, baseY: 600, phase: 0, dx: 0, dy: 0, crumbleTimer: 0, reformTimer: 0 }];
}
/** Une créature endormie, exactement telle que `applyLevel` la fabrique. */
function addSleeper(game, x, { timer = .9 } = {}) {
  const sleeper = { type: 'sleeper', x, y: 600 - 36, w: 44, h: 36, minX: x - 80, maxX: x + 100,
    vx: 0, vy: 0, hp: 1, alive: true, state: 'sleep', chargeProgress: 0, scatterTime: 0,
    calmTime: 0, phase: 0, timer, facing: -1, spawnX: x, spawnY: 600 - 36 };
  game.enemies.push(sleeper);
  return sleeper;
}

/* ══════════════════════════════════════════════════════════════════════════
 * A. Les branches doivent changer réellement la salle
 * ═════════════════════════════════════════════════════════════════════════*/

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7 + 3);

/** La signature de gameplay d'une salle : ce qui change le jeu, rien d'autre. */
function roomSignature(room) {
  const l = room.level;
  return JSON.stringify([room.kind, room.modules, l.width,
    l.platforms.map(p => [p.x, p.y, p.w, p.h, p.type]),
    l.enemies.map(e => [e.type, e.x, e.y]),
    l.wakeables.map(w => [w.type, w.x, w.y, w.span || 0]),
    l.hazards.map(h => [h.x, h.y, h.w])]);
}

test('Deux alternatives proposées produisent deux salles réellement différentes', () => {
  const { window } = environment();
  const E = window.LumenExpedition;
  let compared = 0, identical = [];
  for (const seed of SEEDS) {
    const base = E.plan(seed);
    for (const room of base.rooms) {
      if (room.branches.length < 2) continue;
      const [a, b] = room.branches;
      const choicesA = []; choicesA[room.index] = a;
      const choicesB = []; choicesB[room.index] = b;
      const roomA = E.plan(seed, { choices: choicesA }).rooms[room.index];
      const roomB = E.plan(seed, { choices: choicesB }).rooms[room.index];
      compared++;
      if (roomSignature(roomA) === roomSignature(roomB)) {
        identical.push(`graine ${seed}, salle ${room.index} : « ${a} » et « ${b} » donnent la même salle`);
      }
    }
  }
  assert.ok(compared > 100, 'corpus trop maigre : ' + compared + ' comparaisons');
  assert.deepEqual(identical.slice(0, 5), [],
    identical.length + ' choix sur ' + compared + ' ne changent rien :\n      ' + identical.slice(0, 5).join('\n      '));
});

test('La nature annoncée sur la carte est la nature réellement jouée', () => {
  const { window } = environment();
  const E = window.LumenExpedition;
  const lies = [];
  for (const seed of SEEDS) {
    for (const room of E.plan(seed).rooms) {
      if (room.fellBack) continue; // le repli s'annonce comme tel, il est testé à part
      if (room.chosen !== room.kind) lies.push(`graine ${seed}, salle ${room.index} : annoncé « ${room.chosen} », joué « ${room.kind} »`);
    }
  }
  assert.deepEqual(lies.slice(0, 5), [], lies.length + ' salles mentent sur leur nature :\n      ' + lies.slice(0, 5).join('\n      '));
});

test('Une alternative proposée est toujours réalisable : la carte ne propose pas l’impossible', () => {
  const { window } = environment();
  const E = window.LumenExpedition;
  const impossible = [];
  for (const seed of SEEDS) {
    const base = E.plan(seed);
    for (const room of base.rooms) {
      if (room.branches.length < 2) continue;
      for (const branch of room.branches) {
        const choices = []; choices[room.index] = branch;
        const got = E.plan(seed, { choices }).rooms[room.index];
        if (got.kind !== branch || got.fellBack) {
          impossible.push(`graine ${seed}, salle ${room.index} : « ${branch} » proposé, « ${got.kind} »${got.fellBack ? ' (repli)' : ''} obtenu`);
        }
      }
    }
  }
  assert.deepEqual(impossible.slice(0, 5), [],
    impossible.length + ' alternatives proposées sont irréalisables :\n      ' + impossible.slice(0, 5).join('\n      '));
});

test('L’intention de rythme reste une contrainte distincte du type choisi', () => {
  const { window } = environment();
  const E = window.LumenExpedition, M = window.LumenModules;
  const strays = [];
  for (const seed of SEEDS) {
    const base = E.plan(seed);
    for (const room of base.rooms) {
      const allowed = E.KINDS_FOR[room.intent];
      for (const id of room.modules) {
        const module = M.byId[id];
        if (module.fallback) continue;
        if (!allowed.includes(module.kind)) {
          strays.push(`graine ${seed}, salle ${room.index} (${room.intent}) contient « ${id} » de nature « ${module.kind} »`);
        }
      }
      // Et en choisissant explicitement chaque branche.
      for (const branch of room.branches) {
        const choices = []; choices[room.index] = branch;
        const got = E.plan(seed, { choices }).rooms[room.index];
        for (const id of got.modules) {
          const module = M.byId[id];
          if (module.fallback) continue;
          if (!allowed.includes(module.kind)) {
            strays.push(`graine ${seed}, salle ${room.index} (${room.intent}) + « ${branch} » : « ${id} » (${module.kind})`);
          }
        }
      }
    }
  }
  assert.deepEqual(strays.slice(0, 5), [],
    strays.length + ' modules échappent à leur intention de rythme :\n      ' + strays.slice(0, 5).join('\n      '));
});

test('Un choix ne modifie jamais une salle déjà traversée', () => {
  const { window } = environment();
  const E = window.LumenExpedition;
  for (const seed of SEEDS.slice(0, 40)) {
    const base = E.plan(seed);
    for (const room of base.rooms) {
      if (room.branches.length < 2) continue;
      const other = room.branches.find(b => b !== room.chosen);
      if (!other) continue;
      const choices = []; choices[room.index] = other;
      const changed = E.plan(seed, { choices });
      for (let i = 0; i < room.index; i++) {
        assert.equal(roomSignature(changed.rooms[i]), roomSignature(base.rooms[i]),
          `graine ${seed} : choisir « ${other} » en salle ${room.index} a modifié la salle ${i}, déjà traversée`);
      }
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════════
 * B. Le dormeur apaisé doit rester fiable
 * ═════════════════════════════════════════════════════════════════════════*/

test('Un dormeur apaisé le reste huit secondes, quel que soit son minuteur interne', () => {
  // Le minuteur d'ennemi est partagé par toutes les créatures et devient négatif
  // au bout d'une seconde de jeu. Il ne doit rien avoir à dire sur l'apaisement.
  for (const timer of [.9, 0, -5, -120]) {
    const { game } = environment();
    game.loadLevel(0); bareStage(game);
    const sleeper = addSleeper(game, 700, { timer });
    place(game, 560);
    game.emitResonance(game.player.x + 16, game.player.y + 23, 260, 'player');
    tick(game, .4);
    assert.equal(sleeper.state, 'calm', `minuteur ${timer} : l’onde n’a pas apaisé la créature`);
    tick(game, 4);
    assert.equal(sleeper.state, 'calm',
      `minuteur ${timer} : apaisement interrompu après 4,4 s (calmTime=${sleeper.calmTime.toFixed(2)})`);
    assert.ok(sleeper.calmTime > 3, `minuteur ${timer} : calmTime tombé à ${sleeper.calmTime.toFixed(2)}`);
  }
});

test('Une nouvelle onde prolonge l’apaisement au lieu de le redémarrer à zéro', () => {
  const { game } = environment();
  game.loadLevel(0); bareStage(game);
  const sleeper = addSleeper(game, 700, { timer: -3 });
  place(game, 560);
  game.emitResonance(game.player.x + 16, game.player.y + 23, 260, 'player');
  tick(game, 3);
  const before = sleeper.calmTime;
  assert.ok(before > 0 && before < 6, 'état de départ inattendu : ' + before);
  game.emitResonance(game.player.x + 16, game.player.y + 23, 260, 'player');
  tick(game, .2);
  assert.ok(sleeper.calmTime > before, `l’onde n’a pas prolongé : ${before.toFixed(2)} → ${sleeper.calmTime.toFixed(2)}`);
});

test('Un dormeur apaisé ne charge pas et ne blesse pas, même collé à Lumen', () => {
  const { game } = environment();
  game.loadLevel(0); bareStage(game);
  const sleeper = addSleeper(game, 700, { timer: -3 });
  place(game, 660); // à portée de charge : c'est précisément le cas dangereux
  game.emitResonance(game.player.x + 16, game.player.y + 23, 260, 'player');
  const hp = game.player.hp;
  tick(game, 5);
  assert.equal(sleeper.state, 'calm', 'la proximité a réveillé la créature apaisée');
  assert.equal(sleeper.chargeProgress, 0, 'la créature apaisée accumule de la charge');
  assert.equal(game.player.hp, hp, 'la créature apaisée a blessé Lumen');
});

test('Un dormeur apaisé porte Lumen : on peut se tenir sur son dos', () => {
  const { game } = environment();
  game.loadLevel(0); bareStage(game);
  const sleeper = addSleeper(game, 700, { timer: -3 });
  place(game, 560);
  game.emitResonance(game.player.x + 16, game.player.y + 23, 260, 'player');
  tick(game, .4);
  assert.equal(sleeper.state, 'calm');
  // Posé juste au-dessus de son dos, en chute : la seule chose qui peut le
  // retenir est la créature elle-même — le sol est 36 px plus bas.
  Object.assign(game.player, { x: sleeper.x + 4, y: sleeper.y - 46 - 6, vx: 0, vy: 40,
    grounded: false, previousBottom: sleeper.y - 6 });
  tick(game, 2);
  assert.ok(game.player.grounded, 'Lumen traverse le dos de la créature apaisée');
  assert.ok(Math.abs((game.player.y + game.player.h) - sleeper.y) < 3,
    `Lumen n’est pas posé sur son dos (y=${Math.round(game.player.y + game.player.h)}, dos=${sleeper.y})`);
});

test('La fin de l’apaisement est annoncée, puis rendue sans attaque instantanée', () => {
  const { game } = environment();
  game.loadLevel(0); bareStage(game);
  const sleeper = addSleeper(game, 700, { timer: -3 });
  place(game, 660);
  game.emitResonance(game.player.x + 16, game.player.y + 23, 260, 'player');
  tick(game, .3);
  assert.ok(!sleeper.rousing, 'la créature s’annonce comme sur le point de se lever dès la première seconde');
  tick(game, 7);
  assert.equal(sleeper.state, 'calm', 'état inattendu à 7,3 s');
  assert.ok(sleeper.rousing, 'aucun signe avant-coureur avant la fin de l’apaisement');
  tick(game, 1.2);
  assert.equal(sleeper.state, 'sleep', 'la créature ne revient pas au sommeil : ' + sleeper.state);
  assert.equal(sleeper.chargeProgress, 0, 'la créature reprend sa charge là où elle l’avait laissée');
});

test('Un retour au checkpoint remet le dormeur dans un état cohérent', () => {
  const { game } = environment();
  game.loadLevel(0); bareStage(game);
  const sleeper = addSleeper(game, 700, { timer: -3 });
  place(game, 560);
  game.emitResonance(game.player.x + 16, game.player.y + 23, 260, 'player');
  tick(game, 1);
  assert.equal(sleeper.state, 'calm');
  game.die(); tick(game, 1.4);
  assert.equal(sleeper.state, 'sleep');
  assert.equal(sleeper.calmTime, 0);
  assert.equal(sleeper.rousing || false, false);
});

/* ══════════════════════════════════════════════════════════════════════════
 * C. Restaurer le monde depuis la sauvegarde
 * ═════════════════════════════════════════════════════════════════════════*/

function hubIndex(window) { return window.LUMEN_LEVELS.findIndex(level => level.hub); }

/** Termine la quête de la coupole en JOUANT : Lumen grimpe et appelle. Aucun
 *  état n'est forcé — seules les positions de départ sont posées, ce qui est
 *  dit dans le nom du test qui s'en sert. */
function completeDomeQuest(game, window) {
  const index = hubIndex(window);
  game.loadLevel(index);
  const quest = game.level.quest;
  for (const id of quest.needs) {
    const chime = game.wakeables.find(w => w.id === id);
    assert.ok(chime, 'carillon introuvable : ' + id);
    // Posé sur la corniche sous le carillon, Lumen appelle.
    place(game, chime.x - 16, chime.y + 40);
    game.usePower();
    tick(game, .8);
  }
  tick(game, .2);
  return quest;
}

test('Une quête terminée rouvre la porte au simple retour dans le lieu', () => {
  const { game, window } = environment();
  const quest = completeDomeQuest(game, window);
  assert.equal(game.store.questState(quest.id), 'done', 'la quête ne s’est pas terminée en jouant');
  assert.equal(game.exit.open, true, 'la porte ne s’ouvre pas à la fin de la quête');
  // On repart, puis on revient.
  game.loadLevel(0);
  game.loadLevel(hubIndex(window));
  tick(game, .5);
  assert.equal(game.exit.open, true, 'la porte est refermée au retour dans l’observatoire');
  assert.equal(game.wokenOnce.size, 0, 'le test triche : les carillons sont comptés comme déjà réveillés');
});

test('Une quête terminée survit à un rechargement complet de la page', () => {
  const storage = new Map();
  const first = environment({ storage });
  const quest = completeDomeQuest(first.game, first.window);
  assert.equal(first.game.store.questState(quest.id), 'done');

  // Nouvelle page, même disque.
  const second = environment({ storage });
  second.game.loadLevel(hubIndex(second.window));
  tick(second.game, .5);
  assert.equal(second.game.store.questState(quest.id), 'done', 'la quête n’a pas été relue');
  assert.equal(second.game.exit.open, true, 'la porte est refermée après rechargement');
  assert.ok(second.game.store.hasTransformation(quest.transformation), 'le décor transformé n’a pas été relu');
});

test('Les dialogues suivent l’état relu de la quête, pas un compteur de session', () => {
  const storage = new Map();
  const first = environment({ storage });
  completeDomeQuest(first.game, first.window);
  const second = environment({ storage });
  second.game.loadLevel(hubIndex(second.window));
  const vesper = second.game.characters.find(c => c.id === 'vesper');
  const lines = second.game.linesFor(vesper);
  assert.deepEqual([...lines], [...vesper.lines.done], 'Vesper répète son introduction après le rechargement');
});

test('Une seule règle décide de l’accès aux Rêves : le menu ne la contourne pas', () => {
  const storage = new Map();
  const before = environment({ storage });
  assert.equal(typeof before.game.canEnterDreams, 'function', 'aucune règle d’accès nommée n’existe');
  assert.equal(before.game.canEnterDreams().allowed, false,
    'les Rêves sont accessibles alors que la porte de l’observatoire est verrouillée');
  completeDomeQuest(before.game, before.window);
  assert.equal(before.game.canEnterDreams().allowed, true, 'la quête faite, la règle refuse toujours');

  const after = environment({ storage });
  assert.equal(after.game.canEnterDreams().allowed, true, 'la règle ne relit pas la sauvegarde');
});

/* ══════════════════════════════════════════════════════════════════════════
 * D. Isoler campagne, hub et expédition
 * ═════════════════════════════════════════════════════════════════════════*/

/** Ouvre tout, pour que les transitions soient testables sans rejouer la campagne. */
function openEverything(game, window) {
  for (const level of window.LUMEN_LEVELS) game.store.unlock(level.key);
  game.progress.hub.quests['premier-souffle'] = 'done';
  game.progress.hub.transformations.push('coupole-allumee');
  game.saveProgress();
}

test('La session de jeu est un état nommé, pas une déduction sur this.run', () => {
  const { game, window } = environment();
  openEverything(game, window);
  assert.equal(game.session, 'home');
  game.start(0);
  assert.equal(game.session, 'campaign');
  game.start(hubIndex(window));
  assert.equal(game.session, 'hub');
  game.startExpedition(42);
  assert.equal(game.session, 'expedition');
  game.showHome();
  assert.equal(game.session, 'home');
  assert.equal(game.run, null, 'une nuit reste ouverte après un retour à l’accueil');
});

test('Terminer un chapitre après une nuit n’appelle jamais completeRoom()', () => {
  const { game, window } = environment();
  openEverything(game, window);
  game.startExpedition(42);
  let routeShown = false;
  game.on('route', () => { routeShown = true; });
  // Le joueur quitte la nuit par le menu et reprend la campagne.
  game.showHome();
  game.start(0);
  assert.equal(game.session, 'campaign');
  game.exit.open = true;
  place(game, game.exit.x + 10, game.exit.y + game.exit.h);
  Object.assign(game.player, { x: game.exit.x + 10, y: game.exit.y + 20 });
  tick(game, .1);
  assert.equal(routeShown, false, 'un chapitre de campagne a ouvert l’écran de route d’une expédition');
  assert.ok(['complete', 'ending'].includes(game.mode), 'le chapitre ne s’est pas conclu : ' + game.mode);
});

test('Mourir dans un chapitre ne met pas fin à une nuit', () => {
  const { game, window } = environment();
  openEverything(game, window);
  game.startExpedition(42);
  game.showHome();
  game.start(0);
  let ended = false;
  game.on('expedition-end', () => { ended = true; });
  game.lives = 1;
  place(game, 300);
  game.die(); tick(game, 1.4);
  assert.equal(ended, false, 'la mort en campagne a conclu une expédition');
  assert.equal(game.mode, 'gameover');
});

test('Un réessai après une nuit perdue ne tente pas de charger le chapitre −1', () => {
  const { game, window } = environment();
  openEverything(game, window);
  game.startExpedition(42);
  game.lives = 1;
  place(game, 300);
  game.die(); tick(game, 1.4);
  assert.equal(game.mode, 'gameover', 'la nuit ne s’est pas terminée : ' + game.mode);
  assert.equal(game.run, null);
  let askedFor = null;
  const realStart = game.start.bind(game);
  game.start = (index, options) => { askedFor = index; return realStart(index, options); };
  game.retry();
  assert.notEqual(askedFor, -1, 'le réessai a demandé le chargement du chapitre −1');
  assert.notEqual(game.mode, 'gameover', 'le réessai n’a rien fait : le joueur est bloqué');
  assert.ok(game.session === 'expedition' || game.session === 'campaign',
    'le réessai laisse le jeu dans un état indéfini : ' + game.session);
});

test('Une nuit perdue se recommence avec la même graine, ou avec une autre', () => {
  const { game, window } = environment();
  openEverything(game, window);
  const run = game.startExpedition('verger-pollen-quartz-11');
  const seed = run.seed;
  game.lives = 1; place(game, 300); game.die(); tick(game, 1.4);
  const again = game.retryExpedition();
  assert.ok(again, 'impossible de recommencer la nuit perdue');
  assert.equal(again.seed, seed, 'la reprise a changé de graine');
  assert.equal(again.roomIndex, 0, 'la reprise ne repart pas du début');
  game.lives = 1; place(game, 300); game.die(); tick(game, 1.4);
  const fresh = game.startExpedition(undefined);
  assert.notEqual(fresh.seed, seed, 'une nouvelle nuit a repris la graine précédente');
});

test('Reprendre une nuit sauvegardée ne compte pas une nouvelle tentative', () => {
  const { game, window } = environment();
  openEverything(game, window);
  game.startExpedition(42);
  // On avance jusqu'au refuge, qui est le point d'enregistrement.
  while (game.run && game.run.plan.rooms[game.run.roomIndex].kind !== 'refuge') {
    game.completeRoom();
    if (game.mode === 'route') game.chooseRoute(game.run.plan.rooms[game.run.roomIndex + 1].branches[0], null);
  }
  assert.ok(game.progress.expedition, 'le refuge n’a rien enregistré');
  const runsBefore = game.progress.expeditions.runs;
  game.showHome();
  const resumed = game.resumeExpedition();
  assert.ok(resumed, 'la nuit sauvegardée n’a pas pu être reprise');
  assert.equal(game.progress.expeditions.runs, runsBefore,
    `reprendre a compté une tentative de plus (${runsBefore} → ${game.progress.expeditions.runs})`);
});

test('Quitter une nuit pour la campagne n’y laisse aucun souvenir de rêve', () => {
  const { game, window } = environment();
  openEverything(game, window);
  game.startExpedition(42);
  game.run.upgrades = ['corolle', 'souffle'];
  assert.equal(game.hasUpgrade('corolle'), true);
  game.showHome();
  game.start(0);
  assert.equal(game.hasUpgrade('corolle'), false, 'un souvenir de rêve agit encore dans la campagne');
  assert.equal(game.hasUpgrade('souffle'), false);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E. Sauvegarde défensive
 * ═════════════════════════════════════════════════════════════════════════*/

const KEY = 'lumen.gardens.v3';
const BACKUP = 'lumen.gardens.v3.backup';

test('Une donnée corrompue n’écrase pas la copie de secours valide', () => {
  const storage = new Map();
  const good = JSON.stringify({ schema: 3, unlocked: ['prairies-aurore', 'cathedrale-racines'], chapters: {} });
  storage.set(BACKUP, good);
  storage.set(KEY, '{ ceci n’est pas du JSON');
  const { game, toasts } = environment({ storage });
  assert.deepEqual([...game.progress.unlocked], ['prairies-aurore', 'cathedrale-racines'], 'la copie de secours n’a pas été lue');
  game.flushNotices();
  assert.ok(toasts.some(t => /secours/i.test(t)), 'la récupération n’a pas été signalée au joueur');
  // Le premier enregistrement qui suit ne doit pas remplacer le filet par la ruine.
  game.saveProgress();
  assert.notEqual(storage.get(BACKUP), '{ ceci n’est pas du JSON',
    'la donnée corrompue a remplacé la copie de secours valide');
  assert.ok(JSON.parse(storage.get(BACKUP)), 'la copie de secours n’est plus lisible');
});

test('Un profil écrit par une version future n’est pas réinterprété ni écrasé', () => {
  const storage = new Map();
  const future = JSON.stringify({ schema: 99, unlocked: ['prairies-aurore'], quelqueChoseDeNouveau: true });
  storage.set(KEY, future);
  const { game, toasts } = environment({ storage });
  game.flushNotices();
  assert.equal(game.store.futureSchema, true, 'un schéma 99 a été lu comme un schéma 3');
  game.saveProgress();
  assert.equal(storage.get(KEY), future, 'le profil d’une version future a été écrasé');
  assert.ok(toasts.some(t => /version/i.test(t)), 'le joueur n’a pas été averti');
});

test('Un indice de salle hors du plan ne conclut pas une nuit toute seule', () => {
  const storage = new Map();
  const profile = {
    schema: 3, unlocked: ['prairies-aurore'], chapters: {},
    hub: { quests: { 'premier-souffle': 'done' }, transformations: ['coupole-allumee'] },
    expedition: { seed: 42, generationVersion: 1, roomIndex: 4242, route: [], hp: 3, lives: 3, upgrades: [], claimed: [] },
    expeditions: { runs: 1, completed: 0, bestRooms: 0 }
  };
  storage.set(KEY, JSON.stringify(profile));
  const { game } = environment({ storage });
  assert.ok(game.progress.expedition.roomIndex < 5,
    'un indice de salle de 4242 a traversé la validation : ' + game.progress.expedition.roomIndex);
  const completedBefore = game.progress.expeditions.completed;
  game.resumeExpedition();
  assert.equal(game.progress.expeditions.completed, completedBefore,
    'une sauvegarde corrompue a offert une expédition terminée');
});

test('Le nombre d’emplacements de souvenirs est respecté après chargement', () => {
  const storage = new Map();
  storage.set(KEY, JSON.stringify({
    schema: 3, unlocked: ['prairies-aurore'], chapters: {},
    hub: { quests: { 'premier-souffle': 'done' }, transformations: ['coupole-allumee'] },
    expedition: { seed: 42, generationVersion: 1, roomIndex: 0, route: [], hp: 3, lives: 3,
      upgrades: ['corolle', 'souffle', 'sillage', 'alize', 'inconnu-1', 'inconnu-2'], claimed: [] }
  }));
  const { game, window } = environment({ storage });
  const slots = window.LumenUpgrades.SLOTS;
  assert.ok(game.progress.expedition.upgrades.length <= slots,
    `${game.progress.expedition.upgrades.length} souvenirs relus pour ${slots} emplacements`);
  assert.ok(game.progress.expedition.upgrades.every(id => !!window.LumenUpgrades.byId[id]),
    'un identifiant de souvenir inconnu a traversé la validation : ' + game.progress.expedition.upgrades.join(', '));
});

test('Une récompense déjà encaissée ne l’est pas deux fois après une reprise', () => {
  const { game, window } = environment();
  openEverything(game, window);
  game.startExpedition(42);
  game.completeRoom();
  const next = game.run.plan.rooms[game.run.roomIndex + 1];
  game.chooseRoute(next.branches[0], 'corolle');
  assert.deepEqual([...game.run.upgrades], ['corolle']);
  const token = [...game.run.claimed][0];
  // Le joueur revient en arrière (une reprise depuis le refuge rejoue la route) :
  // le même jeton ne doit pas payer une seconde fois.
  game.run.roomIndex -= 1;
  game.chooseRoute(next.branches[0], 'corolle');
  assert.deepEqual([...game.run.upgrades], ['corolle'], 'le souvenir a été encaissé deux fois');
  assert.equal(game.run.claimed.size, 1, 'jetons : ' + [...game.run.claimed].join(', ') + ' (attendu : ' + token + ')');
});

test('Un stockage refusé est signalé une fois l’interface prête, pas avant', () => {
  const { game, toasts } = environment({ rejectWrite: true });
  assert.deepEqual(toasts, [], 'un message a été émis avant que l’interface puisse l’entendre');
  game.saveProgress();
  game.flushNotices();
  assert.ok(toasts.some(t => /indisponible/i.test(t)),
    'un stockage refusé n’a jamais été signalé au joueur : ' + JSON.stringify(toasts));
});

/* ── Rapport ──────────────────────────────────────────────────────────────*/
fs.writeFileSync(path.join(root, 'tests', 'p0-test-results.json'),
  JSON.stringify({ ranAt: new Date().toISOString(), total: checks.length, failed, checks }, null, 2));
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' promesses du jalon A vérifiées.');
process.exit(failed ? 1 : 0);
