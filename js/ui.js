/* All menus and HUD live in the DOM: crisp text, keyboard focus and touch controls. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screens = ['home','map','pause','help','complete'];
  const powerInfo = {
    bloom:{name:'Fleur solaire',hint:'X / J · Graines de lumière',icon:'✺'},
    breeze:{name:'Plume d’azur',hint:'Un second saut dans les airs',icon:'≋'},
    comet:{name:'Cœur comète',hint:'X / J · Ruée protectrice',icon:'✦'},
    echo:{name:'Grelot d’écho',hint:'X / J · Révéler les chemins · 4 s',icon:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 22h16l-3-5v-5a5 5 0 0 0-10 0v5Z" fill="currentColor"/><path d="M14 25a2 2 0 0 0 4 0M16 5V3M4 14l2 1M28 14l-2 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}
  };
  const medals={bronze:'Bronze',silver:'Argent',gold:'Or'};
  let game, toastTimer, introTimer, damageTimer, helpPrevious='home', transitioning=false, lastHud='', lastHint='', uiTime=0, selectedRunMode='explore';
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
    const playing=['playing','dead','paused','gameover','complete','ending'].includes(mode) || (mode==='help'&&helpPrevious!=='home'&&helpPrevious!=='map');
    document.body.classList.toggle('in-game',playing);
    $('hud').classList.toggle('hidden',!playing);
    $('run-clock').classList.toggle('hidden',!playing||game.runMode!=='timed');
    $('touch-controls').classList.toggle('hidden',mode!=='playing'||(!matchMedia('(pointer: coarse)').matches&&navigator.maxTouchPoints===0));
    if (mode==='home') {
      showScreen('home');$('start-button').querySelector('span').textContent=game.progress.finished?'Repartir à l’aventure':game.progress.unlocked>0?'Poursuivre l’aventure':'Commencer l’aventure';
      $('chapter-intro').classList.remove('show');
    } else if (mode==='map') {showScreen('map');renderMap();updateRunMode();$('chapter-intro').classList.remove('show');}
    else if (mode==='paused'||mode==='gameover') {
      showScreen('pause');const over=mode==='gameover';
      $('pause-title').textContent=over?'Une lumière renaîtra.':'Le monde peut attendre.';
      $('pause-screen').querySelector('.modal-card>p').textContent=over?'Vos fragments et les chapitres terminés sont conservés. Repartez avec cinq vies.':game.runMode==='timed'?'Le chronomètre est en pause. Votre record attendra.':'Votre lumière sera toujours là.';
      $('pause-screen').querySelector('[data-command="resume"]').classList.toggle('hidden',over);
      $('pause-screen').querySelector('[data-command="retry"]').innerHTML=over?'Rallumer une lumière <span>↻</span>':'Recommencer le chapitre <span>↻</span>';
    } else if (mode==='help') showScreen('help');
    else if (mode==='complete'||mode==='ending') showScreen('complete');
    else showScreen(null);
    if (mode!=='playing') {$('level-hint').classList.add('hidden');$('power-indicator').classList.add('hidden');$('boss-hud').classList.add('hidden');}
  }
  function toast(message) {
    clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');
    toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3800);
  }
  function transition(fn) {
    if (transitioning) return;
    transitioning=true;$('transition').classList.add('show');game.input.reset();
    setTimeout(()=>{fn();$('transition').classList.remove('show');setTimeout(()=>{transitioning=false;},300);},320);
  }
  // The atlas choice is deliberately separate from the current run: retry and next
  // always retain the run's mode, while a fresh adventure starts in exploration.
  function startLevel(index, mode=selectedRunMode) {
    game.start(index,{timed:mode==='timed'});
  }
  function updateRunMode() {
    document.querySelectorAll('[data-run-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.runMode===selectedRunMode)));
    $('run-mode-hint').textContent=selectedRunMode==='timed'?'Un chrono, votre meilleur temps, et l’envie de recommencer.':'Le temps vous appartient. Explorez à votre rythme.';
    $('map-screen').classList.toggle('timed-selected',selectedRunMode==='timed');
  }
  function command(action) {
    if (transitioning) return;
    if (action==='sound') {
      game.audio.unlock();game.progress.muted=game.audio.toggle();game.saveProgress();updateSound();return;
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
      else if(game.mode==='map')transition(()=>game.showHome());
      return;
    }
    if(action==='resume'){game.resume();return;}
    if(action==='medal-help') {
      const open=$('medal-help').classList.toggle('hidden')===false;
      document.querySelector('[data-command="medal-help"]').setAttribute('aria-expanded',String(open));return;
    }
    if(action==='retry') {
      if(['playing','paused','dead','gameover'].includes(game.mode))transition(()=>game.retry());
      return;
    }
    if(action==='home'){transition(()=>game.showHome());return;}
    if(action==='map'){transition(()=>game.showMap());return;}
    if(action==='start'||action==='confirm') {
      if(game.mode==='home'){game.audio.unlock();transition(()=>startLevel(game.progress.finished?0:game.progress.unlocked,'explore'));}
      else if(game.mode==='paused')game.resume();
      else if(game.mode==='complete'||game.mode==='ending')command('next');
      else if(game.mode==='gameover')command('retry');
      return;
    }
    if(action==='replay'&&['complete','ending'].includes(game.mode)) {
      transition(()=>startLevel(game.levelIndex,game.runMode));return;
    }
    if(action==='next') {
      if(game.level.final||game.levelIndex>=window.LUMEN_LEVELS.length-1)transition(()=>game.showMap());
      else if(game.level.bonus&&game.progress.unlocked<game.levelIndex)transition(()=>startLevel(game.progress.unlocked,game.runMode));
      else transition(()=>startLevel(game.levelIndex+1,game.runMode));
    }
  }
  function updateSound() {
    document.querySelectorAll('.sound-label').forEach(el=>el.textContent=game.audio.muted?'SON COUPÉ':'SON ACTIVÉ');
    document.querySelectorAll('.sound-icon').forEach(el=>el.textContent=game.audio.muted?'♩':'♪');
    document.querySelectorAll('[data-command="sound"]').forEach(el=>{el.setAttribute('aria-pressed',String(!game.audio.muted));el.setAttribute('aria-label',game.audio.muted?'Activer le son':'Couper le son');});
  }
  function chapterArt(theme, index) {
    const colors={meadow:['#dce4bd','#bdd0a5','#5f8e7e','#f8e7b4'],cavern:['#a3b6c5','#7a95af','#49647c','#d1bbee'],tide:['#bbdad1','#81b5b0','#4f8f92','#ffe1a4'],sky:['#eee2c9','#bad1c7','#809d99','#ffedbb'],forge:['#d59a91','#af7881','#785a6b','#f8c093'],frost:['#d7e8e1','#a6c5ce','#6a929f','#faf8dd'],secret:['#e6bdce','#c39bb9','#947895','#ffe6af'],eclipse:['#697f8a','#4b636f','#314a59','#f8d393']};
    const [sky,far,land,moon]=colors[theme]||colors.meadow;
    let special='';
    if(theme==='cavern')special='<path d="M0 0h260l-27 28-17-18-24 34-27-37-39 18-18-19-43 30-20-13L0 43Z" fill="'+land+'" opacity=".55"/><path d="m63 62 7-35 12 35-10 8Zm111 8 8-30 12 29-10 10Z" fill="'+moon+'" opacity=".65"/>';
    if(theme==='tide')special='<path d="M0 77q30-12 60 0t60 0t60 0t80 0v35H0" fill="#70abb6" opacity=".7"/><path d="M0 86q30-8 60 0t60 0t60 0t80 0" fill="none" stroke="#e8eed0" opacity=".5"/>';
    if(theme==='forge')special='<path d="m100 84 28-58 33 58" fill="'+land+'"/><path d="m118 47 10-21 12 20-11-5Z" fill="'+moon+'"/><path d="M0 103q40-14 85-2t90 0t85 0v12H0" fill="#eaaa82"/>';
    if(theme==='eclipse')special='<circle cx="177" cy="27" r="19" fill="'+moon+'"/><circle cx="171" cy="23" r="17" fill="'+sky+'"/><path d="M113 86V48l8 5 8-16 8 16 9-5v38" fill="'+land+'"/>';
    const clouds=theme==='sky'?'<path d="M0 64q45-18 81-2t79-6t100 0v18H0" fill="#fff8e5" opacity=".5"/>':'';
    return `<svg viewBox="0 0 260 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="260" height="110" fill="${sky}"/><circle cx="191" cy="31" r="${theme==='eclipse'?0:19}" fill="${moon}" opacity=".8"/><path d="M-20 83Q30 26 74 71T151 50T285 74v50H-20" fill="${far}"/>${clouds}<path d="M-15 98Q37 54 95 88T187 78T280 79v50H-15" fill="${land}" opacity=".6"/><path d="M68 73h101l-12 17-30 12-45-13Z" fill="${land}"/><path d="M67 71q50-9 103 0v5H67" fill="${moon}" opacity=".75"/><path d="M111 72V56a12 12 0 0 1 24 0v16" fill="none" stroke="${moon}" stroke-width="5"/><path d="m32 36 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill="${moon}" opacity=".7"/>${special}</svg>`;
  }
  function renderMap() {
    $('total-stars').textContent=Object.values(game.progress.records).reduce((sum,r)=>sum+(r.stars||0),0)+' / '+window.LUMEN_LEVELS.reduce((n,l)=>n+l.collectibles.filter(c=>c.type==='star').length,0);
    $('level-grid').innerHTML=window.LUMEN_LEVELS.map((level,i)=>{
      const unlocked=game.isUnlocked(i),r=game.progress.records[i],number=String(i+1).padStart(2,'0');
      const status=r?.completed?'TERMINÉ':unlocked?'À EXPLORER':'VERROUILLÉ';
      const medal=medals[r?.medal]?r.medal:r?.completed?'bronze':null;
      const targets=level.medalTargets;
      const record=Number.isFinite(r?.bestTimedTime)?`◷ ${timeLabel(r.bestTimedTime,true)}`:'◷ À vous d’écrire le chrono';
      const medalMarkup=medal?`<span class="card-medal ${medal}" title="Médaille ${medals[medal]}" aria-label="Médaille ${medals[medal]}">✦ ${medals[medal]}</span>`:'<span class="card-medal unearned">✧ À décrocher</span>';
      const targetMarkup=targets?`<span class="card-targets">OR ${timeLabel(targets.gold)} <i>·</i> ARGENT ${timeLabel(targets.silver)}</span>`:'';
      return `<button class="level-card" data-level="${i}" ${unlocked?'':'disabled'} aria-label="Chapitre ${i+1}, ${escape(level.name)}, ${status.toLowerCase()}${medal?', médaille '+medals[medal]:''}"><div class="card-art">${chapterArt(level.theme,i)}<span class="card-number">${number} / ${String(window.LUMEN_LEVELS.length).padStart(2,'0')}</span><span class="card-status">${r?.completed?'✓':unlocked?'↗':'◇'}</span></div><div class="card-content"><h3>${escape(level.name)}</h3><p>${level.bonus?'Jardin secret · Le détour des curieux':escape(level.subtitle)}</p><div class="card-bottom"><span class="card-stars">${stars(r?.stars||0,level.collectibles.filter(c=>c.type==='star').length)}</span>${medalMarkup}</div><div class="card-record"><span>${record}</span>${targetMarkup}</div><span class="card-action">${status} <span aria-hidden="true">${unlocked?'↗':'◇'}</span></span></div></button>`;
    }).join('');
  }
  function updateHud(dt) {
    uiTime+=dt;if(uiTime<.07)return;uiTime=0;
    const p=game.player;
    const totalFragments=game.level.collectibles.filter(c=>c.type==='star').length;
    const key=[p.hp,game.lives,game.score,game.levelCoins,game.levelStars,game.levelIndex,game.runMode].join(':');
    if(key!==lastHud) {
      lastHud=key;$('hearts').innerHTML=Array.from({length:3},(_,i)=>`<span class="${i<p.hp?'':'empty'}">♥</span>`).join('');
      $('hearts').setAttribute('aria-label',`${p.hp} points de vie sur 3`);
      $('lives').textContent=`${Math.max(0,game.lives)} VIE${game.lives===1?'':'S'}`;
      $('score').textContent=String(game.score).padStart(6,'0');$('coin-count').textContent=String(game.levelCoins).padStart(2,'0');
      $('star-count').innerHTML=stars(game.levelStars,totalFragments);$('star-count').setAttribute('aria-label',`${game.levelStars} fragments sur ${totalFragments}`);
      $('chapter-number').textContent=String(game.levelIndex+1).padStart(2,'0');$('chapter-name').textContent=game.level.name;
      $('chapter-caption').textContent=game.runMode==='timed'?'CONTRE-LA-MONTRE':'LES JARDINS DE LA LUNE';
    }
    if(game.runMode==='timed') {
      $('clock-time').textContent=timeLabel(game.elapsed,true);
      const best=game.progress.records[game.levelIndex]?.bestTimedTime;
      $('clock-best').textContent=Number.isFinite(best)?'RECORD '+timeLabel(best,true):'PREMIÈRE COURSE';
      $('run-clock').classList.toggle('clock-paused',game.mode==='paused'||game.mode==='help');
    }
    if(game.mode!=='playing')return;
    $('power-indicator').classList.toggle('hidden',!p.power);
    if(p.power&&powerInfo[p.power]) {
      const info=powerInfo[p.power];$('power-icon').innerHTML=info.icon;$('power-name').textContent=info.name;$('power-description').textContent=info.hint;
      $('power-fill').style.width=Math.max(0,Math.min(100,p.powerTime/(p.powerDuration||35)*100))+'%';
      $('power-time').textContent=Math.ceil(Math.max(0,p.powerTime))+' s';
      $('power-indicator').classList.toggle('expiring',p.powerTime<=5);
      $('power-indicator').dataset.power=p.power;
    }
    const b=game.boss;
    $('boss-hud').classList.toggle('hidden',!b||!b.activated||b.hp<=0);
    if(b&&b.activated&&b.hp>0) {
      $('boss-fill').style.width=b.hp/b.maxHp*100+'%';$('boss-phase').textContent=b.phase===2?'PHASE II':'PHASE I';
      $('boss-tip').textContent=b.vulnerable?'Sa couronne est ouverte ! Sautez dessus ou utilisez votre pouvoir.':b.state==='telegraph'?'Le Veilleur prépare son attaque. Gardez de l’espace.':'Évitez les orbes. Sautez par-dessus les ondes au sol.';
    }
    const hint=(!b||!b.activated)?(game.level.hints||[]).find(h=>Math.abs(h.x-game.player.x)<180):null;
    $('level-hint').classList.toggle('hidden',!hint||$('chapter-intro').classList.contains('show'));
    if(hint&&hint.text!==lastHint){lastHint=hint.text;$('level-hint').textContent=hint.text;}
  }
  function chapterIntro(level) {
    clearTimeout(introTimer);$('intro-number').textContent=`CHAPITRE ${String(game.levelIndex+1).padStart(2,'0')} / ${String(window.LUMEN_LEVELS.length).padStart(2,'0')}`;
    $('intro-name').textContent=level.name;$('intro-subtitle').textContent=level.subtitle;
    $('chapter-intro').classList.add('show');introTimer=setTimeout(()=>$('chapter-intro').classList.remove('show'),2400);
    lastHint='';lastHud='';
    $('hud').classList.remove('heart-hit');
  }
  function healthImpact() {
    clearTimeout(damageTimer);$('hud').classList.remove('heart-hit');
    // Restart the one-shot pulse even when a second hit follows immediately.
    void $('hud').offsetWidth;$('hud').classList.add('heart-hit');
    damageTimer=setTimeout(()=>$('hud').classList.remove('heart-hit'),650);
  }
  function completed(result) {
    $('complete-eyebrow').textContent=result.final?'LES JARDINS SE SOUVIENDRONT DE VOUS':'UNE LUMIÈRE DE PLUS';
    $('complete-title').textContent=result.final?'Même la lune avait besoin de vous.':'Le jardin s’éveille.';
    $('complete-subtitle').textContent=result.final?'Nilo a rendu sa lumière au Veilleur. Au-dessus des jardins, la lune brille à nouveau. Le voyage continue dans les petits chemins encore inexplorés.':game.level.name+' · Chapitre terminé';
    const total=game.level.collectibles.filter(c=>c.type==='star').length;
    const medal=medals[result.medal]?result.medal:'bronze';
    const targets=game.level.medalTargets;
    const best=game.progress.records[result.index]?.bestTimedTime;
    $('result-stars').innerHTML=stars(result.stars,total);$('result-star-label').textContent=`${result.stars} / ${total} FRAGMENTS DE LUNE`;
    $('result-coins').textContent=result.coins;$('result-time').textContent=timeLabel(result.time,true);$('result-score').textContent=result.score.toLocaleString('fr-FR');
    $('result-enemies').textContent=result.enemiesDefeated||0;$('result-damage').textContent=result.damageTaken||0;
    $('result-medal').className='result-medal '+medal;$('result-medal-name').textContent=medals[medal];
    $('result-mode-label').textContent=result.timed?'CONTRE-LA-MONTRE':'TEMPS DU VOYAGE';
    $('result-best-label').textContent=result.timed?'MEILLEUR CHRONO':'OBJECTIF OR';
    $('result-best').textContent=result.timed&&Number.isFinite(best)?timeLabel(best,true):targets?timeLabel(targets.gold):'—';
    $('result-record').classList.toggle('hidden',!result.record||!result.timed);
    $('complete-note').textContent=result.secrets?`${result.secrets} passage${result.secrets>1?'s':''} secret${result.secrets>1?'s':''} découvert${result.secrets>1?'s':''} · +${result.bonus.toLocaleString('fr-FR')} points`:`+${result.bonus.toLocaleString('fr-FR')} points de fin de chapitre · ${result.stars<total?'Les jardins cachent encore quelques lumières.':'Tous les fragments sont réunis !'}`;
    $('result-medal-hint').textContent=medal==='gold'?'Un voyage éclatant. Saurez-vous encore améliorer votre temps ?':targets?`Pour l’or : 3 fragments · 1 dégât maximum · ${timeLabel(targets.gold)} ou moins.`:'Chaque retour dans les jardins est une nouvelle aventure.';
    $('next-button').innerHTML=result.final||game.levelIndex>=window.LUMEN_LEVELS.length-1?'Revoir les jardins <span>✧</span>':game.level.bonus&&game.progress.unlocked<game.levelIndex?'Reprendre l’aventure <span>→</span>':'Le prochain jardin <span>→</span>';
  }
  try {
    game=new window.LumenGame($('game'));window.lumen=game;
    game.on('command',command);game.on('mode',showMode);game.on('toast',toast);game.on('frame',updateHud);game.on('level',chapterIntro);game.on('complete',completed);game.on('damage',healthImpact);
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-command]');if(button){command(button.dataset.command);if(event.detail>0)button.blur();}
      const mode=event.target.closest('[data-run-mode]');if(mode&&!transitioning){selectedRunMode=mode.dataset.runMode;updateRunMode();}
      const level=event.target.closest('[data-level]');if(level&&!level.disabled){game.audio.unlock();transition(()=>startLevel(Number(level.dataset.level)));}
    });
    $('brand-home').addEventListener('click',event=>{event.preventDefault();command('home');});
    document.querySelectorAll('[data-touch]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);game.input.virtual(button.dataset.touch,true,e.pointerId);button.classList.add('held');});
      const release=e=>{game.input.virtual(button.dataset.touch,false,e.pointerId);button.classList.remove('held');};
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    });
    document.querySelector('.home-meta>span:first-child').innerHTML='<i class="meta-dot"></i> '+window.LUMEN_LEVELS.length+' CHAPITRES À EXPLORER';
    showMode('home');updateSound();game.beginLoop();
  } catch(error) {
    console.error(error);$('error-notice').hidden=false;$('error-notice').textContent='Le jardin n’a pas pu se réveiller. Ouvrez index.html dans un navigateur récent, et vérifiez que le dossier js est présent à côté du fichier. Détail : '+error.message;
  }
})();
