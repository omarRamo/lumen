/* LUMEN — progression, schéma versionné et migration.
 *
 * Trois règles tiennent ce module :
 *
 * 1. Rien n'est indexé par position de tableau. Un chapitre est désigné par une
 *    clé stable ; insérer un chapitre au milieu de la campagne ne déplace donc
 *    plus la progression de personne.
 * 2. Une sauvegarde ancienne n'est jamais écrasée avant d'avoir été migrée ET
 *    relue. La version précédente reste sur le disque comme filet.
 * 3. Une donnée illisible ne fait pas perdre le reste. La validation répare
 *    champ par champ et laisse le jeu démarrer, plutôt que de tout jeter.
 *
 * Le module ignore le DOM : il reçoit son stockage, ce qui le rend testable.
 */
(function (global) {
  'use strict';

  const SCHEMA = 3;
  const KEY = 'lumen.gardens.v3';
  const BACKUP_KEY = 'lumen.gardens.v3.backup';
  const LEGACY_KEYS = ['lumen.gardens.v2', 'lumen.gardens.v1'];

  /** L'ordre historique des chapitres, figé. Ces clés ne changent jamais :
   *  elles sont le contrat entre une sauvegarde de 2025 et le jeu d'aujourd'hui.
   *  v1 comptait huit chapitres et sa finale occupait l'indice 7. */
  const LEGACY_ORDER_V2 = [
    'prairies-aurore', 'cathedrale-racines', 'lagon-lucioles', 'archipels-zephyr',
    'forge-petales', 'palais-givre', 'jardin-heures-bleues', 'vergers-vent',
    'galerie-echos', 'coeur-eclipse'
  ];
  const LEGACY_ORDER_V1 = [
    'prairies-aurore', 'cathedrale-racines', 'lagon-lucioles', 'archipels-zephyr',
    'forge-petales', 'palais-givre', 'jardin-heures-bleues', 'coeur-eclipse'
  ];

  const MEDALS = ['bronze', 'silver', 'gold'];
  /** Les bornes du monde réel, lues au moment de valider — les modules qui les
   *  définissent sont chargés après celui-ci. Sans ces bornes, une sauvegarde
   *  trafiquée entrait telle quelle dans le moteur. */
  const roomCeiling = () => (global.LumenExpedition ? global.LumenExpedition.ROOMS_PER_RUN : 5) - 1;
  const upgradeSlots = () => (global.LumenUpgrades ? global.LumenUpgrades.SLOTS : 2);
  const knownUpgrade = id => !global.LumenUpgrades || !!global.LumenUpgrades.byId[id];
  const knownKind = kind => !global.LumenModules || global.LumenModules.kinds().includes(kind);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function emptyProfile() {
    return {
      schema: SCHEMA,
      unlocked: [LEGACY_ORDER_V2[0]],
      chapters: {},
      bonusUnlocked: false,
      finished: false,
      settings: { muted: false, touchScale: 1, leftHanded: false, reducedEffects: false, songStyle: 'gentle', volume: .35, language: 'auto' },
      hub: { quests: {}, transformations: [] },
      codex: { creatures: [], phenomena: [] },
      expedition: null,
      expeditions: { runs: 0, completed: 0, bestRooms: 0 }
    };
  }

  /** Un enregistrement de chapitre, nettoyé. Les champs inconnus sont écartés :
   *  ils viendraient d'une version future et n'ont pas de sens ici. */
  function cleanChapter(raw) {
    if (!isObject(raw)) return null;
    const record = {
      completed: !!raw.completed,
      stars: clamp(Math.floor(finite(raw.stars)), 0, 99),
      coins: clamp(Math.floor(finite(raw.coins)), 0, 9999),
      score: clamp(Math.floor(finite(raw.score)), 0, 99999999),
      time: Number.isFinite(Number(raw.time)) ? Math.max(0, Number(raw.time)) : null,
      medal: MEDALS.includes(raw.medal) ? raw.medal : null
    };
    if (Number.isFinite(Number(raw.bestTimedTime)) && Number(raw.bestTimedTime) > 0) {
      record.bestTimedTime = Number(raw.bestTimedTime);
    }
    return record;
  }

  function cleanExpedition(raw) {
    if (!isObject(raw)) return null;
    if (!Number.isFinite(Number(raw.seed))) return null;
    return {
      seed: Number(raw.seed) >>> 0,
      generationVersion: Math.max(1, Math.floor(finite(raw.generationVersion, 1))),
      // Un indice de salle ne peut désigner qu'une salle qui existe.
      roomIndex: clamp(Math.floor(finite(raw.roomIndex)), 0, roomCeiling()),
      route: Array.isArray(raw.route)
        ? raw.route.filter(step => typeof step === 'string' && knownKind(step)).slice(0, roomCeiling() + 1)
        : [],
      hp: clamp(Math.floor(finite(raw.hp, 3)), 0, 9),
      lives: clamp(Math.floor(finite(raw.lives, 3)), 0, 9),
      // Les emplacements sont une règle de jeu, pas une suggestion : une
      // sauvegarde ne peut pas en accorder plus, ni nommer un souvenir inconnu.
      upgrades: Array.isArray(raw.upgrades)
        ? raw.upgrades.filter(id => typeof id === 'string' && knownUpgrade(id)).slice(0, upgradeSlots())
        : [],
      // Les récompenses déjà encaissées : c'est ce qui empêche une reprise
      // de refuge de payer une deuxième fois le même coffre.
      claimed: Array.isArray(raw.claimed) ? raw.claimed.filter(id => typeof id === 'string').slice(0, 200) : [],
      rng: isObject(raw.rng) ? raw.rng : null,
      savedAt: finite(raw.savedAt, 0)
    };
  }

  /** Ramène n'importe quelle donnée lue à un profil sain et complet. */
  function validate(raw) {
    const profile = emptyProfile();
    if (!isObject(raw)) return profile;

    if (Array.isArray(raw.unlocked)) {
      const keys = raw.unlocked.filter(key => typeof key === 'string');
      if (keys.length) profile.unlocked = [...new Set(keys)];
    }
    if (isObject(raw.chapters)) {
      for (const [key, value] of Object.entries(raw.chapters)) {
        const record = cleanChapter(value);
        if (record) profile.chapters[key] = record;
      }
    }
    profile.bonusUnlocked = !!raw.bonusUnlocked;
    profile.finished = !!raw.finished;

    if (isObject(raw.settings)) {
      profile.settings.muted = !!raw.settings.muted;
      profile.settings.touchScale = clamp(finite(raw.settings.touchScale, 1), .8, 1.6);
      profile.settings.leftHanded = !!raw.settings.leftHanded;
      profile.settings.reducedEffects = !!raw.settings.reducedEffects;
      profile.settings.songStyle = raw.settings.songStyle === 'flow' ? 'flow' : 'gentle';
      profile.settings.volume = clamp(finite(raw.settings.volume, .35), 0, 1);
      profile.settings.language = ['en', 'fr', 'es', 'ar', 'zh'].includes(raw.settings.language) ? raw.settings.language : 'auto';
    }
    if (isObject(raw.hub)) {
      if (isObject(raw.hub.quests)) {
        for (const [id, state] of Object.entries(raw.hub.quests)) {
          if (typeof id === 'string' && typeof state === 'string') profile.hub.quests[id] = state;
        }
      }
      if (Array.isArray(raw.hub.transformations)) {
        profile.hub.transformations = [...new Set(raw.hub.transformations.filter(t => typeof t === 'string'))];
      }
    }
    if (isObject(raw.codex)) {
      for (const field of ['creatures', 'phenomena']) {
        if (Array.isArray(raw.codex[field])) {
          profile.codex[field] = [...new Set(raw.codex[field].filter(entry => typeof entry === 'string'))];
        }
      }
    }
    profile.expedition = cleanExpedition(raw.expedition);
    if (isObject(raw.expeditions)) {
      profile.expeditions = {
        runs: Math.max(0, Math.floor(finite(raw.expeditions.runs))),
        completed: Math.max(0, Math.floor(finite(raw.expeditions.completed))),
        bestRooms: Math.max(0, Math.floor(finite(raw.expeditions.bestRooms)))
      };
    }
    return profile;
  }

  /** Traduit une sauvegarde v1 ou v2, indexée par position, en clés stables. */
  function migrateLegacy(raw) {
    const profile = emptyProfile();
    if (!isObject(raw)) return profile;
    const version = raw.version === 1 ? 1 : 2;
    const order = version === 1 ? LEGACY_ORDER_V1 : LEGACY_ORDER_V2;

    if (isObject(raw.records)) {
      for (const [index, value] of Object.entries(raw.records)) {
        const key = order[Number(index)];
        // Un indice hors de l'ordre historique n'a plus de chapitre nommable :
        // on le laisse tomber plutôt que de l'attribuer au mauvais jardin.
        if (!key) continue;
        const record = cleanChapter(value);
        if (record) profile.chapters[key] = record;
      }
    }
    // La frontière numérique devient la liste des chapitres réellement ouverts.
    const frontier = raw.finished && version === 1
      ? order.length - 1
      : clamp(Math.floor(finite(raw.unlocked)), 0, order.length - 1);
    profile.unlocked = order.slice(0, frontier + 1);
    // Une aventure terminée en v1 ouvre aussi les chapitres ajoutés depuis,
    // sans quoi un ancien joueur se retrouverait devant des portes fermées.
    if (raw.finished) {
      profile.unlocked = [...new Set([...profile.unlocked, ...LEGACY_ORDER_V2])];
      profile.finished = true;
    }
    profile.bonusUnlocked = !!raw.bonusUnlocked;
    profile.settings.muted = !!raw.muted;
    return profile;
  }

  class SaveStore {
    /** @param storage un objet compatible localStorage, ou null. */
    constructor(storage) {
      this.storage = storage || null;
      this.available = true;
      this.migratedFrom = null;
      this.recovered = false;
      /** Vrai quand le fichier lu vient d'une version PLUS RÉCENTE : on n'y
       *  touche plus du tout, plutôt que de le rétrograder en silence. */
      this.futureSchema = false;
      this.readOnly = false;
      /** Vrai quand la seule copie saine est le filet : le prochain
       *  enregistrement ne doit pas le remplacer par la donnée corrompue. */
      this.protectBackup = false;
      this.profile = this.load();
    }

    read(key) {
      if (!this.storage) { this.available = false; return null; }
      try { return this.storage.getItem(key); }
      catch (_) { this.available = false; return null; }
    }
    writeRaw(key, value) {
      if (!this.storage) { this.available = false; return false; }
      try { this.storage.setItem(key, value); return true; }
      catch (_) { this.available = false; return false; }
    }

    load() {
      const current = this.read(KEY);
      if (current) {
        const parsed = this.parse(current);
        if (parsed) {
          const schema = Number(parsed.schema);
          if (Number.isFinite(schema) && schema > SCHEMA) {
            // Une version future. La relire comme un schéma 3 la mutilerait ;
            // l'enregistrer par-dessus la détruirait. On joue donc sur un
            // profil neuf, en mémoire, et on n'écrit plus rien.
            this.futureSchema = true; this.readOnly = true;
            return emptyProfile();
          }
          return validate(parsed);
        }
        // Fichier courant illisible : le filet de sécurité prend le relais.
        const backup = this.parse(this.read(BACKUP_KEY));
        if (backup) { this.recovered = true; this.protectBackup = true; return validate(backup); }
        return emptyProfile();
      }
      for (const legacyKey of LEGACY_KEYS) {
        const legacy = this.parse(this.read(legacyKey));
        if (legacy) {
          this.migratedFrom = legacyKey;
          const migrated = migrateLegacy(legacy);
          // L'ancienne clé n'est jamais effacée : si cette version pose
          // problème, la sauvegarde d'origine est toujours là.
          this.save(migrated);
          return migrated;
        }
      }
      return emptyProfile();
    }

    parse(text) {
      if (typeof text !== 'string' || !text) return null;
      try { const value = JSON.parse(text); return isObject(value) ? value : null; }
      catch (_) { return null; }
    }

    /** Écrit le profil, après avoir mis l'ancien de côté. */
    save(profile = this.profile) {
      this.profile = profile;
      profile.schema = SCHEMA;
      // Rien ne s'écrit par-dessus une sauvegarde qu'on n'a pas su lire.
      if (this.readOnly) return false;
      const previous = this.read(KEY);
      const payload = JSON.stringify(profile);
      // Tant que le filet est la seule copie saine, on ne le remplace pas par
      // la ruine qu'il a servi à réparer.
      if (previous && previous !== payload && !this.protectBackup) this.writeRaw(BACKUP_KEY, previous);
      const written = this.writeRaw(KEY, payload);
      if (written) this.protectBackup = false;
      return written;
    }

    /* ── Progression des chapitres ─────────────────────────────────────── */
    chapter(key) { return this.profile.chapters[key] || null; }
    isUnlocked(key) { return this.profile.unlocked.includes(key); }
    unlock(key) {
      if (!key || this.isUnlocked(key)) return false;
      this.profile.unlocked.push(key);
      return true;
    }
    /** Enregistre une fin de chapitre. Une course plus faible ne dégrade rien. */
    recordChapter(key, result) {
      const previous = this.profile.chapters[key] || {};
      const rank = medal => MEDALS.indexOf(medal) + 1;
      const record = {
        completed: true,
        stars: Math.max(previous.stars || 0, finite(result.stars)),
        coins: Math.max(previous.coins || 0, finite(result.coins)),
        score: Math.max(previous.score || 0, finite(result.score)),
        time: Math.min(previous.time ?? Infinity, finite(result.time, Infinity)),
        medal: rank(result.medal) >= rank(previous.medal) ? result.medal : previous.medal
      };
      if (!Number.isFinite(record.time)) record.time = null;
      const best = previous.bestTimedTime;
      let newRecord = false;
      if (result.timed && Number.isFinite(result.time)) {
        if (!Number.isFinite(best) || result.time < best) { record.bestTimedTime = result.time; newRecord = true; }
        else record.bestTimedTime = best;
      } else if (Number.isFinite(best)) record.bestTimedTime = best;
      this.profile.chapters[key] = record;
      return newRecord;
    }

    /* ── Observatoire ──────────────────────────────────────────────────── */
    questState(id) { return this.profile.hub.quests[id] || 'unknown'; }
    setQuestState(id, state) { this.profile.hub.quests[id] = state; }
    hasTransformation(id) { return this.profile.hub.transformations.includes(id); }
    addTransformation(id) {
      if (this.hasTransformation(id)) return false;
      this.profile.hub.transformations.push(id);
      return true;
    }
    /** Le carnet. Retourne vrai seulement à la toute première découverte. */
    discover(kind, id) {
      const list = this.profile.codex[kind];
      if (!list || list.includes(id)) return false;
      list.push(id);
      return true;
    }

    /* ── Expéditions ───────────────────────────────────────────────────── */
    saveExpedition(state) {
      this.profile.expedition = cleanExpedition(state);
      return this.save();
    }
    clearExpedition() { this.profile.expedition = null; return this.save(); }
    /** Vrai si la récompense n'avait pas encore été encaissée dans cette course.
     *  C'est le verrou qui empêche une reprise de refuge de payer deux fois. */
    claimReward(id) {
      const run = this.profile.expedition;
      if (!run) return false;
      if (run.claimed.includes(id)) return false;
      run.claimed.push(id);
      return true;
    }

    /* ── Réglages ──────────────────────────────────────────────────────── */
    setting(name) { return this.profile.settings[name]; }
    setSetting(name, value) {
      if (!(name in this.profile.settings)) return false;
      if (name === 'language' && !['auto', 'en', 'fr', 'es', 'ar', 'zh'].includes(value)) return false;
      this.profile.settings[name] = value;
      this.save();
      return true;
    }
  }

  global.LumenSave = {
    SCHEMA, KEY, BACKUP_KEY, LEGACY_KEYS, LEGACY_ORDER_V1, LEGACY_ORDER_V2,
    SaveStore, validate, migrateLegacy, emptyProfile
  };
})(typeof window !== 'undefined' ? window : globalThis);
