/* LUMEN — les modules des Rêves nomades.
 *
 * Une expédition n'est jamais dessinée par une machine : elle est ASSEMBLÉE à
 * partir de fragments écrits à la main, ici. Le générateur ne fait que choisir
 * l'ordre, et il ne peut choisir que ce que ces annotations autorisent.
 *
 * Chaque module déclare :
 *   entry / exit   la hauteur de sa surface à son bord gauche et à son droit ;
 *                  c'est ce qui rend un raccord vérifiable.
 *   requires       les capacités nécessaires pour le traverser.
 *   provides       les capacités qu'il donne au passage.
 *   cost           son budget de difficulté, de 0 (repos) à 3 (exigeant).
 *   tags           ce qu'il contient : trous, créatures, verticalité, énigme.
 *   forbidWith     ce qu'il refuse d'avoir pour voisin immédiat.
 *   build(x, rng)  sa géométrie absolue, décalée de x.
 *
 * `build` ne reçoit QUE le flux `layout`. Aucun module ne tire dans le flux
 * cosmétique : une variation d'apparence ne doit jamais déplacer une plateforme.
 */
(function (global) {
  'use strict';

  /** Les hauteurs de surface autorisées aux bords. Un raccord n'est valide que
   *  si l'écart entre deux bords voisins tient dans un saut ordinaire. */
  const BANDS = [600, 520, 460];
  const MAX_JOIN_DROP = 220;   // descendre est facile
  const MAX_JOIN_RISE = 90;    // monter doit rester dans un saut sans course

  const ground = (x, w, y = 600) => ({ x, y, w, h: 900 - y, type: 'ground' });
  const ledge = (x, y, w = 140, type = 'solid', extra = {}) => ({ x, y, w, h: 22, type, ...extra });
  const item = (type, x, y) => ({ type, x, y });
  const coins = (x, y, count = 4, step = 34) =>
    Array.from({ length: count }, (_, i) => item('coin', x + i * step, y));
  const creature = (type, x, surface, minX, maxX) => {
    const w = type === 'swarm' ? 54 : type === 'sleeper' ? 44 : 36;
    const h = type === 'swarm' || type === 'sleeper' ? 36 : 34;
    return { type, x, y: surface - h, w, h, minX, maxX };
  };
  const wake = (type, x, y, extra = {}) => ({ type, x, y, ...extra });

  /** Le squelette vide d'une géométrie de module. */
  const empty = () => ({ platforms: [], enemies: [], collectibles: [], wakeables: [], hazards: [] });

  const MODULES = [
    /* ── PLATEFORME ─────────────────────────────────────────────────────── */
    {
      id: 'corniches-douces', kind: 'platform', width: 1000,
      entry: 600, exit: 600, requires: [], provides: [], cost: 1,
      tags: ['gap'], forbidWith: [],
      note: 'Deux trous francs et une corniche facultative. Le pain quotidien. ' +
            'Les largeurs sont calculées pour que le dernier sol atteigne ' +
            'toujours le bord droit : c’est ce qui garantit le raccord suivant.',
      build(x, rng) {
        const g = empty();
        const firstGap = rng.int(120, 150), secondGap = rng.int(120, 150);
        const a = 280, b = a + firstGap, c = b + 260 + secondGap;
        g.platforms.push(ground(x, a), ground(x + b, 260), ground(x + c, 1000 - c));
        g.platforms.push(ledge(x + a + 24, 470, 130));
        g.collectibles.push(...coins(x + 60, 550, 4), ...coins(x + a + 44, 420, 3), ...coins(x + b + 60, 550, 3));
        if (rng.chance(.6)) g.enemies.push(creature('patrol', x + b + 70, 600, x + b + 20, x + b + 230));
        return g;
      }
    },
    {
      id: 'escalier-de-lune', kind: 'platform', width: 760,
      entry: 600, exit: 460, requires: [], provides: [], cost: 1,
      tags: ['vertical'], forbidWith: [],
      note: 'Monte de deux bandes par marches de 70 px, dans un saut ordinaire.',
      build(x, rng) {
        const g = empty();
        const w1 = rng.int(130, 150), w2 = rng.int(130, 150);
        g.platforms.push(ground(x, 250));
        g.platforms.push(ledge(x + 270, 530, w1));
        g.platforms.push(ledge(x + 445, 460, w2));
        g.platforms.push(ground(x + 600, 160, 460));
        g.collectibles.push(...coins(x + 70, 550, 3), ...coins(x + 290, 480, 2), ...coins(x + 465, 410, 2));
        if (rng.chance(.5)) g.enemies.push(creature('hopper', x + 130, 600, x + 40, x + 230));
        return g;
      }
    },
    {
      id: 'descente-en-vrille', kind: 'platform', width: 680,
      entry: 460, exit: 600, requires: [], provides: [], cost: 1,
      tags: ['vertical'], forbidWith: [],
      note: 'Redescend des hauteurs. Toujours franchissable en tombant.',
      build(x, rng) {
        const g = empty();
        g.platforms.push(ground(x, 230, 460));
        g.platforms.push(ledge(x + 265, 520, rng.int(140, 160)));
        g.platforms.push(ground(x + 460, 220));
        g.collectibles.push(...coins(x + 60, 410, 3), ...coins(x + 285, 470, 3), ...coins(x + 510, 550, 3));
        if (rng.chance(.45)) g.enemies.push(creature('swarm', x + 330, 420, x + 250, x + 440));
        return g;
      }
    },

    /* ── EXPLORATION ────────────────────────────────────────────────────── */
    {
      id: 'clairiere-suspendue', kind: 'explore', width: 820,
      entry: 600, exit: 600, requires: [], provides: [], cost: 0,
      tags: ['treasure'], forbidWith: ['guardian'],
      note: 'Un sol continu et une tour facultative : rien n’oblige à monter.',
      build(x, rng) {
        const g = empty();
        g.platforms.push(ground(x, 820));
        const lane = rng.int(0, 1) ? 1 : -1;
        for (let i = 0; i < 4; i++) {
          g.platforms.push(ledge(x + 180 + i * 160, 510 - i * 62, 140));
          g.collectibles.push(...coins(x + 210 + i * 160, 460 - i * 62, 2));
        }
        g.collectibles.push(item('star', x + 700, 268 + lane * 10), ...coins(x + 60, 550, 5));
        return g;
      }
    },

    /* ── ÉNIGME DE RÉSONANCE ────────────────────────────────────────────── */
    {
      id: 'pont-endormi', kind: 'puzzle', width: 700,
      entry: 600, exit: 600, requires: ['resonance'], provides: [], cost: 2,
      tags: ['gap', 'puzzle'], forbidWith: ['puzzle'],
      note: 'Un vide que seul un pont réveillé franchit. Corniche de secours dessous.',
      build(x, rng) {
        const g = empty();
        // La portée de l'onde borne la largeur : le cœur du pont doit rester
        // appelable depuis le bord gauche, sinon le module serait un cul-de-sac.
        const span = rng.int(280, 320);
        g.platforms.push(ground(x, 220), ground(x + 220 + span, 700 - 220 - span));
        // Le filet : on tombe sur une corniche, jamais dans le vide.
        g.platforms.push(ledge(x + 250, 700, 190));
        g.wakeables.push(wake('bridge', x + 220 + span / 2, 600, { span: span + 20 }));
        g.wakeables.push(wake('bloom', x + 345, 650));
        g.collectibles.push(...coins(x + 60, 550, 3), ...coins(x + 260, 540, 3));
        return g;
      }
    },
    {
      id: 'carillon-hors-portee', kind: 'puzzle', width: 900,
      entry: 600, exit: 520, requires: ['resonance'], provides: [], cost: 2,
      tags: ['puzzle', 'vertical'], forbidWith: ['puzzle'],
      note: 'Le cœur du pont est hors de portée depuis la rive ; le carillon, ' +
            'non. On ne franchit ce vide qu’en passant par le relais.',
      build(x, rng) {
        const g = empty();
        g.platforms.push(ground(x, 340));
        g.platforms.push(ground(x + 750, 150, 520));
        // Le carillon : appelable depuis la rive, avec de la marge.
        g.wakeables.push(wake('chime', x + rng.int(420, 440), 500));
        // Le pont : son cœur est à plus de 180 px de la rive, et à moins de
        // 171 px du carillon. C'est toute l'énigme, et elle est mesurable.
        g.wakeables.push(wake('bridge', x + 540, 600, { span: 420 }));
        g.collectibles.push(...coins(x + 80, 550, 4), item('star', x + 800, 430));
        return g;
      }
    },

    /* ── RENCONTRE ──────────────────────────────────────────────────────── */
    {
      id: 'ronde-des-veilleurs', kind: 'encounter', width: 700,
      entry: 600, exit: 600, requires: [], provides: [], cost: 2,
      tags: ['creature'], forbidWith: ['creature'],
      note: 'Trois créatures sur un sol plein : du combat, jamais de chute.',
      build(x, rng) {
        const g = empty();
        g.platforms.push(ground(x, 700));
        g.platforms.push(ledge(x + 280, 480, 150));
        const roster = rng.shuffle(['patrol', 'hopper', 'sleeper', 'turret', 'swarm']).slice(0, 3);
        roster.forEach((type, i) => {
          const at = x + 180 + i * 180;
          g.enemies.push(type === 'swarm'
            ? creature('swarm', at, 470, at - 90, at + 130)
            : creature(type, at, 600, at - 70, at + 140));
        });
        g.collectibles.push(...coins(x + 60, 550, 4), item('heart', x + 355, 430));
        return g;
      }
    },

    /* ── DÉFI FACULTATIF ────────────────────────────────────────────────── */
    {
      id: 'aiguilles-du-reve', kind: 'challenge', width: 740,
      entry: 600, exit: 600, requires: [], provides: [], cost: 3,
      tags: ['gap', 'hazard'], forbidWith: ['hazard'],
      note: 'Un chemin bas sûr, et au-dessus une ligne de plateformes friables.',
      build(x, rng) {
        const g = empty();
        // La route sûre existe toujours, au sol. Le défi est le chemin haut.
        g.platforms.push(ground(x, 740));
        g.hazards.push({ x: x + 300, y: 578, w: rng.int(60, 90), h: 22, type: 'spikes' });
        for (let i = 0; i < 4; i++) g.platforms.push(ledge(x + 150 + i * 150, 450 - (i % 2) * 40, 110, 'crumble'));
        g.collectibles.push(item('star', x + 640, 330), ...coins(x + 180, 390, 3), ...coins(x + 480, 390, 3));
        return g;
      }
    },

    /* ── REFUGE ─────────────────────────────────────────────────────────── */
    {
      id: 'refuge-des-lanternes', kind: 'refuge', width: 620,
      entry: 600, exit: 600, requires: [], provides: [], cost: 0,
      tags: ['rest'], forbidWith: [],
      note: 'Aucune créature, aucun trou. On y souffle, on y sauvegarde.',
      build(x) {
        const g = empty();
        g.platforms.push(ground(x, 620));
        g.platforms.push(ledge(x + 250, 470, 150));
        g.collectibles.push(item('heart', x + 325, 420), ...coins(x + 80, 550, 5));
        g.wakeables.push(wake('chime', x + 460, 520));
        return g;
      }
    },

    /* ── GARDIEN ────────────────────────────────────────────────────────── */
    {
      id: 'arene-du-gardien', kind: 'guardian', width: 1500,
      entry: 600, exit: 600, requires: [], provides: [], cost: 3,
      tags: ['guardian'], forbidWith: ['creature', 'hazard'],
      note: 'Une arène plate et dégagée, longue de 1500 px. Le combat y tient seul.',
      build(x) {
        const g = empty();
        g.platforms.push(ground(x, 1500));
        g.collectibles.push(item('heart', x + 160, 550), item('heart', x + 1280, 550));
        return g;
      }
    },

    /* ── REPLI ──────────────────────────────────────────────────────────── */
    {
      id: 'couloir-de-repli', kind: 'platform', width: 520,
      entry: 600, exit: 600, requires: [], provides: [], cost: 0,
      tags: ['rest'], forbidWith: [],
      fallback: true,
      note: 'Le module de secours : un couloir plat, toujours valide, jamais choisi ' +
            'tant qu’autre chose convient. Sa seule raison d’être est qu’une ' +
            'génération ne puisse jamais échouer à produire une salle jouable.',
      build(x) {
        const g = empty();
        g.platforms.push(ground(x, 520));
        g.collectibles.push(...coins(x + 80, 550, 5));
        return g;
      }
    }
  ];

  const byId = Object.fromEntries(MODULES.map(m => [m.id, m]));

  /** Un raccord est valide si la marche entre deux bords reste franchissable.
   *  Descendre est toujours permis ; monter doit tenir dans un saut ordinaire. */
  function joinIsValid(previousExit, nextEntry) {
    const delta = previousExit - nextEntry; // positif = on monte
    return delta <= MAX_JOIN_RISE && -delta <= MAX_JOIN_DROP;
  }

  /** Deux modules voisins peuvent-ils se suivre ? Raccord, interdits mutuels,
   *  et capacités disponibles à cet instant du parcours. */
  function canFollow(previous, next, capabilities) {
    if (previous && !joinIsValid(previous.exit, next.entry)) return false;
    if (previous) {
      for (const tag of next.forbidWith) if (previous.tags.includes(tag)) return false;
      for (const tag of previous.forbidWith) if (next.tags.includes(tag)) return false;
    }
    // Le contrôle de dépendance : jamais un module qui exige une capacité que
    // le joueur n'a pas encore. C'est ce qui interdit la clé derrière sa porte.
    return next.requires.every(capability => capabilities.includes(capability));
  }

  global.LumenModules = {
    MODULES, byId, BANDS, MAX_JOIN_RISE, MAX_JOIN_DROP,
    joinIsValid, canFollow,
    kinds: () => [...new Set(MODULES.map(m => m.kind))]
  };
})(typeof window !== 'undefined' ? window : globalThis);
