/* LUMEN — one read-only description of the journey, shared by every map.
 * Stable chapter keys are the identity. No navigation state is persisted here. */
(function (global) {
  'use strict';
  const ACT_ENDS = ['lagon-lucioles', 'palais-givre', 'coeur-eclipse'];
  const MEDALS = ['bronze', 'silver', 'gold'];
  const DREAMS_KEY = 'reves-nomades';
  const count = (value, ceiling) => Math.max(0, Math.min(ceiling, Math.floor(Number(value) || 0)));

  function stages(game) {
    let act = 1;
    return (global.LUMEN_LEVELS || []).flatMap((level, index) => {
      if (level.hub) return [];
      const assigned = [1, 2, 3].includes(level.journeyAct) ? level.journeyAct : act;
      const result = { level, index, act: assigned };
      // The historical bonus remains beside act II, outside its required route.
      if (level.key === 'jardin-heures-bleues') result.act = 2;
      if (level.key === ACT_ENDS[act - 1] && act < 3) act++;
      return [result];
    });
  }

  function islandAccess(game, index) {
    const islands = global.LumenSong?.ISLANDS || [];
    const island = islands[index];
    if (!Number.isInteger(index) || !island) return { allowed: false };
    if (!index || game.store.chapter(island.key)?.completed || game.store.isUnlocked(island.key)) return { allowed: true };
    const route = stages(game);
    const preceding = route.filter(item => item.act === index && !item.level.bonus);
    // Existing players keep every island already reached, including profiles
    // whose old numeric frontier has been migrated into stable unlocked keys.
    if (route.some(item => item.act > index && !item.level.bonus && game.store.isUnlocked(item.level.key))) return { allowed: true };
    const missing = preceding.find(item => !game.store.chapter(item.level.key)?.completed);
    if (!missing && preceding.length) return { allowed: true };
    return { allowed: false, reason: 'Termine l’acte précédent pour rejoindre cette île.',
      requirementId: missing?.level.key || islands[0].key };
  }

  function chapterLights(node, record) {
    const lights = [];
    const add = kind => lights.push({ id: node.id + ':' + kind, kind });
    if (node.completed) add('completed');
    for (let i = 0; i < node.stars; i++) add('star-' + i);
    for (let i = 0; i < node.secrets; i++) add('secret-' + i);
    for (let i = 0; i <= MEDALS.indexOf(record?.medal); i++) add('medal-' + MEDALS[i]);
    if (node.bestTimedTime != null) add('time');
    return lights;
  }

  function describe(game) {
    const profile = game.store.profile;
    const route = stages(game);
    const islands = global.LumenSong?.ISLANDS || [];
    const codex = islands.flatMap(island => (island.lights || []).map(voice => ({
      id: 'chant-' + voice.id, name: voice.name, color: voice.color,
      found: profile.codex.creatures.includes('chant-' + voice.id), islandId: island.key
    })));
    const finish = (base, level, record) => {
      const node = { ...base, key: base.id, name: level.name, subtitle: level.subtitle || '', theme: level.theme,
        completed: !!record?.completed, stars: count(record?.stars, (level.collectibles || []).filter(c => c.type === 'star').length),
        maxStars: (level.collectibles || []).filter(c => c.type === 'star').length,
        secrets: count(record?.secrets, (level.secrets || []).length), maxSecrets: (level.secrets || []).length,
        medal: MEDALS.includes(record?.medal) ? record.medal : null,
        bestTimedTime: Number.isFinite(record?.bestTimedTime) && record.bestTimedTime > 0 ? record.bestTimedTime : null };
      node.lights = chapterLights(node, record);
      return node;
    };
    const places = [];
    for (let act = 1; act <= 3; act++) {
      const island = islands[act - 1];
      if (island) {
        const access = islandAccess(game, act - 1);
        const node = finish({ id: island.key, kind: 'island', index: act - 1, act, optional: false,
          unlocked: access.allowed, reason: access.reason || '', requirementId: access.requirementId || null }, island, game.store.chapter(island.key));
        for (const voice of codex.filter(v => v.islandId === island.key && v.found)) node.lights.push({ id: voice.id, kind: 'voice' });
        places.push(node);
      }
      for (const { level, index } of route.filter(item => item.act === act)) {
        const unlocked = game.isUnlocked(index);
        const previous = route.filter(item => item.index < index && !item.level.bonus).at(-1);
        places.push(finish({ id: level.key, kind: 'stage', index, act, optional: !!level.bonus,
          unlocked, reason: unlocked ? '' : level.bonus ? 'Découvre un passage secret dans les jardins.' : 'Termine le jardin précédent pour ouvrir ce lieu.',
          requirementId: unlocked ? null : level.bonus ? 'prairies-aurore' : previous?.level.key || islands[0]?.key }, level, game.store.chapter(level.key)));
      }
    }
    const hubIndex = (global.LUMEN_LEVELS || []).findIndex(level => level.hub);
    const hub = global.LUMEN_LEVELS[hubIndex];
    if (hub) {
      const node = finish({ id: hub.key, kind: 'hub', index: hubIndex, act: 0, optional: true, unlocked: true, reason: '', requirementId: null }, hub, game.store.chapter(hub.key));
      node.completed ||= !!hub.quest && game.store.questState(hub.quest.id) === 'done';
      if (node.completed && !node.lights.some(light => light.kind === 'completed')) node.lights.push({ id: node.id + ':completed', kind: 'completed' });
      if (hub.quest?.transformation && game.store.hasTransformation(hub.quest.transformation)) node.lights.push({ id: node.id + ':transformation', kind: 'transformation' });
      places.push(node);
    }
    const gate = game.canEnterDreams();
    const nights = count(profile.expeditions.completed, Number.MAX_SAFE_INTEGER);
    places.push({ id: DREAMS_KEY, key: DREAMS_KEY, kind: 'dreams', index: -1, act: 0,
      name: 'Les Rêves nomades', subtitle: 'Une nuit ne ressemble à aucune autre.', theme: 'secret', optional: true,
      unlocked: gate.allowed, completed: nights > 0, reason: gate.reason || '', requirementId: gate.allowed ? null : hub?.key,
      stars: 0, maxStars: 0, secrets: 0, maxSecrets: 0, medal: null, bestTimedTime: null, nights,
      lights: nights ? [{ id: DREAMS_KEY + ':completed', kind: 'completed' }] : [] });
    for (const node of places) node.lightCount = node.lights.length;
    const totals = { total: places.length, completed: places.filter(node => node.completed).length,
      stars: 0, maxStars: 0, secrets: 0, maxSecrets: 0, lights: 0,
      voices: codex.filter(voice => voice.found).length, maxVoices: codex.length };
    for (const node of places) for (const field of ['stars', 'maxStars', 'secrets', 'maxSecrets']) totals[field] += node[field];
    totals.lights = places.reduce((sum, node) => sum + node.lightCount, 0);
    return { places, totals, codex, pendingLights: game.journeyEvents || [],
      groups: [1, 2, 3, 0].map(act => ({ id: 'act-' + act, act, places: places.filter(node => node.act === act).map(node => node.id) })) };
  }

  function next(game) {
    const model = describe(game);
    const route = model.places.filter(place => !place.optional && place.kind !== 'dreams' && place.kind !== 'hub');
    const current = game.level?.key;
    const index = route.findIndex(place => place.id === current);
    if (index >= 0 && index + 1 < route.length) return route[index + 1];
    return route.find(place => place.unlocked && !place.completed) || route[0] || null;
  }

  global.LumenJourney = { ACT_ENDS, DREAMS_KEY, describe, places: game => describe(game).places, islandAccess, next };
})(typeof window !== 'undefined' ? window : globalThis);
