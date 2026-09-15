/* One sky for every journey. The map reads the model; only the engine grants access. */
(function (global) {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (source, values) => global.LumenI18n.t(source, values);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const text = (source, values) => esc(t(source, values));
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${Math.floor(seconds * 10) % 10}`;
  const acts = ['Le premier souffle', 'Les chemins du ciel', 'Jusqu’à la lune'];
  const medals = { bronze:'Bronze', silver:'Argent', gold:'Or' };
  let game, helpers, model, selectedId, selectedAct = 1, runMode = 'explore', codexOpen = false;
  let newLights = new Map(), announcement = '', visible = false, animateBirth = false;
  const glyph = kind => kind === 'island' ? '☾' : kind === 'hub' ? '⌂' : kind === 'dreams' ? '≋' : '✦';
  const state = place => place.completed ? 'Lumière retrouvée' : place.unlocked ? 'À explorer' : 'Lumière en sommeil';
  const kindLabel = place => place.kind === 'island' ? 'Une île pour souffler' : place.kind === 'hub' ? 'L’observatoire' : place.kind === 'dreams' ? 'Les rêves nomades' : place.key === 'coeur-eclipse' ? 'La finale' : 'Un jardin à réveiller';

  function node(place, x, y, number) {
    const label = [t(place.name), t(state(place)), place.optional ? t('Facultatif') : '', !place.unlocked ? t(place.reason || '') : ''].filter(Boolean).join('. ');
    const earned = place.lightCount || place.lights?.length || 0;
    const fresh = newLights.has(place.id);
    const awards = (place.lights || []).filter(light => light.kind !== 'completed').slice(0,16);
    const radius = place.kind === 'island' ? 35 : 24;
    const orbit = awards.map((light,index)=>{
      const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(8, awards.length);
      const type = light.kind.split('-')[0];
      return `<i class="journey-award ${esc(type)}" data-light="${esc(light.id)}" style="--dx:${Math.cos(angle)*radius}px;--dy:${Math.sin(angle)*radius}px"></i>`;
    }).join('');
    return `<button type="button" class="journey-node ${place.kind}${place.completed ? ' is-lit' : ''}${!place.unlocked ? ' is-locked' : ''}${fresh ? ' is-new' : ''}${fresh && animateBirth ? ' birth' : ''}${place.id === selectedId ? ' is-selected' : ''}" data-place="${esc(place.id)}" data-lit="${place.completed}" style="--x:${x}%;--y:${y}%" aria-label="${esc(label)}" aria-pressed="${place.id === selectedId}">
      <span class="journey-orbit" aria-hidden="true">${orbit}</span><span class="journey-core" aria-hidden="true">${place.completed ? '✦' : glyph(place.kind)}</span>
      <span class="journey-node-number" aria-hidden="true">${place.kind === 'stage' ? String(number).padStart(2,'0') + (place.optional ? ' ◇' : '') : ''}</span>
      ${earned ? `<span class="journey-light-count" aria-hidden="true">${earned}</span>` : ''}
      ${place.kind !== 'stage' ? `<span class="journey-node-name">${text(place.name)}</span>` : ''}
      ${fresh ? `<span class="journey-new-label">${text('Nouvelle lumière')}</span>` : ''}
    </button>`;
  }

  function region(act) {
    const places = model.places.filter(place => place.act === act && !['hub','dreams'].includes(place.kind));
    const island = places.find(place => place.kind === 'island');
    const stages = places.filter(place => place.kind === 'stage');
    const points = [{ x:48, y:15 }];
    // The alternating constellation extends vertically with content; nodes never shrink below 56 px.
    stages.forEach((place, index) => points.push({ x:[24,69,34,77,29,65,46][index % 7], y:38 + index * 48 / Math.max(1, stages.length - 1) }));
    const coords = points.map(point => `${point.x},${point.y}`).join(' ');
    return `<section class="journey-region${act === selectedAct ? ' is-current' : ''}" data-act="${act}" aria-label="${text('Acte {act}', { act:['I','II','III'][act-1] })}">
      <div class="journey-region-title"><span>${text('Acte {act}', {act:['I','II','III'][act-1]})}</span><h3>${text(acts[act-1])}</h3></div>
      <div class="journey-constellation" style="--region-height:${Math.max(370, stages.length * 62 + 140)}px">
        <svg class="journey-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${coords}"/></svg>
        ${island ? node(island, points[0].x, points[0].y, 0) : ''}
        ${stages.map((place, index) => node(place, points[index+1].x, points[index+1].y, model.places.filter(p=>p.kind==='stage').findIndex(p=>p.id===place.id)+1)).join('')}
      </div></section>`;
  }

  function renderSky() {
    $('journey-sky').innerHTML = [1,2,3].map(region).join('') +
      `<section class="journey-refuges" aria-label="${text('En dehors du chemin')}"><span class="journey-refuges-label">${text('En dehors du chemin')}</span>${model.places.filter(place => ['hub','dreams'].includes(place.kind)).map((place,index)=>node(place,index ? 70 : 30,45,0)).join('')}</section>`;
    document.querySelectorAll('[data-journey-act]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.journeyAct) === selectedAct)));
  }

  function selected() { return model.places.find(place => place.id === selectedId) || model.places[0]; }
  function renderDetails() {
    const place = selected();
    if (!place) return;
    const timed = ['stage','island'].includes(place.kind);
    const requirement = model.places.find(candidate => candidate.id === place.requirementId);
    const title = place.completed ? 'Revenir dans ce lieu' : 'Entrer dans ce lieu';
    $('journey-details').innerHTML = `<button class="journey-button journey-mobile-detail-back" data-journey-sky>${text('Revenir à la constellation')}</button><div class="journey-detail-emblem ${place.kind}${place.completed ? ' is-lit' : ''}" aria-hidden="true">${glyph(place.kind)}<i></i></div>
      <span class="journey-kicker">${text(kindLabel(place))}${place.optional ? ' · ' + text('Facultatif') : ''}</span>
      <h3 id="journey-place-title">${text(place.name)}</h3><p class="journey-description">${text(place.subtitle || '')}</p>
      <div class="journey-state${place.completed ? ' is-lit' : ''}"><span aria-hidden="true">${place.completed ? '✦' : place.unlocked ? '○' : '◇'}</span>${text(state(place))}</div>
      ${newLights.has(place.id) ? `<p class="journey-new-note"><span aria-hidden="true">＋</span>${text('Une lumière de plus dans votre ciel.')}</p>` : ''}
      <div class="journey-collectibles">${place.maxStars ? `<span><b>✦ ${place.stars} / ${place.maxStars}</b><small>${text('Fragments · facultatifs')}</small></span>` : ''}${place.maxSecrets ? `<span><b>◇ ${place.secrets || 0} / ${place.maxSecrets}</b><small>${text('Passages secrets · facultatifs')}</small></span>` : ''}${place.medal ? `<span><b>${text(medals[place.medal] || 'Bronze')}</b><small>${text('Meilleure médaille')}</small></span>` : ''}${Number.isFinite(place.bestTimedTime) ? `<span><b>${clock(place.bestTimedTime)}</b><small>${text('Meilleur chrono')}</small></span>` : ''}</div>
      ${!place.unlocked ? `<p id="journey-lock-note" class="journey-lock-note">${text(place.reason || 'Ce lieu attend encore.')}</p>${requirement ? `<button class="journey-button" data-journey-requirement="${esc(requirement.id)}">${text('Voir {name}', {name:t(requirement.name)})}<span aria-hidden="true">↗</span></button>` : ''}` : ''}
      ${timed && place.unlocked ? `<div class="journey-run-mode" role="group" aria-label="${text('Rythme du prochain voyage')}"><button data-journey-mode="explore" aria-pressed="${runMode === 'explore'}">${text('Exploration')}</button><button data-journey-mode="timed" aria-pressed="${runMode === 'timed'}">${text('Contre-la-montre')}</button></div>` : ''}
      ${place.unlocked ? `<button class="journey-button journey-primary" data-journey-launch="${esc(place.id)}">${text(title)}<span aria-hidden="true">→</span></button>` : ''}
      <p class="journey-optional-note">${text('Les fragments et les détours ne sont jamais requis pour la finale.')}</p>`;
  }

  function renderTotals() {
    const places = model.places;
    const total = key => places.reduce((sum, place)=>sum+(Number(place[key])||0),0);
    const voices = global.LumenSong.ISLANDS.flatMap(island=>island.lights);
    const found = voices.filter(voice=>game.progress.codex.creatures.includes('chant-'+voice.id)).length;
    $('journey-totals').innerHTML = `<div><strong>${places.filter(place=>place.completed).length}<small> / ${places.length}</small></strong><span>${text('Lieux rallumés')}</span></div><div><strong>${total('stars')}<small> / ${total('maxStars')}</small></strong><span>${text('Fragments · facultatifs')}</span></div><div><strong>${found}<small> / ${voices.length}</small></strong><span>${text('Voix retrouvées')}</span></div><div><strong>${total('secrets')}<small> / ${total('maxSecrets')}</small></strong><span>${text('Passages secrets · facultatifs')}</span></div>`;
    $('journey-codex').hidden = !codexOpen;
    $('journey-codex').innerHTML = `<div class="journey-codex-heading"><div><span class="journey-kicker">${text('LES VOIX RETROUVÉES')}</span><h3>${text('Le carnet des créatures')}</h3></div><button class="journey-button" data-journey-codex="close">${text('Fermer')}</button></div><div class="journey-voices">${voices.map((voice, index)=>{
      const rescued = game.progress.codex.creatures.includes('chant-'+voice.id);
      return `<div class="journey-voice${rescued ? ' found' : ''}"><span class="journey-voice-face voice-${index%3}" aria-hidden="true"><i></i><b></b></span><strong>${rescued ? text(voice.name) : '···'}</strong><span>${text(rescued ? 'Voix retrouvée' : 'Une voix à retrouver')}</span></div>`;
    }).join('')}</div>`;
  }

  function render(options = {}) {
    if (!game || game.mode !== 'map') return;
    model = global.LumenJourney.describe(game);
    if (options.enter) {
      newLights = new Map((game.consumeJourneyLights?.() || []).map(item=>[item.id,item.lights]));
      // Several victories can wait while the player uses Next. Show the
      // place just left, especially when mobile displays only one act.
      if (newLights.size) selectedId = newLights.has(game.level?.key) ? game.level.key : [...newLights.keys()].at(-1);
      if (!selectedId || !model.places.some(place=>place.id===selectedId)) selectedId = game.level?.key || model.places[0]?.id;
      const initial = selected();
      if (initial.act) selectedAct = initial.act;
      announcement = newLights.size ? t('Une lumière de plus dans votre ciel.') + ' ' + t(initial.name) : '';
    }
    animateBirth = !!options.enter && newLights.size > 0;
    renderSky(); renderDetails(); renderTotals(); animateBirth = false;
    $('journey-announcement').textContent = announcement;
    global.LumenI18n.translateDOM($('map-screen'));
    if (options.enter) requestAnimationFrame(()=>focusPlace(selectedId));
  }
  function focusPlace(id) {
    const place = model.places.find(candidate=>candidate.id===id);
    if (!place) return;
    if (place.act && place.act !== selectedAct) { selectedAct = place.act; renderSky(); }
    selectedId = id;
    $('journey-sky').querySelectorAll('[data-place]').forEach(button=>{
      button.classList.toggle('is-selected', button.dataset.place === id);
      button.setAttribute('aria-pressed', String(button.dataset.place === id));
    });
    renderDetails();
    const button = [...$('journey-sky').querySelectorAll('[data-place]')].find(element=>element.dataset.place===id);
    button?.focus({preventScroll:true});
    button?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  }
  function focusables() {
    return [...$('map-screen').querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter(element=>element.getClientRects().length && !element.closest('[hidden]'));
  }
  function navigate(direction) {
    if (game.mode !== 'map') return false;
    const controls = focusables(), current = controls.indexOf(document.activeElement);
    const step = ['left','up','previous'].includes(direction) ? -1 : 1;
    const next = controls[(current+step+controls.length)%controls.length];
    next?.focus({preventScroll:true});next?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    return true;
  }
  function activate() {
    if (game.mode !== 'map') return false;
    if (!$('map-screen').contains(document.activeElement)) focusPlace(selectedId);
    else document.activeElement.click();
    return true;
  }
  function back() {
    if (codexOpen) { codexOpen=false;renderTotals();focusCodexButton();return; }
    if (game.returnFromJourneyMap) game.returnFromJourneyMap();
    else helpers.transition(()=>game.song ? game.startSong(game.song.index) : game.start(game.levelIndex));
  }
  function handle(action) {
    if (game?.mode !== 'map') return false;
    if (['confirm','start','journey-confirm','menu-confirm'].includes(action)) return activate();
    if (['pause','home','journey-back','menu-back'].includes(action)) {back();return true;}
    const direction = /^(?:journey|menu)-(left|right|up|down)$/.exec(action)?.[1];
    return direction ? navigate(direction) : false;
  }
  function focusCodexButton() {
    [...$('map-screen').querySelectorAll('[data-journey-codex="toggle"]')].find(button=>button.getClientRects().length)?.focus();
  }

  function attach(instance, callbacks) {
    game=instance;helpers=callbacks;
    $('map-screen').addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.place) {
        focusPlace(button.dataset.place);
        const action = $('journey-details').querySelector('[data-journey-launch], [data-journey-requirement]');
        action?.focus({preventScroll:true});
        if (matchMedia('(max-width:760px)').matches) $('journey-details').scrollIntoView({block:'start',behavior:'instant'});
      }
      if(button.dataset.journeyAct) {
        selectedAct=Number(button.dataset.journeyAct);renderSky();
        const place=model.places.find(candidate=>candidate.act===selectedAct);if(place)focusPlace(place.id);
      }
      if(button.dataset.journeyRequirement) focusPlace(button.dataset.journeyRequirement);
      if(button.dataset.journeyMode) {runMode=button.dataset.journeyMode;renderDetails();$('journey-details').querySelector(`[data-journey-mode="${runMode}"]`)?.focus();}
      if(button.dataset.journeyLaunch) {
        const id=button.dataset.journeyLaunch;
        game.audio.unlock();helpers.transition(()=>game.openJourneyPlace(id,{timed:runMode==='timed',style:runMode==='timed'?'flow':'gentle'}));
      }
      if(button.hasAttribute('data-journey-codex')) {
        codexOpen=button.dataset.journeyCodex!=='close'&&!codexOpen;renderTotals();
        if(codexOpen){$('journey-codex').querySelector('button').focus();$('journey-codex').scrollIntoView({block:'nearest'});}
        else focusCodexButton();
      }
      if(button.hasAttribute('data-journey-back'))back();
      if(button.hasAttribute('data-journey-sky'))focusPlace(selectedId);
    });
    document.addEventListener('keydown',event=>{
      if(game.mode!=='map')return;
      const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[event.key];
      if(direction){event.preventDefault();event.stopImmediatePropagation();navigate(direction);}
      else if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();back();}
      else if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopImmediatePropagation();activate();}
      else if(event.key==='Tab') {
        const controls=focusables(), first=controls[0], last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    },true);
    global.LumenI18n.onChange(()=>{if(game.mode==='map')render();});
    game.on('mode',mode=>{if(mode!=='map')visible=false;});
  }
  function show() { render({enter:!visible});visible=true; }
  function hide() { visible=false; }
  global.LumenJourneyUI={attach,show,hide,render,navigate,activate,back,handle,focusPlace,get selectedId(){return selectedId;}};
})(window);
