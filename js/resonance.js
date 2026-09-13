/* LUMEN — la Résonance.
 *
 * Nilo n'a pas d'arme : il a une voix. Une onde part de lui, touche ce qui dort
 * dans le jardin, et le réveille un moment. C'est le verbe central du jeu.
 *
 * Quatre choses comptent, et ce module les rend explicites plutôt que diffuses
 * dans le moteur :
 *
 *  1. Chaque élément réveillable annonce ce qu'il est AVANT d'être touché.
 *     Un bouton fermé ressemble à un bouton fermé, un pont fantôme à un pont.
 *  2. Chaque réveil a une durée perceptible, et clignote avant de s'éteindre.
 *  3. Ré-émettre sur un élément déjà réveillé PROLONGE son réveil. C'est la
 *     règle qui garantit qu'aucun joueur ne reste coincé parce qu'un effet a
 *     expiré au mauvais moment.
 *  4. Les règles vivent ici, sans DOM ni Canvas, donc elles se testent.
 *
 * Articulation avec les pouvoirs : la Résonance est le bouton action, toujours
 * disponible. Les pouvoirs ne la remplacent pas, ils la modifient — voir
 * AMPLIFIERS plus bas. Un pouvoir qui expire ne retire donc jamais le verbe.
 */
(function (global) {
  'use strict';

  /** Portée de base, en pixels du monde. Volontairement courte : la Résonance
   *  est un geste de proximité, pas une télécommande. */
  const BASE_REACH = 180;
  /** Recharge courte. Assez pour interdire le martèlement, assez brève pour
   *  qu'un enchaînement saut-onde-saut reste fluide. */
  const COOLDOWN = .75;
  /** L'onde atteint sa portée en ce temps : on voit partir le geste. */
  const EXPANSION = .3;
  /** Un élément réveillé clignote pendant ses dernières secondes. */
  const WARNING = 1.3;

  /** Ce que chaque pouvoir ajoute à l'onde. Aucun ne la remplace.
   *  `reach` est un multiplicateur, les autres champs sont des effets en plus. */
  const AMPLIFIERS = {
    echo:   { reach: 1.8, reveal: 4, label: 'Grelot d’écho · portée doublée, chemins révélés' },
    bloom:  { reach: 1,   seed: true, label: 'Fleur solaire · une graine de lumière part avec l’onde' },
    comet:  { reach: 1.15, dash: true, label: 'Cœur comète · l’onde vous propulse' },
    breeze: { reach: 1,   label: 'Plume d’azur · un second saut dans les airs' }
  };

  /** Les éléments que l'onde peut réveiller.
   *
   *  `platforms` décrit la géométrie qui apparaît quand l'élément est réveillé.
   *  Elle est toujours dérivée de la définition du niveau, jamais improvisée à
   *  l'exécution : le contrôle de franchissabilité doit pouvoir la prévoir. */
  const WAKE_TYPES = {
    /** Une fleur close qui s'ouvre en tremplin. Déplacement vertical. */
    bloom: {
      duration: 7,
      /** Le tremplin est plus étroit que la fleur : on vise le cœur. */
      platforms: w => [{ x: w.x - 44, y: w.y - 10, w: 88, h: 20, type: 'spring' }],
      sound: 'wakeBloom'
    },
    /** Un pont lunaire qui se matérialise. Déplacement horizontal. */
    bridge: {
      duration: 6,
      platforms: w => [{ x: w.x - (w.span || 190) / 2, y: w.y, w: w.span || 190, h: 18, type: 'solid' }],
      sound: 'wakeBridge'
    },
    /** Un carillon qui ne porte rien : il RELAIE l'onde depuis sa position.
     *  C'est l'élément qui transforme la Résonance en énigme plutôt qu'en clé :
     *  il permet d'atteindre ce qui est hors de portée directe. */
    chime: {
      duration: .9,
      platforms: () => [],
      relay: true,
      sound: 'wakeChime'
    }
  };

  const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /** Prépare un élément réveillable à partir de sa définition de niveau. */
  function createWakeable(definition, index) {
    const type = WAKE_TYPES[definition.type] ? definition.type : 'bloom';
    return {
      ...definition,
      type,
      id: definition.id || (type + '-' + index),
      state: 'asleep',
      remaining: 0,
      pulse: index * .37,
      relayed: false
    };
  }

  /** La géométrie qu'un élément fait apparaître, réveillé. */
  function platformsFor(wakeable) {
    return (WAKE_TYPES[wakeable.type].platforms(wakeable) || []).map((platform, i) => ({
      ...platform, wakeId: wakeable.id, wakeSlot: i
    }));
  }

  /** Fait avancer l'état d'un élément. Retourne l'événement franchi, s'il y en a. */
  function advance(wakeable, dt) {
    if (wakeable.state !== 'awake') return null;
    wakeable.remaining -= dt;
    if (wakeable.remaining <= 0) {
      wakeable.state = 'asleep';
      wakeable.remaining = 0;
      wakeable.relayed = false;
      return 'slept';
    }
    return null;
  }

  /** Vrai pendant les dernières secondes : l'élément clignote. */
  function isFading(wakeable) {
    return wakeable.state === 'awake' && wakeable.remaining <= WARNING;
  }

  /** Réveille — ou prolonge. Le prolongement est la règle anti-blocage :
   *  un joueur sur un pont qui s'éteint peut toujours le rallumer sous ses pieds. */
  function wake(wakeable) {
    const config = WAKE_TYPES[wakeable.type];
    const extended = wakeable.state === 'awake';
    wakeable.state = 'awake';
    wakeable.remaining = config.duration;
    return extended ? 'extended' : 'woken';
  }

  /** Une onde. Elle grandit, touche une fois chacun, puis s'éteint. */
  function createWave(x, y, reach, source = 'player') {
    return {
      x, y, reach,
      radius: 0,
      life: EXPANSION + .25,
      maxLife: EXPANSION + .25,
      source,
      touched: new Set()
    };
  }

  function advanceWave(wave, dt) {
    wave.life -= dt;
    wave.radius = Math.min(wave.reach, wave.radius + (wave.reach / EXPANSION) * dt);
    return wave.life > 0;
  }

  /** Les éléments que cette onde atteint maintenant et n'a pas encore touchés. */
  function newlyReached(wave, wakeables) {
    const reached = [];
    for (const wakeable of wakeables) {
      if (wave.touched.has(wakeable.id)) continue;
      if (distance(wave.x, wave.y, wakeable.x, wakeable.y) > wave.radius) continue;
      wave.touched.add(wakeable.id);
      reached.push(wakeable);
    }
    return reached;
  }

  /** La portée effective compte tenu du pouvoir porté. */
  function reachFor(power) {
    const amplifier = AMPLIFIERS[power];
    return BASE_REACH * (amplifier ? amplifier.reach : 1);
  }

  /** Ce que la Résonance fera, décrit en une phrase, pour l'interface et l'aide. */
  function describe(power) {
    const amplifier = AMPLIFIERS[power];
    return amplifier ? amplifier.label : 'Résonance · réveillez ce qui dort autour de vous';
  }

  global.LumenResonance = {
    BASE_REACH, COOLDOWN, EXPANSION, WARNING, WAKE_TYPES, AMPLIFIERS,
    createWakeable, platformsFor, advance, isFading, wake,
    createWave, advanceWave, newlyReached, reachFor, describe, distance
  };
})(typeof window !== 'undefined' ? window : globalThis);
