/* A deliberate first gesture: iOS audio is unlocked here, before the atlas.
 * Do not replace this button with an automatic timeout or a decorative splash. */
(function (global) {
  'use strict';
  const started = performance.now(), steps = new Set();
  const screen = document.getElementById('title-screen');
  const button = document.getElementById('title-enter');
  let game, ready = false;
  const mark = name => { steps.add(name); document.getElementById('boot-progress').value = steps.size; };
  const siblings = () => [...screen.parentElement.children].filter(node => node !== screen);
  siblings().forEach(node => { node.inert = true; });
  function enter() {
    if (!ready || screen.hidden) return;
    game.store.setSetting('titleSeen', true);
    game.audio.unlock(); // Must remain synchronous with this user gesture.
    screen.hidden = true; document.body.classList.remove('booting');
    siblings().forEach(node => { node.inert = false; });
    game.showMap(); game.journeyReturn = null;
  }
  async function prepare(instance) {
    game = instance; game.mode = 'title'; game.input.reset(); game.audio.pause();
    mark('save'); // Native mirror and synchronous SaveStore have both been read.
    await Promise.all([
      (document.fonts?.ready || Promise.resolve()).then(() => mark('fonts')),
      game.audio.prepare().then(() => mark('audio'))
    ]);
    global.LumenJourneyUI.render({ preload:true }); mark('atlas');
    const returning = game.progress.settings.titleSeen || Object.keys(game.progress.chapters).length > 0 || game.progress.codex.creatures.length > 0;
    button.textContent = global.LumenI18n.t(returning ? 'Continuer' : 'Commencer');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 1200 - (performance.now() - started))));
    ready = true; button.disabled = false;
    button.focus({preventScroll:true});
  }
  button.addEventListener('click', enter);
  global.LumenBoot = { prepare, enter, get ready(){return ready;}, get elapsed(){return performance.now()-started;}, get steps(){return [...steps];} };
})(window);
