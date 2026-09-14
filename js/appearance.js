(function (global) {
  'use strict';
  const CHOICES = Object.freeze(['system', 'light', 'dark']);
  const listeners = new Set();
  const media = global.matchMedia?.('(prefers-color-scheme: dark)');
  let preference = 'system', current = 'light';

  function normalize(value) { return CHOICES.includes(value) ? value : 'system'; }
  function resolve(value, systemDark = !!media?.matches) {
    const choice = normalize(value);
    return choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;
  }
  function apply(value = preference) {
    preference = normalize(value);
    const previous = current;
    current = resolve(preference);
    if (global.document) {
      global.document.documentElement.dataset.appearance = current;
      global.document.documentElement.style.colorScheme = current;
      const meta = global.document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = current === 'dark' ? '#162f31' : '#93c2df';
    }
    for (const listener of listeners) listener(current, previous);
    return current;
  }
  function onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function controls(selected = preference) {
    const translate = source => global.LumenI18n?.t(source) || source;
    const options = [['system', 'Système', 'monitor'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']];
    return `<div class="appearance-options" role="group" aria-label="${translate('Apparence')}">` + options.map(([value, label, icon]) =>
      `<button type="button" data-appearance="${value}" aria-pressed="${selected === value}">${global.LumenIcons?.[icon] || ''}<span>${translate(label)}</span></button>`).join('') + '</div>';
  }
  const systemChanged = () => { if (preference === 'system') apply(); };
  if (media?.addEventListener) media.addEventListener('change', systemChanged);
  else media?.addListener?.(systemChanged);
  global.LumenAppearance = {
    CHOICES, normalize, resolve, apply, onChange, controls,
    get current() { return current; },
    get preference() { return preference; }
  };
  apply();
})(typeof window !== 'undefined' ? window : globalThis);