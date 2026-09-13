/* LUMEN — les Rêves nomades : plan d'expédition.
 *
 * Ce module ne dessine rien et ne joue rien. Il produit un PLAN : une carte à
 * embranchements de cinq salles, chaque salle assemblée à partir de modules
 * écrits à la main, et vérifiée avant d'être rendue.
 *
 * Les garanties qu'il tient, et que les tests reprennent une à une :
 *
 *  - même graine + même version + mêmes choix ⇒ même gameplay, au pixel près ;
 *  - le flux cosmétique ne peut pas déplacer une plateforme, parce qu'il n'est
 *    jamais lu ici ;
 *  - aucun module n'exige une capacité que le joueur n'a pas encore ;
 *  - tout raccord entre deux modules est franchissable ;
 *  - le nombre de tentatives est borné, et un repli valide existe toujours ;
 *  - aucun danger mortel n'apparaît sans un sol d'où le voir venir.
 *
 * Le directeur de rythme alterne découverte, tension et repos, et regarde les
 * salles récentes plutôt que de tirer au hasard salle après salle.
 */
(function (global) {
  'use strict';

  const ROOMS_PER_RUN = 5;
  /** Tentatives maximales pour remplir une salle avant de passer au repli. */
  const MAX_ATTEMPTS = 24;
  /** Le rythme visé, salle par salle. Le directeur suit cette intention et ne
   *  choisit, dans chaque cas, que parmi des situations prévalidées. */
  const PACING = ['decouverte', 'tension', 'repos', 'tension', 'final'];
  /** Les natures de salle acceptables pour chaque intention de rythme. */
  const KINDS_FOR = {
    decouverte: ['platform', 'explore'],
    tension: ['puzzle', 'encounter', 'challenge', 'platform'],
    repos: ['refuge'],
    final: ['guardian']
  };
  /** Ce que la carte laisse deviner d'une salle avant d'y entrer. Le joueur
   *  doit pouvoir anticiper : jamais de surprise mortelle non annoncée. */
  const OMENS = {
    platform: { label: 'Un chemin', icon: '↗', hint: 'Des corniches et des trous francs.' },
    explore: { label: 'Une clairière', icon: '✧', hint: 'Calme. Quelque chose brille en hauteur.' },
    puzzle: { label: 'Un silence', icon: '◍', hint: 'Quelque chose y dort. Il faudra appeler.' },
    encounter: { label: 'Des veilleurs', icon: '✹', hint: 'Trois créatures, sur un sol plein.' },
    challenge: { label: 'Des aiguilles', icon: '✦', hint: 'Un trésor en hauteur, une route sûre en bas.' },
    refuge: { label: 'Un refuge', icon: '☾', hint: 'On y souffle, et la nuit s’y enregistre.' },
    guardian: { label: 'Le gardien', icon: '☀', hint: 'L’arène. Il n’y a plus qu’à.' }
  };

  /** La bande de départ de chaque expédition. */
  const START_BAND = 600;

  /* ── Assemblage d'une salle ──────────────────────────────────────────── */

  /** Le module qui DONNE son nom à la salle est le dernier de la chaîne : c'est
   *  lui que la carte annonce, lui que le joueur choisit, et lui qu'il joue en
   *  dernier — l'ordre dans lequel on se souvient d'une pièce.
   *
   *  Deux contraintes distinctes s'appliquent, et il faut les garder séparées :
   *
   *   - l'INTENTION de rythme (`intent`) borne tout ce que la salle peut
   *     contenir : une salle de tension ne peut pas se remplir de modules de
   *     découverte, quel que soit le choix du joueur ;
   *   - le TYPE choisi (`kind`) impose la nature du module final.
   *
   *  Si aucune chaîne ne satisfait les deux, la fonction le dit (`fellBack`)
   *  au lieu de livrer autre chose sous le nom demandé. C'est ce qui permet à
   *  `plan()` de ne proposer que des alternatives réalisables.
   *
   *  @param rng          un flux dédié à cette salle ; il n'est partagé avec
   *                      aucune autre, de sorte qu'un choix fait ici ne peut
   *                      pas déplacer la géométrie d'une salle voisine.
   */
  function composeRoom(rng, intent, kind, capabilities, recentIds, entryBand) {
    const M = global.LumenModules;
    const allowed = KINDS_FOR[intent] || KINDS_FOR.decouverte;
    const fallback = M.MODULES.find(m => m.fallback);
    const failure = { chain: [fallback], fellBack: true };
    if (!allowed.includes(kind)) return failure;

    const usable = M.MODULES.filter(m => !m.fallback && allowed.includes(m.kind));
    const finals = usable.filter(m => m.kind === kind);
    if (!finals.length) return failure;
    // Une salle de gardien ou de refuge tient en un seul module : elle a sa
    // propre unité et on ne la dilue pas.
    const pieces = intent === 'final' || intent === 'repos' ? 1 : 2;
    // On préfère ce qui n'a pas été vu récemment, sans jamais l'interdire :
    // une préférence molle évite les répétitions sans réduire la variété.
    const fresher = list => rng.shuffle(list).sort((a, b) =>
      (recentIds.includes(a.id) ? 1 : 0) - (recentIds.includes(b.id) ? 1 : 0));
    const edge = { exit: entryBand, tags: [], forbidWith: [] };

    if (pieces === 1) {
      for (const candidate of fresher(finals)) {
        if (M.canFollow(edge, candidate, capabilities)) return { chain: [candidate], fellBack: false };
      }
      return failure;
    }

    let attempts = 0;
    for (const opener of fresher(usable)) {
      if (++attempts > MAX_ATTEMPTS) break;
      if (!M.canFollow(edge, opener, capabilities)) continue;
      for (const closer of fresher(finals)) {
        if (++attempts > MAX_ATTEMPTS) break;
        if (closer.id === opener.id) continue;
        if (!M.canFollow(opener, closer, capabilities)) continue;
        return { chain: [opener, closer], fellBack: false };
      }
    }
    // Rien n'a convenu : le couloir de repli est toujours valide. La nuit
    // sera plus sage que prévu, mais elle restera jouable — et elle ne
    // s'annoncera pas sous un nom qu'elle ne tient pas.
    return failure;
  }

  /** Transforme une suite de modules en une définition de niveau complète.
   *  @param rng un flux de DISPOSITION propre à cette salle. */
  function buildRoom(rng, chain, meta) {
    const geometry = { platforms: [], enemies: [], collectibles: [], wakeables: [], hazards: [] };
    let x = 200; // une marge de départ, pour voir arriver la première salle
    for (const module of chain) {
      // Chaque module reçoit son propre sous-flux : ajouter un module plus loin
      // dans la chaîne ne décale donc pas ce qui a déjà été posé avant lui.
      const piece = module.build(x, rng.fork(module.id + ':' + x));
      for (const field of Object.keys(geometry)) geometry[field].push(...(piece[field] || []));
      x += module.width;
    }
    const width = x + 420;
    const lastBand = chain[chain.length - 1].exit;
    return {
      id: -1,
      key: 'reve-' + meta.index,
      name: meta.name,
      subtitle: meta.subtitle,
      theme: meta.theme,
      expedition: true,
      kind: meta.kind,
      modules: chain.map(m => m.id),
      medalTargets: { gold: 60, silver: 110 },
      width, height: 900,
      spawn: { x: 120, y: START_BAND - 46 },
      exit: { x: width - 210, y: lastBand - 100, w: 70, h: 100, open: meta.kind !== 'guardian' },
      boss: meta.kind === 'guardian',
      goal: meta.goal,
      platforms: [{ x: 0, y: START_BAND, w: 200, h: 300, type: 'ground' },
        ...geometry.platforms,
        { x, y: lastBand, w: 420, h: 900 - lastBand, type: 'ground' }],
      enemies: geometry.enemies,
      collectibles: geometry.collectibles,
      wakeables: geometry.wakeables,
      hazards: geometry.hazards,
      checkpoints: meta.kind === 'guardian' ? [{ x: 120, y: START_BAND }] : [],
      secrets: [],
      hints: meta.hints || []
    };
  }

  /* ── Vérifications ───────────────────────────────────────────────────── */

  /** Contrôles géométriques d'une salle produite. Ils sont volontairement
   *  conservateurs : ils refusent au moindre doute plutôt que de laisser
   *  passer une salle infranchissable. */
  function inspect(room) {
    const problems = [];
    const surfaces = room.platforms
      .filter(p => p.type === 'ground' || p.type === 'solid' || p.type === 'spring')
      .sort((a, b) => a.x - b.x);
    if (!surfaces.length) problems.push('aucune surface');

    // 1. Le sol de départ porte le point d'apparition.
    const spawnSupport = surfaces.some(p => p.x <= room.spawn.x && p.x + p.w >= room.spawn.x + 32 && p.y >= room.spawn.y);
    if (!spawnSupport) problems.push('apparition sans sol');

    // 2. Aucun danger ne surplombe le vide : on doit pouvoir le voir venir
    //    depuis une surface, et jamais le découvrir en tombant dessus.
    for (const hazard of room.hazards) {
      const supported = surfaces.some(p => p.x <= hazard.x && p.x + p.w >= hazard.x + hazard.w && Math.abs(p.y - (hazard.y + hazard.h)) < 4);
      if (!supported) problems.push('danger suspendu en ' + Math.round(hazard.x));
    }

    // 3. Chaque trou du sol est franchissable, ou doublé d'un pont réveillable.
    const floors = room.platforms.filter(p => p.type === 'ground').sort((a, b) => a.x - b.x);
    for (let i = 0; i < floors.length - 1; i++) {
      const gap = floors[i + 1].x - (floors[i].x + floors[i].w);
      if (gap <= 0) continue;
      const rise = floors[i].y - floors[i + 1].y;
      const bridged = room.wakeables.some(w => w.type === 'bridge'
        && w.x - (w.span || 190) / 2 <= floors[i].x + floors[i].w + 12
        && w.x + (w.span || 190) / 2 >= floors[i + 1].x - 12);
      const stepped = room.platforms.some(p => p.type !== 'ground'
        && p.x + p.w > floors[i].x + floors[i].w && p.x < floors[i + 1].x && p.y <= floors[i].y);
      if (gap > MAX_WALK_GAP && !bridged && !stepped) problems.push('trou de ' + Math.round(gap) + ' px en ' + Math.round(floors[i].x + floors[i].w));
      if (rise > 90 && !stepped && !bridged) problems.push('marche de ' + Math.round(rise) + ' px en ' + Math.round(floors[i + 1].x));
    }

    // 4. La sortie est posée sur quelque chose.
    const exitSupport = surfaces.some(p => p.x <= room.exit.x && p.x + p.w >= room.exit.x + room.exit.w && Math.abs(p.y - (room.exit.y + room.exit.h)) < 40);
    if (!exitSupport) problems.push('sortie sans sol');

    return problems;
  }
  /** Le plus large trou franchissable en courant, mesuré sur la physique réelle
   *  du moteur puis arrondi vers le bas. Voir tests/test-expedition.cjs, qui
   *  refuse de passer si cette constante s'éloigne de la mesure. */
  const MAX_WALK_GAP = 250;

  /* ── Le plan complet ─────────────────────────────────────────────────── */

  const THEMES = ['meadow', 'cavern', 'tide', 'sky', 'frost', 'secret'];
  const NAMES = ['Le rêve des herbes hautes', 'Le rêve de la pierre claire', 'Le rêve du courant',
    'Le rêve des toits de nuage', 'Le rêve du verre froid', 'Le rêve tardif'];

  /**
   * Construit le plan d'une expédition.
   * @param seed      la graine, nombre ou texte
   * @param options   { choices: [] } les embranchements déjà choisis
   */
  function plan(seed, options = {}) {
    const rng = new global.LumenRng.RngSet(seed);
    const choices = Array.isArray(options.choices) ? options.choices : [];
    const capabilities = ['resonance']; // la Résonance est acquise dès le départ
    const recent = [];
    const rooms = [];
    let band = START_BAND;
    let fellBackCount = 0;

    for (let index = 0; index < ROOMS_PER_RUN; index++) {
      const intent = PACING[index];
      // Chaque nature possible à cette étape du rythme est ESSAYÉE pour de bon,
      // dans son propre sous-flux. Ce qui ne s'assemble pas n'est pas proposé :
      // la carte ne montre jamais une porte qui n'existe pas derrière.
      const options = new Map();
      for (const candidate of KINDS_FOR[intent]) {
        const attempt = composeRoom(rng.layout.fork('salle:' + index + ':' + candidate),
          intent, candidate, capabilities, recent, band);
        if (!attempt.fellBack) options.set(candidate, attempt);
      }
      // Deux alternatives au plus, tirées d'un sous-flux qui ne dépend d'aucun
      // choix : la carte d'une graine est la même pour tout le monde.
      const offered = [...options.keys()];
      const branches = offered.length > 1
        ? rng.layout.fork('branches:' + index).shuffle(offered).slice(0, Math.min(2, offered.length))
        : offered;
      const picked = branches.includes(choices[index]) ? choices[index] : branches[0];
      const composition = picked ? options.get(picked)
        : composeRoom(rng.layout.fork('salle:' + index + ':repli'), intent, KINDS_FOR[intent][0], capabilities, recent, band);
      if (composition.fellBack) fellBackCount++;
      const chain = composition.chain;
      // La nature de la salle est celle de son module final — donc exactement
      // celle qui a été choisie, tant que le repli n'a pas eu à servir.
      const kind = chain[chain.length - 1].kind;
      // L'apparence ne vient QUE du flux cosmétique, et d'un sous-flux propre à
      // la salle : elle ne peut donc ni décaler la disposition, ni changer
      // parce qu'on a choisi autrement plus tôt.
      const look = rng.cosmetic.fork('apparence:' + index);
      const theme = THEMES[look.int(0, THEMES.length - 1)];
      const name = NAMES[look.int(0, NAMES.length - 1)];

      const room = buildRoom(rng.layout.fork('geometrie:' + index + ':' + kind), chain, {
        index, kind, theme, name,
        subtitle: OMENS[kind] ? OMENS[kind].hint : '',
        goal: kind === 'guardian' ? 'Rends sa lumière au gardien du rêve.' : 'Trouve la porte suivante.',
        hints: index === 0 ? [{ x: 120, text: 'Un rêve nomade. X appelle, comme toujours.' }] : []
      });
      const problems = inspect(room);
      rooms.push({
        index, kind, intent, theme,
        omen: OMENS[kind] || OMENS.platform,
        modules: chain.map(m => m.id),
        // Une branche est toujours nommée par la NATURE de la salle, jamais par
        // l'intention de rythme : c'est ce nom que la carte doit pouvoir annoncer.
        // Et si le repli a servi, la carte l'annonce sous SON nom à lui.
        branches: composition.fellBack ? [kind] : branches,
        chosen: composition.fellBack ? kind : picked,
        fellBack: composition.fellBack,
        problems,
        level: room
      });
      for (const module of chain) for (const capability of module.provides) {
        if (!capabilities.includes(capability)) capabilities.push(capability);
      }
      recent.push(...chain.map(m => m.id));
      while (recent.length > 4) recent.shift();
      band = chain[chain.length - 1].exit;
    }

    return {
      seed: rng.seed,
      code: global.LumenRng.encodeSeed(rng.seed),
      version: global.LumenRng.GENERATION_VERSION,
      choices,
      rooms,
      fellBackCount,
      // L'état des flux, pour reprendre une nuit exactement là où on l'a laissée.
      rng: rng.snapshot()
    };
  }

  /** L'intention de rythme dont relève une nature de salle. */
  function intentForKind(kind) {
    for (const [intent, kinds] of Object.entries(KINDS_FOR)) if (kinds.includes(kind)) return intent;
    return 'decouverte';
  }

  global.LumenExpedition = {
    ROOMS_PER_RUN, MAX_ATTEMPTS, PACING, KINDS_FOR, OMENS, MAX_WALK_GAP, START_BAND,
    plan, inspect, composeRoom, buildRoom, intentForKind
  };
})(typeof window !== 'undefined' ? window : globalThis);
