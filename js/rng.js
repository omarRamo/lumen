/* LUMEN — déterminisme des rêves nomades.
 *
 * Un seul principe gouverne ce module : ce que le joueur VOIT ne doit jamais
 * pouvoir décaler ce que le joueur JOUE. Chaque usage tire donc dans un flux
 * nommé qui lui est propre, et consommer mille nombres cosmétiques ne déplace
 * pas d'un cran le flux qui décide de la disposition des salles.
 *
 * Le module est volontairement sans DOM, sans Canvas et sans Web Audio :
 * il se teste et se rejoue en Node.
 */
(function (global) {
  'use strict';

  /** Incrémenter à chaque changement qui modifie les tirages de gameplay.
   *  Une graine n'est reproductible qu'à version de génération identique ;
   *  la sauvegarde conserve la version avec la graine. */
  const GENERATION_VERSION = 1;

  /** Les seuls flux existants. Un flux inconnu est une erreur, pas un silence :
   *  un nom mal orthographié créerait un flux fantôme et casserait la
   *  reproductibilité sans que rien ne le signale. */
  const STREAMS = ['layout', 'events', 'rewards', 'cosmetic'];

  const MASK = 0xffffffff;

  /** Mélangeur d'entier 32 bits (variante de xmxmx) : dérive des germes très
   *  différents à partir de nombres voisins, pour que « graine 1 » et
   *  « graine 2 » ne produisent pas deux expéditions jumelles. */
  function scramble(value) {
    let x = value >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  /** Hachage de chaîne, pour dériver un germe de flux à partir de son nom. */
  function hashString(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  /** Un générateur mulberry32 : court, rapide, et dont l'état tient dans un
   *  seul entier — ce qui rend la sauvegarde et la reprise triviales. */
  class Stream {
    constructor(name, seed, calls = 0) {
      this.name = name;
      this.seed = seed >>> 0;
      this.state = this.seed;
      this.calls = 0;
      // Rejouer les appels déjà consommés restaure l'état exact après reprise.
      for (let i = 0; i < calls; i++) this.next();
    }
    /** Flottant dans [0, 1). */
    next() {
      this.calls++;
      this.state = (this.state + 0x6d2b79f5) >>> 0;
      let t = this.state;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Entier dans [min, max] inclus. */
    int(min, max) {
      if (max < min) throw new RangeError('Intervalle vide : ' + min + '..' + max);
      return min + Math.floor(this.next() * (max - min + 1));
    }
    /** Vrai avec la probabilité donnée. */
    chance(probability) { return this.next() < probability; }
    /** Un élément au hasard. Refuse une liste vide plutôt que de rendre undefined. */
    pick(list) {
      if (!list || !list.length) throw new RangeError('pick() sur une liste vide');
      return list[this.int(0, list.length - 1)];
    }
    /** Un élément pondéré par `weight` (défaut 1). */
    weighted(list, weightOf = item => item.weight ?? 1) {
      if (!list || !list.length) throw new RangeError('weighted() sur une liste vide');
      let total = 0;
      for (const item of list) total += Math.max(0, weightOf(item));
      if (total <= 0) return this.pick(list);
      let roll = this.next() * total;
      for (const item of list) {
        roll -= Math.max(0, weightOf(item));
        if (roll < 0) return item;
      }
      return list[list.length - 1];
    }
    /** Mélange de Fisher-Yates sur une copie : l'appelant garde son tableau. */
    shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        const swap = copy[i]; copy[i] = copy[j]; copy[j] = swap;
      }
      return copy;
    }
    /** Sous-flux nommé, pour isoler un calcul sans polluer le flux parent. */
    fork(label) {
      return new Stream(this.name + ':' + label, scramble(this.seed ^ hashString(String(label))));
    }
    snapshot() { return { seed: this.seed, calls: this.calls }; }
  }

  /** L'ensemble des flux d'une expédition, dérivés d'une graine unique. */
  class RngSet {
    constructor(seed, snapshot) {
      this.seed = RngSet.normalise(seed);
      this.version = GENERATION_VERSION;
      this.streams = {};
      for (const name of STREAMS) {
        const saved = snapshot && snapshot[name];
        this.streams[name] = new Stream(
          name,
          scramble(this.seed ^ hashString(name)),
          saved ? saved.calls : 0
        );
      }
    }
    /** Accès contrôlé : un nom inconnu lève, il ne crée pas un flux fantôme. */
    stream(name) {
      const found = this.streams[name];
      if (!found) throw new RangeError('Flux aléatoire inconnu : ' + name);
      return found;
    }
    get layout() { return this.stream('layout'); }
    get events() { return this.stream('events'); }
    get rewards() { return this.stream('rewards'); }
    get cosmetic() { return this.stream('cosmetic'); }

    snapshot() {
      const result = { seed: this.seed, version: this.version };
      for (const name of STREAMS) result[name] = this.streams[name].snapshot();
      return result;
    }
    static normalise(seed) {
      if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
      // Une chaîne passe par le décodeur : un code-mot retrouve sa graine.
      const decoded = decodeSeed(seed);
      return decoded === null ? hashString(String(seed ?? '')) : decoded;
    }
  }

  /* ── Graines lisibles ──────────────────────────────────────────────────────
   * Une graine doit pouvoir être lue à voix haute et retapée sans ambiguïté.
   * On encode donc les 32 bits en trois mots d'un petit lexique lunaire, ce qui
   * évite les confusions entre O et 0, I et 1. La saisie reste tolérante :
   * un code mot, un nombre ou une phrase quelconque donnent tous une graine.
   */
  const WORDS = [
    'lune', 'givre', 'fleur', 'onde', 'mousse', 'brume', 'comete', 'verger',
    'lanterne', 'ecume', 'grelot', 'rosee', 'ombre', 'saule', 'braise', 'vitrail',
    'nuage', 'racine', 'aurore', 'mesange', 'pollen', 'quartz', 'sillon', 'talus',
    'velours', 'zephyr', 'abysse', 'bruyere', 'cendre', 'duvet', 'etoile', 'fougere'
  ];
  const BITS = 5; // 32 mots
  const WORD_COUNT = 3; // 15 bits portés par les mots, le reste en suffixe

  function encodeSeed(seed) {
    const value = RngSet.normalise(seed);
    const words = [];
    for (let i = 0; i < WORD_COUNT; i++) {
      words.push(WORDS[(value >>> (i * BITS)) & (WORDS.length - 1)]);
    }
    // Les 17 bits restants en base 36, pour un code court mais complet.
    const tail = (value >>> (WORD_COUNT * BITS)).toString(36);
    return words.join('-') + '-' + tail;
  }

  function decodeSeed(text) {
    const raw = String(text ?? '').trim().toLowerCase();
    if (!raw) return null;
    const parts = raw.split(/[^a-z0-9]+/).filter(Boolean);
    if (parts.length === WORD_COUNT + 1) {
      const indices = parts.slice(0, WORD_COUNT).map(word => WORDS.indexOf(word));
      const tail = parseInt(parts[WORD_COUNT], 36);
      if (indices.every(i => i >= 0) && Number.isFinite(tail)) {
        let value = tail >>> 0;
        value = (value << (WORD_COUNT * BITS)) >>> 0;
        for (let i = 0; i < WORD_COUNT; i++) value = (value | (indices[i] << (i * BITS))) >>> 0;
        return value >>> 0;
      }
    }
    // Toute autre saisie reste acceptée : un nombre, un prénom, une phrase.
    if (/^\d+$/.test(raw)) return (Number(raw) >>> 0);
    return hashString(raw);
  }

  /** Une graine neuve, lisible. Utilise crypto quand il existe. */
  function randomSeed() {
    const crypto = global.crypto;
    if (crypto && typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return buffer[0] >>> 0;
    }
    return scramble((Date.now() ^ Math.floor(Math.random() * MASK)) >>> 0);
  }

  /** Le point d'entrée unique pour convertir n'importe quelle saisie en graine :
   *  un nombre reste lui-même, un code-mot est décodé, un texte libre est haché.
   *  Sans lui, « lune-lune-lune-0 » et la graine 0 donneraient deux nuits. */
  function toSeed(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
    const decoded = decodeSeed(value);
    return decoded === null ? randomSeed() : decoded;
  }

  global.LumenRng = {
    GENERATION_VERSION, STREAMS, toSeed,
    RngSet, Stream,
    encodeSeed, decodeSeed, randomSeed, hashString, scramble
  };
})(typeof window !== 'undefined' ? window : globalThis);
