/* All menus and HUD live in the DOM: crisp text, keyboard focus and touch controls. */
(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const I18n = window.LumenI18n;
  const translate = (source, values) => I18n.t(source, values);
  const screens = ['home','map','pause','help','complete','dream','route'];
  let game, toastTimer, introTimer, damageTimer, helpPrevious='home', transitioning=false, lastHud='', lastHint='', uiTime=0, selectedRunMode='explore';
  // Ce qui se lit sur un clavier et nulle part ailleurs. Le test porte sur la
  // phrase écrite, jamais sur sa traduction : le verdict reste le même partout.
  const namesAKey=text=>/\b(?:X|J|Q|D|A|W|Z|S)\b|Espace|Maj|[←→↑↓]/.test(String(text));
  const hintsSeen=new Set();
  let dialogueTimer, dialogueLines=[], dialogueStep=0, dialogueWho='';
  let routeChoice=null, routeUpgrade=null, lastRoute=null, lastResult=null, lastToast=null;
  const timeLabel = (seconds, precise=false) => {
    const tenths=Math.max(0,Math.floor((Number(seconds)||0)*10));
    return `${Math.floor(tenths/600)}:${String(Math.floor(tenths/10)%60).padStart(2,'0')}${precise?'.'+tenths%10:''}`;
  };
  const stars = (n, total=3) => Array.from({length:total},(_,i)=>`<span class="${i<n?'earned':''}">${i<n?'✦':'✧'}</span>`).join(' ');
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function showScreen(name) {
    for (const id of screens) $(id+'-screen').classList.toggle('active',id===name);
    const focused=document.activeElement;
    if (focused instanceof HTMLElement && focused.closest('.screen') && !focused.closest('.screen.active')) focused.blur();
  }
  function showMode(mode) {
    if (mode !== 'map') window.LumenJourneyUI?.hide();
    window.LumenSongUI?.sync();
    document.body.classList.toggle('journey-open', mode === 'map');
    if (mode === 'map') {
      document.body.classList.remove('in-game');
      showScreen('map'); renderMap();
      for (const id of ['hud','run-clock','level-hint','boss-hud','dialogue','quest-banner','touch-controls']) $(id).classList.add('hidden');
      $('chapter-intro').classList.remove('show'); return;
    }
    if (game.song) {
      document.body.classList.add('in-game'); showScreen(null);
      if (mode !== 'playing') { clearTimeout(toastTimer); $('toast').classList.remove('show'); }
      for (const id of ['hud', 'run-clock', 'level-hint', 'boss-hud', 'dialogue', 'quest-banner']) $(id).classList.add('hidden');
      $('chapter-intro').classList.remove('show');
      return;
    }
    const playing=['playing','dead','paused','gameover','complete','ending','route'].includes(mode) || (mode==='help'&&helpPrevious!=='home'&&helpPrevious!=='map');
    document.body.classList.toggle('in-game',playing);
    $('hud').classList.toggle('hidden',!playing);
    $('run-clock').classList.toggle('hidden',!playing||game.runMode!=='timed');
    $('touch-controls').classList.toggle('hidden',mode!=='playing'||(!matchMedia('(pointer: coarse)').matches&&navigator.maxTouchPoints===0));
    if (mode==='home') {
      showScreen('home');$('start-button').querySelector('span').textContent=game.progress.finished?'Repartir à l’aventure':game.nextChapterIndex()>0?'Poursuivre l’aventure':'Commencer l’aventure';
      $('chapter-intro').classList.remove('show');
    } else if (mode==='map') {showScreen('map');renderMap();$('chapter-intro').classList.remove('show');}
    else if (mode==='paused'||mode==='gameover') {
      showScreen('pause');const over=mode==='gameover';
      $('pause-screen').classList.toggle('stage-over',over);
      $('pause-title').textContent=over?'Une lumière renaîtra.':window.LumenTouch?.enabled?'Pause':'Le monde peut attendre.';
      $('pause-screen').querySelector('.modal-card>p').textContent=over?'Repartez du début avec 3 vies.':game.runMode==='timed'?'Le chronomètre est en pause. Votre record attendra.':'Votre lumière sera toujours là.';
      $('pause-screen').querySelector('[data-command="resume"]').classList.toggle('hidden',over);
      // Une nuit perdue n'est pas un chapitre perdu : on la refait telle quelle
      // avec sa graine, ou on en demande une autre. Deux décisions, deux boutons.
      const lostNight=over&&game.lastRun&&!game.lastRun.won;
      const second=$('pause-screen').querySelector('[data-command="map"],[data-command="dream"]');
      $('pause-screen').querySelector('[data-command="retry"]').innerHTML=
        lostNight?`Refaire cette nuit <span>↻</span>`:'Recommencer le chapitre <span>↻</span>';
      if(lostNight) {
        $('pause-title').textContent='La nuit s’achève ici.';
        $('pause-screen').querySelector('.modal-card>p').textContent=
          translate('Vos découvertes restent acquises. Graine {seed} : refaites-la à l’identique, ou laissez-la pour une autre.', { seed: game.lastRun.code });
        second.dataset.command='dream';second.innerHTML='Une autre nuit <span>☾</span>';
      } else if(game.session==='expedition'&&game.run) {
        // Pendant une nuit, ce bouton l'abandonne. Il doit le dire.
        second.dataset.command='map';second.innerHTML='Quitter la nuit <span>✕</span>';
        $('pause-screen').querySelector('.modal-card>p').textContent=
          'La nuit n’est enregistrée qu’aux refuges. La quitter ici perd le chemin parcouru depuis le dernier.';
      } else {second.dataset.command='map';second.innerHTML='L’atlas des chapitres <span>✧</span>';}
    } else if (mode==='dream') {showScreen('dream');refreshDream();}
    else if (mode==='route') showScreen('route');
    else if (mode==='help') { if(window.LumenTouch?.enabled)$('help-title').textContent='Réglages'; showScreen('help'); }
    else if (mode==='complete'||mode==='ending') showScreen('complete');
    else showScreen(null);
    if (mode!=='playing') {$('level-hint').classList.add('hidden');$('boss-hud').classList.add('hidden');$('dialogue').classList.add('hidden');$('quest-banner').classList.add('hidden');}
    I18n.translateDOM($('app'));
  }
  /** Le dialogue s'ouvre en approchant, avance seul, et se ferme en s'éloignant.
   *  Les répliques sont courtes et passables : personne n'est retenu. */
  function showDialogue(detail) {
    clearInterval(dialogueTimer);
    if (!detail || !detail.lines.length) { $('dialogue').classList.add('hidden'); dialogueWho=''; return; }
    const sameSpeaker = dialogueWho === detail.character.id;
    dialogueWho = detail.character.id; dialogueLines = detail.lines; dialogueStep = sameSpeaker ? dialogueStep : 0;
    $('dialogue-name').textContent = translate(detail.character.name);
    $('dialogue-role').textContent = translate(detail.character.role || '');
    $('dialogue-mark').textContent = detail.character.id === 'vesper' ? '☾' : '✧';
    $('dialogue').dataset.who = detail.character.id;
    const render = () => {
      $('dialogue-line').textContent = translate(dialogueLines[dialogueStep % dialogueLines.length]);
      $('dialogue-dots').innerHTML = dialogueLines.map((_, i) =>
        `<i class="${i === dialogueStep % dialogueLines.length ? 'on' : ''}"></i>`).join('');
    };
    render();
    $('dialogue').classList.remove('hidden');
    if (dialogueLines.length > 1) dialogueTimer = setInterval(() => { dialogueStep++; render(); }, 3400);
  }
  function advanceDialogue() {
    if ($('dialogue').classList.contains('hidden') || dialogueLines.length < 2) return false;
    dialogueStep++;
    $('dialogue-line').textContent = translate(dialogueLines[dialogueStep % dialogueLines.length]);
    $('dialogue-dots').innerHTML = dialogueLines.map((_, i) =>
      `<i class="${i === dialogueStep % dialogueLines.length ? 'on' : ''}"></i>`).join('');
    return true;
  }
  function showQuest(detail) {
    const banner = $('quest-banner');
    if (!detail) { banner.classList.add('hidden'); return; }
    banner.classList.remove('hidden');
    banner.classList.toggle('done', detail.state === 'done');
    $('quest-title').textContent = translate(detail.quest.title);
    $('quest-progress').textContent = translate(detail.state === 'done' ? detail.quest.reward : detail.quest.summary);
  }
  function refreshDream() {
    const saved=game.progress.expedition;
    const usable=saved&&saved.generationVersion===window.LumenRng.GENERATION_VERSION;
    $('dream-resume').classList.toggle('hidden',!usable);
    if(usable) $('dream-resume').innerHTML=escape(translate('Reprendre la nuit {seed} · salle {room}', { seed: window.LumenRng.encodeSeed(saved.seed), room: saved.roomIndex+1 }))+' <span>☾</span>';
    const stats=game.progress.expeditions;
    $('seed-note').textContent=stats.runs
      ? translate('Nuits tentées : {runs}. Terminées : {completed}. Laissez vide pour une nuit inédite.', { runs: stats.runs, completed: stats.completed })
      : translate('Laissez vide pour une nuit inédite. Notez la graine pour la rejouer à l’identique.');
  }
  /** La carte des routes : chaque branche s'annonce avant qu'on s'y engage. */
  function showRoute(detail, preserveChoice=false) {
    lastRoute=detail;
    if(!preserveChoice){routeChoice=detail.branches[0]?detail.branches[0].kind:null; routeUpgrade=null;}
    $('route-eyebrow').textContent=translate('SALLE {room} / {total} · GRAINE {seed}', { room: detail.next.index+1, total: detail.run.plan.rooms.length, seed: detail.run.code });
    $('route-sub').textContent=detail.branches.length>1
      ? 'Deux chemins. Ce qu’ils annoncent est vrai : rien ne vous surprendra sans prévenir.'
      : 'Un seul chemin s’ouvre ici.';
    $('route-branches').innerHTML=detail.branches.map((branch,i)=>{
      // Un présage manquant ne doit jamais faire taire la carte : le joueur
      // garde une route lisible même si une nature nouvelle n'a pas encore
      // son libellé.
      const omen=branch.omen||{icon:'✧',label:'Un chemin',hint:'Ce qu’il contient reste à découvrir.'};
      return `<button class="route-branch${branch.kind===routeChoice?' picked':''}" data-branch="${escape(branch.kind)}"><span class="branch-icon" aria-hidden="true">${omen.icon}</span><strong>${escape(translate(omen.label))}</strong><span>${escape(translate(omen.hint))}</span></button>`;
    }).join('');
    const equipped=detail.run.upgrades;
    $('route-offer').classList.toggle('hidden',!detail.offer.length);
    $('offer-list').innerHTML=detail.offer.map(upgrade=>
      `<button class="offer-item${routeUpgrade===upgrade.id?' picked':''}" data-upgrade="${escape(upgrade.id)}"><span class="offer-icon" aria-hidden="true">${upgrade.icon}</span><div><strong>${escape(translate(upgrade.name))}</strong><span>${escape(translate(upgrade.hint))}</span></div></button>`).join('');
    const combo=window.LumenUpgrades.comboFor(equipped);
    $('offer-note').textContent=equipped.length>=window.LumenUpgrades.SLOTS
      ? translate('Vos {slots} emplacements sont pris : un nouveau souvenir remplacera le plus ancien.', { slots: window.LumenUpgrades.SLOTS })
      : combo?`${translate(combo.name)} · ${translate(combo.effect)}`:translate('Deux emplacements seulement : choisissez ce qui change votre façon de bouger.');
    I18n.translateDOM($('route-screen'));
  }
  function toast(message, values = {}) {
    lastToast={message,values};
    clearTimeout(toastTimer);$('toast').textContent=translate(message,typeof values==='function'?values():values);$('toast').classList.add('show');
    toastTimer=setTimeout(()=>$('toast').classList.remove('show'),window.LumenTouch?.enabled?2000:3800);
  }
  function transition(fn) {
    if (game.mode === 'title') { if (['confirm','start'].includes(action)) window.LumenBoot.enter(); return; }
    if (transitioning) return;
    transitioning=true;$('transition').classList.add('show');game.input.reset();
    setTimeout(()=>{fn();$('transition').classList.remove('show');transitioning=false;},320);
  }
  // The atlas choice is deliberately separate from the current run: retry and next
  // always retain the run's mode, while a fresh adventure starts in exploration.
  function startLevel(index, mode=selectedRunMode) {
    game.start(index,{timed:mode==='timed'});
  }
  function command(action) {
    if (game.mode === 'title') { if (['confirm','start'].includes(action)) window.LumenBoot.enter(); return; }
    if (transitioning) return;
    if(action==='sound-preview'){
      game.audio.unlock().then(()=>game.audio.audition());return;
    }
    if(!['sound','pause','start','confirm'].includes(action))game.audio.sfx('menu');
    if (window.LumenSongUI?.handle(action)) return;
    if (window.LumenJourneyUI?.handle(action)) return;
    if (action==='sound') {
      game.audio.unlock();game.store.setSetting('muted',game.audio.toggle());updateSound();return;
    }
    if (action==='help') {
      if(game.mode==='help')return;
      helpPrevious=game.mode;
      if(game.mode==='playing')game.pause();
      game.mode='help';game.input.reset();showMode('help');return;
    }
    if (action==='close-help') {
      if(helpPrevious==='playing'){game.mode='paused';game.resume();}
      else {game.mode=helpPrevious;showMode(game.mode);}
      return;
    }
    if (action==='pause') {
      if(game.mode==='help')command('close-help');
      else if(game.mode==='paused')game.resume();
      else if(game.mode==='playing')game.pause();
      else if(game.mode==='map')command('home');
      return;
    }
    if(action==='resume'){game.resume();return;}
    if(action==='skip-line'){advanceDialogue();return;}
    if(action==='medal-help') {
      const open=$('medal-help').classList.toggle('hidden')===false;
      document.querySelector('[data-command="medal-help"]').setAttribute('aria-expanded',String(open));return;
    }
    if(action==='retry') {
      if(['playing','paused','dead','gameover'].includes(game.mode))transition(()=>game.retry());
      return;
    }
    if(action==='hub') {
      const index=window.LUMEN_LEVELS.findIndex(level=>level.hub);
      if(index>=0){game.audio.unlock();transition(()=>game.start(index));}
      return;
    }
    if(action==='dream'){
      // Une seule règle décide, et c'est celle du moteur. Le menu ne peut donc
      // pas ouvrir ce que le portail de l'observatoire garde fermé.
      const gate=game.canEnterDreams();
      if(!gate.allowed){toast(gate.reason);transition(()=>game.start(gate.hubIndex));return;}
      game.audio.unlock();game.mode='dream';game.input.reset();showMode('dream');return;
    }
    if(action==='dream-start') {
      const raw=$('seed-input').value.trim();
      transition(()=>game.startExpedition(raw||undefined));
      return;
    }
    if(action==='dream-resume'){transition(()=>{if(!game.resumeExpedition()){game.mode='dream';showMode('dream');}});return;}
    if(action==='dream-again'){transition(()=>{if(!game.retryExpedition()){game.mode='dream';showMode('dream');}});return;}
    if(action==='route-go'){const kind=routeChoice,up=routeUpgrade;transition(()=>game.chooseRoute(kind,up));return;}
    if(action==='home'){
      if(new URLSearchParams(window.location.search).has('classic'))transition(()=>game.showHome());
      else window.LumenSongUI.handle('song-return');
      return;
    }
    if(action==='map'){transition(()=>game.showMap());return;}
    if(action==='start'||action==='confirm') {
      if(game.mode==='home'){game.audio.unlock();transition(()=>startLevel(game.progress.finished?0:game.nextChapterIndex(),'explore'));}
      else if(game.mode==='paused')game.resume();
      else if(game.mode==='complete'||game.mode==='ending')command('next');
      else if(game.mode==='gameover')command('retry');
      return;
    }
    if(action==='replay'&&['complete','ending'].includes(game.mode)) {
      transition(()=>startLevel(game.levelIndex,game.runMode));return;
    }
    if(action==='next') {
      const next=game.nextJourneyPlace();
      if(next)transition(()=>game.openJourneyPlace(next.id,{timed:game.runMode==='timed'}));
      else transition(()=>game.showMap());
    }
  }
  function updateSound() {
    document.querySelectorAll('.sound-label').forEach(el=>el.textContent=translate(game.audio.muted?'SON COUPÉ':'SON ACTIVÉ'));
    document.querySelectorAll('.sound-icon').forEach(el=>el.textContent=game.audio.muted?'♩':'♪');
    document.querySelectorAll('[data-command="sound"]').forEach(el=>{el.setAttribute('aria-pressed',String(!game.audio.muted));el.setAttribute('aria-label',translate(game.audio.muted?'Activer le son':'Couper le son'));});
  }
  function renderMap() { window.LumenJourneyUI.show(); }
  function updateHud(dt) {
    if (game.song) { window.LumenSongUI?.update(dt); return; }
    uiTime+=dt;if(uiTime<.07)return;uiTime=0;
    const p=game.player;
    const totalFragments=game.level.collectibles.filter(c=>c.type==='star').length;
    const key=[p.hp,game.lives,game.score,game.levelCoins,game.levelStars,game.levelIndex,game.runMode,I18n.language].join(':');
    if(key!==lastHud) {
      lastHud=key;$('hearts').innerHTML=Array.from({length:3},(_,i)=>`<span class="${i<p.hp?'':'empty'}">♥</span>`).join('');
      $('hearts').setAttribute('aria-label',translate('{hp} points de vie sur 3',{hp:p.hp}));
      $('life-count').textContent='×'+Math.max(0,game.lives);
      $('life-count').setAttribute('aria-label',translate('{count} vies',{count:Math.max(0,game.lives)}));
      $('remaining-lives').textContent=translate('{count} vies',{count:Math.max(0,game.lives)});
      $('coin-count').textContent=String(game.levelCoins).padStart(2,'0');
      $('star-count').textContent=game.levelStars+' / '+totalFragments;$('star-count').setAttribute('aria-label',translate('{count} fragments sur {total}',{count:game.levelStars,total:totalFragments}));
      $('star-count').parentElement.hidden=totalFragments===0;
      const chapter=game.session==='campaign';
      $('chapter-number').hidden=!chapter;
      $('chapter-number').textContent=chapter?String(window.LUMEN_LEVELS.slice(0,game.levelIndex+1).filter(level=>!level.hub).length).padStart(2,'0'):'';
      $('chapter-name').textContent=translate(game.level.name);
      $('chapter-caption').textContent=game.level.hub?translate('L’OBSERVATOIRE'):game.level.expedition
        ?translate('NUIT · SALLE {room} / {total}',{room:String((game.run?.roomIndex||0)+1).padStart(2,'0'),total:String(game.run?.plan.rooms.length||5).padStart(2,'0')})
        :translate(game.runMode==='timed'?'CONTRE-LA-MONTRE':'LES JARDINS DE LA LUNE');
    }
    if(game.runMode==='timed') {
      $('clock-time').textContent=timeLabel(game.elapsed,true);
      const best=game.recordFor(game.levelIndex)?.bestTimedTime;
      $('clock-best').textContent=Number.isFinite(best)?translate('RECORD {time}',{time:timeLabel(best,true)}):translate('PREMIÈRE COURSE');
      $('run-clock').classList.toggle('clock-paused',game.mode==='paused'||game.mode==='help');
    }
    if(game.mode!=='playing')return;
    const b=game.boss;
    $('boss-hud').classList.toggle('hidden',!b||!b.activated||b.hp<=0);
    if(b&&b.activated&&b.hp>0) {
      $('boss-fill').style.width=b.hp/b.maxHp*100+'%';$('boss-phase').textContent=translate(b.phase===2?'PHASE II':'PHASE I');
      $('boss-tip').textContent=translate(b.vulnerable?'Sa couronne est ouverte ! Sautez dessus ou utilisez votre pouvoir.':b.state==='telegraph'?'Le Veilleur prépare son attaque. Gardez de l’espace.':'Évitez les orbes. Sautez par-dessus les ondes au sol.');
    }
    const quest=game.level.quest,aim=window.LumenPlaces?.objective(game);
    if(quest) {
      const state=game.store.questState(quest.id);
      const done=quest.needs.filter(id=>game.wokenOnce.has(id)).length;
      $('quest-banner').classList.remove('hidden');
      $('quest-banner').classList.toggle('done',state==='done');
      $('quest-title').textContent=translate(quest.title);
      $('quest-progress').textContent=state==='done'?translate(quest.reward):`${translate(quest.summary)} · ${done} / ${quest.needs.length}`;
    } else if(aim) {
      // Un lieu dont la sortie attend quelque chose le dit tout du long : on ne
      // découvre plus le verrou en arrivant devant le portail.
      $('quest-banner').classList.remove('hidden');
      $('quest-banner').classList.toggle('done',aim.done);
      $('quest-title').textContent=translate(game.level.goal||'');
      $('quest-progress').textContent=aim.done?translate('La sortie s’ouvre.'):translate(aim.text,aim.values);
    } else $('quest-banner').classList.add('hidden');
    const hint=(!b||!b.activated)?(game.level.hints||[]).find(h=>Math.abs(h.x-game.player.x)<180):null;
    const introShowing=$('chapter-intro').classList.contains('show');
    if(window.LumenTouch?.enabled) {
      // Au pouce, l'aide passe en bulle : elle dit la même chose, puis s'efface
      // au lieu d'occuper le bas de l'écran. Celles qui nomment une touche
      // n'ont rien à lui apprendre et restent au clavier.
      $('level-hint').classList.add('hidden');
      if(hint&&!introShowing&&!namesAKey(hint.text)&&!hintsSeen.has(hint.text)){hintsSeen.add(hint.text);toast(hint.text);}
    } else {
      $('level-hint').classList.toggle('hidden',!hint||introShowing);
      if(hint&&hint.text!==lastHint){lastHint=hint.text;$('level-hint').textContent=translate(hint.text);}
    }
  }
  function updateIntroText(level) {
    // Le compte des chapitres ne compte QUE des chapitres : ni l'observatoire,
    // ni une salle de rêve, qui n'ont pas de place dans la campagne.
    const chapters=window.LUMEN_LEVELS.filter(l=>!l.hub);
    const rank=window.LUMEN_LEVELS.slice(0,game.levelIndex+1).filter(l=>!l.hub).length;
    $('intro-number').textContent=level.expedition
      ? translate('NUIT · SALLE {room} / {total}',{room:String((game.run?game.run.roomIndex:0)+1).padStart(2,'0'),total:String(game.run?game.run.plan.rooms.length:5).padStart(2,'0')})
      : level.hub ? translate('L’OBSERVATOIRE')
      : translate('CHAPITRE {chapter} / {total}',{chapter:String(rank).padStart(2,'0'),total:String(chapters.length).padStart(2,'0')});
    $('intro-name').textContent=translate(level.name);$('intro-subtitle').textContent=translate(level.subtitle);
  }
  function chapterIntro(level) {
    clearTimeout(introTimer);
    if (level.song) { $('chapter-intro').classList.remove('show'); clearTimeout(toastTimer); $('toast').classList.remove('show'); return; }
    updateIntroText(level);
    $('chapter-intro').classList.add('show');introTimer=setTimeout(()=>$('chapter-intro').classList.remove('show'),window.LumenTouch?.enabled?1100:2400);
    lastHint='';lastHud='';hintsSeen.clear();
    $('hud').classList.remove('heart-hit');
  }
  function healthImpact() {
    clearTimeout(damageTimer);$('hud').classList.remove('heart-hit');
    // Restart the one-shot pulse even when a second hit follows immediately.
    void $('hud').offsetWidth;$('hud').classList.add('heart-hit');
    damageTimer=setTimeout(()=>$('hud').classList.remove('heart-hit'),650);
  }
  function completed(result) {
    lastResult=result;
    $('complete-title').textContent=translate(result.final?'Même la lune avait besoin de vous.':'Le jardin s’éveille.');
    $('complete-subtitle').textContent=translate(game.level.name);
    const total=game.level.collectibles.filter(c=>c.type==='star').length;
    $('result-stars').innerHTML=stars(result.stars,total);
    $('result-stars').setAttribute('aria-label',translate('{count} / {total} FRAGMENTS DE LUNE',{count:result.stars,total}));
    $('result-time').classList.toggle('hidden',!result.timed);
    $('result-time').textContent=result.timed?(result.record?'✦ ':'')+timeLabel(result.time,true):'';
    $('next-button').innerHTML=translate('Continuer le voyage')+' <span>→</span>';
    I18n.translateDOM($('complete-screen'));
  }
  try {
    if (window.LumenPlatform?.native) await window.LumenPlatform.prepare();
    game=new window.LumenGame($('game'));window.lumen=game;
    window.LumenPlatform?.attach(game);
    window.LumenAppearance.apply(game.progress.settings.appearance);
    I18n.setLanguage(game.progress.settings.language);
    I18n.translateDOM($('app'));
    game.on('command',command);game.on('mode',showMode);game.on('toast',toast);game.on('frame',updateHud);game.on('level',chapterIntro);game.on('complete',completed);game.on('damage',healthImpact);game.on('dialogue',showDialogue);game.on('quest',showQuest);
    game.on('portal',target=>{
      if(target!=='expedition'){transition(()=>game.showMap());return;}
      const gate=game.canEnterDreams();
      if(!gate.allowed){toast(gate.reason);return;}
      game.mode='dream';game.input.reset();showMode('dream');
    });
    game.on('route',showRoute);
    // Les écouteurs sont posés : ce que le moteur avait à dire pendant son
    // initialisation (sauvegarde récupérée, stockage refusé, version future)
    // peut maintenant être entendu.
    game.flushNotices();
    game.on('expedition',detail=>{toast('Salle {room} / {total} · {omen} · graine {seed}',()=>({room:detail.room.index+1,total:detail.run.plan.rooms.length,omen:translate(detail.room.omen.label),seed:detail.run.code}));});
    game.on('expedition-end',detail=>{toast(detail.won?'Nuit menée au bout · graine {seed}':'La nuit s’achève ici · graine {seed}',{seed:detail.run.code});if(detail.won){game.mode='dream';showMode('dream');}});
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-command]');if(button){command(button.dataset.command);if(event.detail>0)button.blur();}
      const level=event.target.closest('[data-level]');if(level&&!level.disabled){game.audio.unlock();transition(()=>startLevel(Number(level.dataset.level)));}
    });
    $('dialogue').addEventListener('click',()=>advanceDialogue());
    $('route-branches').addEventListener('click',event=>{
      const button=event.target.closest('[data-branch]');if(!button)return;
      routeChoice=button.dataset.branch;
      $('route-branches').querySelectorAll('.route-branch').forEach(el=>el.classList.toggle('picked',el===button));
    });
    $('offer-list').addEventListener('click',event=>{
      const button=event.target.closest('[data-upgrade]');if(!button)return;
      routeUpgrade=routeUpgrade===button.dataset.upgrade?null:button.dataset.upgrade;
      $('offer-list').querySelectorAll('.offer-item').forEach(el=>el.classList.toggle('picked',el.dataset.upgrade===routeUpgrade));
    });
    $('seed-dice').addEventListener('click',()=>{$('seed-input').value=window.LumenRng.encodeSeed(window.LumenRng.randomSeed());});
    $('brand-home').addEventListener('click',event=>{event.preventDefault();command('home');});
    /* ── Tactile ────────────────────────────────────────────────────────────
     * Deux exigences se croisent ici : plusieurs doigts doivent fonctionner en
     * même temps, et aucun appui ne doit rester « collé » si le système reprend
     * le pointeur. Chaque bouton capture donc SON pointeur, et relâche sur
     * pointerup, pointercancel ET lostpointercapture.
     *
     * La course n'a pas de bouton : maintenir une direction suffit. Le chemin
     * principal ne demande donc jamais plus de deux doigts. */
    window.LumenTouch.attach(game);

    /* ── Réglages de confort ─────────────────────────────────────────────── */
    function applySettings() {
      const s=game.progress.settings;
      game.audio.setMix?.(s);
      document.body.classList.toggle('left-handed',!!s.leftHanded);
      document.body.classList.toggle('reduced-effects',!!s.reducedEffects);
      document.documentElement.style.setProperty('--touch-scale',String(s.touchScale||1));
      document.querySelectorAll('[data-setting]').forEach(button=>{
        const current=String(s[button.dataset.setting]);
        button.setAttribute('aria-pressed',String(current===button.dataset.value));
      });
      document.querySelectorAll('[data-audio-setting]').forEach(input=>{
        input.value=Math.round(s[input.dataset.audioSetting]*100);
        const output=document.getElementById(input.id+'-value');if(output)output.textContent=input.value+' %';
      });
    }
    document.addEventListener('input',event=>{
      const input=event.target.closest('[data-audio-setting]');if(!input)return;
      game.store.setSetting(input.dataset.audioSetting,Number(input.value)/100);applySettings();
    });
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-setting]');if(!button)return;
      const raw=button.dataset.value;
      const value=raw==='true'?true:raw==='false'?false:Number(raw);
      game.store.setSetting(button.dataset.setting,value);
      applySettings();
    });
    // Un système qui demande moins d'animation est écouté dès le départ.
    if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!game.progress.settings.reducedEffects) {
      game.store.setSetting('reducedEffects',true);
    }
    applySettings();
    window.LumenJourneyUI.attach(game, { transition, toast });
    window.LumenSongUI?.attach(game, { transition, toast });
    const refreshAppearance=()=>{
      document.querySelectorAll('[data-appearance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===game.progress.settings.appearance)));
      game.audio.setNight?.(window.LumenAppearance.current==='dark');
      game.renderer.draw(game,0);
    };
    window.LumenAppearance.onChange(refreshAppearance);
    const refreshLanguage=()=>{
      document.title=translate('LUMEN · Le Chant des îles');
      const description='LUMEN — Le Chant des îles. Prends ton envol, retrouve les neuf voix du ciel et réveille un archipel. Une aventure originale, jouable au clavier, au tactile et à la manette, même hors ligne.';
      document.querySelector('meta[name="description"]').content=translate(description);
      I18n.translateDOM($('app'));
      document.querySelector('.home-meta>span:first-child').innerHTML='<i class="meta-dot"></i> '+escape(translate('{count} CHAPITRES À EXPLORER',{count:window.LUMEN_LEVELS.filter(level=>!level.hub).length}));
      document.querySelectorAll('[data-language-select]').forEach(select=>{select.innerHTML=I18n.languageOptions();select.value=game.progress.settings.language;});
      lastHud='';lastHint='';updateSound();
      if(lastToast&&$('toast').classList.contains('show'))$('toast').textContent=translate(lastToast.message,typeof lastToast.values==='function'?lastToast.values():lastToast.values);
      if(!game.song){
        if(lastRoute&&game.run===lastRoute.run)showRoute(lastRoute,true);
        if(lastResult&&lastResult.index===game.levelIndex)completed(lastResult);
        if(game.mode==='map')renderMap();
        if(game.mode==='dream')refreshDream();
        updateIntroText(game.level);
        const character=game.characters.find(entry=>entry.id===dialogueWho);
        if(character){$('dialogue-name').textContent=translate(character.name);$('dialogue-role').textContent=translate(character.role);$('dialogue-line').textContent=translate(dialogueLines[dialogueStep%dialogueLines.length]);}
        updateHud(.1);
      }
    };
    I18n.onChange(refreshLanguage);
    document.addEventListener('change',event=>{
      const select=event.target.closest('[data-language-select]');if(!select)return;
      const focusId=select.id;
      game.input.reset();game.store.setSetting('language',select.value);I18n.setLanguage(select.value);
      requestAnimationFrame(()=>$(focusId)?.focus({preventScroll:true}));
    });
    window.addEventListener('languagechange',()=>{if(game.progress.settings.language==='auto')I18n.setLanguage('auto');});
    refreshLanguage();
    refreshAppearance();
    showMode(null); updateSound();game.beginLoop();
    await window.LumenBoot.prepare(game);
  } catch(error) {
    console.error(error);$('error-notice').hidden=false;$('error-notice').textContent=translate('Le jardin n’a pas pu se réveiller. Ouvrez index.html dans un navigateur récent, et vérifiez que le dossier js est présent à côté du fichier. Détail : {error}',{error:error.message});
  }
})();
