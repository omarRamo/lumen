(function (global) {
  'use strict';
  const LANGUAGES = Object.freeze({
    en: { label: 'English', locale: 'en', dir: 'ltr' },
    fr: { label: 'Français', locale: 'fr', dir: 'ltr' },
    es: { label: 'Español', locale: 'es', dir: 'ltr' },
    ar: { label: 'العربية', locale: 'ar', dir: 'rtl' },
    zh: { label: '简体中文', locale: 'zh-Hans', dir: 'ltr' }
  });
  const messages = new Map();
  const listeners = new Set();
  const originals = new WeakMap();
  let language = 'en', preference = 'auto';

  function normalize(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const code = new Intl.Locale(value.trim().replace(/_/g, '-')).language;
      return Object.hasOwn(LANGUAGES, code) ? code : null;
    } catch (_) { return null; }
  }
  function systemLanguages() {
    const browser = global.navigator || {};
    return [...(Array.isArray(browser.languages) ? browser.languages : []), browser.language].filter(Boolean);
  }
  function resolve(selected = 'auto', candidates = systemLanguages()) {
    const saved = normalize(selected);
    if (saved) return saved;
    for (const candidate of Array.isArray(candidates) ? candidates : [candidates]) {
      const supported = normalize(candidate);
      if (supported) return supported;
    }
    return 'en';
  }
  function add(entries) {
    for (const [source, en, es, ar, zh] of entries) {
      if (![source, en, es, ar, zh].every(value => typeof value === 'string' && value.length)) {
        throw new TypeError('Incomplete translation: ' + source);
      }
      if (messages.has(source)) throw new Error('Duplicate translation: ' + source);
      messages.set(source, { fr: source, en, es, ar, zh });
    }
  }
  function translate(source, values = {}) {
    if (typeof source !== 'string') return source;
    const entry = messages.get(source);
    const text = entry?.[language] || entry?.en || source;
    return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, key) =>
      Object.hasOwn(values, key) ? String(values[key]) : token);
  }
  function setLanguage(selected = 'auto', candidates) {
    preference = normalize(selected) || 'auto';
    language = resolve(preference, candidates);
    if (global.document) {
      global.document.documentElement.lang = LANGUAGES[language].locale;
      global.document.documentElement.dir = LANGUAGES[language].dir;
    }
    for (const listener of listeners) listener(language);
    return language;
  }
  function onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function translateDOM(root = global.document?.body) {
    if (!root) return;
    const document = root.ownerDocument;
    const excluded = 'script, style, svg, noscript, [translate="no"]';
    const update = (node, field, value, write) => {
      const fields = originals.get(node) || {};
      let record = fields[field];
      if (!record || record.rendered !== value) {
        const source = value.trim().replace(/\s+/g, ' ');
        if (!messages.has(source)) { delete fields[field]; originals.set(node, fields); return; }
        record = { source, prefix: value.match(/^\s*/)[0], suffix: value.match(/\s*$/)[0] };
        fields[field] = record;
      }
      record.rendered = record.prefix + translate(record.source) + record.suffix;
      if (value !== record.rendered) write(record.rendered);
      originals.set(node, fields);
    };
    const walker = document.createTreeWalker(root, 4);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest(excluded)) continue;
      update(node, 'text', node.nodeValue, value => { node.nodeValue = value; });
    }
    for (const element of [root, ...root.querySelectorAll('[aria-label], [title], [placeholder], [alt]')]) {
      if (element.closest(excluded)) continue;
      for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
        if (element.hasAttribute(attribute)) update(element, attribute, element.getAttribute(attribute), value => element.setAttribute(attribute, value));
      }
    }
  }
  function languageOptions() {
    return '<option value="auto">' + translate('Langue du système') + '</option>' +
      Object.entries(LANGUAGES).map(([code, entry]) => `<option value="${code}" lang="${entry.locale}" dir="${entry.dir}" translate="no">${entry.label}</option>`).join('');
  }
  global.LumenI18n = {
    LANGUAGES, normalize, resolve, add, t: translate, setLanguage, onChange, translateDOM, languageOptions,
    get language() { return language; }, get preference() { return preference; },
    get locale() { return LANGUAGES[language].locale; },
    get direction() { return LANGUAGES[language].dir; },
    get canvasFont() { return language === 'ar' ? 'Tahoma, "Noto Sans Arabic", sans-serif' : language === 'zh' ? '"Microsoft YaHei", "PingFang SC", sans-serif' : 'Outfit, sans-serif'; },
    entries: () => [...messages.entries()],
    has: source => messages.has(source),
    number: (value, options) => new Intl.NumberFormat(LANGUAGES[language].locale, options).format(value)
  };
})(typeof window !== 'undefined' ? window : globalThis);