(function (global) {
  'use strict';
  // A single authored palette: legacy night/system choices cannot recolor the game.
  const listeners = new Set();
  function normalize() { return 'light'; }
  function apply() {
    if (global.document) {
      global.document.documentElement.dataset.appearance = 'light';
      global.document.documentElement.style.colorScheme = 'light';
      const meta = global.document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = '#93c2df';
    }
    for (const listener of listeners) listener('light', 'light');
    return 'light';
  }
  global.LumenAppearance = {
    CHOICES: Object.freeze(['light']), normalize, resolve: normalize, apply,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    controls() { return ''; },
    get current() { return 'light'; }, get preference() { return 'light'; }
  };
  apply();
})(typeof window !== 'undefined' ? window : globalThis);
