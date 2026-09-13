/* LUMEN — les souvenirs de rêve (améliorations d'expédition).
 *
 * Une amélioration change ce qu'on PEUT faire, jamais un pourcentage de dégâts.
 * Chacune se greffe sur la Résonance ou sur un mouvement existant, de sorte
 * qu'aucune ne demande d'apprendre une nouvelle touche.
 *
 * Les emplacements sont volontairement peu nombreux : à deux places pour
 * quatre souvenirs, chaque ramassage est un choix lisible, et une combinaison
 * se prépare au lieu de s'accumuler.
 */
(function (global) {
  'use strict';

  /** Deux emplacements. C'est ce qui fait qu'on choisit au lieu d'empiler. */
  const SLOTS = 2;

  const UPGRADES = [
    {
      id: 'corolle',
      name: 'Corolle persistante',
      hint: 'Votre onde laisse une fleur-tremplin là où elle est née.',
      icon: '✺',
      /** Une seule fleur vivante à la fois, et cinq secondes : sans ce plafond,
       *  on tapisserait le monde de tremplins et la verticalité perdrait tout sens. */
      caps: { flowers: 1, life: 5 },
      tags: ['resonance']
    },
    {
      id: 'souffle',
      name: 'Souffle d’azur',
      hint: 'Votre second saut émet une onde plus faible.',
      icon: '≋',
      /** L'onde du saut est délibérément courte : elle sert à réveiller ce qui
       *  est juste sous les pieds, pas à remplacer l'appel. */
      caps: { reach: .6 },
      needs: 'breeze',
      tags: ['resonance', 'jump']
    },
    {
      id: 'sillage',
      name: 'Sillage de comète',
      hint: 'Votre ruée réveille tout ce qu’elle traverse.',
      icon: '✦',
      caps: { reach: .5 },
      needs: 'comet',
      tags: ['resonance', 'dash']
    },
    {
      id: 'alize',
      name: 'Alizé du pont',
      hint: 'Un pont réveillé garde un vent qui pousse dans le sens de la traversée.',
      icon: '↝',
      /** Le vent est faible devant la course : il aide, il ne téléporte pas. */
      caps: { push: 120 },
      tags: ['bridge']
    }
  ];

  const byId = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

  /* ── Règles de cumul ──────────────────────────────────────────────────── */

  /** Deux souvenirs de même `exclusive` ne cohabitent pas. Aucun ici, mais la
   *  règle est écrite pour que l'ajout d'un cinquième ne soit pas un piège. */
  function conflicts(a, b) {
    return !!(a.exclusive && b.exclusive && a.exclusive === b.exclusive);
  }

  /** Peut-on encore prendre ce souvenir ? */
  function canEquip(equipped, id) {
    const upgrade = byId[id];
    if (!upgrade) return { ok: false, reason: 'inconnu' };
    if (equipped.includes(id)) return { ok: false, reason: 'déjà porté' };
    if (equipped.length >= SLOTS) return { ok: false, reason: 'emplacements pleins' };
    for (const other of equipped) if (conflicts(upgrade, byId[other])) return { ok: false, reason: 'incompatible avec ' + byId[other].name };
    return { ok: true };
  }

  /** Équipe, en remplaçant le plus ancien si les deux places sont prises. */
  function equip(equipped, id) {
    const list = equipped.filter(other => other !== id);
    list.push(id);
    while (list.length > SLOTS) list.shift();
    return list;
  }

  /** La combinaison que ces deux souvenirs forment, s'il y en a une. C'est ce
   *  qui rend le choix intéressant : deux bons souvenirs ne se contentent pas
   *  de s'additionner, ils ouvrent une manière de bouger. */
  const COMBOS = [
    {
      ids: ['corolle', 'souffle'],
      name: 'Escalier de corolles',
      effect: 'Chaque second saut sème une fleur sous vos pieds : on peut monter ' +
              'de saut en saut tant qu’on garde le rythme.'
    },
    {
      ids: ['sillage', 'alize'],
      name: 'Traversée filante',
      effect: 'La ruée réveille le pont qu’elle aborde, et le vent du pont la prolonge.'
    }
  ];
  function comboFor(equipped) {
    return COMBOS.find(combo => combo.ids.every(id => equipped.includes(id))) || null;
  }

  /** Ce qui est proposé après une salle : trois souvenirs utiles, tirés du flux
   *  des récompenses — jamais du flux de disposition, qui doit rester intact. */
  function offer(rng, equipped, powersSeen) {
    const usable = UPGRADES.filter(upgrade => {
      if (equipped.includes(upgrade.id)) return false;
      // Un souvenir greffé sur un pouvoir n'est proposé que si ce pouvoir a été
      // rencontré : offrir l'inutile serait offrir du vide.
      return !upgrade.needs || powersSeen.includes(upgrade.needs);
    });
    const pool = usable.length ? usable : UPGRADES.filter(u => !equipped.includes(u.id));
    return rng.shuffle(pool).slice(0, Math.min(3, pool.length));
  }

  global.LumenUpgrades = { SLOTS, UPGRADES, byId, COMBOS, canEquip, equip, comboFor, offer, conflicts };
})(typeof window !== 'undefined' ? window : globalThis);
