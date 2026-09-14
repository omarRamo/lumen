(function (global) {
  'use strict';
  const byId = id => document.getElementById(id);
  const I18n = global.LumenI18n;
  const translate = (source, values) => I18n.t(source, values);
  const icon = name => global.LumenIcons?.[name] || '';
  const escape = value => String(value).replace(/[&<>"']/g, letter => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[letter]));
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const roundButton = (command, name, glyph) => `<button class="song-icon" data-command="${command}" aria-label="${escape(translate(name))}" title="${escape(translate(name))}">${icon(glyph)}</button>`;
  let game, helpers, pane = null, renderedPane = null, lastResult = null, returnFocus = null, pendingStyle = null;
  let lastHud = '', frameTime = 0;

  function applyPreferences() {
    const settings = game.progress.settings;
    document.body.classList.toggle('left-handed', settings.leftHanded);
    document.body.classList.toggle('reduced-effects', settings.reducedEffects);
    document.documentElement.style.setProperty('--touch-scale', settings.touchScale);
    game.audio.volume = settings.volume;
    game.audio.setMix?.(settings);
    document.querySelectorAll('[data-song-style]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.songStyle === (game.song?.style || settings.songStyle)));
    });
  }
  function changeStyle(style) {
    if (style === game.song?.style) return;
    pendingStyle = style; open('confirm-style');
  }
  function open(name) {
    if (!game.song) return;
    if (byId('song-overlay').hidden) returnFocus = document.activeElement;
    pane = name; renderedPane = null;
    if (game.mode === 'playing') game.pause();
    else sync();
  }
  function close() {
    pane = null; renderedPane = null;
    if (game.mode === 'paused') game.resume();
    else sync();
    if (returnFocus && document.contains(returnFocus) && returnFocus.getClientRects().length) returnFocus.focus({ preventScroll: true });
    else byId('game').focus({ preventScroll: true });
  }
  function title(kicker, heading) {
    return `<div class="song-dialog-heading"><span class="song-kicker">${kicker}</span><h2 id="song-panel-title">${heading}</h2></div>`;
  }
  function styleSwitch() {
    return `<div class="song-segment" role="group" aria-label="Rythme de l’aventure"><button data-song-style="gentle" aria-pressed="${game.song.style === 'gentle'}">${icon('leaf')} Balade</button><button data-song-style="flow" aria-pressed="${game.song.style === 'flow'}">${icon('wind')} Élan</button></div>`;
  }
  function renderPanel() {
    const panel = byId('song-panel');
    if (pane === renderedPane) return;
    renderedPane = pane;
    panel.className = 'song-panel song-panel-' + pane;
    const closeButton = pane === 'result' ? '' : roundButton('song-close', 'Reprendre', 'x');
    let content = '';
    if (pane === 'pause') {
      content = title('UNE PAUSE DANS LE VOYAGE', 'Le ciel peut attendre.') +
        `<p class="song-dialog-sub">${escape(translate(game.level.name))}</p><div class="song-pause-echoes">${echoes()}</div>
        <div class="song-dialog-actions"><button class="song-button song-primary" data-command="resume">${icon('play')} Reprendre le vol</button>
        <button class="song-button" data-command="song-retry">${icon('rotate-ccw')} Recommencer l’île</button>
        <button class="song-button" data-command="song-atlas">${icon('map')} L’archipel</button></div>
        <div class="song-pause-tools">${roundButton('song-settings', 'Réglages', 'settings-2')}${roundButton('sound', game.audio.muted ? 'Activer le son' : 'Couper le son', game.audio.muted ? 'volume-x' : 'volume-2')}</div>`;
    } else if (pane === 'atlas') {
      content = title('LES TROIS ÎLES DU CHANT', 'L’archipel des voix') + '<div class="song-islands">' + global.LumenSong.ISLANDS.map((island, index) => {
        const record = game.store.chapter(island.key), unlocked = !index || game.store.chapter(global.LumenSong.ISLANDS[index - 1].key)?.completed;
        const voices = island.lights.filter(echo => game.progress.codex.creatures.includes('chant-' + echo.id)).length;
        const name = translate(island.name);
        return `<button class="song-island" data-song-island="${index}" ${unlocked ? '' : 'disabled'} aria-label="${escape(unlocked ? name : translate('{name}, verrouillée', { name }))}">
          <div class="song-island-art"><canvas data-island-preview="${index}" width="640" height="300" aria-hidden="true"></canvas><span>${String(index + 1).padStart(2, '0')}</span></div>
          <div class="song-island-copy"><small>${record?.completed ? 'LE CHŒUR EST RÉUNI' : unlocked ? 'LE VOYAGE CONTINUE' : 'LE CHANT ATTEND'}</small><h3>${escape(island.name)}</h3>
          <p>${escape(island.subtitle)}</p><div class="song-island-meta"><span>${icon('sparkles')} ${voices} / 3</span><span>${icon('feather')} ${record?.stars || 0} / 3</span>${record?.bestTimedTime ? `<span>${icon('wind')} ${clock(record.bestTimedTime)}</span>` : ''}</div></div>
          <span class="song-island-arrow">${icon(unlocked ? 'arrow-up-right' : 'lock-keyhole')}</span></button>`;
      }).join('') + `</div><div class="song-atlas-footer"><span>Au-delà de l’archipel</span><button class="song-text-button" data-command="song-classic">Les jardins de la lune ${icon('arrow-right')}</button></div>`;
    } else if (pane === 'settings') {
      const settings = game.progress.settings;
      content = title('À TON RYTHME', 'Un peu de confort') +
        `<label class="song-settings-row" for="song-language"><span>Langue</span><select id="song-language" data-language-select>${I18n.languageOptions()}</select></label>
        <div class="song-settings-row appearance-row"><span>Apparence</span>${global.LumenAppearance.controls(settings.appearance)}</div>
        <div class="song-settings-row"><span>Le voyage</span>${styleSwitch()}</div>
        <label class="song-settings-row song-range-row" for="song-volume"><span>Volume</span><input id="song-volume" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" data-song-pref="volume"><output id="song-volume-value">${Math.round(settings.volume * 100)} %</output></label>
        ${[['musicVolume','Musique','music'],['effectsVolume','Effets sonores','sparkles'],['ambienceVolume','Ambiance','wind']].map(([setting,label,glyph])=>`<label class="song-settings-row song-range-row song-mix-row" for="song-${setting}"><span>${icon(glyph)}<span>${translate(label)}</span></span><input id="song-${setting}" type="range" min="0" max="100" value="${Math.round(settings[setting]*100)}" data-song-pref="${setting}"><output id="song-${setting}-value">${Math.round(settings[setting]*100)} %</output></label>`).join('')}
        <button class="song-text-button sound-preview" data-command="sound-preview">${icon('headphones')} Écouter LUMEN</button>
        <label class="song-settings-row" for="song-reduced"><span>Mouvements réduits</span><input id="song-reduced" type="checkbox" role="switch" data-song-pref="reducedEffects" ${settings.reducedEffects ? 'checked' : ''}></label>
        <label class="song-settings-row" for="song-left"><span>Commandes pour gaucher</span><input id="song-left" type="checkbox" role="switch" data-song-pref="leftHanded" ${settings.leftHanded ? 'checked' : ''}></label>
        <label class="song-settings-row song-range-row" for="song-touch-size"><span>Taille des commandes</span><input id="song-touch-size" type="range" min="85" max="130" step="5" value="${Math.round(settings.touchScale * 100)}" data-song-pref="touchScale"><output id="song-touch-size-value">${Math.round(settings.touchScale * 100)} %</output></label>
        <button class="song-button song-primary" data-command="song-close">${icon('check')} Revenir au ciel</button>`;
    } else if (pane === 'confirm-style') {
      content = title('UN NOUVEAU DÉPART', 'Changer de rythme ?') +
        `<p class="song-dialog-sub">Cette île recommencera. Les îles achevées restent acquises.</p><div class="song-dialog-actions"><button class="song-button song-primary" data-command="song-apply-style">${icon('rotate-ccw')} ${escape(translate('Partir en {style}', { style: translate(pendingStyle === 'flow' ? 'Élan' : 'Balade') }))}</button><button class="song-button" data-command="song-close">Annuler</button></div>`;
    } else if (pane === 'result' && lastResult) {
      const result = lastResult;
      content = `<div class="song-result-mark">${icon(result.final ? 'sun' : 'sparkles')}</div>` +
        title(result.final ? 'LES NEUF VOIX SONT RÉUNIES' : 'UNE ÎLE A RETROUVÉ SA VOIX', result.final ? 'Le ciel se souvient.' : 'Ensemble, on va plus haut.') +
        `<p class="song-dialog-sub">${result.final ? 'Auralis reprend son voyage. Il emporte un peu de vous.' : escape(game.level.name)}</p>
        <div class="song-pause-echoes">${echoes()}</div><div class="song-results">
        <div><span>NOTES</span><strong>${result.coins}</strong></div><div><span>PLUS BEL ÉLAN</span><strong>×${result.combo}</strong></div>
        <div><span>SOUVENIRS</span><strong>${result.stars} / 3</strong></div><div><span>${result.timed ? 'CHRONO' : 'VOYAGE'}</span><strong>${clock(result.time)}</strong></div></div>
        ${result.timed && result.record ? '<p class="song-record">' + icon('trophy') + ' Nouveau record personnel</p>' : ''}
        <div class="song-dialog-actions"><button class="song-button song-primary" data-command="song-next">${result.final ? 'Revoir l’archipel' : 'Vers la prochaine île'} ${icon('arrow-right')}</button>
        <button class="song-text-button" data-command="song-retry">${icon('rotate-ccw')} Rejouer cette île</button></div>`;
    }
    panel.innerHTML = closeButton + content;
    I18n.translateDOM(panel);
    const languageSelect = panel.querySelector('[data-language-select]');
    if (languageSelect) languageSelect.value = game.progress.settings.language;
    if (pane === 'atlas') renderPreviews();
    const focus = panel.querySelector('.song-primary, [data-song-island]:not(:disabled), input, select, button');
    requestAnimationFrame(() => { if (!byId('song-overlay').hidden) (focus || panel).focus({ preventScroll: true }); });
  }
  function renderPreviews() {
    for (const canvas of byId('song-panel').querySelectorAll('[data-island-preview]')) {
      const index = Number(canvas.dataset.islandPreview), level = global.LumenSong.create(index);
      const renderer = new global.LumenRenderer(canvas); renderer.resize(640, 300);
      const preview = { ...game, level, song: new global.LumenSong.Journey(level.song),
        player: { ...game.player, x: 230, y: 554, vx: 0, vy: 0, grounded: true, gliding: false, dead: false, anim: 0, landTimer: 0 },
        camera: { x: 0, y: 0, shake: 0 }, time: 3, platforms: level.platforms.map(platform => ({ ...platform, active: true })),
        wakeables: [], collectibles: level.collectibles, checkpoints: [], particles: [], floatingTexts: [], waves: [], exit: level.exit };
      renderer.draw(preview, 0);
    }
  }
  function echoes() {
    return game.song.lights.map(echo => {
      const label = escape(translate(echo.found ? '{name}, retrouvé' : '{name}, à retrouver', { name: translate(echo.name) }));
      return `<span class="song-echo ${echo.found ? 'found' : ''}" style="--echo-color:${echo.color}" title="${label}" aria-label="${label}"><i class="echo-ear echo-ear-left"></i><i class="echo-ear echo-ear-right"></i><i class="echo-face"><b></b><b></b></i></span>`;
    }).join('');
  }
  function sync() {
    if (!game) return;
    const active = !!game.song;
    document.body.classList.toggle('song-playing', active);
    byId('song-shell').hidden = !active;
    if (!active) { pane = null; renderedPane = null; byId('song-overlay').hidden = true; byId('touch-controls').inert = false; return; }
    const mode = game.mode;
    if (mode === 'playing' || mode === 'dead') pane = null;
    else if (mode === 'paused' && !pane) pane = 'pause';
    else if ((mode === 'complete' || mode === 'ending') && !pane) pane = 'result';
    byId('song-overlay').hidden = !pane;
    byId('song-shell').inert = !!pane;
    byId('touch-controls').inert = !!pane;
    byId('game').tabIndex = pane ? -1 : 0;
    byId('touch-controls').classList.toggle('hidden', mode !== 'playing');
    if (pane) renderPanel(); else renderedPane = null;
    lastHud = ''; update(.1); applyPreferences();
  }
  function update(dt) {
    if (!game.song) return;
    frameTime += dt; if (frameTime < .08) return; frameTime = 0;
    const song = game.song, mode = game.mode;
    const key = [song.index, song.count, game.levelStars, game.levelCoins, song.style, game.audio.muted, I18n.language].join(':');
    if (key !== lastHud) {
      lastHud = key;
      byId('song-island-number').textContent = String(song.index + 1).padStart(2, '0') + ' / 03';
      byId('song-island-name').textContent = translate(game.level.name);
      byId('song-echoes').innerHTML = echoes();
      byId('song-voice-count').textContent = song.count + ' / 3';
      byId('song-note-count').textContent = String(game.levelCoins).padStart(2, '0');
      byId('song-memory-count').textContent = game.levelStars + ' / 3';
      byId('song-sound').innerHTML = icon(game.audio.muted ? 'volume-x' : 'volume-2');
      byId('song-sound').setAttribute('aria-label', translate(game.audio.muted ? 'Activer le son' : 'Couper le son'));
      byId('song-sound').title = translate(game.audio.muted ? 'Activer le son' : 'Couper le son');
      byId('song-sound').setAttribute('aria-pressed', String(!game.audio.muted));
    }
    const target = song.nearest(game.player);
    const distance = target ? Math.round(Math.hypot(target.x - game.player.x, target.y - game.player.y)) : 0;
    byId('song-goal').textContent = target ? translate(distance < 230 ? '{name} attend quelque part, tout près.' : '{name} attend quelque part.', { name: translate(target.name) }) : translate('Le chœur est réuni. Le passage est ouvert.');
    byId('song-bearing').style.transform = `rotate(${Math.atan2((target?.y || 540) - (game.player.y + 20), (target?.x || game.exit.x) - game.player.x)}rad)`;
    byId('song-clock').hidden = song.style !== 'flow';
    byId('song-clock').textContent = clock(game.elapsed);
    byId('song-combo').hidden = song.combo < 2 || mode !== 'playing';
    byId('song-combo-count').textContent = '×' + song.combo;
    byId('song-combo-label').textContent = translate(song.combo >= 10 ? 'EN PLEIN ÉLAN' : 'LE FIL DU CHANT');
    byId('song-combo-fill').style.transform = `scaleX(${song.comboTime / (song.style === 'flow' ? 2.5 : 4)})`;
  }
  function handle(action) {
    if (!game) return false;
    if (action === 'song-return') {
      helpers.transition(() => game.startSong(game.nextSongIndex())); return true;
    }
    if (!game.song) return false;
    if (action === 'sound') {
      game.audio.unlock(); game.store.setSetting('muted', game.audio.toggle());
      if (pane === 'pause') { renderedPane = null; renderPanel(); }
      update(.1); return true;
    }
    if (action === 'song-fullscreen') {
      const operation = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
      if (operation?.catch) operation.catch(() => helpers.toast('Le plein écran n’est pas disponible ici.'));
      return true;
    }
    if (action === 'song-atlas' || action === 'map' || action === 'home') { open('atlas'); return true; }
    if (action === 'song-settings' || action === 'help') { open('settings'); return true; }
    if (action === 'pause') { if (game.mode === 'playing') open('pause'); else if (game.mode === 'paused') close(); return true; }
    if (action === 'resume' || action === 'song-close' || action === 'close-help') { close(); return true; }
    if (action === 'song-classic') { helpers.transition(() => game.showHome()); return true; }
    if (action === 'song-retry' || action === 'retry' || action === 'replay') {
      const index = game.song.index, style = game.song.style;
      helpers.transition(() => game.startSong(index, { style })); return true;
    }
    if (action === 'song-apply-style') {
      const index = game.song.index, style = pendingStyle;
      game.store.setSetting('songStyle', style);
      helpers.transition(() => game.startSong(index, { style })); return true;
    }
    if (action === 'song-next' || action === 'next' || action === 'confirm') {
      if (game.mode === 'paused') close();
      else if (game.mode === 'complete') { const index = game.song.index + 1, style = game.song.style; helpers.transition(() => game.startSong(index, { style })); }
      else if (game.mode === 'ending') open('atlas');
      return true;
    }
    return false;
  }
  function attach(instance, callbacks) {
    game = instance; helpers = callbacks;
    document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
    const glyphs = { left: 'arrow-left', right: 'arrow-right', jump: 'feather', action: 'sparkles' };
    document.querySelectorAll('[data-touch]').forEach(button => {
      if (glyphs[button.dataset.touch]) button.innerHTML = icon(glyphs[button.dataset.touch]);
      const names = { left: 'À gauche · Q / A / ←', right: 'À droite · D / →', jump: 'Sauter, planer · Espace', action: 'Chanter · X / J' };
      if (names[button.dataset.touch]) button.title = translate(names[button.dataset.touch]);
    });
    game.on('song-rescue', echo => helpers.toast('{name} chante avec toi.', () => ({ name: translate(echo.name) })));
    game.on('song-complete', result => { lastResult = result; pane = 'result'; renderedPane = null; });
    const unlockSound = event => {
      if (game.song && ['playing', 'dead'].includes(game.mode) && !event.target.closest('#song-overlay')) game.audio.unlock();
    };
    document.addEventListener('pointerdown', unlockSound);
    document.addEventListener('keydown', unlockSound);
    document.addEventListener('click', event => {
      const style = event.target.closest('[data-song-style]');
      if (style && game.song) changeStyle(style.dataset.songStyle);
      const island = event.target.closest('[data-song-island]');
      if (island && !island.disabled && game.song) {
        const index = Number(island.dataset.songIsland), style = game.song.style;
        if (index === game.song.index && game.mode === 'paused') close();
        else helpers.transition(() => game.startSong(index, { style }));
      }
      const touch = event.target.closest('[data-touch]');
      if (touch && event.detail === 0 && game.mode === 'playing') {
        const action = touch.dataset.touch; game.input.virtual(action, true, 'keyboard-control');
        setTimeout(() => game.input.virtual(action, false, 'keyboard-control'), 140);
      }
    });
    byId('song-overlay').addEventListener('click', event => { if (event.target === byId('song-overlay') && game.mode === 'paused') close(); });
    document.addEventListener('input', event => {
      const control = event.target.closest('[data-song-pref]'); if (!control) return;
      const setting = control.dataset.songPref, value = control.type === 'checkbox' ? control.checked : Number(control.value) / 100;
      game.store.setSetting(setting, value); applyPreferences();
      if (control.type === 'range') byId(control.id + '-value').textContent = control.value + ' %';
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || byId('song-overlay').hidden) return;
      const controls = [...byId('song-panel').querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]')].filter(element => element.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !byId('song-panel').contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.addEventListener('fullscreenchange', () => {
      byId('song-fullscreen').innerHTML = icon(document.fullscreenElement ? 'minimize' : 'maximize');
      const label = translate(document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran');
      byId('song-fullscreen').setAttribute('aria-label', label); byId('song-fullscreen').title = label;
    });
    I18n.onChange(() => {
      renderedPane = null; lastHud = '';
      I18n.translateDOM(byId('song-shell'));
      const names = { left: 'À gauche · Q / A / ←', right: 'À droite · D / →', jump: 'Sauter, planer · Espace', action: 'Chanter · X / J' };
      document.querySelectorAll('[data-touch]').forEach(button => {
        if (names[button.dataset.touch]) button.title = translate(names[button.dataset.touch]);
      });
      if (game.song) sync();
    });
    global.LumenAppearance.onChange(() => { if (pane === 'atlas' && game.song) renderPreviews(); });
    if (!document.fullscreenEnabled) byId('song-fullscreen').hidden = true;
    applyPreferences();
  }
  global.LumenSongUI = { attach, sync, update, handle };
})(window);