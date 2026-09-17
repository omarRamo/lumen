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
  let detailsOpen=false, walkingFrom=null;
  let newLights = new Map(), announcement = '', visible = false, animateBirth = false;
  const glyph = kind => kind === 'island' ? '☾' : kind === 'hub' ? '⌂' : kind === 'dreams' ? '≋' : '✦';
  const state = place => place.completed ? 'Lumière retrouvée' : place.unlocked ? 'À explorer' : 'Lumière en sommeil';
  const kindLabel = place => place.kind === 'island' ? 'Une île pour souffler' : place.kind === 'hub' ? 'L’observatoire' : place.kind === 'dreams' ? 'Les rêves nomades' : place.key === 'coeur-eclipse' ? 'La finale' : 'Un jardin à réveiller';

  function miniature(place) {
    const forms = {
      cavern:'<path d="M59 43L63 19 73 9 82 25 79 44Z" fill="#b5a9db"/><path d="M73 9L73 44 63 19Z" fill="#e4d7f4"/>',
      tide:'<path d="M54 30Q66 16 76 30T98 30M52 38Q64 25 76 38T100 38" fill="none" stroke="#a5e6db" stroke-width="5"/>',
      sky:'<path d="M59 42V22H67V12H77V22H86V42" fill="#e7dabc"/><path d="M71 42V31H77V42" fill="#547b7d"/>',
      forge:'<path d="M53 44L69 11 82 29 88 44Z" fill="#82606a"/><path d="M64 26L70 11 79 26 73 25 69 30Z" fill="#ffc37e"/>',
      frost:'<path d="M54 42L64 31H57L69 19H62L74 4 87 19H79L91 31H82L94 42Z" fill="#d5f2ea"/>',
      secret:'<path d="M68 25H78V44H68Z" fill="#f2debc"/><path d="M52 27Q70-1 92 27Z" fill="#cba9d3"/><circle cx="69" cy="19" r="3" fill="#f6e5cc"/>',
      eclipse:'<path d="M79 6A19 19 0 1 0 79 41A17 17 0 0 1 79 6" fill="#f1d694"/>'
    };
    const landmark = forms[place.theme] || '<circle cx="73" cy="30" r="8" fill="var(--islet-flower,#f3c78b)"/><circle cx="73" cy="30" r="3" fill="#fcf4cf"/><path d="M73 39V43" stroke="#7ca58b" stroke-width="3"/>';
    return `<svg class="journey-islet" viewBox="0 0 140 100" aria-hidden="true"><ellipse cx="70" cy="89" rx="40" ry="5" fill="#234c5033"/><path d="M14 47L38 77 73 89 108 71 126 47Z" fill="var(--islet-rock,#365960)"/><path d="M14 47L72 89 55 49M55 49L108 71 126 47" fill="#23444d"/><path d="M12 46Q38 36 66 41T128 46L123 53H18Z" fill="var(--islet-grass,#a7d6b0)"/><path d="M40 43Q32 21 42 16Q51 30 40 43M48 43Q48 31 59 28Q63 40 48 43M95 43Q88 21 97 19Q106 32 95 43" fill="var(--islet-leaf,#78aea1)"/><path d="M103 54Q120 75 107 85M34 55Q25 70 38 80" stroke="#83af99" stroke-width="2" fill="none"/>${landmark}</svg>`;
  }

  function node(place, x, y, number, px = x, py = y) {
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
    return `<button type="button" class="journey-node ${place.kind}${place.completed ? ' is-lit' : ''}${!place.unlocked ? ' is-locked' : ''}${place.id===global.LumenJourney.next(game)?.id ? ' is-current-place' : ''}${fresh ? ' is-new' : ''}${fresh && animateBirth ? ' birth' : ''}${place.id === selectedId ? ' is-selected' : ''}" data-place="${esc(place.id)}" data-lit="${place.completed}" style="--x:${x}%;--y:${y}%;--px:${px}%;--py:${py}%" aria-label="${esc(label)}" aria-pressed="${place.id === selectedId}">
      ${miniature(place)}${!place.unlocked ? `<span class="journey-lock" aria-hidden="true">${global.LumenIcons['lock-keyhole']}</span>` : ''}
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
    const route=[island,...stages].filter(Boolean), width=route.length*160;
    const points=route.map((_,i)=>({x:(80+i*160)/width*100,y:56+Math.sin(i*Math.PI/2)*8}));
    const coords=points.map(p=>`${p.x},${p.y}`).join(' ');
    return `<section class="journey-region${act===selectedAct?' is-current':''}" data-act="${act}" aria-label="${text('Acte {number}',{number:act})}"><div class="journey-constellation" style="--route-width:${width}px">
      <svg class="journey-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${coords}"/></svg>
      ${route.map((place,i)=>node(place,points[i].x,points[i].y,model.places.filter(p=>p.kind==='stage').findIndex(p=>p.id===place.id)+1)).join('')}
      ${route.some(p=>p.id===global.LumenJourney.next(game)?.id)?`<img class="journey-lumen" data-current-place="${esc(global.LumenJourney.next(game).id)}" alt="Lumen">`:''}
    </div></section>`;
  }

  /* ── Le ciel de la carte ────────────────────────────────────────────────
   * La carte était un document : typographie, points, filets. Belle, mais
   * d'un autre jeu. Elle reçoit ici le MÊME ciel que les lieux, dessiné par
   * js/world-art.js — celui qui dessine les îles et les jardins.
   *
   * Le DOM ne bouge pas : c'est lui qui porte les 22 lieux atteignables à la
   * manette, les cibles de 48 px, les états en niveaux de gris, le focus et
   * l'arabe. Le canvas se glisse DERRIÈRE, et ne reçoit aucun événement.
   *
   * Le ciel suit l'acte regardé — aube, midi, couchant — de sorte que changer
   * de constellation change l'heure du jour. La carte devient un endroit d'où
   * l'on regarde le voyage, et non un tableau de bord qui le résume. */
  const SKIES = ['dawn', 'noon', 'sunset'];
  let backdrop = null, backdropFrame = 0, backdropStart = 0;

  function backdropCanvas() {
    if (backdrop) return backdrop;
    const screen = $('map-screen');
    if (!screen) return null;
    backdrop = document.createElement('canvas');
    backdrop.className = 'journey-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    screen.insertBefore(backdrop, screen.firstChild);
    return backdrop;
  }

  /** Une seule image du ciel. `time` avance en secondes ; à 0 tout est figé,
   *  ce qui est exactement ce que demande le mode « mouvements réduits ». */
  function paintBackdrop(time) {
    const canvas = backdropCanvas();
    if (!canvas || !global.LumenArt) return;
    const ratio = Math.min(1.5, global.devicePixelRatio || 1);
    const width = Math.max(320, $('map-screen').clientWidth);
    const height = Math.max(320, $('map-screen').clientHeight);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      surface.songAssets = null; // les ciels en cache sont à la mauvaise taille
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    surface.ctx = context; surface.width = width; surface.height = height;
    const palette = global.LumenArt.paletteFor(SKIES[(selectedAct - 1) % 3]);
    // La dérive horizontale raconte la traversée de l'archipel d'un acte à
    // l'autre ; elle s'arrête net quand le joueur a demandé moins de mouvement.
    const drift = time * 9 + (selectedAct - 1) * 260;
    global.LumenArt.horizon(surface, palette, time, drift, width, height);
    context.save();
    context.globalAlpha = 0.12;
    context.fillStyle = palette.night ? '#0d1a1c' : '#f7f8ec';
    context.fillRect(0, 0, width, height);
    context.restore();
  }
  const surface = { ctx: null, width: 0, height: 0, songAssets: null };

  function startBackdrop() {
    stopBackdrop();
    const reduced = game?.progress?.settings?.reducedEffects;
    // Mouvements réduits : le ciel s'immobilise et le chemin cesse d'avancer.
    // Il ne DISPARAÎT pas — l'information reste, seul le mouvement s'en va.
    document.body.classList.toggle('journey-reduced', !!reduced);
    backdropStart = performance.now();
    paintBackdrop(0);
    if (reduced) return;
    let last = 0;
    const step = now => {
      if (!document.hidden && now - last >= 1000 / 30) { paintBackdrop((now - backdropStart) / 1000); last = now; }
      backdropFrame = requestAnimationFrame(step);
    };
    backdropFrame = requestAnimationFrame(step);
  }
  function stopBackdrop() {
    if (backdropFrame) cancelAnimationFrame(backdropFrame);
    backdropFrame = 0;
  }

  function renderSky() {
    $('journey-sky').innerHTML = [1,2,3].map(region).join('');
    $('journey-refuges').innerHTML=model.places.filter(place=>['hub','dreams'].includes(place.kind)).map(place=>node(place,0,0,0)).join('');
    const next=global.LumenJourney.next(game), button=$('journey-continue');
    button.textContent=t('Continuer — {name}',{name:t(next.name)});button.dataset.journeyContinue=next.id;
    $('journey-sky').querySelectorAll('.journey-lumen').forEach(image=>{image.src=document.querySelector('.journey-brand img').src;});
    $('map-screen').querySelector('[data-journey-back]').hidden = !game.journeyReturn || ['title','home'].includes(game.journeyReturn.mode);
    document.querySelectorAll('[data-journey-act]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.journeyAct) === selectedAct)));
  }

  function selected() { return model.places.find(place => place.id === selectedId) || model.places[0]; }
  function renderDetails() {
    const place = selected();
    $('journey-details').hidden=!detailsOpen;
    if (!place) return;
    const timed = ['stage','island'].includes(place.kind);
    const requirement = model.places.find(candidate => candidate.id === place.requirementId);
    const title = place.completed ? 'Revenir dans ce lieu' : 'Entrer dans ce lieu';
    $('journey-details').innerHTML = `<button class="journey-button journey-mobile-detail-back" data-journey-sky>${text('Fermer')}</button><div class="journey-detail-emblem ${place.kind}${place.completed ? ' is-lit' : ''}" aria-hidden="true">${glyph(place.kind)}<i></i></div>
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
    $('journey-codex').innerHTML = `<div class="journey-codex-heading"><div><span class="journey-kicker">${text('LES VOIX RETROUVÉES')}</span><h3>${text('Le carnet des créatures')}</h3></div><button class="journey-button" data-journey-codex="close">${text('Fermer')}</button></div><div class="journey-totals">${$('journey-totals').innerHTML}</div><div class="journey-voices">${voices.map((voice, index)=>{
      const rescued = game.progress.codex.creatures.includes('chant-'+voice.id);
      return `<div class="journey-voice${rescued ? ' found' : ''}"><span class="journey-voice-face voice-${index%3}" aria-hidden="true"><i></i><b></b></span><strong>${rescued ? text(voice.name) : '···'}</strong><span>${text(rescued ? 'Voix retrouvée' : 'Une voix à retrouver')}</span></div>`;
    }).join('')}</div>`;
  }

  function render(options = {}) {
    if (!game || (game.mode !== 'map' && !options.preload)) { stopBackdrop(); return; }
    model = global.LumenJourney.describe(game);
    if (options.enter) {
      newLights = new Map((game.consumeJourneyLights?.() || []).map(item=>[item.id,item.lights]));
      walkingFrom=[...newLights].filter(([id,lights])=>lights.includes(id+':completed')).map(([id])=>id).at(-1)||null;
      selectedId=global.LumenJourney.next(game)?.id || model.places[0]?.id; detailsOpen=false;
      const initial = selected();
      if (initial.act) selectedAct = initial.act;
      announcement = newLights.size ? t('Une lumière de plus dans votre ciel.') + ' ' + t(initial.name) : '';
    }
    animateBirth = !!options.enter && newLights.size > 0;
    renderSky(); renderDetails(); renderTotals(); animateBirth = false;
    if (!options.preload) startBackdrop();
    $('journey-announcement').textContent = announcement;
    global.LumenI18n.translateDOM($('map-screen'));
    requestAnimationFrame(()=>{ positionLumen(!!options.enter);if(options.enter)focusPlace(selectedId,false); });
  }
  function focusPlace(id,open=true) {
    const place = model.places.find(candidate=>candidate.id===id);
    if (!place) return;
    if (place.act && place.act !== selectedAct) { selectedAct = place.act; renderSky(); }
    selectedId = id; detailsOpen=open;
    $('map-screen').querySelectorAll('[data-place]').forEach(button=>{
      button.classList.toggle('is-selected', button.dataset.place === id);
      button.setAttribute('aria-pressed', String(button.dataset.place === id));
    });
    renderDetails();
    const button = [...$('map-screen').querySelectorAll('[data-place]')].find(element=>element.dataset.place===id);
    button?.focus({preventScroll:true});
    centerPlace(button);
    positionLumen(false);
  }
  function centerPlace(button) {
    const region=button?.closest('.journey-region');if(!region)return;
    region.scrollLeft=button.offsetLeft+button.parentElement.offsetLeft-region.clientWidth/2;
  }
  function positionLumen(walk) {
    const sprite=$('journey-sky').querySelector('.is-current .journey-lumen');if(!sprite)return;
    const node=$('journey-sky').querySelector(`[data-place="${sprite.dataset.currentPlace}"]`);
    const point=n=>({x:n.offsetLeft-18,y:n.offsetTop-63});
    const end=point(node), transform=p=>`translate(${p.x}px,${p.y}px)`;
    sprite.style.transform=transform(end);
    const reduced=game.progress.settings.reducedEffects||matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(walk&&walkingFrom&&!reduced) {
      const route=[...node.parentElement.querySelectorAll('[data-place]')];
      const from=route.findIndex(n=>n.dataset.place===walkingFrom),to=route.indexOf(node);
      let points=from>=0?route.slice(Math.min(from,to),Math.max(from,to)+1).map(point):[{x:0,y:end.y},end];
      if(from>to)points.reverse();
      if(points.length>1)sprite.animate(points.map(p=>({transform:transform(p)})),{duration:1200,easing:'ease-in-out'});
    }
    if(walk)walkingFrom=null;
  }
  function focusables() {
    return [...$(codexOpen ? 'journey-codex' : 'map-screen').querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter(element=>element.getClientRects().length && !element.closest('[hidden]'));
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
    if(detailsOpen){detailsOpen=false;renderDetails();return;}
    if(!game.journeyReturn)return;
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
        const place=model.places.find(p=>p.id===button.dataset.place);
        if(detailsOpen&&selectedId===place.id&&place.unlocked){game.audio.unlock();helpers.transition(()=>game.openJourneyPlace(place.id,{timed:runMode==='timed'}));return;}
        focusPlace(button.dataset.place);
        const action = $('journey-details').querySelector('[data-journey-launch], [data-journey-requirement]');
        action?.focus({preventScroll:true});

      }
      if(button.dataset.journeyAct) {
        selectedAct=Number(button.dataset.journeyAct);detailsOpen=false;renderSky();startBackdrop();
        const place=model.places.find(candidate=>candidate.act===selectedAct);if(place)focusPlace(place.id,false);
      }
      if(button.dataset.journeyRequirement) focusPlace(button.dataset.journeyRequirement);
      if(button.dataset.journeyMode) {runMode=button.dataset.journeyMode;renderDetails();$('journey-details').querySelector(`[data-journey-mode="${runMode}"]`)?.focus();}
      if(button.dataset.journeyLaunch || button.dataset.journeyContinue) {
        const id=button.dataset.journeyLaunch || button.dataset.journeyContinue;
        game.audio.unlock();helpers.transition(()=>game.openJourneyPlace(id,{timed:runMode==='timed',style:runMode==='timed'?'flow':'gentle'}));
      }
      if(button.hasAttribute('data-journey-codex')) {
        codexOpen=button.dataset.journeyCodex!=='close'&&!codexOpen;renderTotals();
        if(codexOpen){$('journey-codex').querySelector('button').focus();$('journey-codex').scrollIntoView({block:'nearest'});}
        else focusCodexButton();
      }
      if(button.hasAttribute('data-journey-back'))back();
      if(button.hasAttribute('data-journey-sky'))focusPlace(selectedId,false);
    });
    document.addEventListener('keydown',event=>{
      if(game.mode!=='map'||$('map-screen').inert)return;
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
  function hide() {
    stopBackdrop(); visible=false; }
  global.LumenJourneyUI={attach,show,hide,render,navigate,activate,back,handle,focusPlace,get selectedId(){return selectedId;}};
})(window);
