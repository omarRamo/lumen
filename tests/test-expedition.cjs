/* Invariants des Rêves nomades.
 * Depuis le dossier LUMEN : node tests/test-expedition.cjs
 *
 * Ce fichier ne vérifie pas « le générateur ne plante pas ». Il vérifie les
 * promesses que le générateur fait au joueur, une par une, et sur un corpus
 * assez large pour que l'absence d'échec veuille dire quelque chose.
 *
 * Il ne prétend PAS garantir toutes les graines de l'univers : il contrôle
 * mille graines consécutives et conserve en régression celles qui ont un jour
 * échoué (voir SEEDS_DE_REGRESSION plus bas).
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const SOURCES = ['rng.js', 'save.js', 'resonance.js', 'modules.js', 'expedition.js', 'upgrades.js', 'levels.js', 'song.js', 'journey.js', 'engine.js'];
const DT = 1 / 120;
const CORPUS = 1000;
/** Les graines qui ont un jour produit une salle fautive. Elles restent ici
 *  pour toujours : c'est le seul moyen qu'un défaut corrigé ne revienne pas. */
const SEEDS_DE_REGRESSION = [16, 30, 32, 39, 45, 77, 85, 90, 0xdeadbeef, 1, 2, 3];

const checks = [];
let failed = 0;

/** Un contexte complet, avec un moteur utilisable sans DOM ni Canvas. */
function environment(storage = new Map()) {
  const window = {
    innerWidth: 1280, innerHeight: 720, addEventListener() {},
    LumenRenderer: class { resize() {} draw() {} },
    LumenAudio: class { constructor() { this.sounds = []; } setMuted() {} setTheme() {} setDanger() {} setBossPhase() {} unlock() {} resume() {} pause() {} sfx(n) { this.sounds.push(n); } }
  };
  const document = { hidden: false, addEventListener() {}, body: { classList: { contains: () => true } } };
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const context = vm.createContext({ window, document, localStorage, requestAnimationFrame() {}, console, Math });
  for (const file of SOURCES) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
  return { window, game: new window.LumenGame({}), storage };
}
const ENV = environment();
const { LumenExpedition: E, LumenModules: M, LumenRng: R, LumenUpgrades: U } = ENV.window;

function test(name, run) {
  try { run(); checks.push({ name, passed: true }); console.log('PASS  ' + name); }
  catch (error) { failed++; checks.push({ name, passed: false, error: error.message }); console.error('FAIL  ' + name + '\n      ' + error.message); }
}
/** La signature de gameplay d'un plan : tout ce qui se joue, rien de ce qui se voit. */
const gameplaySignature = plan => JSON.stringify(plan.rooms.map(room => ({
  kind: room.kind, modules: room.modules, branches: room.branches,
  platforms: room.level.platforms, enemies: room.level.enemies,
  wakeables: room.level.wakeables, hazards: room.level.hazards,
  spawn: room.level.spawn, exit: room.level.exit, width: room.level.width
})));
/** La signature d'apparence : uniquement ce qui se voit. */
const cosmeticSignature = plan => JSON.stringify(plan.rooms.map(r => [r.theme, r.level.name]));

/* ────────────────────────────────────────────────────────────────────────── */

test('Les modules sont annotés complètement : rien n’est laissé au hasard', () => {
  assert.ok(M.MODULES.length >= 8, 'Au moins huit modules écrits à la main, pas ' + M.MODULES.length);
  const kinds = new Set(M.MODULES.map(m => m.kind));
  for (const kind of ['platform', 'explore', 'puzzle', 'encounter', 'challenge', 'refuge', 'guardian']) {
    assert.ok(kinds.has(kind), 'Nature de salle manquante : ' + kind);
  }
  for (const module of M.MODULES) {
    assert.ok(typeof module.id === 'string' && module.id.length > 3, 'identifiant : ' + module.id);
    assert.ok(M.BANDS.includes(module.entry), module.id + ' : bande d’entrée hors du contrat');
    assert.ok(M.BANDS.includes(module.exit), module.id + ' : bande de sortie hors du contrat');
    assert.ok(Array.isArray(module.requires) && Array.isArray(module.provides), module.id + ' : capacités');
    assert.ok(Number.isInteger(module.cost) && module.cost >= 0 && module.cost <= 3, module.id + ' : budget');
    assert.ok(Array.isArray(module.tags) && Array.isArray(module.forbidWith), module.id + ' : étiquettes');
    assert.ok(typeof module.note === 'string' && module.note.length > 20, module.id + ' : intention non écrite');
    assert.ok(typeof module.build === 'function', module.id + ' : pas de géométrie');
  }
  assert.equal(M.MODULES.filter(m => m.fallback).length, 1, 'Il faut exactement un module de repli.');
});

test('Chaque module pose une surface sur ses deux bords, quelle que soit sa variante', () => {
  const failures = [];
  for (const module of M.MODULES) {
    for (let variant = 0; variant < 120; variant++) {
      const geometry = module.build(0, new R.Stream('variantes', variant));
      const surfaces = geometry.platforms.filter(p => ['ground', 'solid', 'spring'].includes(p.type));
      const left = surfaces.some(p => p.x <= 2 && p.x + p.w >= 40 && p.y === module.entry);
      const right = surfaces.some(p => p.x <= module.width - 40 && p.x + p.w >= module.width - 2 && p.y === module.exit);
      if (!left) failures.push(module.id + ' variante ' + variant + ' : bord gauche sans surface à ' + module.entry);
      if (!right) failures.push(module.id + ' variante ' + variant + ' : bord droit sans surface à ' + module.exit);
      // Une largeur négative ou nulle est le défaut classique d'un module
      // paramétré : il produit un raccord béant sans jamais lever d'erreur.
      for (const p of geometry.platforms) if (p.w <= 0) failures.push(module.id + ' : plateforme de largeur ' + p.w);
    }
  }
  assert.deepEqual(failures.slice(0, 8), []);
});

test(`Corpus de ${CORPUS} graines : aucune salle infranchissable, aucun raccord rompu`, () => {
  const seeds = [...Array(CORPUS).keys(), ...SEEDS_DE_REGRESSION];
  const problems = [];
  let fallbacks = 0, kindsSeen = new Set(), widest = 0;
  for (const seed of seeds) {
    const plan = E.plan(seed);
    assert.equal(plan.rooms.length, E.ROOMS_PER_RUN, 'graine ' + seed + ' : mauvais nombre de salles');
    let band = E.START_BAND;
    for (const room of plan.rooms) {
      kindsSeen.add(room.kind);
      if (room.fellBack) fallbacks++;
      if (room.problems.length) problems.push('graine ' + seed + ' salle ' + room.index + ' : ' + room.problems.join(', '));
      // Le raccord d'une salle à la suivante, et à l'intérieur de la chaîne.
      let previous = null;
      for (const id of room.modules) {
        const module = M.byId[id];
        const entryFrom = previous ? previous.exit : band;
        if (!M.joinIsValid(entryFrom, module.entry)) {
          problems.push('graine ' + seed + ' salle ' + room.index + ' : raccord ' + entryFrom + '→' + module.entry);
        }
        previous = module;
      }
      band = previous.exit;
      widest = Math.max(widest, room.level.width);
    }
    // La dernière salle est toujours le gardien, la troisième toujours un refuge.
    assert.equal(plan.rooms[plan.rooms.length - 1].kind, 'guardian', 'graine ' + seed + ' : pas de gardien');
    assert.equal(plan.rooms[2].kind, 'refuge', 'graine ' + seed + ' : pas de refuge avant la fin');
  }
  assert.deepEqual(problems.slice(0, 10), []);
  assert.equal(fallbacks, 0, fallbacks + ' salles ont dû tomber sur le repli : le catalogue est trop contraint.');
  assert.ok(kindsSeen.size >= 5, 'La variété réelle est trop faible : ' + [...kindsSeen].join(', '));
  assert.ok(widest < 6000, 'Une salle démesurée a été produite : ' + widest);
});

test('Aucun module n’exige jamais une capacité que le joueur n’a pas encore', () => {
  // Le contrôle de dépendance, autrement dit : jamais la clé derrière sa porte.
  const violations = [];
  for (let seed = 0; seed < 400; seed++) {
    const capabilities = ['resonance'];
    for (const room of E.plan(seed).rooms) {
      for (const id of room.modules) {
        const module = M.byId[id];
        for (const need of module.requires) {
          if (!capabilities.includes(need)) violations.push('graine ' + seed + ' : ' + id + ' exige ' + need);
        }
        for (const given of module.provides) if (!capabilities.includes(given)) capabilities.push(given);
      }
    }
  }
  assert.deepEqual(violations.slice(0, 5), []);
});

test('Même graine, même version, mêmes choix : exactement le même gameplay', () => {
  for (const seed of [0, 7, 4242, 0xbeef, 'verger-lune-lune-0']) {
    const a = E.plan(seed), b = E.plan(seed);
    assert.equal(gameplaySignature(a), gameplaySignature(b), 'graine ' + seed);
    assert.equal(a.code, b.code);
    assert.equal(a.version, R.GENERATION_VERSION);
  }
  // Des choix différents divergent — mais seulement à partir du point de choix.
  const droite = E.plan(99, { choices: [undefined, 'encounter'] });
  const gauche = E.plan(99, { choices: [undefined, 'platform'] });
  assert.equal(JSON.stringify(droite.rooms[0].level.platforms), JSON.stringify(gauche.rooms[0].level.platforms),
    'Un choix tardif ne doit pas récrire les salles déjà traversées.');
});

test('L’aléatoire cosmétique ne peut pas déplacer une plateforme', () => {
  // La preuve directe : on épuise le flux cosmétique avant de planifier, et la
  // disposition doit être rigoureusement identique.
  const reference = E.plan(1234);
  const set = new R.RngSet(1234);
  for (let i = 0; i < 5000; i++) set.cosmetic.next();
  const after = E.plan(1234);
  assert.equal(gameplaySignature(reference), gameplaySignature(after));
  // Et la preuve inverse : deux graines voisines changent bien l'apparence,
  // sinon le flux cosmétique ne servirait à rien.
  const themes = new Set();
  for (let seed = 0; seed < 60; seed++) for (const room of E.plan(seed).rooms) themes.add(room.theme);
  assert.ok(themes.size >= 4, 'Le flux cosmétique ne fait pas son travail : ' + [...themes].join(', '));
});

test('Une graine se dit, se retape, et retombe sur la même nuit', () => {
  for (const seed of [0, 1, 65535, 4294967295, 123456789]) {
    const code = R.encodeSeed(seed);
    assert.equal(R.decodeSeed(code), seed >>> 0, 'aller-retour de ' + code);
    assert.equal(E.plan(code).seed, seed >>> 0);
    // La saisie est tolérante : majuscules, espaces et ponctuation passent.
    assert.equal(R.decodeSeed(code.toUpperCase().replace(/-/g, ' ')), seed >>> 0);
  }
  // Une saisie libre reste acceptée plutôt que refusée.
  assert.equal(typeof R.decodeSeed('bonjour les jardins'), 'number');
  assert.equal(R.decodeSeed(''), null);
});

test('Le repli existe, il est valide, et il n’est jamais choisi sans raison', () => {
  // On étrangle volontairement le catalogue : plus aucune capacité disponible.
  // On part d'une bande d'entrée qu'aucun module ne peut raccorder : la chute
  // depuis 200 vers 600 dépasse le décrochement autorisé, donc rien ne convient.
  const composition = E.composeRoom(new R.Stream('etranglement', 5), 'tension', 'puzzle', [], [], 200);
  assert.ok(composition.fellBack, 'Sans raccord possible, la composition doit tomber sur le repli.');
  const fallbackModule = M.MODULES.find(m => m.fallback);
  assert.equal(composition.chain[0].id, fallbackModule.id);
  // Une nature absente de l'intention demandée est refusée, pas approximée.
  assert.ok(E.composeRoom(new R.Stream('hors-sujet', 5), 'repos', 'guardian', [], [], 600).fellBack,
    'Une nature étrangère à l’intention doit être refusée.');
  // Et la salle de repli est réellement jouable.
  const room = E.buildRoom(new R.Stream('repli', 5), composition.chain,
    { index: 0, kind: 'platform', theme: 'meadow', name: 'Repli', subtitle: '', goal: '' });
  assert.deepEqual([...E.inspect(room)], []);
  // Le nombre de tentatives est borné : la composition ne peut pas boucler.
  assert.ok(E.MAX_ATTEMPTS > 0 && E.MAX_ATTEMPTS < 100);
});

test('Le directeur de rythme alterne réellement, il ne tire pas au hasard', () => {
  const sequences = new Set();
  let repeatedNeighbours = 0, total = 0;
  for (let seed = 0; seed < 300; seed++) {
    const plan = E.plan(seed);
    sequences.add(plan.rooms.map(r => r.kind).join('>'));
    for (const room of plan.rooms) {
      assert.equal(room.intent, E.PACING[room.index], 'graine ' + seed + ' : rythme non respecté');
      // Chaque salle est annoncée avant d'y entrer : le joueur peut anticiper.
      assert.ok(room.omen && room.omen.hint && room.omen.hint.length > 10, 'salle sans indice');
      // Et CHAQUE branche proposée doit avoir son présage. Une branche nommée
      // par son intention de rythme plutôt que par sa nature laissait la carte
      // sans libellé : ce contrôle existe parce que c'est arrivé.
      for (const branch of room.branches) {
        assert.ok(E.OMENS[branch], 'graine ' + seed + ' : branche « ' + branch + ' » sans présage');
      }
      for (let i = 1; i < room.modules.length; i++) { total++; if (room.modules[i] === room.modules[i - 1]) repeatedNeighbours++; }
    }
  }
  assert.equal(repeatedNeighbours, 0, 'Un module ne doit jamais suivre son propre clone.');
  assert.ok(sequences.size >= 4, 'Trop peu de formes de nuit différentes : ' + sequences.size);
  assert.ok(total > 0);
});

test('Le plafond du plus grand trou correspond à la physique réelle du moteur', () => {
  // On mesure, sur le vrai moteur, le trou le plus large franchi en courant,
  // puis on vérifie que la constante du générateur reste en deçà. Si la
  // physique change un jour, ce contrôle le dira avant les joueurs.
  const { window, game } = environment();
  let widest = 0;
  for (let gap = 180; gap <= 420; gap += 10) {
    game.applyLevel({
      key: 'mesure', name: 'mesure', theme: 'meadow', width: 2000, height: 900,
      spawn: { x: 60, y: 554 }, exit: { x: 1900, y: 500, w: 70, h: 100, open: false },
      medalTargets: { gold: 1, silver: 2 },
      platforms: [{ x: 0, y: 600, w: 600, h: 300, type: 'ground' },
        { x: 600 + gap, y: 600, w: 600, h: 300, type: 'ground' }],
      enemies: [], collectibles: [], checkpoints: [], hazards: [], secrets: [], wakeables: [], hints: []
    }, -1, true);
    Object.assign(game.player, { x: 520, y: 554, vx: 490, vy: 0, grounded: true, coyote: .12 });
    game.input.virtual('right', true, 'm'); game.input.virtual('run', true, 'm'); game.input.virtual('jump', true, 'm');
    let landed = false;
    for (let i = 0; i < 200; i++) {
      game.update(DT); game.input.clearFrame();
      if (i === 30) game.input.virtual('jump', false, 'm');
      if (game.player.grounded && game.player.x > 600 + gap) { landed = true; break; }
      if (game.mode !== 'playing') break;
    }
    game.input.reset();
    if (landed) widest = gap;
  }
  assert.ok(widest >= 240, 'Mesure inattendue du saut courant : ' + widest);
  assert.ok(E.MAX_WALK_GAP <= widest,
    'Le générateur autorise des trous de ' + E.MAX_WALK_GAP + ' px alors que la physique n’en franchit que ' + widest + '.');
});

test('Des salles représentatives se traversent avec la vraie physique et de vraies entrées', () => {
  // Un pilote qui ne sait qu'avancer, sauter au bord et appeler. On lui donne
  // une salle de chaque nature, tirée de graines différentes.
  const { window, game } = environment();
  const R2 = window.LumenResonance;
  const sampled = new Map();
  for (let seed = 0; seed < 60 && sampled.size < 5; seed++) {
    for (const room of E.plan(seed).rooms) if (!sampled.has(room.kind) && room.kind !== 'guardian') sampled.set(room.kind, room);
  }
  assert.ok(sampled.size >= 4, 'Échantillon trop pauvre : ' + [...sampled.keys()].join(', '));

  const failures = [];
  for (const [kind, room] of sampled) {
    game.applyLevel(JSON.parse(JSON.stringify(room.level)), -1, true);
    game.enemies = []; // on isole la traversée du combat, comme pour les chapitres
    game.lives = 9;
    let lastCall = -10, lastJump = -10, jumpUntil = 0, reached = false;
    for (let frame = 0; frame < 120 * 90; frame++) {
      if (game.mode === 'playing') {
        const p = game.player;
        game.input.virtual('right', true, 'bot');
        const near = game.wakeables.some(w => w.state !== 'awake'
          && R2.distance(p.x + 16, p.y + 22, w.x, w.y) <= R2.BASE_REACH * .9);
        const fading = game.wakeables.some(w => w.state === 'awake' && w.remaining < 2
          && R2.distance(p.x + 16, p.y + 22, w.x, w.y) <= R2.BASE_REACH * .9);
        if (p.actionCooldown <= 0 && game.elapsed - lastCall > .2 && (near || fading)) {
          game.input.virtual('action', true, 'bot'); lastCall = game.elapsed;
        } else game.input.virtual('action', false, 'bot');
        const support = game.platforms.filter(s => s.active && s.x <= p.x + 16 && s.x + s.w >= p.x + 16 && s.y >= p.y).sort((a, b) => a.y - b.y)[0];
        const edge = support ? support.x + support.w : Infinity;
        // La surface suivante à droite. Un humain ne prend pas son élan pour
        // monter une marche : il sauterait par-dessus. Le pilote non plus.
        const ahead = game.platforms
          .filter(s => s.active && s.x > (support ? support.x : 0) && s.x < p.x + 460 && s.y < 800)
          .sort((a, b) => a.x - b.x)[0];
        const climbing = !!(support && ahead && ahead.y < support.y - 20);
        if (p.grounded && game.elapsed - lastJump > .14 && edge - p.x < (climbing ? 70 : 95)) {
          game.input.virtual('jump', true, 'bot');
          game.input.virtual('run', !climbing, 'bot');
          jumpUntil = game.elapsed + (climbing ? .3 : .46); lastJump = game.elapsed;
        } else if (game.elapsed > jumpUntil) { game.input.virtual('jump', false, 'bot'); game.input.virtual('run', false, 'bot'); }
      }
      game.update(DT); game.input.clearFrame();
      // On laisse le moteur prononcer lui-même la fin de salle : c'est son
      // test de recouvrement avec la porte qui fait foi, pas une approximation
      // du pilote sur la position.
      if (game.mode === 'complete' || game.mode === 'ending') { reached = true; break; }
      if (game.mode === 'gameover') break;
    }
    game.input.reset();
    if (!reached) failures.push(kind + ' (' + room.modules.join('+') + ') : sortie jamais atteinte, arrêté en x='
      + Math.round(game.player.x) + ' sur ' + room.level.width);
  }
  assert.deepEqual(failures, []);
});

test('Les souvenirs ont des emplacements, des plafonds et une vraie combinaison', () => {
  assert.equal(U.SLOTS, 2);
  assert.ok(U.UPGRADES.length >= 4, 'Quatre souvenirs au moins.');
  for (const upgrade of U.UPGRADES) {
    assert.ok(upgrade.caps && Object.keys(upgrade.caps).length, upgrade.id + ' : aucun plafond déclaré');
    assert.ok(upgrade.hint && upgrade.hint.length > 15, upgrade.id + ' : effet non décrit');
  }
  // Les emplacements sont respectés, et le plus ancien cède la place.
  let equipped = [];
  equipped = U.equip(equipped, 'corolle');
  equipped = U.equip(equipped, 'souffle');
  assert.deepEqual(equipped, ['corolle', 'souffle']);
  assert.equal(U.canEquip(equipped, 'alize').ok, false, 'Les deux places sont prises.');
  equipped = U.equip(equipped, 'alize');
  assert.deepEqual(equipped, ['souffle', 'alize'], 'Le plus ancien souvenir doit céder la place.');
  assert.equal(U.equip(equipped, 'alize').length, 2, 'Reprendre le même souvenir ne doit pas occuper deux places.');
  // Et la combinaison annoncée existe vraiment.
  const combo = U.comboFor(['corolle', 'souffle']);
  assert.ok(combo && combo.name && combo.effect.length > 30, 'La combinaison n’est pas décrite.');
  assert.equal(U.comboFor(['corolle']), null);
  // Un souvenir greffé sur un pouvoir jamais rencontré n'est pas proposé.
  const offered = U.offer(new R.Stream('offre', 3), [], []);
  assert.ok(offered.every(u => !u.needs), 'On propose un souvenir inutilisable : ' + offered.map(u => u.id).join(','));
});

test('[état forcé] La corolle ne peut pas se multiplier : une fleur vivante, et pas de boucle', () => {
  // État forcé assumé : on plante une nuit fictive portant la corolle dans un
  // chapitre de campagne, pour éprouver le plafond de la fleur sans avoir à
  // gagner le souvenir. C'est l'objet du test, et il est nommé comme tel.
  const { game } = environment();
  const stage = ENV.window.LUMEN_LEVELS.findIndex(l => l.key === 'verger-qui-reve');
  game.loadLevel(stage);
  game.session = 'expedition';
  game.run = { upgrades: ['corolle'], roomIndex: 0, choices: [], claimed: new Set(), lives: 3, hp: 3 };
  const before = game.wakeables.length;
  for (let i = 0; i < 40; i++) {
    game.player.actionCooldown = 0;
    game.emitResonance(400 + i * 5, 560, 180);
    for (let f = 0; f < 20; f++) { game.update(DT); game.input.clearFrame(); }
  }
  const flowers = game.wakeables.filter(w => w.id === 'corolle-vivante');
  assert.equal(flowers.length, 1, 'Il ne doit jamais rester plus d’une corolle : ' + flowers.length);
  assert.ok(game.wakeables.length <= before + 1, 'Les réveillables s’accumulent : ' + game.wakeables.length);
  assert.ok(game.platforms.filter(p => p.wakeId === 'corolle-vivante').length <= 1, 'Les tremplins s’accumulent.');
  assert.ok(game.waves.length <= 12, 'Les ondes s’accumulent : ' + game.waves.length);
});

test('Une nuit sauvegardée au refuge se reprend à l’identique, sans payer deux fois', () => {
  const storage = new Map();
  const first = environment(storage).game;
  const run = first.startExpedition(2024);
  const planBefore = gameplaySignature(run.plan);
  // On avance jusqu'au refuge, qui enregistre la nuit.
  first.chooseRoute(first.run.plan.rooms[1].branches[0], 'corolle');
  first.chooseRoute('repos');
  assert.equal(first.run.roomIndex, 2);
  assert.equal(first.run.plan.rooms[2].kind, 'refuge');
  const saved = first.progress.expedition;
  assert.ok(saved, 'Le refuge doit enregistrer la nuit.');
  assert.equal(saved.roomIndex, 2);
  assert.deepEqual([...saved.upgrades], ['corolle']);

  // Une nouvelle session reprend exactement la même nuit, au même endroit.
  const second = environment(storage).game;
  const resumed = second.resumeExpedition();
  assert.ok(resumed, 'La reprise doit aboutir.');
  assert.equal(resumed.roomIndex, 2);
  assert.equal(resumed.seed, 2024);
  assert.deepEqual([...resumed.upgrades], ['corolle']);
  assert.equal(gameplaySignature(resumed.plan), planBefore, 'La nuit reprise doit être identique.');

  // La récompense déjà encaissée ne se réclame pas une seconde fois.
  const token = [...second.run.claimed][0];
  assert.ok(token, 'Le jeton de récompense doit survivre à la reprise.');
  second.run.claimed = new Set([...second.run.claimed]);
  const sizeBefore = second.run.upgrades.length;
  second.chooseRoute('tension', 'corolle');
  assert.equal(second.run.upgrades.filter(id => id === 'corolle').length, 1);
  assert.ok(second.run.upgrades.length <= Math.max(sizeBefore, U.SLOTS));

  // Une nuit rêvée dans une version antérieure ne se reprend pas en silence.
  const stale = environment(new Map()).game;
  stale.store.saveExpedition({ seed: 5, generationVersion: 0, roomIndex: 1 });
  stale.progress.expedition.generationVersion = 0;
  assert.equal(stale.resumeExpedition(), null);
  assert.equal(stale.progress.expedition, null, 'Une nuit non reprenable doit être libérée.');
});

test('L’échec met fin à la nuit, jamais aux découvertes déjà acquises', () => {
  const { game } = environment();
  game.store.unlock('cathedrale-racines');
  game.store.addTransformation('coupole-allumee');
  game.startExpedition(77);
  game.lives = 1; game.run.lives = 1;
  let ended = null; game.on('expedition-end', detail => { ended = detail; });
  game.die();
  for (let i = 0; i < 200; i++) { game.update(DT); game.input.clearFrame(); }
  assert.ok(ended && ended.won === false, 'La nuit doit se terminer.');
  assert.equal(game.run, null);
  assert.equal(game.progress.expedition, null, 'Une nuit perdue ne se reprend pas.');
  // Mais le profil est intact.
  assert.ok(game.store.isUnlocked('cathedrale-racines'), 'Un chapitre ouvert le reste.');
  assert.ok(game.store.hasTransformation('coupole-allumee'), 'Une transformation acquise le reste.');
});

console.log('\n' + (checks.length - failed) + '/' + checks.length + ' invariants d’expédition vérifiés.');
fs.writeFileSync(path.join(__dirname, 'expedition-test-results.json'),
  JSON.stringify({ corpus: CORPUS, regressionSeeds: SEEDS_DE_REGRESSION, passed: checks.length - failed, failed, checks }, null, 2));
process.exitCode = failed ? 1 : 0;
