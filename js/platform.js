/* Native boundary. Capacitor injects its bridge and plugin proxies in WKWebView;
 * the portable edition loads no SDK and retains its synchronous web storage. */
(function (global) {
  'use strict';
  const native = !!global.Capacitor?.isNativePlatform?.();
  const plugins = native ? global.Capacitor.Plugins : null;
  // WKWebView's default zoom flag only cancels an already-started pinch.
  // Lock the viewport before the first touch, only inside the native shell.
  if (native) {
    const doc = global.document;
    doc.documentElement.classList.add('lumen-native');
    const viewport = doc.querySelector?.('meta[name="viewport"]');
    if (viewport) viewport.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    const editable = target => target?.closest?.('input,textarea,[contenteditable="true"]');
    for (const event of ['selectstart', 'contextmenu', 'dragstart']) {
      doc.addEventListener(event, e => { if (!editable(e.target)) e.preventDefault(); }, { capture: true });
    }
    for (const event of ['gesturestart', 'gesturechange', 'gestureend']) {
      doc.addEventListener(event, e => e.preventDefault(), { passive: false });
    }
  }

  const keys = ['lumen.gardens.v3', 'lumen.gardens.v3.backup', 'lumen.gardens.v2', 'lumen.gardens.v1'];
  const file = { path: 'lumen-progress.json', directory: 'DATA', encoding: 'utf8' };
  let adapter, timer, pending = Promise.resolve();
  function primary() { try { return global.localStorage; } catch (_) { return null; } }
  function snapshot() {
    const store = primary();
    return Object.fromEntries(keys.map(key => [key, store.getItem(key)]).filter(([, value]) => value !== null));
  }
  function flush() {
    global.clearTimeout(timer);
    if (!native || !plugins?.Filesystem || !primary()) return pending;
    let data;
    try { data = JSON.stringify(snapshot()); } catch (_) { return pending; }
    // Serialize writes and rename atomically: interruption cannot truncate the last mirror.
    pending = pending.then(async () => {
      await plugins.Filesystem.writeFile({ ...file, path: file.path + '.tmp', data });
      await plugins.Filesystem.rename({ from: file.path + '.tmp', to: file.path, directory: file.directory });
    }).catch(() => { /* Primary save remains usable; retry on the next save. */ });
    return pending;
  }
  function changed() { global.clearTimeout(timer); timer = global.setTimeout(flush, 400); }
  function storage() {
    const store = primary();
    if (!native || !store) return store;
    if (!adapter) adapter = {
      getItem: key => store.getItem(key),
      setItem(key, value) { store.setItem(key, value); if (keys.includes(key)) changed(); },
      removeItem(key) { store.removeItem(key); if (keys.includes(key)) changed(); }
    };
    return adapter;
  }
  async function prepare() {
    if (!native || !primary() || !plugins?.Filesystem) return;
    try {
      // Unrelated web settings must not prevent recovery; existing LUMEN saves win.
      if (keys.some(key => primary().getItem(key) !== null)) return;
      const mirror = JSON.parse((await plugins.Filesystem.readFile(file)).data);
      if (!mirror || typeof mirror !== 'object' || Array.isArray(mirror)) return;
      const entries = keys.filter(key => typeof mirror[key] === 'string');
      for (const key of entries) primary().setItem(key, mirror[key]);
    } catch (_) { /* First launch, unavailable disk, or invalid mirror: use SaveStore's fallback. */ }
  }
  async function recoverAudio(audio) {
    if (!native || audio?.ctx?.state !== 'suspended') return;
    try { await audio.unlock(); } catch (_) { /* A subsequent gesture can retry. */ }
  }
  function attach(game) {
    if (!native) return;
    global.document.documentElement.classList.add('lumen-native');
    let active = true, wanted = false, lock = null, requesting = false;
    async function wake() {
      wanted = active && !global.document.hidden && game.mode === 'playing';
      if (!wanted) {
        const previous = lock; lock = null;
        try { await previous?.release(); } catch (_) {}
        return;
      }
      if (lock || requesting || !global.navigator?.wakeLock) return;
      requesting = true;
      try {
        const acquired = await global.navigator.wakeLock.request('screen');
        if (!wanted) await acquired.release();
        else {
          lock = acquired;
          acquired.addEventListener('release', () => { if (lock === acquired) lock = null; });
        }
      } catch (_) { /* Wake Lock is optional; the game must still run. */ }
      finally { requesting = false; }
    }
    function state(isActive) {
      active = isActive;
      if (!active) {
        if (game.mode === 'playing') game.pause();
        game.audio.pause(); game.input.reset();
        void flush();
      } else void recoverAudio(game.audio);
      void wake();
    }
    game.on('mode', wake);
    global.document.addEventListener('visibilitychange', () => {
      if (!global.document.hidden) void recoverAudio(game.audio);
      else void flush();
      void wake();
    });
    try { Promise.resolve(plugins?.App?.addListener('appStateChange', event => state(event.isActive))).catch(() => {}); } catch (_) {}
    try { Promise.resolve(plugins?.StatusBar?.hide()).catch(() => {}); } catch (_) {}
    void wake();
  }
  global.LumenPlatform = { native, storage, prepare, flush, recoverAudio, attach };
})(window);
